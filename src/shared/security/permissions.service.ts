import { Injectable, ForbiddenException } from '@nestjs/common';
// Import UserRole locally to avoid circular dependency
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  ACCOUNTANT = 'ACCOUNTANT',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface ResourcePermission {
  role: UserRole;
  permissions: {
    [resource: string]: string[]; // actions per resource
  };
}

/**
 * Enterprise Permissions Service
 * Implements comprehensive resource-based access control (RBAC)
 * Follows OWASP Top 10 A01: Broken Access Control
 */
@Injectable()
export class PermissionsService {
  private readonly resourcePermissions: ResourcePermission[] = [
    {
      role: UserRole.ADMIN,
      permissions: {
        // Admin has full access to all resources
        'users': ['create', 'read', 'update', 'delete', 'manage'],
        'customers': ['create', 'read', 'update', 'delete', 'manage'],
        'products': ['create', 'read', 'update', 'delete', 'manage'],
        'orders': ['create', 'read', 'update', 'delete', 'manage', 'approve', 'cancel'],
        'invoices': ['create', 'read', 'update', 'delete', 'manage', 'approve', 'payment'],
        'suppliers': ['create', 'read', 'update', 'delete', 'manage'],
        'purchase-orders': ['create', 'read', 'update', 'delete', 'manage', 'approve'],
        'employees': ['create', 'read', 'update', 'delete', 'manage', 'payroll'],
        'reports': ['create', 'read', 'update', 'delete', 'manage', 'generate'],
        'accounting': ['create', 'read', 'update', 'delete', 'manage', 'post', 'reverse'],
        'inventory': ['create', 'read', 'update', 'delete', 'manage', 'adjust'],
        'system': ['read', 'manage', 'configure', 'monitor'],
      }
    },
    {
      role: UserRole.MANAGER,
      permissions: {
        // Manager has access to business operations
        'users': ['read', 'update'], // Can view and update users but not delete
        'customers': ['create', 'read', 'update', 'delete'],
        'products': ['create', 'read', 'update'],
        'orders': ['create', 'read', 'update', 'approve', 'cancel'],
        'invoices': ['create', 'read', 'update', 'payment'],
        'suppliers': ['create', 'read', 'update', 'delete'],
        'purchase-orders': ['create', 'read', 'update', 'approve'],
        'employees': ['read', 'update', 'payroll'],
        'reports': ['read', 'generate'],
        'accounting': ['read', 'post'],
        'inventory': ['read', 'adjust'],
      }
    },
    {
      role: UserRole.USER,
      permissions: {
        // User has limited access to own resources
        'users': ['read'], // Can read own profile
        'customers': ['read'], // Can read customer data
        'products': ['read'],
        'orders': ['create', 'read'], // Can create and read own orders
        'invoices': ['read'], // Can read own invoices
        'suppliers': ['read'],
        'purchase-orders': ['read'],
        'employees': ['read'], // Can read own employee data
        'reports': ['read'],
        'accounting': ['read'],
        'inventory': ['read'],
      }
    }
  ];

  constructor() {}

  /**
   * Check if user has permission to perform action on resource
   * Implements resource-based access control with ownership checking
   */
  async canAccess(
    user: any,
    resource: string,
    action: string,
    resourceId?: string,
    context?: any
  ): Promise<boolean> {
    try {
      // Check if user has the required permission
      const hasPermission = this.hasPermission(user.role, resource, action);

      if (!hasPermission) {
        throw new ForbiddenException(
          `Insufficient permissions: ${user.role} cannot ${action} ${resource}`
        );
      }

      // Check resource ownership for USER role
      if (user.role === UserRole.USER && this.requiresOwnershipCheck(resource, action)) {
        const isOwner = await this.checkResourceOwnership(user, resource, resourceId, context);
        if (!isOwner) {
          throw new ForbiddenException(
            `Access denied: User can only access own ${resource} resources`
          );
        }
      }

      // Check additional business rules
      await this.validateBusinessRules(user, resource, action, resourceId, context);

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Access validation failed');
    }
  }

