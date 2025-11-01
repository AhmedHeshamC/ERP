import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierResponse,
  SuppliersQueryResponse,
  SupplierQueryDto,
  SupplierStatus,
} from './dto/supplier.dto';

/**
 * Enterprise Supplier Service
 * Implements SOLID principles with single responsibility for supplier management
 * Follows KISS principle with clean, focused implementation
 * Comprehensive security logging and error handling
 */
@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new supplier with comprehensive security validation
   * Follows OWASP A01, A03, A07 security requirements
   */
  async createSupplier(createSupplierDto: CreateSupplierDto): Promise<SupplierResponse> {
    try {
      this.logger.log(`Creating new supplier!: ${createSupplierDto.name} (${createSupplierDto.code})`);

      // Input validation and sanitization (OWASP A03)
      if (!this.securityService.validateInput(createSupplierDto)) {
        this.logger.warn(`Invalid input data for supplier creation!: ${createSupplierDto.code}`);
        throw new BadRequestException('Invalid supplier data');
      }

      const sanitizedData = this.securityService.sanitizeInput(createSupplierDto) as CreateSupplierDto;

      // Check if supplier code already exists
      const existingSupplier = await this.prismaService.supplier.findUnique({
        where: { code: sanitizedData.code },
      });

      if (existingSupplier) {
        this.logger.warn(`Duplicate supplier code attempted!: ${sanitizedData.code}`);
        throw new ConflictException(`Supplier with code ${sanitizedData.code} already exists`);
      }

      // Check if email already exists
      const existingEmail = await this.prismaService.supplier.findUnique({
        where: { email: sanitizedData.email },
      });

      if (existingEmail) {
        this.logger.warn(`Duplicate supplier email attempted!: ${sanitizedData.email}`);
        throw new ConflictException(`Supplier with email ${sanitizedData.email} already exists`);
      }

      // Create supplier with audit trail
      const supplier = await this.prismaService.supplier.create({
        data: sanitizedData,
      });

      // Convert Decimal to number for response
      const supplierResponse: SupplierResponse = {
        ...supplier,
        creditLimit: parseFloat(supplier.creditLimit.toString()),
        phone: supplier.phone || undefined,
        address: supplier.address || undefined,
        city: supplier.city || undefined,
        state: supplier.state || undefined,
        postalCode: supplier.postalCode || undefined,
        country: supplier.country || undefined,
        taxId: supplier.taxId || undefined,
      };

      this.logger.log(`Successfully created supplier!: ${supplier.name} (ID: ${supplier.id})`);
      return supplierResponse;

    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create supplier: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create supplier');
    }
  }

  /**
   * Get suppliers with pagination, filtering, and search
   * Implements efficient querying with proper indexing
   */
  async getSuppliers(queryDto: SupplierQueryDto): Promise<SuppliersQueryResponse> {
    try {
      this.logger.log(`Fetching suppliers with query!: ${JSON.stringify(queryDto)}`);

      const { search, status, skip, take, sortBy, sortOrder } = queryDto;

      // Build where clause for filtering
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        where.isActive = status === SupplierStatus.ACTIVE;
      }

      // Execute queries in parallel for performance
      const [suppliers, total] = await Promise.all([
        this.prismaService.supplier.findMany({
          where,
          skip,
          take,
          orderBy: (() => {
        const orderBy: any = {};
        orderBy[sortBy || 'name'] = sortOrder;
        return orderBy;
      })(),
          select: {
            id: true,
            code: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            taxId: true,
            isActive: true,
            creditLimit: true,
            paymentTerms: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prismaService.supplier.count({ where }),
      ]);

      // Convert Decimal to number for each supplier
      const suppliersWithNumbers = suppliers.map(supplier => ({
        ...supplier,
        creditLimit: parseFloat(supplier.creditLimit.toString()),
        phone: supplier.phone || undefined,
        address: supplier.address || undefined,
        city: supplier.city || undefined,
        state: supplier.state || undefined,
        postalCode: supplier.postalCode || undefined,
        country: supplier.country || undefined,
        taxId: supplier.taxId || undefined,
      }));

      this.logger.log(`Retrieved ${suppliers.length} suppliers out of ${total} total`);

      return {
        suppliers: suppliersWithNumbers,
        total: total || 0,
        skip: skip || 0,
        take: take || 10,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch suppliers: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to fetch suppliers');
    }
  }

  /**
   * Get supplier by ID with proper error handling
   */
  async getSupplierById(id: string): Promise<SupplierResponse | null> {
    try {
      this.logger.log(`Fetching supplier by ID!: ${id}`);

      const supplier = await this.prismaService.supplier.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          taxId: true,
          isActive: true,
          creditLimit: true,
          paymentTerms: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!supplier) {
        this.logger.warn(`Supplier not found!: ${id}`);
        return null;
      }

      // Convert Decimal to number for response
      const supplierResponse: SupplierResponse = {
        ...supplier,
        creditLimit: parseFloat(supplier.creditLimit.toString()),
        phone: supplier.phone || undefined,
        address: supplier.address || undefined,
        city: supplier.city || undefined,
        state: supplier.state || undefined,
        postalCode: supplier.postalCode || undefined,
        country: supplier.country || undefined,
        taxId: supplier.taxId || undefined,
      };

      this.logger.log(`Successfully retrieved supplier!: ${supplier.name} (ID: ${id})`);
      return supplierResponse;

    } catch (error) {
      this.logger.error(`Failed to fetch supplier by ID ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to fetch supplier');
    }
  }

  /**
   * Update supplier with comprehensive validation and security
   */
  async updateSupplier(id: string, updateSupplierDto: UpdateSupplierDto): Promise<SupplierResponse> {
    try {
      this.logger.log(`Updating supplier ${id} with data!: ${JSON.stringify(updateSupplierDto)}`);

      // Check if supplier exists
      const existingSupplier = await this.prismaService.supplier.findUnique({
        where: { id },
      });

      if (!existingSupplier) {
        this.logger.warn(`Supplier update attempted for non-existent ID!: ${id}`);
        throw new NotFoundException(`Supplier with ID ${id} not found`);
      }

      // Input validation and sanitization
      if (!this.securityService.validateInput(updateSupplierDto)) {
        this.logger.warn(`Invalid input data for supplier update!: ${id}`);
        throw new BadRequestException('Invalid supplier data');
      }

      const sanitizedData = this.securityService.sanitizeInput(updateSupplierDto) as UpdateSupplierDto;

      // Check for duplicate code if code is being updated
      if (sanitizedData.code && sanitizedData.code !== existingSupplier.code) {
        const duplicateCode = await this.prismaService.supplier.findUnique({
          where: { code: sanitizedData.code },
        });

        if (duplicateCode) {
          throw new ConflictException(`Supplier with code ${sanitizedData.code} already exists`);
        }
      }

      // Check for duplicate email if email is being updated
      if (sanitizedData.email && sanitizedData.email !== existingSupplier.email) {
        const duplicateEmail = await this.prismaService.supplier.findUnique({
          where: { email: sanitizedData.email },
        });

        if (duplicateEmail) {
          throw new ConflictException(`Supplier with email ${sanitizedData.email} already exists`);
        }
      }

      // Update supplier
      const updatedSupplier = await this.prismaService.supplier.update({
        where: { id },
        data: sanitizedData,
      });

      // Convert Decimal to number for response and handle null to undefined conversion
      const supplierResponse: SupplierResponse = {
        id: updatedSupplier.id,
        code: updatedSupplier.code,
        name: updatedSupplier.name,
        email: updatedSupplier.email,
        phone: updatedSupplier.phone || undefined,
        address: updatedSupplier.address || undefined,
        city: updatedSupplier.city || undefined,
        state: updatedSupplier.state || undefined,
        postalCode: updatedSupplier.postalCode || undefined,
        country: updatedSupplier.country || undefined,
        taxId: updatedSupplier.taxId || undefined,
        isActive: updatedSupplier.isActive,
        creditLimit: parseFloat(updatedSupplier.creditLimit.toString()),
        paymentTerms: updatedSupplier.paymentTerms,
        createdAt: updatedSupplier.createdAt,
        updatedAt: updatedSupplier.updatedAt,
      };

      this.logger.log(`Successfully updated supplier!: ${updatedSupplier.name} (ID: ${id})`);
      return supplierResponse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update supplier ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to update supplier');
    }
  }

  /**
   * Soft delete supplier (logical deletion with audit trail)
   */
  async deleteSupplier(id: string): Promise<void> {
    try {
      this.logger.log(`Soft deleting supplier!: ${id}`);

      // Check if supplier exists
      const existingSupplier = await this.prismaService.supplier.findUnique({
        where: { id },
      });

      if (!existingSupplier) {
        this.logger.warn(`Supplier deletion attempted for non-existent ID!: ${id}`);
        throw new NotFoundException(`Supplier with ID ${id} not found`);
      }

      // Soft delete by setting isActive to false
      await this.prismaService.supplier.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Successfully soft deleted supplier!: ${existingSupplier.name} (ID: ${id})`);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to delete supplier ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to delete supplier');
    }
  }

  /**
   * Reactivate a deactivated supplier
   */
  async reactivateSupplier(id: string): Promise<SupplierResponse> {
    try {
      this.logger.log(`Reactivating supplier!: ${id}`);

      const existingSupplier = await this.prismaService.supplier.findUnique({
        where: { id },
      });

      if (!existingSupplier) {
        throw new NotFoundException(`Supplier with ID ${id} not found`);
      }

      if (existingSupplier.isActive) {
        throw new BadRequestException(`Supplier with ID ${id} is already active`);
      }

      const reactivatedSupplier = await this.prismaService.supplier.update({
        where: { id },
        data: { isActive: true },
      });

      // Convert Decimal to number for response and handle null to undefined conversion
      const supplierResponse: SupplierResponse = {
        id: reactivatedSupplier.id,
        code: reactivatedSupplier.code,
        name: reactivatedSupplier.name,
        email: reactivatedSupplier.email,
        phone: reactivatedSupplier.phone || undefined,
        address: reactivatedSupplier.address || undefined,
        city: reactivatedSupplier.city || undefined,
        state: reactivatedSupplier.state || undefined,
        postalCode: reactivatedSupplier.postalCode || undefined,
        country: reactivatedSupplier.country || undefined,
        taxId: reactivatedSupplier.taxId || undefined,
        isActive: reactivatedSupplier.isActive,
        creditLimit: parseFloat(reactivatedSupplier.creditLimit.toString()),
        paymentTerms: reactivatedSupplier.paymentTerms,
        createdAt: reactivatedSupplier.createdAt,
        updatedAt: reactivatedSupplier.updatedAt,
      };

      this.logger.log(`Successfully reactivated supplier!: ${reactivatedSupplier.name} (ID: ${id})`);
      return supplierResponse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to reactivate supplier ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to reactivate supplier');
    }
  }
}