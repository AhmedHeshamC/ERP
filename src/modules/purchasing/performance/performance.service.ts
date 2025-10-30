import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import {
  CreateSupplierPerformanceDto,
  UpdateSupplierPerformanceDto,
  SupplierPerformanceQueryDto,
  SupplierPerformanceResponse,
  SupplierPerformanceQueryResponse,
  PerformanceAnalyticsResponse,
  SupplierTier,
  PerformanceMetricType,
  PerformanceLevel,
  CreateScorecardDetailDto,
  CreatePerformanceEventDto,
  PerformanceEventType,
  EventSeverity,
} from './dto/performance.dto';

/**
 * Supplier Performance Score Weights
 * Based on industry best practices for supplier evaluation
 */
const PERFORMANCE_WEIGHTS = {
  quality: 0.35,      // 35% weight for quality metrics
  delivery: 0.30,     // 30% weight for delivery performance
  cost: 0.20,         // 20% weight for cost competitiveness
  service: 0.15,      // 15% weight for service quality
};

/**
 * Supplier Tier Thresholds
 * Defines score ranges for different supplier classifications
 */
const TIER_THRESHOLDS = {
  PREFERRED: 90,      // 90-100: Preferred suppliers
  APPROVED: 80,       // 80-89: Approved suppliers
  STANDARD: 70,       // 70-79: Standard suppliers
  CONDITIONAL: 50,    // 50-69: Conditional suppliers
  UNDER_REVIEW: 0,    // 0-49: Under review suppliers
};

/**
 * Enterprise Supplier Performance Service
 * Implements SOLID principles with single responsibility for performance management
 * Follows KISS principle with clean, focused implementation
 * TDD approach with comprehensive business logic validation
 * OWASP security compliance with input validation and audit trails
 */
