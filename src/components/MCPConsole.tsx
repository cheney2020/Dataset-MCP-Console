import React, { useState } from 'react';
import { TerminalSquare, Play, Database, Server } from 'lucide-react';
import { initialDatasets } from '../data';
import { useAppContext } from '../AppContext';

const TOOLS = [
  { id: 'list-topics', name: 'list-topics', desc: '查询有哪些业务主题' },
  { id: 'list-datasets', name: 'list-datasets', desc: '查询某个主题下有哪些数据集' },
  { id: 'describe-dataset', name: 'describe-dataset', desc: '查询数据集字段和使用说明' },
  { id: 'query-dataset', name: 'query-dataset', desc: '查询单表明细' },
  { id: 'aggregate-dataset', name: 'aggregate-dataset', desc: '单表轻量聚合' }
];

const mockRequests: Record<string, string> = {
  'list-topics': '{}',
  'list-datasets': '{\n  "topicId": "门店经营"\n}',
  'describe-dataset': '{\n  "datasetName": "门店日销售数据集"\n}',
  'query-dataset': '{\n  "datasetName": "门店日销售数据集",\n  "fields": ["store_id", "store_name", "biz_date", "region_name", "sales_amt"],\n  "filters": [\n    {\n      "field": "biz_date",\n      "op": "between",\n      "value": ["2026-06-01", "2026-06-21"]\n    },\n    {\n      "field": "region_name",\n      "op": "eq",\n      "value": "华东"\n    }\n  ],\n  "limit": 100\n}',
  'aggregate-dataset': '{\n  "datasetName": "门店日销售数据集",\n  "dimensions": ["region_name"],\n  "measures": [\n    {\n      "field": "sales_amt",\n      "aggregation": "sum",\n      "alias": "total_sales"\n    },\n    {\n      "field": "order_cnt",\n      "aggregation": "sum",\n      "alias": "total_orders"\n    }\n  ],\n  "filters": [\n    {\n      "field": "biz_date",\n      "op": "between",\n      "value": ["2026-06-01", "2026-06-21"]\n    }\n  ],\n  "limit": 100\n}'
};

const baseResponses: Record<string, any> = {
  'list-topics': {
    "topics": [
      {
        "topicId": "store_operation",
        "displayName": "门店经营",
        "description": "用于分析门店销售、订单、顾客和区域经营情况"
      },
      {
        "topicId": "member_analysis",
        "displayName": "会员分析",
        "description": "用于分析会员画像、活跃度和消费行为"
      },
      {
        "topicId": "campaign_analysis",
        "displayName": "营销活动",
        "description": "用于分析活动期间门店、商品和会员转化表现"
      }
    ]
  },
  'describe-dataset': {
    "datasetName": "门店日销售数据集",
    "description": "按门店和营业日期汇总的销售经营数据",
    "source": {
      "sourceType": "Doris",
      "sourceName": "Doris 生产集群",
      "databaseName": "ads_retail",
      "tableName": "store_sales_daily"
    },
    "timeField": "biz_date",
    "queryPolicy": {
      "defaultLimit": 100,
      "maxLimit": 1000,
      "allowUnlimitedReturn": false,
      "requireTimeFilter": true
    },
    "fields": [
      {
        "name": "store_id",
        "displayName": "门店 ID",
        "type": "string",
        "role": "id",
        "filterable": true,
        "groupable": true,
        "selectable": true,
        "sensitive": false
      },
      {
        "name": "region_name",
        "displayName": "区域名称",
        "type": "string",
        "role": "dimension",
        "filterable": true,
        "groupable": true,
        "selectable": true,
        "sensitive": false
      },
      {
        "name": "sales_amt",
        "displayName": "销售额",
        "type": "decimal",
        "role": "measure",
        "filterable": false,
        "groupable": false,
        "selectable": true,
        "aggregationsSupported": ["sum", "avg", "max", "min"],
        "sensitive": false
      },
      {
        "name": "phone_no",
        "displayName": "联系电话",
        "type": "string",
        "role": "attribute",
        "filterable": false,
        "groupable": false,
        "selectable": true,
        "sensitive": true,
        "masking": "phone_mask"
      }
    ]
  },
  'query-dataset': {
    "status": "success",
    "data": [
      {
        "store_id": "S001",
        "store_name": "上海南京东路店",
        "biz_date": "2026-06-21",
        "region_name": "华东",
        "sales_amt": 128900
      },
      {
        "store_id": "S002",
        "store_name": "杭州西湖店",
        "biz_date": "2026-06-21",
        "region_name": "华东",
        "sales_amt": 98600
      }
    ],
    "metadata": {
      "rowCount": 2,
      "dataFreshness": "2026-06-22 06:00:00",
      "warnings": []
    }
  },
  'aggregate-dataset': {
    "status": "success",
    "data": [
      {
        "region_name": "华东",
        "total_sales": 1289000,
        "total_orders": 8342
      },
      {
        "region_name": "华南",
        "total_sales": 986000,
        "total_orders": 6210
      },
      {
        "region_name": "华北",
        "total_sales": 765000,
        "total_orders": 4891
      }
    ],
    "metadata": {
      "rowCount": 3,
      "dataFreshness": "2026-06-22 06:00:00",
      "warnings": []
    }
  }
};

