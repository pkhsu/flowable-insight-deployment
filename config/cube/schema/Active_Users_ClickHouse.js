cube(`active_user_clickhouse`, {
  dataSource: `datasource2`,

  sql: `
WITH act_daily AS (
  SELECT DISTINCT
    trimBoth(vteam) AS vx,
    trimBoth(ifNull(region,  '')) AS region,
    trimBoth(ifNull(plant,   '')) AS plant,
    trimBoth(ifNull(factory, '')) AS factory,
    trimBoth(ifNull(lineName,'')) AS line,
    emp_code,
    toDateTime(x) AS report_dt
  FROM flowable_analytics.view_active_user_clickhouse
  ARRAY JOIN range(
    toUInt32(toStartOfDay(start_time)),
    toUInt32(toStartOfDay(ifNull(end_time, now()))) + 86400,
    86400
  ) AS x
  WHERE 1=1
    AND emp_code NOT LIKE 'DMPV%'
    AND ${FILTER_PARAMS.active_user_clickhouse.vx.filter('vx')}
    AND ${FILTER_PARAMS.active_user_clickhouse.region.filter('region')}
    AND ${FILTER_PARAMS.active_user_clickhouse.plant.filter('plant')}
    AND ${FILTER_PARAMS.active_user_clickhouse.factory.filter('factory')}
    AND ${FILTER_PARAMS.active_user_clickhouse.line.filter('line')}

    -- 限制展日範圍（避免爆量）
    AND ${FILTER_PARAMS.active_user_clickhouse.windowStart.filter('report_dt')}
    AND ${FILTER_PARAMS.active_user_clickhouse.windowEnd.filter('report_dt')}
)
SELECT * FROM act_daily
  `,

  measures: {
    // active 人數：在 time bucket 內 countDistinct(emp_code)
    count: {
      type: `countDistinct`,
      sql: `emp_code`
    }
  },

  dimensions: {
    reportDate: { type: `time`, sql: `report_dt` },

    vx:      { type: `string`, sql: `vx` },
    region:  { type: `string`, sql: `region` },
    plant:   { type: `string`, sql: `plant` },
    factory: { type: `string`, sql: `factory` },
    line:    { type: `string`, sql: `line` },

    // dummy dims to allow FILTER_PARAMS injection
    windowStart: { type: `time`, sql: `toDateTime('1970-01-01 00:00:00')` },
    windowEnd:   { type: `time`, sql: `toDateTime('9999-12-31 23:59:59')` }
  }
});