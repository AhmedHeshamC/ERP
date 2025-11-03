/**
 * Shared types for the Rules Engine
 * Re-exports common types for convenience
 */

export * from '../interfaces/rule-definition.interface';
export * from '../interfaces/rule-engine.interface';

// Additional utility types
export interface RuleEvaluationContext {
  entity: Record<string, any>;
  variables: Record<string, any>;
  functions: Record<string, Function>;
  metadata: Record<string, any>;
}

export interface CompiledRule {
  id: string;
  condition: CompiledCondition;
  actions: CompiledAction[];
  metadata: Record<string, any>;
}

export interface CompiledCondition {
  evaluate: (context: RuleEvaluationContext) => Promise<boolean>;
  fields: string[];
  complexity: number;
}

export interface CompiledAction {
  execute: (context: RuleEvaluationContext) => Promise<any>;
  type: string;
  parameters: Record<string, any>;
}

export interface RuleExecutionPlan {
  rules: RuleExecutionStep[];
  parallelGroups: RuleExecutionStep[][];
  estimatedTime: number;
  dependencies: string[][];
}

export interface RuleExecutionStep {
  ruleId: string;
  ruleName: string;
  priority: number;
  dependencies: string[];
  estimatedTime: number;
}

// Performance optimization types
export interface RuleOptimizationResult {
  originalComplexity: number;
  optimizedComplexity: number;
  improvements: OptimizationSuggestion[];
  estimatedSpeedup: number;
}

export interface OptimizationSuggestion {
  type: 'reorder_conditions' | 'cache_field' | 'simplify_expression' | 'merge_rules';
  description: string;
  impact: 'low' | 'medium' | 'high';
  implementation: string;
}

// Business rule specific types
export interface BusinessRuleContext {
  customer?: CustomerContext;
  product?: ProductContext;
  order?: OrderContext;
  invoice?: InvoiceContext;
  user?: UserContext;
  organization?: OrganizationContext;
  timestamp: Date;
}

export interface CustomerContext {
  id: string;
  type: 'individual' | 'business';
  segment: string;
  creditLimit?: number;
  currentBalance?: number;
  paymentHistory?: PaymentHistory;
  demographics?: Record<string, any>;
}

export interface ProductContext {
  id: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  margin?: number;
  attributes?: Record<string, any>;
}

export interface OrderContext {
  id: string;
  total: number;
  currency: string;
  items: OrderItem[];
  customer: string;
  status: string;
  date: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceContext {
  id: string;
  amount: number;
  dueDate: Date;
  status: 'paid' | 'pending' | 'overdue';
  customer: string;
}

export interface UserContext {
  id: string;
  role: string;
  permissions: string[];
  department?: string;
  manager?: string;
}

export interface OrganizationContext {
  id: string;
  type: string;
  size: string;
  industry: string;
  region: string;
}

export interface PaymentHistory {
  onTimePayments: number;
  latePayments: number;
  averageDaysLate: number;
  lastPaymentDate?: Date;
}

// Rule testing types
export interface RuleTestCase {
  id: string;
  name: string;
  description?: string;
  context: RuleExecutionContext;
  expectedResult: {
    matched: boolean;
    actions?: any[];
  };
  actualResult?: RuleEngineExecutionResponse;
  passed?: boolean;
  error?: string;
}

export interface RuleTestSuite {
  id: string;
  name: string;
  ruleId: string;
  testCases: RuleTestCase[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface RuleTestResult {
  testSuiteId: string;
  ruleId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  testResults: RuleTestCase[];
}

// Rule versioning types
export interface RuleVersion {
  id: string;
  ruleId: string;
  version: string;
  rule: RuleDefinition;
  changeLog: string;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface RuleVersionDiff {
  added: RuleDiffItem[];
  modified: RuleDiffItem[];
  removed: RuleDiffItem[];
}

export interface RuleDiffItem {
  type: 'condition' | 'action' | 'metadata';
  id: string;
  oldValue?: any;
  newValue?: any;
  path: string;
}

// Rule analytics types
export interface RuleAnalytics {
  ruleId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  executions: RuleExecutionAnalytics[];
  trends: RuleTrend[];
  performance: RulePerformanceAnalytics;
}

export interface RuleExecutionAnalytics {
  timestamp: Date;
  executionCount: number;
  matchCount: number;
  averageExecutionTime: number;
  errorCount: number;
}

export interface RuleTrend {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  confidence: number;
}

export interface RulePerformanceAnalytics {
  averageExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
}

// Rule debugging types
export interface RuleDebugSession {
  id: string;
  ruleId: string;
  context: RuleExecutionContext;
  breakpoints: string[];
  stepByStep: boolean;
  variables: Record<string, any>;
  callStack: DebugCallStackEntry[];
  createdAt: Date;
}

export interface DebugCallStackEntry {
  step: string;
  type: 'condition' | 'action';
  input: any;
  output: any;
  executionTime: number;
  timestamp: Date;
}

export interface RuleDebugResult {
  sessionId: string;
  finalResult: RuleEngineExecutionResponse;
  debugLog: DebugLogEntry[];
  variables: Record<string, any>;
}

export interface DebugLogEntry {
  timestamp: Date;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

// Integration types
export interface WorkflowRuleIntegration {
  workflowId: string;
  stepId: string;
  ruleIds: string[];
  executionMode: 'synchronous' | 'asynchronous';
  timeout?: number;
  retryPolicy?: any;
}

export interface EventRuleIntegration {
  eventType: string;
  ruleIds: string[];
  conditions?: Record<string, any>;
  enabled: boolean;
}

export interface APIRuleIntegration {
  endpoint: string;
  method: string;
  ruleIds: string[];
  authentication?: any;
  rateLimit?: any;
}