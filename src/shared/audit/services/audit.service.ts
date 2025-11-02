import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLog } from '../entities/audit-log.entity';
import { IAuditService } from '../interfaces/audit-service.interface';
import { AuditQueryDto } from '../dto/audit-query.dto';

@Injectable()
export class AuditService implements IAuditService, OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Audit service initialized');
  }

  /**
   * Log an audit event
   */
  async logEvent(auditLog: AuditLog): Promise<void> {
    try {
      // Validate audit log data
      const validation = auditLog.validate();
      if (!validation.isValid) {
        this.logger.warn(`Invalid audit log data: ${validation.errors.join(', ')}`);
        throw new Error(`Invalid audit log: ${validation.errors.join(', ')}`);
      }

      // Get request context if available
      const request = this.getCurrentRequest();
      if (request) {
        auditLog.ipAddress = auditLog.ipAddress || request.ip;
        auditLog.userAgent = auditLog.userAgent || request.headers['user-agent'];
        auditLog.correlationId = auditLog.correlationId || request.headers['x-correlation-id'];
      }

      // Store in database
      await this.prisma.auditLog.create({
        data: {
          eventType: auditLog.eventType,
          resourceType: auditLog.resourceType,
          resourceId: auditLog.resourceId,
          action: auditLog.action,
          userId: auditLog.userId || undefined,
          oldValues: auditLog.oldValues,
          newValues: auditLog.newValues,
          metadata: auditLog.metadata,
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent,
          correlationId: auditLog.correlationId,
          severity: auditLog.severity,
          timestamp: auditLog.timestamp,
        },
      });

      this.logger.debug(`Audit log created: ${auditLog.eventType} for ${auditLog.resourceType}:${auditLog.resourceId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create audit log: ${errorMessage}`, errorStack);
      // Don't throw error to avoid breaking business operations
    }
  }

  /**
   * Log a create operation
   */
  async logCreate(
    resourceType: string,
    resourceId: string,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void> {
    const auditLog = AuditLog.forCreate(resourceType, resourceId, newValues, userId, metadata);
    await this.logEvent(auditLog);
  }

  /**
   * Log an update operation
   */
  async logUpdate(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void> {
    const auditLog = AuditLog.forUpdate(resourceType, resourceId, oldValues, newValues, userId, metadata);
    await this.logEvent(auditLog);
  }

  /**
   * Log a delete operation
   */
  async logDelete(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void> {
    const auditLog = AuditLog.forDelete(resourceType, resourceId, oldValues, userId, metadata);
    await this.logEvent(auditLog);
  }

  /**
   * Log a business event
   */
  async logBusinessEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
  ): Promise<void> {
    const auditLog = AuditLog.forBusinessEvent(eventType, resourceType, resourceId, action, userId, metadata, severity);
    await this.logEvent(auditLog);
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity: 'HIGH' | 'CRITICAL' = 'HIGH',
  ): Promise<void> {
    const auditLog = AuditLog.forSecurityEvent(eventType, resourceType, resourceId, action, userId, metadata, severity);
    await this.logEvent(auditLog);
  }

  /**
   * Query audit logs
   */
  async findAuditLogs(query: AuditQueryDto): Promise<{
    data: AuditLog[];
    total: number;
    pagination: any;
  }> {
    const { page = 1, limit = 20, sortBy = 'timestamp', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Build where clause
    if (query.eventType) {
      where.eventType = { contains: query.eventType, mode: 'insensitive' };
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.correlationId) {
      where.correlationId = query.correlationId;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.timestamp.lte = new Date(query.endDate);
      }
    }

    if (query.ipAddress) {
      where.ipAddress = query.ipAddress;
    }

    if (query.search) {
      where.OR = [
        { eventType: { contains: query.search, mode: 'insensitive' } },
        { resourceType: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { metadata: { path: [], string_contains: query.search } },
      ];
    }

    try {
      const [auditLogs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      };

      return {
        data: auditLogs.map(log => new AuditLog({
          ...log,
          userId: log.userId || undefined,
          userAgent: log.userAgent || undefined,
          ipAddress: log.ipAddress || undefined,
          correlationId: log.correlationId || undefined,
          severity: (log.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') || 'LOW',
        })),
        total,
        pagination,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to query audit logs: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async findAuditLogById(id: string): Promise<AuditLog> {
    try {
      const auditLog = await this.prisma.auditLog.findUnique({
        where: { id },
      });

      if (!auditLog) {
        throw new Error(`Audit log with ID ${id} not found`);
      }

      return new AuditLog({
        ...auditLog,
        userId: auditLog.userId || undefined,
        userAgent: auditLog.userAgent || undefined,
        ipAddress: auditLog.ipAddress || undefined,
        correlationId: auditLog.correlationId || undefined,
        severity: auditLog.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find audit log by ID: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async findAuditLogsForResource(
    resourceType: string,
    resourceId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          resourceType,
          resourceId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return auditLogs.map(log => new AuditLog({
        ...log,
        userId: log.userId || undefined,
        userAgent: log.userAgent || undefined,
        ipAddress: log.ipAddress || undefined,
        correlationId: log.correlationId || undefined,
        severity: log.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find audit logs for resource: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async findAuditLogsForUser(
    userId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          userId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return auditLogs.map(log => new AuditLog({
        ...log,
        userId: log.userId || undefined,
        userAgent: log.userAgent || undefined,
        ipAddress: log.ipAddress || undefined,
        correlationId: log.correlationId || undefined,
        severity: log.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find audit logs for user: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get audit logs by event type
   */
  async findAuditLogsByEventType(
    eventType: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    try {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          eventType: { contains: eventType, mode: 'insensitive' },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return auditLogs.map(log => new AuditLog({
        ...log,
        userId: log.userId || undefined,
        userAgent: log.userAgent || undefined,
        ipAddress: log.ipAddress || undefined,
        correlationId: log.correlationId || undefined,
        severity: log.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find audit logs by event type: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Cleanup old audit logs based on retention policy
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          severity: {
            in: ['LOW', 'MEDIUM'], // Only delete low and medium severity logs
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old audit logs (older than ${retentionDays} days)`);
      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to cleanup old audit logs: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get current request context (simplified implementation)
   */
  private getCurrentRequest(): any {
    // In a real implementation, this would get the current request from the context
    // For now, we'll return null and rely on the data being passed in
    return null;
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalEvents,
        eventsBySeverity,
        eventsByType,
        topUsers,
        topResources,
      ] = await Promise.all([
        this.prisma.auditLog.count({
          where: {
            timestamp: { gte: startDate },
          },
        }),
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          where: {
            timestamp: { gte: startDate },
          },
          _count: { severity: true },
        }),
        this.prisma.auditLog.groupBy({
          by: ['eventType'],
          where: {
            timestamp: { gte: startDate },
          },
          _count: { eventType: true },
          orderBy: { _count: { eventType: 'desc' } },
          take: 10,
        }),
        this.prisma.auditLog.groupBy({
          by: ['userId'],
          where: {
            timestamp: { gte: startDate },
            userId: { not: null },
          },
          _count: { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 10,
        }),
        this.prisma.auditLog.groupBy({
          by: ['resourceType'],
          where: {
            timestamp: { gte: startDate },
          },
          _count: { resourceType: true },
          orderBy: { _count: { resourceType: 'desc' } },
          take: 10,
        }),
      ]);

      return {
        totalEvents,
        eventsBySeverity,
        eventsByType,
        topUsers,
        topResources,
        period: days,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get audit statistics: ${errorMessage}`, errorStack);
      throw error;
    }
  }
}