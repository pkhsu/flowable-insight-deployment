cube('l5_process_completion_rate_clickhouse', {


  sql: `
    SELECT *
    FROM flowable_analytics.FlowableTaskStats
  `,

  // =====================
  // Measures
  // =====================
  measures: {
    // 1) 符合條件的 Task 總數量
    totalTasks: {
      type: 'count',
      drillMembers: [
        'id',
        'processInstanceId',
        'taskId',
        'taskName',
        'taskAssigneeAccount',
        'taskAssigneeName'
      ]
    },

    // 各 TaskStatus 計數：TODO / DOING / DONE
    todoCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.TaskStatus = 'TODO'` }]
    },

    doingCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.TaskStatus = 'DOING'` }]
    },

    doneCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.TaskStatus = 'DONE'` }]
    },

    // DOING + DONE 的數量
    doingDoneCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.TaskStatus IN ('DOING', 'DONE')` }]
    },

    // TODO + DOING 的數量
    todoDoingCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.TaskStatus IN ('TODO', 'DOING')` }]
    },

    // ===== 比例類 =====
    // ClickHouse 風格：if(cond, 1.0, 0.0)
    doneRate: {
      type: 'avg',
      sql: `if(${CUBE}.TaskStatus = 'DONE', 1.0, 0.0)`
    },

    todoRate: {
      type: 'avg',
      sql: `if(${CUBE}.TaskStatus = 'TODO', 1.0, 0.0)`
    },

    doingRate: {
      type: 'avg',
      sql: `if(${CUBE}.TaskStatus = 'DOING', 1.0, 0.0)`
    },

    doingDoneRate: {
      type: 'avg',
      sql: `if(${CUBE}.TaskStatus IN ('DOING', 'DONE'), 1.0, 0.0)`
    },

    todoDoingRate: {
      type: 'avg',
      sql: `if(${CUBE}.TaskStatus IN ('TODO', 'DOING'), 1.0, 0.0)`
    },

    // 平均處理時間（選用）
    avgTaskDurationMinutes: {
      sql: `${CUBE}.TaskDurationMinutes`,
      type: 'avg'
    },

    avgTaskWorkMinutes: {
      sql: `${CUBE}.TaskWorkMinutes`,
      type: 'avg'
    }
  },

  // =====================
  // Dimensions
  // =====================
  dimensions: {
    id: {
      sql: `${CUBE}.Id`,
      type: 'number',
      primaryKey: true
    },

    processInstanceId: {
      sql: `${CUBE}.ProcessInstanceId`,
      type: 'string'
    },

    processDefinitionKey: {
      sql: `${CUBE}.ProcessDefinitionKey`,
      type: 'string'
    },

    processDefinitionName: {
      sql: `${CUBE}.ProcessDefinitionName`,
      type: 'string'
    },

    // vteamCode (假設=ProcessTeam)
    vteamCode: {
      sql: `${CUBE}.ProcessTeam`,
      type: 'string'
    },

    // regionCode（暫時用 DeliveryArea）
    regionCode: {
      sql: `${CUBE}.DeliveryArea`,
      type: 'string'
    },

    plantCode: {
      sql: `${CUBE}.Plant`,
      type: 'string'
    },

    factoryCode: {
      sql: `${CUBE}.Factory`,
      type: 'string'
    },

    productionArea: {
      sql: `${CUBE}.ProductionArea`,
      type: 'string'
    },

    lineCode: {
      sql: `${CUBE}.Line`,
      type: 'string'
    },

    modelName: {
      sql: `${CUBE}.ModelName`,
      type: 'string'
    },

    deliveryArea: {
      sql: `${CUBE}.DeliveryArea`,
      type: 'string'
    },

    scheduleNumber: {
      sql: `${CUBE}.ScheduleNumber`,
      type: 'string'
    },

    moNumber: {
      sql: `${CUBE}.MoNumber`,
      type: 'string'
    },

    sapPlant: {
      sql: `${CUBE}.SapPlant`,
      type: 'string'
    },

    sapProductGroup: {
      sql: `${CUBE}.SapProductGroup`,
      type: 'string'
    },

    pallet: {
      sql: `${CUBE}.Pallet`,
      type: 'string'
    },

    transferNo: {
      sql: `${CUBE}.TransferNo`,
      type: 'string'
    },

    qBlockEventId: {
      sql: `${CUBE}.QBlockEventId`,
      type: 'string'
    },

    defectSn: {
      sql: `${CUBE}.DefectSn`,
      type: 'string'
    },

    taskId: {
      sql: `${CUBE}.TaskId`,
      type: 'string'
    },

    taskDefinitionKey: {
      sql: `${CUBE}.TaskDefinitionKey`,
      type: 'string'
    },

    taskName: {
      sql: `${CUBE}.TaskName`,
      type: 'string'
    },

    taskStatus: {
      sql: `${CUBE}.TaskStatus`,
      type: 'string'
    },

    taskBypass: {
      sql: `${CUBE}.TaskBypass`,
      type: 'string'
    },

    taskAssignee: {
      sql: `${CUBE}.TaskAssignee`,
      type: 'string'
    },

    taskAssigneeAccount: {
      sql: `${CUBE}.TaskAssigneeAccount`,
      type: 'string'
    },

    taskAssigneeName: {
      sql: `${CUBE}.TaskAssigneeName`,
      type: 'string'
    },

    deleteReason: {
      sql: `${CUBE}.DeleteReason`,
      type: 'string'
    },

    // =====================
    // Time dimensions
    // =====================
    time: {
      sql: `${CUBE}.Time_`,
      type: 'time'
    },

    taskCreateTime: {
      sql: `${CUBE}.TaskCreateTime`,
      type: 'time'
    },

    taskClaimTime: {
      sql: `${CUBE}.TaskClaimTime`,
      type: 'time'
    },

    taskEndTime: {
      sql: `${CUBE}.TaskEndTime`,
      type: 'time'
    },

    syncTime: {
      sql: `${CUBE}.SyncTime`,
      type: 'time'
    },

    lastUpdatedTime: {
      sql: `${CUBE}.LastUpdatedTime`,
      type: 'time'
    }
  },

  // =====================
  // Segments
  // =====================
  segments: {
    statusTodo: {
      sql: `${CUBE}.TaskStatus = 'TODO'`
    },
    statusDoing: {
      sql: `${CUBE}.TaskStatus = 'DOING'`
    },
    statusDone: {
      sql: `${CUBE}.TaskStatus = 'DONE'`
    }
  }
});
