import { Module } from '@nestjs/common';
import { RulesEngineService } from './services/rules-engine.service';
import { RuleDefinitionService } from './services/rule-definition.service';
import { RuleExecutionService } from './services/rule-execution.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { ActionExecutorService } from './services/action-executor.service';
import { RuleGroupService } from './services/rule-group.service';
import { RuleTemplateService } from './services/rule-template.service';
import { RuleCacheService } from './services/rule-cache.service';
import { RuleEventService } from './services/rule-event.service';
import { RuleMetricsService } from './services/rule-metrics.service';
import { RuleValidationService } from './services/rule-validation.service';

@Module({
  providers: [
    RulesEngineService,
    RuleDefinitionService,
    RuleExecutionService,
    ConditionEvaluatorService,
    ActionExecutorService,
    RuleGroupService,
    RuleTemplateService,
    RuleCacheService,
    RuleEventService,
    RuleMetricsService,
    RuleValidationService,
  ],
  exports: [
    RulesEngineService,
    RuleDefinitionService,
    RuleExecutionService,
    ConditionEvaluatorService,
    ActionExecutorService,
    RuleGroupService,
    RuleTemplateService,
    RuleCacheService,
    RuleEventService,
    RuleMetricsService,
    RuleValidationService,
  ],
})
export class RulesModule {}