import { CustomerStatus } from '../enums/sales.enum';

/**
 * Customer Entity - Following SOLID Principles
 *
 * Single Responsibility: Only handles customer data and business logic
 * Open/Closed: Open for extension through interfaces, closed for modification
 * Interface Segregation: Focused customer interface with essential methods
 * Dependency Inversion: Depends on abstractions, not concretions
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clean, focused implementation
 * No unnecessary complexity, focused on customer management
 */

export interface CustomerJSON {
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  creditLimit: number;
  status: CustomerStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  id?: string;
  state?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  notes?: string;
}

export interface CustomerValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CustomerData {
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  creditLimit: number;
  status?: CustomerStatus;
  state?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  notes?: string;
}

export class Customer {
  public readonly id?: string;
  public readonly code!: string;
  public name!: string;
  public email!: string;
  public readonly phone!: string;
  public readonly address!: string;
  public readonly city!: string;
  public readonly country!: string;
  public creditLimit!: number;
  public status!: CustomerStatus;
  public isActive!: boolean;
  public readonly state?: string;
  public readonly postalCode?: string;
  public readonly website?: string;
  public readonly taxId?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public updatedAt!: Date;

  constructor(data: CustomerData) {
    // Validate input data
    this.validateCustomerCode(data.code);
    this.validateEmail(data.email);
    this.validateCreditLimit(data.creditLimit);

    // Assign trimmed values
    this.code = data.code.trim();
    this.name = data.name.trim();
    this.email = data.email.trim().toLowerCase();
    this.phone = data.phone.trim();
    this.address = data.address.trim();
    this.city = data.city.trim();
    this.country = data.country.trim();
    this.creditLimit = data.creditLimit;
    this.status = data.status || CustomerStatus.ACTIVE;
    this.isActive = this.status === CustomerStatus.ACTIVE;
    this.state = data.state?.trim();
    this.postalCode = data.postalCode?.trim();
    this.website = data.website?.trim();
    this.taxId = data.taxId?.trim();
    this.notes = data.notes?.trim();

    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
  }

  /**
   * Activate customer - KISS: Simple, direct action
   */
  public activate(): void {
    this.status = CustomerStatus.ACTIVE;
    this.isActive = true;
    this.updateTimestamp();
  }

  /**
   * Deactivate customer - KISS: Simple, direct action
   */
  public deactivate(): void {
    this.status = CustomerStatus.INACTIVE;
    this.isActive = false;
    this.updateTimestamp();
  }

  /**
   * Suspend customer - KISS: Simple, direct action
   */
  public suspend(): void {
    this.status = CustomerStatus.SUSPENDED;
    this.isActive = false;
    this.updateTimestamp();
  }

  /**
   * Check if customer has sufficient credit limit
   * Single Responsibility: Only handles credit logic
   */
  public hasSufficientCredit(amount: number): boolean {
    if (amount < 0) {return false;}
    return amount <= this.creditLimit;
  }

  /**
   * Update credit limit with validation
   * Single Responsibility: Only handles credit limit management
   */
  public updateCreditLimit(newLimit: number): void {
    this.validateCreditLimit(newLimit);
    this.creditLimit = newLimit;
    this.updateTimestamp();
  }

  /**
   * Validate customer data integrity
   * Single Responsibility: Only handles validation logic
   */
  public validate(): CustomerValidationResult {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!this.validateEmailFormat(this.email)) {
      errors.push('Invalid email format');
    }

    if (!this.phone || this.phone.trim().length === 0) {
      errors.push('Phone is required');
    }

    if (this.creditLimit <= 0) {
      errors.push('Credit limit must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize customer to JSON
   * KISS: Simple, straightforward serialization
   */
  public toJSON(): CustomerJSON {
    const result: CustomerJSON = {
      code: this.code,
      name: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      country: this.country,
      creditLimit: this.creditLimit,
      status: this.status,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    // Only include optional properties if they have values
    if (this.id) {result.id = this.id;}
    if (this.state) {result.state = this.state;}
    if (this.postalCode) {result.postalCode = this.postalCode;}
    if (this.website) {result.website = this.website;}
    if (this.taxId) {result.taxId = this.taxId;}
    if (this.notes) {result.notes = this.notes;}

    return result;
  }

  // Private helper methods - KISS: Simple, focused helpers

  private validateCustomerCode(code: string): void {
    const trimmedCode = code.trim();

    if (!trimmedCode || trimmedCode.length < 3 || trimmedCode.length > 10) {
      throw new Error('Invalid customer code format');
    }

    // Allow uppercase letters, numbers, and hyphens for more flexibility
    const codePattern = /^[A-Z0-9-]{3,10}$/;

    if (!codePattern.test(trimmedCode)) {
      throw new Error('Invalid customer code format');
    }
  }

  private validateEmail(email: string): void {
    const trimmedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailPattern.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }
  }

  private validateEmailFormat(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  private validateCreditLimit(creditLimit: number): void {
    if (typeof creditLimit !== 'number' || creditLimit <= 0) {
      throw new Error('Credit limit must be positive');
    }
  }

  private updateTimestamp(): void {
    this.updatedAt = new Date();
  }
}