import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { PermissionsService } from '../../shared/security/permissions.service';
import { UserRole } from '../../shared/security/permissions.service';
import { ForbiddenException } from '@nestjs/common';

describe('PermissionsService', () => {
  let permissionsService: PermissionsService;

  beforeEach(() => {
    permissionsService = new PermissionsService();
  });

  describe('canAccess', () => {
    describe('Admin permissions', () => {
      it('should allow admin to access any resource', async () => {
        const adminUser = { id: '1', role: UserRole.ADMIN };

        const result = await permissionsService.canAccess(
          adminUser,
          'users',
          'delete'
        );

        expect(result).to.be.true;
      });

      it('should allow admin to manage system resources', async () => {
        const adminUser = { id: '1', role: UserRole.ADMIN };

        const result = await permissionsService.canAccess(
          adminUser,
          'system',
          'configure'
        );

        expect(result).to.be.true;
      });
    });

    describe('Manager permissions', () => {
      it('should allow manager to create customers', async () => {
        const managerUser = { id: '2', role: UserRole.MANAGER };

        const result = await permissionsService.canAccess(
          managerUser,
          'customers',
          'create'
        );

        expect(result).to.be.true;
      });

      it('should allow manager to read users but not delete', async () => {
        const managerUser = { id: '2', role: UserRole.MANAGER };

        const readResult = await permissionsService.canAccess(
          managerUser,
          'users',
          'read'
        );

        const deleteResult = await permissionsService.canAccess(
          managerUser,
          'users',
          'delete'
        );

        expect(readResult).to.be.true;
        expect(deleteResult).to.be.false;
      });

      it('should allow manager to approve orders', async () => {
        const managerUser = { id: '2', role: UserRole.MANAGER };

        const result = await permissionsService.canAccess(
          managerUser,
          'orders',
          'approve'
        );

        expect(result).to.be.true;
      });
    });

    describe('User permissions', () => {
      it('should allow user to read own resources', async () => {
        const user = { id: '3', role: UserRole.USER };

        const result = await permissionsService.canAccess(
          user,
          'users',
          'read',
          '3' // resourceId matching user ID
        );

        expect(result).to.be.true;
      });

      it('should deny user access to other users resources', async () => {
        const user = { id: '3', role: UserRole.USER };

        try {
          await permissionsService.canAccess(
            user,
            'users',
            'read',
            '999' // Different user ID
          );
          expect.fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).to.be.instanceOf(ForbiddenException);
          expect((error as Error).message).to.include('can only access own');
        }
      });

      it('should allow user to create orders', async () => {
        const user = { id: '3', role: UserRole.USER };

        const result = await permissionsService.canAccess(
          user,
          'orders',
          'create'
        );

        expect(result).to.be.true;
      });

      it('should deny user approval permissions', async () => {
        const user = { id: '3', role: UserRole.USER };

        try {
          await permissionsService.canAccess(
            user,
            'orders',
            'approve'
          );
          expect.fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).to.be.instanceOf(ForbiddenException);
        }
      });
    });

    describe('Business rule validation', () => {
      it('should prevent canceling approved orders', async () => {
        const managerUser = { id: '2', role: UserRole.MANAGER };
        const context = {
          order: { status: 'approved' }
        };

        try {
          await permissionsService.canAccess(
            managerUser,
            'orders',
            'cancel',
            'order-123',
            context
          );
          expect.fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).to.be.instanceOf(ForbiddenException);
          expect((error as Error).message).to.include('Cannot cancel approved orders');
        }
      });

      it('should prevent users from approving orders', async () => {
        const user = { id: '3', role: UserRole.USER };

        try {
          await permissionsService.canAccess(
            user,
            'orders',
            'approve'
          );
          expect.fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).to.be.instanceOf(ForbiddenException);
        }
      });
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for admin', () => {
      const adminUser = { id: '1', role: UserRole.ADMIN };

      const permissions = permissionsService.getUserPermissions(adminUser);

      expect(permissions).to.have.property('users');
      expect(permissions.users).to.include.members(['create', 'read', 'update', 'delete', 'manage']);
    });

    it('should return limited permissions for user', () => {
      const user = { id: '3', role: UserRole.USER };

      const permissions = permissionsService.getUserPermissions(user);

      expect(permissions).to.have.property('users');
      expect(permissions.users).to.include('read');
      expect(permissions.users).to.not.include('delete');
    });
  });

  describe('canAccessSystem', () => {
    it('should allow admin to access system operations', () => {
      const adminUser = { id: '1', role: UserRole.ADMIN };

      const result = permissionsService.canAccessSystem(adminUser, 'configure');

      expect(result).to.be.true;
    });

    it('should deny user access to system operations', () => {
      const user = { id: '3', role: UserRole.USER };

      const result = permissionsService.canAccessSystem(user, 'configure');

      expect(result).to.be.false;
    });
  });
});