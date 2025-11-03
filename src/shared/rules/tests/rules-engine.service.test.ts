import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { RulesEngineService } from '../services/rules-engine.service';
import {
  RuleDefinition,
  RuleCategory,
  ComparisonOperator,
  ActionType,
  DataType,
  RuleExecutionContext,
  RuleEngineExecutionRequest,
  ExecutionMode
} from '../interfaces/rule-definition.interface';

describe('RulesEngineService', () => {
  let rulesEngine: RulesEngineService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    rulesEngine = new RulesEngineService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Basic Rule Definition and Evaluation', () => {
      it('should create a new rule definition', async () => {
        const ruleData = {
          name: 'Test Credit Limit Rule',
          description: 'Validates customer credit limit',
          version: '1.0.0',
          category: RuleCategory.FINANCIAL,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'condition-1',
              field: 'orderAmount',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              value: 1000,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'action-1',
              type: ActionType.APPROVE,
              parameters: { reason: 'Within credit limit' },
              order: 1
            }
          ],
          createdBy: 'user-123'
        };

        const rule = await rulesEngine.createRule(ruleData);

        expect(rule).to.not.be.undefined;
        expect(rule.id).to.be.a('string');
        expect(rule.name).to.equal(ruleData.name);
        expect(rule.category).to.equal(RuleCategory.FINANCIAL);
        expect(rule.enabled).to.be.true;
        expect(rule.conditions).to.have.lengthOf(1);
        expect(rule.actions).to.have.lengthOf(1);
        expect(rule.createdAt).to.be.a('date');
        expect(rule.updatedAt).to.be.a('date');
      });

      it('should evaluate a simple rule that matches conditions', async () => {
        const rule: RuleDefinition = {
          id: 'simple-rule-1',
          name: 'Simple Approval Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              value: 500,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: { reason: 'Amount within limit' },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-001',
          userId: 'user-123',
          timestamp: new Date(),
          entity: { amount: 300, customerId: 'customer-001' },
          entityType: 'order',
          entityId: 'order-001',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].ruleId).to.equal(rule.id);
        expect(result.summary.ruleResults.matched).to.equal(1);
        expect(result.summary.ruleResults.notMatched).to.equal(0);
      });

      it('should evaluate a simple rule that does not match conditions', async () => {
        const rule: RuleDefinition = {
          id: 'simple-rule-2',
          name: 'Simple Rejection Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 1000,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.REJECT,
              parameters: { reason: 'Amount too low' },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-002',
          userId: 'user-456',
          timestamp: new Date(),
          entity: { amount: 500, customerId: 'customer-002' },
          entityType: 'order',
          entityId: 'order-002',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.false;
        expect(result.results[0].ruleId).to.equal(rule.id);
        expect(result.summary.ruleResults.matched).to.equal(0);
        expect(result.summary.ruleResults.notMatched).to.equal(1);
      });

      it('should execute multiple rules in a single request', async () => {
        const rules = [
          {
            id: 'multi-rule-1',
            name: 'Rule 1 - Amount Check',
            version: '1.0.0',
            category: RuleCategory.BUSINESS_VALIDATION,
            priority: 1,
            enabled: true,
            conditions: [
              {
                id: 'cond-1',
                field: 'amount',
                operator: ComparisonOperator.GREATER_THAN,
                value: 100,
                dataType: DataType.NUMBER
              }
            ],
            actions: [
              {
                id: 'act-1',
                type: ActionType.LOG_EVENT,
                parameters: { message: 'Amount check passed' },
                order: 1
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user'
          },
          {
            id: 'multi-rule-2',
            name: 'Rule 2 - Customer Check',
            version: '1.0.0',
            category: RuleCategory.BUSINESS_VALIDATION,
            priority: 2,
            enabled: true,
            conditions: [
              {
                id: 'cond-2',
                field: 'customerSegment',
                operator: ComparisonOperator.EQUALS,
                value: 'premium',
                dataType: DataType.STRING
              }
            ],
            actions: [
              {
                id: 'act-2',
                type: ActionType.APPROVE,
                parameters: { reason: 'Premium customer approval' },
                order: 1
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user'
          }
        ];

        // Create rules first
        for (const ruleData of rules) {
          await rulesEngine.createRule(ruleData);
        }

        const request: RuleEngineExecutionRequest = {
          ruleIds: ['multi-rule-1', 'multi-rule-2'],
          context: {
            correlationId: 'test-correlation-003',
            userId: 'user-789',
            timestamp: new Date(),
            entity: { amount: 500, customerSegment: 'premium', customerId: 'customer-003' },
            entityType: 'order',
            entityId: 'order-003',
            context: {}
          },
          executionMode: ExecutionMode.SYNCHRONOUS,
          returnConditionDetails: true,
          returnActionResults: true
        };

        const result = await rulesEngine.executeRules(request);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(2);
        expect(result.matchedRules).to.equal(2);
        expect(result.results).to.have.lengthOf(2);
        expect(result.summary.ruleResults.matched).to.equal(2);
        expect(result.summary.ruleResults.notMatched).to.equal(0);
        expect(result.executionTime).to.be.a('number');
      });

      it('should handle rule execution errors gracefully', async () => {
        const rule: RuleDefinition = {
          id: 'error-rule-1',
          name: 'Error Prone Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'nonExistentField',
              operator: ComparisonOperator.EQUALS,
              value: 'test',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: { reason: 'Should not reach here' },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-004',
          userId: 'user-error',
          timestamp: new Date(),
          entity: { someOtherField: 'value' },
          entityType: 'order',
          entityId: 'order-error',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.false;
        expect(result.results[0].error).to.not.be.undefined;
        expect(result.errors).to.have.length.greaterThan(0);
        expect(result.summary.ruleResults.errors).to.equal(1);
      });

      it('should validate rule definition before creation', async () => {
        const invalidRuleData = {
          name: 'Invalid Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [], // Empty conditions should be invalid
          actions: [], // Empty actions should be invalid
          createdBy: 'test-user'
        };

        try {
          await rulesEngine.createRule(invalidRuleData);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error.message).to.include('Invalid rule definition');
          expect(error.message).to.include('conditions');
        }
      });

      it('should enable and disable rules', async () => {
        const ruleData = {
          name: 'Toggle Rule',
          description: 'Rule for testing enable/disable',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'status',
              operator: ComparisonOperator.EQUALS,
              value: 'active',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: {},
              order: 1
            }
          ],
          createdBy: 'test-user'
        };

        const rule = await rulesEngine.createRule(ruleData);
        expect(rule.enabled).to.be.true;

        // Disable rule
        await rulesEngine.disableRule(rule.id);
        const disabledRule = await rulesEngine.getRule(rule.id);
        expect(disabledRule.enabled).to.be.false;

        // Enable rule
        await rulesEngine.enableRule(rule.id);
        const enabledRule = await rulesEngine.getRule(rule.id);
        expect(enabledRule.enabled).to.be.true;
      });

      it('should search rules by text query', async () => {
        // Create test rules
        const ruleData1 = {
          name: 'Credit Limit Validation Rule',
          description: 'Validates customer credit limits',
          version: '1.0.0',
          category: RuleCategory.FINANCIAL,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'creditLimit',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: {},
              order: 1
            }
          ],
          createdBy: 'test-user'
        };

        const ruleData2 = {
          name: 'Inventory Check Rule',
          description: 'Checks inventory availability',
          version: '1.0.0',
          category: RuleCategory.INVENTORY,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'stock',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.APPROVE,
              parameters: {},
              order: 1
            }
          ],
          createdBy: 'test-user'
        };

        await rulesEngine.createRule(ruleData1);
        await rulesEngine.createRule(ruleData2);

        // Search for credit-related rules
        const creditRules = await rulesEngine.searchRules('credit');
        expect(creditRules).to.have.lengthOf(1);
        expect(creditRules[0].name).to.include('Credit');

        // Search for validation rules
        const validationRules = await rulesEngine.searchRules('validation');
        expect(validationRules).to.have.lengthOf(1);
        expect(validationRules[0].description).to.include('Validates');
      });

      it('should test rule execution in dry run mode', async () => {
        const rule: RuleDefinition = {
          id: 'dry-run-rule-1',
          name: 'Dry Run Test Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: ComparisonOperator.LESS_THAN,
              value: 1000,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SEND_EMAIL,
              parameters: { to: 'test@example.com' },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-dry-run',
          userId: 'user-dry-run',
          timestamp: new Date(),
          entity: { amount: 500, email: 'customer@example.com' },
          entityType: 'order',
          entityId: 'order-dry-run',
          context: {}
        };

        const result = await rulesEngine.testRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(1);
        // In dry run mode, actions should be evaluated but not actually executed
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.metadata.dryRun).to.be.true;
      });

      it('should handle complex rule with multiple conditions and logical operators', async () => {
        const rule: RuleDefinition = {
          id: 'complex-rule-1',
          name: 'Complex Business Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 100,
              dataType: DataType.NUMBER
            },
            {
              id: 'cond-2',
              field: 'customerSegment',
              operator: ComparisonOperator.IN,
              value: ['premium', 'vip'],
              dataType: DataType.ARRAY
            },
            {
              id: 'cond-3',
              field: 'orderDate',
              operator: ComparisonOperator.GREATER_THAN,
              value: new Date('2024-01-01'),
              dataType: DataType.DATE
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: { reason: 'Complex rule conditions met' },
              order: 1
            },
            {
              id: 'act-2',
              type: ActionType.SET_FIELD,
              parameters: { field: 'priority', value: 'high' },
              order: 2
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-complex',
          userId: 'user-complex',
          timestamp: new Date(),
          entity: {
            amount: 500,
            customerSegment: 'premium',
            orderDate: new Date('2024-06-15'),
            orderId: 'order-complex-001'
          },
          entityType: 'order',
          entityId: 'order-complex-001',
          context: { region: 'US' }
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].conditions).to.have.lengthOf(3);
        expect(result.results[0].actions).to.have.lengthOf(2);

        // Check that all conditions were evaluated correctly
        const conditionResults = result.results[0].conditions;
        expect(conditionResults.every(c => c.result === true)).to.be.true;
      });
    });

    describe('Rule Engine Service Methods', () => {
      it('should get rule statistics', async () => {
        const ruleId = 'stats-rule-1';

        // Execute rule multiple times to generate statistics
        const rule: RuleDefinition = {
          id: ruleId,
          name: 'Statistics Test Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: {},
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        await rulesEngine.createRule(rule);

        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-stats',
          userId: 'user-stats',
          timestamp: new Date(),
          entity: { amount: 100 },
          entityType: 'order',
          entityId: 'order-stats-001',
          context: {}
        };

        // Execute rule multiple times
        for (let i = 0; i < 5; i++) {
          await rulesEngine.executeRule(ruleId, context);
        }

        const statistics = await rulesEngine.getRuleStatistics(ruleId);

        expect(statistics).to.not.be.undefined;
        expect(statistics.ruleId).to.equal(ruleId);
        expect(statistics.executionCount).to.equal(5);
        expect(statistics.matchCount).to.equal(5);
        expect(statistics.successRate).to.equal(1.0);
        expect(statistics.averageExecutionTime).to.be.a('number');
        expect(statistics.lastExecuted).to.be.a('date');
      });

      it('should get engine metrics', async () => {
        // Create multiple rules and execute them
        const rules = [
          {
            id: 'metrics-rule-1',
            name: 'Metrics Rule 1',
            version: '1.0.0',
            category: RuleCategory.BUSINESS_VALIDATION,
            priority: 1,
            enabled: true,
            conditions: [
              {
                id: 'cond-1',
                field: 'type',
                operator: ComparisonOperator.EQUALS,
                value: 'A',
                dataType: DataType.STRING
              }
            ],
            actions: [
              {
                id: 'act-1',
                type: ActionType.APPROVE,
                parameters: {},
                order: 1
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user'
          },
          {
            id: 'metrics-rule-2',
            name: 'Metrics Rule 2',
            version: '1.0.0',
            category: RuleCategory.FINANCIAL,
            priority: 2,
            enabled: true,
            conditions: [
              {
                id: 'cond-2',
                field: 'type',
                operator: ComparisonOperator.EQUALS,
                value: 'B',
                dataType: DataType.STRING
              }
            ],
            actions: [
              {
                id: 'act-2',
                type: ActionType.REJECT,
                parameters: {},
                order: 1
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user'
          }
        ];

        for (const ruleData of rules) {
          await rulesEngine.createRule(ruleData);
        }

        // Execute rules
        const context: RuleExecutionContext = {
          correlationId: 'test-correlation-metrics',
          userId: 'user-metrics',
          timestamp: new Date(),
          entity: { type: 'A' },
          entityType: 'test',
          entityId: 'test-metrics-001',
          context: {}
        };

        await rulesEngine.executeRule('metrics-rule-1', context);
        await rulesEngine.executeRule('metrics-rule-2', context);

        const metrics = await rulesEngine.getEngineMetrics();

        expect(metrics).to.not.be.undefined;
        expect(metrics.totalRules).to.be.greaterThan(0);
        expect(metrics.activeRules).to.be.greaterThan(0);
        expect(metrics.totalExecutions).to.be.greaterThan(0);
        expect(metrics.averageExecutionTime).to.be.a('number');
        expect(metrics.errorRate).to.be.a('number');
        expect(metrics.executionByCategory).to.be.an('object');
      });
    });
  });
});