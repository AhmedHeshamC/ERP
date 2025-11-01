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
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { AddOrderItemDto } from '../dto/add-order-item.dto';
import { UpdateOrderItemDto } from '../dto/update-order-item.dto';
import { OrderQueryDto } from '../dto/order-query.dto';

@ApiTags('orders')
@Controller('sales/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sales order' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Order created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or insufficient credit' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Customer or product not found' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    try {
      const order = await this.orderService.create(createOrderDto);
      return {
        success: true,
        message: 'Order created successfully',
        data: order,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders with pagination and filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orders retrieved successfully' })
  async findAll(@Query() query: OrderQueryDto) {
    try {
      const result = await this.orderService.findAll(query);
      return {
        success: true,
        message: 'Orders retrieved successfully',
        ...result,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  async findOne(@Param('id') id: string) {
    try {
      const order = await this.orderService.findOne(id);
      return {
        success: true,
        message: 'Order retrieved successfully',
        data: order,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Only draft orders can be updated' })
  async update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    try {
      const order = await this.orderService.update(id, updateOrderDto);
      return {
        success: true,
        message: 'Order updated successfully',
        data: order,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status transition' })
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateOrderStatusDto) {
    try {
      const order = await this.orderService.updateStatus(id, updateStatusDto);
      return {
        success: true,
        message: 'Order status updated successfully',
        data: order,
      };
    } catch (error) {
      throw error;
    }
  }

  // Order Items Management

  @Post(':id/items')
  
  @ApiOperation({ summary: 'Add item to order' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Item added successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order or product not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Items can only be added to draft orders' })
  async addItem(@Param('id') id: string, @Body() addItemDto: AddOrderItemDto) {
    try {
      const item = await this.orderService.addItem(id, addItemDto);
      return {
        success: true,
        message: 'Item added successfully',
        data: item,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/items/:itemId')
  
  @ApiOperation({ summary: 'Update order item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order or item not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Items can only be updated in draft orders' })
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateOrderItemDto,
  ) {
    try {
      const item = await this.orderService.updateItem(id, itemId, updateItemDto);
      return {
        success: true,
        message: 'Item updated successfully',
        data: item,
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id/items/:itemId')
  
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from order' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Item removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order or item not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Items can only be removed from draft orders' })
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    try {
      await this.orderService.removeItem(id, itemId);
      return;
    } catch (error) {
      throw error;
    }
  }
}