import { O2COrder, OrderItem, O2CProcessStatus } from '../types/o2c.types';

/**
 * O2C Order Entity - Encapsulates order business logic and validation
 * Follows SOLID Single Responsibility Principle
 */
export class O2COrderEntity implements O2COrder {
  public readonly id: string;
  public readonly customerId: string;
  public readonly orderNumber: string;
  public readonly orderDate: Date;
  public items: OrderItem[];
  public totalAmount: number;
  public readonly currency: string;
  public status: O2CProcessStatus;
  public creditCheckResult?: any;
  public fulfillmentStatus?: any;
  public invoiceId?: string;
  public paymentStatus?: any;
  public metadata: Record<string, any>;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(data: Omit<O2COrder, 'totalAmount'>) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.orderNumber = data.orderNumber;
    this.orderDate = data.orderDate;
    this.items = data.items;
    this.currency = data.currency;
    this.status = data.status;
    this.creditCheckResult = data.creditCheckResult;
    this.fulfillmentStatus = data.fulfillmentStatus;
    this.invoiceId = data.invoiceId;
    this.paymentStatus = data.paymentStatus;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    // Calculate total amount from items
    this.totalAmount = this.calculateTotalAmount();
  }

  /**
   * Calculate total order amount including discounts
   * O(1) complexity for calculation
   */
  private calculateTotalAmount(): number {
    return this.items.reduce((total, item) => {
      return total + (item.totalPrice || (item.quantity * item.unitPrice * (1 - item.discount / 100)));
    }, 0);
  }

  /**
   * Validate order data according to business rules
   * Returns validation result with errors if any
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this.customerId) {
      errors.push('Customer ID is required');
    }

    if (!this.orderNumber) {
      errors.push('Order number is required');
    }

    if (!this.orderDate) {
      errors.push('Order date is required');
    }

    if (!this.currency || this.currency.length !== 3) {
      errors.push('Valid currency code (3 characters) is required');
    }

    // Validate items
    if (!this.items || this.items.length === 0) {
      errors.push('Order must have at least one item');
    } else {
      this.items.forEach((item, index) => {
        const itemErrors = this.validateOrderItem(item, index);
        errors.push(...itemErrors);
      });
    }

    // Validate total amount
    if (this.totalAmount <= 0) {
      errors.push('Total amount must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual order item
   * O(1) complexity per item validation
   */
  private validateOrderItem(item: OrderItem, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Item ${index + 1}`;

    if (!item.productId) {
      errors.push(`${prefix}: Product ID is required`);
    }

    if (!item.quantity || item.quantity <= 0) {
      errors.push(`${prefix}: Quantity must be greater than 0`);
    }

    if (!item.unitPrice || item.unitPrice <= 0) {
      errors.push(`${prefix}: Unit price must be greater than 0`);
    }

    if (item.discount !== undefined && (item.discount < 0 || item.discount > 100)) {
      errors.push(`${prefix}: Discount must be between 0 and 100`);
    }

    // Calculate and validate total price
    const calculatedTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    if (item.totalPrice && Math.abs(item.totalPrice - calculatedTotal) > 0.01) {
      errors.push(`${prefix}: Total price calculation mismatch`);
    }

    return errors;
  }

  /**
   * Update order status with validation
   */
  public updateStatus(newStatus: O2CProcessStatus): void {
    const validTransitions: Record<O2CProcessStatus, O2CProcessStatus[]> = {
      [O2CProcessStatus.PENDING]: [O2CProcessStatus.CREDIT_CHECK, O2CProcessStatus.CANCELLED],
      [O2CProcessStatus.CREDIT_CHECK]: [O2CProcessStatus.PROCESSING, O2CProcessStatus.CANCELLED, O2CProcessStatus.FAILED],
      [O2CProcessStatus.PROCESSING]: [O2CProcessStatus.FULFILLMENT, O2CProcessStatus.CANCELLED, O2CProcessStatus.FAILED],
      [O2CProcessStatus.FULFILLMENT]: [O2CProcessStatus.INVOICING, O2CProcessStatus.CANCELLED, O2CProcessStatus.FAILED],
      [O2CProcessStatus.INVOICING]: [O2CProcessStatus.PAYMENT_PROCESSING, O2CProcessStatus.CANCELLED, O2CProcessStatus.FAILED],
      [O2CProcessStatus.PAYMENT_PROCESSING]: [O2CProcessStatus.COMPLETED, O2CProcessStatus.FAILED],
      [O2CProcessStatus.COMPLETED]: [], // Terminal state
      [O2CProcessStatus.CANCELLED]: [], // Terminal state
      [O2CProcessStatus.FAILED]: [] // Terminal state
    };

    const allowedTransitions = validTransitions[this.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Add item to order
   */
  public addItem(item: OrderItem): void {
    this.items.push(item);
    this.totalAmount = this.calculateTotalAmount();
    this.updatedAt = new Date();
  }

  /**
   * Remove item from order
   */
  public removeItem(itemId: string): void {
    this.items = this.items.filter(item => item.id !== itemId);
    this.totalAmount = this.calculateTotalAmount();
    this.updatedAt = new Date();
  }

  /**
   * Update item quantity
   */
  public updateItemQuantity(itemId: string, newQuantity: number): void {
    const item = this.items.find(item => item.id === itemId);
    if (!item) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    item.quantity = newQuantity;
    item.totalPrice = newQuantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    this.totalAmount = this.calculateTotalAmount();
    this.updatedAt = new Date();
  }

  /**
   * Check if order can be cancelled
   */
  public canBeCancelled(): boolean {
    const cancellableStatuses = [
      O2CProcessStatus.PENDING,
      O2CProcessStatus.CREDIT_CHECK,
      O2CProcessStatus.PROCESSING
    ];
    return cancellableStatuses.includes(this.status);
  }

  /**
   * Check if order is in terminal state
   */
  public isTerminal(): boolean {
    const terminalStates = [
      O2CProcessStatus.COMPLETED,
      O2CProcessStatus.CANCELLED,
      O2CProcessStatus.FAILED
    ];
    return terminalStates.includes(this.status);
  }

  /**
   * Get order summary for reporting
   */
  public getSummary(): {
    orderId: string;
    orderNumber: string;
    customerId: string;
    itemCount: number;
    totalAmount: number;
    currency: string;
    status: O2CProcessStatus;
    orderDate: Date;
  } {
    return {
      orderId: this.id,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      itemCount: this.items.length,
      totalAmount: this.totalAmount,
      currency: this.currency,
      status: this.status,
      orderDate: this.orderDate
    };
  }

  /**
   * Clone order entity
   */
  public clone(): O2COrderEntity {
    return new O2COrderEntity({
      id: this.id,
      customerId: this.customerId,
      orderNumber: this.orderNumber,
      orderDate: this.orderDate,
      items: this.items.map(item => ({ ...item })),
      currency: this.currency,
      status: this.status,
      creditCheckResult: this.creditCheckResult,
      fulfillmentStatus: this.fulfillmentStatus,
      invoiceId: this.invoiceId,
      paymentStatus: this.paymentStatus,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    });
  }
}