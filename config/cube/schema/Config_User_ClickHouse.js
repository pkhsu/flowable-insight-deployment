cube(`config_user_clickhouse`, {

  sql: `
WITH base AS (
  SELECT
    trimBoth(vteam) AS vx,
    trimBoth(ifNull(region,  '')) AS region,
    trimBoth(ifNull(plant,   '')) AS plant,
    trimBoth(ifNull(factory, '')) AS factory,
    trimBoth(ifNull(lineName,'')) AS line,
    empCode
  FROM flowable_analytics.view_config_user_clickhouse
  WHERE 1=1
    AND ${FILTER_PARAMS.config_user_clickhouse.vx.filter('vx')}
    AND ${FILTER_PARAMS.config_user_clickhouse.region.filter('region')}
    AND ${FILTER_PARAMS.config_user_clickhouse.plant.filter('plant')}
    AND ${FILTER_PARAMS.config_user_clickhouse.factory.filter('factory')}
    AND ${FILTER_PARAMS.config_user_clickhouse.line.filter('line')}
),

cfg_line AS (
  SELECT
    'line' AS level, vx, region, plant, factory, line,
    countDistinct(empCode) AS cfg_cnt_distinct,
    count(empCode) AS cfg_cnt_all
  FROM base
  GROUP BY level, vx, region, plant, factory, line
),

cfg_factory AS (
  SELECT
    'factory' AS level, vx, region, plant, factory, '' AS line,
    countDistinct(empCode) AS cfg_cnt_distinct,
    count(empCode) AS cfg_cnt_all  -- 不去重（factory level 需求）
  FROM base
  GROUP BY level, vx, region, plant, factory
),

cfg_plant AS (
  SELECT
    'plant' AS level, vx, region, plant, '' AS factory, '' AS line,
    countDistinct(empCode) AS cfg_cnt_distinct,
    count(empCode) AS cfg_cnt_all
  FROM base
  GROUP BY level, vx, region, plant
),

cfg_region AS (
  SELECT
    'region' AS level, vx, region, '' AS plant, '' AS factory, '' AS line,
    countDistinct(empCode) AS cfg_cnt_distinct,
    count(empCode) AS cfg_cnt_all
  FROM base
  GROUP BY level, vx, region
),

cfg_vteam AS (
  SELECT
    'vteam' AS level, vx, '' AS region, '' AS plant, '' AS factory, '' AS line,
    countDistinct(empCode) AS cfg_cnt_distinct,
    count(empCode) AS cfg_cnt_all
  FROM base
  GROUP BY level, vx
)

SELECT * FROM cfg_line
UNION ALL SELECT * FROM cfg_factory
UNION ALL SELECT * FROM cfg_plant
UNION ALL SELECT * FROM cfg_region
UNION ALL SELECT * FROM cfg_vteam
  `,

  measures: {
    // 去重計數（用於 vteam/region/plant/line level）
    countDistinct: {
      type: `max`,
      sql: `cfg_cnt_distinct`
    },

    // 不去重計數（僅用於 factory level）
    // Config 需求：同一人配置在多個 factory 要算多次
    countAll: {
      type: `max`,
      sql: `cfg_cnt_all`
    }
  },

  dimensions: {
    level:   { type: `string`, sql: `level` },
    vx:      { type: `string`, sql: `vx` },
    region:  { type: `string`, sql: `region` },
    plant:   { type: `string`, sql: `plant` },
    factory: { type: `string`, sql: `factory` },
    line:    { type: `string`, sql: `line` }
  }
});