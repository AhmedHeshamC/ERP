/**
 * Order-to-Cash Module Types and Interfaces
 * Following SOLID principles with clear separation of concerns
 */

// Core O2C Process Types
export enum O2CProcessStatus {
  PENDING = 'PENDING',
  CREDIT_CHECK = 'CREDIT_CHECK',
  PROCESSING = 'PROCESSING',
  FULFILLMENT = 'FULFILLMENT',
  INVOICING = 'INVOICING',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export enum CreditCheckResult {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MANUAL_REVIEW = 'MANUAL_REVIEW'
}

export enum FulfillmentStatus {
  PENDING = 'PENDING',
  ALLOCATED = 'ALLOCATED',
  PICKED = 'PICKED',
  PACKED = 'PACKED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum CollectionStatus {
  ACTIVE = 'ACTIVE',
  DUNNING_LEVEL_1 = 'DUNNING_LEVEL_1',
  DUNNING_LEVEL_2 = 'DUNNING_LEVEL_2',
  DUNNING_LEVEL_3 = 'DUNNING_LEVEL_3',
  LEGAL_COLLECTION = 'LEGAL_COLLECTION',
  WRITE_OFF = 'WRITE_OFF',
  CLOSED = 'CLOSED'
}

// Core Domain Entities
export interface O2COrder {
  id: string;
  customerId: string;
  orderNumber: string;
  orderDate: Date;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: O2CProcessStatus;
  creditCheckResult?: CreditCheckResult;
  fulfillmentStatus?: FulfillmentStatus;
  invoiceId?: string;
  paymentStatus?: PaymentStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  allocatedQuantity?: number;
  fulfilledQuantity?: number;
}

export interface CustomerCreditProfile {
  id: string;
  customerId: string;
  creditLimit: number;
  currentExposure: number;
  availableCredit: number;
  creditScore: number;
  lastCreditCheck: Date;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  paymentHistory: PaymentHistoryEntry[];
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
}

export interface PaymentHistoryEntry {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  daysPastDue: number;
  status: 'ON_TIME' | 'LATE' | 'DEFAULT';
}

export interface FulfillmentPlan {
  id: string;
  orderId: string;
  items: FulfillmentItem[];
  shippingAddress: Address;
  shippingMethod: string;
  estimatedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  trackingNumber?: string;
  status: FulfillmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface FulfillmentItem {
  id: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  warehouseLocation: string;
  pickedAt?: Date;
  packedAt?: Date;
  shippedAt?: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  paidAmount?: number;
  paidDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  status: PaymentStatus;
  processedAt?: Date;
  failureReason?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionCase {
  id: string;
  invoiceId: string;
  customerId: string;
  outstandingAmount: number;
  daysOverdue: number;
  status: CollectionStatus;
  dunningLevel: number;
  lastContactDate?: Date;
  nextContactDate?: Date;
  contactHistory: CollectionContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionContact {
  id: string;
  type: 'EMAIL' | 'PHONE' | 'SMS' | 'LETTER';
  sentAt: Date;
  response?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'RESPONDED';
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Service Interfaces (Following SOLID Interface Segregation)
export interface ICreditManagementService {
  checkCreditLimit(customerId: string, orderAmount: number): Promise<CreditCheckResult>;
  updateCreditExposure(customerId: string, amount: number): Promise<void>;
  getCreditProfile(customerId: string): Promise<CustomerCreditProfile>;
  evaluateCreditRisk(customerId: string): Promise<CreditCheckResult>;
}

export interface IOrderProcessingService {
  processOrder(orderData: Partial<O2COrder>): Promise<O2COrder>;
  validateOrder(order: O2COrder): Promise<boolean>;
  calculatePricing(orderId: string): Promise<void>;
  reserveInventory(orderId: string): Promise<void>;
  updateOrderStatus(orderId: string, status: O2CProcessStatus): Promise<void>;
}

export interface IFulfillmentService {
  createFulfillmentPlan(orderId: string): Promise<FulfillmentPlan>;
  allocateInventory(fulfillmentId: string): Promise<void>;
  pickItems(fulfillmentId: string): Promise<void>;
  packItems(fulfillmentId: string): Promise<void>;
  shipItems(fulfillmentId: string, shippingInfo: any): Promise<void>;
  updateFulfillmentStatus(fulfillmentId: string, status: FulfillmentStatus): Promise<void>;
}

export interface IInvoicingService {
  generateInvoice(orderId: string): Promise<Invoice>;
  calculateTaxAmount(invoice: Invoice): Promise<number>;
  postInvoice(invoiceId: string): Promise<void>;
  updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<void>;
  sendInvoice(invoiceId: string): Promise<void>;
}

export interface IPaymentProcessingService {
  processPayment(invoiceId: string, paymentData: any): Promise<Payment>;
  applyPayment(paymentId: string): Promise<void>;
  refundPayment(paymentId: string, amount: number): Promise<Payment>;
  updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<void>;
}

export interface ICollectionService {
  initiateCollection(invoiceId: string): Promise<CollectionCase>;
  processDunning(collectionId: string): Promise<void>;
  updateCollectionStatus(collectionId: string, status: CollectionStatus): Promise<void>;
  addCollectionContact(collectionId: string, contact: Omit<CollectionContact, 'id'>): Promise<void>;
  escalateCollection(collectionId: string): Promise<void>;
}

// Event Interfaces
export interface O2CEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: 'ORDER' | 'INVOICE' | 'PAYMENT' | 'COLLECTION';
  data: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
}

// O2C Specific Event Types
export interface OrderCreatedEvent extends O2CEvent {
  type: 'ORDER_CREATED';
  data: {
    orderId: string;
    customerId: string;
    orderAmount: number;
  };
}

export interface CreditCheckedEvent extends O2CEvent {
  type: 'CREDIT_CHECKED';
  data: {
    customerId: string;
    orderId: string;
    result: CreditCheckResult;
    creditLimit: number;
    orderAmount: number;
  };
}

export interface OrderFulfilledEvent extends O2CEvent {
  type: 'ORDER_FULFILLED';
  data: {
    orderId: string;
    fulfillmentId: string;
    trackingNumber?: string;
    estimatedDeliveryDate: Date;
  };
}

export interface InvoiceGeneratedEvent extends O2CEvent {
  type: 'INVOICE_GENERATED';
  data: {
    invoiceId: string;
    orderId: string;
    customerId: string;
    amount: number;
    dueDate: Date;
  };
}

export interface PaymentProcessedEvent extends O2CEvent {
  type: 'PAYMENT_PROCESSED';
  data: {
    paymentId: string;
    invoiceId: string;
    amount: number;
    paymentMethod: string;
  };
}

export interface CollectionInitiatedEvent extends O2CEvent {
  type: 'COLLECTION_INITIATED';
  data: {
    collectionId: string;
    invoiceId: string;
    customerId: string;
    outstandingAmount: number;
    daysOverdue: number;
  };
}

// Workflow Integration Interfaces
export interface O2CWorkflowRequest {
  orderId: string;
  customerId: string;
  orderAmount: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  userId?: string;
  metadata?: Record<string, any>;
}

export interface O2CWorkflowResult {
  success: boolean;
  orderId: string;
  status: O2CProcessStatus;
  completedSteps: string[];
  errors?: string[];
  metadata?: Record<string, any>;
}

// Credit Rule Engine Interfaces
export interface CreditRule {
  id: string;
  name: string;
  description: string;
  conditions: CreditRuleCondition[];
  actions: CreditRuleAction[];
  priority: number;
  isActive: boolean;
}

export interface CreditRuleCondition {
  field: string;
  operator: 'EQ' | 'GT' | 'LT' | 'GTE' | 'LTE' | 'IN' | 'NOT_IN';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface CreditRuleAction {
  type: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | 'SET_LIMIT' | 'BLOCK';
  parameters?: Record<string, any>;
}

// Monitoring and Metrics Interfaces
export interface O2CMetrics {
  totalOrders: number;
  completedOrders: number;
  averageOrderValue: number;
  averageCycleTime: number;
  creditApprovalRate: number;
  fulfillmentRate: number;
  onTimeDeliveryRate: number;
  collectionEfficiency: number;
  daysSalesOutstanding: number;
  badDebtPercentage: number;
}

export interface O2CKPIs {
  orderProcessingEfficiency: number;
  cashApplicationAccuracy: number;
  customerSatisfactionScore: number;
  operationalCostPerOrder: number;
  firstPassYield: number;
}

// Error Types
export class O2CError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'O2CError';
  }
}

export class CreditLimitExceededError extends O2CError {
  constructor(customerId: string, requestedAmount: number, availableCredit: number) {
    super(
      `Credit limit exceeded for customer ${customerId}. Requested: ${requestedAmount}, Available: ${availableCredit}`,
      'CREDIT_LIMIT_EXCEEDED',
      { customerId, requestedAmount, availableCredit }
    );
  }
}

export class InsufficientInventoryError extends O2CError {
  constructor(productId: string, requestedQuantity: number, availableQuantity: number) {
    super(
      `Insufficient inventory for product ${productId}. Requested: ${requestedQuantity}, Available: ${availableQuantity}`,
      'INSUFFICIENT_INVENTORY',
      { productId, requestedQuantity, availableQuantity }
    );
  }
}

export class PaymentProcessingError extends O2CError {
  constructor(invoiceId: string, paymentMethod: string, reason: string) {
    super(
      `Payment processing failed for invoice ${invoiceId} using ${paymentMethod}: ${reason}`,
      'PAYMENT_PROCESSING_FAILED',
      { invoiceId, paymentMethod, reason }
    );
  }
}