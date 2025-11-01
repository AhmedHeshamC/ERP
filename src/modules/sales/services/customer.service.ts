import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Customer } from '../entities/customer.entity';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { CustomerStatus } from '../enums/sales.enum';
import { SecurityService } from '../../../shared/security/security.service';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new customer with validation and sanitization
   */
  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    this.logger.log(`Creating customer with code: ${createCustomerDto.code}`);

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(createCustomerDto);

    // Check if customer code already exists
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { code: sanitizedData.code },
    });

    if (existingCustomer) {
      throw new ConflictException(`Customer with code ${sanitizedData.code} already exists`);
    }

    // Check if email already exists
    const existingEmail = await this.prisma.customer.findUnique({
      where: { email: sanitizedData.email },
    });

    if (existingEmail) {
      throw new ConflictException(`Customer with email ${sanitizedData.email} already exists`);
    }

    try {
      // Create customer entity for validation
      const customerEntity = new Customer({
        code: sanitizedData.code,
        name: sanitizedData.name,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        address: sanitizedData.address,
        city: sanitizedData.city,
        country: sanitizedData.country,
        creditLimit: sanitizedData.creditLimit,
        status: sanitizedData.isActive ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
        state: sanitizedData.state,
        postalCode: sanitizedData.postalCode,
        taxId: sanitizedData.taxId,
      });

      // Validate customer data
      const validation = customerEntity.validate();
      if (!validation.isValid) {
        throw new BadRequestException(validation.errors);
      }

      // Create customer in database - only include fields that exist in schema
      const customer = await this.prisma.customer.create({
        data: {
          code: sanitizedData.code,
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone,
          address: sanitizedData.address,
          city: sanitizedData.city,
          state: sanitizedData.state,
          postalCode: sanitizedData.postalCode,
          country: sanitizedData.country,
          taxId: sanitizedData.taxId,
          creditLimit: sanitizedData.creditLimit,
          isActive: sanitizedData.isActive ?? true,
        },
      });

      this.logger.log(`Customer created successfully with ID: ${customer.id}`);
      return this.mapToCustomerEntity(customer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating customer: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get all customers with pagination and filtering
   */
  async findAll(query: CustomerQueryDto): Promise<{ data: Customer[]; total: number; pagination: any }> {
    this.logger.log(`Finding customers with query: ${JSON.stringify(query)}`);

    const { page = 1, limit = 10, search, isActive, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    this.logger.log(`Found ${customers.length} customers out of ${total} total`);
    return {
      data: customers.map(customer => this.mapToCustomerEntity(customer)),
      total,
      pagination
    };
  }

  /**
   * Get customer by ID
   */
  async findOne(id: string): Promise<Customer> {
    this.logger.log(`Finding customer with ID: ${id}`);

    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return this.mapToCustomerEntity(customer);
  }

  /**
   * Update customer
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    this.logger.log(`Updating customer with ID: ${id}`);

    const existingCustomer = await this.findOne(id);

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(updateCustomerDto);

    // Check if email is being changed and if it conflicts with another customer
    if (sanitizedData.email && sanitizedData.email !== existingCustomer.email) {
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email: sanitizedData.email },
      });

      if (existingEmail) {
        throw new ConflictException(`Customer with email ${sanitizedData.email} already exists`);
      }
    }

    // Check if code is being changed and if it conflicts with another customer
    if (sanitizedData.code && sanitizedData.code !== existingCustomer.code) {
      const existingCode = await this.prisma.customer.findUnique({
        where: { code: sanitizedData.code },
      });

      if (existingCode) {
        throw new ConflictException(`Customer with code ${sanitizedData.code} already exists`);
      }
    }

    try {
      // Only include fields that exist in the database schema
      const updateData: any = {};
      if (sanitizedData.name) updateData.name = sanitizedData.name;
      if (sanitizedData.email) updateData.email = sanitizedData.email;
      if (sanitizedData.phone) updateData.phone = sanitizedData.phone;
      if (sanitizedData.address) updateData.address = sanitizedData.address;
      if (sanitizedData.city) updateData.city = sanitizedData.city;
      if (sanitizedData.state !== undefined) updateData.state = sanitizedData.state;
      if (sanitizedData.postalCode !== undefined) updateData.postalCode = sanitizedData.postalCode;
      if (sanitizedData.country) updateData.country = sanitizedData.country;
      if (sanitizedData.taxId !== undefined) updateData.taxId = sanitizedData.taxId;
      if (sanitizedData.creditLimit !== undefined) updateData.creditLimit = sanitizedData.creditLimit;
      if (sanitizedData.isActive !== undefined) updateData.isActive = sanitizedData.isActive;

      updateData.updatedAt = new Date();

      const updatedCustomer = await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Customer updated successfully with ID: ${id}`);
      return this.mapToCustomerEntity(updatedCustomer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error updating customer: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Update customer status (active/inactive)
   */
  async updateStatus(id: string, isActive: boolean): Promise<Customer> {
    this.logger.log(`Updating customer status for ID: ${id} to ${isActive}`);

    // Verify customer exists
    await this.findOne(id);

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Customer status updated successfully for ID: ${id}`);
    return this.mapToCustomerEntity(updatedCustomer);
  }

  /**
   * Delete customer (soft delete by setting isActive to false)
   */
  async remove(id: string): Promise<Customer> {
    this.logger.log(`Deactivating customer with ID: ${id}`);

    // Verify customer exists
    await this.findOne(id);

    // Check if customer has active orders (fix schema - no isActive field in Order)
    const activeOrders = await this.prisma.order.count({
      where: {
        customerId: id,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException('Cannot deactivate customer with active orders');
    }

    const deactivatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Customer deactivated successfully with ID: ${id}`);
    return this.mapToCustomerEntity(deactivatedCustomer);
  }

  /**
   * Check if customer has sufficient credit limit
   */
  async checkCreditLimit(id: string, amount: number): Promise<boolean> {
    this.logger.log(`Checking credit limit for customer ID: ${id}, amount: ${amount}`);

    const customer = await this.findOne(id);
    return parseFloat(customer.creditLimit.toString()) >= amount;
  }

  /**
   * Update customer credit limit
   */
  async updateCreditLimit(id: string, newLimit: number): Promise<Customer> {
    this.logger.log(`Updating credit limit for customer ID: ${id} to ${newLimit}`);

    if (newLimit < 0) {
      throw new BadRequestException('Credit limit must be non-negative');
    }

    // Verify customer exists
    await this.findOne(id);

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: {
        creditLimit: newLimit,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Credit limit updated successfully for customer ID: ${id}`);
    return this.mapToCustomerEntity(updatedCustomer);
  }

  /**
   * Map Prisma Customer model to Customer entity
   * This ensures proper type safety and entity behavior
   */
  private mapToCustomerEntity(prismaCustomer: any): Customer {
    return new Customer({
      code: prismaCustomer.code,
      name: prismaCustomer.name,
      email: prismaCustomer.email,
      phone: prismaCustomer.phone || '',
      address: prismaCustomer.address || '',
      city: prismaCustomer.city || '',
      country: prismaCustomer.country || '',
      creditLimit: Number(prismaCustomer.creditLimit),
      status: prismaCustomer.isActive ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
      state: prismaCustomer.state,
      postalCode: prismaCustomer.postalCode,
      taxId: prismaCustomer.taxId,
    });
  }
}