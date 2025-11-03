import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IRuleEngine,
  IRuleDefinitionService,
  IRuleExecutionService,
  IRuleGroupService,
  IRuleTemplateService,
  IRuleCacheService,
  IRuleEventService,
  IRuleMetricsService,
  IRuleValidationService,
  RuleDefinition,
  RuleGroup,
  RuleTemplate,
  RuleStatistics,
  RuleEngineMetrics,
  RuleExecutionContext,
  RuleEngineExecutionRequest,
  RuleEngineExecutionResponse,
  RuleValidationResult,
  RuleCategory,
  ExecutionMode
} from '../interfaces/rule-definition.interface';
import { RuleDefinitionService } from './rule-definition.service';
import { RuleExecutionService } from './rule-execution.service';
import { RuleGroupService } from './rule-group.service';
import { RuleTemplateService } from './rule-template.service';

@Injectable()
export class RulesEngineService implements IRuleEngine {
  constructor(
    private ruleDefinitionService: IRuleDefinitionService,
    private ruleExecutionService: IRuleExecutionService,
    private ruleGroupService: IRuleGroupService,
    private ruleTemplateService: IRuleTemplateService
  ) {}

  async executeRules(request: RuleEngineExecutionRequest): Promise<RuleEngineExecutionResponse> {
    const startTime = Date.now();
    const executionId = request.executionId || `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate execution context
      const isValidContext = await this.ruleExecutionService.validateExecutionContext(request.context);
      if (!isValidContext) {
        throw new Error('Invalid execution context');
      }

      let rules: RuleDefinition[] = [];

      // Get rules based on request criteria
      if (request.ruleIds && request.ruleIds.length > 0) {
        // Specific rule IDs
        for (const ruleId of request.ruleIds) {
          const rule = await this.ruleDefinitionService.getRule(ruleId);
          if (rule && rule.enabled) {
            rules.push(rule);
          }
        }
      } else if (request.groupIds && request.groupIds.length > 0) {
        // Rules from specific groups
        for (const groupId of request.groupIds) {
          const group = await this.ruleGroupService.getRuleGroup(groupId);
          if (group) {
            for (const ruleId of group.ruleIds) {
              const rule = await this.ruleDefinitionService.getRule(ruleId);
              if (rule && rule.enabled) {
                rules.push(rule);
              }
            }
          }
        }
      } else if (request.categories && request.categories.length > 0) {
        // Rules from specific categories
        for (const category of request.categories) {
          const categoryRules = await this.ruleDefinitionService.getRulesByCategory(category);
          rules.push(...categoryRules.filter(rule => rule.enabled));
        }
      } else {
        // All enabled rules
        const allRules = await this.ruleDefinitionService.getRules();
        rules.push(...allRules.filter(rule => rule.enabled));
      }

      // Sort rules by priority and precedence
      rules.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority; // Lower number = higher priority
        }
        if (a.precedence !== undefined && b.precedence !== undefined) {
          return a.precedence - b.precedence;
        }
        return 0;
      });

      if (rules.length === 0) {
        return this.createEmptyResponse(executionId, request, startTime);
      }

      // Execute rules based on execution mode
      let response: RuleEngineExecutionResponse;

      switch (request.executionMode) {
        case ExecutionMode.ASYNCHRONOUS:
          // For async, return immediately with execution ID
          // In a real implementation, this would queue the execution
          response = await this.executeRulesSync(rules, request, executionId, startTime);
          break;
        case ExecutionMode.QUEUED:
          // For queued, add to queue and return execution ID
          // In a real implementation, this would add to a message queue
          response = await this.executeRulesSync(rules, request, executionId, startTime);
          break;
        default:
        case ExecutionMode.SYNCHRONOUS:
          response = await this.executeRulesSync(rules, request, executionId, startTime);
          break;
      }

      return response;

    } catch (error) {
      return this.createErrorResponse(executionId, request, error, startTime);
    }
  }

  async executeRule(ruleId: string, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    const rule = await this.ruleDefinitionService.getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    return this.ruleExecutionService.executeRule(rule, context);
  }

  async executeRuleGroup(groupId: string, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    const group = await this.ruleGroupService.getRuleGroup(groupId);
    if (!group) {
      throw new Error(`Rule group with id ${groupId} not found`);
    }

    // Get all rules in the group
    const rules: RuleDefinition[] = [];
    for (const ruleId of group.ruleIds) {
      const rule = await this.ruleDefinitionService.getRule(ruleId);
      if (rule && rule.enabled) {
        rules.push(rule);
      }
    }

    if (rules.length === 0) {
      return this.createEmptyResponse(`exec-${Date.now()}`, { context } as RuleEngineExecutionRequest, Date.now());
    }

    // Sort rules by priority
    rules.sort((a, b) => a.priority - b.priority);

    // Execute based on group execution mode
    switch (group.executionMode) {
      case 'all':
        return this.executeAllRules(rules, context);
      case 'first_match':
        return this.executeFirstMatchRules(rules, context);
      case 'best_match':
        return this.executeBestMatchRules(rules, context);
      case 'aggregate':
        return this.executeAggregateRules(rules, context);
      default:
        return this.executeAllRules(rules, context);
    }
  }

  async createRule(ruleData: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleDefinition> {
    return this.ruleDefinitionService.createRule(ruleData);
  }

  async updateRule(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition> {
    return this.ruleDefinitionService.updateRule(id, updates);
  }

  async deleteRule(id: string): Promise<void> {
    return this.ruleDefinitionService.deleteRule(id);
  }

  async getRule(id: string): Promise<RuleDefinition | null> {
    return this.ruleDefinitionService.getRule(id);
  }

  async getRules(filter?: Partial<RuleDefinition>): Promise<RuleDefinition[]> {
    return this.ruleDefinitionService.getRules(filter);
  }

  async validateRule(rule: RuleDefinition): Promise<RuleValidationResult> {
    return this.ruleDefinitionService.validateRule(rule);
  }

  async validateRules(rules: RuleDefinition[]): Promise<RuleValidationResult> {
    const allErrors: any[] = [];
    const allWarnings: any[] = [];

    for (const rule of rules) {
      const result = await this.validateRule(rule);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  async createRuleGroup(groupData: Omit<RuleGroup, 'id'>): Promise<RuleGroup> {
    return this.ruleGroupService.createRuleGroup(groupData);
  }

  async updateRuleGroup(id: string, updates: Partial<RuleGroup>): Promise<RuleGroup> {
    return this.ruleGroupService.updateRuleGroup(id, updates);
  }

  async deleteRuleGroup(id: string): Promise<void> {
    return this.ruleGroupService.deleteRuleGroup(id);
  }

  async getRuleGroup(id: string): Promise<RuleGroup | null> {
    return this.ruleGroupService.getRuleGroup(id);
  }

  async getRuleGroups(): Promise<RuleGroup[]> {
    return this.ruleGroupService.getRuleGroups();
  }

  async createRuleTemplate(templateData: Omit<RuleTemplate, 'id'>): Promise<RuleTemplate> {
    return this.ruleTemplateService.createTemplate(templateData);
  }

  async getRuleTemplate(id: string): Promise<RuleTemplate | null> {
    return this.ruleTemplateService.getTemplate(id);
  }

  async getRuleTemplates(category?: RuleCategory): Promise<RuleTemplate[]> {
    return this.ruleTemplateService.getTemplates(category);
  }

  async createRuleFromTemplate(templateId: string, parameters: Record<string, any>): Promise<RuleDefinition> {
    return this.ruleTemplateService.createRuleFromTemplate(templateId, parameters);
  }

  async getRuleStatistics(ruleId: string): Promise<RuleStatistics> {
    // In a real implementation, this would query actual metrics
    return {
      ruleId,
      executionCount: Math.floor(Math.random() * 1000) + 1,
      matchCount: Math.floor(Math.random() * 800) + 1,
      successRate: Math.random() * 0.2 + 0.8, // 80-100%
      averageExecutionTime: Math.random() * 100 + 10, // 10-110ms
      lastExecuted: new Date(),
      lastMatched: new Date(),
      errorCount: Math.floor(Math.random() * 10),
      actionSuccessRate: Math.random() * 0.1 + 0.9 // 90-100%
    };
  }

  async getEngineMetrics(): Promise<RuleEngineMetrics> {
    // In a real implementation, this would query actual metrics
    const rules = await this.getRules();
    const activeRules = rules.filter(rule => rule.enabled);

    return {
      totalExecutions: Math.floor(Math.random() * 10000) + 1000,
      totalRules: rules.length,
      activeRules: activeRules.length,
      averageExecutionTime: Math.random() * 50 + 20, // 20-70ms
      cacheHitRate: Math.random() * 0.3 + 0.7, // 70-100%
      memoryUsage: Math.random() * 100 + 50, // MB
      errorRate: Math.random() * 0.05, // 0-5%
      popularRules: [],
      recentErrors: [],
      executionByCategory: this.getExecutionByCategory(rules),
      executionByHour: this.getExecutionByHour()
    };
  }

  async enableRule(id: string): Promise<void> {
    return this.ruleDefinitionService.enableRule(id);
  }

  async disableRule(id: string): Promise<void> {
    return this.ruleDefinitionService.disableRule(id);
  }

  async testRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    return this.ruleExecutionService.dryRunRule(rule, context);
  }

  async searchRules(query: string): Promise<RuleDefinition[]> {
    return this.ruleDefinitionService.searchRules(query);
  }

  private async executeRulesSync(
    rules: RuleDefinition[],
    request: RuleEngineExecutionRequest,
    executionId: string,
    startTime: number
  ): Promise<RuleEngineExecutionResponse> {
    return this.ruleExecutionService.executeRules(rules, request.context);
  }

  private async executeAllRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    return this.ruleExecutionService.executeRules(rules, context);
  }

  private async executeFirstMatchRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    for (const rule of rules) {
      const result = await this.ruleExecutionService.executeRule(rule, context);
      if (result.results[0].matched) {
        return result;
      }
    }

    // No rules matched
    return this.createEmptyResponse(`exec-${Date.now()}`, { context } as RuleEngineExecutionRequest, Date.now());
  }

  private async executeBestMatchRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    const results: RuleExecutionResult[] = [];
    let bestMatch: RuleExecutionResult | null = null;

    for (const rule of rules) {
      const result = await this.ruleExecutionService.executeRule(rule, context);
      results.push(result.results[0]);

      if (result.results[0].matched) {
        if (!bestMatch || rule.priority < bestMatch.executionTime) {
          bestMatch = result.results[0];
        }
      }
    }

    if (bestMatch) {
      return {
        executionId: `exec-${Date.now()}`,
        totalRules: rules.length,
        matchedRules: 1,
        executionTime: 0,
        results: [bestMatch],
        summary: {
          totalConditionsEvaluated: bestMatch.conditions.length,
          totalActionsExecuted: bestMatch.actions.length,
          averageConditionEvaluationTime: 0,
          averageActionExecutionTime: 0,
          ruleResults: { matched: 1, notMatched: rules.length - 1, errors: 0 },
          actionResults: { successful: bestMatch.actions.filter(a => a.success).length, failed: 0 }
        },
        errors: [],
        metadata: {
          correlationId: context.correlationId,
          userId: context.userId,
          entityType: context.entityType,
          executedAt: new Date()
        }
      };
    }

    return this.createEmptyResponse(`exec-${Date.now()}`, { context } as RuleEngineExecutionRequest, Date.now());
  }

  private async executeAggregateRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    return this.ruleExecutionService.executeRules(rules, context);
  }

  private createEmptyResponse(executionId: string, request: RuleEngineExecutionRequest, startTime: number): RuleEngineExecutionResponse {
    return {
      executionId,
      totalRules: 0,
      matchedRules: 0,
      executionTime: Date.now() - startTime,
      results: [],
      summary: {
        totalConditionsEvaluated: 0,
        totalActionsExecuted: 0,
        averageConditionEvaluationTime: 0,
        averageActionExecutionTime: 0,
        ruleResults: { matched: 0, notMatched: 0, errors: 0 },
        actionResults: { successful: 0, failed: 0 }
      },
      errors: [],
      metadata: {
        correlationId: request.context.correlationId,
        userId: request.context.userId,
        entityType: request.context.entityType,
        executedAt: new Date()
      }
    };
  }

  private createErrorResponse(
    executionId: string,
    request: RuleEngineExecutionRequest,
    error: any,
    startTime: number
  ): RuleEngineExecutionResponse {
    return {
      executionId,
      totalRules: 0,
      matchedRules: 0,
      executionTime: Date.now() - startTime,
      results: [],
      summary: {
        totalConditionsEvaluated: 0,
        totalActionsExecuted: 0,
        averageConditionEvaluationTime: 0,
        averageActionExecutionTime: 0,
        ruleResults: { matched: 0, notMatched: 0, errors: 1 },
        actionResults: { successful: 0, failed: 0 }
      },
      errors: [{
        code: 'EXECUTION_ERROR',
        message: error.message || 'Unknown error occurred',
        details: { stack: error.stack },
        timestamp: new Date(),
        recoverable: false
      }],
      metadata: {
        correlationId: request.context.correlationId,
        userId: request.context.userId,
        entityType: request.context.entityType,
        executedAt: new Date(),
        error: true
      }
    };
  }

  private getExecutionByCategory(rules: RuleDefinition[]): Record<string, number> {
    const categoryCount: Record<string, number> = {};
    for (const rule of rules) {
      categoryCount[rule.category] = (categoryCount[rule.category] || 0) + 1;
    }
    return categoryCount;
  }

  private getExecutionByHour(): Record<string, number> {
    const hourlyCount: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyCount[i.toString()] = Math.floor(Math.random() * 100);
    }
    return hourlyCount;
  }
}