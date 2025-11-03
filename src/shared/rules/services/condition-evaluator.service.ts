import { Injectable } from '@nestjs/common';
import {
  IConditionEvaluator,
  RuleCondition,
  RuleExecutionContext,
  ComparisonOperator,
  LogicalOperator,
  BusinessOperator,
  DataType
} from '../interfaces/rule-definition.interface';

@Injectable()
export class ConditionEvaluatorService implements IConditionEvaluator {
  private operators: Map<string, Function> = new Map();

  constructor() {
    this.registerDefaultOperators();
  }

  async evaluate(condition: RuleCondition, context: RuleExecutionContext): Promise<boolean> {
    try {
      const fieldValue = this.getFieldValue(condition.field, context);
      const conditionValue = condition.value;

      let result = await this.evaluateOperator(condition.operator, fieldValue, conditionValue, condition, context);

      // Apply negation if specified
      if (condition.negate) {
        result = !result;
      }

      return result;
    } catch (error) {
      console.error(`Error evaluating condition ${condition.id}:`, error);
      return false;
    }
  }

  async evaluateConditions(
    conditions: RuleCondition[],
    context: RuleExecutionContext,
    logicalOperator: LogicalOperator = LogicalOperator.AND
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    const results = await Promise.all(
      conditions.map(condition => this.evaluate(condition, context))
    );

    switch (logicalOperator) {
      case LogicalOperator.AND:
        return results.every(result => result);
      case LogicalOperator.OR:
        return results.some(result => result);
      case LogicalOperator.XOR:
        return results.filter(result => result).length === 1;
      case LogicalOperator.NOT:
        return !results[0]; // NOT only makes sense with single condition
      default:
        return results.every(result => result);
    }
  }

  registerOperator(operator: string, evaluator: Function): void {
    this.operators.set(operator, evaluator);
  }

  getOperators(): string[] {
    return Array.from(this.operators.keys());
  }

