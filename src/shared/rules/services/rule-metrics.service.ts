import { Injectable } from '@nestjs/common';
import { IRuleMetricsService, RuleStatistics, RuleEngineMetrics } from '../interfaces/rule-definition.interface';

@Injectable()
export class RuleMetricsService implements IRuleMetricsService {
  private ruleMetrics: Map<string, RuleStatistics> = new Map();
  private globalMetrics: RuleEngineMetrics = {
    totalExecutions: 0,
    totalRules: 0,
    activeRules: 0,
    averageExecutionTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    errorRate: 0,
    popularRules: [],
    recentErrors: [],
    executionByCategory: {},
    executionByHour: {}
  };

  async recordRuleExecution(ruleId: string, executionTime: number, matched: boolean, success: boolean): Promise<void> {
    const existing = this.ruleMetrics.get(ruleId) || {
      ruleId,
      executionCount: 0,
      matchCount: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      lastExecuted: new Date(),
      errorCount: 0,
      actionSuccessRate: 1.0
    };

    existing.executionCount++;
    existing.lastExecuted = new Date();
    existing.averageExecutionTime = (existing.averageExecutionTime * (existing.executionCount - 1) + executionTime) / existing.executionCount;

    if (matched) {
      existing.matchCount++;
    }

    if (!success) {
      existing.errorCount++;
    }

    existing.successRate = (existing.executionCount - existing.errorCount) / existing.executionCount;

    this.ruleMetrics.set(ruleId, existing);

    // Update global metrics
    this.globalMetrics.totalExecutions++;
  }

  async recordActionExecution(actionType: string, executionTime: number, success: boolean): Promise<void> {
    // In a real implementation, this would record action-specific metrics
    console.log(`Action ${actionType} executed in ${executionTime}ms, success: ${success}`);
  }

  async getRuleStatistics(ruleId: string): Promise<RuleStatistics> {
    const stats = this.ruleMetrics.get(ruleId);
    if (!stats) {
      return {
        ruleId,
        executionCount: 0,
        matchCount: 0,
        successRate: 1.0,
        averageExecutionTime: 0,
        lastExecuted: new Date(),
        errorCount: 0,
        actionSuccessRate: 1.0
      };
    }
    return stats;
  }

  async getEngineMetrics(): Promise<RuleEngineMetrics> {
    return { ...this.globalMetrics };
  }

  async getPopularRules(limit: number = 10): Promise<RuleStatistics[]> {
    return Array.from(this.ruleMetrics.values())
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, limit);
  }

  async getRecentErrors(limit: number = 10): Promise<any[]> {
    // In a real implementation, this would return actual recent errors
    return [];
  }

  async resetMetrics(): Promise<void> {
    this.ruleMetrics.clear();
    this.globalMetrics = {
      totalExecutions: 0,
      totalRules: 0,
      activeRules: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      errorRate: 0,
      popularRules: [],
      recentErrors: [],
      executionByCategory: {},
      executionByHour: {}
    };
  }
}