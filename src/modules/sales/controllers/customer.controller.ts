import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';

@ApiTags('customers')
@Controller('sales/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Customer created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Customer already exists' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    try {
      const customer = await this.customerService.create(createCustomerDto);
      return {
        success: true,
        message: 'Customer created successfully',
        data: customer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers with pagination and filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customers retrieved successfully' })
  async findAll(@Query() query: CustomerQueryDto) {
    try {
      const result = await this.customerService.findAll(query);
      return {
        success: true,
        message: 'Customers retrieved successfully',
        ...result,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  async findOne(@Param('id') id: string) {
    try {
      const customer = await this.customerService.findOne(id);
      return {
        success: true,
        message: 'Customer retrieved successfully',
        data: customer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    try {
      const customer = await this.customerService.update(id, updateCustomerDto);
      return {
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update customer active status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: { isActive: boolean },
  ) {
    try {
      const customer = await this.customerService.updateStatus(id, updateStatusDto.isActive);
      return {
        success: true,
        message: `Customer ${updateStatusDto.isActive ? 'activated' : 'deactivated'} successfully`,
        data: customer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate customer (soft delete)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Customer deactivated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot deactivate customer with active orders' })
  async remove(@Param('id') id: string) {
    try {
      await this.customerService.remove(id);
      return;
    } catch (error) {
      throw error;
    }
  }
}