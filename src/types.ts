export type Page = 'manage' | 'console';

export type DatasetStatus = '草稿' | '已发布';

export interface Topic {
  id: string;
  name: string;
  description: string;
}

export interface DataSource {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  feHost: string;
  queryPort: number;
  httpPort: number;
  username: string;
  password?: string;
  status: string;
  updatedAt: string;
  remark?: string;
}

export interface MockTable {
  name: string;
  displayNameDraft: string;
  descriptionDraft: string;
}

export interface MockDatabase {
  name: string;
  tables: MockTable[];
}

export interface MockSourceSchema {
  sourceId: string;
  databases: MockDatabase[];
}

export interface EnumMapping {
  rawValue: string;
  displayValue: string;
  synonyms: string[];
  enabled: boolean;
  description: string;
}

export interface TableAccessPolicy {
  mode: 'public' | 'specified' | 'forbidden';
  principals: string[];
}

export interface FieldAccessPolicy {
  fieldName: string;
  defaultVisible: boolean;
  defaultQueryable: boolean;
  maskingRule: string; // 'none', 'phone_mask', 'email_mask', 'id_mask', 'name_mask', 'custom_mask'
  restrictedPrincipals: string[];
}

export interface RowAccessPolicy {
  ruleName: string;
  principals: string[];
  field: string;
  operator: string; // '=', 'in', '!=', 'not in', 'like'
  value: string;
  enabled: boolean;
}

export interface PermissionPolicy {
  tableAccess: TableAccessPolicy;
  fieldAccess: FieldAccessPolicy[];
  rowAccess: RowAccessPolicy[];
}

export interface Dataset {
  id: string;
  datasetName: string;
  topic: string;
  description: string;
  fieldCount: number;
  status: DatasetStatus;
  mcpEnabled: boolean;
  queryPolicyConfigured?: boolean;
  defaultLimit?: number;
  maxLimit?: number | null;
  allowUnlimitedReturn?: boolean;
  requireTimeFilter?: boolean;
  timeField?: string;
  allowDetailQuery?: boolean;
  allowAggregateQuery?: boolean;
  allowSensitiveQuery?: boolean;
  sourceId?: string;
  sourceName?: string;
  sourceType?: string;
  databaseName?: string;
  tableName?: string;
  updatedAt?: string;
  permissionPolicy?: PermissionPolicy;
  fields?: Field[];
}

export type FieldSource = '人工配置' | '解析结果' | '已确认' | '已人工修改';

export interface Field {
  name: string;
  displayName: string;
  type: string;
  role: string;
  description: string;
  queryable: boolean;
  filterable: boolean;
  groupable: boolean;
  sensitive: boolean;
  aggregationsSupported: string[];
  confidence?: number;
  confirmed?: boolean;
  source?: FieldSource;
  enumMappings?: EnumMapping[];
  maskingRule?: string;
}

export interface ToolDef {
  id: string;
  name: string;
  desc: string;
}
