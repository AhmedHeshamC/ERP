import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { RuleExecutionService } from '../services/rule-execution.service';
import {
  RuleDefinition,
  RuleAction,
  ActionType,
  RuleExecutionContext,
  RuleEngineExecutionResponse
} from '../interfaces/rule-definition.interface';

describe('RuleExecutionService', () => {
  let ruleExecutor: RuleExecutionService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    ruleExecutor = new RuleExecutionService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Action Execution', () => {
      it('should execute SET_FIELD action', async () => {
        const rule: RuleDefinition = {
          id: 'set-field-rule-1',
          name: 'Set Field Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'status',
              operator: 'equals' as any,
              value: 'pending',
              dataType: 'string' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: {
                field: 'status',
                value: 'approved'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-001',
          userId: 'user-001',
          timestamp: new Date(),
          entity: { status: 'pending', orderId: 'order-001' },
          entityType: 'order',
          entityId: 'order-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results).to.have.lengthOf(1);
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(1);
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.status).to.equal('approved');
      });

      it('should execute SEND_NOTIFICATION action', async () => {
        const rule: RuleDefinition = {
          id: 'notification-rule-1',
          name: 'Send Notification Rule',
          version: '1.0.0',
          category: 'notification' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'urgent',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SEND_NOTIFICATION,
              parameters: {
                recipient: 'manager@company.com',
                subject: 'Urgent Order Alert',
                message: 'Order {{orderId}} requires immediate attention',
                priority: 'high'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-002',
          userId: 'user-002',
          timestamp: new Date(),
          entity: { urgent: true, orderId: 'order-002', customerName: 'John Doe' },
          entityType: 'order',
          entityId: 'order-002',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.notificationId).to.be.a('string');
      });

      it('should execute TRIGGER_WORKFLOW action', async () => {
        const rule: RuleDefinition = {
          id: 'workflow-trigger-rule-1',
          name: 'Trigger Workflow Rule',
          version: '1.0.0',
          category: 'workflow' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'requiresApproval',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.TRIGGER_WORKFLOW,
              parameters: {
                workflowId: 'approval-workflow',
                input: {
                  entityId: '{{entityId}}',
                  entityType: '{{entityType}}',
                  amount: '{{amount}}',
                  requestor: '{{userId}}'
                },
                priority: 'high'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-003',
          userId: 'user-003',
          timestamp: new Date(),
          entity: { requiresApproval: true, amount: 5000 },
          entityType: 'expense',
          entityId: 'expense-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.workflowInstanceId).to.be.a('string');
      });

      it('should execute CALL_API action', async () => {
        const rule: RuleDefinition = {
          id: 'api-call-rule-1',
          name: 'API Call Rule',
          version: '1.0.0',
          category: 'integration' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'syncRequired',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.CALL_API,
              parameters: {
                url: 'https://api.external.com/webhook',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer {{apiKey}}'
                },
                body: {
                  entityId: '{{entityId}}',
                  entityType: '{{entityType}}',
                  timestamp: '{{timestamp}}',
                  data: '{{entity}}'
                },
                timeout: 5000
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-004',
          userId: 'user-004',
          timestamp: new Date(),
          entity: { syncRequired: true, customerName: 'Jane Smith', email: 'jane@example.com' },
          entityType: 'customer',
          entityId: 'customer-001',
          context: { apiKey: 'test-api-key-123' }
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.response).to.not.be.undefined;
      });

      it('should execute EXECUTE_SCRIPT action', async () => {
        const rule: RuleDefinition = {
          id: 'script-rule-1',
          name: 'Execute Script Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'calculateDiscount',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.EXECUTE_SCRIPT,
              parameters: {
                script: `
                  const basePrice = entity.basePrice;
                  const quantity = entity.quantity;
                  const customerSegment = entity.customerSegment;

                  let discount = 0;
                  if (quantity > 10) discount += 0.1;
                  if (customerSegment === 'premium') discount += 0.15;
                  if (basePrice > 1000) discount += 0.05;

                  const finalPrice = basePrice * (1 - discount) * quantity;

                  return {
                    discount: discount,
                    finalPrice: finalPrice,
                    savings: basePrice * quantity - finalPrice
                  };
                `,
                language: 'javascript',
                timeout: 1000
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-005',
          userId: 'user-005',
          timestamp: new Date(),
          entity: {
            calculateDiscount: true,
            basePrice: 100,
            quantity: 15,
            customerSegment: 'premium'
          },
          entityType: 'quote',
          entityId: 'quote-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.discount).to.be.a('number');
        expect(result.results[0].actions[0].result.finalPrice).to.be.a('number');
      });

      it('should execute APPROVE action', async () => {
        const rule: RuleDefinition = {
          id: 'approve-rule-1',
          name: 'Auto Approve Rule',
          version: '1.0.0',
          category: 'approval' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: 'less_than_or_equal' as any,
              value: 500,
              dataType: 'number' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.APPROVE,
              parameters: {
                reason: 'Auto-approved: Amount within limits',
                approver: 'system',
                conditions: 'amount <= 500'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-006',
          userId: 'user-006',
          timestamp: new Date(),
          entity: { amount: 350, expenseType: 'travel' },
          entityType: 'expense',
          entityId: 'expense-002',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.approved).to.be.true;
        expect(result.results[0].actions[0].result.approvalId).to.be.a('string');
      });

      it('should execute REJECT action', async () => {
        const rule: RuleDefinition = {
          id: 'reject-rule-1',
          name: 'Auto Reject Rule',
          version: '1.0.0',
          category: 'approval' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'amount',
              operator: 'greater_than' as any,
              value: 10000,
              dataType: 'number' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.REJECT,
              parameters: {
                reason: 'Auto-rejected: Amount exceeds limits',
                rejector: 'system',
                conditions: 'amount > 10000'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-007',
          userId: 'user-007',
          timestamp: new Date(),
          entity: { amount: 15000, requestType: 'purchase' },
          entityType: 'request',
          entityId: 'request-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.rejected).to.be.true;
        expect(result.results[0].actions[0].result.rejectionId).to.be.a('string');
      });

      it('should execute ESCALATE action', async () => {
        const rule: RuleDefinition = {
          id: 'escalate-rule-1',
          name: 'Escalate Rule',
          version: '1.0.0',
          category: 'approval' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'urgency',
              operator: 'equals' as any,
              value: 'critical',
              dataType: 'string' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.ESCALATE,
              parameters: {
                escalateTo: 'director',
                reason: 'Critical urgency requires director attention',
                deadline: '2024-12-31T23:59:59Z',
                notifyEmails: ['director@company.com', 'manager@company.com']
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-008',
          userId: 'user-008',
          timestamp: new Date(),
          entity: { urgency: 'critical', issueType: 'security' },
          entityType: 'incident',
          entityId: 'incident-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.escalated).to.be.true;
        expect(result.results[0].actions[0].result.escalationId).to.be.a('string');
      });

      it('should execute LOG_EVENT action', async () => {
        const rule: RuleDefinition = {
          id: 'log-rule-1',
          name: 'Log Event Rule',
          version: '1.0.0',
          category: 'monitoring' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'anomalyDetected',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.LOG_EVENT,
              parameters: {
                level: 'warning',
                message: 'Anomaly detected in {{entityType}} {{entityId}}',
                details: {
                  anomalyType: '{{anomalyType}}',
                  severity: '{{severity}}',
                  timestamp: '{{timestamp}}'
                },
                tags: ['anomaly', '{{entityType}}', 'monitoring']
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-009',
          userId: 'user-009',
          timestamp: new Date(),
          entity: {
            anomalyDetected: true,
            anomalyType: 'unusual_access_pattern',
            severity: 'medium'
          },
          entityType: 'user_session',
          entityId: 'session-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.logId).to.be.a('string');
      });

      it('should execute UPDATE_DATABASE action', async () => {
        const rule: RuleDefinition = {
          id: 'db-update-rule-1',
          name: 'Database Update Rule',
          version: '1.0.0',
          category: 'data_management' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'status',
              operator: 'equals' as any,
              value: 'processed',
              dataType: 'string' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.UPDATE_DATABASE,
              parameters: {
                table: 'orders',
                operation: 'update',
                where: { id: '{{entityId}}' },
                data: {
                  status: 'completed',
                  processedAt: '{{timestamp}}',
                  processedBy: '{{userId}}'
                }
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-010',
          userId: 'user-010',
          timestamp: new Date(),
          entity: { status: 'processed', totalAmount: 250 },
          entityType: 'order',
          entityId: 'order-003',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.updated).to.be.true;
        expect(result.results[0].actions[0].result.affectedRows).to.be.a('number');
      });

      it('should execute SEND_EMAIL action', async () => {
        const rule: RuleDefinition = {
          id: 'email-rule-1',
          name: 'Send Email Rule',
          version: '1.0.0',
          category: 'notification' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'sendWelcomeEmail',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SEND_EMAIL,
              parameters: {
                to: '{{email}}',
                cc: ['manager@company.com'],
                subject: 'Welcome to Our Platform!',
                template: 'welcome-email',
                templateData: {
                  customerName: '{{name}}',
                  activationLink: '{{activationLink}}'
                },
                priority: 'normal'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-011',
          userId: 'user-011',
          timestamp: new Date(),
          entity: {
            sendWelcomeEmail: true,
            name: 'Alice Johnson',
            email: 'alice@example.com',
            activationLink: 'https://app.example.com/activate/abc123'
          },
          entityType: 'customer',
          entityId: 'customer-002',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.emailId).to.be.a('string');
        expect(result.results[0].actions[0].result.sent).to.be.true;
      });

      it('should execute CALCULATE action', async () => {
        const rule: RuleDefinition = {
          id: 'calculate-rule-1',
          name: 'Calculate Rule',
          version: '1.0.0',
          category: 'calculation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'calculateTax',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.CALCULATE,
              parameters: {
                expression: 'amount * taxRate + shippingCost',
                variables: {
                  amount: '{{amount}}',
                  taxRate: 0.08,
                  shippingCost: 10
                },
                precision: 2,
                targetField: 'totalAmount'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-012',
          userId: 'user-012',
          timestamp: new Date(),
          entity: { calculateTax: true, amount: 100 },
          entityType: 'invoice',
          entityId: 'invoice-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.totalAmount).to.equal(118); // 100 * 0.08 + 10
      });
    });

    describe('Multiple Actions Execution', () => {
      it('should execute multiple actions in order', async () => {
        const rule: RuleDefinition = {
          id: 'multi-action-rule-1',
          name: 'Multiple Actions Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'premiumCustomer',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: {
                field: 'priority',
                value: 'high'
              },
              order: 1
            },
            {
              id: 'act-2',
              type: ActionType.CALCULATE,
              parameters: {
                expression: 'amount * 0.9', // 10% discount
                targetField: 'discountedAmount'
              },
              order: 2
            },
            {
              id: 'act-3',
              type: ActionType.SEND_NOTIFICATION,
              parameters: {
                recipient: 'premium@company.com',
                subject: 'Premium Customer Order',
                message: 'Premium order {{entityId}} received'
              },
              order: 3
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-013',
          userId: 'user-013',
          timestamp: new Date(),
          entity: {
            premiumCustomer: true,
            amount: 500,
            orderId: 'order-004'
          },
          entityType: 'order',
          entityId: 'order-004',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(3);

        // Verify actions executed in order
        expect(result.results[0].actions[0].actionId).to.equal('act-1');
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[1].actionId).to.equal('act-2');
        expect(result.results[0].actions[1].success).to.be.true;
        expect(result.results[0].actions[2].actionId).to.equal('act-3');
        expect(result.results[0].actions[2].success).to.be.true;
      });

      it('should handle action failure gracefully', async () => {
        const rule: RuleDefinition = {
          id: 'action-failure-rule-1',
          name: 'Action Failure Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'processOrder',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: {
                field: 'status',
                value: 'processing'
              },
              order: 1
            },
            {
              id: 'act-2',
              type: ActionType.CALL_API,
              parameters: {
                url: 'https://invalid-url-that-will-fail.com',
                method: 'POST'
              },
              order: 2
            },
            {
              id: 'act-3',
              type: ActionType.LOG_EVENT,
              parameters: {
                level: 'error',
                message: 'Order processing failed'
              },
              order: 3
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-014',
          userId: 'user-014',
          timestamp: new Date(),
          entity: { processOrder: true, orderId: 'order-005' },
          entityType: 'order',
          entityId: 'order-005',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(3);

        // First action should succeed
        expect(result.results[0].actions[0].success).to.be.true;

        // Second action should fail
        expect(result.results[0].actions[1].success).to.be.false;
        expect(result.results[0].actions[1].error).to.not.be.undefined;

        // Third action should still execute
        expect(result.results[0].actions[2].success).to.be.true;
      });

      it('should execute conditional actions', async () => {
        const rule: RuleDefinition = {
          id: 'conditional-action-rule-1',
          name: 'Conditional Action Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'orderPlaced',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: {
                field: 'status',
                value: 'confirmed'
              },
              order: 1
            },
            {
              id: 'act-2',
              type: ActionType.SEND_EMAIL,
              parameters: {
                to: '{{email}}',
                subject: 'Order Confirmation'
              },
              order: 2,
              condition: 'amount > 100' // Only send email for orders over $100
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-015',
          userId: 'user-015',
          timestamp: new Date(),
          entity: {
            orderPlaced: true,
            amount: 150,
            email: 'customer@example.com',
            orderId: 'order-006'
          },
          entityType: 'order',
          entityId: 'order-006',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(2);

        // Both actions should execute (amount > 100)
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[1].success).to.be.true;
      });
    });

    describe('Action Error Handling', () => {
      it('should handle invalid action parameters', async () => {
        const rule: RuleDefinition = {
          id: 'invalid-params-rule-1',
          name: 'Invalid Parameters Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'test',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.SET_FIELD,
              parameters: {
                // Missing required 'field' parameter
                value: 'test-value'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-016',
          userId: 'user-016',
          timestamp: new Date(),
          entity: { test: true },
          entityType: 'test',
          entityId: 'test-001',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(1);
        expect(result.results[0].actions[0].success).to.be.false;
        expect(result.results[0].actions[0].error).to.not.be.undefined;
        expect(result.results[0].actions[0].error).to.include('Missing required parameter');
      });

      it('should handle action execution timeout', async () => {
        const rule: RuleDefinition = {
          id: 'timeout-rule-1',
          name: 'Action Timeout Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'longRunning',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: ActionType.EXECUTE_SCRIPT,
              parameters: {
                script: 'while(true) { /* infinite loop */ }',
                timeout: 100 // 100ms timeout
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-017',
          userId: 'user-017',
          timestamp: new Date(),
          entity: { longRunning: true },
          entityType: 'test',
          entityId: 'test-002',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(1);
        expect(result.results[0].actions[0].success).to.be.false;
        expect(result.results[0].actions[0].error).to.include('timeout');
      });

      it('should validate action type exists', async () => {
        const rule: RuleDefinition = {
          id: 'invalid-action-type-rule-1',
          name: 'Invalid Action Type Rule',
          version: '1.0.0',
          category: 'business_validation' as any,
          priority: 1,
          enabled: true,
          conditions: [
            {
              id: 'cond-1',
              field: 'test',
              operator: 'equals' as any,
              value: true,
              dataType: 'boolean' as any
            }
          ],
          actions: [
            {
              id: 'act-1',
              type: 'INVALID_ACTION_TYPE' as any,
              parameters: {
                test: 'value'
              },
              order: 1
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-018',
          userId: 'user-018',
          timestamp: new Date(),
          entity: { test: true },
          entityType: 'test',
          entityId: 'test-003',
          context: {}
        };

        const result = await ruleExecutor.executeRule(rule, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions).to.have.lengthOf(1);
        expect(result.results[0].actions[0].success).to.be.false;
        expect(result.results[0].actions[0].error).to.include('Unknown action type');
      });
    });
  });
});