  /**
   * Check if role has permission for action on resource
   */
  private hasPermission(role: UserRole, resource: string, action: string): boolean {
    const roleConfig = this.resourcePermissions.find(rp => rp.role === role);

    if (!roleConfig) {
      return false;
    }

    const resourcePermissions = roleConfig.permissions[resource];

    if (!resourcePermissions) {
      return false;
    }

    return resourcePermissions.includes(action) || resourcePermissions.includes('manage');
  }

  /**
   * Check if resource requires ownership validation
   */
  private requiresOwnershipCheck(resource: string, action: string): boolean {
    // These resources require ownership checking for USER role
    const ownershipRequiredResources = [
      'users', 'orders', 'invoices', 'employees'
    ];

    return ownershipRequiredResources.includes(resource) &&
           ['read', 'update'].includes(action);
  }

  /**
   * Check if user owns the resource
   */
  private async checkResourceOwnership(
    user: any,
    resource: string,
    resourceId?: string,
    context?: any
  ): Promise<boolean> {
    if (!resourceId) {
      return false;
    }

    // For now, implement basic ownership checking
    // In a real implementation, this would query the database
    switch (resource) {
      case 'users':
        return user.id === resourceId;
      case 'orders':
        return await this.checkOrderOwnership(user, resourceId, context);
      case 'invoices':
        return await this.checkInvoiceOwnership(user, resourceId, context);
      case 'employees':
        return user.employeeId === resourceId;
      default:
        return false;
    }
  }

  /**
   * Check order ownership
   */
  private async checkOrderOwnership(user: any, _orderId: string, context?: any): Promise<boolean> {
    // This would typically query the database
    // For now, assume users can access their own orders
    return context?.order?.customerId === user.customerId;
  }

  /**
   * Check invoice ownership
   */
  private async checkInvoiceOwnership(user: any, _invoiceId: string, context?: any): Promise<boolean> {
    // This would typically query the database
    // For now, assume users can access their own invoices
    return context?.invoice?.customerId === user.customerId;
  }

  /**
   * Validate business rules for resource access
   */
  private async validateBusinessRules(
    user: any,
    resource: string,
    action: string,
    _resourceId?: string,
    context?: any
  ): Promise<void> {
    // Implement business rule validations
    switch (resource) {
      case 'orders':
        await this.validateOrderBusinessRules(user, action, context);
        break;
      case 'invoices':
        await this.validateInvoiceBusinessRules(user, action, context);
        break;
      case 'purchase-orders':
        await this.validatePurchaseOrderBusinessRules(user, action, context);
        break;
      // Add more business rule validations as needed
    }
  }

  /**
   * Validate order business rules
   */
  private async validateOrderBusinessRules(user: any, action: string, context?: any): Promise<void> {
    if (action === 'cancel' && context?.order?.status === 'approved') {
      throw new ForbiddenException('Cannot cancel approved orders');
    }

    if (action === 'approve' && user.role === UserRole.USER) {
      throw new ForbiddenException('Users cannot approve orders');
    }
  }

  /**
   * Validate invoice business rules
   */
  private async validateInvoiceBusinessRules(user: any, action: string, context?: any): Promise<void> {
    if (action === 'payment' && context?.invoice?.status !== 'posted') {
      throw new ForbiddenException('Cannot pay unposted invoices');
    }

    if (action === 'approve' && user.role === UserRole.USER) {
      throw new ForbiddenException('Users cannot approve invoices');
    }
  }

  /**
   * Validate purchase order business rules
   */
  private async validatePurchaseOrderBusinessRules(user: any, action: string, context?: any): Promise<void> {
    if (action === 'approve' && user.role === UserRole.USER) {
      throw new ForbiddenException('Users cannot approve purchase orders');
    }

    if (action === 'delete' && context?.purchaseOrder?.status === 'approved') {
      throw new ForbiddenException('Cannot delete approved purchase orders');
    }
  }

  /**
   * Get user permissions for audit and monitoring
   */
  getUserPermissions(user: any): Record<string, string[]> {
    const roleConfig = this.resourcePermissions.find(rp => rp.role === user.role);
    return roleConfig?.permissions || {};
  }

  /**
   * Check if user can access system-level operations
   */
  canAccessSystem(user: any, action: string): boolean {
    return this.hasPermission(user.role, 'system', action);
  }
}