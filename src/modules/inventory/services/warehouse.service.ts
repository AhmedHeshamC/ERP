import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { Audit } from '../../../shared/audit/decorators/audit.decorator';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseStatus,
} from '../dto/inventory.dto';
import { Warehouse } from '@prisma/client';

interface WarehouseQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: WarehouseStatus;
  city?: string;
  state?: string;
  country?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface WarehousesQueryResponse {
  warehouses: Warehouse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface WarehouseStockResponse {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  totalProducts: number;
  totalStock: number;
  products: Array<{
    productId: string;
    productName: string;
    stockQuantity: number;
  }>;
}

interface WarehouseCapacityResponse {
  warehouseId: string;
  warehouseName: string;
  maxCapacity: number;
  currentUtilization: number;
  availableCapacity: number;
  utilizationPercentage: number;
  status: WarehouseStatus;
}

interface WarehouseStatisticsResponse {
  totalWarehouses: number;
  activeWarehouses: number;
  inactiveWarehouses: number;
  maintenanceWarehouses: number;
  totalCapacity: number;
  totalUtilization: number;
  averageUtilizationPercentage: number;
  warehousesByStatus: Record<WarehouseStatus, number>;
  warehousesByLocation: Array<{
    city: string;
    state: string;
    count: number;
    totalCapacity: number;
  }>;
}

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new warehouse with comprehensive validation and audit logging
   * Follows SOLID principles with single responsibility for warehouse creation
   */
  @Audit({
    eventType: 'WAREHOUSE_CREATED',
    resourceType: 'WAREHOUSE',
    action: 'CREATE',
    getResourceId: (_args: any[], result) => result?.id,
    getNewValues: (_args: any[], result) => result,
    severity: 'MEDIUM',
  })
  async create(createWarehouseDto: CreateWarehouseDto, userId?: string): Promise<Warehouse> {
    this.logger.log(`Creating warehouse: ${createWarehouseDto.name} (Code: ${createWarehouseDto.code})`);

    try {
      // Sanitize input data for security
      const sanitizedData = this.securityService.sanitizeInput(createWarehouseDto);

      // Validate warehouse code is unique
      const existingWarehouse = await this.prismaService.warehouse.findUnique({
        where: { code: sanitizedData.code },
      });

      if (existingWarehouse) {
        throw new ConflictException(`Warehouse with code ${sanitizedData.code} already exists`);
      }

      // Validate email format if provided
      if (sanitizedData.contactEmail && !this.isValidEmail(sanitizedData.contactEmail)) {
        throw new BadRequestException(`Invalid email format: ${sanitizedData.contactEmail}`);
      }

      // Validate phone number format if provided (basic validation)
      if (sanitizedData.contactPhone && !this.isValidPhone(sanitizedData.contactPhone)) {
        throw new BadRequestException(`Invalid phone number format: ${sanitizedData.contactPhone}`);
      }

      // Create warehouse
      const warehouse = await this.prismaService.warehouse.create({
        data: {
          name: sanitizedData.name,
          code: sanitizedData.code,
          address: sanitizedData.address,
          city: sanitizedData.city,
          state: sanitizedData.state,
          country: sanitizedData.country,
          postalCode: sanitizedData.postalCode,
          contactPerson: sanitizedData.contactPerson,
          contactPhone: sanitizedData.contactPhone,
          contactEmail: sanitizedData.contactEmail,
          maxCapacity: sanitizedData.maxCapacity,
          currentUtilization: sanitizedData.currentUtilization || 0,
          operatingHours: sanitizedData.operatingHours,
          status: sanitizedData.status || WarehouseStatus.ACTIVE,
          isActive: true,
          notes: sanitizedData.notes,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      this.logger.log(`Successfully created warehouse: ${warehouse.name} (ID: ${warehouse.id})`);
      return warehouse;

    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create warehouse: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create warehouse');
    }
  }

  /**
   * Find all warehouses with comprehensive filtering and pagination
   * Follows KISS principle with straightforward query logic
   */
  async findAll(query: WarehouseQuery): Promise<WarehousesQueryResponse> {
    this.logger.log(`Finding warehouses with query: ${JSON.stringify(query)}`);

    try {
      // Build where clause for filtering
      const where: any = {};

      if (query.status) {
        where.status = query.status;
      }

      if (query.city) {
        where.city = { contains: query.city, mode: 'insensitive' };
      }

      if (query.state) {
        where.state = { contains: query.state, mode: 'insensitive' };
      }

      if (query.country) {
        where.country = { contains: query.country, mode: 'insensitive' };
      }

      // Search across multiple fields
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
          { address: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      // Default to active warehouses only
      if (where.isActive === undefined) {
        where.isActive = true;
      }

      // Pagination setup
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Sorting setup
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      const orderBy = { [sortBy]: sortOrder };

      // Execute queries in parallel for performance
      const [warehouses, total] = await Promise.all([
        this.prismaService.warehouse.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        this.prismaService.warehouse.count({ where }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${warehouses.length} warehouses (total: ${total})`);

      return {
        warehouses,
        total,
        page,
        limit,
        totalPages,
      };

    } catch (error) {
      this.logger.error(`Failed to find warehouses: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouses');
    }
  }

  /**
   * Find warehouse by ID with comprehensive error handling
   */
  async findById(id: string): Promise<Warehouse> {
    this.logger.log(`Finding warehouse by ID: ${id}`);

    try {
      const warehouse = await this.prismaService.warehouse.findUnique({
        where: { id },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }

      return warehouse;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find warehouse by ID: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouse');
    }
  }

  /**
   * Find warehouse by code with comprehensive error handling
   */
  async findByCode(code: string): Promise<Warehouse> {
    this.logger.log(`Finding warehouse by code: ${code}`);

    try {
      const warehouse = await this.prismaService.warehouse.findUnique({
        where: { code },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with code ${code} not found`);
      }

      return warehouse;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find warehouse by code: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouse');
    }
  }

  /**
   * Update warehouse with comprehensive validation and audit logging
   * Follows SOLID principles with clear separation of concerns
   */
  @Audit({
    eventType: 'WAREHOUSE_UPDATED',
    resourceType: 'WAREHOUSE',
    action: 'UPDATE',
    getResourceId: (args: any[]) => args[0],
    getOldValues: async (args: any[]) => {
      const warehouseId = args[0];
      const prisma = args[3];
      return await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    },
    getNewValues: (_args: any[], result) => result,
    severity: 'MEDIUM',
  })
  async update(id: string, updateWarehouseDto: UpdateWarehouseDto, userId?: string): Promise<Warehouse> {
    this.logger.log(`Updating warehouse: ${id}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(updateWarehouseDto);

      // Validate warehouse exists
      const existingWarehouse = await this.prismaService.warehouse.findUnique({
        where: { id },
      });

      if (!existingWarehouse) {
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }

      // Validate email format if provided
      if (sanitizedData.contactEmail && !this.isValidEmail(sanitizedData.contactEmail)) {
        throw new BadRequestException(`Invalid email format: ${sanitizedData.contactEmail}`);
      }

      // Validate phone number format if provided
      if (sanitizedData.contactPhone && !this.isValidPhone(sanitizedData.contactPhone)) {
        throw new BadRequestException(`Invalid phone number format: ${sanitizedData.contactPhone}`);
      }

      // Business rule: maxCapacity cannot be less than current utilization
      if (sanitizedData.maxCapacity !== undefined) {
        if (sanitizedData.maxCapacity < existingWarehouse.currentUtilization) {
          throw new BadRequestException(
            `Maximum capacity cannot be less than current utilization. Current: ${existingWarehouse.currentUtilization}, Proposed: ${sanitizedData.maxCapacity}`
          );
        }
      }

      // Update warehouse
      const updatedWarehouse = await this.prismaService.warehouse.update({
        where: { id },
        data: {
          ...sanitizedData,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully updated warehouse: ${updatedWarehouse.name} (ID: ${updatedWarehouse.id})`);
      return updatedWarehouse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update warehouse: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to update warehouse');
    }
  }

  /**
   * Soft delete warehouse with audit logging
   * Follows enterprise patterns for data retention
   */
  @Audit({
    eventType: 'WAREHOUSE_DELETED',
    resourceType: 'WAREHOUSE',
    action: 'DELETE',
    getResourceId: (args: any[]) => args[0],
    getOldValues: async (args: any[]) => {
      const warehouseId = args[0];
      const prisma = args[3];
      return await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    },
    severity: 'HIGH',
  })
  async remove(id: string, userId?: string): Promise<Warehouse> {
    this.logger.log(`Removing warehouse: ${id}`);

    try {
      // Validate warehouse exists
      const existingWarehouse = await this.prismaService.warehouse.findUnique({
        where: { id },
      });

      if (!existingWarehouse) {
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }

      // Business rule: Cannot delete warehouse with current utilization
      if (existingWarehouse.currentUtilization > 0) {
        throw new BadRequestException(
          `Cannot delete warehouse with current utilization. Current utilization: ${existingWarehouse.currentUtilization}`
        );
      }

      // Soft delete warehouse
      const deletedWarehouse = await this.prismaService.warehouse.update({
        where: { id },
        data: {
          isActive: false,
          status: WarehouseStatus.INACTIVE,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully removed warehouse: ${deletedWarehouse.name} (ID: ${deletedWarehouse.id})`);
      return deletedWarehouse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to remove warehouse: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to remove warehouse');
    }
  }

  /**
   * Get warehouse stock summary
   * Essential for inventory management and reporting
   */
  async getWarehouseStock(warehouseId: string): Promise<WarehouseStockResponse> {
    this.logger.log(`Getting stock summary for warehouse: ${warehouseId}`);

    try {
      // Validate warehouse exists
      const warehouse = await this.prismaService.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
      }

      // Get all products (assuming all products are in all warehouses for now)
      // In a real implementation, you might have location-based inventory
      const products = await this.prismaService.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
        },
      });

      const totalStock = products.reduce((sum, product) => sum + product.stockQuantity, 0);

      const stockResponse: WarehouseStockResponse = {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        totalProducts: products.length,
        totalStock,
        products: products.map(product => ({
          productId: product.id,
          productName: product.name,
          stockQuantity: product.stockQuantity,
        })),
      };

      this.logger.log(`Generated stock summary for warehouse: ${warehouse.name}`);
      return stockResponse;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get warehouse stock: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouse stock');
    }
  }

  /**
   * Update warehouse utilization with validation
   * Follows KISS principle with clear, focused implementation
   */
  async updateUtilization(warehouseId: string, utilization: number, userId?: string): Promise<Warehouse> {
    this.logger.log(`Updating utilization for warehouse: ${warehouseId} to ${utilization}`);

    try {
      // Validate warehouse exists
      const warehouse = await this.prismaService.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
      }

      // Validate utilization values
      if (utilization < 0) {
        throw new BadRequestException('Utilization cannot be negative');
      }

      if (warehouse.maxCapacity && utilization > warehouse.maxCapacity) {
        throw new BadRequestException(
          `Utilization cannot exceed maximum capacity. Max: ${warehouse.maxCapacity}, Proposed: ${utilization}`
        );
      }

      // Update utilization
      const updatedWarehouse = await this.prismaService.warehouse.update({
        where: { id: warehouseId },
        data: {
          currentUtilization: utilization,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully updated utilization for warehouse: ${updatedWarehouse.name}`);
      return updatedWarehouse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update warehouse utilization: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to update warehouse utilization');
    }
  }

  /**
   * Get warehouse capacity information
   * Essential for space planning and management
   */
  async getWarehouseCapacity(warehouseId: string): Promise<WarehouseCapacityResponse> {
    this.logger.log(`Getting capacity information for warehouse: ${warehouseId}`);

    try {
      // Validate warehouse exists
      const warehouse = await this.prismaService.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
      }

      const availableCapacity = warehouse.maxCapacity ? warehouse.maxCapacity - warehouse.currentUtilization : 0;
      const utilizationPercentage = warehouse.maxCapacity && warehouse.maxCapacity > 0
        ? (warehouse.currentUtilization / warehouse.maxCapacity) * 100
        : 0;

      const capacityResponse: WarehouseCapacityResponse = {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        maxCapacity: warehouse.maxCapacity || 0,
        currentUtilization: warehouse.currentUtilization,
        availableCapacity,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100, // Round to 2 decimal places
        status: warehouse.status as WarehouseStatus,
      };

      this.logger.log(`Generated capacity information for warehouse: ${warehouse.name}`);
      return capacityResponse;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get warehouse capacity: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouse capacity');
    }
  }

  /**
   * Get comprehensive warehouse statistics
   * Supports business intelligence and decision making
   */
  async getWarehouseStatistics(): Promise<WarehouseStatisticsResponse> {
    this.logger.log('Getting warehouse statistics');

    try {
      // Get all warehouses
      const warehouses = await this.prismaService.warehouse.findMany({
        where: { isActive: true },
      });

      // All product statistics calculation has been moved to individual warehouse methods

      // Calculate statistics
      const totalWarehouses = warehouses.length;
      const activeWarehouses = warehouses.filter(w => w.status === WarehouseStatus.ACTIVE).length;
      const inactiveWarehouses = warehouses.filter(w => w.status === WarehouseStatus.INACTIVE).length;
      const maintenanceWarehouses = warehouses.filter(w => w.status === WarehouseStatus.MAINTENANCE).length;

      const totalCapacity = warehouses.reduce((sum, w) => sum + (w.maxCapacity || 0), 0);
      const totalUtilization = warehouses.reduce((sum, w) => sum + w.currentUtilization, 0);
      const averageUtilizationPercentage = totalCapacity > 0 ? (totalUtilization / totalCapacity) * 100 : 0;

      // Group by status
      const warehousesByStatus = {
        [WarehouseStatus.ACTIVE]: activeWarehouses,
        [WarehouseStatus.INACTIVE]: inactiveWarehouses,
        [WarehouseStatus.MAINTENANCE]: maintenanceWarehouses,
      };

      // Group by location
      const locationMap = new Map<string, { count: number; totalCapacity: number; city: string; state: string }>();
      warehouses.forEach(warehouse => {
        const key = `${warehouse.city}-${warehouse.state}`;
        const existing = locationMap.get(key);
        if (existing) {
          existing.count++;
          existing.totalCapacity += warehouse.maxCapacity || 0;
        } else {
          locationMap.set(key, {
            count: 1,
            totalCapacity: warehouse.maxCapacity || 0,
            city: warehouse.city || 'Unknown',
            state: warehouse.state || 'Unknown',
          });
        }
      });

      const warehousesByLocation = Array.from(locationMap.values());

      const statistics: WarehouseStatisticsResponse = {
        totalWarehouses,
        activeWarehouses,
        inactiveWarehouses,
        maintenanceWarehouses,
        totalCapacity,
        totalUtilization,
        averageUtilizationPercentage: Math.round(averageUtilizationPercentage * 100) / 100,
        warehousesByStatus,
        warehousesByLocation,
      };

      this.logger.log('Successfully retrieved warehouse statistics');
      return statistics;

    } catch (error) {
      this.logger.error(`Failed to get warehouse statistics: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve warehouse statistics');
    }
  }

  /**
   * Helper method to validate email format
   * Follows DRY principle with reusable validation logic
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Helper method to validate phone number format
   * Basic validation for international phone numbers
   */
  private isValidPhone(phone: string): boolean {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Check if it has between 7 and 15 digits (typical international phone number length)
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }
}