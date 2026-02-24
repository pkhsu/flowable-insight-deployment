cube(`ConfigUsersUnion`, {
    sql: `SELECT * FROM flowable_analytics.silver_config_users`,

    measures: {
        count: {
            sql: `EmpCode`,
            type: `countDistinct`
        }
    },

    dimensions: {
        plant: {
            sql: `proc_plant`,
            type: `string`
        },

        region: {
            sql: `proc_region`,
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
            sql: `Vx`,
            type: `string`
        }
    },

    dataSource: `default`
});
