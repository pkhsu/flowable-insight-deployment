/**
 * TaskRolling7dAcc - Cube.js Schema for Rolling 7-Day Todo+Doing Accumulation
 * 
 * Purpose: Query pre-calculated rolling 7-day Todo+Doing(Acc) based on task state tracking
 * Source: gold_task_rolling_7d_acc_rmv (ClickHouse Materialized View)
 * 
 * Logic:
 * - For each snapshot_date, counts distinct tasks that are still TODO or DOING on that date
 * - Only includes tasks created within the rolling 7-day window
 */
cube(`TaskRolling7dAcc`, {
    sql: `SELECT * FROM gold_task_rolling_7d_acc_rmv`,

    preAggregations: {
        // Daily rollup for fast dashboard queries
        dailyRollup: {
            measures: [accTodoDoing],
            dimensions: [vx, plant, factory, line],
            timeDimension: snapshotDate,
            granularity: `day`,
            refreshKey: {
                every: `1 day`
            },
            indexes: {
                mainIndex: {
                    columns: [vx, plant, factory, line]
                }
            }
        }
    },

    measures: {
        accTodoDoing: {
            type: `sum`,
            sql: `rolling_7d_acc_todo_doing`,
            title: `Rolling 7-Day Todo+Doing (Acc)`
        },
        rolling7dTotal: {
            type: `sum`,
            sql: `rolling_7d_total`,
            title: `Rolling 7-Day Total Tasks`
        },
        rowCount: {
            type: `count`,
            title: `Row Count`
        }
    },

    dimensions: {
        snapshotDate: {
            sql: `snapshot_date`,
            type: `time`,
            title: `Snapshot Date`
        },
        vx: {
            sql: `vx`,
            type: `string`,
            title: `Vx`
        },
        region: {
            sql: `region`,
            type: `string`,
            title: `Region`
        },
        plant: {
            sql: `plant`,
            type: `string`,
            title: `Plant`
        },
        factory: {
            sql: `factory`,
            type: `string`,
            title: `Factory`
        },
        line: {
            sql: `line`,
            type: `string`,
            title: `Line`
        }
    }
});