  private async evaluateOperator(
    operator: string,
    fieldValue: any,
    conditionValue: any,
    condition: RuleCondition,
    context: RuleExecutionContext
  ): Promise<boolean> {
    const evaluator = this.operators.get(operator);
    if (!evaluator) {
      throw new Error(`Unknown operator: ${operator}`);
    }

    return evaluator(fieldValue, conditionValue, condition, context);
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

  private registerDefaultOperators(): void {
    // Comparison Operators
    this.operators.set(ComparisonOperator.EQUALS, (fieldValue: any, conditionValue: any) => {
      return this.compareValues(fieldValue, conditionValue, 'equals');
    });

    this.operators.set(ComparisonOperator.NOT_EQUALS, (fieldValue: any, conditionValue: any) => {
      return this.compareValues(fieldValue, conditionValue, 'not_equals');
    });

    this.operators.set(ComparisonOperator.GREATER_THAN, (fieldValue: any, conditionValue: any) => {
      return this.compareNumericValues(fieldValue, conditionValue, '>');
    });

    this.operators.set(ComparisonOperator.GREATER_THAN_OR_EQUAL, (fieldValue: any, conditionValue: any) => {
      return this.compareNumericValues(fieldValue, conditionValue, '>=');
    });

    this.operators.set(ComparisonOperator.LESS_THAN, (fieldValue: any, conditionValue: any) => {
      return this.compareNumericValues(fieldValue, conditionValue, '<');
    });

    this.operators.set(ComparisonOperator.LESS_THAN_OR_EQUAL, (fieldValue: any, conditionValue: any) => {
      return this.compareNumericValues(fieldValue, conditionValue, '<=');
    });

    this.operators.set(ComparisonOperator.CONTAINS, (fieldValue: any, conditionValue: any) => {
      const fieldStr = String(fieldValue || '').toLowerCase();
      const conditionStr = String(conditionValue || '').toLowerCase();
      return fieldStr.includes(conditionStr);
    });

    this.operators.set(ComparisonOperator.NOT_CONTAINS, (fieldValue: any, conditionValue: any) => {
      return !this.operators.get(ComparisonOperator.CONTAINS)?.(fieldValue, conditionValue);
    });

    this.operators.set(ComparisonOperator.STARTS_WITH, (fieldValue: any, conditionValue: any) => {
      const fieldStr = String(fieldValue || '').toLowerCase();
      const conditionStr = String(conditionValue || '').toLowerCase();
      return fieldStr.startsWith(conditionStr);
    });

    this.operators.set(ComparisonOperator.ENDS_WITH, (fieldValue: any, conditionValue: any) => {
      const fieldStr = String(fieldValue || '').toLowerCase();
      const conditionStr = String(conditionValue || '').toLowerCase();
      return fieldStr.endsWith(conditionStr);
    });

    this.operators.set(ComparisonOperator.IN, (fieldValue: any, conditionValue: any) => {
      if (!Array.isArray(conditionValue)) {
        return false;
      }
      return conditionValue.includes(fieldValue);
    });

    this.operators.set(ComparisonOperator.NOT_IN, (fieldValue: any, conditionValue: any) => {
      return !this.operators.get(ComparisonOperator.IN)?.(fieldValue, conditionValue);
    });

    this.operators.set(ComparisonOperator.BETWEEN, (fieldValue: any, conditionValue: any) => {
      if (!Array.isArray(conditionValue) || conditionValue.length !== 2) {
        return false;
      }
      const [min, max] = conditionValue;
      const numValue = this.toNumber(fieldValue);
      const numMin = this.toNumber(min);
      const numMax = this.toNumber(max);
      return numValue >= numMin && numValue <= numMax;
    });

    this.operators.set(ComparisonOperator.IS_NULL, (fieldValue: any) => {
      return fieldValue === null || fieldValue === undefined;
    });

    this.operators.set(ComparisonOperator.IS_NOT_NULL, (fieldValue: any) => {
      return fieldValue !== null && fieldValue !== undefined;
    });

    this.operators.set(ComparisonOperator.REGEX, (fieldValue: any, conditionValue: any) => {
      try {
        const regex = new RegExp(conditionValue);
        return regex.test(String(fieldValue || ''));
      } catch {
        return false;
      }
    });

    // Business Operators
    this.operators.set(BusinessOperator.CREDIT_LIMIT_CHECK, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const orderAmount = this.toNumber(fieldValue);
      const availableCredit = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};
      const currentBalance = this.toNumber(parameters.currentBalance);
      const creditLimit = this.toNumber(parameters.creditLimit);

      return orderAmount <= availableCredit || orderAmount <= (creditLimit - currentBalance);
    });

    this.operators.set(BusinessOperator.INVENTORY_AVAILABILITY, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const requestedQuantity = this.toNumber(fieldValue);
      const reorderLevel = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};
      const currentStock = this.toNumber(parameters.currentStock);
      const reservedStock = this.toNumber(parameters.reservedStock || 0);

