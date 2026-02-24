cube(`TaskActivity`, {
    sql: `SELECT * FROM flowable_analytics.silver_task_activities`,

    refreshKey: {
        every: `5 minute`,
        sql: `SELECT count() FROM flowable_analytics.silver_task_activities`
    },

    measures: {
        // --- Daily Granularity Measures (use include_daily filter) ---
        todoCountDaily: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'TODO'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        doingCountDaily: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DOING'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        doneCountDaily: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DONE'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        totalActivityDaily: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        // --- Weekly Granularity Measures (use include_weekly filter) ---
        todoCountWeekly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'TODO'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_weekly = 1` }
            ]
        },

        doingCountWeekly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DOING'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_weekly = 1` }
            ]
        },

        doneCountWeekly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DONE'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_weekly = 1` }
            ]
        },

        totalActivityWeekly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `task_bypass = 'N'` },
                { sql: `include_weekly = 1` }
            ]
        },

        // --- Monthly Granularity Measures (use include_monthly filter) ---
        todoCountMonthly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'TODO'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_monthly = 1` }
            ]
        },

        doingCountMonthly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DOING'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_monthly = 1` }
            ]
        },

        doneCountMonthly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DONE'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_monthly = 1` }
            ]
        },

        totalActivityMonthly: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `task_bypass = 'N'` },
                { sql: `include_monthly = 1` }
            ]
        },

        // Legacy measures (for backwards compatibility) - uses Daily
        todoCount: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'TODO'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        doingCount: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DOING'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        doneCount: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `event_type = 'DONE'` },
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        totalActivity: {
            type: `count`,
            sql: `task_id`,
            filters: [
                { sql: `task_bypass = 'N'` },
                { sql: `include_daily = 1` }
            ]
        },

        lastUpdated: {
            sql: `now()`,
            type: `max`
        }
    },

    dimensions: {
        taskId: {
            sql: `task_id`,
            type: `string`,
            primaryKey: true
        },

        eventTime: {
            sql: `event_time`,
            type: `time`
        },

        eventType: {
            sql: `coalesce(event_type, 'Unknown')`, // 'TODO', 'DOING', 'DONE'
            type: `string`
        },

        plant: {
            sql: `coalesce(plant, 'Unknown')`,
            type: `string`
        },

        factory: {
            sql: `coalesce(factory, 'Unknown')`,
            type: `string`
        },

        line: {
            sql: `coalesce(line, 'Unknown')`,
            type: `string`
        },

        vx: {
            sql: `coalesce(vx, 'Unknown')`,
            type: `string`
        },

        region: {
            sql: `coalesce(region, 'Unknown')`,
            type: `string`
        },

        model: {
            sql: `coalesce(model, 'Unknown')`,
            type: `string`
        }
    },

    preAggregations: {
        // Daily rollup with proper deduplication
        dailyRollup: {
            measures: [todoCountDaily, doingCountDaily, doneCountDaily, totalActivityDaily],
            dimensions: [plant, factory, region, vx],
            timeDimension: eventTime,
            granularity: `day`,
            indexes: {
                mainIndex: {
                    columns: [plant, factory, region, vx]
                }
            }
        },
        // Weekly rollup with proper deduplication
        weeklyRollup: {
            measures: [todoCountWeekly, doingCountWeekly, doneCountWeekly, totalActivityWeekly],
            dimensions: [plant, factory, region, vx],
            timeDimension: eventTime,
            granularity: `week`,
            indexes: {
                mainIndex: {
                    columns: [plant, factory, region, vx]
                }
            }
        },
        // Monthly rollup with proper deduplication
        monthlyRollup: {
            measures: [todoCountMonthly, doingCountMonthly, doneCountMonthly, totalActivityMonthly],
            dimensions: [plant, factory, region, vx],
            timeDimension: eventTime,
            granularity: `month`,
            indexes: {
                mainIndex: {
                    columns: [plant, factory, region, vx]
                }
            }
        }
    },

    dataSource: `default`
});
