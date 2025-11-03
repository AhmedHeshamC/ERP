import { Injectable } from '@nestjs/common';
import { IRuleExecutionService } from '../interfaces/rule-engine.interface';
import {
  RuleDefinition,
  RuleExecutionContext,
  RuleEngineExecutionResponse,
  RuleExecutionResult,
  RuleExecutionSummary,
  ConditionEvaluationResult,
  ActionResult,
  RuleError
} from '../interfaces/rule-definition.interface';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ActionExecutorService } from './action-executor.service';

@Injectable()
export class RuleExecutionService implements IRuleExecutionService {
  constructor(
    private conditionEvaluator: ConditionEvaluatorService,
    private actionExecutor: ActionExecutorService
  ) {}

  async executeRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate rule is enabled
      if (!rule.enabled) {
        return this.createExecutionResponse(executionId, [this.createSkippedResult(rule)], startTime);
      }

      // Evaluate conditions
      const conditionResults = await this.evaluateConditions(rule, context);
      const matched = conditionResults.every(result => result.result);

      const ruleResult: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        conditions: conditionResults,
        actions: [],
        executionTime: 0
      };

      // Execute actions if conditions matched
      if (matched && rule.actions && rule.actions.length > 0) {
        const actionStartTime = Date.now();
        try {
          ruleResult.actions = await this.actionExecutor.executeActions(rule.actions, context);
        } catch (error) {
          ruleResult.error = {
            code: 'ACTION_EXECUTION_ERROR',
            message: error.message,
            details: { ruleId: rule.id, actionCount: rule.actions.length },
            timestamp: new Date(),
            recoverable: false
          };
        }
        ruleResult.executionTime = Date.now() - actionStartTime;
      }

      const summary = this.createSummary([ruleResult]);

      return {
        executionId,
        totalRules: 1,
        matchedRules: matched ? 1 : 0,
        executionTime: Date.now() - startTime,
        results: [ruleResult],
        summary,
        errors: ruleResult.error ? [ruleResult.error] : [],
        metadata: {
          correlationId: context.correlationId,
          userId: context.userId,
          entityType: context.entityType,
          executedAt: new Date()
        }
      };

    } catch (error) {
      const errorResult: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        conditions: [],
        actions: [],
        executionTime: Date.now() - startTime,
        error: {
          code: 'RULE_EXECUTION_ERROR',
          message: error.message,
          details: { ruleId: rule.id },
          timestamp: new Date(),
          recoverable: false
        }
      };

      return {
        executionId,
        totalRules: 1,
        matchedRules: 0,
        executionTime: Date.now() - startTime,
        results: [errorResult],
        summary: this.createSummary([errorResult]),
        errors: [errorResult.error!],
        metadata: {
          correlationId: context.correlationId,
          userId: context.userId,
          entityType: context.entityType,
          executedAt: new Date()
        }
      };
    }
  }

  async executeRules(rules: RuleDefinition[], context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const results: RuleExecutionResult[] = [];
    const errors: RuleError[] = [];

    // Sort rules by priority (lower number = higher priority)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        const ruleResponse = await this.executeRule(rule, context);
        results.push(...ruleResponse.results);
        errors.push(...ruleResponse.errors);
      } catch (error) {
        const errorResult: RuleExecutionResult = {
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          conditions: [],
          actions: [],
          executionTime: 0,
          error: {
            code: 'RULE_EXECUTION_ERROR',
            message: error.message,
            details: { ruleId: rule.id },
            timestamp: new Date(),
            recoverable: false
          }
        };
        results.push(errorResult);
        errors.push(errorResult.error);
      }
    }

    const summary = this.createSummary(results);

    return {
      executionId,
      totalRules: rules.length,
      matchedRules: summary.ruleResults.matched,
      executionTime: Date.now() - startTime,
      results,
      summary,
      errors,
      metadata: {
        correlationId: context.correlationId,
        userId: context.userId,
        entityType: context.entityType,
        executedAt: new Date()
      }
    };
  }

  async evaluateConditions(rule: RuleDefinition, context: RuleExecutionContext): Promise<ConditionEvaluationResult[]> {
    const conditionResults: ConditionEvaluationResult[] = [];

    if (!rule.conditions || rule.conditions.length === 0) {
      return conditionResults;
    }

    for (const condition of rule.conditions) {
      const startTime = Date.now();
      try {
        const actualValue = this.getFieldValue(condition.field, context);
        const result = await this.conditionEvaluator.evaluate(condition, context);

        conditionResults.push({
          conditionId: condition.id,
          field: condition.field,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue,
          result,
          executionTime: Date.now() - startTime
        });
      } catch (error) {
        conditionResults.push({
          conditionId: condition.id,
          field: condition.field,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue: null,
          result: false,
          executionTime: Date.now() - startTime,
          error: error.message
        });
      }
    }

    return conditionResults;
  }

  async executeActions(rule: RuleDefinition, context: RuleExecutionContext, conditionResults: ConditionEvaluationResult[]): Promise<ActionResult[]> {
    const allConditionsMatched = conditionResults.every(result => result.result);

    if (!allConditionsMatched) {
      return [];
    }

    if (!rule.actions || rule.actions.length === 0) {
      return [];
    }

    return this.actionExecutor.executeActions(rule.actions, context);
  }

  async dryRunRule(rule: RuleDefinition, context: RuleExecutionContext): Promise<RuleEngineExecutionResponse> {
    // Create a dry-run context
    const dryRunContext = { ...context };
    const dryRunResult = await this.executeRule(rule, dryRunContext);

    // Mark as dry run
    dryRunResult.metadata.dryRun = true;
    dryRunResult.results.forEach(result => {
      if (result.actions) {
        result.actions.forEach(action => {
          (action as any).dryRun = true;
        });
      }
    });

    return dryRunResult;
  }

  async validateExecutionContext(context: RuleExecutionContext): Promise<boolean> {
    try {
      return !!(context &&
        context.correlationId &&
        context.userId &&
        context.timestamp &&
        context.entity &&
        context.entityType &&
        context.entityId);
    } catch {
      return false;
    }
  }

  private createExecutionResponse(executionId: string, results: RuleExecutionResult[], startTime: number): RuleEngineExecutionResponse {
    const summary = this.createSummary(results);

    return {
      executionId,
      totalRules: results.length,
      matchedRules: summary.ruleResults.matched,
      executionTime: Date.now() - startTime,
      results,
      summary,
      errors: results.filter(r => r.error).map(r => r.error!).filter(Boolean),
      metadata: {
        executedAt: new Date()
      }
    };
  }

  private createSkippedResult(rule: RuleDefinition): RuleExecutionResult {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: false,
      conditions: [],
      actions: [],
      executionTime: 0
    };
  }

  private createSummary(results: RuleExecutionResult[]): RuleExecutionSummary {
    const totalConditions = results.reduce((sum, result) => sum + result.conditions.length, 0);
    const totalActions = results.reduce((sum, result) => sum + result.actions.length, 0);
    const successfulActions = results.reduce((sum, result) =>
      sum + result.actions.filter(action => action.success).length, 0);

    const conditionTimes = results.flatMap(result => result.conditions.map(c => c.executionTime));
    const actionTimes = results.flatMap(result => result.actions.map(a => a.executionTime));

    const averageConditionTime = conditionTimes.length > 0
      ? conditionTimes.reduce((sum, time) => sum + time, 0) / conditionTimes.length
      : 0;

    const averageActionTime = actionTimes.length > 0
      ? actionTimes.reduce((sum, time) => sum + time, 0) / actionTimes.length
      : 0;

    const ruleResults = {
      matched: results.filter(r => r.matched).length,
      notMatched: results.filter(r => !r.matched && !r.error).length,
      errors: results.filter(r => r.error).length
    };

    const actionResults = {
      successful: successfulActions,
      failed: totalActions - successfulActions
    };

    return {
      totalConditionsEvaluated: totalConditions,
      totalActionsExecuted: totalActions,
      averageConditionEvaluationTime: averageConditionTime,
      averageActionExecutionTime: averageActionTime,
      ruleResults,
      actionResults
    };
  }

  private getFieldValue(fieldPath: string, context: RuleExecutionContext): any {
    // Handle special context fields
    if (fieldPath === 'correlationId') return context.correlationId;
    if (fieldPath === 'userId') return context.userId;
    if (fieldPath === 'timestamp') return context.timestamp;
    if (fieldPath === 'entityType') return context.entityType;
    if (fieldPath === 'entityId') return context.entityId;

    // Navigate through entity object
    const parts = fieldPath.split('.');
    let current = context.entity;

    for (const part of parts) {
      // Handle array access (e.g., items[0])
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        current = current?.[arrayName]?.[parseInt(index, 10)];
      } else {
        current = current?.[part];
      }

      if (current === undefined || current === null) {
        return null;
      }
    }

    return current;
  }
}