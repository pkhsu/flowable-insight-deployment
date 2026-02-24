cube(`act_hi_identitylink`, {
  sql_table: `flowable_analytics."ACT_HI_IDENTITYLINK"`,
  
  data_source: `default`,
  
  joins: {
    
  },
  
  dimensions: {
    id: {
      sql: `${CUBE}."ID_"`,
      type: `string`,
      title: `Id `,
      primary_key: true
    },
    
    group_id: {
      sql: `${CUBE}."GROUP_ID_"`,
      type: `string`,
      title: `Group Id `
    },
    
    proc_inst_id: {
      sql: `${CUBE}."PROC_INST_ID_"`,
      type: `string`,
      title: `Proc Inst Id `
    },
    
    scope_definition_id: {
      sql: `${CUBE}."SCOPE_DEFINITION_ID_"`,
      type: `string`,
      title: `Scope Definition Id `
    },
    
    scope_id: {
      sql: `${CUBE}."SCOPE_ID_"`,
      type: `string`,
      title: `Scope Id `
    },
    
    scope_type: {
      sql: `${CUBE}."SCOPE_TYPE_"`,
      type: `string`,
      title: `Scope Type `
    },
    
    sub_scope_id: {
      sql: `${CUBE}."SUB_SCOPE_ID_"`,
      type: `string`,
      title: `Sub Scope Id `
    },
    
    task_id: {
      sql: `${CUBE}."TASK_ID_"`,
      type: `string`,
      title: `Task Id `
    },
    
    type: {
      sql: `${CUBE}."TYPE_"`,
      type: `string`,
      title: `Type `
    },
    
    user_id: {
      sql: `${CUBE}."USER_ID_"`,
      type: `string`,
      title: `User Id `
    },
    
    create_time: {
      sql: `${CUBE}."CREATE_TIME_"`,
      type: `time`,
      title: `Create Time `
    }
  },
  
  measures: {
    count: {
      type: `count`
    }
  },
  
  pre_aggregations: {
    // Pre-aggregation definitions go here.
    // Learn more in the documentation: https://cube.dev/docs/caching/pre-aggregations/getting-started
  }
});
