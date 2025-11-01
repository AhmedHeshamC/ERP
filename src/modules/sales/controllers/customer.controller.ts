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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

@ApiTags('customers')
@Controller('sales/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Customer created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Customer already exists' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    try {
      const customer = await this.customerService.create(createCustomerDto);
      return customer; // Return data directly for test compatibility
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
      // Return in the format expected by tests
      return {
        data: result.data,
        pagination: result.pagination,
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
      return customer; // Return data directly for test compatibility
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update customer' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    try {
      const customer = await this.customerService.update(id, updateCustomerDto);
      return customer; // Return data directly for test compatibility
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update customer active status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: { isActive: boolean },
  ) {
    try {
      const customer = await this.customerService.updateStatus(id, updateStatusDto.isActive);
      return customer; // Return data directly for test compatibility
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