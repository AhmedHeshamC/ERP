/**
 * Business Rules specific types and predefined rule templates
 * Contains domain-specific rule definitions for common business scenarios
 */

import {
  RuleTemplate,
  RuleCategory,
  ComparisonOperator,
  BusinessOperator,
  ActionType,
  DataType,
  TemplateParameter
} from '../interfaces/rule-definition.interface';

// Credit limit rule types
export interface CreditLimitRuleContext {
  customerId: string;
  customerType: 'individual' | 'business';
  currentBalance: number;
  creditLimit: number;
  orderAmount: number;
  paymentHistory: {
    onTimePayments: number;
    latePayments: number;
    averageDaysLate: number;
  };
  customerSince: Date;
  creditScore?: number;
}

export interface CreditLimitRuleResult {
  approved: boolean;
  newLimit?: number;
  reason: string;
  requiresApproval: boolean;
  approvalLevel?: 'manager' | 'director' | 'executive';
}

// Pricing rule types
export interface PricingRuleContext {
  productId: string;
  productCategory: string;
  quantity: number;
  customerId: string;
  customerSegment: string;
  basePrice: number;
  currentPrice: number;
  orderTotal: number;
  region: string;
  season: string;
  competitorPrice?: number;
  cost: number;
  margin: number;
}

export interface PricingRuleResult {
  finalPrice: number;
  originalPrice: number;
  discount: number;
  discountReason: string;
  validUntil?: Date;
  promotional: boolean;
}

// Discount rule types
export interface DiscountRuleContext {
  customerId: string;
  customerSegment: string;
  orderTotal: number;
  productIds: string[];
  productCategories: string[];
  quantity: number;
  orderDate: Date;
  loyaltyPoints?: number;
  previousOrders: number;
  couponCode?: string;
  season: string;
  region: string;
}

export interface DiscountRuleResult {
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  discountType: 'percentage' | 'fixed' | 'bogo' | 'tiered';
  discountReason: string;
  applicableItems: string[];
}

// Inventory rule types
export interface InventoryRuleContext {
  productId: string;
  productCategory: string;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  demandRate: number;
  leadTime: number;
  safetyStock: number;
  season: string;
  supplier: string;
  cost: number;
  location: string;
}

export interface InventoryRuleResult {
  action: 'reorder' | 'clearance' | 'promotion' | 'none';
  quantity: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  suggestedPrice?: number;
}

// Approval matrix rule types
export interface ApprovalRuleContext {
  requestType: 'purchase_order' | 'expense' | 'discount' | 'credit' | 'contract';
  amount: number;
  requestorId: string;
  requestorRole: string;
  requestorDepartment: string;
  requestorLevel: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: 'low' | 'medium' | 'high';
  category: string;
}

export interface ApprovalRuleResult {
  requiresApproval: boolean;
  approvalLevels: ApprovalLevel[];
  autoApprove: boolean;
  reason: string;
  escalationRules?: EscalationRule[];
}

export interface ApprovalLevel {
  level: number;
  role: string;
  department?: string;
  canApprove: boolean;
  threshold: number;
}

export interface EscalationRule {
  condition: string;
  escalateTo: string;
  timeLimit: number;
}

// Tax calculation rule types
export interface TaxRuleContext {
  customerId: string;
  customerType: 'individual' | 'business' | 'non_profit' | 'government';
  productId: string;
  productCategory: string;
  amount: number;
  quantity: number;
  region: string;
  country: string;
  state?: string;
  city?: string;
  taxExempt: boolean;
  taxExemptReason?: string;
  date: Date;
}

export interface TaxRuleResult {
  taxAmount: number;
  taxRate: number;
  taxJurisdictions: TaxJurisdiction[];
  exempt: boolean;
  exemptReason?: string;
}

export interface TaxJurisdiction {
  name: string;
  type: 'federal' | 'state' | 'city' | 'county' | 'special';
  rate: number;
  amount: number;
}

// Payment term rule types
export interface PaymentTermRuleContext {
  customerId: string;
  customerType: 'individual' | 'business';
  orderAmount: number;
  orderHistory: {
    totalOrders: number;
    totalAmount: number;
    averageOrderValue: number;
    averagePaymentDays: number;
    latePayments: number;
  };
  creditScore?: number;
  industry: string;
  region: string;
  productCategory: string;
}

export interface PaymentTermRuleResult {
  paymentTerms: string;
  dueDays: number;
  discountDays?: number;
  discountPercentage?: number;
  creditLimit?: number;
  requiresDeposit: boolean;
  depositPercentage?: number;
  reason: string;
}

