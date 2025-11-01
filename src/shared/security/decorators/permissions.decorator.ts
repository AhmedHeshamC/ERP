import { SetMetadata } from '@nestjs/common';

export interface PermissionRequirement {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Permissions {
  permissions: PermissionRequirement[];
}

/**
 * Permissions Decorator
 * Specifies required permissions for accessing endpoints
 *
 * Usage:
 * @Permissions({
 *   permissions: [
 *     { resource: 'customers', action: 'create' },
 *     { resource: 'orders', action: 'read' }
 *   ]
 * })
 *
 * @param permissions - Array of required permissions
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (permissions: Permissions) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Resource Permission Decorator (convenience)
 * Simplifies permission specification for single resource/action
 *
 * Usage:
 * @ResourcePermission('customers', 'create')
 * @ResourcePermission('orders', 'approve')
 */
export const ResourcePermission = (resource: string, action: string, conditions?: Record<string, any>) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions: [{ resource, action, conditions }]
  });

/**
 * Public Decorator
 * Marks endpoints as public (no authentication required)
 *
 * Usage:
 * @Public()
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * System Permission Decorator
 * For system-level operations
 *
 * Usage:
 * @SystemPermission('configure')
 * @SystemPermission('monitor')
 */
export const SystemPermission = (action: string) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions: [{ resource: 'system', action }]
  });

/**
 * Owner Only Decorator
 * Restricts access to resource owners only
 *
 * Usage:
 * @OwnerOnly('users')
 * @OwnerOnly('orders')
 */
export const OwnerOnly = (resource: string) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions: [
      { resource, action: 'read', conditions: { ownerOnly: true } },
      { resource, action: 'update', conditions: { ownerOnly: true } }
    ]
  });