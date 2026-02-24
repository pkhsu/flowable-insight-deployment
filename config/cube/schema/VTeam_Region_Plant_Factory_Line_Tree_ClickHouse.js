cube(`vteam_region_plant_factory_line_tree_clickHouse`, {
  sql: `
    SELECT DISTINCT
    AHT.TASK_DEF_KEY_                           AS task_def_key,
    plantVar.TEXT_                              AS plant,
    substring(AHT.TASK_DEF_KEY_, 1, 2)           AS vteam,
    c.MFG_SITE                                  AS region,
    a.Factory                                   AS factory,
    a.ProductionArea                            AS production_area,
    a.LineName                                  AS line_name,
    a.AssignLineFlag                            AS assign_line_flag
  FROM flowable_analytics.ACT_HI_TASKINST AS AHT
  INNER JOIN flowable_analytics.ACT_HI_VARINST AS plantVar
    ON AHT.PROC_INST_ID_ = plantVar.PROC_INST_ID_
   AND plantVar.NAME_ = 'plant'
  INNER JOIN flowable_analytics.DMPFunctionConfig AS a
    ON plantVar.TEXT_ = a.Plant
  LEFT JOIN flowable_analytics.DMPFunctionClientMapping AS b
    ON a.Plant = b.Plant
  LEFT JOIN flowable_analytics.MDM_FACTORY_AREA_MASTER AS c
    ON a.Plant = c.FACTORY
   AND c.MFG_SITE IS NOT NULL
  WHERE upper(AHT.TASK_DEF_KEY_) LIKE 'V%'
  `,

  measures: {
    count: {
      type: `count`,
      drillMembers: [
        `taskDefKey`,
        `vteam`,
        `region`,
        `plant`,
        `factory`,
        `lineName`,
      ],
    },
  },

  dimensions: {
    taskDefKey: { sql: `task_def_key`, type: `string` },
    vteam: { sql: `vteam`, type: `string` },
    region: { sql: `region`, type: `string` },
    plant: { sql: `plant`, type: `string` },
    factory: { sql: `factory`, type: `string` },
    productionArea: { sql: `production_area`, type: `string` },
    lineName: { sql: `line_name`, type: `string` },
    assignLineFlag: { sql: `assign_line_flag`, type: `string` },
  },
});
