import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark methods for audit logging
 */
export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  eventType: string;
  resourceType: string;
  action: string;
  getResourceId?: (args: any[], result: any) => string;
  getOldValues?: (args: any[], result: any) => any;
  getNewValues?: (args: any[], result: any) => any;
  getMetadata?: (args: any[], result: any) => any;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ignoreOnError?: boolean;
}

/**
 * Decorator to enable audit logging for a method
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);