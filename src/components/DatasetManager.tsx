import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { Settings, Sparkles, Send, Trash2, Search, X, Plus, Save, Clock, CheckCircle2, ShieldAlert, Edit2, Loader2, Play, Database, Lock, Shield } from 'lucide-react';
import { Dataset, Field, DatasetStatus, Topic, FieldSource, DataSource, FieldAccessPolicy, RowAccessPolicy } from '../types';
import { mockSourceSchemas, mockFields } from '../data';

export default function DatasetManager() {
  const { 
    datasets, setDatasets, 
    selectedDataset, setSelectedDataset, 
    showToast, 
    fields, setFields,
    topics, setTopics,
    dataSources, setDataSources
  } = useAppContext();

  const [search, setSearch] = useState('');
  const [activeTopicId, setActiveTopicId] = useState<string>('all');
  const [status, setStatus] = useState('全部');
  const [mcp, setMcp] = useState('全部');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic'|'fields'|'query'|'permissions'>('basic');

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newDs, setNewDs] = useState({ 
    datasetName: '', topicId: topics[0]?.id || '', description: '', mcpEnabled: false,
    sourceId: '', databaseName: '', tableName: ''
  });

  // Topic modals
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState({ id: '', name: '', description: '' });

  // Data Source Management
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [dsFormOpen, setDsFormOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
  const [dsForm, setDsForm] = useState<Partial<DataSource>>({
    sourceName: '',
    sourceType: 'Doris',
    feHost: '',
    queryPort: 9030,
    httpPort: 8030,
    username: '',
    password: '',
    remark: ''
  });

  const handleTestConnection = (ds?: Partial<DataSource>) => {
    setIsTestingConn(true);
    showToast('正在建立连接测试...');
    setTimeout(() => {
      setIsTestingConn(false);
      showToast('连接测试成功');
    }, 1000);
  };

  const handleSaveDataSource = () => {
    if (!dsForm.feHost || !dsForm.sourceName || !dsForm.username) {
      showToast('保存数据源失败：请填写完整的数据源名称、FE地址和用户名');
      return;
    }
    if (editingDs) {
      const updated = dataSources.map(d => d.sourceId === editingDs.sourceId ? { 
        ...editingDs, 
        ...dsForm, 
        password: dsForm.password || editingDs.password || '',
        updatedAt: '2026-06-22 16:52', 
        status: 'connected' 
      } : d);
      setDataSources(updated as DataSource[]);
      showToast('修改数据源成功：配置已保存并已重连');
    } else {
      const newSource: DataSource = {
        ...(dsForm as DataSource),
        sourceId: 'doris_' + Math.random().toString(36).substring(2, 8),
        status: 'connected',
        updatedAt: '2026-06-22 16:52'
      };
      setDataSources([...dataSources, newSource]);
      showToast('新建数据源成功：已成功保存并建立连接');
    }
    setDsFormOpen(false);
    setEditingDs(null);
  };

  const handleDeleteDataSource = (id: string) => {
    triggerConfirm(
      '确定删除该数据源吗？',
      '已绑定该数据源的数据集不会被删除，但继续查询可能会报错，建议后续为数据集重新绑定有效的数据源。',
      () => {
        setDataSources(prev => prev.filter(d => d.sourceId !== id));
        showToast('数据源删除成功');
      }
    );
  };

  const [parserOpen, setParserOpen] = useState(false);
  const [parseStatus, setParseStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessages, setParseMessages] = useState<string[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<Field[]>([]);

  // Enum mapping states & helpers
  const [enumModalOpen, setEnumModalOpen] = useState(false);
  const [enumField, setEnumField] = useState<Field | null>(null);
  const [enumFieldIndex, setEnumFieldIndex] = useState<number | null>(null);
  const [localMappings, setLocalMappings] = useState<any[]>([]);

  const supportsEnumMapping = (type: string) => {
    const t = type.toLowerCase();
    return ['string', 'varchar', 'char', 'int', 'bigint', 'decimal', 'double', 'float'].includes(t);
  };

  const openEnumMappingModal = (field: Field, index: number) => {
    setEnumField(field);
    setEnumFieldIndex(index);
    setLocalMappings(field.enumMappings ? JSON.parse(JSON.stringify(field.enumMappings)) : []);
    setEnumModalOpen(true);
  };

  const saveEnumMappings = () => {
    if (enumFieldIndex === null) return;
    
    // Check raw value presence
    const emptyRaw = localMappings.find(m => !m.rawValue || !m.rawValue.trim());
    if (emptyRaw) {
      showToast('保存失败：原始值不能为空');
      return;
    }

    updateField(enumFieldIndex, 'enumMappings', localMappings);
    updateField(enumFieldIndex, 'source', '已人工修改');
    showToast('枚举映射已保存');
    setEnumModalOpen(false);
  };

  const importSampleEnumMappings = () => {
    if (!enumField) return;
    const name = enumField.name.toLowerCase();
    let samples: any[] = [];
    
    if (name === 'region_name') {
      samples = [
        {
          rawValue: '华东',
          displayValue: '华东',
          synonyms: ['东区', '华东区', 'East China'],
          enabled: true,
          description: '华东经营区域'
        },
        {
          rawValue: '华南',
          displayValue: '华南',
          synonyms: ['南区', '华南区', 'South China'],
          enabled: true,
          description: '华南经营区域'
        },
        {
          rawValue: '华北',
          displayValue: '华北',
          synonyms: ['北区', '华北区', 'North China'],
          enabled: true,
          description: '华北经营区域'
        }
      ];
    } else if (name === 'member_level' || name === 'member_level_code') {
      samples = [
        {
          rawValue: '1',
          displayValue: '普通会员',
          synonyms: ['普通', '基础会员'],
          enabled: true,
          description: '基础会员等级'
        },
        {
          rawValue: '2',
          displayValue: '银卡会员',
          synonyms: ['银卡', '银牌会员'],
          enabled: true,
          description: '银卡会员等级'
        },
        {
          rawValue: '3',
          displayValue: '金卡会员',
          synonyms: ['金卡', '高价值会员'],
          enabled: true,
          description: '金卡会员等级'
        }
      ];
    } else if (name === 'store_type') {
      samples = [
        {
          rawValue: '直营',
          displayValue: '直营店',
          synonyms: ['直营', '自营'],
          enabled: true,
          description: '品牌直营管理门店'
        },
        {
          rawValue: '加盟',
          displayValue: '加盟店',
          synonyms: ['联营', '合伙'],
          enabled: true,
          description: '加盟合伙商管理门店'
        }
      ];
    } else {
      samples = [
        {
          rawValue: 'VAL1',
          displayValue: '示例值 A',
          synonyms: ['别名 1', 'Alias A'],
          enabled: true,
          description: '基础示例值描述 A'
        },
        {
          rawValue: 'VAL2',
          displayValue: '示例值 B',
          synonyms: ['别名 2', 'Alias B'],
          enabled: true,
          description: '基础示例值描述 B'
        }
      ];
    }

    setLocalMappings([...localMappings, ...samples]);
    showToast('已从Doris数据流中采样并导入枚举候选项');
  };

  const addLocalMapping = () => {
    setLocalMappings([
      ...localMappings,
      {
        rawValue: '',
        displayValue: '',
        synonyms: [],
        enabled: true,
        description: ''
      }
    ]);
  };

  const removeLocalMapping = (idx: number) => {
    setLocalMappings(localMappings.filter((_, i) => i !== idx));
    showToast('枚举值已移除');
  };

  const updateLocalMapping = (idx: number, key: string, value: any) => {
    setLocalMappings(localMappings.map((m, i) => i === idx ? { ...m, [key]: value } : m));
  };

  // Update datasets count per topic
  const getTopicCount = (topicName: string) => {
    return datasets.filter(d => d.topic === topicName).length;
  };

  const getUncategorizedCount = () => {
    const topicNames = topics.map(t => t.name);
    return datasets.filter(d => !d.topic || !topicNames.includes(d.topic)).length;
  };

  const syncParseResults = () => {
    setFields(parsedCandidates);
    showToast('解析结果已应用到字段配置');
    setParserOpen(false);
  };
  const currentSchema = mockSourceSchemas.find(s => s.sourceId === newDs.sourceId);
  const currentDatabases = currentSchema ? currentSchema.databases : [];
  const currentDatabase = currentDatabases.find(db => db.name === newDs.databaseName);
  const currentTables = currentDatabase ? currentDatabase.tables : [];

  const selectedSchema = mockSourceSchemas.find(s => s.sourceId === selectedDataset?.sourceId);
  const selectedDatabases = selectedSchema ? selectedSchema.databases : [];
  const selectedDatabase = selectedDatabases.find(db => db.name === selectedDataset?.databaseName);
  const selectedTables = selectedDatabase ? selectedDatabase.tables : [];

  const handleTableChange = (tableName: string) => {
    const table = currentTables.find(t => t.name === tableName);
    if (table) {
      setNewDs({
        ...newDs,
        tableName,
        datasetName: table.displayNameDraft,
        description: table.descriptionDraft
      });
    } else {
      setNewDs({ ...newDs, tableName });
    }
  };

  const handleCreateDataset = () => {
    if (!newDs.datasetName || !newDs.sourceId || !newDs.databaseName || !newDs.tableName) {
      showToast('保存数据集失败：请填写完整数据集和来源配置信息');
      return;
    }
    const topicObj = topics.find(t => t.id === newDs.topicId);
    const sourceObj = dataSources.find(s => s.sourceId === newDs.sourceId);
    const ds: Dataset = {
      id: `${newDs.tableName}_${Date.now()}`,
      datasetName: newDs.datasetName,
      topic: topicObj ? topicObj.name : newDs.topicId,
      description: newDs.description,
      mcpEnabled: newDs.mcpEnabled,
      status: '草稿',
      fieldCount: 0,
      queryPolicyConfigured: false,
      sourceId: newDs.sourceId,
      sourceName: sourceObj?.sourceName || '',
      sourceType: sourceObj?.sourceType || 'Doris',
      databaseName: newDs.databaseName,
      tableName: newDs.tableName,
      updatedAt: new Date().toISOString()
    };
    setDatasets([ds, ...datasets]);
    showToast('数据集创建成功：请继续配置字段和查询策略');
    setNewDs({ datasetName: '', topicId: topics[0]?.id || '', description: '', mcpEnabled: false, sourceId: '', databaseName: '', tableName: '' });
    setNewModalOpen(false);
  };

  const handleCreateDatasetAndParse = () => {
    if (!newDs.datasetName || !newDs.sourceId || !newDs.databaseName || !newDs.tableName) {
      showToast('保存并解析失败：请填写完整数据集和来源配置信息');
      return;
    }
    const topicObj = topics.find(t => t.id === newDs.topicId);
    const sourceObj = dataSources.find(s => s.sourceId === newDs.sourceId);
    const ds: Dataset = {
      id: `${newDs.tableName}_${Date.now()}`,
      datasetName: newDs.datasetName,
      topic: topicObj ? topicObj.name : newDs.topicId,
      description: newDs.description,
      mcpEnabled: newDs.mcpEnabled,
      status: '草稿',
      fieldCount: 0,
      queryPolicyConfigured: true,
      defaultLimit: 100,
      maxLimit: 1000,
      allowUnlimitedReturn: false,
      requireTimeFilter: true,
      timeField: 'biz_date',
      allowDetailQuery: true,
      allowAggregateQuery: true,
      allowSensitiveQuery: false,
      sourceId: newDs.sourceId,
      sourceName: sourceObj?.sourceName || '',
      sourceType: sourceObj?.sourceType || 'Doris',
      databaseName: newDs.databaseName,
      tableName: newDs.tableName,
      updatedAt: new Date().toISOString()
    };
    setDatasets([ds, ...datasets]);
    setNewModalOpen(false);
    showToast('创建成功并启动解析：字段元数据已解析并生成初始化配置');
    setNewDs({ datasetName: '', topicId: topics[0]?.id || '', description: '', mcpEnabled: false, sourceId: '', databaseName: '', tableName: '' });
    
    // Open drawer sequence
    setSelectedDataset(ds);
    setDrawerOpen(true);
    setActiveTab('fields');
    setParserOpen(true);
    
    // simulate parsing
    setParseStatus('loading');
    setParseProgress(0);
    setParseMessages(['正在连接 Doris 生产集群...', '读取 schema 信息...']);
    setTimeout(() => {
      setParseStatus('success');
      setParseProgress(100);
      setParseMessages(prev => [...prev, '解析完成，发现推荐字段规则']);
    }, 1500);
  };

  const handleSaveTopic = () => {
    if (!topicForm.id || !topicForm.name) {
      showToast('保存主题失败：请核对主题标识和名称是否完整');
      return;
    }
    if (editingTopic) {
      setTopics(topics.map(t => t.id === editingTopic.id ? topicForm : t));
      showToast('主题保存成功');
    } else {
      setTopics([...topics, topicForm]);
      showToast('新建主题成功');
    }
    setTopicModalOpen(false);
    setEditingTopic(null);
  };

  const handleDeleteTopic = (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation();
    triggerConfirm(
      '确认删除该主题（分组）吗？',
      '该删除操作不会删除数据集本身，但会将跟此组关联的所有数据集自动归入到“未分组”列表下。',
      () => {
        setTopics(prev => prev.filter(t => t.id !== topic.id));
        showToast('主题删除成功');
        if (activeTopicId === topic.id) {
           setActiveTopicId('all');
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    triggerConfirm(
      '确定要删除该数据集配置吗？',
      '此操作属于敏感行为，将会彻底清除该物理表在 MCP 服务中的治理及配置信息，此操作不可逆。',
      () => {
        setDatasets(prev => prev.filter(d => d.id !== id));
        showToast('数据集删除成功');
      }
    );
  };

  const handlePublishRow = (ds: Dataset) => {
    const updated = datasets.map(d => d.id === ds.id ? { ...d, status: '已发布' as DatasetStatus, mcpEnabled: true } : d);
    setDatasets(updated);
    showToast('发布成功：已成功部署到 MCP Runtime');
  };

  const openConfig = (ds: Dataset) => {
    setSelectedDataset(ds);
    setDrawerOpen(true);
    setActiveTab('basic');
    setParserOpen(false);
  };

  const openParse = (ds: Dataset) => {
    setSelectedDataset(ds);
    setDrawerOpen(true);
    setActiveTab('fields');
    setParserOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('全部');
    setMcp('全部');
    setActiveTopicId('all');
  };

  const filteredDatasets = datasets.filter(ds => {
    if (search && !(ds.datasetName || '').includes(search) && !(ds.description || '').includes(search)) return false;
    
    if (activeTopicId !== 'all') {
      if (activeTopicId === 'uncategorized') {
        const topicNames = topics.map(t => t.name);
        if (ds.topic && topicNames.includes(ds.topic)) return false;
      } else {
        const activeTopic = topics.find(t => t.id === activeTopicId);
        if (activeTopic && ds.topic !== activeTopic.name) return false;
      }
    }
    
    if (status !== '全部' && ds.status !== status) return false;
    if (mcp !== '全部' && (mcp === '是' ? !ds.mcpEnabled : ds.mcpEnabled)) return false;
    return true;
  });

  const updateSelectedDs = (updates: Partial<Dataset>) => {
    if (!selectedDataset) return;
    const updatedDs = { ...selectedDataset, ...updates };
    setSelectedDataset(updatedDs);
  };

  const saveBasicInfo = () => {
    if (!selectedDataset) return;
    if (!selectedDataset.datasetName || !selectedDataset.datasetName.trim()) {
      showToast('保存基础信息失败：数据集名称不能为空');
      return;
    }
    setDatasets(datasets.map(d => d.id === selectedDataset.id ? selectedDataset : d));
    showToast('基础信息保存成功');
  };

  const saveFieldsConfig = () => {
    if (!selectedDataset) return;
    
    const emptyField = fields.find(f => !f.name || !f.name.trim());
    if (emptyField) {
      showToast('保存字段配置失败：存在未填写的字段名称');
      return;
    }

    const names = fields.map(f => f.name.trim());
    const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
    if (duplicates.length > 0) {
      showToast(`保存字段配置失败：存在重复的字段名 ${duplicates[0]}`);
      return;
    }

    const confirmedFields = fields.map(f => ({
      ...f,
      source: (f.source === '解析结果' ? '已确认' : f.source) as FieldSource
    }));
    setFields(confirmedFields);

    const updatedDs = {
      ...selectedDataset,
      fieldCount: confirmedFields.length,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setSelectedDataset(updatedDs);
    setDatasets(datasets.map(d => d.id === updatedDs.id ? updatedDs : d));
    showToast('字段配置保存成功');
  };

  const saveQueryPolicy = () => {
    if (!selectedDataset) return;
    if (selectedDataset.requireTimeFilter && !selectedDataset.timeField) {
      showToast('保存策略失败：如果强制进行时间过滤，则必须分配一个时间字段');
      return;
    }
    if (selectedDataset.defaultLimit !== undefined && (isNaN(selectedDataset.defaultLimit) || selectedDataset.defaultLimit <= 0)) {
      showToast('保存策略失败：默认返回行数必须大于 0');
      return;
    }
    if (!selectedDataset.allowUnlimitedReturn && selectedDataset.maxLimit !== undefined && selectedDataset.maxLimit !== null && (isNaN(selectedDataset.maxLimit) || selectedDataset.maxLimit <= 0)) {
      showToast('保存策略失败：最大返回行数必须大于 0');
      return;
    }
    if (!selectedDataset.allowUnlimitedReturn && selectedDataset.maxLimit !== undefined && selectedDataset.maxLimit !== null && selectedDataset.defaultLimit !== undefined && selectedDataset.maxLimit < selectedDataset.defaultLimit) {
      showToast('保存策略失败：最大返回行数不能小于默认返回行数');
      return;
    }

    setDatasets(datasets.map(d => d.id === selectedDataset.id ? selectedDataset : d));
    showToast('查询策略保存成功');
  };

  const handlePublishDrawer = () => {
    if (!selectedDataset) return;
    const executePublish = () => {
      const updatedDs: Dataset = { ...selectedDataset, status: '已发布', mcpEnabled: true };
      setSelectedDataset(updatedDs);
      setDatasets(datasets.map(d => d.id === updatedDs.id ? updatedDs : d));
      showToast('发布成功：该数据集已成功发布到 MCP Runtime');
    };

    if (fields.length === 0) {
      triggerConfirm(
        '该数据集尚未配置字段',
        '建议先完成字段配置后再发布（配置字段能给大模型提供更好的数据结构识别）。\n\n点击“确定”强行继续发布，点击“取消”返回字段配置。',
        () => {
          executePublish();
        }
      );
    } else {
      triggerConfirm(
        '确认发布到 MCP Runtime',
        `确认要将数据集【${selectedDataset.datasetName}】发布到 MCP 运行时服务吗？发布后此表可被 AI Agent 调用并执行安全治理下的多段查询。`,
        () => {
          executePublish();
        }
      );
    }
  };

  const handleOfflineDrawer = () => {
    if (!selectedDataset) return;
    triggerConfirm(
      '确认下线本数据集',
      `您确定要将数据集【${selectedDataset.datasetName}】从 MCP Runtime 下线吗？下线后，外接智能终端和 API 将阻断该数据表的查询感知。`,
      () => {
        const updatedDs: Dataset = { ...selectedDataset, mcpEnabled: false };
        setSelectedDataset(updatedDs);
        setDatasets(datasets.map(d => d.id === updatedDs.id ? updatedDs : d));
        showToast('下线成功：该数据集已成功从 MCP Runtime 下线');
      }
    );
  };

  const saveDraftDrawer = () => {
    if (!selectedDataset) return;
    const updatedDs: Dataset = { ...selectedDataset, status: '草稿' };
    setSelectedDataset(updatedDs);
    setDatasets(datasets.map(d => d.id === updatedDs.id ? updatedDs : d));
    showToast('草稿保存成功：已成功保存数据集为草稿');
  };

  const handleAddField = (source: FieldSource = '人工配置') => {
    setFields([...fields, {
      name: '', displayName: '', type: 'string', role: '维度', description: '',
      queryable: true, filterable: false, groupable: false, sensitive: false, aggregationsSupported: [],
      source
    }]);
    showToast('添加成功：已新增一行空字段');
  };

  const updateField = (idx: number, key: keyof Field, val: any) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], [key]: val };
    setFields(updated);
  };

  const removeField = (idx: number) => {
    const deletedField = fields[idx];
    triggerConfirm(
      '确定删除该字段吗？',
      `您确定要从此数据集中移除字段【${deletedField.name || '未命名草稿'}】吗？该操作不会删除真实的物理数据库中的列，仅阻挡当前数据集的字段配置，但会清除其配偶。`,
      () => {
        const updated = [...fields];
        updated.splice(idx, 1);
        setFields(updated);
        showToast(`删除成功：已移除了字段 ${deletedField.name || '草稿'}`);
      }
    );
  };

  // 1. 智能数据类型纠错与物理聚合函数智能推荐/校准
  const handleSmartCleanAggregations = () => {
    const isNumericType = (type: string): boolean => {
      const t = (type || '').toLowerCase();
      return ['int', 'bigint', 'decimal', 'double', 'float'].includes(t);
    };

    const updated = fields.map(f => {
      const isNum = isNumericType(f.type);
      let nextAgg = f.aggregationsSupported || [];
      
      if (!isNum) {
        // 非数值类型强制剥离 sum 和 avg，规避数据库语法错误
        nextAgg = nextAgg.filter(a => !['sum', 'avg'].includes(a));
      } else {
        // 数值类型若没有或不全，自动补全最优通用度量指标
        if (nextAgg.length === 0) {
          nextAgg = ['sum', 'avg', 'count', 'count_distinct', 'min', 'max'];
        }
      }
      return {
        ...f,
        aggregationsSupported: nextAgg,
        source: '已人工修改'
      };
    });
    
    setFields(updated);
    showToast('✓ 智能校准成功：已完成物理字段类型检查，自动清洗并保护不兼容的聚合操作权限');
  };

  // 2. AI 智能自审与未脱敏敏感字段防守上锁
  const handleAutoAuditSensitivity = () => {
    let auditCount = 0;
    const updated = fields.map(f => {
      const name = (f.name || '').toLowerCase();
      const displayName = (f.displayName || '').toLowerCase();
      const needsMask = /phone|mobile|tel|email|secret|pwd|password|id_card|identity|card_no|salary|price|amt|amount|username|realname|real_name/i.test(name) ||
                        /手机|邮箱|密码|身份证|工资|金额|姓名|电话/i.test(displayName);
      
      if (needsMask && !f.sensitive) {
        auditCount++;
        return {
          ...f,
          sensitive: true,
          source: '已人工修改'
        };
      }
      return f;
    });
    
    setFields(updated);
    if (auditCount > 0) {
      showToast(`⚠️ 敏感词智能审计：已成功捕捉并锁定防护 ${auditCount} 个隐藏敏感字段！已自动将其设置为「敏感」保密级`);
    } else {
      showToast('✓ 敏感词智能审计：未检测到泄露安全隐患的公开敏感词，数据集结构符合最高级别数据合规要求');
    }
  };

  // 3. 字段常见属性一键全选或批量统一变更
  const handleBatchToggleAttribute = (key: 'queryable' | 'filterable' | 'groupable', value: boolean) => {
    const updated = fields.map(f => ({
      ...f,
      [key]: value,
      source: '已人工修改'
    }));
    setFields(updated);
    const labelMap = { queryable: '可查询', filterable: '可筛选', groupable: '可分组' };
    showToast(`✓ 批量操作成功：已将所有列的 [${labelMap[key]}] 指配统一设为 [${value ? '开启' : '关闭'}]`);
  };

  // 4. 一键批量确认解析推荐出的字段
  const handleBatchConfirmSource = () => {
    let count = 0;
    const updated = fields.map(f => {
      if (f.source === '解析结果') {
        count++;
        return { ...f, source: '已确认' as FieldSource };
      }
      return f;
    });
    setFields(updated);
    showToast(`✓ 一键确认成功：已将 ${count} 个解析候选字段一键确认为正式数据集字段`);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto w-full animate-in fade-in duration-300 relative flex gap-6 flex-1 items-start">
      {/* Target new side panel: Topics */}
      <div className="w-64 shrink-0 flex flex-col gap-4 sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">主题分组</h3>
          <button onClick={() => { setTopicForm({ id: '', name: '', description: '' }); setTopicModalOpen(true); }} className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">数据目录</div>
          <button 
            onClick={() => setActiveTopicId('all')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between font-medium ${activeTopicId === 'all' ? 'bg-yellow-400 text-black' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <span>全部数据集</span>
            <span className={`text-xs ${activeTopicId === 'all' ? 'text-black' : 'text-slate-400'}`}>{datasets.length}</span>
          </button>
          <div className="pl-3 flex flex-col gap-1 mt-1 border-l-2 border-slate-100 ml-3">
            {topics.map(t => (
              <div key={t.id} className="relative group">
                <div 
                  onClick={() => setActiveTopicId(t.id)}
                  title={t.description}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTopicId(t.id);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer outline-none ${activeTopicId === t.id ? 'bg-yellow-400 text-black font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <div className="truncate pr-4">{t.name}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${activeTopicId === t.id ? 'text-black' : 'text-slate-400'} group-hover:hidden`}>{getTopicCount(t.name)}</span>
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setEditingTopic(t); setTopicForm(t); setTopicModalOpen(true); }} className="hover:text-blue-600 outline-none"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => handleDeleteTopic(e, t)} className="hover:text-red-600 outline-none"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="relative group">
              <div 
                onClick={() => setActiveTopicId('uncategorized')}
                title="不属于任何主题的数据集"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveTopicId('uncategorized');
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer outline-none ${activeTopicId === 'uncategorized' ? 'bg-yellow-400 text-black font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className="truncate pr-4">未分组</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${activeTopicId === 'uncategorized' ? 'text-black' : 'text-slate-400'}`}>{getUncategorizedCount()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-1">数据集管理</h2>
            <p className="text-slate-500 text-sm">统一管理可暴露给 Dataset MCP 的数据集，支持主题分组、元数据解析、人工配置和发布。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDsModalOpen(true)} className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              数据源管理
            </button>
            <button onClick={() => setNewModalOpen(true)} className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              新增数据集
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center shadow-sm shrink-0 min-w-0">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-md min-w-0">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input type="text" placeholder="搜索数据集名称、中文名或描述" value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm w-full outline-none text-slate-700 min-w-0" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">状态:</span>
            <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border-slate-200 border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-yellow-400">
              <option value="全部">全部</option>
              <option value="草稿">草稿</option>
              <option value="已发布">已发布</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">启用 MCP:</span>
            <select value={mcp} onChange={e => setMcp(e.target.value)} className="text-sm border-slate-200 border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-yellow-400">
              <option value="全部">全部</option>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          </div>
          <div className="ml-auto flex gap-2 shrink-0">
            <button onClick={resetFilters} className="text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-transparent hover:bg-slate-100 transition-colors">重置过滤</button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col w-full min-w-0 relative">
          <div className="overflow-x-auto w-full min-w-0 bg-white rounded-xl">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
              <thead className="sticky top-0 z-10 bg-slate-50 outline outline-1 outline-slate-200">
                <tr className="text-slate-500 text-sm font-medium">
                <th className="px-5 py-4">数据集名称</th>
                <th className="px-5 py-4">所属主题</th>
                <th className="px-5 py-4">数据源&表</th>
                <th className="px-5 py-4">描述</th>
                <th className="px-4 py-4 w-20">字段数</th>
                <th className="px-4 py-4 w-28">状态</th>
                <th className="px-4 py-4 w-28">启用 MCP</th>
                <th className="px-4 py-4 w-40">更新时间</th>
                <th className="px-4 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDatasets.map(ds => (
                <tr key={ds.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-mono text-sm text-slate-700">{ds.datasetName}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{ds.topic || <span className="text-slate-400 italic">未分组</span>}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">{ds.sourceName || '-'}</span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5">{ds.databaseName && ds.tableName ? `${ds.databaseName}.${ds.tableName}` : '-'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 max-w-[200px] truncate" title={ds.description}>{ds.description}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{ds.fieldCount}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ds.status === '已发布' ? 'bg-yellow-400 text-black' : 'bg-slate-100 text-slate-600'}`}>
                      {ds.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ds.mcpEnabled ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {ds.mcpEnabled ? '是' : '否'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">2026-06-22 10:30</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openConfig(ds)} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors text-xs font-medium whitespace-nowrap" title="配置">配置</button>
                      <button onClick={() => handlePublishRow(ds)} disabled={ds.status === '已发布'} className={`p-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${ds.status === '已发布' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`} title="发布">发布</button>
                      <button onClick={() => handleDelete(ds.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors text-xs font-medium whitespace-nowrap" title="删除">删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDatasets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">没有找到匹配的数据集</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer Panel */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-[1100px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-[100%]'}`}>
        {selectedDataset && (
          <>
            {/* Header: Common for both Config and Detail */}
            <div className="px-6 border-b border-slate-200 flex flex-col bg-slate-50 shrink-0">
              <div className="flex items-start justify-between py-5">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">配置数据集：{selectedDataset.datasetName}</h3>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{selectedDataset.topic || '未分组'}</span>
                    <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${selectedDataset.status === '已发布' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>{selectedDataset.status}</span>
                    <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${selectedDataset.status === '已发布' && selectedDataset.mcpEnabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>MCP Visibility: {selectedDataset.status === '已发布' && selectedDataset.mcpEnabled ? '可见' : '不可见'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDataset.status !== '已发布' && (
                    <button onClick={() => handlePublishDrawer()} className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">发布到 MCP</button>
                  )}
                  {selectedDataset.status === '已发布' && selectedDataset.mcpEnabled && (
                    <button onClick={() => handleOfflineDrawer()} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm border-dashed">下线 MCP</button>
                  )}
                  {selectedDataset.status === '已发布' && !selectedDataset.mcpEnabled && (
                    <button onClick={() => handlePublishDrawer()} className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">重新发布</button>
                  )}
                  <div className="w-px h-6 bg-slate-300 mx-1"></div>
                  <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-2 rounded-lg border border-slate-200 transition-colors"><X className="w-4 h-4"/></button>
                </div>
              </div>
              
              {selectedDataset.status === '已发布' && selectedDataset.mcpEnabled && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-1">已接入 MCP Runtime</div>
                    <div className="text-green-700 text-xs">当前数据集配置已生效，Agent 及其他 AI 服务可通过 <code>list-datasets</code>, <code>describe-dataset</code>, <code>query-dataset</code>, <code>aggregate-dataset</code> 等 Tools 直接访问此数据集。</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex border-b border-slate-200 px-6 space-x-6 shrink-0 bg-slate-50/50 overflow-x-auto">
              {[
                { id: 'basic', label: '基础信息' },
                { id: 'fields', label: '字段配置' },
                { id: 'permissions', label: '权限管理' },
                { id: 'query', label: '查询策略' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-yellow-400 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col min-h-0">
              {activeTab === 'basic' && (
                <div className="space-y-6 max-w-2xl mt-2">
                  <div className="grid grid-cols-2 gap-4 font-sans">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">数据集名称 <span className="text-red-500">*</span></label>
                      <input type="text" value={selectedDataset.datasetName} onChange={e => updateSelectedDs({datasetName: e.target.value})} className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">所属主题</label>
                      <select 
                        value={topics.find(t => t.name === selectedDataset.topic)?.id || ''} 
                        onChange={e => {
                          const tObj = topics.find(t => t.id === e.target.value);
                          updateSelectedDs({ topic: tObj ? tObj.name : '' });
                        }} 
                        className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        <option value="">未分组</option>
                        {topics.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">数据源连接</label>
                      <select 
                        disabled={true}
                        value={selectedDataset.sourceId || ''} 
                        onChange={e => {
                          const sObj = dataSources.find(s => s.sourceId === e.target.value);
                          updateSelectedDs({
                            sourceId: e.target.value, 
                            sourceName: sObj?.sourceName, 
                            sourceType: sObj?.sourceType,
                            databaseName: '',
                            tableName: ''
                          })
                        }} 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 outline-none"
                      >
                        <option value="">请选择数据源...</option>
                        {dataSources.map(s => (
                          <option key={s.sourceId} value={s.sourceId}>{s.sourceName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">物理数据库</label>
                      <select
                        disabled={true}
                        value={selectedDataset.databaseName || ''}
                        onChange={e => updateSelectedDs({ databaseName: e.target.value, tableName: '' })}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 outline-none"
                      >
                        <option value="">请选择数据库...</option>
                        {selectedDatabases.map(db => (
                          <option key={db.name} value={db.name}>{db.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">物理数据表</label>
                      <select
                        disabled={true}
                        value={selectedDataset.tableName || ''}
                        onChange={e => updateSelectedDs({ tableName: e.target.value })}
                        className="w-full text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 outline-none"
                      >
                        <option value="">请选择数据表...</option>
                        {selectedTables.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                      <textarea value={selectedDataset.description} onChange={e => updateSelectedDs({description: e.target.value})} rows={3} className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400 resize-none" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-start">
                    <button onClick={saveBasicInfo} className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                      保存基础信息
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'fields' && (
                <div className="flex flex-col flex-1 min-h-0 relative">
                  <div className="flex gap-3 mb-4 shrink-0 mt-2">
                    <button onClick={() => handleAddField('人工配置')} className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
                      <Plus className="w-4 h-4" />
                      添加字段
                    </button>
                    {!parserOpen && (
                      <button onClick={() => { setParserOpen(true); showToast('元数据解析器已开启'); }} className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
                        元数据解析导入
                      </button>
                    )}

                    <div className="flex-1"></div>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-semibold text-slate-600">已实时自动配置保存</span>
                    </div>
                  </div>

                  {fields.length === 0 && !parserOpen && (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 border-dashed text-center mb-6 mt-4">
                      <Sparkles className="w-8 h-8 text-yellow-500 mb-3" />
                      <h3 className="font-semibold text-slate-900 mb-2">当前数据集尚未配置字段</h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">你可以手动添加字段，或使用元数据解析器从来源表导入字段草稿。</p>
                      <div className="flex gap-3">
                        <button onClick={() => handleAddField('人工配置')} className="px-5 py-2 hover:bg-slate-50 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 transition-colors shadow-sm flex items-center gap-2"><Plus className="w-4 h-4"/>添加字段</button>
                        <button onClick={() => { setParserOpen(true); showToast('元数据解析器已开启'); }} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 rounded-lg text-sm font-semibold text-black transition-colors shadow-sm flex items-center gap-2"><Sparkles className="w-4 h-4"/>元数据解析导入</button>
                      </div>
                    </div>
                  )}

                  {parserOpen && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6 shrink-0 relative mt-2">
                      <button onClick={() => setParserOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      <h4 className="text-base font-semibold text-slate-900 mb-2">元数据解析器</h4>
                      <p className="text-sm text-slate-500 mb-4 pr-6">元数据解析器会读取数据集结构，并生成字段配置及其属性草稿。</p>
                      
                      <div className="flex gap-3 mb-4">
                        <button onClick={() => {
                           setParseStatus('loading');
                           setParseProgress(10);
                           setParseMessages(['正在连接数据源...', '正在读取 schema 信息...', '正在对表数据做高基、低基数字段特征抽样...']);
                           setTimeout(() => { setParseProgress(45); setParseMessages(prev => [...prev, '正在采样特征值分类，发现潜在低基数枚举字段...', '正在对中敏感、高敏感词特征进行安全标记...']); }, 1000);
                           setTimeout(() => { setParseProgress(75); setParseMessages(prev => [...prev, '已经生成字段属性推荐草稿...']); }, 2000);
                           setTimeout(() => { 
                             setParseProgress(100); 
                             setParseMessages(prev => [...prev, '解析完成，成功发现推荐字段属性和 3 项枚举映射候选！']); 
                             setParseStatus('success'); 

                             const candidates: Field[] = mockFields.map(m => {
                               const isEnumField = ['region_name', 'member_level', 'store_type'].includes(m.name.toLowerCase());
                               return {
                                 ...m,
                                 source: '解析结果',
                                 enumMappings: isEnumField ? (m.name.toLowerCase() === 'region_name' ? [
                                   {
                                     rawValue: '华东',
                                     displayValue: '华东',
                                     synonyms: ['东区', '华东区', 'East China'],
                                     enabled: true,
                                     description: '华东经营区域'
                                   },
                                   {
                                     rawValue: '华南',
                                     displayValue: '华南',
                                     synonyms: ['南区', '华南区', 'South China'],
                                     enabled: true,
                                     description: '华南经营区域'
                                   },
                                   {
                                     rawValue: '华北',
                                     displayValue: '华北',
                                     synonyms: ['北区', '华北区', 'North China'],
                                     enabled: true,
                                     description: '华北经营区域'
                                   }
                                 ] : (m.name.toLowerCase() === 'member_level' ? [
                                   {
                                     rawValue: '1',
                                     displayValue: '普通会员',
                                     synonyms: ['普通', '基础会员'],
                                     enabled: true,
                                     description: '基础会员等级'
                                   },
                                   {
                                     rawValue: '2',
                                     displayValue: '银卡会员',
                                     synonyms: ['银卡', '银牌会员'],
                                     enabled: true,
                                     description: '银卡会员等级'
                                   },
                                   {
                                     rawValue: '3',
                                     displayValue: '金卡会员',
                                     synonyms: ['金卡', '高价值会员'],
                                     enabled: true,
                                     description: '金卡会员等级'
                                   }
                                 ] : [
                                   {
                                     rawValue: '直营',
                                     displayValue: '直营店',
                                     synonyms: ['直营', '自营'],
                                     enabled: true,
                                     description: '品牌直营管理门店'
                                   },
                                   {
                                     rawValue: '加盟',
                                     displayValue: '加盟店',
                                     synonyms: ['联营', '合伙'],
                                     enabled: true,
                                     description: '加盟合伙商管理门店'
                                   }
                                 ])) : []
                               };
                             });
                             setParsedCandidates(candidates);
                             setFields(candidates);
                             showToast('元数据解析成功，已自动推荐并同步导入字段属性！');
                             setTimeout(() => {
                               setParserOpen(false);
                               setParseStatus('idle');
                             }, 1000);
                           }, 3000);
                        }} disabled={parseStatus === 'loading'} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                          {parseStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                          {parseStatus === 'idle' ? '开始解析' : parseStatus === 'loading' ? '解析中...' : '重新解析'}
                        </button>
                      </div>

                      {parseStatus !== 'idle' && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-4">
                          <div className="flex justify-between text-sm mb-2 font-medium">
                            <span className={parseStatus === 'success' ? 'text-green-600 font-semibold' : 'text-slate-700'}>{parseStatus === 'success' ? '解析成功' : '正在执行...'}</span>
                            <span className="font-mono text-slate-500">{parseProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 mb-4 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-300 ${parseStatus === 'success' ? 'bg-green-500' : 'bg-slate-800'}`} style={{ width: `${parseProgress}%` }}></div>
                          </div>
                          <div className="space-y-1.5 h-24 overflow-y-auto font-mono text-xs text-slate-500 bg-white rounded border border-slate-100 p-2 leading-relaxed">
                            {parseMessages.map((msg, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-slate-300">{`[00:00:0${i+1}]`}</span>
                                <span>{msg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 解析结果推荐候选表格 */}
                      {parseStatus === 'success' && parsedCandidates.length > 0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4 animate-in fade-in duration-300">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-emerald-500 fill-emerald-105" />
                              元数据解析候选字段 (共 {parsedCandidates.length} 个)
                            </h5>
                          </div>
                          
                          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto shadow-inner bg-slate-50/30">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-semibold select-none z-10 font-sans">
                                <tr>
                                  <th className="px-3 py-2">字段名</th>
                                  <th className="px-3 py-2">业务展示名</th>
                                  <th className="px-3 py-2">类型</th>
                                  <th className="px-3 py-2">角色</th>
                                  <th className="px-3 py-2">描述</th>
                                  <th className="px-3 py-2 text-center">低基数枚举项 (智能预测)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {parsedCandidates.map((c, idx) => {
                                  const isEnum = ['region_name', 'member_level', 'store_type'].includes(c.name.toLowerCase());
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-mono text-slate-700 font-medium">{c.name}</td>
                                      <td className="px-3 py-2 text-slate-600">{c.displayName}</td>
                                      <td className="px-3 py-2 font-mono text-slate-500">{c.type}</td>
                                      <td className="px-3 py-2 text-slate-500">{c.role}</td>
                                      <td className="px-3 py-2 text-slate-400 truncate max-w-[200px]" title={c.description}>{c.description || '-'}</td>
                                      <td className="px-3 py-2 text-center text-slate-600 font-semibold">
                                        {isEnum ? (
                                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 font-bold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            低基数：发现并提取 {c.name.toLowerCase() === 'store_type' ? '2' : '3'} 项默认映射
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(fields.length > 0 || parseStatus === 'success') && (
                    <div className="space-y-4 flex-1 flex flex-col min-w-0">
                      {/* 元数据极智批量治理与合规防线 */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-350">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="p-2.5 bg-yellow-100 text-yellow-800 rounded-xl border border-yellow-200 shrink-0">
                            <Shield className="w-5 h-5 fill-yellow-405/20" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-2">
                              元数据智能治理与合规防线
                              <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-400 text-black font-bold uppercase tracking-wider">AI & Governance</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">提供一键校验物理指标聚合类型安全、AI 敏感防漏自动标志、以及全局大批量字段极速配置工具。</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* 物理指标聚合纠偏推荐 */}
                          <button
                            type="button"
                            onClick={handleSmartCleanAggregations}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-yellow-400 hover:text-yellow-800 rounded-lg text-xs font-semibold text-slate-700 hover:bg-yellow-50/50 transition-all cursor-pointer shadow-sm"
                            title="根据物理字段类型，自动校验并剥离不兼容的度量函数（如文本型禁用Sum/Avg等），避免执行层抛出底层的SQL运行异常"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                            智能聚合核验
                          </button>

                          {/* AI 敏感自审上锁 */}
                          <button
                            type="button"
                            onClick={handleAutoAuditSensitivity}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-red-400 hover:text-red-800 rounded-lg text-xs font-semibold text-slate-700 hover:bg-red-50/20 transition-all cursor-pointer shadow-sm"
                            title="依据国家GDPR、个人保护等审计规则，对英文、展示名中的敏感标识（如电话、手机、资产、身份证、姓名）实现智能一键上锁防泄露"
                          >
                            <Lock className="w-3.5 h-3.5 text-red-500" />
                            AI 敏感防漏审计
                          </button>

                          <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden xl:block" />

                          {/* 批量快速设定 */}
                          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                            <span className="text-[10px] text-slate-400 font-bold px-1.5 uppercase select-none">极速指配:</span>
                            <button
                              type="button"
                              onClick={() => handleBatchToggleAttribute('queryable', true)}
                              className="px-2 py-1 hover:bg-slate-50 text-[11px] font-semibold text-slate-650 hover:text-slate-900 rounded cursor-pointer transition-colors"
                            >
                              全设可查
                            </button>
                            <span className="text-slate-200">|</span>
                            <button
                              type="button"
                              onClick={() => handleBatchToggleAttribute('filterable', true)}
                              className="px-2 py-1 hover:bg-slate-50 text-[11px] font-semibold text-slate-650 hover:text-slate-900 rounded cursor-pointer transition-colors"
                            >
                              全设可筛
                            </button>
                            <span className="text-slate-200">|</span>
                            <button
                              type="button"
                              onClick={() => handleBatchToggleAttribute('groupable', true)}
                              className="px-2 py-1 hover:bg-slate-50 text-[11px] font-semibold text-slate-650 hover:text-slate-900 rounded cursor-pointer transition-colors"
                            >
                              全设分组
                            </button>
                            {fields.some(f => f.source === '解析结果') && (
                              <>
                                <span className="text-slate-200">|</span>
                                <button
                                  type="button"
                                  onClick={handleBatchConfirmSource}
                                  className="px-2 py-1 hover:bg-emerald-50 text-[11px] font-semibold text-emerald-650 hover:text-emerald-800 rounded cursor-pointer transition-colors flex items-center gap-1"
                                  title="将所有未确认的元数据解析字段一键变更为「已确认」正式配置"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  一键审核
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm min-h-[400px]">
                        <div className="min-w-[1400px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
                          <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider font-sans">
                            <th className="px-4 py-3 w-44">字段名</th>
                            <th className="px-4 py-3 w-44">字段名称 (业务值)</th>
                            <th className="px-4 py-3 w-28">类型</th>
                            <th className="px-4 py-3 w-28">角色</th>
                            <th className="px-4 py-3 w-44">描述</th>
                            <th className="px-2 py-3 text-center">可查</th>
                            <th className="px-2 py-3 text-center">可筛</th>
                            <th className="px-2 py-3 text-center">分组</th>
                            <th className="px-4 py-3 w-[220px]">安全与脱敏策略</th>
                            <th className="px-4 py-3 w-[260px]">支持聚合方式</th>
                            <th className="px-4 py-3 text-center w-36">枚举预测与映射</th>
                            <th className="px-4 py-3 w-24">来源</th>
                            <th className="px-4 py-3 w-16 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {fields.map((f, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 group">
                              <td className="px-4 py-2"><input value={f.name || ''} onChange={e => {updateField(i, 'name', e.target.value); updateField(i, 'source', '已人工修改');}} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-yellow-400 focus:bg-white rounded px-2 py-1.5 text-sm font-mono text-slate-700 outline-none transition-colors" placeholder="英文标识名" /></td>
                              <td className="px-4 py-2"><input value={f.displayName || ''} onChange={e => {updateField(i, 'displayName', e.target.value); updateField(i, 'source', '已人工修改');}} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-yellow-400 focus:bg-white rounded px-2 py-1.5 text-sm text-slate-800 font-semibold outline-none transition-colors" placeholder="显示名称" /></td>
                              <td className="px-4 py-2">
                                <select value={f.type} onChange={e => {updateField(i, 'type', e.target.value); updateField(i, 'source', '已人工修改');}} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-yellow-400 focus:bg-white rounded px-2 py-1.5 text-sm text-slate-600 outline-none transition-colors cursor-pointer capitalize">
                                  <option value="string">string</option>
                                  <option value="varchar">varchar</option>
                                  <option value="char">char</option>
                                  <option value="int">int</option>
                                  <option value="bigint">bigint</option>
                                  <option value="decimal">decimal</option>
                                  <option value="double">double</option>
                                  <option value="float">float</option>
                                  <option value="date">date</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <select value={f.role} onChange={e => {updateField(i, 'role', e.target.value); updateField(i, 'source', '已人工修改');}} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-yellow-400 focus:bg-white rounded px-2 py-1.5 text-sm text-slate-600 outline-none transition-colors cursor-pointer">
                                  <option value="ID">ID</option><option value="时间">时间</option><option value="维度">维度</option><option value="度量">度量</option><option value="属性">属性</option>
                                </select>
                              </td>
                              <td className="px-4 py-2"><input title={f.description} value={f.description} onChange={e => {updateField(i, 'description', e.target.value); updateField(i, 'source', '已人工修改');}} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-yellow-400 focus:bg-white rounded px-2 py-1.5 text-xs text-slate-500 outline-none transition-colors" placeholder="补充释义..." /></td>
                               <td className="px-2 py-2 text-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={f.queryable ?? false} 
                                    onChange={() => {
                                      updateField(i, 'queryable', !f.queryable);
                                      updateField(i, 'source', '已人工修改');
                                      showToast(`${!f.queryable ? '✓ 已开启' : '✓ 已关闭'} 字段【${f.name || '草稿'}】的可查询属性`);
                                    }}
                                    className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer"
                                  />
                                  <span className={`text-xs font-semibold ${f.queryable ? 'text-emerald-750' : 'text-slate-400'}`}>
                                    {f.queryable ? '可查' : '不查'}
                                  </span>
                                </label>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={f.filterable ?? false} 
                                    onChange={() => {
                                      updateField(i, 'filterable', !f.filterable);
                                      updateField(i, 'source', '已人工修改');
                                      showToast(`${!f.filterable ? '✓ 已开启' : '✓ 已关闭'} 字段【${f.name || '草稿'}】的可筛选属性`);
                                    }}
                                    className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer"
                                  />
                                  <span className={`text-xs font-semibold ${f.filterable ? 'text-emerald-750' : 'text-slate-400'}`}>
                                    {f.filterable ? '可筛' : '不筛'}
                                  </span>
                                </label>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={f.groupable ?? false} 
                                    onChange={() => {
                                      updateField(i, 'groupable', !f.groupable);
                                      updateField(i, 'source', '已人工修改');
                                      showToast(`${!f.groupable ? '✓ 已开启' : '✓ 已关闭'} 字段【${f.name || '草稿'}】的可分组属性`);
                                    }}
                                    className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer"
                                  />
                                  <span className={`text-xs font-semibold ${f.groupable ? 'text-emerald-750' : 'text-slate-400'}`}>
                                    {f.groupable ? '分组' : '不组'}
                                  </span>
                                </label>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center">
                                  <select 
                                    value={f.maskingRule && f.maskingRule !== 'none' ? f.maskingRule : (f.sensitive ? 'custom_mask' : 'none')} 
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === 'none') {
                                        updateField(i, 'sensitive', false);
                                        updateField(i, 'maskingRule', 'none');
                                        showToast(`✓ 已将字段【${f.displayName || f.name}】设为 [公开] 并清除脱敏限制`);
                                      } else {
                                        updateField(i, 'sensitive', true);
                                        updateField(i, 'maskingRule', val);
                                        const ruleLabel = {
                                          mask_phone: '手机号掩码',
                                          mask_name: '中文姓名掩码',
                                          mask_id: '证件号掩码',
                                          mask_email: '电子邮箱掩码',
                                          hash: '哈希单向签名'
                                        }[val] || val;
                                        showToast(`⚠️ 已将字段【${f.displayName || f.name}】设为 [高敏]，并自动强制绑定脱敏处理规则 [${ruleLabel}]`);
                                      }
                                      updateField(i, 'source', '已人工修改');
                                    }} 
                                    className={`w-full bg-white border rounded px-1.5 py-1 text-xs font-semibold outline-none transition-all cursor-pointer ${
                                      f.sensitive || (f.maskingRule && f.maskingRule !== 'none')
                                        ? 'bg-rose-50/50 border-rose-200 text-rose-700 hover:border-rose-350 focus:border-rose-450' 
                                        : 'bg-emerald-50/40 border-emerald-200 text-emerald-700 hover:border-emerald-355 focus:border-emerald-450'
                                    }`}
                                  >
                                    <option value="none">🌐 公开 (安全)</option>
                                    <option value="mask_phone">📞 敏感: 手机号掩码</option>
                                    <option value="mask_name">👤 敏感: 姓名掩码</option>
                                    <option value="mask_id">🪪 敏感: 证件号掩码</option>
                                    <option value="mask_email">✉️ 敏感: 电子邮箱掩码</option>
                                    <option value="hash">🔒 敏感: 哈希单向脱敏</option>
                                  </select>
                                </div>
                              </td>
                               <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {['sum', 'avg', 'count', 'count_distinct', 'min', 'max'].map(agg => {
                                    const isSelected = f.aggregationsSupported && f.aggregationsSupported.includes(agg);
                                    const isNumericField = ['int', 'bigint', 'decimal', 'double', 'float'].includes((f.type || '').toLowerCase());
                                    const isNumericAgg = ['sum', 'avg'].includes(agg);
                                    const isAllowed = !isNumericAgg || isNumericField;
                                    return (
                                      <button
                                        type="button"
                                        key={agg}
                                        disabled={!isAllowed}
                                        onClick={(e) => {
                                          if (!isAllowed) return;
                                          e.stopPropagation();
                                          const current = f.aggregationsSupported || [];
                                          const next = isSelected ? current.filter(a => a !== agg) : [...current, agg];
                                          updateField(i, 'aggregationsSupported', next);
                                          updateField(i, 'source', '已人工修改');
                                        }}
                                        title={!isAllowed ? `非数值类型字段 [${f.type}] 不支持聚合函数 ${agg}` : `支持 ${agg} 聚合查询`}
                                        className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer shadow-sm border ${
                                          isSelected && isAllowed
                                            ? 'bg-yellow-400 text-black border-yellow-500 shadow-yellow-100/50 hover:bg-yellow-500' 
                                            : !isAllowed
                                              ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through opacity-60'
                                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        {agg}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center whitespace-nowrap">
                                {!supportsEnumMapping(f.type) ? (
                                  <span className="text-slate-400 text-xs">不支持</span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    {f.enumMappings && f.enumMappings.length > 0 ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                        已配置 {f.enumMappings.length} 项
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-101 text-slate-500 border border-slate-200">
                                        未配置
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openEnumMappingModal(f, i)}
                                      className="font-bold text-yellow-600 hover:text-yellow-700 hover:underline px-1.5 py-1 text-xs cursor-pointer"
                                    >
                                      配置
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                 <span className={`inline-flex border px-2 py-0.5 rounded text-xs font-medium ${f.source === '解析结果' ? 'bg-slate-100 text-slate-500 border-slate-200' : f.source === '已人工修改' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : f.source === '已确认' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                   {f.source || '人工配置'}
                                 </span>
                              </td>
                              <td className="px-4 py-2 text-center text-slate-400 hover:text-red-500 cursor-pointer" onClick={() => removeField(i)}>
                                 <Trash2 className="w-4 h-4 mx-auto" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}
                </div>
              )}

              {/* 权限管理 Tab */}
              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  {/* Global Toggle Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-yellow-50 rounded-lg text-yellow-600">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">数据集防泄露与权限治理</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            配置表级、字段列级脱敏与行级过滤(RLS)，防止高敏感字段及未授权数据通过 MCP 接口溢出。
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500">
                          安全验证状态: {selectedDataset.permissionPolicy?.enabled ? (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-250">
                              已启用
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded border border-slate-150">
                              未开启安全防护 (全局公开)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = selectedDataset.permissionPolicy || {
                              tableAccess: { mode: 'public', principals: [] },
                              fieldAccess: [],
                              rowAccess: []
                            };
                            const isCurrentlyEnabled = !!selectedDataset.permissionPolicy?.enabled;
                            const nextEnabled = !isCurrentlyEnabled;
                            
                            // Initialize fieldAccess with default entries if empty
                            let nextFieldAccess = current.fieldAccess || [];
                            if (nextFieldAccess.length === 0) {
                              nextFieldAccess = fields.map(f => ({
                                fieldName: f.name,
                                defaultVisible: true,
                                defaultQueryable: f.queryable !== false,
                                maskingRule: f.sensitive ? 'phone_mask' : 'none',
                                restrictedPrincipals: []
                              }));
                            }
                            
                            // Initialize rowAccess with default entries if empty
                            let nextRowAccess = current.rowAccess || [];
                            if (nextRowAccess.length === 0) {
                              nextRowAccess = [
                                {
                                  ruleName: '区域经理查看本区域销售数据',
                                  principals: ['regional_manager'],
                                  field: 'region_name',
                                  operator: '=',
                                  value: ':caller_region',
                                  enabled: true
                                },
                                {
                                  ruleName: '门店店长查看本物理门店',
                                  principals: ['store_manager'],
                                  field: 'store_id',
                                  operator: '=',
                                  value: ':caller_store',
                                  enabled: true
                                }
                              ];
                            }

                            const updatedPolicy = {
                              enabled: nextEnabled,
                              tableAccess: current.tableAccess || { mode: 'public', principals: [] },
                              fieldAccess: nextFieldAccess,
                              rowAccess: nextRowAccess
                            };
                            updateSelectedDs({ permissionPolicy: updatedPolicy });
                            showToast(`${nextEnabled ? '✓ 已激活安全治理模块' : '✓ 已暂停安全治理策略'}`);
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border outline-none cursor-pointer ${
                            selectedDataset.permissionPolicy?.enabled
                              ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                              : 'bg-yellow-400 hover:bg-yellow-500 text-black border-transparent shadow-sm'
                          }`}
                        >
                          {selectedDataset.permissionPolicy?.enabled ? '暂停策略服务' : '启用控制策略'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {!selectedDataset.permissionPolicy?.enabled ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 border-dashed text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-400">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-800 text-sm mb-2">安全治理功能处于公开访问模式</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                        当前数据集未添加任何访问限制。所有通过 MCP 发起的查询请求都拥有对该表、所有字段、全部行数据的完整只读访问权限。
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Section 1: Table-Level Access */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span className="w-1 h-3.5 bg-yellow-400 rounded-full"></span>
                            1. 数据表级可访问控制 (Table-Level Access)
                          </h4>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">TABLE_POLICY</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'public', label: '公开可访问', desc: '任何 MCP Client 或 AI 宿主均可查阅和利用此表' },
                            { value: 'specified', label: '仅限指定业务角色', desc: '仅允许满足以下调用身份凭证的人员/应用访问' },
                            { value: 'forbidden', label: '完全禁止任意调用', desc: '全局熔断此表查询，常用于临时应急隔离' }
                          ].map(opt => {
                            const currentMode = selectedDataset.permissionPolicy?.tableAccess?.mode || 'public';
                            const isChosen = currentMode === opt.value;
                            return (
                              <button
                                type="button"
                                key={opt.value}
                                onClick={() => {
                                  const current = selectedDataset.permissionPolicy || {
                                    enabled: true,
                                    tableAccess: { mode: 'public', principals: [] },
                                    fieldAccess: [],
                                    rowAccess: []
                                  };
                                  const updatedPolicy = {
                                    ...current,
                                    tableAccess: {
                                      ...current.tableAccess,
                                      mode: opt.value as any
                                    }
                                  };
                                  updateSelectedDs({ permissionPolicy: updatedPolicy });
                                  showToast(`表级控制切换为：${opt.label}`);
                                }}
                                className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                                  isChosen 
                                    ? 'bg-yellow-50/40 border-yellow-400 shadow-sm' 
                                    : 'border-slate-200 hover:border-slate-305 bg-white'
                                }`}
                              >
                                <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                                  <span className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${isChosen ? 'border-yellow-500 bg-yellow-400 text-black' : 'border-slate-300 bg-white'}`}>
                                    {isChosen && <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                  </span>
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">{opt.desc}</div>
                              </button>
                            );
                          })}
                        </div>

                        {selectedDataset.permissionPolicy?.tableAccess?.mode === 'specified' && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 animate-in fade-in duration-200">
                            <div>
                              <label className="block text-xs font-bold text-slate-705 mb-1.5">可授权在位业务角色 (Table Principals)</label>
                              <div className="flex flex-wrap gap-1.5 mb-2.5">
                                {(selectedDataset.permissionPolicy?.tableAccess?.principals || []).map((p, pIdx) => (
                                  <span key={pIdx} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-md shadow-sm">
                                    <code>{p}</code>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const current = selectedDataset.permissionPolicy!;
                                        const rest = (current.tableAccess.principals || []).filter((_, idx) => idx !== pIdx);
                                        const updatedPolicy = {
                                          ...current,
                                          tableAccess: { ...current.tableAccess, principals: rest }
                                        };
                                        updateSelectedDs({ permissionPolicy: updatedPolicy });
                                      }}
                                      className="text-slate-450 hover:text-red-505 ml-0.5 outline-none font-bold"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                {(selectedDataset.permissionPolicy?.tableAccess?.principals || []).length === 0 && (
                                  <span className="text-xs text-red-500 font-medium">⚠️ 请添加至少一个授权角色（Role），否则此表无任何人或服务可以访问</span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  id="new-table-principal-input"
                                  placeholder="输入应用标识或业务角色，如 brand_manager..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const current = selectedDataset.permissionPolicy!;
                                        const prs = current.tableAccess.principals || [];
                                        if (!prs.includes(val)) {
                                          const updatedPolicy = {
                                            ...current,
                                            tableAccess: { ...current.tableAccess, principals: [...prs, val] }
                                          };
                                          updateSelectedDs({ permissionPolicy: updatedPolicy });
                                          (e.target as HTMLInputElement).value = '';
                                        } else {
                                          showToast('该角色已添加');
                                        }
                                      }
                                    }
                                  }}
                                  className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400 flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById('new-table-principal-input') as HTMLInputElement;
                                    const val = el?.value.trim();
                                    if (val) {
                                      const current = selectedDataset.permissionPolicy!;
                                      const prs = current.tableAccess.principals || [];
                                      if (!prs.includes(val)) {
                                        const updatedPolicy = {
                                          ...current,
                                          tableAccess: { ...current.tableAccess, principals: [...prs, val] }
                                        };
                                        updateSelectedDs({ permissionPolicy: updatedPolicy });
                                        el.value = '';
                                      } else {
                                        showToast('该角色已添加');
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-semibold rounded-lg transition-colors"
                                >
                                  添加
                                </button>
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold mb-1">一键选用推荐的角色模板:</div>
                              <div className="flex flex-wrap gap-1.5">
                                {['regional_manager', 'store_manager', 'bi_dashboard_app', 'marketing_agent'].map(r => {
                                  const prs = selectedDataset.permissionPolicy?.tableAccess?.principals || [];
                                  const alreadyHas = prs.includes(r);
                                  return (
                                    <button
                                      type="button"
                                      key={r}
                                      disabled={alreadyHas}
                                      onClick={() => {
                                        const current = selectedDataset.permissionPolicy!;
                                        const updatedPolicy = {
                                          ...current,
                                          tableAccess: { ...current.tableAccess, principals: [...prs, r] }
                                        };
                                        updateSelectedDs({ permissionPolicy: updatedPolicy });
                                        showToast(`已快捷添加角色 ${r}`);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                                        alreadyHas 
                                          ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300 animate-in'
                                      }`}
                                    >
                                      + {r}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Section 2: Field-Level Access & Masking */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span className="w-1 h-3.5 bg-yellow-400 rounded-full"></span>
                            2. 字段/列级隐私与高级脱敏 (Field-Level Permissions & Masking)
                          </h4>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">FIELD_POLICY</span>
                        </div>
                        
                        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[340px] overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600 z-10 font-sans">
                              <tr>
                                <th className="px-3.5 py-2.5 w-1/4">字段信息</th>
                                <th className="px-2 py-2.5 text-center">默认可见</th>
                                <th className="px-2 py-2.5 text-center">默认可查</th>
                                <th className="px-4 py-2.5 w-44">脱敏治理策略 (脱敏格式)</th>
                                <th className="px-4 py-2.5">受限访问角色(限制访问此字段的角色列表)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {fields.map((f, fIdx) => {
                                // Find or create policy entry for this field name
                                const pList = selectedDataset.permissionPolicy?.fieldAccess || [];
                                let fp = pList.find(x => x.fieldName === f.name);
                                if (!fp) {
                                  fp = {
                                    fieldName: f.name,
                                    defaultVisible: true,
                                    defaultQueryable: f.queryable !== false,
                                    maskingRule: f.sensitive ? 'phone_mask' : 'none',
                                    restrictedPrincipals: []
                                  };
                                }
                                
                                const updateFp = (key: keyof FieldAccessPolicy, val: any) => {
                                  const currentPolicy = selectedDataset.permissionPolicy!;
                                  let nextAccessList = [...(currentPolicy.fieldAccess || [])];
                                  const extIdx = nextAccessList.findIndex(x => x.fieldName === f.name);
                                  
                                  const updatedEntry = { ...fp!, [key]: val };
                                  if (extIdx >= 0) {
                                    nextAccessList[extIdx] = updatedEntry;
                                  } else {
                                    nextAccessList.push(updatedEntry);
                                  }
                                  
                                  updateSelectedDs({
                                    permissionPolicy: {
                                      ...currentPolicy,
                                      fieldAccess: nextAccessList
                                    }
                                  });
                                };

                                return (
                                  <tr key={fIdx} className="hover:bg-slate-50/50">
                                    <td className="px-3.5 py-2.5">
                                      <div className="font-semibold text-slate-800 text-[13px] flex items-center gap-1.5">
                                        <code className="font-mono">{f.name}</code>
                                        {f.sensitive && (
                                          <span className="bg-orange-50 text-orange-700 text-[9px] px-1 py-0.5 rounded border border-orange-200 font-bold">
                                            敏感
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">{f.displayName || f.description || '暂无业务别名'}</div>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => updateFp('defaultVisible', !fp?.defaultVisible)}
                                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors border ${fp?.defaultVisible ? 'bg-emerald-50 text-emerald-800 border bg-emerald-100/10' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                      >
                                        {fp?.defaultVisible ? '可见' : '屏蔽'}
                                      </button>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => updateFp('defaultQueryable', !fp?.defaultQueryable)}
                                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors border ${fp?.defaultQueryable ? 'bg-emerald-50 text-emerald-800 border bg-emerald-100/10' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                                      >
                                        {fp?.defaultQueryable ? '可查' : '拒查'}
                                      </button>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <select
                                        value={fp?.maskingRule || 'none'}
                                        onChange={e => {
                                          updateFp('maskingRule', e.target.value);
                                          if (e.target.value !== 'none') {
                                            showToast(`已为 ${f.name} 字段选择脱敏规则: ${e.target.value}`);
                                          }
                                        }}
                                        className={`w-full text-[11px] bg-white border rounded p-1 outline-none font-sans cursor-pointer focus:ring-1 focus:ring-yellow-400 ${
                                          fp?.maskingRule && fp.maskingRule !== 'none' 
                                            ? 'border-orange-300 bg-orange-50/20 text-orange-850 font-bold' 
                                            : 'border-slate-200 text-slate-700'
                                        }`}
                                      >
                                        <option value="none">明文提供 (无脱敏)</option>
                                        <option value="phone_mask">手机号掩码 (如 138****8888)</option>
                                        <option value="email_mask">邮箱脱敏 (如 g***d@google.com)</option>
                                        <option value="id_mask">ID 隐藏 (前6后4字符, 其它掩码)</option>
                                        <option value="name_mask">中文姓名脱敏 (张*、李*贤)</option>
                                        <option value="custom_mask">完全混淆 Hash (sha256掩置)</option>
                                      </select>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex flex-wrap gap-1 items-center">
                                        {(fp?.restrictedPrincipals || []).map((r, rIdx) => (
                                          <span key={rIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-slate-50 border border-slate-200 text-[10px] text-slate-600 rounded">
                                            <code>{r}</code>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const rest = (fp!.restrictedPrincipals || []).filter((_, i) => i !== rIdx);
                                                updateFp('restrictedPrincipals', rest);
                                              }}
                                              className="text-slate-400 hover:text-red-500 font-bold outline-none ml-0.5 text-xs cursor-pointer"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        ))}
                                        <input
                                          type="text"
                                          placeholder="+ 按回车限制角色"
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              const val = (e.target as HTMLInputElement).value.trim();
                                              if (val) {
                                                const prs = fp!.restrictedPrincipals || [];
                                                if (!prs.includes(val)) {
                                                  updateFp('restrictedPrincipals', [...prs, val]);
                                                  (e.target as HTMLInputElement).value = '';
                                                }
                                              }
                                            }
                                          }}
                                          className="text-[10px] bg-transparent border-dashed border-b border-slate-300 outline-none w-28 focus:border-yellow-450 focus:bg-white px-1"
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Section 3: Row-Level Permissions */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              <span className="w-1 h-3.5 bg-yellow-400 rounded-full"></span>
                              3. 运行时行级数据过滤控制 (Row-Level Permission Management)
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1 pl-3 leading-normal">
                              注入运行时数据过滤器以限制不同业务角色（Role）的数据行可见范围。例如：华东区经理角色只能查看 <code>region_name = '华东'</code> 的行数据。
                            </p>
                          </div>
                          <span className="text-[10px] bg-slate-150 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">ROW_POLICY (RLS)</span>
                        </div>

                        <div className="space-y-3.5">
                          {(selectedDataset.permissionPolicy?.rowAccess || []).map((rowRule, rIdx) => {
                            const updateRule = (key: keyof RowAccessPolicy, val: any) => {
                              const currentPolicy = selectedDataset.permissionPolicy!;
                              const nextRows = (currentPolicy.rowAccess || []).map((rule, idx) => 
                                idx === rIdx ? { ...rule, [key]: val } : rule
                              );
                              updateSelectedDs({
                                permissionPolicy: {
                                  ...currentPolicy,
                                  rowAccess: nextRows
                                }
                              });
                            };

                            const removeRule = () => {
                              const currentPolicy = selectedDataset.permissionPolicy!;
                              const nextRows = (currentPolicy.rowAccess || []).filter((_, idx) => idx !== rIdx);
                              updateSelectedDs({
                                permissionPolicy: {
                                  ...currentPolicy,
                                  rowAccess: nextRows
                                }
                              });
                              showToast(`已删除行过滤规则: ${rowRule.ruleName}`);
                            };

                            return (
                              <div key={rIdx} className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 relative group animate-in zoom-in-95 duration-200">
                                <div className="absolute top-4 right-4 flex items-center gap-2 bg-transparent z-10">
                                  <button
                                    type="button"
                                    onClick={() => updateRule('enabled', !rowRule.enabled)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border cursor-pointer transition-all ${
                                      rowRule.enabled 
                                        ? 'bg-green-50 text-green-800 border-green-200 shadow-sm shadow-green-50/20' 
                                        : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/50'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${rowRule.enabled ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                    {rowRule.enabled ? '已启用策略' : '已禁用策略'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={removeRule}
                                    title="删除此行过滤规则"
                                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 ml-1 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                                  <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">规则策略名称</label>
                                    <input
                                      type="text"
                                      value={rowRule.ruleName}
                                      onChange={e => updateRule('ruleName', e.target.value)}
                                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400"
                                      placeholder="例如：区域经理辖区限制..."
                                    />
                                  </div>

                                  <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                      绑定适用角色 (Principals)
                                    </label>
                                    <div className="flex flex-wrap gap-1 border border-slate-200 rounded-lg p-1.5 min-h-[34px] bg-white">
                                      {(rowRule.principals || []).map((p, pIdx) => (
                                        <span key={pIdx} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-yellow-50 border border-yellow-250 text-[10px] font-bold text-yellow-800 rounded">
                                          <code>{p}</code>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const rest = (rowRule.principals || []).filter((_, idx) => idx !== pIdx);
                                              updateRule('principals', rest);
                                            }}
                                            className="text-yellow-600 hover:text-red-500 ml-0.5 font-bold outline-none text-xs cursor-pointer"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                      <input
                                        type="text"
                                        placeholder="+ 按回车绑定关联角色"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (val) {
                                              const prs = rowRule.principals || [];
                                              if (!prs.includes(val)) {
                                                updateRule('principals', [...prs, val]);
                                                (e.target as HTMLInputElement).value = '';
                                              }
                                            }
                                          }
                                        }}
                                        className="text-[10px] bg-transparent outline-none flex-1 min-w-[120px] px-1"
                                      />
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                      运行时注入数据过滤器
                                      <span className="text-[10px] text-slate-400 font-normal">(运行时执行: SELECT * FROM table WHERE [过滤规则])</span>
                                    </label>
                                    <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 p-3 rounded-lg">
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-[11px] font-mono select-none">字段名</span>
                                        <select
                                          value={rowRule.field}
                                          onChange={e => updateRule('field', e.target.value)}
                                          className="text-xs bg-slate-50 border border-slate-200 rounded p-1 font-mono cursor-pointer outline-none focus:ring-1 focus:ring-yellow-400 text-slate-800"
                                        >
                                          {fields.map(f => (
                                            <option key={f.name} value={f.name}>{f.name} ({f.displayName || f.description || '无名'})</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-[11px] font-mono select-none">操作符</span>
                                        <select
                                          value={rowRule.operator}
                                          onChange={e => updateRule('operator', e.target.value)}
                                          className="text-xs bg-slate-50 border border-slate-200 rounded p-1 font-bold font-mono cursor-pointer outline-none focus:ring-1 focus:ring-yellow-400 text-yellow-700"
                                        >
                                          <option value="=">=</option>
                                          <option value="in">IN</option>
                                          <option value="!=">!=</option>
                                          <option value="not in">NOT IN</option>
                                          <option value="like">LIKE</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                        <span className="text-slate-400 text-[11px] font-mono select-none">注入表达式/值</span>
                                        <input
                                          type="text"
                                          value={rowRule.value}
                                          onChange={e => updateRule('value', e.target.value)}
                                          className="text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded p-1 font-mono flex-1 outline-none text-slate-850"
                                          placeholder="参数(如 :caller_region )或固定值(如 '华东')"
                                        />
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1.5 pl-1 leading-normal">
                                      * 表达式前缀为 <code>:</code> (冒号) 代表运行时自动获取 MCP Client 或 Caller 身份上下文中的环境变量值 (如 <code>:caller_store</code> / <code>:caller_region</code> / <code>:caller_dept</code>)。
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {(selectedDataset.permissionPolicy?.rowAccess || []).length === 0 && (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-150 text-slate-405 text-xs">
                              尚未添加任何行过滤规则。
                            </div>
                          )}

                          <div className="flex justify-start">
                            <button
                              type="button"
                              onClick={() => {
                                const currentPolicy = selectedDataset.permissionPolicy!;
                                const prevRuleList = currentPolicy.rowAccess || [];
                                const newRule: RowAccessPolicy = {
                                  ruleName: `新建行级过滤规则 #${prevRuleList.length + 1}`,
                                  principals: ['store_manager'],
                                  field: fields[0]?.name || 'store_id',
                                  operator: '=',
                                  value: ':caller_store',
                                  enabled: true
                                };
                                updateSelectedDs({
                                  permissionPolicy: {
                                    ...currentPolicy,
                                    rowAccess: [...prevRuleList, newRule]
                                  }
                                });
                                showToast('✓ 新增行过滤规则：请配置绑定的关联角色、检测字段以及过滤注入表达式');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-yellow-400 bg-white hover:bg-yellow-50/25 text-slate-600 hover:text-yellow-700 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              新增行级过滤规则 (RLS)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Save Actions */}
                      <div className="pt-4 border-t border-slate-150 flex justify-start">
                        <button
                          type="button"
                          onClick={() => {
                            // Persist to context datasets list
                            setDatasets(datasets.map(d => d.id === selectedDataset.id ? selectedDataset : d));
                            showToast('✓ 表/字段/行级三级权限控制策略已全量保存并写入配置中心');
                          }}
                          className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          保存权限管理治理策略
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'query' && (
                <div className="space-y-6 max-w-2xl">
                  {!selectedDataset.queryPolicyConfigured && (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 border-dashed text-center mb-6">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Settings className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-2">当前数据集尚未配置查询策略</h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">请设置默认返回行数、最大返回行数、时间过滤等规则，以控制模型的查询范围。</p>
                      <button onClick={() => updateSelectedDs({ queryPolicyConfigured: true, defaultLimit: null, maxLimit: null, allowUnlimitedReturn: true, requireTimeFilter: false, timeField: '', allowDetailQuery: true, allowAggregateQuery: true, allowSensitiveQuery: false })} className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 rounded-lg text-sm font-semibold text-black transition-colors shadow-sm">开始配置策略</button>
                    </div>
                  )}
                  {selectedDataset.queryPolicyConfigured && (
                    <>
                    <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-5 shadow-sm">
                      {/* 限制返回行数控制 */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!selectedDataset.allowUnlimitedReturn} 
                            onChange={e => {
                              const isChecked = e.target.checked;
                              updateSelectedDs({
                                allowUnlimitedReturn: !isChecked,
                                defaultLimit: isChecked ? 100 : null,
                                maxLimit: isChecked ? 1000 : null
                              });
                            }} 
                            className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer" 
                          />
                          <div className="text-sm font-semibold text-slate-800">启用限制查询返回行数限制 (推荐：可预防特大数据量慢查询)</div>
                        </label>
                        
                        {!selectedDataset.allowUnlimitedReturn ? (
                          <div className="grid grid-cols-2 gap-4 mt-3 pl-7 animate-in slide-in-from-top-2 duration-150">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">默认返回行数 (Limit)</label>
                              <input 
                                type="number" 
                                value={selectedDataset.defaultLimit ?? ''} 
                                onChange={e => {
                                  const val = e.target.value ? parseInt(e.target.value) : null;
                                  updateSelectedDs({defaultLimit: val});
                                }} 
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400" 
                                placeholder="例如: 100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">最大返回行数 (Max Limit)</label>
                              <input 
                                type="number" 
                                value={selectedDataset.maxLimit ?? ''} 
                                onChange={e => {
                                  const val = e.target.value ? parseInt(e.target.value) : null;
                                  updateSelectedDs({maxLimit: val});
                                }} 
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400" 
                                placeholder="例如: 1000"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 pl-7 text-xs text-slate-500 bg-slate-50 border border-slate-150 p-2.5 rounded-lg flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            <span>未限制返回本地保护：当前采用全量返回策略。若 AI 检索在单次查询中匹配大规模结果集，将全量读取和返回给模型。</span>
                          </div>
                        )}
                      </div>
                      
                      <hr className="border-slate-100" />
                      
                      {/* 时间轴标记过滤 */}
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedDataset.requireTimeFilter ?? false} 
                            onChange={e => {
                              const isChecked = e.target.checked;
                              updateSelectedDs({
                                requireTimeFilter: isChecked,
                                timeField: isChecked ? 'biz_date' : ''
                              });
                            }} 
                            className="mt-0.5 w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer" 
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-800">启用时间字段强制过滤 (Time Filter Requirement)</div>
                            <div className="text-xs text-slate-500 mt-0.5">强制 Agent 查询时提供具体的时间周期范围，防止大历史慢查询。</div>
                          </div>
                        </label>
                        
                        {selectedDataset.requireTimeFilter ? (
                          <div className="pl-7 mt-3 animate-in slide-in-from-top-2 duration-150">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">时间轴标记字段</label>
                            <select 
                              value={selectedDataset.timeField || ''} 
                              onChange={e => updateSelectedDs({timeField: e.target.value})} 
                              className="w-64 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-1 focus:ring-yellow-400 bg-white"
                            >
                              <option value="">请选择作为时间轴过滤的字段...</option>
                              <option value="biz_date">biz_date (营业日期)</option>
                              <option value="create_time">create_time (创建时间)</option>
                              <option value="update_time">update_time (更新时间)</option>
                            </select>
                          </div>
                        ) : (
                          <div className="mt-2 pl-7 text-xs text-slate-550 bg-slate-50 border border-slate-150 p-2.5 rounded-lg flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>未配置时间过滤：模型允许执行跨历史多周期的不限时间大范围明细查询。</span>
                          </div>
                        )}
                      </div>
                      
                      <hr className="border-slate-100" />
                      
                      {/* 查询模式控制 */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={selectedDataset.allowDetailQuery ?? true} onChange={e => updateSelectedDs({allowDetailQuery: e.target.checked})} className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer" />
                          <div className="text-sm font-semibold text-slate-800">允许大模型查询明细 (Select Detail)</div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={selectedDataset.allowAggregateQuery ?? true} onChange={e => updateSelectedDs({allowAggregateQuery: e.target.checked})} className="w-4 h-4 text-yellow-500 border-slate-300 rounded focus:ring-yellow-500 cursor-pointer" />
                          <div className="text-sm font-semibold text-slate-800">允许进行分组和物理聚合运算 (Group & Aggregate)</div>
                        </label>
                        <hr className="border-slate-100" />
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={selectedDataset.allowSensitiveQuery ?? false} onChange={e => updateSelectedDs({allowSensitiveQuery: e.target.checked})} className="w-4 h-4 text-rose-500 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" />
                          <div className="text-sm font-semibold text-rose-600">特权：允许进行敏感信息列（已应用脱敏算法除外）的穿透检索</div>
                        </label>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button onClick={saveQueryPolicy} className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer flex items-center gap-2 font-sans">
                        <Save className="w-4 h-4" />
                        保存配置策略
                      </button>
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {newModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-900">新增数据集</h3>
                <p className="text-xs text-slate-500 mt-1">请选择数据源和数据库表，系统会基于表信息生成数据集配置草稿。</p>
              </div>
              <button onClick={() => setNewModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Group 1: Connection */}
              <div className="space-y-4 border-b border-slate-100 pb-6">
                <h4 className="text-sm font-bold text-slate-900">1. 选择数据源和库表</h4>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">数据源</label>
                   <select value={newDs.sourceId} onChange={e => setNewDs({...newDs, sourceId: e.target.value, databaseName: '', tableName: '', datasetName: '', description: ''})} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 bg-white">
                     <option value="">请选择数据源...</option>
                     {dataSources.map(s => (
                       <option key={s.sourceId} value={s.sourceId}>{s.sourceName}</option>
                     ))}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">数据库</label>
                   <select disabled={!newDs.sourceId} value={newDs.databaseName} onChange={e => setNewDs({...newDs, databaseName: e.target.value, tableName: '', datasetName: '', description: ''})} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 bg-white disabled:bg-slate-50 disabled:text-slate-400">
                     <option value="">请选择数据库...</option>
                     {currentDatabases.map(db => (
                       <option key={db.name} value={db.name}>{db.name}</option>
                     ))}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">表名</label>
                   <select disabled={!newDs.databaseName} value={newDs.tableName} onChange={e => handleTableChange(e.target.value)} className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 bg-white disabled:bg-slate-50 disabled:text-slate-400">
                     <option value="">请选择数据表...</option>
                     {currentTables.map(t => (
                       <option key={t.name} value={t.name}>{t.name}</option>
                     ))}
                   </select>
                </div>
              </div>

              {/* Group 2: Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900">2. 数据集基础信息</h4>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">数据集名称</label>
                   <input type="text" value={newDs.datasetName} onChange={e => setNewDs({...newDs, datasetName: e.target.value})} placeholder="例如: 门店日销售数据集" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">所属主题</label>
                   <select value={newDs.topicId} onChange={e => setNewDs({...newDs, topicId: e.target.value})} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 bg-white">
                     {topics.map(t => (
                       <option key={t.id} value={t.id}>{t.name}</option>
                     ))}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">描述</label>
                   <textarea value={newDs.description} onChange={e => setNewDs({...newDs, description: e.target.value})} rows={3} placeholder="简要描述该数据集的用途..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 resize-none"></textarea>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setNewModalOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 border border-slate-200 rounded-lg transition-colors">取消</button>
              <button onClick={handleCreateDataset} className="px-6 py-2 text-sm font-semibold hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-sm">保存</button>
              <button onClick={handleCreateDatasetAndParse} className="px-5 py-2 text-sm font-semibold text-black bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors shadow-sm">保存并解析字段</button>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Modals */}
      {dsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">数据源管理</h3>
                <p className="text-sm text-slate-500 mt-1">配置可用于 Dataset MCP 的数据源。MVP 版本暂时仅支持 Doris。</p>
              </div>
              <button onClick={() => setDsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded border border-slate-200 hover:bg-slate-100"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-white p-6">
              <div className="flex justify-end mb-4">
                 <button onClick={() => { setDsFormOpen(true); setEditingDs(null); setDsForm({ sourceName: '', sourceType: 'Doris', feHost: '', queryPort: 9030, httpPort: 8030, username: '', password: '', remark: '' }); }} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
                   <Plus className="w-4 h-4" />
                   新增 Doris 数据源
                 </button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3">数据源名称</th>
                      <th className="px-4 py-3">类型</th>
                      <th className="px-4 py-3">FE 地址</th>
                      <th className="px-4 py-3">端口 (Query/HTTP)</th>
                      <th className="px-4 py-3">用户名</th>
                      <th className="px-4 py-3 text-center">状态</th>
                      <th className="px-4 py-3">更新时间</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataSources.map(ds => (
                      <tr key={ds.sourceId} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{ds.sourceName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ds.sourceType}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-600">{ds.feHost}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-600">{ds.queryPort} / {ds.httpPort}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ds.username}</td>
                        <td className="px-4 py-3 text-center">
                          {ds.status === 'connected' ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>已连接</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>未测试</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{ds.updatedAt}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditingDs(ds); setDsForm({ ...ds, password: '' }); setDsFormOpen(true); }} className="text-slate-500 hover:text-blue-600 p-1.5 transition-colors font-medium text-xs">编辑</button>
                          <button onClick={() => handleTestConnection(ds)} className="text-slate-500 hover:text-emerald-600 p-1.5 transition-colors font-medium text-xs">测试连接</button>
                          <button onClick={() => handleDeleteDataSource(ds.sourceId)} className="text-slate-500 hover:text-red-600 p-1.5 transition-colors font-medium text-xs">删除</button>
                        </td>
                      </tr>
                    ))}
                    {dataSources.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">暂无数据源配置</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {dsFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden font-sans">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900">{editingDs ? '编辑 Doris 数据源' : '新增 Doris 数据源'}</h3>
              <button onClick={() => setDsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">数据源名称 <span className="text-red-500">*</span></label>
                 <input type="text" value={dsForm.sourceName} onChange={e => setDsForm({...dsForm, sourceName: e.target.value})} placeholder="例如: Doris 生产集群" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="block text-sm font-semibold text-slate-700 mb-1">数据源类型</label>
                   <input type="text" value="Doris" readOnly className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-slate-100 text-slate-500 cursor-not-allowed font-semibold" />
                </div>
                <div className="col-span-2">
                   <label className="block text-sm font-semibold text-slate-700 mb-1">FE 地址 <span className="text-red-500">*</span></label>
                   <input type="text" value={dsForm.feHost} onChange={e => setDsForm({...dsForm, feHost: e.target.value})} placeholder="例如: doris-fe.company.local" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">查询端口</label>
                   <input type="number" value={dsForm.queryPort ?? 9030} onChange={e => setDsForm({...dsForm, queryPort: Number(e.target.value)})} className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">HTTP 端口</label>
                   <input type="number" value={dsForm.httpPort ?? 8030} onChange={e => setDsForm({...dsForm, httpPort: Number(e.target.value)})} className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">用户名 <span className="text-red-500">*</span></label>
                   <input type="text" value={dsForm.username} onChange={e => setDsForm({...dsForm, username: e.target.value})} className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">密码</label>
                   <input type="password" value={dsForm.password || ''} onChange={e => setDsForm({...dsForm, password: e.target.value})} placeholder={editingDs ? "●●●●●● (保持不变)" : "请输入密码"} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div className="col-span-2">
                   <label className="block text-sm font-semibold text-slate-700 mb-1">备注</label>
                   <textarea value={dsForm.remark || ''} onChange={e => setDsForm({...dsForm, remark: e.target.value})} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" rows={2} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button disabled={isTestingConn} onClick={() => setDsFormOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 border border-slate-200 rounded-lg transition-colors">取消</button>
              <button disabled={isTestingConn} onClick={() => handleTestConnection()} className={`px-4 py-2 text-sm font-semibold hover:bg-slate-100 border border-slate-300 rounded-lg transition-all shadow-sm flex items-center gap-1 ${isTestingConn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700'}`}>
                {isTestingConn && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                {isTestingConn ? '正在测试...' : '测试连接'}
              </button>
              <button disabled={isTestingConn} onClick={handleSaveDataSource} className="px-6 py-2 text-sm font-semibold text-black bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors shadow-sm">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Modal */}
      {topicModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900">{editingTopic ? '编辑主题' : '新建主题'}</h3>
              <button onClick={() => setTopicModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">标识 ID <span className="text-red-500">*</span></label>
                 <input type="text" value={topicForm.id} disabled={!!editingTopic} onChange={e => setTopicForm({...topicForm, id: e.target.value})} placeholder="例如: shop_management" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 disabled:bg-slate-100 disabled:text-slate-500" />
              </div>
              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">主题名称 <span className="text-red-500">*</span></label>
                 <input type="text" value={topicForm.name} onChange={e => setTopicForm({...topicForm, name: e.target.value})} placeholder="例如: 门店经营" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400" />
              </div>
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">描述 (可选)</label>
                 <textarea value={topicForm.description} onChange={e => setTopicForm({...topicForm, description: e.target.value})} placeholder="简短描述主题..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-400 resize-none" rows={2} />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setTopicModalOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 border border-slate-200 rounded-lg transition-colors">取消</button>
              <button onClick={handleSaveTopic} className="px-6 py-2 text-sm font-semibold text-black bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors shadow-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