@Injectable()
export class SupplierPerformanceService {
  private readonly logger = new Logger(SupplierPerformanceService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new supplier performance record with comprehensive validation
   * Follows OWASP A01, A03, A07 security requirements
   */
  async createSupplierPerformance(createPerformanceDto: CreateSupplierPerformanceDto): Promise<SupplierPerformanceResponse> {
    try {
      this.logger.log(`Creating supplier performance record for supplier: ${createPerformanceDto.supplierId}, period: ${createPerformanceDto.period}`);

      // Input validation and sanitization (OWASP A03)
      if (!this.securityService.validateInput(createPerformanceDto)) {
        this.logger.warn(`Invalid input data for performance creation: ${createPerformanceDto.supplierId}`);
        throw new BadRequestException('Invalid performance data');
      }

      const sanitizedData = this.securityService.sanitizeInput(createPerformanceDto) as CreateSupplierPerformanceDto;

      // Validate supplier exists and is active
      const supplier = await this.prismaService.supplier.findUnique({
        where: { id: sanitizedData.supplierId },
        select: { id: true, name: true, code: true, email: true, isActive: true },
      });

      if (!supplier) {
        this.logger.warn(`Supplier not found for performance creation: ${sanitizedData.supplierId}`);
        throw new NotFoundException(`Supplier with ID ${sanitizedData.supplierId} not found`);
      }

      if (!supplier.isActive) {
        this.logger.warn(`Inactive supplier attempted for performance creation: ${sanitizedData.supplierId}`);
        throw new BadRequestException(`Supplier ${supplier.name} is not active`);
      }

      // Check if performance record already exists for this supplier and period
      const existingPerformance = await this.prismaService.supplierPerformance.findUnique({
        where: {
          supplierId_period: {
            supplierId: sanitizedData.supplierId,
            period: sanitizedData.period,
          },
        },
      });

      if (existingPerformance) {
        this.logger.warn(`Duplicate performance record attempted: supplier ${sanitizedData.supplierId}, period ${sanitizedData.period}`);
        throw new ConflictException(`Performance record for supplier ${sanitizedData.supplierId} in period ${sanitizedData.period} already exists`);
      }

      // Validate calculator exists if provided
      let calculator = null;
      if (sanitizedData.calculatedBy) {
        calculator = await this.prismaService.user.findUnique({
          where: { id: sanitizedData.calculatedBy },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (!calculator) {
          this.logger.warn(`Calculator not found: ${sanitizedData.calculatedBy}`);
          throw new NotFoundException(`User with ID ${sanitizedData.calculatedBy} not found`);
        }
      }

      // Calculate overall score and determine tier
      const overallScore = this.calculateOverallScore(sanitizedData);
      const tier = this.calculateSupplierTier(overallScore);

      // Create performance record
      const performance = await this.prismaService.supplierPerformance.create({
        data: {
          ...sanitizedData,
          overallScore,
          tier,
          qualityScore: sanitizedData.qualityScore || 0,
          deliveryScore: sanitizedData.deliveryScore || 0,
          costScore: sanitizedData.costScore || 0,
          serviceScore: sanitizedData.serviceScore || 0,
          onTimeDeliveryRate: sanitizedData.onTimeDeliveryRate || 0,
          qualityDefectRate: sanitizedData.qualityDefectRate || 0,
          orderAccuracyRate: sanitizedData.orderAccuracyRate || 0,
          priceVarianceRate: sanitizedData.priceVarianceRate || 0,
          responseTimeHours: sanitizedData.responseTimeHours || 0,
          totalOrders: sanitizedData.totalOrders || 0,
          totalValue: sanitizedData.totalValue || 0,
          lateDeliveries: sanitizedData.lateDeliveries || 0,
          qualityIssues: sanitizedData.qualityIssues || 0,
          returnsCount: sanitizedData.returnsCount || 0,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              email: true,
            },
          },
          calculator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Convert Decimal to number for response
      const performanceResponse: SupplierPerformanceResponse = {
        ...performance,
        qualityScore: parseFloat(performance.qualityScore.toString()),
        deliveryScore: parseFloat(performance.deliveryScore.toString()),
        costScore: parseFloat(performance.costScore.toString()),
        serviceScore: parseFloat(performance.serviceScore.toString()),
        overallScore: parseFloat(performance.overallScore.toString()),
        tier: performance.tier as SupplierTier,
        onTimeDeliveryRate: parseFloat(performance.onTimeDeliveryRate.toString()),
        qualityDefectRate: parseFloat(performance.qualityDefectRate.toString()),
        orderAccuracyRate: parseFloat(performance.orderAccuracyRate.toString()),
        priceVarianceRate: parseFloat(performance.priceVarianceRate.toString()),
        responseTimeHours: parseFloat(performance.responseTimeHours.toString()),
        totalValue: parseFloat(performance.totalValue.toString()),
      };

      this.logger.log(`Successfully created performance record: ${performance.id} for supplier: ${supplier.name}`);
      return performanceResponse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create supplier performance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create supplier performance');
    }
  }

  /**
   * Get supplier performance records with pagination, filtering, and sorting
   * Implements efficient querying with proper indexing
   */
  async getSupplierPerformance(queryDto: SupplierPerformanceQueryDto): Promise<SupplierPerformanceQueryResponse> {
    try {
      this.logger.log(`Fetching supplier performance with query: ${JSON.stringify(queryDto)}`);

      const {
        supplierId,
        period,
        tier,
        minOverallScore,
        maxOverallScore,
        periodFrom,
        periodTo,
        skip,
        take,
        sortBy,
        sortOrder,
      } = queryDto;

      // Build where clause for filtering
      const where: any = {};

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (period) {
        where.period = period;
      }

      if (tier) {
        where.tier = tier;
      }

      if (minOverallScore !== undefined) {
        where.overallScore = { ...where.overallScore, gte: minOverallScore };
      }

      if (maxOverallScore !== undefined) {
        where.overallScore = { ...where.overallScore, lte: maxOverallScore };
      }

      if (periodFrom || periodTo) {
        where.period = {};
        if (periodFrom) {
          where.period.gte = periodFrom;
        }
        if (periodTo) {
          where.period.lte = periodTo;
        }
      }

      // Execute queries in parallel for performance
      const [performances, total] = await Promise.all([
        this.prismaService.supplierPerformance.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
                email: true,
              },
            },
            calculator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        this.prismaService.supplierPerformance.count({ where }),
      ]);

      // Convert Decimal to number for each performance record
      const performancesWithNumbers = performances.map(performance => ({
        ...performance,
        qualityScore: parseFloat(performance.qualityScore.toString()),
        deliveryScore: parseFloat(performance.deliveryScore.toString()),
        costScore: parseFloat(performance.costScore.toString()),
        serviceScore: parseFloat(performance.serviceScore.toString()),
        overallScore: parseFloat(performance.overallScore.toString()),
        tier: performance.tier as SupplierTier,
        onTimeDeliveryRate: parseFloat(performance.onTimeDeliveryRate.toString()),
        qualityDefectRate: parseFloat(performance.qualityDefectRate.toString()),
        orderAccuracyRate: parseFloat(performance.orderAccuracyRate.toString()),
        priceVarianceRate: parseFloat(performance.priceVarianceRate.toString()),
        responseTimeHours: parseFloat(performance.responseTimeHours.toString()),
        totalValue: parseFloat(performance.totalValue.toString()),
      }));

      this.logger.log(`Retrieved ${performances.length} performance records out of ${total} total`);

      return {
        performances: performancesWithNumbers,
        total,
        skip,
        take,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch supplier performance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch supplier performance');
    }
  }

  /**
   * Get supplier performance record by ID with proper error handling
   */
  async getSupplierPerformanceById(id: string): Promise<SupplierPerformanceResponse | null> {
    try {
      this.logger.log(`Fetching supplier performance by ID: ${id}`);

      const performance = await this.prismaService.supplierPerformance.findUnique({
        where: { id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              email: true,
            },
          },
          calculator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!performance) {
        this.logger.warn(`Supplier performance not found: ${id}`);
        return null;
      }

      // Convert Decimal to number for response
      const performanceResponse: SupplierPerformanceResponse = {
        ...performance,
        qualityScore: parseFloat(performance.qualityScore.toString()),
        deliveryScore: parseFloat(performance.deliveryScore.toString()),
        costScore: parseFloat(performance.costScore.toString()),
        serviceScore: parseFloat(performance.serviceScore.toString()),
        overallScore: parseFloat(performance.overallScore.toString()),
        tier: performance.tier as SupplierTier,
        onTimeDeliveryRate: parseFloat(performance.onTimeDeliveryRate.toString()),
        qualityDefectRate: parseFloat(performance.qualityDefectRate.toString()),
        orderAccuracyRate: parseFloat(performance.orderAccuracyRate.toString()),
        priceVarianceRate: parseFloat(performance.priceVarianceRate.toString()),
        responseTimeHours: parseFloat(performance.responseTimeHours.toString()),
        totalValue: parseFloat(performance.totalValue.toString()),
      };

      this.logger.log(`Successfully retrieved supplier performance: ${id}`);
      return performanceResponse;

    } catch (error) {
      this.logger.error(`Failed to fetch supplier performance by ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch supplier performance');
    }
  }

  /**
   * Update supplier performance record with comprehensive validation
   */
  async updateSupplierPerformance(id: string, updatePerformanceDto: UpdateSupplierPerformanceDto): Promise<SupplierPerformanceResponse> {
    try {
      this.logger.log(`Updating supplier performance ${id} with data: ${JSON.stringify(updatePerformanceDto)}`);

      // Check if performance record exists
      const existingPerformance = await this.prismaService.supplierPerformance.findUnique({
        where: { id },
      });

      if (!existingPerformance) {
        this.logger.warn(`Performance update attempted for non-existent ID: ${id}`);
        throw new NotFoundException(`Supplier performance with ID ${id} not found`);
      }

      // Input validation and sanitization
      if (!this.securityService.validateInput(updatePerformanceDto)) {
        this.logger.warn(`Invalid input data for performance update: ${id}`);
        throw new BadRequestException('Invalid performance data');
      }

      const sanitizedData = this.securityService.sanitizeInput(updatePerformanceDto) as UpdateSupplierPerformanceDto;

      // Validate reviewer exists if provided
      let reviewer = null;
      if (sanitizedData.reviewedBy) {
        reviewer = await this.prismaService.user.findUnique({
          where: { id: sanitizedData.reviewedBy },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (!reviewer) {
          this.logger.warn(`Reviewer not found: ${sanitizedData.reviewedBy}`);
          throw new NotFoundException(`User with ID ${sanitizedData.reviewedBy} not found`);
        }
      }

      // Prepare update data with new scores
      const updateData: any = { ...sanitizedData };

      // Recalculate overall score if any performance scores are updated
      const hasScoreUpdates = sanitizedData.qualityScore !== undefined ||
                            sanitizedData.deliveryScore !== undefined ||
                            sanitizedData.costScore !== undefined ||
                            sanitizedData.serviceScore !== undefined;

      if (hasScoreUpdates) {
        const scores = {
          qualityScore: sanitizedData.qualityScore ?? parseFloat(existingPerformance.qualityScore.toString()),
          deliveryScore: sanitizedData.deliveryScore ?? parseFloat(existingPerformance.deliveryScore.toString()),
          costScore: sanitizedData.costScore ?? parseFloat(existingPerformance.costScore.toString()),
          serviceScore: sanitizedData.serviceScore ?? parseFloat(existingPerformance.serviceScore.toString()),
        };

        updateData.overallScore = this.calculateOverallScore(scores);
        updateData.tier = this.calculateSupplierTier(updateData.overallScore) as SupplierTier;
      }

      // Add review timestamp if reviewer is assigned
      if (sanitizedData.reviewedBy) {
        updateData.reviewedAt = new Date();
      }

      // Update performance record
      const updatedPerformance = await this.prismaService.supplierPerformance.update({
        where: { id },
        data: updateData,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              email: true,
            },
          },
          calculator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Convert Decimal to number for response
      const performanceResponse: SupplierPerformanceResponse = {
        ...updatedPerformance,
        qualityScore: parseFloat(updatedPerformance.qualityScore.toString()),
        deliveryScore: parseFloat(updatedPerformance.deliveryScore.toString()),
        costScore: parseFloat(updatedPerformance.costScore.toString()),
        serviceScore: parseFloat(updatedPerformance.serviceScore.toString()),
        overallScore: parseFloat(updatedPerformance.overallScore.toString()),
        tier: updatedPerformance.tier as SupplierTier,
        onTimeDeliveryRate: parseFloat(updatedPerformance.onTimeDeliveryRate.toString()),
        qualityDefectRate: parseFloat(updatedPerformance.qualityDefectRate.toString()),
        orderAccuracyRate: parseFloat(updatedPerformance.orderAccuracyRate.toString()),
        priceVarianceRate: parseFloat(updatedPerformance.priceVarianceRate.toString()),
        responseTimeHours: parseFloat(updatedPerformance.responseTimeHours.toString()),
        totalValue: parseFloat(updatedPerformance.totalValue.toString()),
      };

      this.logger.log(`Successfully updated supplier performance: ${updatedPerformance.id}`);
      return performanceResponse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update supplier performance ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update supplier performance');
    }
  }

  /**
   * Calculate comprehensive performance analytics
   * Provides insights for supplier management decisions
   */
  async calculatePerformanceAnalytics(): Promise<PerformanceAnalyticsResponse> {
    try {
      this.logger.log('Calculating supplier performance analytics');

      // Get all performance records for analysis
      const performances = await this.prismaService.supplierPerformance.findMany({
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Handle empty data case
      if (performances.length === 0) {
        return {
          totalSuppliers: 0,
          averageOverallScore: 0,
          tierDistribution: {
            PREFERRED: 0,
            APPROVED: 0,
            STANDARD: 0,
            CONDITIONAL: 0,
            UNDER_REVIEW: 0,
          },
          performanceTrends: [],
          topPerformers: [],
          lowPerformers: [],
          keyMetrics: {
            averageOnTimeDelivery: 0,
            averageQualityScore: 0,
            averageDeliveryScore: 0,
            averageCostScore: 0,
            averageServiceScore: 0,
            totalQualityIssues: 0,
            totalLateDeliveries: 0,
          },
        };
      }

      // Calculate basic metrics
      const totalSuppliers = new Set(performances.map(p => p.supplierId)).size;
      const averageOverallScore = performances.reduce((sum, p) => sum + parseFloat(p.overallScore.toString()), 0) / performances.length;

      // Calculate tier distribution
      const tierDistribution = performances.reduce((acc, p) => {
        acc[p.tier as SupplierTier] = (acc[p.tier as SupplierTier] || 0) + 1;
        return acc;
      }, {} as Record<SupplierTier, number>);

      // Ensure all tiers are represented
      Object.values(SupplierTier).forEach(tier => {
        if (!tierDistribution[tier]) {
          tierDistribution[tier] = 0;
        }
      });

      // Calculate performance trends by period
      const periodGroups = performances.reduce((acc, p) => {
        if (!acc[p.period]) {
          acc[p.period] = {
            scores: [],
            orders: 0,
            value: 0,
          };
        }
        acc[p.period].scores.push(parseFloat(p.overallScore.toString()));
        acc[p.period].orders += p.totalOrders;
        acc[p.period].value += parseFloat(p.totalValue.toString());
        return acc;
      }, {} as Record<string, { scores: number[], orders: number, value: number }>);

      const performanceTrends = Object.entries(periodGroups)
        .map(([period, data]) => ({
          period,
          averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
          totalOrders: data.orders,
          totalValue: data.value,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Identify top and low performers
      const supplierAverages = performances.reduce((acc, p) => {
        if (!acc[p.supplierId]) {
          acc[p.supplierId] = {
            supplierId: p.supplierId,
            supplierName: p.supplier.name,
            scores: [],
            tier: p.tier as SupplierTier,
          };
        }
        acc[p.supplierId].scores.push(parseFloat(p.overallScore.toString()));
        return acc;
      }, {} as Record<string, { supplierId: string, supplierName: string, scores: number[], tier: SupplierTier }>);

      const supplierPerformances = Object.values(supplierAverages).map(supplier => ({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        overallScore: supplier.scores.reduce((sum, score) => sum + score, 0) / supplier.scores.length,
        tier: supplier.tier,
      }));

      const topPerformers = supplierPerformances
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5);

      const lowPerformers = supplierPerformances
        .sort((a, b) => a.overallScore - b.overallScore)
        .slice(0, 5);

      // Calculate key metrics
      const keyMetrics = {
        averageOnTimeDelivery: performances.reduce((sum, p) => sum + parseFloat(p.onTimeDeliveryRate.toString()), 0) / performances.length,
        averageQualityScore: performances.reduce((sum, p) => sum + parseFloat(p.qualityScore.toString()), 0) / performances.length,
        averageDeliveryScore: performances.reduce((sum, p) => sum + parseFloat(p.deliveryScore.toString()), 0) / performances.length,
        averageCostScore: performances.reduce((sum, p) => sum + parseFloat(p.costScore.toString()), 0) / performances.length,
        averageServiceScore: performances.reduce((sum, p) => sum + parseFloat(p.serviceScore.toString()), 0) / performances.length,
        totalQualityIssues: performances.reduce((sum, p) => sum + p.qualityIssues, 0),
        totalLateDeliveries: performances.reduce((sum, p) => sum + p.lateDeliveries, 0),
      };

      const analytics: PerformanceAnalyticsResponse = {
        totalSuppliers,
        averageOverallScore,
        tierDistribution,
        performanceTrends,
        topPerformers,
        lowPerformers,
        keyMetrics,
      };

      this.logger.log(`Successfully calculated performance analytics for ${totalSuppliers} suppliers`);
      return analytics;

    } catch (error) {
      this.logger.error(`Failed to calculate performance analytics: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to calculate performance analytics');
    }
  }

  /**
   * Add detailed scorecard information for performance metrics
   */
  async addScorecardDetail(detailDto: CreateScorecardDetailDto): Promise<any> {
    try {
      this.logger.log(`Adding scorecard detail for performance: ${detailDto.performanceId}`);

      // Input validation and sanitization
      if (!this.securityService.validateInput(detailDto)) {
        this.logger.warn(`Invalid input data for scorecard detail: ${detailDto.performanceId}`);
        throw new BadRequestException('Invalid scorecard detail data');
      }

      const sanitizedData = this.securityService.sanitizeInput(detailDto) as CreateScorecardDetailDto;

      // Validate performance record exists
      const existingPerformance = await this.prismaService.supplierPerformance.findUnique({
        where: { id: sanitizedData.performanceId },
      });

      if (!existingPerformance) {
        this.logger.warn(`Performance record not found for scorecard detail: ${sanitizedData.performanceId}`);
        throw new NotFoundException('Performance record not found');
      }

      // Create scorecard detail
      const detail = await this.prismaService.supplierScorecardDetail.create({
        data: sanitizedData,
      });

      this.logger.log(`Successfully created scorecard detail: ${detail.id}`);
      return detail;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to add scorecard detail: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to add scorecard detail');
    }
  }

  /**
   * Record performance events for supplier tracking
   */
  async recordPerformanceEvent(eventDto: CreatePerformanceEventDto): Promise<any> {
    try {
      this.logger.log(`Recording performance event for supplier: ${eventDto.supplierId}`);

      // Input validation and sanitization
      if (!this.securityService.validateInput(eventDto)) {
        this.logger.warn(`Invalid input data for performance event: ${eventDto.supplierId}`);
        throw new BadRequestException('Invalid performance event data');
      }

      const sanitizedData = this.securityService.sanitizeInput(eventDto) as CreatePerformanceEventDto;

      // Validate supplier exists
      const supplier = await this.prismaService.supplier.findUnique({
        where: { id: sanitizedData.supplierId },
        select: { id: true, name: true, isActive: true },
      });

      if (!supplier) {
        this.logger.warn(`Supplier not found for performance event: ${sanitizedData.supplierId}`);
        throw new NotFoundException('Supplier not found');
      }

      // Create performance event
      const event = await this.prismaService.supplierPerformanceEvent.create({
        data: sanitizedData,
      });

      this.logger.log(`Successfully recorded performance event: ${event.id} for supplier: ${supplier.name}`);
      return event;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to record performance event: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to record performance event');
    }
  }

  /**
   * Calculate supplier tier based on overall score
   * Implements business rules for supplier classification
   */
  private calculateSupplierTier(overallScore: number): SupplierTier {
    if (overallScore >= TIER_THRESHOLDS.PREFERRED) {
      return SupplierTier.PREFERRED;
    } else if (overallScore >= TIER_THRESHOLDS.APPROVED) {
      return SupplierTier.APPROVED;
    } else if (overallScore >= TIER_THRESHOLDS.STANDARD) {
      return SupplierTier.STANDARD;
    } else if (overallScore >= TIER_THRESHOLDS.CONDITIONAL) {
      return SupplierTier.CONDITIONAL;
    } else {
      return SupplierTier.UNDER_REVIEW;
    }
  }

  /**
   * Calculate weighted overall score from individual performance scores
   * Uses industry-standard weights for balanced evaluation
   */
  private calculateOverallScore(scores: {
    qualityScore?: number;
    deliveryScore?: number;
    costScore?: number;
    serviceScore?: number;
  }): number {
    const qualityScore = scores.qualityScore || 0;
    const deliveryScore = scores.deliveryScore || 0;
    const costScore = scores.costScore || 0;
    const serviceScore = scores.serviceScore || 0;

    // Calculate weighted average
    const overallScore =
      (qualityScore * PERFORMANCE_WEIGHTS.quality) +
      (deliveryScore * PERFORMANCE_WEIGHTS.delivery) +
      (costScore * PERFORMANCE_WEIGHTS.cost) +
      (serviceScore * PERFORMANCE_WEIGHTS.service);

    // Round to 2 decimal places
    return Math.round(overallScore * 100) / 100;
  }
}