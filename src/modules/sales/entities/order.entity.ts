import { OrderStatus } from '../enums/sales.enum';

/**
 * Order Entity - Following SOLID Principles
 *
 * Single Responsibility: Only handles order data and business logic
 * Open/Closed: Open for extension through interfaces, closed for modification
 * Interface Segregation: Focused order interface with essential methods
 * Dependency Inversion: Depends on abstractions, not concretions
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clean, focused implementation
 * No unnecessary complexity, focused on order management
 */
export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface OrderItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface OrderData {
  orderNumber: string;
  customerId: string;
  description: string;
  totalAmount?: number;
  currency: string;
  status?: OrderStatus;
  items: OrderItem[];
  taxRate?: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  expectedDeliveryDate?: Date;
}

export class Order {
  public readonly id?: string;
  public readonly orderNumber: string;
  public readonly customerId: string;
  public description: string;
  public totalAmount: number;
  public readonly currency: string;
  public status: OrderStatus;
  public isActive: boolean;
  public readonly items: OrderItem[];
  public readonly taxRate: number;
  public readonly shippingAddress?: Address;
  public readonly billingAddress?: Address;
  public notes?: string;
  public readonly expectedDeliveryDate?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public confirmedAt?: Date;
  public shippedAt?: Date;
  public deliveredAt?: Date;
  public cancelledAt?: Date;
  public cancellationReason?: string;

  constructor(data: OrderData) {
    // Validate input data
    this.validateOrderNumber(data.orderNumber);
    this.validateItems(data.items);
    this.validateCurrency(data.currency);

    // Assign values
    this.orderNumber = data.orderNumber.trim();
    this.customerId = data.customerId.trim();
    this.description = data.description.trim();
    this.currency = data.currency.trim().toUpperCase();
    this.status = data.status || OrderStatus.DRAFT;
    this.isActive = this.status !== OrderStatus.CANCELLED;
    this.items = data.items.map(item => ({
      ...item,
      description: item.description.trim(),
    }));
    this.taxRate = data.taxRate || 0;
    this.shippingAddress = data.shippingAddress;
    this.billingAddress = data.billingAddress;
    this.notes = data.notes?.trim();
    this.expectedDeliveryDate = data.expectedDeliveryDate;

    // Calculate total amount if not provided
    if (data.totalAmount !== undefined) {
      this.validateTotalAmount(data.totalAmount);
      this.totalAmount = data.totalAmount;
    } else {
      this.totalAmount = this.calculateSubtotal();
    }

    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
  }

