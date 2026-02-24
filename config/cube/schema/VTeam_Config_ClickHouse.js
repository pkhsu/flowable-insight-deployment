cube(`vteam_config_clickhouse`, {
  sql: `
    SELECT
      arrayJoin(['V1','V2','V3']) AS vteam,
      indexOf(['V1','V2','V3'], vteam) AS sort_order
  `,

  dimensions: {
    vteam: { sql: `vteam`, type: `string`, primaryKey: true },
    sortOrder: { sql: `sort_order`, type: `number` },
  },

  measures: {
    rowCount: { type: `count` },
  },
});
