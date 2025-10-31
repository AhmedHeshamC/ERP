import { InvoiceStatus, PaymentStatus, PaymentMethod } from '../enums/sales.enum';

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
}

export class Invoice {
  public readonly id?: string;
  public readonly invoiceNumber: string;
  public readonly orderId?: string;
  public readonly customerId: string;
  public description: string;
  public readonly dueDate: Date;
  public readonly subtotal: number;
  public readonly taxAmount: number;
  public totalAmount: number;
  public readonly currency: string;
  public status: InvoiceStatus;
  public readonly isActive: boolean;
  public readonly items: InvoiceItem[];
  public readonly taxRate: number;
  public readonly shippingAddress?: Address;
  public readonly billingAddress?: Address;
  public readonly notes?: string;
  public readonly expectedDeliveryDate?: Date;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly confirmedAt?: Date;
  public readonly paidAt?: Date;
  public readonly deliveredAt?: Date;
  public readonly cancelledAt?: Date;
  public readonly cancellationReason?: string;
  public readonly paidAmount: number;
  public readonly remainingBalance: number;
  public readonly createdAtAging: number;
  public overdueDays: number;
  public taxAmountWithTax: number;

  constructor(data: InvoiceData) {
    // Validate input data
    this.validateInvoiceNumber(data.invoiceNumber);
    this.validateCustomer(data.customerId);
    this.validateDueDate(data.dueDate);
    this.validateItems(data.items);

    // Assign values
    this.invoiceNumber = data.invoiceNumber.trim();
    this.orderId = data.orderId;
    this.customerId = data.customerId.trim();
    this.description = data.description.trim();
    this.dueDate = data.dueDate;
    this.subtotal = data.subtotal || this.calculateSubtotal();
    this.totalAmount = data.totalAmount || this.subtotal + (this.subtotal * (this.taxRate || 0));
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
    this.taxRate = data.taxRate || 0;
    this.shippingAddress = data.shippingAddress;
    this.billingAddress = data.billingAddress;
    this.notes = data.notes?.trim();
    this.expectedDeliveryDate = data.expectedDeliveryDate;

    // Timestamps
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
    this.isActive = true;
    this.confirmedAt = data.confirmedAt || null;
    this.paidAt = data.paidAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.cancelledAt = data.cancelledAt || null;
    this.cancellationReason = data.cancellationReason;
    this.paidAmount = 0;
    this.remainingBalance = this.totalAmount;
    this.createdAtAging = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 24)); // days
    this.overdueDays = this.calculateOverdueDays();
    this.taxAmountWithTax = this.totalAmount * (this.taxRate || 0);
    this.overdueDays = this.calculateOverdueDays();
  }

  /**
   * Confirm invoice - KISS: Simple, direct action
   */
  public confirm(): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error('Cannot confirm invoice not in DRAFT status');
    }
    this.updateStatus(InvoiceStatus.CONFIRMED);
  }

  /**
   * Pay invoice - KISS: Simple, direct action
   */
  public pay(): void {
    if (this.status !== InvoiceStatus.CONFIRMED) {
      throw new Error('Cannot pay invoice not in CONFIRMED status');
    }
    this.updateStatus(InvoiceStatus.PAID);
    this.paidAt = new Date();
    this.remainingBalance -= this.paidAmount;
    this.updateStatus(InvoiceStatus.PAID);
  }

  /**
   * Void invoice - KISS: Simple, direct action
   */
  public void(reason: string): void {
    if (this.status === InvoiceStatus.PAID) {
      throw new Error('Invoice already paid');
    }
    if (this.status === InvoiceStatus.DELIVERED) {
      throw new Error('Invoice already delivered');
    }
    if (this.status === InvoiceStatus.VOID) {
      this.updateStatus(InvoiceStatus.VOID);
    }
    this.updateStatus(InvoiceStatus.CANCELLED);
    this.cancellationReason = reason.trim();
    this.cancelledAt = new Date();
    this.isActive = false;
    this.paidAmount = 0;
    this.remainingBalance = this.totalAmount;
  }

  /**
   * Update status with timestamp
   */
  private updateStatus(newStatus: InvoiceStatus): void {
    this.updatedAt = new Date();

    // Set appropriate timestamps
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
        this.deliveredAt = new Date();
        break;
      case InvoiceStatus.PAID:
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

  /**
   * Calculate subtotal from items
   * KISS: Simple, straightforward calculation
   */
  public calculateSubtotal(): number {
    return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  /**
   * Calculate tax amount from total amount
   * KISS: Simple, straightforward calculation
   */
  public calculateTax(): number {
    return this.totalAmount * (this.taxRate || 0);
  }

  /**
   * Calculate total amount including tax
   * KISS: Simple, straightforward calculation
   */
  public calculateTotalWithTax(): number {
    return this.totalAmount + this.calculateTax();
  }

  /**
   * Calculate discount amount - KISS: Simple, straightforward discount calculation
   */
  public calculateDiscountAmount(discountRate: number): number {
    if (discountRate < 0 || discountRate > 1) {
      throw new Error('Discount amount must be between 0 and 1');
    }
    return Math.round(this.totalAmount * discountRate * 100) / 100;
  }

  /**
   * Calculate remaining balance
   * KISS: Simple, straightforward calculation
   */
  public calculateRemainingBalance(totalAmount: number, paidAmount: number): number {
    return Math.max(0, totalAmount - paidAmount);
  }

  /**
   * Calculate overdue days
   * KISS: Simple, straightforward calculation
   */
  public calculateOverdueDays(): number {
    const today = new Date();
    const dueDate = this.dueDate;
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 24)); // Convert milliseconds to days
  }

  /**
   * Calculate aging
   * KISS: Simple, straightforward calculation
   */
  public calculateAging(): number {
    const today = new Date();
    const createdAt = this.createdAt;
    return Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 24)); // Convert milliseconds to days
  }

  /**
   * Check if invoice is overdue
   * KISS: Simple, straightforward validation
   */
  public isOverdue(): boolean {
    return this.calculateOverdueDays() > 0;
  }

  /**
   * Serialize invoice to JSON
   * KISS: Simple, straightforward serialization
   */
  public toJSON(): any {
    const result: any = {
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
    if (this.id) result.id = this.id;
    if (this.orderId) result.orderId = this.orderId;
    if (this.confirmedAt) result.confirmedAt = this.confirmedAt.toISOString();
    if (this.paidAt) result.paidAt = this.paidAt.toISOString();
    if (this.deliveredAt) result.deliveredAt = this.deliveredAt.toISOString();
    if (this.cancelledAt) result.cancelledAt = this.cancelledAt.toISOString();
    if (this.cancellationReason) result.cancellationReason = this.cancellationReason;

    return result;
  }

  /**
   * Helper function to calculate overdue days
   * KISS: Simple, focused helper
   */
  private calculateOverdueDays(): number {
    const today = new Date();
    const dueDate = this.dueDate;
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 24)); // Convert milliseconds to days
  }

  /**
   * Helper function to calculate aging
   * KISS: Simple, focused helper
   */
  private calculateAging(): number {
    const today = new Date();
    const createdAt = this.createdAt;
    return Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 24)); // Convert milliseconds to days
  }

  /**
   * Helper function to calculate overdue days
   * KISS: Simple, focused helper
   */
  private calculateOverdueDays(): number {
    const today = new Date();
    const dueDate = this.dueDate;
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 24)); // Convert milliseconds to days
    return Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 24)); // Ensure non-negative
  }
}