  /**
   * Confirm order - KISS: Simple, direct action
   */
  public confirm(): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new Error('Cannot confirm order that is not in DRAFT status');
    }
    this.updateStatus(OrderStatus.CONFIRMED);
  }

  /**
   * Ship order - KISS: Simple, direct action
   */
  public ship(): void {
    if (this.status !== OrderStatus.CONFIRMED) {
      throw new Error('Cannot ship unconfirmed order');
    }
    this.updateStatus(OrderStatus.SHIPPED);
  }

  /**
   * Deliver order - KISS: Simple, direct action
   */
  public deliver(): void {
    if (this.status !== OrderStatus.SHIPPED) {
      throw new Error('Cannot deliver unshipped order');
    }
    this.updateStatus(OrderStatus.DELIVERED);
  }

  /**
   * Cancel order - KISS: Simple, direct action
   */
  public cancel(reason: string): void {
    this.updateStatus(OrderStatus.CANCELLED);
    this.cancellationReason = reason.trim();
    this.isActive = false;
  }

  /**
   * Calculate subtotal from items
   * Single Responsibility: Only handles subtotal calculation
   */
  public calculateSubtotal(): number {
    return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  /**
   * Calculate tax amount
   * Single Responsibility: Only handles tax calculation
   */
  public calculateTax(): number {
    return this.totalAmount * this.taxRate;
  }

  /**
   * Calculate total with tax
   * Single Responsibility: Only handles total calculation
   */
  public calculateTotalWithTax(): number {
    return this.totalAmount + this.calculateTax();
  }

  /**
   * Validate order data integrity
   * Single Responsibility: Only handles validation logic
   */
  public validate(): OrderValidationResult {
    const errors: string[] = [];

    if (!this.description || this.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!this.customerId || this.customerId.trim().length === 0) {
      errors.push('Customer ID is required');
    }

    if (this.totalAmount <= 0) {
      errors.push('Total amount must be positive');
    }

    if (this.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    // Validate each item
    this.items.forEach((item, index) => {
      if (!item.productId || item.productId.trim().length === 0) {
        errors.push(`Item ${index + 1}: Product ID is required`);
      }
      if (!item.description || item.description.trim().length === 0) {
        errors.push(`Item ${index + 1}: Description is required`);
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be positive`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Unit price must be non-negative`);
      }
      if (item.totalPrice < 0) {
        errors.push(`Item ${index + 1}: Total price must be non-negative`);
      }
      if (Math.abs(item.totalPrice - (item.quantity * item.unitPrice)) > 0.01) {
        errors.push(`Item ${index + 1}: Total price does not match quantity * unit price`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize order to JSON
   * KISS: Simple, straightforward serialization
   */
  public toJSON(): any {
    const result: any = {
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      description: this.description,
      totalAmount: this.totalAmount,
      currency: this.currency,
      status: this.status,
      isActive: this.isActive,
      items: this.items,
      taxRate: this.taxRate,
      subtotal: this.calculateSubtotal(),
      taxAmount: this.calculateTax(),
      totalWithTax: this.calculateTotalWithTax(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    // Only include optional properties if they have values
    if (this.id) result.id = this.id;
    if (this.shippingAddress) result.shippingAddress = this.shippingAddress;
    if (this.billingAddress) result.billingAddress = this.billingAddress;
    if (this.notes) result.notes = this.notes;
    if (this.expectedDeliveryDate) result.expectedDeliveryDate = this.expectedDeliveryDate;
    if (this.confirmedAt) result.confirmedAt = this.confirmedAt;
    if (this.shippedAt) result.shippedAt = this.shippedAt;
    if (this.deliveredAt) result.deliveredAt = this.deliveredAt;
    if (this.cancelledAt) result.cancelledAt = this.cancelledAt;
    if (this.cancellationReason) result.cancellationReason = this.cancellationReason;

    return result;
  }

  // Private helper methods - KISS: Simple, focused helpers

  private validateOrderNumber(orderNumber: string): void {
    const trimmedOrderNumber = orderNumber.trim();
      const orderNumberPattern = /^ORD-\d{4}-\d{3}$/;

      if (!trimmedOrderNumber || !orderNumberPattern.test(trimmedOrderNumber)) {
        throw new Error('Invalid order number format');
      }
    }

    private validateItems(items: OrderItem[]): void {
      if (!items || items.length === 0) {
        throw new Error('Order must have at least one item');
      }
    }

    private validateCurrency(currency: string): void {
      const trimmedCurrency = currency.trim();
      const currencyPattern = /^[A-Z]{3}$/;

      if (!trimmedCurrency || !currencyPattern.test(trimmedCurrency)) {
        throw new Error('Invalid currency format');
      }
    }

    private validateTotalAmount(totalAmount: number): void {
      if (typeof totalAmount !== 'number' || totalAmount <= 0) {
        throw new Error('Total amount must be positive');
      }
    }

    private updateStatus(newStatus: OrderStatus): void {
      this.updatedAt = new Date();

      // Set appropriate timestamps based on status
      switch (newStatus) {
        case OrderStatus.CONFIRMED:
          this.confirmedAt = new Date();
          break;
        case OrderStatus.SHIPPED:
          this.shippedAt = new Date();
          break;
        case OrderStatus.DELIVERED:
          this.deliveredAt = new Date();
          break;
        case OrderStatus.CANCELLED:
          this.cancelledAt = new Date();
          break;
      }
    }
}