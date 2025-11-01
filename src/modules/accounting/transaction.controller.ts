import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus, TransactionType } from './enums/accounting.enum';
import { JwtAuthGuard } from '../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/security/guards/roles.guard';
import { Roles } from '../../shared/security/decorators/roles.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new transaction with double-entry bookkeeping' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transaction data or double-entry rules violated' })
  create(@Body() createTransactionDto: CreateTransactionDto, @Request() req: ExpressRequest) {
    return this.transactionService.create(createTransactionDto, (req.user as any)?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all transactions with pagination' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: any) {
    return this.transactionService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.transactionService.findOne(id);
  }

  @Get('reference/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by reference' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiParam({ name: 'reference', type: String })
  findByReference(@Param('reference') reference: string) {
    return this.transactionService.findByReference(reference);
  }

  @Patch(':id/post')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Post a pending transaction' })
  @ApiResponse({ status: 200, description: 'Transaction posted successfully' })
  @ApiResponse({ status: 400, description: 'Transaction is already posted or not found' })
  @ApiParam({ name: 'id', type: String })
  postTransaction(@Param('id') id: string, @Request() req: ExpressRequest) {
    return this.transactionService.postTransaction(id, (req.user as any)?.id);
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Cancel a pending transaction' })
  @ApiResponse({ status: 200, description: 'Transaction cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel posted transaction' })
  @ApiParam({ name: 'id', type: String })
  cancelTransaction(@Param('id') id: string, @Request() req: ExpressRequest) {
    return this.transactionService.cancelTransaction(id, (req.user as any)?.id);
  }

  @Get('accounts/:accountId/balance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get account balance as of specific date' })
  @ApiResponse({ status: 200, description: 'Account balance retrieved successfully' })
  @ApiParam({ name: 'accountId', type: String })
  @ApiQuery({ name: 'asOfDate', required: false, type: Date })
  getAccountBalance(
    @Param('accountId') accountId: string,
    @Query('asOfDate') asOfDate?: Date,
  ) {
    return this.transactionService.getAccountBalance(accountId, asOfDate);
  }
}