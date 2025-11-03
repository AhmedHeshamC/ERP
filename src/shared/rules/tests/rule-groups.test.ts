import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { RuleGroupService } from '../services/rule-group.service';
import { RulesEngineService } from '../services/rules-engine.service';
import {
  RuleDefinition,
  RuleGroup,
  RuleCategory,
  ComparisonOperator,
  ActionType,
  DataType,
  GroupExecutionMode,
  RuleExecutionContext,
  RuleEngineExecutionRequest,
  ExecutionMode
} from '../interfaces/rule-definition.interface';

describe('RuleGroupService', () => {
  let ruleGroupService: RuleGroupService;
  let rulesEngine: RulesEngineService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    ruleGroupService = new RuleGroupService();
    rulesEngine = new RulesEngineService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Rule Group Management', () => {
      it('should create a rule group', async () => {
        const groupData = {
          name: 'Order Validation Group',
          description: 'Group of rules for order validation',
          ruleIds: [],
          executionMode: GroupExecutionMode.ALL,
          stopOnFirstMatch: false,
          metadata: {
            department: 'sales',
            critical: true
          }
        };

        const group = await ruleGroupService.createRuleGroup(groupData);

        expect(group).to.not.be.undefined;
        expect(group.id).to.be.a('string');
        expect(group.name).to.equal(groupData.name);
        expect(group.executionMode).to.equal(GroupExecutionMode.ALL);
        expect(group.stopOnFirstMatch).to.be.false;
        expect(group.ruleIds).to.be.an('array');
        expect(group.metadata.department).to.equal('sales');
      });

      it('should update a rule group', async () => {
        const groupData = {
          name: 'Initial Group',
          description: 'Initial description',
          ruleIds: [],
          executionMode: GroupExecutionMode.ALL
        };

        const group = await ruleGroupService.createRuleGroup(groupData);

        const updates = {
          name: 'Updated Group',
          description: 'Updated description',
          executionMode: GroupExecutionMode.FIRST_MATCH,
          stopOnFirstMatch: true
        };

        const updatedGroup = await ruleGroupService.updateRuleGroup(group.id, updates);

        expect(updatedGroup.name).to.equal('Updated Group');
        expect(updatedGroup.description).to.equal('Updated description');
        expect(updatedGroup.executionMode).to.equal(GroupExecutionMode.FIRST_MATCH);
        expect(updatedGroup.stopOnFirstMatch).to.be.true;
      });

      it('should add rules to a group', async () => {
        // Create test rules
        const rule1 = await rulesEngine.createRule({
          name: 'Rule 1',
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
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'Rule 2',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'status',
              operator: ComparisonOperator.EQUALS,
              value: 'active',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.LOG_EVENT,
              parameters: {},
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create group
        const group = await ruleGroupService.createRuleGroup({
          name: 'Test Group',
          description: 'Group for testing',
          ruleIds: [],
          executionMode: GroupExecutionMode.ALL
        });

        // Add rules to group
        await ruleGroupService.addRuleToGroup(group.id, rule1.id);
        await ruleGroupService.addRuleToGroup(group.id, rule2.id);

        const updatedGroup = await ruleGroupService.getRuleGroup(group.id);

        expect(updatedGroup.ruleIds).to.have.lengthOf(2);
        expect(updatedGroup.ruleIds).to.include(rule1.id);
        expect(updatedGroup.ruleIds).to.include(rule2.id);
      });

      it('should remove rules from a group', async () => {
        const rule = await rulesEngine.createRule({
          name: 'Rule to Remove',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
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
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'Group with Rule',
          description: 'Group containing one rule',
          ruleIds: [rule.id],
          executionMode: GroupExecutionMode.ALL
        });

        expect(group.ruleIds).to.have.lengthOf(1);

        await ruleGroupService.removeRuleFromGroup(group.id, rule.id);

        const updatedGroup = await ruleGroupService.getRuleGroup(group.id);
        expect(updatedGroup.ruleIds).to.have.lengthOf(0);
      });

      it('should delete a rule group', async () => {
        const group = await ruleGroupService.createRuleGroup({
          name: 'Group to Delete',
          description: 'This group will be deleted',
          ruleIds: [],
          executionMode: GroupExecutionMode.ALL
        });

        expect(group.id).to.be.a('string');

        await ruleGroupService.deleteRuleGroup(group.id);

        const deletedGroup = await ruleGroupService.getRuleGroup(group.id);
        expect(deletedGroup).to.be.null;
      });

      it('should validate rule group before creation', async () => {
        const invalidGroupData = {
          name: '', // Empty name should be invalid
          description: 'Invalid group',
          ruleIds: [],
          executionMode: 'invalid_mode' as any
        };

        try {
          await ruleGroupService.createRuleGroup(invalidGroupData);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error.message).to.include('Invalid rule group');
          expect(error.message).to.include('name');
        }
      });
    });

    describe('Rule Group Execution', () => {
      it('should execute rule group with ALL mode', async () => {
        // Create rules
        const rule1 = await rulesEngine.createRule({
          name: 'Amount Check Rule',
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
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Amount check passed' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'Status Check Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'status',
              operator: ComparisonOperator.EQUALS,
              value: 'active',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Status check passed' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create group
        const group = await ruleGroupService.createRuleGroup({
          name: 'Validation Group',
          description: 'Group with ALL execution mode',
          ruleIds: [rule1.id, rule2.id],
          executionMode: GroupExecutionMode.ALL,
          stopOnFirstMatch: false
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-001',
          userId: 'user-001',
          timestamp: new Date(),
          entity: { amount: 100, status: 'active', orderId: 'order-001' },
          entityType: 'order',
          entityId: 'order-001',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(2);
        expect(result.matchedRules).to.equal(2); // Both rules should match
        expect(result.results).to.have.lengthOf(2);
      });

      it('should execute rule group with FIRST_MATCH mode', async () => {
        const rule1 = await rulesEngine.createRule({
          name: 'High Priority Rule',
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
              type: ActionType.APPROVE,
              parameters: { reason: 'High priority approval' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'Low Priority Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Low priority processing' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'First Match Group',
          description: 'Group with FIRST_MATCH execution mode',
          ruleIds: [rule1.id, rule2.id],
          executionMode: GroupExecutionMode.FIRST_MATCH,
          stopOnFirstMatch: true
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-002',
          userId: 'user-002',
          timestamp: new Date(),
          entity: { amount: 1500, orderId: 'order-002' },
          entityType: 'order',
          entityId: 'order-002',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(1); // Only first matching rule should execute
        expect(result.matchedRules).to.equal(1);
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].ruleId).to.equal(rule1.id); // Higher priority rule should match first
      });

      it('should execute rule group with BEST_MATCH mode', async () => {
        const rule1 = await rulesEngine.createRule({
          name: 'Medium Priority Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 5,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'customerType',
              operator: ComparisonOperator.EQUALS,
              value: 'regular',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.CALCULATE,
              parameters: { discount: 0.05 },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'High Priority Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'customerType',
              operator: ComparisonOperator.EQUALS,
              value: 'premium',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.CALCULATE,
              parameters: { discount: 0.15 },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'Best Match Group',
          description: 'Group with BEST_MATCH execution mode',
          ruleIds: [rule1.id, rule2.id],
          executionMode: GroupExecutionMode.BEST_MATCH
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-003',
          userId: 'user-003',
          timestamp: new Date(),
          entity: { customerType: 'premium', orderId: 'order-003' },
          entityType: 'order',
          entityId: 'order-003',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(2); // Should evaluate all rules
        expect(result.matchedRules).to.equal(1); // Only best match should execute
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].ruleId).to.equal(rule2.id); // Higher priority rule should win
      });

      it('should execute rule group with AGGREGATE mode', async () => {
        const rule1 = await rulesEngine.createRule({
          name: 'Discount Rule 1',
          version: '1.0.0',
          category: RuleCategory.DISCOUNT,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'quantity',
              operator: ComparisonOperator.GREATER_THAN,
              value: 5,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.CALCULATE,
              parameters: { discount: 0.1, discountType: 'volume' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'Discount Rule 2',
          version: '1.0.0',
          category: RuleCategory.DISCOUNT,
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
              type: ActionType.CALCULATE,
              parameters: { discount: 0.05, discountType: 'segment' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'Aggregate Discount Group',
          description: 'Group with AGGREGATE execution mode',
          ruleIds: [rule1.id, rule2.id],
          executionMode: GroupExecutionMode.AGGREGATE
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-004',
          userId: 'user-004',
          timestamp: new Date(),
          entity: {
            quantity: 10,
            customerSegment: 'premium',
            basePrice: 100,
            orderId: 'order-004'
          },
          entityType: 'order',
          entityId: 'order-004',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(2);
        expect(result.matchedRules).to.equal(2); // Both rules should match
        expect(result.results).to.have.lengthOf(2);

        // Both discounts should be applied and aggregated
        const discounts = result.results.map(r => r.actions[0].result.discount);
        expect(discounts).to.include(0.1);
        expect(discounts).to.include(0.05);
      });
    });

    describe('Rule Group Precedence', () => {
      it('should respect rule precedence within groups', async () => {
        // Create rules with different priorities
        const lowPriorityRule = await rulesEngine.createRule({
          name: 'Low Priority Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 10, // Low priority (higher number)
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
              type: ActionType.SET_FIELD,
              parameters: { field: 'priority', value: 'low' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const highPriorityRule = await rulesEngine.createRule({
          name: 'High Priority Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1, // High priority (lower number)
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.SET_FIELD,
              parameters: { field: 'priority', value: 'high' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create group with rules in reverse order (low priority first)
        const group = await ruleGroupService.createRuleGroup({
          name: 'Precedence Test Group',
          description: 'Testing rule precedence',
          ruleIds: [lowPriorityRule.id, highPriorityRule.id],
          executionMode: GroupExecutionMode.BEST_MATCH
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-005',
          userId: 'user-005',
          timestamp: new Date(),
          entity: { amount: 100, orderId: 'order-005' },
          entityType: 'order',
          entityId: 'order-005',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].ruleId).to.equal(highPriorityRule.id); // High priority should win
        expect(result.results[0].actions[0].result.priority).to.equal('high');
      });

      it('should handle rule precedence with equal priority (order of insertion)', async () => {
        const rule1 = await rulesEngine.createRule({
          name: 'First Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 5, // Same priority
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
              type: ActionType.SET_FIELD,
              parameters: { field: 'winner', value: 'rule1' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const rule2 = await rulesEngine.createRule({
          name: 'Second Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 5, // Same priority
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.SET_FIELD,
              parameters: { field: 'winner', value: 'rule2' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create group with rule1 first, then rule2
        const group = await ruleGroupService.createRuleGroup({
          name: 'Equal Priority Group',
          description: 'Testing equal priority precedence',
          ruleIds: [rule1.id, rule2.id],
          executionMode: GroupExecutionMode.FIRST_MATCH
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-006',
          userId: 'user-006',
          timestamp: new Date(),
          entity: { amount: 100, orderId: 'order-006' },
          entityType: 'order',
          entityId: 'order-006',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].ruleId).to.equal(rule1.id); // First rule should win
        expect(result.results[0].actions[0].result.winner).to.equal('rule1');
      });

      it('should handle nested rule groups', async () => {
        // Create base rules
        const baseRule1 = await rulesEngine.createRule({
          name: 'Base Rule 1',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'validated',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: { field: 'status', value: 'base_validated' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const baseRule2 = await rulesEngine.createRule({
          name: 'Base Rule 2',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'amount',
              operator: ComparisonOperator.LESS_THAN,
              value: 1000,
              dataType: DataType.NUMBER
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.SET_FIELD,
              parameters: { field: 'level', value: 'standard' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create base group
        const baseGroup = await ruleGroupService.createRuleGroup({
          name: 'Base Validation Group',
          description: 'Base level validation',
          ruleIds: [baseRule1.id, baseRule2.id],
          executionMode: GroupExecutionMode.ALL
        });

        // Create advanced rules
        const advancedRule = await rulesEngine.createRule({
          name: 'Advanced Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-3',
              field: 'requiresAdvanced',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
            }
          ],
          actions: [
            {
              id: 'act-3',
              type: ActionType.SET_FIELD,
              parameters: { field: 'status', value: 'advanced_validated' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        // Create advanced group that includes base group rules
        const advancedGroup = await ruleGroupService.createRuleGroup({
          name: 'Advanced Validation Group',
          description: 'Advanced level validation with base rules',
          ruleIds: [baseRule1.id, baseRule2.id, advancedRule.id],
          executionMode: GroupExecutionMode.ALL
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-007',
          userId: 'user-007',
          timestamp: new Date(),
          entity: {
            validated: true,
            amount: 500,
            requiresAdvanced: true,
            orderId: 'order-007'
          },
          entityType: 'order',
          entityId: 'order-007',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(advancedGroup.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(3);
        expect(result.matchedRules).to.equal(3);
        expect(result.results).to.have.lengthOf(3);
      });
    });

    describe('Rule Group Error Handling', () => {
      it('should handle missing rule group gracefully', async () => {
        const context: RuleExecutionContext = {
          correlationId: 'test-group-error-001',
          userId: 'user-error-001',
          timestamp: new Date(),
          entity: { test: true },
          entityType: 'test',
          entityId: 'test-001',
          context: {}
        };

        try {
          await rulesEngine.executeRuleGroup('non-existent-group-id', context);
          expect.fail('Should have thrown error for non-existent group');
        } catch (error) {
          expect(error.message).to.include('Rule group not found');
        }
      });

      it('should handle disabled rules in group', async () => {
        const enabledRule = await rulesEngine.createRule({
          name: 'Enabled Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Enabled rule executed' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const disabledRule = await rulesEngine.createRule({
          name: 'Disabled Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: false, // Disabled rule
          conditions: [
            {
              id: 'cond-2',
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Disabled rule executed' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'Mixed Enabled Group',
          description: 'Group with enabled and disabled rules',
          ruleIds: [enabledRule.id, disabledRule.id],
          executionMode: GroupExecutionMode.ALL
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-008',
          userId: 'user-008',
          timestamp: new Date(),
          entity: { test: true },
          entityType: 'test',
          entityId: 'test-002',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(1); // Only enabled rule should execute
        expect(result.matchedRules).to.equal(1);
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].ruleId).to.equal(enabledRule.id);
      });

      it('should handle rule execution failures in group', async () => {
        const successRule = await rulesEngine.createRule({
          name: 'Success Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              value: true,
              dataType: DataType.BOOLEAN
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Success' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const failureRule = await rulesEngine.createRule({
          name: 'Failure Rule',
          version: '1.0.0',
          category: RuleCategory.BUSINESS_VALIDATION,
          priority: 2,
          enabled: true,
          conditions: [
            {
              id: 'cond-2',
              field: 'nonExistentField',
              operator: ComparisonOperator.EQUALS,
              value: 'test',
              dataType: DataType.STRING
            }
          ],
          actions: [
            {
              id: 'act-2',
              type: ActionType.LOG_EVENT,
              parameters: { message: 'Should not execute' },
              order: 1
            }
          ],
          createdBy: 'test-user'
        });

        const group = await ruleGroupService.createRuleGroup({
          name: 'Mixed Results Group',
          description: 'Group with successful and failed rules',
          ruleIds: [successRule.id, failureRule.id],
          executionMode: GroupExecutionMode.ALL
        });

        const context: RuleExecutionContext = {
          correlationId: 'test-group-009',
          userId: 'user-009',
          timestamp: new Date(),
          entity: { test: true },
          entityType: 'test',
          entityId: 'test-003',
          context: {}
        };

        const result = await rulesEngine.executeRuleGroup(group.id, context);

        expect(result).to.not.be.undefined;
        expect(result.totalRules).to.equal(2);
        expect(result.results).to.have.lengthOf(2);
        expect(result.errors).to.have.length.greaterThan(0);

        // One rule should succeed, one should fail
        const successResults = result.results.filter(r => r.matched);
        const failureResults = result.results.filter(r => r.error);

        expect(successResults).to.have.lengthOf(1);
        expect(failureResults).to.have.lengthOf(1);
      });
    });
  });
});