// Shipping cost rule types
export interface ShippingRuleContext {
  customerId: string;
  customerSegment: string;
  orderAmount: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  origin: string;
  destination: string;
  distance: number;
  urgency: 'standard' | 'express' | 'overnight';
  productCategory: string;
  handlingRequired: boolean;
}

export interface ShippingRuleResult {
  shippingCost: number;
  shippingMethod: string;
  estimatedDelivery: Date;
  freeShipping: boolean;
  reason: string;
}

// Predefined business rule templates
export const CREDIT_LIMIT_RULE_TEMPLATE: RuleTemplate = {
  id: 'credit-limit-check',
  name: 'Credit Limit Check',
  description: 'Validates if customer has sufficient credit limit for order',
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

export const PRICING_RULE_TEMPLATE: RuleTemplate = {
  id: 'dynamic-pricing',
  name: 'Dynamic Pricing Rule',
  description: 'Calculates dynamic pricing based on various factors',
  category: RuleCategory.PRICING,
  conditions: [
    {
      field: 'productCategory',
      operator: ComparisonOperator.IN,
      dataType: DataType.STRING,
      valueTemplate: '{{eligibleCategories}}',
      required: true,
      description: 'Product must be in eligible category'
    },
    {
      field: 'customerSegment',
      operator: ComparisonOperator.IN,
      dataType: DataType.STRING,
      valueTemplate: '{{eligibleSegments}}',
      required: true,
      description: 'Customer must be in eligible segment'
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
          defaultValue: 'basePrice * (1 - discountPercentage)',
          description: 'Price calculation formula'
        },
        discountPercentage: {
          name: 'discountPercentage',
          type: DataType.DECIMAL,
          required: true,
          defaultValue: 0.1,
          description: 'Discount percentage'
        }
      },
      required: true,
      description: 'Calculate final price'
    },
    {
      type: ActionType.SET_FIELD,
      parameterTemplates: {
        field: {
          name: 'field',
          type: DataType.STRING,
          required: true,
          defaultValue: 'finalPrice',
          description: 'Field to set'
        },
        value: {
          name: 'value',
          type: DataType.NUMBER,
          required: true,
          description: 'Value to set'
        }
      },
      required: false,
      description: 'Set the final price field'
    }
  ],
  parameters: [
    {
      name: 'eligibleCategories',
      type: DataType.ARRAY,
      required: true,
      description: 'Eligible product categories'
    },
    {
      name: 'eligibleSegments',
      type: DataType.ARRAY,
      required: true,
      description: 'Eligible customer segments'
    },
    {
      name: 'basePrice',
      type: DataType.NUMBER,
      required: true,
      description: 'Base product price'
    }
  ]
};

export const INVENTORY_RULE_TEMPLATE: RuleTemplate = {
  id: 'inventory-reorder',
  name: 'Inventory Reorder Rule',
  description: 'Determines when to reorder inventory items',
  category: RuleCategory.INVENTORY,
  conditions: [
    {
      field: 'currentStock',
      operator: ComparisonOperator.LESS_THAN_OR_EQUAL,
      dataType: DataType.NUMBER,
      valueTemplate: '{{reorderLevel}}',
      required: true,
      description: 'Current stock must be at or below reorder level'
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
          defaultValue: 'inventory@company.com',
          description: 'Notification recipient'
        },
        subject: {
          name: 'subject',
          type: DataType.STRING,
          required: true,
          defaultValue: 'Inventory Reorder Required',
          description: 'Notification subject'
        },
        message: {
          name: 'message',
          type: DataType.STRING,
          required: true,
          description: 'Notification message'
        }
      },
      required: true,
      description: 'Send reorder notification'
    },
    {
      type: ActionType.TRIGGER_WORKFLOW,
      parameterTemplates: {
        workflowId: {
          name: 'workflowId',
          type: DataType.STRING,
          required: true,
          defaultValue: 'inventory-reorder',
          description: 'Workflow to trigger'
        }
      },
      required: false,
      description: 'Trigger reorder workflow'
    }
  ],
  parameters: [
    {
      name: 'reorderLevel',
      type: DataType.NUMBER,
      required: true,
      description: 'Reorder level threshold'
    },
    {
      name: 'productId',
      type: DataType.STRING,
      required: true,
      description: 'Product identifier'
    }
  ]
};

