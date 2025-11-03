/**
 * Core Rules Engine interfaces following SOLID principles
 * Single Responsibility: Each interface has one clear purpose
 * Interface Segregation: Focused interfaces for specific operations
 * Dependency Inversion: Abstract interfaces for concrete implementations
 */

export interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  category: RuleCategory;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
  groupId?: string;
  precedence?: number;
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: ComparisonOperator | LogicalOperator | BusinessOperator;
  value: any;
  dataType: DataType;
  negate?: boolean;
  parameters?: Record<string, any>;
}

export interface RuleAction {
  id: string;
  type: ActionType;
  parameters: Record<string, any>;
  order: number;
  condition?: string; // Conditional action execution
}

export interface RuleGroup {
  id: string;
  name: string;
  description?: string;
  ruleIds: string[];
  executionMode: GroupExecutionMode;
  stopOnFirstMatch?: boolean;
  metadata?: Record<string, any>;
}

export interface RuleExecutionContext {
  correlationId: string;
  userId: string;
  timestamp: Date;
  entity: Record<string, any>;
  entityType: string;
  entityId: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  conditions: ConditionEvaluationResult[];
  actions: ActionResult[];
  executionTime: number;
  error?: RuleError;
  metadata?: Record<string, any>;
}

export interface ConditionEvaluationResult {
  conditionId: string;
  field: string;
  operator: string;
  expectedValue: any;
  actualValue: any;
  result: boolean;
  executionTime: number;
  error?: string;
}

export interface ActionResult {
  actionId: string;
  actionType: ActionType;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export interface RuleEngineExecutionRequest {
  ruleIds?: string[];
  groupIds?: string[];
  categories?: RuleCategory[];
  context: RuleExecutionContext;
  executionMode?: ExecutionMode;
  returnConditionDetails?: boolean;
  returnActionResults?: boolean;
}

export interface RuleEngineExecutionResponse {
  executionId: string;
  totalRules: number;
  matchedRules: number;
  executionTime: number;
  results: RuleExecutionResult[];
  summary: RuleExecutionSummary;
  errors: RuleError[];
  metadata: Record<string, any>;
}

export interface RuleExecutionSummary {
  totalConditionsEvaluated: number;
  totalActionsExecuted: number;
  averageConditionEvaluationTime: number;
  averageActionExecutionTime: number;
  ruleResults: {
    matched: number;
    notMatched: number;
    errors: number;
  };
  actionResults: {
    successful: number;
    failed: number;
  };
}

export interface RuleValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
  ruleId?: string;
}

export interface RuleValidationResult {
  isValid: boolean;
  errors: RuleValidationError[];
  warnings: RuleValidationError[];
}

export interface RuleError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  ruleId?: string;
  conditionId?: string;
  actionId?: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description?: string;
  category: RuleCategory;
  conditions: RuleConditionTemplate[];
  actions: RuleActionTemplate[];
  parameters: TemplateParameter[];
  metadata?: Record<string, any>;
}

export interface RuleConditionTemplate {
  field: string;
  operator: ComparisonOperator | LogicalOperator | BusinessOperator;
  dataType: DataType;
  valueTemplate: string;
  required: boolean;
  description?: string;
}

export interface RuleActionTemplate {
  type: ActionType;
  parameterTemplates: Record<string, TemplateParameter>;
  required: boolean;
  description?: string;
}

export interface TemplateParameter {
  name: string;
  type: DataType;
  required: boolean;
  defaultValue?: any;
  validation?: ParameterValidation;
  description?: string;
}

export interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  options?: any[];
  customValidation?: string;
}

export interface RuleStatistics {
  ruleId: string;
  executionCount: number;
  matchCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecuted: Date;
  lastMatched?: Date;
  errorCount: number;
  actionSuccessRate: number;
}

export interface RuleEngineMetrics {
  totalExecutions: number;
  totalRules: number;
  activeRules: number;
  averageExecutionTime: number;
  cacheHitRate?: number;
  memoryUsage?: number;
  errorRate: number;
  popularRules: RuleStatistics[];
  recentErrors: RuleError[];
  executionByCategory: Record<string, number>;
  executionByHour: Record<string, number>;
}

// Enums for type safety and consistency
export enum RuleCategory {
  BUSINESS_VALIDATION = 'business_validation',
  PRICING = 'pricing',
  DISCOUNT = 'discount',
  INVENTORY = 'inventory',
  APPROVAL = 'approval',
  COMPLIANCE = 'compliance',
  FINANCIAL = 'financial',
  SECURITY = 'security',
  NOTIFICATION = 'notification',
  WORKFLOW = 'workflow'
}