export default function MCPConsole() {
  const { datasets, topics, fields } = useAppContext();
  const [activeTool, setActiveTool] = useState(TOOLS[0].id);
  const [reqBody, setReqBody] = useState(mockRequests[activeTool]);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<'auditor' | 'manager' | 'store_manager'>('manager');
  const [simulatedRegion, setSimulatedRegion] = useState<'all' | 'huadong' | 'huanan'>('huadong');

  // Dynamically constructed based on active configuration
  const parsedReq = (() => {
    try {
      return JSON.parse(reqBody);
    } catch {
      return {};
    }
  })();

  const selectedDsName = parsedReq.datasetName || "门店日销售数据集";
  const mappedDs = datasets.find(d => d.datasetName === selectedDsName) || datasets.find(d => d.mcpEnabled && d.status === '已发布') || datasets[0];

  const mockResponses = {
    ...baseResponses,
    'list-topics': {
      "topics": topics.map(t => ({
        "topicId": t.id,
        "name": t.name,
        "description": t.description
      }))
    },
    'list-datasets': {
      "datasets": datasets.filter(d => d.status === '已发布' && d.mcpEnabled).map(d => ({
        "datasetName": d.datasetName,
        "description": d.description,
        "topic": d.topic,
        "status": "published",
        "source": {
          "sourceType": d.sourceType,
          "sourceName": d.sourceName,
          "databaseName": d.databaseName,
          "tableName": d.tableName
        },
        "queryCapabilities": {
          "detailQuery": d.allowDetailQuery ?? true,
          "aggregateQuery": d.allowAggregateQuery ?? true
        }
      }))
    },
    'describe-dataset': (() => {
      const datasetFields = mappedDs?.fields || fields;
      const activeFields = (datasetFields.length > 0 ? datasetFields : fields).map(f => {
        const fp = mappedDs?.permissionPolicy?.fieldAccess?.find(x => x.fieldName === f.name);
        const maps = f.enumMappings || [];
        const finalMaskingRule = f.maskingRule || fp?.maskingRule || 'none';
        return {
          name: f.name,
          displayName: f.displayName,
          type: f.type,
          role: f.role,
          filterable: f.filterable !== false,
          groupable: f.groupable !== false,
          selectable: fp ? fp.defaultVisible : true,
          sensitive: f.sensitive || false,
          ...(finalMaskingRule !== 'none' ? { maskingRuleApplied: finalMaskingRule } : {}),
          ...(maps.length > 0 ? { 
            enumMappings: maps.filter(m => m.enabled).map(m => ({ 
              rawValue: m.rawValue, 
              displayValue: m.displayValue, 
              synonyms: m.synonyms 
            })) 
          } : {})
        };
      });

      return {
        datasetId: mappedDs?.id || "store_sales_daily",
        datasetName: mappedDs?.datasetName || "门店日销售数据集",
        description: mappedDs?.description || "按门店和营业日期汇总的销售经营数据",
        source: {
          sourceType: mappedDs?.sourceType || "Doris",
          sourceName: mappedDs?.sourceName || "Doris 生产集群",
          databaseName: mappedDs?.databaseName || "ads_retail",
          tableName: mappedDs?.tableName || "store_sales_daily"
        },
        timeField: mappedDs?.timeField || "biz_date",
        queryPolicy: {
          defaultLimit: mappedDs?.defaultLimit || 100,
          maxLimit: mappedDs?.maxLimit || 1000,
          allowUnlimitedReturn: mappedDs?.allowUnlimitedReturn || false,
          requireTimeFilter: mappedDs?.requireTimeFilter || false
        },
        fields: activeFields,
        securityGovernance: {
          policyEnabled: !!mappedDs?.permissionPolicy?.enabled,
          tableAccessMode: mappedDs?.permissionPolicy?.tableAccess?.mode || "public",
          hasActiveRowPolicies: (mappedDs?.permissionPolicy?.rowAccess || []).some(r => r.enabled),
          hasActiveFieldRules: (mappedDs?.permissionPolicy?.fieldAccess || []).some(f => f.maskingRule !== 'none')
        }
      };
    })(),
    'query-dataset': (() => {
      const isPolicyEnabled = !!mappedDs?.permissionPolicy?.enabled || true; // simulate active for simulation panel
      const appliedRowFiltersList: string[] = [];
      const fieldMaskingApplied: string[] = [];
      
      const datasetFields = mappedDs?.fields || fields;
      const regionNameCh = simulatedRegion === 'huadong' ? '华东' : '华南';
      const storeIdTarget = simulatedRegion === 'huadong' ? 'S001' : 'S003';
      const storeNameTarget = simulatedRegion === 'huadong' ? '上海南京东路店' : '广州天河店';

      // 1. Inject simulated row authorization metadata based on identity simulator selection
      if (simulatedRole === 'manager') {
        appliedRowFiltersList.push(`[Identity Simulator RLS Rule] region_name eq "${regionNameCh}" (大区级范围隔离)`);
      } else if (simulatedRole === 'store_manager') {
        appliedRowFiltersList.push(`[Identity Simulator RLS Rule] store_id eq "${storeIdTarget}" (${storeNameTarget} 店长级极窄授权)`);
      } else {
        appliedRowFiltersList.push(`[Identity Simulator RLS Rule] Bypass RLS (总部审计级 - 支持跨辖区全量国级穿透)`);
      }

      // 2. Select appropriate mock raw array depending on database table
      const isMemberProfile = mappedDs?.id === 'member_profile_summary' || selectedDsName.includes('会员') || parsedReq.datasetName?.includes('会员');
      const isCampaign = mappedDs?.id === 'campaign_store_performance' || selectedDsName.includes('活动') || parsedReq.datasetName?.includes('活动');
      
      let rawSourceData: any[] = [];
      if (isMemberProfile) {
        rawSourceData = [
          { member_id: "M1001", member_name: "战小明", register_date: "2025-01-15", member_level: "金卡", gender: "男", age: 29, active_status: "活跃", total_spend: 15400, order_count: 48, last_visit_date: "2026-06-21", region_name: "华东", store_id: "S001" },
          { member_id: "M1002", member_name: "李美美", register_date: "2025-03-22", member_level: "银卡", gender: "女", age: 24, active_status: "活跃", total_spend: 8900, order_count: 22, last_visit_date: "2026-06-20", region_name: "华东", store_id: "S001" },
          { member_id: "M1003", member_name: "张大雷", register_date: "2025-06-05", member_level: "普卡", gender: "男", age: 35, active_status: "沉默", total_spend: 1200, order_count: 4, last_visit_date: "2026-05-18", region_name: "华南", store_id: "S003" },
          { member_id: "M1004", member_name: "王芳芳", register_date: "2024-11-10", member_level: "金卡", gender: "女", age: 42, active_status: "流失", total_spend: 23100, order_count: 67, last_visit_date: "2026-04-12", region_name: "华南", store_id: "S003" },
        ];
      } else if (isCampaign) {
        rawSourceData = [
          { campaign_id: "CAMP2601", campaign_name: "年中大促狂欢节", store_id: "S001", store_name: "上海南京东路店", biz_date: "2026-06-21", region_name: "华东", target_amt: 150000, actual_amt: 165000, achievement_rate: 1.10, visitor_count: 5200, conversion_rate: 0.12, campaign_cost: 25000 },
          { campaign_id: "CAMP2601", campaign_name: "年中大促狂欢节", store_id: "S002", store_name: "杭州西湖店", biz_date: "2026-06-21", region_name: "华东", target_amt: 95000, actual_amt: 98000, achievement_rate: 1.03, visitor_count: 3100, conversion_rate: 0.13, campaign_cost: 12000 },
          { campaign_id: "CAMP2601", campaign_name: "年中大促狂欢节", store_id: "S003", store_name: "广州天河店", biz_date: "2026-06-21", region_name: "华南", target_amt: 160000, actual_amt: 148000, achievement_rate: 0.92, visitor_count: 4800, conversion_rate: 0.11, campaign_cost: 24000 },
          { campaign_id: "CAMP2601", campaign_name: "年中大促狂欢节", store_id: "S004", store_name: "深圳万象城店", biz_date: "2026-06-21", region_name: "华南", target_amt: 110000, actual_amt: 115000, achievement_rate: 1.04, visitor_count: 3600, conversion_rate: 0.115, campaign_cost: 15000 },
        ];
      } else {
        // default to sales
        rawSourceData = [
          { store_id: "S001", store_name: "上海南京东路店", biz_date: "2026-06-21", region_name: "华东", sales_amt: 128900, order_cnt: 642, phone_no: "13801234567" },
          { store_id: "S002", store_name: "杭州西湖店", biz_date: "2026-06-21", region_name: "华东", sales_amt: 98600, order_cnt: 412, phone_no: "13912345678" },
          { store_id: "S003", store_name: "广州天河店", biz_date: "2026-06-21", region_name: "华南", sales_amt: 145000, order_cnt: 785, phone_no: "13588889999" },
          { store_id: "S004", store_name: "深圳万象城店", biz_date: "2026-06-21", region_name: "华南", sales_amt: 112000, order_cnt: 550, phone_no: "13766667777" },
        ];
      }

      // 3. Filter rows based on simulated RLS security scope
      const approvedRows = rawSourceData.filter((row: any) => {
        if (simulatedRole === 'manager') {
          // must match region
          return row.region_name === regionNameCh;
        } else if (simulatedRole === 'store_manager') {
          // must match store
          return row.store_id === storeIdTarget;
        }
        return true; // auditor gets all
      });

      // 4. Map fields and apply inline secure column masking rules
      const requestedFields = parsedReq.fields || datasetFields.map(f => f.name) || ["store_id", "store_name", "biz_date", "region_name", "sales_amt", "phone_no"];
      
      const mockedOutputData = approvedRows.map((row: any) => {
        const newRow: any = {};
        requestedFields.forEach((field: string) => {
          let baseValue = row[field];
          if (baseValue === undefined) {
            // handle fallbacks safely
            if (field === 'phone_no') baseValue = '13812345678';
            else if (field === 'email') baseValue = 'user_' + (row.member_id || 'test') + '@corp.com';
            else if (field === 'store_name') baseValue = row.store_id === 'S001' ? '上海南京东路店' : (row.store_id === 'S003' ? '广州天河店' : '其它分店');
            else baseValue = 'N/A';
          }
          
          // Apply masking logic from dataset metadata
          const fieldDef = datasetFields.find(x => x.name === field);
          if (fieldDef && (fieldDef.sensitive || (fieldDef.maskingRule && fieldDef.maskingRule !== 'none'))) {
            const rule = fieldDef.maskingRule || 'none';
            
            // Check identity privileges
            let requiresMask = false;
            if (simulatedRole === 'store_manager') {
              requiresMask = true; // Store manager masks everything
            } else if (simulatedRole === 'manager') {
              // Region Manager can see names, but masks contacts
              if (rule !== 'mask_name' && field !== 'member_name') {
                requiresMask = true;
              }
            } else {
              // Auditor can see mostly everything, masks contact number and keys only
              if (rule === 'mask_phone' || rule === 'mask_id' || field === 'phone_no') {
                requiresMask = true;
              }
            }

            if (requiresMask && rule !== 'none') {
              const ruleName = field + ' [' + rule + ']';
              if (!fieldMaskingApplied.includes(ruleName)) {
                fieldMaskingApplied.push(ruleName);
              }

              if (rule === 'mask_phone' && typeof baseValue === 'string') {
                baseValue = baseValue.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');
              } else if (rule === 'mask_email' && typeof baseValue === 'string') {
                baseValue = baseValue.replace(/^([^@]{1})([^@]+)(@.+)$/, '$1***$3');
              } else if (rule === 'mask_name' && typeof baseValue === 'string') {
                baseValue = baseValue.length > 2 
                  ? baseValue[0] + '*' + baseValue[baseValue.length - 1] 
                  : baseValue[0] + '*';
              } else if (rule === 'mask_id') {
                baseValue = '330***********1234';
              } else if (rule === 'hash') {
                baseValue = 'HASH_' + Math.abs(field.split('').reduce((a,b)=>a+b.charCodeAt(0), 0) + String(baseValue).split('').reduce((a,b)=>a+b.charCodeAt(0), 0)).toString(16).toUpperCase();
              }
            }
          }
          newRow[field] = baseValue;
        });
        return newRow;
      });
      
      return {
        status: "success",
        data: mockedOutputData,
        metadata: {
          rowCount: mockedOutputData.length,
          dataFreshness: new Date().toISOString().replace('T', ' ').substring(0, 19),
          simulatorContext: {
            simulatedRole: simulatedRole === 'auditor' ? '总部审计员' : (simulatedRole === 'manager' ? '大区经理' : '门店掌门人'),
            simulatedTerritory: regionNameCh + '大区' + (simulatedRole === 'store_manager' ? ` (${storeNameTarget})` : ''),
            appliedRlsPolicyCount: simulatedRole === 'auditor' ? 0 : 1,
            appliedColumnMaskRuleCount: fieldMaskingApplied.length
          },
          securityGovernance: {
            policyApplied: "identity_driven_active",
            tableAccessMode: simulatedRole === 'auditor' ? 'full_access' : 'restricted_access',
            appliedRowSecurityFilters: appliedRowFiltersList,
            fieldMaskingRulesApplied: fieldMaskingApplied,
            mcpComplianceCheck: "✓ COMPLIANT_PERSONA_SECURE"
          }
        }
      };
    })(),
    'aggregate-dataset': (() => {
      const isPolicyEnabled = !!mappedDs?.permissionPolicy?.enabled;
      const appliedFilters: string[] = [];
      if (isPolicyEnabled && mappedDs?.permissionPolicy) {
        const activeRows = (mappedDs.permissionPolicy.rowAccess || []).filter(ra => ra.enabled);
        activeRows.forEach(rule => {
          appliedFilters.push(`${rule.ruleName}: [${rule.field} ${rule.operator} ${rule.value}]`);
        });
      }

      return {
        status: "success",
        data: baseResponses['aggregate-dataset'].data,
        metadata: {
          rowCount: baseResponses['aggregate-dataset'].data.length,
          dataFreshness: new Date().toISOString().replace('T', ' ').substring(0, 19),
          securityGovernance: {
            policyApplied: isPolicyEnabled ? "enabled" : "disabled",
            appliedRowSecurityFilters: appliedFilters,
            mcpComplianceCheck: isPolicyEnabled ? "✓ ALL_COMPLIANT_SECURE" : "UNPROTECTED_PUBLIC_ACCESS"
          }
        }
      };
    })()
  };

  const handleToolSelect = (id: string) => {
    setActiveTool(id);
    setReqBody(mockRequests[id]);
    setResponse(null);
  };

  const handleExecute = () => {
    setLoading(true);
    setResponse(null);
    // Simulate network delay
    setTimeout(() => {
      setResponse(JSON.stringify(mockResponses[activeTool], null, 2));
      setLoading(false);
    }, 600);
  };

  const currentToolDef = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="flex-1 m-6 grid grid-cols-12 gap-6 animate-in fade-in duration-300 h-[800px]">
      
      {/* Sidebar Tool List */}
      <div className="col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Server className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-slate-800">MCP Protocol Tools</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => handleToolSelect(tool.id)}
              className={`text-left px-3 py-3 rounded-lg text-sm transition-all focus:outline-none ${
                activeTool === tool.id
                  ? 'bg-yellow-50 text-black font-semibold border border-yellow-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="font-mono mb-1">{tool.name}</div>
              <div className={`text-xs ${activeTool === tool.id ? 'text-slate-600' : 'text-slate-400'}`}>
                {tool.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Response Area */}
      <div className="col-span-9 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        
        {/* Top Info Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-semibold text-slate-800 flex items-center gap-2">
              <TerminalSquare className="w-5 h-5 text-slate-500" />
              {currentToolDef?.name}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{currentToolDef?.desc}</p>
          </div>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="bg-yellow-400 hover:bg-yellow-500 text-black px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-wait"
          >
            <Play className="w-4 h-4 fill-current" />
            调用 Tool
          </button>
        </div>

        {/* Identity Simulator Bar */}
        <div className="px-5 py-3 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between text-slate-700 gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-xs font-bold text-slate-705 uppercase tracking-wide flex items-center gap-1.5">
              <span>调试身份模拟器 (Identity Simulator)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-550 font-medium">角色岗位:</span>
              <select 
                value={simulatedRole} 
                onChange={(e) => {
                  const role = e.target.value as any;
                  setSimulatedRole(role);
                  if (role === 'auditor') {
                    setSimulatedRegion('all');
                  } else if (simulatedRegion === 'all') {
                    setSimulatedRegion('huadong');
                  }
                }}
                className="bg-white border border-slate-250 hover:border-slate-350 rounded-lg px-2 py-1 text-slate-800 font-semibold cursor-pointer outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-colors"
              >
                <option value="auditor">总部审计员 (HQ Auditor)</option>
                <option value="manager">大区经理 (Region Manager)</option>
                <option value="store_manager">极速店长 (Store Manager)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-550 font-medium">授权属地:</span>
              <select 
                value={simulatedRegion} 
                onChange={(e) => setSimulatedRegion(e.target.value as any)}
                disabled={simulatedRole === 'auditor'}
                className="bg-white border border-slate-250 hover:border-slate-350 rounded-lg px-2 py-1 text-slate-800 font-semibold cursor-pointer outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {simulatedRole === 'auditor' && <option value="all">全国 (All Regions)</option>}
                <option value="huadong">华东大区 (East China)</option>
                <option value="huanan">华南大区 (South China)</option>
              </select>
            </div>
            
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 text-[11px] font-medium max-w-xs leading-none">
              切换身份立刻观察 <code className="font-mono bg-slate-205 text-amber-800 px-1 py-0.5 rounded">query-dataset</code> 输出
            </span>
          </div>
        </div>

        {/* Editors Grid */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 min-h-0 bg-slate-50">
          
          {/* Request Panel */}
          <div className="flex flex-col h-full bg-white">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Request Payload (JSON)
            </div>
            <textarea
              value={reqBody}
              onChange={(e) => setReqBody(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-sm text-slate-800 bg-transparent resize-none outline-none focus:ring-inset focus:ring-1 focus:ring-yellow-400"
              spellCheck="false"
            />
          </div>

          {/* Response Panel */}
          <div className="flex flex-col h-full">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              MCP Response
              {response && <span className="text-black font-medium lowercase bg-yellow-400 px-2 py-0.5 rounded animate-in fade-in">status: 200</span>}
            </div>
            <div className="flex-1 p-4 overflow-auto bg-slate-900 text-slate-300 font-mono text-sm leading-relaxed relative">
              {loading && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-yellow-400 animate-pulse">Executing Data Source...</span>
                  </div>
                </div>
              )}
              {response ? (
                <pre className="whitespace-pre-wrap">{response}</pre>
              ) : (
                !loading && <div className="text-slate-600 italic">等待执行...</div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
