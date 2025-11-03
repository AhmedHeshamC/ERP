/**
 * Rules Engine Service interfaces following SOLID principles
 * Defines contracts for rule evaluation and management
 */

import {
  RuleDefinition,
  RuleGroup,
  RuleExecutionContext,
  RuleEngineExecutionRequest,
  RuleEngineExecutionResponse,
  RuleValidationResult,
  RuleTemplate,
  RuleStatistics,
  RuleEngineMetrics,
  RuleEvent,
  RuleCategory
} from './rule-definition.interface';

export interface IRuleEngine {
  // Core rule execution
  executeRules(request: RuleEngineExecutionRequest): Promise<RuleEngineExecutionResponse>;
  executeRule(ruleId: string, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;
  executeRuleGroup(groupId: string, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;

  // Rule management
  createRule(rule: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleDefinition>;
  updateRule(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<RuleDefinition | null>;
  getRules(filter?: Partial<RuleDefinition>): Promise<RuleDefinition[]>;

  // Rule validation
  validateRule(rule: RuleDefinition): Promise<RuleValidationResult>;
  validateRules(rules: RuleDefinition[]): Promise<RuleValidationResult>;

  // Rule groups
  createRuleGroup(group: Omit<RuleGroup, 'id'>): Promise<RuleGroup>;
  updateRuleGroup(id: string, updates: Partial<RuleGroup>): Promise<RuleGroup>;
  deleteRuleGroup(id: string): Promise<void>;
  getRuleGroup(id: string): Promise<RuleGroup | null>;
  getRuleGroups(): Promise<RuleGroup[]>;

  // Templates
  createRuleTemplate(template: Omit<RuleTemplate, 'id'>): Promise<RuleTemplate>;
  getRuleTemplate(id: string): Promise<RuleTemplate | null>;
  getRuleTemplates(category?: RuleCategory): Promise<RuleTemplate[]>;
  createRuleFromTemplate(templateId: string, parameters: Record<string, any>): Promise<RuleDefinition>;

  // Statistics and metrics
  getRuleStatistics(ruleId: string): Promise<RuleStatistics>;
  getEngineMetrics(): Promise<RuleEngineMetrics>;

  // Utility methods
  enableRule(id: string): Promise<void>;
  disableRule(id: string): Promise<void>;
  testRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;
  searchRules(query: string): Promise<RuleDefinition[]>;
}

export interface IRuleDefinitionService {
  createRule(rule: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleDefinition>;
  updateRule(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<RuleDefinition | null>;
  getRules(filter?: Partial<RuleDefinition>): Promise<RuleDefinition[]>;
  getRulesByGroup(groupId: string): Promise<RuleDefinition[]>;
  getRulesByCategory(category: RuleCategory): Promise<RuleDefinition[]>;
  searchRules(query: string): Promise<RuleDefinition[]>;
  validateRule(rule: RuleDefinition): Promise<RuleValidationResult>;
  enableRule(id: string): Promise<void>;
  disableRule(id: string): Promise<void>;
  duplicateRule(id: string, newName: string): Promise<RuleDefinition>;
  exportRules(ruleIds: string[]): Promise<string>;
  importRules(data: string): Promise<RuleDefinition[]>;
}

export interface IRuleExecutionService {
  executeRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;
  executeRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;
  evaluateConditions(rule: RuleDefinition, context: RuleExecutionContext): Promise<any[]>;
  executeActions(rule: RuleDefinition, context: RuleExecutionContext, conditionResults: any[]): Promise<any[]>;
  dryRunRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse>;
  validateExecutionContext(context: RuleExecutionContext): Promise<boolean>;
}

export interface IConditionEvaluator {
  evaluate(condition: any, context: RuleExecutionContext): Promise<boolean>;
  evaluateConditions(conditions: any[], context: RuleExecutionContext, logicalOperator?: string): Promise<boolean>;
  registerOperator(operator: string, evaluator: Function): void;
  getOperators(): string[];
}

export interface IActionExecutor {
  execute(action: any, context: RuleExecutionContext): Promise<any>;
  executeActions(actions: any[], context: RuleExecutionContext): Promise<any[]>;
  registerAction(actionType: string, executor: Function): void;
  getActionTypes(): string[];
}

export interface IRuleGroupService {
  createRuleGroup(group: Omit<RuleGroup, 'id'>): Promise<RuleGroup>;
  updateRuleGroup(id: string, updates: Partial<RuleGroup>): Promise<RuleGroup>;
  deleteRuleGroup(id: string): Promise<void>;
  getRuleGroup(id: string): Promise<RuleGroup | null>;
  getRuleGroups(): Promise<RuleGroup[]>;
  addRuleToGroup(groupId: string, ruleId: string): Promise<void>;
  removeRuleFromGroup(groupId: string, ruleId: string): Promise<void>;
  validateGroup(group: RuleGroup): Promise<RuleValidationResult>;
}

export interface IRuleTemplateService {
  createTemplate(template: Omit<RuleTemplate, 'id'>): Promise<RuleTemplate>;
  getTemplate(id: string): Promise<RuleTemplate | null>;
  getTemplates(category?: RuleCategory): Promise<RuleTemplate[]>;
  updateTemplate(id: string, updates: Partial<RuleTemplate>): Promise<RuleTemplate>;
  deleteTemplate(id: string): Promise<void>;
  createRuleFromTemplate(templateId: string, parameters: Record<string, any>): Promise<RuleDefinition>;
  validateTemplate(template: RuleTemplate): Promise<RuleValidationResult>;
}

export interface IRuleCacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  getRule(ruleId: string): Promise<RuleDefinition | null>;
  setRule(ruleId: string, rule: RuleDefinition, ttl?: number): Promise<void>;
  invalidateRule(ruleId: string): Promise<void>;
  getRuleGroup(groupId: string): Promise<RuleGroup | null>;
  setRuleGroup(groupId: string, group: RuleGroup, ttl?: number): Promise<void>;
  invalidateRuleGroup(groupId: string): Promise<void>;
}

export interface IRuleEventService {
  emit(event: RuleEvent): Promise<void>;
  on(eventType: string, handler: (event: RuleEvent) => Promise<void>): void;
  off(eventType: string, handler: (event: RuleEvent) => Promise<void>): void;
  publishRuleCreated(rule: RuleDefinition, userId: string): Promise<void>;
  publishRuleUpdated(rule: RuleDefinition, userId: string): Promise<void>;
  publishRuleDeleted(ruleId: string, userId: string): Promise<void>;
  publishRuleExecuted(result: RuleEngineExecutionResponse): Promise<void>;
}

export interface IRuleMetricsService {
  recordRuleExecution(ruleId: string, executionTime: number, matched: boolean, success: boolean): Promise<void>;
  recordActionExecution(actionType: string, executionTime: number, success: boolean): Promise<void>;
  getRuleStatistics(ruleId: string): Promise<RuleStatistics>;
  getEngineMetrics(): Promise<RuleEngineMetrics>;
  getPopularRules(limit?: number): Promise<RuleStatistics[]>;
  getRecentErrors(limit?: number): Promise<any[]>;
  resetMetrics(): Promise<void>;
}

export interface IRuleValidationService {
  validateRuleDefinition(rule: RuleDefinition): Promise<RuleValidationResult>;
  validateRuleGroup(group: RuleGroup): Promise<RuleValidationResult>;
  validateTemplate(template: RuleTemplate): Promise<RuleValidationResult>;
  validateExecutionContext(context: RuleExecutionContext): Promise<boolean>;
  validateConditionSyntax(condition: any): Promise<boolean>;
  validateActionParameters(action: any): Promise<boolean>;
}

export interface IRuleSecurityService {
  canCreateRule(userId: string, category?: RuleCategory): Promise<boolean>;
  canUpdateRule(userId: string, ruleId: string): Promise<boolean>;
  canDeleteRule(userId: string, ruleId: string): Promise<boolean>;
  canExecuteRule(userId: string, ruleId: string): Promise<boolean>;
  canViewRule(userId: string, ruleId: string): Promise<boolean>;
  canManageTemplates(userId: string): Promise<boolean>;
  canViewMetrics(userId: string): Promise<boolean>;
  filterRulesByPermission(userId: string, rules: RuleDefinition[]): Promise<RuleDefinition[]>;
}

export interface IRuleImportExportService {
  exportRules(ruleIds: string[]): Promise<string>;
  exportRuleGroups(groupIds: string[]): Promise<string>;
  exportTemplates(templateIds: string[]): Promise<string>;
  importRules(data: string, options?: ImportOptions): Promise<ImportResult>;
  importRuleGroups(data: string, options?: ImportOptions): Promise<ImportResult>;
  importTemplates(data: string, options?: ImportOptions): Promise<ImportResult>;
  validateImportData(data: string): Promise<ImportValidationResult>;
}

export interface ImportOptions {
  overwriteExisting?: boolean;
  validateOnly?: boolean;
  createGroups?: boolean;
  preserveIds?: boolean;
  enableRules?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  type: 'rule' | 'group' | 'template';
  id?: string;
  name?: string;
  message: string;
  line?: number;
}

export interface ImportWarning {
  type: 'rule' | 'group' | 'template';
  id?: string;
  name?: string;
  message: string;
  line?: number;
}

export interface ImportValidationResult {
  isValid: boolean;
  itemCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}