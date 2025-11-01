import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentStatus, InvoiceStatus } from '../enums/sales.enum';
import { SecurityService } from '../../../shared/security/security.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Generate invoice for order
   */
  async createFromOrder(orderId: string, createInvoiceDto: CreateInvoiceDto): Promise<any> {
    this.logger.log(`Creating invoice for order ID: ${orderId}`);

    // Get order details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
      throw new BadRequestException('Invoice can only be created for confirmed, shipped, or delivered orders');
    }

    // Check if invoice already exists for this order
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: { orderId },
    });

    if (existingInvoice) {
      throw new BadRequestException(`Invoice already exists for order ${orderId}`);
    }

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(createInvoiceDto);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          orderId,
          customerId: order.customerId,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          totalAmount: order.totalAmount,
          currency: order.currency,
          dueDate: sanitizedData.dueDate ? new Date(sanitizedData.dueDate) : null,
          notes: sanitizedData.notes,
          status: InvoiceStatus.DRAFT,
        },
        include: {
          customer: true,
          order: {
            include: {
              orderItems: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Invoice created successfully with ID: ${invoice.id}`);
      return invoice;
    } catch (error) {
      this.logger.error(`Error creating invoice: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async findOne(id: string): Promise<any> {
    this.logger.log(`Finding invoice with ID: ${id}`);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        order: {
          include: {
            orderItems: {
              include: {
                product: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  /**
   * Record payment for invoice
   */
  async createPayment(invoiceId: string, createPaymentDto: CreatePaymentDto): Promise<any> {
    this.logger.log(`Creating payment for invoice ID: ${invoiceId}`);

    const invoice = await this.findOne(invoiceId);

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(createPaymentDto);

    // Validate payment amount doesn't exceed balance due
    const balanceDue = Number(invoice.balanceDue) || Number(invoice.totalAmount);
    if (sanitizedData.amount > balanceDue) {
      throw new BadRequestException(`Payment amount ${sanitizedData.amount} exceeds balance due ${balanceDue}`);
    }

    try {
      const payment = await this.prisma.$transaction(async (tx: any) => {
        // Create payment
        const newPayment = await tx.payment.create({
          data: {
            invoiceId,
            amount: sanitizedData.amount,
            paymentMethod: sanitizedData.paymentMethod,
            paymentDate: sanitizedData.paymentDate ? new Date(sanitizedData.paymentDate) : new Date(),
            reference: sanitizedData.reference,
            notes: sanitizedData.notes,
            status: PaymentStatus.COMPLETED,
          },
        });

        // Update invoice
        const currentPaidAmount = await tx.payment.aggregate({
          where: { invoiceId, status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        });

        const totalPaid = Number(currentPaidAmount._sum.amount) || 0;
        const newBalanceDue = Number(invoice.totalAmount) - totalPaid;

        let newInvoiceStatus = invoice.status;
        if (newBalanceDue <= 0) {
          newInvoiceStatus = InvoiceStatus.PAID;
        } else if (newInvoiceStatus === InvoiceStatus.DRAFT) {
          newInvoiceStatus = InvoiceStatus.SENT;
        }

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: totalPaid,
            balanceDue: newBalanceDue,
            status: newInvoiceStatus,
            updatedAt: new Date(),
          },
        });

        return newPayment;
      });

      this.logger.log(`Payment created successfully with ID: ${payment.id}`);
      return payment;
    } catch (error) {
      this.logger.error(`Error creating payment: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
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

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }
}