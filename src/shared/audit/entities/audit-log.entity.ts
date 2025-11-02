/**
 * Audit Log entity for structured audit trail management
 */
export class AuditLog {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  action: string;
  userId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;

  constructor(data: Partial<AuditLog>) {
    this.id = data.id || '';
    this.eventType = data.eventType || '';
    this.resourceType = data.resourceType || '';
    this.resourceId = data.resourceId || '';
    this.action = data.action || '';
    this.userId = data.userId;
    this.oldValues = data.oldValues;
    this.newValues = data.newValues;
    this.metadata = data.metadata;
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.correlationId = data.correlationId;
    this.severity = data.severity || 'LOW';
    this.timestamp = data.timestamp || new Date();
  }

  /**
   * Validate audit log data
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.eventType || this.eventType.trim().length === 0) {
      errors.push('Event type is required');
    }

    if (!this.resourceType || this.resourceType.trim().length === 0) {
      errors.push('Resource type is required');
    }

    if (!this.resourceId || this.resourceId.trim().length === 0) {
      errors.push('Resource ID is required');
    }

    if (!this.action || this.action.trim().length === 0) {
      errors.push('Action is required');
    }

    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(this.severity)) {
      errors.push('Severity must be one of: LOW, MEDIUM, HIGH, CRITICAL');
    }

    if (this.oldValues && typeof this.oldValues !== 'object') {
      errors.push('Old values must be an object');
    }

    if (this.newValues && typeof this.newValues !== 'object') {
      errors.push('New values must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize sensitive data for audit logging
   */
  static sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'creditCard',
      'ssn',
      'socialSecurityNumber',
      'bankAccount',
      'apiKey',
      'accessToken',
      'refreshToken',
    ];

    const sanitized = { ...data };

    const sanitizeValue = (obj: any, path: string = ''): any => {
      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          const isSensitive = sensitiveFields.some(field =>
            key.toLowerCase().includes(field.toLowerCase()) ||
            currentPath.toLowerCase().includes(field.toLowerCase())
          );

          if (isSensitive && value) {
            result[key] = '[REDACTED]';
          } else if (typeof value === 'object') {
            result[key] = sanitizeValue(value, currentPath);
          } else {
            result[key] = value;
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeValue(sanitized);
  }

  /**
   * Create audit log for create operations
   */
  static forCreate(
    resourceType: string,
    resourceId: string,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): AuditLog {
    return new AuditLog({
      eventType: `${resourceType.toUpperCase()}_CREATED`,
      resourceType,
      resourceId,
      action: 'CREATE',
      userId,
      newValues: AuditLog.sanitizeData(newValues),
      metadata,
      severity: 'MEDIUM',
    });
  }

  /**
   * Create audit log for update operations
   */
  static forUpdate(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
    metadata?: any,
  ): AuditLog {
    return new AuditLog({
      eventType: `${resourceType.toUpperCase()}_UPDATED`,
      resourceType,
      resourceId,
      action: 'UPDATE',
      userId,
      oldValues: AuditLog.sanitizeData(oldValues),
      newValues: AuditLog.sanitizeData(newValues),
      metadata,
      severity: 'LOW',
    });
  }

  /**
   * Create audit log for delete operations
   */
  static forDelete(
    resourceType: string,
    resourceId: string,
    oldValues: any,
    userId?: string,
    metadata?: any,
  ): AuditLog {
    return new AuditLog({
      eventType: `${resourceType.toUpperCase()}_DELETED`,
      resourceType,
      resourceId,
      action: 'DELETE',
      userId,
      oldValues: AuditLog.sanitizeData(oldValues),
      metadata,
      severity: 'HIGH',
    });
  }

  /**
   * Create audit log for business events
   */
  static forBusinessEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
  ): AuditLog {
    return new AuditLog({
      eventType,
      resourceType,
      resourceId,
      action,
      userId,
      metadata: AuditLog.sanitizeData(metadata),
      severity,
    });
  }

  /**
   * Create audit log for security events
   */
  static forSecurityEvent(
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    userId?: string,
    metadata?: any,
    severity: 'HIGH' | 'CRITICAL' = 'HIGH',
  ): AuditLog {
    return new AuditLog({
      eventType: `SECURITY_${eventType}`,
      resourceType,
      resourceId,
      action,
      userId,
      metadata: AuditLog.sanitizeData(metadata),
      severity,
    });
  }
}