import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { ConditionEvaluatorService } from '../services/condition-evaluator.service';
import {
  ComparisonOperator,
  LogicalOperator,
  BusinessOperator,
  DataType,
  RuleCondition,
  RuleExecutionContext
} from '../interfaces/rule-definition.interface';

describe('ConditionEvaluatorService', () => {
  let conditionEvaluator: ConditionEvaluatorService;
  let sandbox: any;

  beforeEach(() => {
    sandbox = createSandbox();
    conditionEvaluator = new ConditionEvaluatorService();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED PHASE - Failing Tests', () => {
    describe('Comparison Operators', () => {
      it('should evaluate EQUALS operator correctly', async () => {
        const condition: RuleCondition = {
          id: 'test-equals',
          field: 'status',
          operator: ComparisonOperator.EQUALS,
          value: 'active',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-001',
          userId: 'user-001',
          timestamp: new Date(),
          entity: { status: 'active', id: '123' },
          entityType: 'customer',
          entityId: 'customer-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate NOT_EQUALS operator correctly', async () => {
        const condition: RuleCondition = {
          id: 'test-not-equals',
          field: 'status',
          operator: ComparisonOperator.NOT_EQUALS,
          value: 'inactive',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-002',
          userId: 'user-002',
          timestamp: new Date(),
          entity: { status: 'active', id: '456' },
          entityType: 'customer',
          entityId: 'customer-002',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate GREATER_THAN operator for numbers', async () => {
        const condition: RuleCondition = {
          id: 'test-greater-than',
          field: 'amount',
          operator: ComparisonOperator.GREATER_THAN,
          value: 100,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-003',
          userId: 'user-003',
          timestamp: new Date(),
          entity: { amount: 150, orderId: 'order-001' },
          entityType: 'order',
          entityId: 'order-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate GREATER_THAN_OR_EQUAL operator for numbers', async () => {
        const condition: RuleCondition = {
          id: 'test-greater-equal',
          field: 'score',
          operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
          value: 85,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-004',
          userId: 'user-004',
          timestamp: new Date(),
          entity: { score: 85, studentId: 'student-001' },
          entityType: 'student',
          entityId: 'student-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate LESS_THAN operator for numbers', async () => {
        const condition: RuleCondition = {
          id: 'test-less-than',
          field: 'age',
          operator: ComparisonOperator.LESS_THAN,
          value: 65,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-005',
          userId: 'user-005',
          timestamp: new Date(),
          entity: { age: 45, name: 'John Doe' },
          entityType: 'person',
          entityId: 'person-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate LESS_THAN_OR_EQUAL operator for numbers', async () => {
        const condition: RuleCondition = {
          id: 'test-less-equal',
          field: 'stock',
          operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
          value: 10,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-006',
          userId: 'user-006',
          timestamp: new Date(),
          entity: { stock: 10, productId: 'product-001' },
          entityType: 'product',
          entityId: 'product-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate CONTAINS operator for strings', async () => {
        const condition: RuleCondition = {
          id: 'test-contains',
          field: 'description',
          operator: ComparisonOperator.CONTAINS,
          value: 'premium',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-007',
          userId: 'user-007',
          timestamp: new Date(),
          entity: { description: 'This is a premium quality product', productId: 'prod-001' },
          entityType: 'product',
          entityId: 'product-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate STARTS_WITH operator for strings', async () => {
        const condition: RuleCondition = {
          id: 'test-starts-with',
          field: 'email',
          operator: ComparisonOperator.STARTS_WITH,
          value: 'admin',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-008',
          userId: 'user-008',
          timestamp: new Date(),
          entity: { email: 'admin@company.com', userId: 'user-001' },
          entityType: 'user',
          entityId: 'user-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate ENDS_WITH operator for strings', async () => {
        const condition: RuleCondition = {
          id: 'test-ends-with',
          field: 'phone',
          operator: ComparisonOperator.ENDS_WITH,
          value: '9999',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-009',
          userId: 'user-009',
          timestamp: new Date(),
          entity: { phone: '+1-555-123-9999', contactId: 'contact-001' },
          entityType: 'contact',
          entityId: 'contact-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate IN operator for arrays', async () => {
        const condition: RuleCondition = {
          id: 'test-in',
          field: 'category',
          operator: ComparisonOperator.IN,
          value: ['electronics', 'computers', 'accessories'],
          dataType: DataType.ARRAY
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-010',
          userId: 'user-010',
          timestamp: new Date(),
          entity: { category: 'computers', productId: 'product-002' },
          entityType: 'product',
          entityId: 'product-002',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate NOT_IN operator for arrays', async () => {
        const condition: RuleCondition = {
          id: 'test-not-in',
          field: 'region',
          operator: ComparisonOperator.NOT_IN,
          value: ['blocked-region-1', 'blocked-region-2'],
          dataType: DataType.ARRAY
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-011',
          userId: 'user-011',
          timestamp: new Date(),
          entity: { region: 'allowed-region', customerId: 'customer-003' },
          entityType: 'customer',
          entityId: 'customer-003',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate BETWEEN operator for numbers', async () => {
        const condition: RuleCondition = {
          id: 'test-between',
          field: 'temperature',
          operator: ComparisonOperator.BETWEEN,
          value: [18, 25],
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-012',
          userId: 'user-012',
          timestamp: new Date(),
          entity: { temperature: 22, sensorId: 'sensor-001' },
          entityType: 'sensor',
          entityId: 'sensor-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate IS_NULL operator correctly', async () => {
        const condition: RuleCondition = {
          id: 'test-is-null',
          field: 'deletedAt',
          operator: ComparisonOperator.IS_NULL,
          value: null,
          dataType: DataType.DATE
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-013',
          userId: 'user-013',
          timestamp: new Date(),
          entity: { deletedAt: null, recordId: 'record-001' },
          entityType: 'record',
          entityId: 'record-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate IS_NOT_NULL operator correctly', async () => {
        const condition: RuleCondition = {
          id: 'test-is-not-null',
          field: 'updatedAt',
          operator: ComparisonOperator.IS_NOT_NULL,
          value: null,
          dataType: DataType.DATE
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-014',
          userId: 'user-014',
          timestamp: new Date(),
          entity: { updatedAt: new Date(), recordId: 'record-002' },
          entityType: 'record',
          entityId: 'record-002',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate REGEX operator for strings', async () => {
        const condition: RuleCondition = {
          id: 'test-regex',
          field: 'postalCode',
          operator: ComparisonOperator.REGEX,
          value: '^[0-9]{5}(-[0-9]{4})?$',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-015',
          userId: 'user-015',
          timestamp: new Date(),
          entity: { postalCode: '12345-6789', addressId: 'address-001' },
          entityType: 'address',
          entityId: 'address-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should handle nested object field access', async () => {
        const condition: RuleCondition = {
          id: 'test-nested',
          field: 'customer.address.city',
          operator: ComparisonOperator.EQUALS,
          value: 'New York',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-016',
          userId: 'user-016',
          timestamp: new Date(),
          entity: {
            customer: {
              address: {
                city: 'New York',
                state: 'NY'
              },
              name: 'John Smith'
            },
            orderId: 'order-003'
          },
          entityType: 'order',
          entityId: 'order-003',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should handle array element field access', async () => {
        const condition: RuleCondition = {
          id: 'test-array-element',
          field: 'items[0].price',
          operator: ComparisonOperator.GREATER_THAN,
          value: 100,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-017',
          userId: 'user-017',
          timestamp: new Date(),
          entity: {
            items: [
              { price: 150, name: 'Item 1' },
              { price: 75, name: 'Item 2' }
            ],
            orderId: 'order-004'
          },
          entityType: 'order',
          entityId: 'order-004',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });
    });

    describe('Logical Operators', () => {
      it('should evaluate AND logical operator with multiple conditions', async () => {
        const conditions: RuleCondition[] = [
          {
            id: 'cond-1',
            field: 'amount',
            operator: ComparisonOperator.GREATER_THAN,
            value: 100,
            dataType: DataType.NUMBER
          },
          {
            id: 'cond-2',
            field: 'status',
            operator: ComparisonOperator.EQUALS,
            value: 'active',
            dataType: DataType.STRING
          }
        ];

        const context: RuleExecutionContext = {
          correlationId: 'test-018',
          userId: 'user-018',
          timestamp: new Date(),
          entity: { amount: 150, status: 'active', orderId: 'order-005' },
          entityType: 'order',
          entityId: 'order-005',
          context: {}
        };

        const result = await conditionEvaluator.evaluateConditions(conditions, context, LogicalOperator.AND);

        expect(result).to.be.true;
      });

      it('should evaluate OR logical operator with multiple conditions', async () => {
        const conditions: RuleCondition[] = [
          {
            id: 'cond-1',
            field: 'priority',
            operator: ComparisonOperator.EQUALS,
            value: 'high',
            dataType: DataType.STRING
          },
          {
            id: 'cond-2',
            field: 'amount',
            operator: ComparisonOperator.GREATER_THAN,
            value: 1000,
            dataType: DataType.NUMBER
          }
        ];

        const context: RuleExecutionContext = {
          correlationId: 'test-019',
          userId: 'user-019',
          timestamp: new Date(),
          entity: { priority: 'low', amount: 1500, orderId: 'order-006' },
          entityType: 'order',
          entityId: 'order-006',
          context: {}
        };

        const result = await conditionEvaluator.evaluateConditions(conditions, context, LogicalOperator.OR);

        expect(result).to.be.true;
      });

      it('should evaluate NOT logical operator correctly', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'deleted',
          operator: ComparisonOperator.EQUALS,
          value: true,
          dataType: DataType.BOOLEAN,
          negate: true
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-020',
          userId: 'user-020',
          timestamp: new Date(),
          entity: { deleted: false, recordId: 'record-003' },
          entityType: 'record',
          entityId: 'record-003',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate XOR logical operator with multiple conditions', async () => {
        const conditions: RuleCondition[] = [
          {
            id: 'cond-1',
            field: 'hasDiscount',
            operator: ComparisonOperator.EQUALS,
            value: true,
            dataType: DataType.BOOLEAN
          },
          {
            id: 'cond-2',
            field: 'isVipCustomer',
            operator: ComparisonOperator.EQUALS,
            value: true,
            dataType: DataType.BOOLEAN
          }
        ];

        const context: RuleExecutionContext = {
          correlationId: 'test-021',
          userId: 'user-021',
          timestamp: new Date(),
          entity: { hasDiscount: true, isVipCustomer: false, orderId: 'order-007' },
          entityType: 'order',
          entityId: 'order-007',
          context: {}
        };

        const result = await conditionEvaluator.evaluateConditions(conditions, context, LogicalOperator.XOR);

        expect(result).to.be.true;
      });
    });

    describe('Business Operators', () => {
      it('should evaluate CREDIT_LIMIT_CHECK operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'orderAmount',
          operator: BusinessOperator.CREDIT_LIMIT_CHECK,
          value: 5000, // Available credit
          dataType: DataType.NUMBER,
          parameters: {
            currentBalance: 2000,
            creditLimit: 7000
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-022',
          userId: 'user-022',
          timestamp: new Date(),
          entity: {
            orderAmount: 4000,
            customerId: 'customer-004',
            currentBalance: 2000,
            creditLimit: 7000
          },
          entityType: 'order',
          entityId: 'order-008',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true; // 4000 <= (7000 - 2000) = 5000
      });

      it('should evaluate INVENTORY_AVAILABILITY operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'requestedQuantity',
          operator: BusinessOperator.INVENTORY_AVAILABILITY,
          value: 50, // Reorder level
          dataType: DataType.NUMBER,
          parameters: {
            currentStock: 75,
            reservedStock: 10
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-023',
          userId: 'user-023',
          timestamp: new Date(),
          entity: {
            requestedQuantity: 30,
            productId: 'product-003',
            currentStock: 75,
            reservedStock: 10
          },
          entityType: 'order',
          entityId: 'order-009',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true; // 30 <= (75 - 10) = 65
      });

      it('should evaluate PRICING_RULE operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'finalPrice',
          operator: BusinessOperator.PRICING_RULE,
          value: 90, // Minimum acceptable price
          dataType: DataType.NUMBER,
          parameters: {
            basePrice: 100,
            discountRules: [
              { type: 'volume', quantity: 10, discount: 0.1 },
              { type: 'customer', segment: 'premium', discount: 0.05 }
            ]
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-024',
          userId: 'user-024',
          timestamp: new Date(),
          entity: {
            finalPrice: 85,
            basePrice: 100,
            quantity: 15,
            customerSegment: 'premium',
            productId: 'product-004'
          },
          entityType: 'quote',
          entityId: 'quote-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true; // Calculated price should be >= minimum
      });

      it('should evaluate DISCOUNT_ELIGIBILITY operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'orderTotal',
          operator: BusinessOperator.DISCOUNT_ELIGIBILITY,
          value: 100, // Minimum order amount
          dataType: DataType.NUMBER,
          parameters: {
            customerEligibility: {
              segments: ['premium', 'vip'],
              minOrders: 5,
              minTotalSpent: 1000
            },
            productEligibility: {
              categories: ['electronics', 'clothing'],
              excludeSaleItems: true
            }
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-025',
          userId: 'user-025',
          timestamp: new Date(),
          entity: {
            orderTotal: 250,
            customerSegment: 'premium',
            previousOrders: 8,
            totalSpent: 1500,
            items: [
              { category: 'electronics', price: 200, onSale: false },
              { category: 'accessories', price: 50, onSale: false }
            ]
          },
          entityType: 'order',
          entityId: 'order-010',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate TAX_CALCULATION operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'taxAmount',
          operator: BusinessOperator.TAX_CALCULATION,
          value: 8.25, // Expected tax rate
          dataType: DataType.DECIMAL,
          parameters: {
            jurisdiction: 'CA',
            taxRules: [
              { type: 'state', rate: 0.075 },
              { type: 'county', rate: 0.01 },
              { type: 'city', rate: 0.0075 }
            ]
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-026',
          userId: 'user-026',
          timestamp: new Date(),
          entity: {
            amount: 100,
            taxAmount: 8.25,
            jurisdiction: 'CA',
            taxExempt: false
          },
          entityType: 'invoice',
          entityId: 'invoice-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate APPROVAL_MATRIX operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'requestAmount',
          operator: BusinessOperator.APPROVAL_MATRIX,
          value: 1000, // Auto-approval limit
          dataType: DataType.NUMBER,
          parameters: {
            approvalLevels: [
              { level: 1, roles: ['manager'], limit: 1000 },
              { level: 2, roles: ['director'], limit: 5000 },
              { level: 3, roles: ['vp'], limit: 25000 }
            ],
            requestorRole: 'analyst',
            requestorLevel: 0
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-027',
          userId: 'user-027',
          timestamp: new Date(),
          entity: {
            requestAmount: 2500,
            requestorRole: 'analyst',
            requestorLevel: 0,
            requestType: 'expense',
            urgency: 'normal'
          },
          entityType: 'approval_request',
          entityId: 'approval-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true; // Should require approval (amount > limit)
      });

      it('should evaluate PAYMENT_TERM_CHECK operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'orderAmount',
          operator: BusinessOperator.PAYMENT_TERM_CHECK,
          value: 'NET30', // Default payment terms
          dataType: DataType.STRING,
          parameters: {
            customerPaymentHistory: {
              onTimePayments: 15,
              latePayments: 2,
              averageDaysLate: 5
            },
            orderHistory: {
              totalOrders: 20,
              totalAmount: 15000
            }
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-028',
          userId: 'user-028',
          timestamp: new Date(),
          entity: {
            orderAmount: 800,
            customerId: 'customer-005',
            paymentHistory: {
              onTimePayments: 15,
              latePayments: 2,
              averageDaysLate: 5
            }
          },
          entityType: 'order',
          entityId: 'order-011',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should evaluate SHIPPING_COST_CALCULATION operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-1',
          field: 'shippingCost',
          operator: BusinessOperator.SHIPPING_COST_CALCULATION,
          value: 15, // Maximum shipping cost
          dataType: DataType.NUMBER,
          parameters: {
            shippingRules: [
              { weightRange: [0, 5], cost: 5 },
              { weightRange: [5, 10], cost: 10 },
              { weightRange: [10, 20], cost: 15 },
              { weightRange: [20, 999], cost: 25 }
            ],
            freeShippingThreshold: 100
          }
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-029',
          userId: 'user-029',
          timestamp: new Date(),
          entity: {
            shippingCost: 10,
            weight: 8,
            orderTotal: 80,
            distance: 100,
            urgency: 'standard'
          },
          entityType: 'order',
          entityId: 'order-012',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true; // 10 <= 15
      });
    });

    describe('Condition Evaluation Edge Cases', () => {
      it('should handle missing field gracefully', async () => {
        const condition: RuleCondition = {
          id: 'cond-missing-field',
          field: 'nonExistentField',
          operator: ComparisonOperator.EQUALS,
          value: 'test',
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-030',
          userId: 'user-030',
          timestamp: new Date(),
          entity: { someOtherField: 'value' },
          entityType: 'test',
          entityId: 'test-001',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.false;
      });

      it('should handle null field values', async () => {
        const condition: RuleCondition = {
          id: 'cond-null-value',
          field: 'optionalField',
          operator: ComparisonOperator.EQUALS,
          value: null,
          dataType: DataType.STRING
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-031',
          userId: 'user-031',
          timestamp: new Date(),
          entity: { optionalField: null },
          entityType: 'test',
          entityId: 'test-002',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should handle type conversion correctly', async () => {
        const condition: RuleCondition = {
          id: 'cond-type-conversion',
          field: 'numericString',
          operator: ComparisonOperator.GREATER_THAN,
          value: 100,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-032',
          userId: 'user-032',
          timestamp: new Date(),
          entity: { numericString: '150' },
          entityType: 'test',
          entityId: 'test-003',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });

      it('should handle empty arrays in IN operator', async () => {
        const condition: RuleCondition = {
          id: 'cond-empty-array',
          field: 'category',
          operator: ComparisonOperator.IN,
          value: [],
          dataType: DataType.ARRAY
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-033',
          userId: 'user-033',
          timestamp: new Date(),
          entity: { category: 'test' },
          entityType: 'test',
          entityId: 'test-004',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.false;
      });

      it('should handle complex nested field paths', async () => {
        const condition: RuleCondition = {
          id: 'cond-complex-nested',
          field: 'order.items[0].product.attributes.weight',
          operator: ComparisonOperator.LESS_THAN,
          value: 10,
          dataType: DataType.NUMBER
        };

        const context: RuleExecutionContext = {
          correlationId: 'test-034',
          userId: 'user-034',
          timestamp: new Date(),
          entity: {
            order: {
              items: [
                {
                  product: {
                    attributes: {
                      weight: 5.5,
                      dimensions: { length: 10, width: 8, height: 3 }
                    },
                    name: 'Product A'
                  }
                }
              ]
            }
          },
          entityType: 'order',
          entityId: 'order-013',
          context: {}
        };

        const result = await conditionEvaluator.evaluate(condition, context);

        expect(result).to.be.true;
      });
    });
  });
});