      const availableStock = currentStock - reservedStock;
      return requestedQuantity <= availableStock && currentStock > reorderLevel;
    });

    this.operators.set(BusinessOperator.PRICING_RULE, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const finalPrice = this.toNumber(fieldValue);
      const minPrice = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};
      const basePrice = this.toNumber(parameters.basePrice);
      const discountRules = parameters.discountRules || [];

      let calculatedPrice = basePrice;
      for (const rule of discountRules) {
        if (rule.type === 'volume' && rule.quantity) {
          // Apply volume discount logic here
        } else if (rule.type === 'customer' && rule.segment) {
          // Apply customer segment discount logic here
        }
      }

      return finalPrice >= minPrice && finalPrice <= calculatedPrice;
    });

    this.operators.set(BusinessOperator.DISCOUNT_ELIGIBILITY, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const orderTotal = this.toNumber(fieldValue);
      const minOrderAmount = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};

      const customerEligibility = parameters.customerEligibility || {};
      const productEligibility = parameters.productEligibility || {};

      // Check customer eligibility
      if (customerEligibility.segments && Array.isArray(customerEligibility.segments)) {
        // Would need to check against actual customer segment from context
      }

      // Check product eligibility
      if (productEligibility.categories && Array.isArray(productEligibility.categories)) {
        // Would need to check against actual product categories from context
      }

      return orderTotal >= minOrderAmount;
    });

    this.operators.set(BusinessOperator.TAX_CALCULATION, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const taxAmount = this.toNumber(fieldValue);
      const expectedTaxRate = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};
      const amount = this.toNumber(parameters.amount) || 100;

      const calculatedTax = amount * expectedTaxRate;
      return Math.abs(taxAmount - calculatedTax) < 0.01; // Allow small floating point differences
    });

    this.operators.set(BusinessOperator.APPROVAL_MATRIX, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const requestAmount = this.toNumber(fieldValue);
      const autoApprovalLimit = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};

      const approvalLevels = parameters.approvalLevels || [];
      const requestorRole = parameters.requestorRole;
      const requestorLevel = parameters.requestorLevel || 0;

      // Find applicable approval level
      const applicableLevel = approvalLevels.find((level: any) =>
        requestAmount <= level.limit && this.checkRoleApproval(requestorRole, level.roles)
      );

      return requestAmount > autoApprovalLimit && !applicableLevel;
    });

    this.operators.set(BusinessOperator.PAYMENT_TERM_CHECK, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const orderAmount = this.toNumber(fieldValue);
      const defaultTerms = String(conditionValue);
      const parameters = condition.parameters || {};

      const customerPaymentHistory = parameters.customerPaymentHistory || {};
      const onTimePayments = customerPaymentHistory.onTimePayments || 0;
      const totalOrders = customerPaymentHistory.totalOrders || 1;

      const paymentHistoryRatio = onTimePayments / totalOrders;

      // Good payment history (> 90% on-time) gets better terms
      if (paymentHistoryRatio > 0.9) {
        return true; // Eligible for standard or better terms
      }

      return orderAmount < 1000; // Lower amounts get more lenient terms
    });

    this.operators.set(BusinessOperator.SHIPPING_COST_CALCULATION, (fieldValue: any, conditionValue: any, condition: RuleCondition) => {
      const shippingCost = this.toNumber(fieldValue);
      const maxShippingCost = this.toNumber(conditionValue);
      const parameters = condition.parameters || {};

      const shippingRules = parameters.shippingRules || [];
      const weight = this.toNumber(parameters.weight);
      const freeShippingThreshold = this.toNumber(parameters.freeShippingThreshold);

      // Check for free shipping
      const orderTotal = this.toNumber(parameters.orderTotal);
      if (freeShippingThreshold && orderTotal >= freeShippingThreshold) {
        return shippingCost === 0;
      }

      // Calculate expected shipping cost based on rules
      let expectedCost = 0;
      for (const rule of shippingRules) {
        if (weight >= rule.weightRange[0] && weight <= rule.weightRange[1]) {
          expectedCost = rule.cost;
          break;
        }
      }

      return shippingCost <= maxShippingCost && Math.abs(shippingCost - expectedCost) < 1.0;
    });
  }

  private compareValues(fieldValue: any, conditionValue: any, operator: string): boolean {
    // Handle null/undefined cases
    if (fieldValue === null || fieldValue === undefined) {
      return operator === 'equals' ? conditionValue === null : conditionValue !== null;
    }

    if (conditionValue === null || conditionValue === undefined) {
      return operator === 'equals' ? false : true;
    }

    // Type conversion for comparison
    const fieldStr = String(fieldValue);
    const conditionStr = String(conditionValue);

    switch (operator) {
      case 'equals':
        return fieldStr === conditionStr;
      case 'not_equals':
        return fieldStr !== conditionStr;
      default:
        return false;
    }
  }

  private compareNumericValues(fieldValue: any, conditionValue: any, operator: string): boolean {
    const fieldNum = this.toNumber(fieldValue);
    const conditionNum = this.toNumber(conditionValue);

    if (isNaN(fieldNum) || isNaN(conditionNum)) {
      return false;
    }

    switch (operator) {
      case '>':
        return fieldNum > conditionNum;
      case '>=':
        return fieldNum >= conditionNum;
      case '<':
        return fieldNum < conditionNum;
      case '<=':
        return fieldNum <= conditionNum;
      default:
        return false;
    }
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return 0;
  }

  private checkRoleApproval(requestorRole: string, approverRoles: string[]): boolean {
    // Simple implementation - in real system would check role hierarchy
    return !approverRoles.includes(requestorRole);
  }
}