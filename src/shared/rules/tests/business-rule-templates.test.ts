import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { RuleTemplateService } from '../services/rule-template.service';
import { RulesEngineService } from '../services/rules-engine.service';
import {
  RuleTemplate,
  RuleDefinition,
  RuleCategory,
  ComparisonOperator,
  ActionType,
  DataType,
  RuleExecutionContext
} from '../interfaces/rule-definition.interface';
import {
  CreditLimitRuleContext,
  PricingRuleContext,
  DiscountRuleContext,
  InventoryRuleContext,
  ApprovalRuleContext,
  TaxRuleContext,
  PaymentTermRuleContext,
  ShippingRuleContext
} from '../types/business-rules.types';

describe('Business Rule Templates', () => {
  let templateService: RuleTemplateService;
  let rulesEngine: RulesEngineService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    templateService = new RuleTemplateService();
    rulesEngine = new RulesEngineService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Credit Limit Rule Templates', () => {
      it('should create credit limit rule from template', async () => {
        const template: RuleTemplate = {
          id: 'credit-limit-template',
          name: 'Credit Limit Validation Template',
          description: 'Template for creating credit limit validation rules',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'orderAmount',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              dataType: DataType.NUMBER,
              valueTemplate: '{{availableCredit}}',
              required: true,
              description: 'Order amount must be within available credit'
            },
            {
              field: 'customer.paymentHistory.latePayments',
              operator: ComparisonOperator.LESS_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{maxLatePayments}}',
              required: true,
              description: 'Customer must have good payment history'
            }
          ],
          actions: [
            {
              type: ActionType.APPROVE,
              parameterTemplates: {
                reason: {
                  name: 'reason',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'Credit limit approved',
                  description: 'Approval reason'
                }
              },
              required: true,
              description: 'Approve the transaction'
            }
          ],
          parameters: [
            {
              name: 'availableCredit',
              type: DataType.NUMBER,
              required: true,
              description: 'Available credit amount'
            },
            {
              name: 'maxLatePayments',
              type: DataType.INTEGER,
              required: true,
              defaultValue: 3,
              description: 'Maximum allowed late payments'
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);

        const parameters = {
          availableCredit: 5000,
          maxLatePayments: 2
        };

        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, parameters);

        expect(rule).to.not.be.undefined;
        expect(rule.name).to.include('Credit Limit Validation');
        expect(rule.category).to.equal(RuleCategory.FINANCIAL);
        expect(rule.conditions).to.have.lengthOf(2);
        expect(rule.actions).to.have.lengthOf(1);
        expect(rule.conditions[0].value).to.equal(5000);
        expect(rule.conditions[1].value).to.equal(2);
      });

      it('should execute credit limit rule correctly', async () => {
        const template: RuleTemplate = {
          id: 'credit-limit-execution-template',
          name: 'Credit Limit Execution Template',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'orderAmount',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              dataType: DataType.NUMBER,
              valueTemplate: '{{creditLimit - currentBalance}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.APPROVE,
              parameterTemplates: {
                reason: {
                  name: 'reason',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'Credit check passed'
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'creditLimit',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'currentBalance',
              type: DataType.NUMBER,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          creditLimit: 10000,
          currentBalance: 3000
        });

        const context: RuleExecutionContext = {
          correlationId: 'credit-test-001',
          userId: 'user-001',
          timestamp: new Date(),
          entity: {
            orderAmount: 6000,
            customerId: 'customer-001',
            creditLimit: 10000,
            currentBalance: 3000
          },
          entityType: 'order',
          entityId: 'order-001',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true; // 6000 <= (10000 - 3000) = 7000
        expect(result.results[0].actions[0].success).to.be.true;
      });

      it('should reject order exceeding credit limit', async () => {
        const template: RuleTemplate = {
          id: 'credit-limit-reject-template',
          name: 'Credit Limit Rejection Template',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'orderAmount',
              operator: ComparisonOperator.GREATER_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{creditLimit - currentBalance}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.REJECT,
              parameterTemplates: {
                reason: {
                  name: 'reason',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'Order exceeds credit limit'
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'creditLimit',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'currentBalance',
              type: DataType.NUMBER,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          creditLimit: 5000,
          currentBalance: 2000
        });

        const context: RuleExecutionContext = {
          correlationId: 'credit-test-002',
          userId: 'user-002',
          timestamp: new Date(),
          entity: {
            orderAmount: 4000,
            customerId: 'customer-002',
            creditLimit: 5000,
            currentBalance: 2000
          },
          entityType: 'order',
          entityId: 'order-002',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true; // 4000 > (5000 - 2000) = 3000
        expect(result.results[0].actions[0].success).to.be.true;
      });
    });

    describe('Pricing Rule Templates', () => {
      it('should create dynamic pricing rule from template', async () => {
        const template: RuleTemplate = {
          id: 'dynamic-pricing-template',
          name: 'Dynamic Pricing Template',
          description: 'Template for creating dynamic pricing rules',
          category: RuleCategory.PRICING,
          conditions: [
            {
              field: 'customerSegment',
              operator: ComparisonOperator.IN,
              dataType: DataType.ARRAY,
              valueTemplate: '{{eligibleSegments}}',
              required: true
            },
            {
              field: 'quantity',
              operator: ComparisonOperator.GREATER_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{volumeThreshold}}',
              required: false
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                formula: {
                  name: 'formula',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'basePrice * (1 - discountRate)',
                  description: 'Pricing calculation formula'
                },
                discountRate: {
                  name: 'discountRate',
                  type: DataType.DECIMAL,
                  required: true,
                  description: 'Discount rate to apply'
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'eligibleSegments',
              type: DataType.ARRAY,
              required: true
            },
            {
              name: 'volumeThreshold',
              type: DataType.NUMBER,
              required: false,
              defaultValue: 1
            },
            {
              name: 'discountRate',
              type: DataType.DECIMAL,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          eligibleSegments: ['premium', 'vip'],
          volumeThreshold: 10,
          discountRate: 0.15
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.PRICING);
        expect(rule.conditions).to.have.lengthOf(2);
        expect(rule.actions).to.have.lengthOf(1);
      });

      it('should calculate dynamic pricing correctly', async () => {
        const template: RuleTemplate = {
          id: 'pricing-calculation-template',
          name: 'Pricing Calculation Template',
          category: RuleCategory.PRICING,
          conditions: [
            {
              field: 'productCategory',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: '{{category}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                basePrice: {
                  name: 'basePrice',
                  type: DataType.NUMBER,
                  required: true
                },
                marginMultiplier: {
                  name: 'marginMultiplier',
                  type: DataType.DECIMAL,
                  required: true,
                  defaultValue: 1.2
                },
                seasonalFactor: {
                  name: 'seasonalFactor',
                  type: DataType.DECIMAL,
                  required: true,
                  defaultValue: 1.0
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'category',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'basePrice',
              type: DataType.NUMBER,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          category: 'electronics',
          basePrice: 100,
          marginMultiplier: 1.25,
          seasonalFactor: 1.1
        });

        const context: RuleExecutionContext = {
          correlationId: 'pricing-test-001',
          userId: 'user-003',
          timestamp: new Date(),
          entity: {
            productCategory: 'electronics',
            productId: 'product-001',
            quantity: 5
          },
          entityType: 'quote',
          entityId: 'quote-001',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        // Expected price: 100 * 1.25 * 1.1 = 137.5
        expect(result.results[0].actions[0].result.finalPrice).to.equal(137.5);
      });
    });

    describe('Discount Rule Templates', () => {
      it('should create discount eligibility rule from template', async () => {
        const template: RuleTemplate = {
          id: 'discount-eligibility-template',
          name: 'Discount Eligibility Template',
          category: RuleCategory.DISCOUNT,
          conditions: [
            {
              field: 'orderTotal',
              operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
              dataType: DataType.NUMBER,
              valueTemplate: '{{minimumOrderAmount}}',
              required: true
            },
            {
              field: 'customerSegment',
              operator: ComparisonOperator.IN,
              dataType: DataType.ARRAY,
              valueTemplate: '{{eligibleSegments}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                discountType: {
                  name: 'discountType',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'percentage'
                },
                discountValue: {
                  name: 'discountValue',
                  type: DataType.DECIMAL,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'minimumOrderAmount',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'eligibleSegments',
              type: DataType.ARRAY,
              required: true
            },
            {
              name: 'discountValue',
              type: DataType.DECIMAL,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          minimumOrderAmount: 100,
          eligibleSegments: ['premium', 'loyalty'],
          discountValue: 0.1
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.DISCOUNT);
        expect(rule.conditions).to.have.lengthOf(2);
      });

      it('should apply tiered discounts correctly', async () => {
        const template: RuleTemplate = {
          id: 'tiered-discount-template',
          name: 'Tiered Discount Template',
          category: RuleCategory.DISCOUNT,
          conditions: [
            {
              field: 'orderTotal',
              operator: ComparisonOperator.BETWEEN,
              dataType: DataType.NUMBER,
              valueTemplate: '[{{minAmount}}, {{maxAmount}}]',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                discountPercentage: {
                  name: 'discountPercentage',
                  type: DataType.DECIMAL,
                  required: true
                },
                maxDiscountAmount: {
                  name: 'maxDiscountAmount',
                  type: DataType.NUMBER,
                  required: false
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'minAmount',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'maxAmount',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'discountPercentage',
              type: DataType.DECIMAL,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          minAmount: 500,
          maxAmount: 1000,
          discountPercentage: 0.15,
          maxDiscountAmount: 100
        });

        const context: RuleExecutionContext = {
          correlationId: 'discount-test-001',
          userId: 'user-004',
          timestamp: new Date(),
          entity: {
            orderTotal: 800,
            orderId: 'order-003',
            customerSegment: 'premium'
          },
          entityType: 'order',
          entityId: 'order-003',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;
        // Expected discount: 800 * 0.15 = 120, but capped at 100
        expect(result.results[0].actions[0].result.discountAmount).to.equal(100);
      });
    });

    describe('Inventory Rule Templates', () => {
      it('should create inventory reorder rule from template', async () => {
        const template: RuleTemplate = {
          id: 'inventory-reorder-template',
          name: 'Inventory Reorder Template',
          category: RuleCategory.INVENTORY,
          conditions: [
            {
              field: 'currentStock',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              dataType: DataType.NUMBER,
              valueTemplate: '{{reorderLevel}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.SEND_NOTIFICATION,
              parameterTemplates: {
                recipient: {
                  name: 'recipient',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'inventory@company.com'
                },
                urgency: {
                  name: 'urgency',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'normal'
                }
              },
              required: true
            },
            {
              type: ActionType.TRIGGER_WORKFLOW,
              parameterTemplates: {
                workflowId: {
                  name: 'workflowId',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'inventory-reorder'
                }
              },
              required: false
            }
          ],
          parameters: [
            {
              name: 'reorderLevel',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'recipient',
              type: DataType.STRING,
              required: false
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          reorderLevel: 50,
          recipient: 'manager@company.com',
          urgency: 'high'
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.INVENTORY);
        expect(rule.conditions).to.have.lengthOf(1);
        expect(rule.actions).to.have.lengthOf(2);
      });

      it('should trigger reorder when stock is low', async () => {
        const template: RuleTemplate = {
          id: 'stock-reorder-template',
          name: 'Stock Reorder Template',
          category: RuleCategory.INVENTORY,
          conditions: [
            {
              field: 'currentStock',
              operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
              dataType: DataType.NUMBER,
              valueTemplate: '{{reorderPoint}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                reorderQuantity: {
                  name: 'reorderQuantity',
                  type: DataType.NUMBER,
                  required: true
                },
                maxStock: {
                  name: 'maxStock',
                  type: DataType.NUMBER,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'reorderPoint',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'maxStock',
              type: DataType.NUMBER,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          reorderPoint: 20,
          maxStock: 200,
          reorderQuantity: 150
        });

        const context: RuleExecutionContext = {
          correlationId: 'inventory-test-001',
          userId: 'user-005',
          timestamp: new Date(),
          entity: {
            productId: 'product-002',
            currentStock: 15,
            productName: 'Widget A'
          },
          entityType: 'product',
          entityId: 'product-002',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true; // 15 <= 20
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.reorderQuantity).to.equal(150);
      });
    });

    describe('Approval Matrix Rule Templates', () => {
      it('should create approval matrix rule from template', async () => {
        const template: RuleTemplate = {
          id: 'approval-matrix-template',
          name: 'Approval Matrix Template',
          category: RuleCategory.APPROVAL,
          conditions: [
            {
              field: 'amount',
              operator: ComparisonOperator.GREATER_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{autoApprovalLimit}}',
              required: true
            },
            {
              field: 'requestorLevel',
              operator: ComparisonOperator.LESS_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{requiredApprovalLevel}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.ESCALATE,
              parameterTemplates: {
                approverRole: {
                  name: 'approverRole',
                  type: DataType.STRING,
                  required: true
                },
                urgency: {
                  name: 'urgency',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'normal'
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'autoApprovalLimit',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'requiredApprovalLevel',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'approverRole',
              type: DataType.STRING,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          autoApprovalLimit: 1000,
          requiredApprovalLevel: 3,
          approverRole: 'manager',
          urgency: 'high'
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.APPROVAL);
        expect(rule.conditions).to.have.lengthOf(2);
      });

      it('should route to correct approval level based on amount', async () => {
        const template: RuleTemplate = {
          id: 'approval-routing-template',
          name: 'Approval Routing Template',
          category: RuleCategory.APPROVAL,
          conditions: [
            {
              field: 'amount',
              operator: ComparisonOperator.BETWEEN,
              dataType: DataType.NUMBER,
              valueTemplate: '[{{minAmount}}, {{maxAmount}}]',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.ESCALATE,
              parameterTemplates: {
                approvalLevel: {
                  name: 'approvalLevel',
                  type: DataType.STRING,
                  required: true
                },
                approvers: {
                  name: 'approvers',
                  type: DataType.ARRAY,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'minAmount',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'maxAmount',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'approvalLevel',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'approvers',
              type: DataType.ARRAY,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          minAmount: 5000,
          maxAmount: 25000,
          approvalLevel: 'director',
          approvers: ['director@company.com', 'senior-manager@company.com']
        });

        const context: RuleExecutionContext = {
          correlationId: 'approval-test-001',
          userId: 'user-006',
          timestamp: new Date(),
          entity: {
            requestType: 'expense',
            amount: 15000,
            requestorId: 'employee-001',
            requestorLevel: 2
          },
          entityType: 'approval_request',
          entityId: 'approval-001',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true; // 15000 is between 5000 and 25000
        expect(result.results[0].actions[0].success).to.be.true;
        expect(result.results[0].actions[0].result.approvalLevel).to.equal('director');
      });
    });

    describe('Tax Calculation Rule Templates', () => {
      it('should create tax calculation rule from template', async () => {
        const template: RuleTemplate = {
          id: 'tax-calculation-template',
          name: 'Tax Calculation Template',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'region',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: '{{taxRegion}}',
              required: true
            },
            {
              field: 'taxExempt',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.BOOLEAN,
              valueTemplate: 'false',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                taxRate: {
                  name: 'taxRate',
                  type: DataType.DECIMAL,
                  required: true
                },
                additionalTaxes: {
                  name: 'additionalTaxes',
                  type: DataType.ARRAY,
                  required: false
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'taxRegion',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'taxRate',
              type: DataType.DECIMAL,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          taxRegion: 'CA',
          taxRate: 0.0875,
          additionalTaxes: [
            { type: 'county', rate: 0.01 },
            { type: 'city', rate: 0.0075 }
          ]
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.FINANCIAL);
        expect(rule.conditions).to.have.lengthOf(2);
      });

      it('should calculate tax with multiple jurisdictions', async () => {
        const template: RuleTemplate = {
          id: 'multi-jurisdiction-tax-template',
          name: 'Multi-Jurisdiction Tax Template',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'country',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: '{{country}}',
              required: true
            },
            {
              field: 'taxExempt',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.BOOLEAN,
              valueTemplate: 'false',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                taxJurisdictions: {
                  name: 'taxJurisdictions',
                  type: DataType.ARRAY,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'country',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'taxJurisdictions',
              type: DataType.ARRAY,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          country: 'US',
          taxJurisdictions: [
            { type: 'state', name: 'California', rate: 0.075 },
            { type: 'county', name: 'Los Angeles', rate: 0.01 },
            { type: 'city', name: 'Los Angeles', rate: 0.0075 },
            { type: 'special', name: 'Transportation', rate: 0.005 }
          ]
        });

        const context: RuleExecutionContext = {
          correlationId: 'tax-test-001',
          userId: 'user-007',
          timestamp: new Date(),
          entity: {
            amount: 1000,
            country: 'US',
            state: 'CA',
            county: 'Los Angeles',
            city: 'Los Angeles',
            taxExempt: false
          },
          entityType: 'invoice',
          entityId: 'invoice-001',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;

        // Expected total tax rate: 0.075 + 0.01 + 0.0075 + 0.005 = 0.0975
        // Expected tax amount: 1000 * 0.0975 = 97.5
        expect(result.results[0].actions[0].result.totalTaxAmount).to.equal(97.5);
        expect(result.results[0].actions[0].result.effectiveTaxRate).to.equal(0.0975);
      });
    });

    describe('Payment Term Rule Templates', () => {
      it('should create payment term rule from template', async () => {
        const template: RuleTemplate = {
          id: 'payment-terms-template',
          name: 'Payment Terms Template',
          category: RuleCategory.FINANCIAL,
          conditions: [
            {
              field: 'customerType',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: '{{customerType}}',
              required: true
            },
            {
              field: 'orderHistory.totalAmount',
              operator: ComparisonOperator.GREATER_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{minimumPurchaseHistory}}',
              required: false
            }
          ],
          actions: [
            {
              type: ActionType.SET_FIELD,
              parameterTemplates: {
                field: {
                  name: 'field',
                  type: DataType.STRING,
                  required: true,
                  defaultValue: 'paymentTerms'
                },
                value: {
                  name: 'value',
                  type: DataType.STRING,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'customerType',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'paymentTerms',
              type: DataType.STRING,
              required: true
            },
            {
              name: 'minimumPurchaseHistory',
              type: DataType.NUMBER,
              required: false
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          customerType: 'premium',
          paymentTerms: 'NET45',
          minimumPurchaseHistory: 10000
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.FINANCIAL);
        expect(rule.conditions).to.have.lengthOf(2);
      });
    });

    describe('Shipping Cost Rule Templates', () => {
      it('should create shipping cost rule from template', async () => {
        const template: RuleTemplate = {
          id: 'shipping-cost-template',
          name: 'Shipping Cost Template',
          category: RuleCategory.BUSINESS_VALIDATION,
          conditions: [
            {
              field: 'weight',
              operator: ComparisonOperator.BETWEEN,
              dataType: DataType.NUMBER,
              valueTemplate: '[{{minWeight}}, {{maxWeight}}]',
              required: true
            },
            {
              field: 'orderTotal',
              operator: ComparisonOperator.LESS_THAN,
              dataType: DataType.NUMBER,
              valueTemplate: '{{freeShippingThreshold}}',
              required: false
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                baseCost: {
                  name: 'baseCost',
                  type: DataType.NUMBER,
                  required: true
                },
                weightMultiplier: {
                  name: 'weightMultiplier',
                  type: DataType.DECIMAL,
                  required: true
                },
                distanceMultiplier: {
                  name: 'distanceMultiplier',
                  type: DataType.DECIMAL,
                  required: false
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'minWeight',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'maxWeight',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'baseCost',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'weightMultiplier',
              type: DataType.DECIMAL,
              required: true
            },
            {
              name: 'freeShippingThreshold',
              type: DataType.NUMBER,
              required: false
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          minWeight: 5,
          maxWeight: 20,
          baseCost: 10,
          weightMultiplier: 1.5,
          distanceMultiplier: 0.1,
          freeShippingThreshold: 100
        });

        expect(rule).to.not.be.undefined;
        expect(rule.category).to.equal(RuleCategory.BUSINESS_VALIDATION);
        expect(rule.conditions).to.have.lengthOf(2);
      });

      it('should calculate shipping cost with weight and distance', async () => {
        const template: RuleTemplate = {
          id: 'shipping-calculation-template',
          name: 'Shipping Calculation Template',
          category: RuleCategory.BUSINESS_VALIDATION,
          conditions: [
            {
              field: 'freeShipping',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.BOOLEAN,
              valueTemplate: 'false',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.CALCULATE,
              parameterTemplates: {
                weight: {
                  name: 'weight',
                  type: DataType.NUMBER,
                  required: true
                },
                distance: {
                  name: 'distance',
                  type: DataType.NUMBER,
                  required: true
                },
                baseRate: {
                  name: 'baseRate',
                  type: DataType.NUMBER,
                  required: true
                },
                weightRate: {
                  name: 'weightRate',
                  type: DataType.NUMBER,
                  required: true
                },
                distanceRate: {
                  name: 'distanceRate',
                  type: DataType.NUMBER,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'baseRate',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'weightRate',
              type: DataType.NUMBER,
              required: true
            },
            {
              name: 'distanceRate',
              type: DataType.NUMBER,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);
        const rule = await templateService.createRuleFromTemplate(createdTemplate.id, {
          baseRate: 5,
          weightRate: 2,
          distanceRate: 0.5
        });

        const context: RuleExecutionContext = {
          correlationId: 'shipping-test-001',
          userId: 'user-008',
          timestamp: new Date(),
          entity: {
            weight: 10,
            distance: 100,
            orderTotal: 50,
            freeShipping: false,
            orderId: 'order-004'
          },
          entityType: 'order',
          entityId: 'order-004',
          context: {}
        };

        const result = await rulesEngine.executeRule(rule.id, context);

        expect(result).to.not.be.undefined;
        expect(result.results[0].matched).to.be.true;
        expect(result.results[0].actions[0].success).to.be.true;

        // Expected shipping cost: 5 (base) + 10 * 2 (weight) + 100 * 0.5 (distance) = 5 + 20 + 50 = 75
        expect(result.results[0].actions[0].result.shippingCost).to.equal(75);
      });
    });

    describe('Template Management', () => {
      it('should validate template before creation', async () => {
        const invalidTemplate = {
          id: 'invalid-template',
          name: '', // Empty name
          category: RuleCategory.BUSINESS_VALIDATION,
          conditions: [], // Empty conditions
          actions: [], // Empty actions
          parameters: []
        };

        try {
          await templateService.createTemplate(invalidTemplate);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error.message).to.include('Invalid template');
        }
      });

      it('should update existing template', async () => {
        const template: RuleTemplate = {
          id: 'updatable-template',
          name: 'Original Template',
          category: RuleCategory.BUSINESS_VALIDATION,
          conditions: [
            {
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: '{{testValue}}',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.LOG_EVENT,
              parameterTemplates: {
                message: {
                  name: 'message',
                  type: DataType.STRING,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: [
            {
              name: 'testValue',
              type: DataType.STRING,
              required: true
            }
          ]
        };

        const createdTemplate = await templateService.createTemplate(template);

        const updates = {
          name: 'Updated Template',
          description: 'This template has been updated'
        };

        const updatedTemplate = await templateService.updateTemplate(createdTemplate.id, updates);

        expect(updatedTemplate.name).to.equal('Updated Template');
        expect(updatedTemplate.description).to.equal('This template has been updated');
      });

      it('should delete template', async () => {
        const template: RuleTemplate = {
          id: 'deletable-template',
          name: 'Template to Delete',
          category: RuleCategory.BUSINESS_VALIDATION,
          conditions: [
            {
              field: 'test',
              operator: ComparisonOperator.EQUALS,
              dataType: DataType.STRING,
              valueTemplate: 'test',
              required: true
            }
          ],
          actions: [
            {
              type: ActionType.LOG_EVENT,
              parameterTemplates: {
                message: {
                  name: 'message',
                  type: DataType.STRING,
                  required: true
                }
              },
              required: true
            }
          ],
          parameters: []
        };

        const createdTemplate = await templateService.createTemplate(template);
        expect(createdTemplate.id).to.be.a('string');

        await templateService.deleteTemplate(createdTemplate.id);

        const deletedTemplate = await templateService.getTemplate(createdTemplate.id);
        expect(deletedTemplate).to.be.null;
      });

      it('should get templates by category', async () => {
        // Create templates in different categories
        const pricingTemplate: RuleTemplate = {
          id: 'pricing-category-template',
          name: 'Pricing Template',
          category: RuleCategory.PRICING,
          conditions: [],
          actions: [],
          parameters: []
        };

        const inventoryTemplate: RuleTemplate = {
          id: 'inventory-category-template',
          name: 'Inventory Template',
          category: RuleCategory.INVENTORY,
          conditions: [],
          actions: [],
          parameters: []
        };

        await templateService.createTemplate(pricingTemplate);
        await templateService.createTemplate(inventoryTemplate);

        const pricingTemplates = await templateService.getTemplates(RuleCategory.PRICING);
        const inventoryTemplates = await templateService.getTemplates(RuleCategory.INVENTORY);

        expect(pricingTemplates).to.have.lengthOf(1);
        expect(pricingTemplates[0].category).to.equal(RuleCategory.PRICING);
        expect(inventoryTemplates).to.have.lengthOf(1);
        expect(inventoryTemplates[0].category).to.equal(RuleCategory.INVENTORY);
      });
    });
  });
});