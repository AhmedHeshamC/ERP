import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierResponse,
  SuppliersQueryResponse,
  SupplierQueryDto,
} from './dto/supplier.dto';

/**
 * Supplier Controller - RESTful API endpoints
 * Follows KISS principle with simple, focused endpoints
 * Provides comprehensive CRUD operations for supplier management
 */
@Controller('suppliers')
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class SupplierController {
  private readonly logger = new Logger(SupplierController.name);

  constructor(private readonly supplierService: SupplierService) {}

  /**
   * Create a new supplier
   */
  @Post()
  async createSupplier(@Body() createSupplierDto: CreateSupplierDto): Promise<SupplierResponse> {
    this.logger.log(`Creating supplier: ${createSupplierDto.code} - ${createSupplierDto.name}`);
    return this.supplierService.createSupplier(createSupplierDto);
  }

  /**
   * Get all suppliers with pagination and filtering
   */
  @Get()
  async getSuppliers(@Query() queryDto: SupplierQueryDto): Promise<SuppliersQueryResponse> {
    this.logger.log(`Fetching suppliers with query: ${JSON.stringify(queryDto)}`);
    return this.supplierService.getSuppliers(queryDto);
  }

  /**
   * Get a specific supplier by ID
   */
  @Get(':id')
  async getSupplierById(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierResponse> {
    this.logger.log(`Fetching supplier by ID: ${id}`);
    const supplier = await this.supplierService.getSupplierById(id);

    if (!supplier) {
      this.logger.warn(`Supplier not found: ${id}`);
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  /**
   * Update a supplier
   */
  @Put(':id')
  async updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponse> {
    this.logger.log(`Updating supplier ${id} with data: ${JSON.stringify(updateSupplierDto)}`);
    return this.supplierService.updateSupplier(id, updateSupplierDto);
  }

  /**
   * Delete (soft delete) a supplier
   */
  @Delete(':id')
  async deleteSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.log(`Deleting supplier: ${id}`);
    return this.supplierService.deleteSupplier(id);
  }

  /**
   * Reactivate a deactivated supplier
   */
  @Post(':id/reactivate')
  async reactivateSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierResponse> {
    this.logger.log(`Reactivating supplier: ${id}`);
    return this.supplierService.reactivateSupplier(id);
  }
}