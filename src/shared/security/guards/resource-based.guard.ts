import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { PERMISSIONS_KEY, Permissions } from '../decorators/permissions.decorator';
import { Logger } from '@nestjs/common';

/**
 * Enterprise Resource-Based Guard
 * Implements comprehensive resource-based access control (RBAC)
 * Follows OWASP Top 10 A01: Broken Access Control
 *
 * This guard provides:
 * - Resource-based permission checking
 * - Ownership validation for user resources
 * - Business rule validation
 * - Audit logging for security events
 */
@Injectable()
export class ResourceBasedGuard implements CanActivate {
  private readonly logger = new Logger(ResourceBasedGuard.name);

  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user is authenticated
    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.get<Permissions>(
      PERMISSIONS_KEY,
      context.getHandler(),
    ) || this.reflector.get<Permissions>(PERMISSIONS_KEY, context.getClass());

    if (!requiredPermissions) {
      // No specific permissions required, allow access
      this.logger.debug(`No permissions required for ${request.method} ${request.url}`);
      return true;
    }

    try {
      // Extract resource information from request
      const resourceInfo = this.extractResourceInfo(request, context);

      // Check each required permission
      for (const permission of requiredPermissions.permissions) {
        await this.permissionsService.canAccess(
          user,
          permission.resource,
          permission.action,
          resourceInfo.resourceId,
          resourceInfo.context,
        );
      }

      // Log successful access for audit
      this.logSuccessfulAccess(user, request, resourceInfo);

      // Add permission metadata to request for downstream use
      request.permissions = this.permissionsService.getUserPermissions(user);
      request.resourceInfo = resourceInfo;

      return true;
    } catch (error) {
      // Log failed access attempt for security monitoring
      this.logFailedAccess(user, request, error);

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Extract resource information from request
   */
  private extractResourceInfo(request: any, _context: ExecutionContext): any {
    const method = request.method;
    const url = request.url;
    const params = request.params;
    const query = request.query;
    const body = request.body;

    // Extract resource type from URL path
        let resource = 'unknown';
    let resourceId = params.id || params.resourceId;

    // Determine resource based on URL pattern
    if (url.includes('/users')) {
      resource = 'users';
    } else if (url.includes('/customers')) {
      resource = 'customers';
    } else if (url.includes('/products')) {
      resource = 'products';
    } else if (url.includes('/orders')) {
      resource = 'orders';
      resourceId = params.id;
    } else if (url.includes('/invoices')) {
      resource = 'invoices';
      resourceId = params.id;
    } else if (url.includes('/suppliers')) {
      resource = 'suppliers';
    } else if (url.includes('/purchase-orders')) {
      resource = 'purchase-orders';
      resourceId = params.id;
    } else if (url.includes('/employees')) {
      resource = 'employees';
    } else if (url.includes('/reports')) {
      resource = 'reports';
    } else if (url.includes('/accounting')) {
      resource = 'accounting';
    } else if (url.includes('/inventory')) {
      resource = 'inventory';
    }

    // Determine action based on HTTP method
    let action = 'read';
    switch (method.toLowerCase()) {
      case 'post':
        action = 'create';
        break;
      case 'put':
      case 'patch':
        action = 'update';
        break;
      case 'delete':
        action = 'delete';
        break;
      case 'get':
        action = 'read';
        break;
    }

    // Handle special actions from request body or query
    if (body?.action) {
      action = body.action;
    } else if (query?.action) {
      action = query.action;
    } else if (url.includes('/approve')) {
      action = 'approve';
    } else if (url.includes('/cancel')) {
      action = 'cancel';
    } else if (url.includes('/payment')) {
      action = 'payment';
    } else if (url.includes('/delete')) {
      action = 'delete';
    }

    return {
      resource,
      action,
      resourceId,
      context: {
        method,
        url,
        params,
        query,
        body,
        userAgent: request.headers['user-agent'],
        ip: request.ip || request.connection.remoteAddress,
      },
    };
  }

  /**
   * Log successful access for audit purposes
   */
  private logSuccessfulAccess(user: any, request: any, resourceInfo: any): void {
    this.logger.debug(`Access granted`, {
      userId: user.id,
      userRole: user.role,
      resource: resourceInfo.resource,
      action: resourceInfo.action,
      resourceId: resourceInfo.resourceId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log failed access attempt for security monitoring
   */
  private logFailedAccess(user: any, request: any, error: any): void {
    this.logger.warn(`Access denied`, {
      userId: user?.id || 'anonymous',
      userRole: user?.role || 'none',
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    // In a production environment, you might want to:
    // 1. Send alerts for repeated failed access attempts
    // 2. Implement rate limiting for specific IPs
    // 3. Log to a security event management system
    // 4. Implement automatic blocking for suspicious patterns
  }
}