export const DISCOUNT_ELIGIBILITY_TEMPLATE: RuleTemplate = {
  id: 'discount-eligibility',
  name: 'Discount Eligibility Rule',
  description: 'Determines customer eligibility for discounts',
  category: RuleCategory.DISCOUNT,
  conditions: [
    {
      field: 'orderTotal',
      operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
      dataType: DataType.NUMBER,
      valueTemplate: '{{minimumOrderAmount}}',
      required: true,
      description: 'Order must meet minimum amount'
    },
    {
      field: 'customerSegment',
      operator: ComparisonOperator.IN,
      dataType: DataType.STRING,
      valueTemplate: '{{eligibleSegments}}',
      required: true,
      description: 'Customer must be in eligible segment'
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
          defaultValue: 'percentage',
          description: 'Type of discount'
        },
        discountValue: {
          name: 'discountValue',
          type: DataType.DECIMAL,
          required: true,
          description: 'Discount value'
        }
      },
      required: true,
      description: 'Calculate discount amount'
    }
  ],
  parameters: [
    {
      name: 'minimumOrderAmount',
      type: DataType.NUMBER,
      required: true,
      defaultValue: 100,
      description: 'Minimum order amount for discount'
    },
    {
      name: 'eligibleSegments',
      type: DataType.ARRAY,
      required: true,
      description: 'Eligible customer segments'
    }
  ]
};

export const APPROVAL_MATRIX_TEMPLATE: RuleTemplate = {
  id: 'approval-matrix',
  name: 'Approval Matrix Rule',
  description: 'Determines approval requirements based on amount and type',
  category: RuleCategory.APPROVAL,
  conditions: [
    {
      field: 'amount',
      operator: ComparisonOperator.GREATER_THAN,
      dataType: DataType.NUMBER,
      valueTemplate: '{{autoApprovalLimit}}',
      required: true,
      description: 'Amount exceeds auto-approval limit'
    },
    {
      field: 'requestorLevel',
      operator: ComparisonOperator.LESS_THAN,
      dataType: DataType.NUMBER,
      valueTemplate: '{{requiredLevel}}',
      required: true,
      description: 'Requestor level is insufficient'
    }
  ],
  actions: [
    {
      type: ActionType.ESCALATE,
      parameterTemplates: {
        approver: {
          name: 'approver',
          type: DataType.STRING,
          required: true,
          description: 'Approver to escalate to'
        },
        reason: {
          name: 'reason',
          type: DataType.STRING,
          required: true,
          description: 'Escalation reason'
        }
      },
      required: true,
      description: 'Escalate for approval'
    }
  ],
  parameters: [
    {
      name: 'autoApprovalLimit',
      type: DataType.NUMBER,
      required: true,
      description: 'Auto-approval limit'
    },
    {
      name: 'requiredLevel',
      type: DataType.INTEGER,
      required: true,
      description: 'Required approval level'
    }
  ]
};

// Business rule factory
export class BusinessRuleFactory {
  static createCreditLimitRule(config: {
    customerId: string;
    orderAmount: number;
    currentBalance: number;
    creditLimit: number;
  }): any {
    return {
      id: `credit-check-${Date.now()}`,
      name: 'Credit Limit Validation',
      category: RuleCategory.FINANCIAL,
      conditions: [
        {
          field: 'orderAmount',
          operator: BusinessOperator.CREDIT_LIMIT_CHECK,
          value: config.creditLimit - config.currentBalance
        }
      ],
      actions: [
        {
          type: config.orderAmount <= (config.creditLimit - config.currentBalance)
            ? ActionType.APPROVE
            : ActionType.ESCALATE
        }
      ]
    };
  }

  static createPricingRule(config: {
    productId: string;
    basePrice: number;
    customerSegment: string;
    quantity: number;
  }): any {
    return {
      id: `pricing-${Date.now()}`,
      name: 'Dynamic Pricing Calculation',
      category: RuleCategory.PRICING,
      conditions: [
        {
          field: 'customerSegment',
          operator: ComparisonOperator.EQUALS,
          value: config.customerSegment
        }
      ],
      actions: [
        {
          type: ActionType.CALCULATE,
          parameters: {
            formula: 'basePrice * volumeMultiplier * segmentMultiplier',
            basePrice: config.basePrice,
            quantity: config.quantity
          }
        }
      ]
    };
  }

  static createInventoryRule(config: {
    productId: string;
    currentStock: number;
    reorderLevel: number;
  }): any {
    return {
      id: `inventory-${Date.now()}`,
      name: 'Inventory Reorder Check',
      category: RuleCategory.INVENTORY,
      conditions: [
        {
          field: 'currentStock',
          operator: BusinessOperator.INVENTORY_AVAILABILITY,
          value: config.reorderLevel
        }
      ],
      actions: [
        {
          type: config.currentStock <= config.reorderLevel
            ? ActionType.SEND_NOTIFICATION
            : ActionType.LOG_EVENT,
          parameters: {
            productId: config.productId,
            currentStock: config.currentStock
          }
        }
      ]
    };
  }
}