export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  BETWEEN = 'between',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  REGEX = 'regex'
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  XOR = 'xor'
}

export enum BusinessOperator {
  CREDIT_LIMIT_CHECK = 'credit_limit_check',
  INVENTORY_AVAILABILITY = 'inventory_availability',
  PRICING_RULE = 'pricing_rule',
  DISCOUNT_ELIGIBILITY = 'discount_eligibility',
  TAX_CALCULATION = 'tax_calculation',
  APPROVAL_MATRIX = 'approval_matrix',
  PAYMENT_TERM_CHECK = 'payment_term_check',
  SHIPPING_COST_CALCULATION = 'shipping_cost_calculation'
}

export enum ActionType {
  SET_FIELD = 'set_field',
  SEND_NOTIFICATION = 'send_notification',
  TRIGGER_WORKFLOW = 'trigger_workflow',
  CALL_API = 'call_api',
  EXECUTE_SCRIPT = 'execute_script',
  APPROVE = 'approve',
  REJECT = 'reject',
  ESCALATE = 'escalate',
  LOG_EVENT = 'log_event',
  UPDATE_DATABASE = 'update_database',
  SEND_EMAIL = 'send_email',
  CALCULATE = 'calculate'
}

export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  DECIMAL = 'decimal',
  INTEGER = 'integer'
}

export enum GroupExecutionMode {
  ALL = 'all', // Execute all rules in group
  FIRST_MATCH = 'first_match', // Stop after first rule matches
  BEST_MATCH = 'best_match', // Execute rule with highest priority that matches
  AGGREGATE = 'aggregate' // Execute all matching rules and aggregate results
}

export enum ExecutionMode {
  SYNCHRONOUS = 'synchronous',
  ASYNCHRONOUS = 'asynchronous',
  QUEUED = 'queued'
}

// Storage interfaces for dependency inversion
export interface RuleStorage {
  saveRule(rule: RuleDefinition): Promise<RuleDefinition>;
  getRule(id: string): Promise<RuleDefinition | null>;
  getRules(filter?: Partial<RuleDefinition>): Promise<RuleDefinition[]>;
  updateRule(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition>;
  deleteRule(id: string): Promise<void>;
  getRulesByGroup(groupId: string): Promise<RuleDefinition[]>;
  getRulesByCategory(category: RuleCategory): Promise<RuleDefinition[]>;
  searchRules(query: string): Promise<RuleDefinition[]>;
}

export interface RuleGroupStorage {
  saveGroup(group: RuleGroup): Promise<RuleGroup>;
  getGroup(id: string): Promise<RuleGroup | null>;
  getGroups(): Promise<RuleGroup[]>;
  updateGroup(id: string, updates: Partial<RuleGroup>): Promise<RuleGroup>;
  deleteGroup(id: string): Promise<void>;
}

export interface RuleExecutionLog {
  saveExecution(result: RuleEngineExecutionResponse): Promise<void>;
  getExecutions(filter?: {
    ruleId?: string;
    correlationId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<RuleEngineExecutionResponse[]>;
  getRuleStatistics(ruleId: string): Promise<RuleStatistics>;
  getEngineMetrics(): Promise<RuleEngineMetrics>;
}

// Event interfaces
export interface RuleEvent {
  type: RuleEventType;
  ruleId?: string;
  groupId?: string;
  executionId: string;
  correlationId: string;
  userId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export enum RuleEventType {
  RULE_CREATED = 'rule_created',
  RULE_UPDATED = 'rule_updated',
  RULE_DELETED = 'rule_deleted',
  RULE_EXECUTED = 'rule_executed',
  RULE_MATCHED = 'rule_matched',
  RULE_FAILED = 'rule_failed',
  GROUP_CREATED = 'group_created',
  GROUP_UPDATED = 'group_updated',
  GROUP_DELETED = 'group_deleted',
  TEMPLATE_CREATED = 'template_created',
  TEMPLATE_UPDATED = 'template_updated',
  TEMPLATE_DELETED = 'template_deleted'
}

// Cache interface
export interface RuleCache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Configuration interfaces
export interface RuleEngineConfig {
  maxExecutionTime?: number;
  maxConditionsPerRule?: number;
  maxActionsPerRule?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  enableMetrics?: boolean;
  enableDetailedLogging?: boolean;
  defaultExecutionMode?: ExecutionMode;
  defaultGroupExecutionMode?: GroupExecutionMode;
}