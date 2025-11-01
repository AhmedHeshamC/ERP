import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InvoiceService } from '../services/invoice.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

@ApiTags('invoices')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('orders/:orderId/invoices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Generate invoice for order' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Invoice generated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Order not in valid state for invoicing' })
  async createFromOrder(
    @Param('orderId') orderId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    try {
      const invoice = await this.invoiceService.createFromOrder(orderId, createInvoiceDto);
      return invoice; // Return data directly for test compatibility
    } catch (error) {
      throw error;
    }
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Invoice not found' })
  async findOne(@Param('id') id: string) {
    try {
      const invoice = await this.invoiceService.findOne(id);
      return invoice; // Return data directly for test compatibility
    } catch (error) {
      throw error;
    }
  }

  @Post('invoices/:invoiceId/payments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Record payment for invoice' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payment recorded successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Invoice not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Payment amount exceeds balance due' })
  async createPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    try {
      const payment = await this.invoiceService.createPayment(invoiceId, createPaymentDto);
      return payment; // Return data directly for test compatibility
    } catch (error) {
      throw error;
    }
  }
}