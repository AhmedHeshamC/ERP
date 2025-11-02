import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import { Invoice as PrismaInvoice } from '@prisma/client';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { UpdateInvoiceStatusDto } from '../dto/update-invoice-status.dto';
import { InvoiceQueryDto } from '../dto/invoice-query.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { InvoiceStatus } from '../enums/sales.enum';
import { SecurityService } from '../../../shared/security/security.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new invoice
   */
  async create(createInvoiceDto: CreateInvoiceDto, userId?: string): Promise<PrismaInvoice> {
    this.logger.log(`Creating invoice for order: ${createInvoiceDto.orderId}`);

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(createInvoiceDto);

    // Validate order exists and can be invoiced
    const order = await this.prisma.order.findUnique({
      where: { id: sanitizedData.orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${sanitizedData.orderId} not found`);
    }

    // Validate customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: sanitizedData.customerId, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException(`Active customer with ID ${sanitizedData.customerId} not found`);
    }

    // Verify order belongs to the specified customer
    if (order.customerId !== sanitizedData.customerId) {
      throw new BadRequestException('Order does not belong to specified customer');
    }

    // Check if invoice already exists for this order
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { orderId: sanitizedData.orderId },
    });

    if (existingInvoice) {
      throw new ConflictException(`Invoice already exists for order ${sanitizedData.orderId}`);
    }

    // Generate invoice totals if not provided
    const subtotal = sanitizedData.subtotal || Number(order.subtotal) || 0;
    const taxAmount = sanitizedData.taxAmount || await this.calculateTax(sanitizedData.customerId, subtotal);
    const totalAmount = sanitizedData.totalAmount || subtotal + taxAmount;

    // Validate invoice totals
    if (totalAmount <= 0) {
      throw new BadRequestException('Invoice total must be positive');
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          orderId: sanitizedData.orderId,
          customerId: sanitizedData.customerId,
          issueDate: sanitizedData.issueDate ? new Date(sanitizedData.issueDate) : new Date(),
          dueDate: sanitizedData.dueDate ? new Date(sanitizedData.dueDate) : undefined,
          subtotal,
          taxAmount,
          totalAmount,
          balanceDue: totalAmount,
          currency: sanitizedData.currency || 'USD',
          notes: sanitizedData.notes,
          createdBy: userId,
        },
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: { product: true },
              },
            },
          },
        },
      });

      // Log audit event for successful invoice creation
      await this.auditService.logCreate(
        'INVOICE',
        invoice.id,
        {
          invoiceNumber,
          orderId: sanitizedData.orderId,
          customerId: sanitizedData.customerId,
          totalAmount,
          status: InvoiceStatus.DRAFT,
          itemCount: order.orderItems.length,
        },
        userId,
        {
          action: 'CREATE_INVOICE',
          orderValidated: true,
          customerValidated: true,
        },
      );

      this.logger.log(`Invoice created successfully with ID: ${invoice.id}`);
      return invoice;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log audit event for failed invoice creation
      if (userId) {
        await this.auditService.logBusinessEvent(
          'INVOICE_CREATE_FAILED',
          'INVOICE',
          'unknown',
          'CREATE',
          userId,
          {
            error: errorMessage,
            invoiceData: this.securityService.sanitizeInput(sanitizedData),
            orderId: sanitizedData.orderId,
          },
          'HIGH',
        );
      }

      this.logger.error(`Error creating invoice: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Create invoice from order (for compatibility with existing controller)
   */
  async createFromOrder(orderId: string, createInvoiceDto: CreateInvoiceDto): Promise<PrismaInvoice> {
    // For now, just call the create method with orderId from the path
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Map order to invoice creation data
    const invoiceData = {
      ...createInvoiceDto,
      orderId,
      customerId: order.customerId,
    };

    return this.create(invoiceData);
  }

  /**
   * Create payment for invoice (for compatibility with existing controller)
   */
  async createPayment(invoiceId: string, createPaymentDto: CreatePaymentDto): Promise<any> {
    return this.addPayment(invoiceId, createPaymentDto);
  }

  /**
   * Get all invoices with pagination and filtering
   */
  async findAll(query: InvoiceQueryDto): Promise<{ data: PrismaInvoice[]; total: number; pagination: any }> {
    this.logger.log(`Finding invoices with query: ${JSON.stringify(query)}`);

    const { page = 1, limit = 10, customerId, orderId, status, sortBy = 'issueDate', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (status) {
      where.status = status;
    }

    if (query.invoiceNumber) {
      where.invoiceNumber = {
        contains: query.invoiceNumber,
        mode: 'insensitive',
      };
    }

    // Date range filters
    if (query.issueDateFrom || query.issueDateTo) {
      where.issueDate = {};
      if (query.issueDateFrom) {
        where.issueDate.gte = new Date(query.issueDateFrom);
      }
      if (query.issueDateTo) {
        where.issueDate.lte = new Date(query.issueDateTo);
      }
    }

    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) {
        where.dueDate.gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        where.dueDate.lte = new Date(query.dueDateTo);
      }
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: { product: true },
              },
            },
          },
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    this.logger.log(`Found ${invoices.length} invoices out of ${total} total`);
    return { data: invoices, total, pagination };
  }

  /**
   * Get invoice by ID
   */
  async findOne(id: string): Promise<PrismaInvoice> {
    this.logger.log(`Finding invoice with ID: ${id}`);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        order: {
          include: {
            orderItems: {
              include: { product: true },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  /**
   * Update invoice
   */
  async update(id: string, updateInvoiceDto: UpdateInvoiceDto, userId?: string): Promise<PrismaInvoice> {
    this.logger.log(`Updating invoice with ID: ${id}`);

    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be updated');
    }

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(updateInvoiceDto);

    try {
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: {
          ...sanitizedData,
          updatedAt: new Date(),
          updatedBy: userId,
        },
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: { product: true },
              },
            },
          },
          payments: true,
        },
      });

      // Log audit event for successful invoice update
      await this.auditService.logUpdate(
        'INVOICE',
        id,
        this.sanitizeInvoiceData(invoice),
        this.sanitizeInvoiceData(updatedInvoice),
        userId,
        {
          action: 'UPDATE_INVOICE',
          invoiceNumber: invoice.invoiceNumber,
        },
      );

      this.logger.log(`Invoice updated successfully with ID: ${id}`);
      return updatedInvoice;
    } catch (error) {
      this.logger.error(`Error updating invoice: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateStatus(id: string, updateStatusDto: UpdateInvoiceStatusDto, userId?: string): Promise<PrismaInvoice> {
    this.logger.log(`Updating invoice status for ID: ${id} to ${updateStatusDto.status}`);

    const invoice = await this.findOne(id);

    // Validate status transitions
    this.validateStatusTransition(invoice.status, updateStatusDto.status);

    const updateData: any = {
      status: updateStatusDto.status,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    // Add status-specific fields
    switch (updateStatusDto.status) {
      case InvoiceStatus.SENT:
        updateData.sentAt = new Date();
        break;
      case InvoiceStatus.PAID:
        updateData.paidAt = new Date();
        break;
      case InvoiceStatus.OVERDUE:
        updateData.overdueAt = new Date();
        break;
      case InvoiceStatus.CANCELLED:
        updateData.cancelledAt = new Date();
        if (updateStatusDto.cancellationReason) {
          updateData.notes = updateStatusDto.cancellationReason;
        }
        break;
      case InvoiceStatus.VOID:
        updateData.voidedAt = new Date();
        updateData.balanceDue = 0;
        break;
    }

    if (updateStatusDto.notes) {
      updateData.notes = updateStatusDto.notes;
    }

    try {
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: { product: true },
              },
            },
          },
          payments: true,
        },
      });

      // Log audit event for invoice status change
      await this.auditService.logBusinessEvent(
        'INVOICE_STATUS_CHANGED',
        'INVOICE',
        id,
        'UPDATE_STATUS',
        userId,
        {
          action: 'UPDATE_INVOICE_STATUS',
          oldStatus: invoice.status,
          newStatus: updateStatusDto.status,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId,
          notes: updateStatusDto.notes,
          cancellationReason: updateStatusDto.cancellationReason,
        },
        (this.getSeverityForStatusChange(updateStatusDto.status) as any),
      );

      // Log special events for critical status changes
      if (updateStatusDto.status === InvoiceStatus.OVERDUE) {
        await this.auditService.logBusinessEvent(
          'INVOICE_OVERDUE',
          'INVOICE',
          id,
          'UPDATE_STATUS',
          userId,
          {
            action: 'INVOICE_OVERDUE',
            invoiceNumber: invoice.invoiceNumber,
            balanceDue: Number(invoice.balanceDue),
            daysOverdue: this.calculateDaysOverdue(invoice.dueDate),
          },
          'HIGH',
        );
      }

      this.logger.log(`Invoice status updated successfully for ID: ${id}`);
      return updatedInvoice;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log audit event for failed status update
      if (userId) {
        await this.auditService.logBusinessEvent(
          'INVOICE_STATUS_UPDATE_FAILED',
          'INVOICE',
          id,
          'UPDATE_STATUS',
          userId,
          {
            error: errorMessage,
            oldStatus: invoice.status,
            newStatus: updateStatusDto.status,
            invoiceNumber: invoice.invoiceNumber,
          },
          'HIGH',
        );
      }

      this.logger.error(`Error updating invoice status: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Add payment to invoice
   */
  async addPayment(invoiceId: string, createPaymentDto: CreatePaymentDto, userId?: string): Promise<any> {
    this.logger.log(`Adding payment to invoice ID: ${invoiceId}`);

    const invoice = await this.findOne(invoiceId);

    // Validate invoice status allows payments
    if (![InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoice.status as InvoiceStatus)) {
      throw new BadRequestException(`Cannot add payment to invoice in ${invoice.status} status`);
    }

    // Validate payment amount
    if (createPaymentDto.amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    // Check for overpayment
    const remainingBalance = Number(invoice.balanceDue);
    if (createPaymentDto.amount > remainingBalance) {
      throw new BadRequestException(`Payment amount ($${createPaymentDto.amount}) exceeds remaining balance ($${remainingBalance})`);
    }

    try {
      // Create payment
      const payment = await this.prisma.payment.create({
        data: {
          invoiceId,
          amount: createPaymentDto.amount,
          paymentMethod: createPaymentDto.paymentMethod,
          paymentDate: createPaymentDto.paymentDate ? new Date(createPaymentDto.paymentDate) : new Date(),
          reference: createPaymentDto.reference,
          notes: createPaymentDto.notes,
          status: 'COMPLETED',
          createdBy: userId,
        },
      });

      // Update invoice totals
      const newPaidAmount = Number(invoice.paidAmount) + createPaymentDto.amount;
      const newBalanceDue = remainingBalance - createPaymentDto.amount;

      let newStatus = invoice.status;
      if (newBalanceDue === 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
          updatedAt: new Date(),
          updatedBy: userId,
          ...(newStatus === InvoiceStatus.PAID ? { paidAt: new Date() } : {}),
        },
      });

      // Log audit event for payment received
      await this.auditService.logBusinessEvent(
        'PAYMENT_RECEIVED',
        'INVOICE',
        invoiceId,
        'ADD_PAYMENT',
        userId,
        {
          action: 'ADD_PAYMENT',
          paymentId: payment.id,
          paymentAmount: createPaymentDto.amount,
          paymentMethod: createPaymentDto.paymentMethod,
          remainingBalance: newBalanceDue,
          totalPaid: newPaidAmount,
        },
        'HIGH',
      );

      // Log special event for fully paid invoice
      if (newStatus === InvoiceStatus.PAID) {
        await this.auditService.logBusinessEvent(
          'INVOICE_FULLY_PAID',
          'INVOICE',
          invoiceId,
          'ADD_PAYMENT',
          userId,
          {
            action: 'FULL_PAYMENT',
            invoiceNumber: invoice.invoiceNumber,
            totalPaid: newPaidAmount,
            paymentMethod: createPaymentDto.paymentMethod,
            paymentCount: (await this.prisma.payment.count({ where: { invoiceId } })),
          },
          'HIGH',
        );
      }

      this.logger.log(`Payment added successfully to invoice ID: ${invoiceId}`);
      return payment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log audit event for failed payment
      if (userId) {
        await this.auditService.logBusinessEvent(
          'PAYMENT_FAILED',
          'INVOICE',
          invoiceId,
          'ADD_PAYMENT',
          userId,
          {
            error: errorMessage,
            paymentData: this.securityService.sanitizeInput(createPaymentDto),
            invoiceNumber: invoice.invoiceNumber,
          },
          'HIGH',
        );
      }

      this.logger.error(`Error adding payment to invoice: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Calculate tax for customer
   */
  async calculateTax(customerId: string, subtotal: number): Promise<number> {
    this.logger.log(`Calculating tax for customer: ${customerId}, subtotal: ${subtotal}`);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Check if customer is tax exempt (simplified - would need to be added to schema)
    // if (customer.taxExempt) {
    //   return 0;
    // }

    // Calculate tax based on customer location
    // This is a simplified tax calculation - in production, you'd use a proper tax service
    const country = customer.country || 'US';
    const state = customer.state;

    let taxRate = 0;

    if (country === 'US') {
      // US state tax rates (simplified)
      const stateTaxRates: Record<string, number> = {
        'CA': 0.0875, // California
        'NY': 0.08,   // New York
        'TX': 0.0625, // Texas
        'FL': 0.06,   // Florida
        'WA': 0.095,  // Washington
      };
      taxRate = stateTaxRates[state || ''] || 0.07; // Default 7%
    } else if (country === 'GB') {
      taxRate = 0.20; // UK VAT
    } else if (country === 'CA') {
      taxRate = 0.05; // Canada GST
    } else if (['DE', 'FR', 'IT', 'ES'].includes(country)) {
      taxRate = 0.20; // EU VAT standard rate
    } else {
      taxRate = 0.00; // Default no tax for international
    }

    const taxAmount = subtotal * taxRate;
    this.logger.log(`Tax calculated: ${taxAmount} at rate ${(taxRate * 100).toFixed(2)}%`);
    return taxAmount;
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}`;

    // Find the last invoice number for this year
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Validate invoice status transitions
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED, InvoiceStatus.VOID],
      [InvoiceStatus.SENT]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED, InvoiceStatus.VOID],
      [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED, InvoiceStatus.VOID],
      [InvoiceStatus.PAID]: [InvoiceStatus.VOID], // Can only void paid invoices
      [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.VOID],
      [InvoiceStatus.CANCELLED]: [InvoiceStatus.VOID],
      [InvoiceStatus.VOID]: [], // Final state
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(dueDate: Date | null): number {
    if (!dueDate) return 0;
    const now = new Date();
    const diffTime = now.getTime() - dueDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get severity level for status change
   */
  private getSeverityForStatusChange(status: string): string {
    const highSeverityStatuses = [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.OVERDUE];
    return highSeverityStatuses.includes(status as InvoiceStatus) ? 'HIGH' : 'MEDIUM';
  }

  /**
   * Sanitize invoice data for audit logging
   */
  private sanitizeInvoiceData(invoice: any): any {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      balanceDue: Number(invoice.balanceDue),
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    };
  }
}