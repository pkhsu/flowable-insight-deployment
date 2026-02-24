// config_active_user_coverage_clickhouse.js

cube('config_active_user_coverage_clickhouse', {
  // dataSource: 'datasource2',

  sql: `
WITH
  -- =============================
  -- Active side
  -- =============================
  ActiveTasks AS (
    SELECT
      t.ID_           AS task_id,
      t.PROC_INST_ID_ AS p_i_id,
      t.ASSIGNEE_     AS assignee,
      substring(t.TASK_DEF_KEY_, 1, 2) AS vteam,
      t.START_TIME_   AS start_time,
      ifNull(t.END_TIME_, toDateTime('2999-12-31 00:00:00')) AS end_time_eff
    FROM flowable_analytics.ACT_HI_TASKINST AS t
    WHERE
      substring(t.TASK_DEF_KEY_, 1, 2) IN ('V1','V2','V3')
      AND (t.ASSIGNEE_ IS NULL OR t.ASSIGNEE_ NOT LIKE 'DMPV%')
  ),

  AllInvolvedUsers AS (
    SELECT
      at.assignee AS user_id,
      at.p_i_id,
      at.vteam,
      at.start_time,
      at.end_time_eff
    FROM ActiveTasks AS at
    WHERE at.assignee IS NOT NULL

    UNION DISTINCT

    SELECT
      il.USER_ID_ AS user_id,
      at.p_i_id,
      at.vteam,
      at.start_time,
      at.end_time_eff
    FROM flowable_analytics.ACT_HI_IDENTITYLINK AS il
    INNER JOIN ActiveTasks AS at
      ON il.TASK_ID_ = at.task_id
    WHERE
      il.TYPE_ = 'candidate'
      AND il.USER_ID_ IS NOT NULL
  ),

  VarPivoted AS (
    SELECT
      v.PROC_INST_ID_ AS p_i_id,
      maxIf(v.TEXT_, v.NAME_ = 'plant')   AS plant,
      -- ⚠️ 這個 factory 會拿來對 configUser.mfg_plant_codes 做 match（你的語意是 MFG_PLANT_CODE）
      maxIf(v.TEXT_, v.NAME_ = 'factory') AS factory,
      maxIf(v.TEXT_, v.NAME_ = 'region')  AS region
    FROM flowable_analytics.ACT_HI_VARINST AS v
    WHERE v.NAME_ IN ('plant', 'factory', 'region')
    GROUP BY v.PROC_INST_ID_
  ),

  ActiveRows AS (
    SELECT
      'active' AS kind,
      u.user_id AS subject_id,
      u.vteam   AS vteam,
      nullIf(trim(vp.plant), '')   AS plant,
      nullIf(trim(vp.factory), '') AS factory,
      nullIf(trim(vp.region), '')  AS region,

      CAST(NULL AS Nullable(String)) AS line_name,

      CAST(NULL AS Nullable(String)) AS emp_name,
      CAST(NULL AS Nullable(String)) AS user_group_names,

      CAST(NULL AS Nullable(String)) AS node_codes,
      CAST(NULL AS Nullable(String)) AS mfg_plant_codes,
      CAST(NULL AS Nullable(String)) AS candidate_vteam,
      CAST(NULL AS Nullable(UInt8))  AS eligible,

      CAST(NULL AS Nullable(UInt8))  AS covered,

      u.start_time   AS start_time,
      u.end_time_eff AS end_time_eff,

      toUnixTimestamp(u.start_time)   AS start_unix,
      toUnixTimestamp(u.end_time_eff) AS end_unix
    FROM AllInvolvedUsers u
    LEFT JOIN VarPivoted vp ON vp.p_i_id = u.p_i_id
  ),

  -- =============================
  -- Config side (ConfigUsers)
  -- =============================

  user_groups AS (
    SELECT
      e.EmpCode,
      arrayStringConcat(arraySort(groupUniqArray(u.UserGroupName)), ',') AS UserGroupNames
    FROM flowable_analytics.EmpUserGroupMapping e
    INNER JOIN flowable_analytics.UserGroup u
      ON u.UserGroupId = e.UserGroupId
    GROUP BY e.EmpCode
  ),

  vx_map AS (
    SELECT DISTINCT EmpCode, Vx
    FROM flowable_analytics.EmpNodeRoleMapping
  ),

  node_codes AS (
    SELECT
      EmpCode,
      Vx,
      arrayStringConcat(arraySort(groupUniqArray(NodeCode)), ',') AS NodeCodes
    FROM flowable_analytics.EmpNodeRoleMapping
    GROUP BY EmpCode, Vx
  ),

  mfg_codes AS (
    SELECT
      o2.EmpCode,
      arrayStringConcat(arraySort(groupUniqArray(m2.MFG_PLANT_CODE)), ',') AS MFG_PLANT_CODES_ALL
    FROM flowable_analytics.EmpOrgInfoMapping o2
    INNER JOIN flowable_analytics.MDM_MFG_PLANT_MASTER m2
      ON o2.MFGFactoryId = m2.MFG_PLANT_ID
    GROUP BY o2.EmpCode
  ),

  process_lines AS (
    SELECT
      EmpCode,
      arrayStringConcat(arraySort(groupUniqArray(LineName)), ',') AS LineName
    FROM flowable_analytics.ProcessRoleUserMapping
    GROUP BY EmpCode
  ),

  -- ✅ region -> 全部 MFG_PLANT_CODE array（給 mfg_plant_codes='*' 展開用）
  region_factory_list AS (
    SELECT
      mfam.MFG_SITE AS region,
      groupUniqArray(m2.MFG_PLANT_CODE) AS factories
    FROM flowable_analytics.MDM_MFG_PLANT_MASTER m2
    INNER JOIN flowable_analytics.MDM_FACTORY_AREA_MASTER mfam
      ON mfam.FACTORY = m2.FACTORY
    GROUP BY mfam.MFG_SITE
  ),

  base AS (
    SELECT DISTINCT
      e.EmpCode AS emp_code,
      h.EmpName AS emp_name,
      ug.UserGroupNames AS user_group_names,

      vx.Vx AS vx,

      nullIf(trim(o.Plant), '')       AS plant,
      nullIf(trim(mfam.MFG_SITE), '') AS region,
      nullIf(trim(pl.LineName), '')   AS line_name,

      nc.NodeCodes AS node_codes,
      if(o.MFGFactoryId = '*', '*', mc.MFG_PLANT_CODES_ALL) AS mfg_plant_codes
    FROM flowable_analytics.EmpUserGroupMapping e
    INNER JOIN flowable_analytics.HR_Employee h
      ON e.EmpCode = h.EmpCode
    INNER JOIN flowable_analytics.EmpOrgInfoMapping o
      ON e.EmpCode = o.EmpCode

    INNER JOIN vx_map vx
      ON vx.EmpCode = e.EmpCode

    INNER JOIN flowable_analytics.MDM_MFG_PLANT_MASTER mppm
      ON (o.MFGFactoryId = mppm.MFG_PLANT_ID) OR (o.MFGFactoryId = '*')
    INNER JOIN flowable_analytics.MDM_FACTORY_AREA_MASTER mfam
      ON mfam.FACTORY = mppm.FACTORY

    LEFT JOIN user_groups ug
      ON ug.EmpCode = e.EmpCode
    LEFT JOIN node_codes nc
      ON nc.EmpCode = e.EmpCode AND nc.Vx = vx.Vx
    LEFT JOIN mfg_codes mc
      ON mc.EmpCode = e.EmpCode

    LEFT JOIN process_lines pl
      ON pl.EmpCode = e.EmpCode

    WHERE vx.Vx IN ('V1','V2','V3')
  ),

  candidates AS (
    SELECT
      *,
      arrayFilter(x -> x != '',
        [
          if(match(ifNull(node_codes,''), '(^|,)V1[_.]'), 'V1', ''),
          if(match(ifNull(node_codes,''), '(^|,)V2[_.]'), 'V2', ''),
          if(match(ifNull(node_codes,''), '(^|,)V3[_.]'), 'V3', '')
        ]
      ) AS candidate_vteams
    FROM base
  ),

  expanded AS (
    SELECT
      emp_code,
      emp_name,
      user_group_names,
      plant, region, line_name,
      node_codes,
      mfg_plant_codes,
      arrayJoin(candidate_vteams) AS candidate_vteam
    FROM candidates
  ),

  assigned1 AS (
    SELECT
      emp_code,
      emp_name,
      user_group_names,
      plant, region, line_name,
      node_codes,
      mfg_plant_codes,
      candidate_vteam,

      multiIf(
        candidate_vteam = 'V1' AND (
          mfg_plant_codes = '*'
          OR match(ifNull(mfg_plant_codes,''), '(^|,)NPE(,|$)')
        ), 'V1',

        candidate_vteam = 'V2' AND (mfg_plant_codes = '*'), 'V2',

        candidate_vteam = 'V3' AND (mfg_plant_codes = '*'), 'V3',
        candidate_vteam = 'V3' AND match(ifNull(mfg_plant_codes,''), '(^|,)NPE(,|$)'), 'V1',
        candidate_vteam = 'V3' AND NOT match(ifNull(mfg_plant_codes,''), '(^|,)NPE(,|$)'), 'V3',

        'EXCLUDED'
      ) AS rules_vteam
    FROM expanded
  ),

  assigned AS (
    SELECT
      *,
      multiIf(
        rules_vteam IN ('V2','V3') AND user_group_names = 'User', 1,
        rules_vteam = 'V1' AND user_group_names IN ('User','PMUser','PowerUser'), 1,
        0
      ) AS eligible
    FROM assigned1
  ),

  -- ✅ Config users 展開成 (plant, factory) 一對多（工廠 code 就是 mfg_plant_codes 的元素）
  ConfigExpanded AS (
    SELECT
      a.emp_code,
      a.emp_name,
      a.user_group_names,
      a.plant,
      a.region,
      a.line_name,
      a.node_codes,
      a.mfg_plant_codes,
      a.candidate_vteam,
      a.rules_vteam,
      a.eligible,

      -- '*' => 展開成該 region 的全部 factories
      -- 非 '*' => split mfg_plant_codes
      arrayJoin(
        arrayFilter(x -> x != '',
          if(a.mfg_plant_codes = '*',
            ifNull(rfl.factories, []),
            splitByChar(',', ifNull(a.mfg_plant_codes, ''))
          )
        )
      ) AS factory
    FROM assigned a
    LEFT JOIN region_factory_list rfl
      ON rfl.region = a.region
    WHERE
      a.rules_vteam IN ('V1','V2','V3')
      AND a.eligible = 1
  ),

  ConfigRows AS (
    SELECT
      'config' AS kind,
      emp_code AS subject_id,
      rules_vteam AS vteam,

      plant,
      nullIf(trim(factory), '') AS factory,
      region,
      line_name,

      emp_name,
      user_group_names,

      node_codes,
      mfg_plant_codes,
      candidate_vteam,
      eligible,

      CAST(NULL AS Nullable(UInt8)) AS covered,

      toDateTime('1970-01-01 00:00:00') AS start_time,
      toDateTime('2999-12-31 00:00:00') AS end_time_eff,

      0 AS start_unix,
      32503680000 AS end_unix
    FROM ConfigExpanded
  )

SELECT * FROM ActiveRows
UNION ALL
SELECT * FROM ConfigRows
  `,

  measures: {
    activeUserCount: {
      type: 'countDistinct',
      sql: `if(${CUBE}.kind = 'active', ${CUBE}.subject_id, NULL)`,
    },
    configUserCount: {
      type: 'countDistinct',
      sql: `if(${CUBE}.kind = 'config', ${CUBE}.subject_id, NULL)`,
    },
    activeConfigRatio: {
      type: 'number',
      sql: `${activeUserCount} / nullIf(${configUserCount}, 0)`,
    },
  },

  dimensions: {
    kind: { sql: `${CUBE}.kind`, type: 'string' },
    subjectId: { sql: `${CUBE}.subject_id`, type: 'string' },

    vteam: { sql: `${CUBE}.vteam`, type: 'string' },
    region: { sql: `${CUBE}.region`, type: 'string' },
    plant: { sql: `${CUBE}.plant`, type: 'string' },

    // ✅ 這個 factory：active = 流程變數 factory；config = 展開後的 mfg_plant_code
    factory: { sql: `${CUBE}.factory`, type: 'string' },

    lineName: { sql: `${CUBE}.line_name`, type: 'string' },

    empName: { sql: `${CUBE}.emp_name`, type: 'string' },
    userGroupNames: { sql: `${CUBE}.user_group_names`, type: 'string' },

    nodeCodes: { sql: `${CUBE}.node_codes`, type: 'string' },
    mfgPlantCodes: { sql: `${CUBE}.mfg_plant_codes`, type: 'string' },
    candidateVteam: { sql: `${CUBE}.candidate_vteam`, type: 'string' },
    eligible: { sql: `${CUBE}.eligible`, type: 'number' },
    
    // ✅ 改為專門的時間維度，支援 granularity
    taskStartTime: { 
      sql: `${CUBE}.start_time`, 
      type: 'time' 
    },
    taskEndTimeEffective: { 
      sql: `${CUBE}.end_time_eff`, 
      type: 'time' 
    },
    
    // Unix 時間戳（用於過濾）
    taskStartUnix: { sql: `${CUBE}.start_unix`, type: 'number' },
    taskEndUnix: { sql: `${CUBE}.end_unix`, type: 'number' },

    // ⚠️ 你環境用 beforeDate/afterDate 會出現 parseDateTimeBestEffort(?)，請改用 Unix 維度
    //taskStartTime: { sql: `${CUBE}.start_time`, type: 'time' },
    //taskEndTimeEffective: { sql: `${CUBE}.end_time_eff`, type: 'time' },

    // ✅ 用這兩個做時間區間過濾（lt/gt）
    //taskStartUnix: { sql: `${CUBE}.start_unix`, type: 'number' },
    //taskEndUnix: { sql: `${CUBE}.end_unix`, type: 'number' },
  },
});
