import { AuditLog } from '../entities/audit-log.entity';
import { AuditQueryDto } from '../dto/audit-query.dto';

/**
 * Interface for audit logging service
 */
export interface IAuditService {
  /**
   * Log an audit event
   */
  logEvent(auditLog: AuditLog): Promise<void>;

  /**
   * Log a create operation
   */
  logCreate(
    resourceType: string,
    resourceId: string,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void>;

  /**
   * Log an update operation
   */
  logUpdate(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void>;

  /**
   * Log a delete operation
   */
  logDelete(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    userId?: string,
    metadata?: any,
  ): Promise<void>;

  /**
   * Log a business event
   */
  logBusinessEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  ): Promise<void>;

  /**
   * Log a security event
   */
  logSecurityEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity?: 'HIGH' | 'CRITICAL',
  ): Promise<void>;

  /**
   * Query audit logs
   */
  findAuditLogs(query: AuditQueryDto): Promise<{
    data: AuditLog[];
    total: number;
    pagination: any;
  }>;

  /**
   * Get audit log by ID
   */
  findAuditLogById(id: string): Promise<AuditLog>;

  /**
   * Get audit logs for a specific resource
   */
  findAuditLogsForResource(
    resourceType: string,
    resourceId: string,
    limit?: number,
  ): Promise<AuditLog[]>;

  /**
   * Get audit logs for a specific user
   */
  findAuditLogsForUser(
    userId: string,
    limit?: number,
  ): Promise<AuditLog[]>;

  /**
   * Get audit logs by event type
   */
  findAuditLogsByEventType(
    eventType: string,
    limit?: number,
  ): Promise<AuditLog[]>;

  /**
   * Cleanup old audit logs based on retention policy
   */
  cleanupOldLogs(retentionDays?: number): Promise<number>;
}