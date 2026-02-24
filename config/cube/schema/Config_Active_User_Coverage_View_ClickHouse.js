cube(`active_config_ratio_by_slice_clickhouse`, {
  dataSource: `datasource2`,

  sql: `
WITH
  -- CFG：每個 slice 的配置人數（不帶時間）
  cfg AS (
    SELECT
      trimBoth(vteam) AS vteam,
      trimBoth(ifNull(region,  '')) AS region,
      trimBoth(ifNull(plant,   '')) AS plant,
      trimBoth(ifNull(factory, '')) AS factory,
      trimBoth(ifNull(lineName,'')) AS lineName,
      countDistinct(empCode) AS cfg_cnt
    FROM flowable_analytics.view_config_user_clickhouse
    WHERE 1=1
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.vteam.filter('vteam')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.region.filter('region')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.plant.filter('plant')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.factory.filter('factory')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.lineName.filter('lineName')}
    GROUP BY vteam, region, plant, factory, lineName
  ),

  -- ACT：把 start~end 展成每天一筆（保留 emp_code + snapshot_dt）
  act_daily_rows AS (
    SELECT
      trimBoth(vteam) AS vteam,
      trimBoth(ifNull(region,  '')) AS region,
      trimBoth(ifNull(plant,   '')) AS plant,
      trimBoth(ifNull(factory, '')) AS factory,
      trimBoth(ifNull(lineName,'')) AS lineName,
      emp_code,
      toDateTime(x) AS snapshot_dt
    FROM flowable_analytics.view_active_user_clickhouse
    ARRAY JOIN range(
      toUInt32(toStartOfDay(start_time)),
      toUInt32(toStartOfDay(ifNull(end_time, now()))) + 86400,
      86400
    ) AS x
    WHERE 1=1
      AND emp_code NOT LIKE 'DMPV%'
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.vteam.filter('vteam')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.region.filter('region')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.plant.filter('plant')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.factory.filter('factory')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.lineName.filter('lineName')}

      -- 時間窗套用在 snapshot_dt（可用來限制查詢範圍避免爆量）
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.windowEnd.filter('snapshot_dt')}
      AND ${FILTER_PARAMS.active_config_ratio_by_slice_clickhouse.windowStart.filter('snapshot_dt')}
  )

SELECT
  a.snapshot_dt,
  a.vteam, a.region, a.plant, a.factory, a.lineName,
  a.emp_code,
  ifNull(c.cfg_cnt, 0) AS cfg_cnt
FROM act_daily_rows a
LEFT JOIN cfg c
  USING (vteam, region, plant, factory, lineName)
  `,

  measures: {
    // 週/月/日 union distinct：直接對 emp_code countDistinct
    activeUserCount: {
      type: `countDistinct`,
      sql: `emp_code`
    },

    // cfg_cnt 對同一個 slice 是常數：用 max/any 拿回來即可
    configUserCount: {
      type: `max`,
      sql: `cfg_cnt`
    },

    // ratio + 規則：config < active => 0
    activeConfigRatio: {
      type: `number`,
      sql: `
        if(
          ${configUserCount} = 0 OR ${configUserCount} < ${activeUserCount},
          0,
          ${activeUserCount} / ${configUserCount}
        )
      `,
      format: `percent`
    }
  },

  dimensions: {
    // 用它做 granularity：day/week/month
    snapshotTime: { type: `time`, sql: `snapshot_dt` },

    vteam: { type: `string`, sql: `vteam` },
    region: { type: `string`, sql: `region` },
    plant: { type: `string`, sql: `plant` },
    factory: { type: `string`, sql: `factory` },
    lineName: { type: `string`, sql: `lineName` },

    // 保留你的 windowStart/windowEnd 注入點（讓 FILTER_PARAMS 生效）
    windowEnd: { type: `time`, sql: `toDateTime('9999-12-31 23:59:59')` },
    windowStart: { type: `time`, sql: `toDateTime('1970-01-01 00:00:00')` }
  }
});
