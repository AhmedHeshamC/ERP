import { InvoiceStatus } from '../enums/sales.enum';

/**
 * Invoice Entity - Following SOLID Principles
 *
 * Single Responsibility: Only handles invoice data and business logic
 * Open/Closed: Open for extension through interfaces, closed for modification
 * Interface Segregation: Focused invoice interface with essential methods
 * Dependency Inversion: Depends on abstractions, not concretions
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clean, focused implementation
 */
export interface InvoiceValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productId: string;
  tax: number;
  discount: number;
  notes?: string;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  description: string;
  dueDate: Date;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency: string;
  status?: InvoiceStatus;
  taxRate?: number;
  items: InvoiceItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  expectedDeliveryDate?: Date;
  confirmedAt?: Date;
  paidAt?: Date;
  deliveredAt?: Date;
  shippedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export class Invoice {
  public id?: string;
  public invoiceNumber!: string;
  public orderId?: string;
  public customerId!: string;
  public description!: string;
  public dueDate!: Date;
  public subtotal!: number;
  public taxAmount!: number;
  public totalAmount!: number;
  public currency!: string;
  public status!: InvoiceStatus;
  public isActive!: boolean;
  public items!: InvoiceItem[];
  public taxRate!: number;
  public shippingAddress?: Address;
  public billingAddress?: Address;
  public notes?: string;
  public expectedDeliveryDate?: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
  public confirmedAt?: Date;
  public paidAt?: Date;
  public deliveredAt?: Date;
  public shippedAt?: Date;
  public cancelledAt?: Date;
  public cancellationReason?: string;
  public paidAmount!: number;
  public remainingBalance!: number;
  public createdAtAging!: number;
  public overdueDays!: number;
  public taxAmountWithTax!: number;

  constructor(data: InvoiceData) {
    // Validate input data
    this.validateInvoiceNumber(data.invoiceNumber);
    this.validateCustomer(data.customerId);
    this.validateDueDate(data.dueDate);
    this.validateItems(data.items);
    this.validateCurrency(data.currency);
    this.validateDescription(data.description);

    // Calculate values before assignment
    const calculatedSubtotal = data.subtotal || this.calculateSubtotalFromItems(data.items);
    const calculatedTaxRate = data.taxRate || 0;
    const calculatedTaxAmount = data.taxAmount || (calculatedSubtotal * calculatedTaxRate);
    const calculatedTotalAmount = data.totalAmount || (calculatedSubtotal + calculatedTaxAmount);

    // Assign values
    this.invoiceNumber = data.invoiceNumber.trim();
    this.orderId = data.orderId;
    this.customerId = data.customerId.trim();
    this.description = data.description.trim();
    this.dueDate = data.dueDate;
    this.subtotal = calculatedSubtotal;
    this.taxAmount = calculatedTaxAmount;
    this.totalAmount = calculatedTotalAmount;
    this.currency = data.currency.trim().toUpperCase();
    this.status = data.status || InvoiceStatus.DRAFT;
    this.isActive = this.status !== InvoiceStatus.CANCELLED && this.status !== InvoiceStatus.VOID;
    this.items = data.items.map(item => ({
      ...item,
      description: item.description.trim(),
      tax: item.tax || 0,
      discount: item.discount || 0,
      notes: item.notes?.trim(),
    }));
    this.taxRate = calculatedTaxRate;
    this.shippingAddress = data.shippingAddress;
    this.billingAddress = data.billingAddress;
    this.notes = data.notes?.trim();
    this.expectedDeliveryDate = data.expectedDeliveryDate;

    // Timestamps
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
    this.confirmedAt = data.confirmedAt;
    this.paidAt = data.paidAt;
    this.deliveredAt = data.deliveredAt;
    this.shippedAt = data.shippedAt;
    this.cancelledAt = data.cancelledAt;
    this.cancellationReason = data.cancellationReason;
    this.paidAmount = 0;
    this.remainingBalance = this.totalAmount;
    this.createdAtAging = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 24)); // days
    this.overdueDays = this.calculateOverdueDays();
    this.taxAmountWithTax = this.calculateTaxWithTax();
  }

  // Validation methods
  private validateInvoiceNumber(invoiceNumber: string): void {
    if (!invoiceNumber || typeof invoiceNumber !== 'string' || invoiceNumber.trim().length === 0) {
      throw new Error('Invoice number is required and must be a non-empty string');
    }
    if (invoiceNumber.trim().length > 50) {
      throw new Error('Invoice number cannot exceed 50 characters');
    }
  }

  private validateCustomer(customerId: string): void {
    if (!customerId || typeof customerId !== 'string' || customerId.trim().length === 0) {
      throw new Error('Customer ID is required and must be a non-empty string');
    }
  }

  private validateDueDate(dueDate: Date): void {
    if (!dueDate || !(dueDate instanceof Date) || isNaN(dueDate.getTime())) {
      throw new Error('Due date is required and must be a valid Date');
    }
    if (dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }
  }

  private validateItems(items: InvoiceItem[]): void {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('At least one item is required and must be an array');
    }
    items.forEach((item, index) => {
      if (!item.description || typeof item.description !== 'string' || item.description.trim().length === 0) {
        throw new Error(`Item ${index + 1}: Description is required and must be a non-empty string`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Item ${index + 1}: Quantity must be a number greater than 0`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        throw new Error(`Item ${index + 1}: Unit price must be a non-negative number`);
      }
      if (!item.productId || typeof item.productId !== 'string' || item.productId.trim().length === 0) {
        throw new Error(`Item ${index + 1}: Product ID is required and must be a non-empty string`);
      }
    });
  }

  private validateCurrency(currency: string): void {
    if (!currency || typeof currency !== 'string' || currency.trim().length === 0) {
      throw new Error('Currency is required and must be a non-empty string');
    }
    if (currency.trim().length !== 3) {
      throw new Error('Currency must be a valid 3-letter currency code');
    }
  }

  private validateDescription(description: string): void {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new Error('Description is required and must be a non-empty string');
    }
    if (description.trim().length > 500) {
      throw new Error('Description cannot exceed 500 characters');
    }
  }

  // Business logic methods
  public confirm(): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be confirmed');
    }
    this.updateStatus(InvoiceStatus.CONFIRMED);
  }

  public pay(amount: number): void {
    if (this.status !== InvoiceStatus.CONFIRMED) {
      throw new Error('Only confirmed invoices can be paid');
    }
    this.paidAt = new Date();
    this.paidAmount += amount;
    this.remainingBalance -= amount;
    if (this.remainingBalance <= 0) {
      this.updateStatus(InvoiceStatus.PAID);
    }
  }

  public deliver(): void {
    if (this.status === InvoiceStatus.DELIVERED) {
      throw new Error('Invoice is already delivered');
    }
    if (this.status === InvoiceStatus.VOID) {
      throw new Error('Voided invoices cannot be delivered');
    }
    this.updateStatus(InvoiceStatus.DELIVERED);
  }

  public void(reason: string): void {
    if (this.status === InvoiceStatus.VOID) {
      throw new Error('Invoice is already voided');
    }
    this.cancellationReason = reason.trim();
    this.cancelledAt = new Date();
    this.isActive = false;
    this.paidAmount = 0;
    this.remainingBalance = this.totalAmount;
    this.updateStatus(InvoiceStatus.VOID);
  }

  public cancel(reason: string): void {
    if (this.status === InvoiceStatus.CANCELLED) {
      throw new Error('Invoice is already cancelled');
    }
    this.cancellationReason = reason.trim();
    this.cancelledAt = new Date();
    this.isActive = false;
    this.paidAmount = 0;
    this.remainingBalance = this.totalAmount;
    this.updateStatus(InvoiceStatus.CANCELLED);
  }

  private updateStatus(newStatus: InvoiceStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();

    switch (newStatus) {
      case InvoiceStatus.CONFIRMED:
        this.confirmedAt = new Date();
        this.isActive = false; // Invoices are inactive once confirmed
        break;
      case InvoiceStatus.SHIPPED:
        this.shippedAt = new Date();
        this.isActive = true; // Shipped orders are still active
        break;
      case InvoiceStatus.DELIVERED:
        this.deliveredAt = new Date();
        this.paidAt = new Date();
        this.paidAmount = this.totalAmount;
        this.remainingBalance = 0;
        this.isActive = false; // Invoices become inactive once fully paid
        break;
      case InvoiceStatus.VOID:
        this.cancelledAt = new Date();
        this.isActive = false;
        this.remainingBalance = 0;
        break;
      case InvoiceStatus.CANCELLED:
        this.cancelledAt = new Date();
        this.isActive = false;
        this.remainingBalance = 0;
        break;
    }
  }

  // Calculation methods
  private calculateSubtotalFromItems(items: InvoiceItem[]): number {
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  }

  private calculateTaxWithTax(): number {
    return this.subtotal * (this.taxRate || 0);
  }

  public calculateTotalWithTax(): number {
    return this.subtotal + this.taxAmount;
  }

  public calculateOverdueDays(): number {
    if (this.status === InvoiceStatus.PAID || this.status === InvoiceStatus.CANCELLED || this.status === InvoiceStatus.VOID) {
      return 0;
    }
    const today = new Date();
    const dueDate = new Date(this.dueDate);
    return Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 24)));
  }

  public calculateAging(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 24));
  }

  public getTotalAmount(): number {
    return this.totalAmount;
  }

  public getPaidAmount(): number {
    return this.paidAmount;
  }

  public getRemainingBalance(): number {
    return this.remainingBalance;
  }

  public isOverdue(): boolean {
    return this.calculateOverdueDays() > 0;
  }

  /**
   * KISS: Simple, straightforward serialization
   */
  public toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      invoiceNumber: this.invoiceNumber,
      customerId: this.customerId,
      description: this.description,
      dueDate: this.dueDate.toISOString().split('T')[0],
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      totalAmount: this.totalAmount,
      totalWithTax: this.calculateTotalWithTax(),
      currency: this.currency,
      status: this.status,
      isActive: this.isActive,
      items: this.items.map(item => ({
        ...item,
        tax: item.tax || 0,
        discount: item.discount || 0,
        notes: item.notes?.trim(),
      })),
      shippingAddress: this.shippingAddress,
      billingAddress: this.billingAddress,
      notes: this.notes,
      expectedDeliveryDate: this.expectedDeliveryDate?.toISOString().split('T')[0],
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };

    // Only include optional properties if they have values
    if (this.id) {result.id = this.id;}
    if (this.orderId) {result.orderId = this.orderId;}
    if (this.confirmedAt) {result.confirmedAt = this.confirmedAt.toISOString();}
    if (this.paidAt) {result.paidAt = this.paidAt.toISOString();}
    if (this.deliveredAt) {result.deliveredAt = this.deliveredAt.toISOString();}
    if (this.shippedAt) {result.shippedAt = this.shippedAt.toISOString();}
    if (this.cancelledAt) {result.cancelledAt = this.cancelledAt.toISOString();}
    if (this.cancellationReason) {result.cancellationReason = this.cancellationReason;}

    return result;
  }
}