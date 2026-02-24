cube(`ActiveUsersDaily`, {
    sql: `SELECT * FROM flowable_analytics.gold_active_users_daily_rmv`,

    measures: {
        count: {
            sql: `assignee`,
            type: `countDistinct`
        }
    },

    preAggregations: {
        dailyRollup: {
            measures: [count],
            dimensions: [vx, plant, factory],
            timeDimension: reportDate,
            granularity: `day`,
            refreshKey: {
                every: `1 day`
            },
            indexes: {
                mainIndex: {
                    columns: [vx, plant, factory]
                }
            }
        }
    },

    dimensions: {
        reportDate: {
            sql: `snapshot_date`,
            type: `time`
        },

        region: {
            sql: `proc_region`,
            type: `string`
        },

        plant: {
            sql: `proc_plant`,
            type: `string`
        },

        factory: {
            sql: `proc_factory`,
            type: `string`
        },

        line: {
            sql: `proc_line_name`,
            type: `string`
        },

        vx: {
            sql: `proc_vx`,
            type: `string`
        }
    },

    dataSource: `default`
});
