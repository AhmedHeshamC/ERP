import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ResourceBasedGuard } from '../../shared/security/guards/resource-based.guard';
import { PermissionsService } from '../../shared/security/permissions.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../shared/security/permissions.service';

describe('ResourceBasedGuard', () => {
  let guard: ResourceBasedGuard;
  let permissionsService: PermissionsService;
  let reflector: Reflector;

  beforeEach(() => {
    permissionsService = new PermissionsService();
    reflector = new Reflector();
    guard = new ResourceBasedGuard(permissionsService, reflector);
  });

  describe('canActivate', () => {
    it('should allow access with valid permissions', async () => {
      const mockContext = createMockContext({
        user: { id: '1', role: UserRole.ADMIN },
        method: 'POST',
        url: '/users',
      });

      // Mock required permissions
      (reflector as any).set('permissions', {
        permissions: [{ resource: 'users', action: 'create' }]
      }, mockContext.getHandler());

      const result = await guard.canActivate(mockContext);

      expect(result).to.be.true;
    });

    it('should deny access without authentication', async () => {
      const mockContext = createMockContext({
        user: null,
        method: 'GET',
        url: '/users',
      });

      try {
        await guard.canActivate(mockContext);
        expect.fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).to.be.instanceOf(ForbiddenException);
        expect((error as Error).message).to.include('not authenticated');
      }
    });

    it('should deny access with insufficient permissions', async () => {
      const mockContext = createMockContext({
        user: { id: '3', role: UserRole.USER },
        method: 'DELETE',
        url: '/users/123',
      });

      // Mock required permissions
      (reflector as any).set('permissions', {
        permissions: [{ resource: 'users', action: 'delete' }]
      }, mockContext.getHandler());

      try {
        await guard.canActivate(mockContext);
        expect.fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).to.be.instanceOf(ForbiddenException);
        expect((error as Error).message).to.include('Insufficient permissions');
      }
    });

    it('should allow access when no permissions are required', async () => {
      const mockContext = createMockContext({
        user: { id: '3', role: UserRole.USER },
        method: 'GET',
        url: '/public/health',
      });

      const result = await guard.canActivate(mockContext);

      expect(result).to.be.true;
    });

    it('should extract resource information correctly', async () => {
      const mockContext = createMockContext({
        user: { id: '1', role: UserRole.ADMIN },
        method: 'GET',
        url: '/customers/123',
        params: { id: '123' },
      });

      // Mock required permissions
      (reflector as any).set('permissions', {
        permissions: [{ resource: 'customers', action: 'read' }]
      }, mockContext.getHandler());

      const result = await guard.canActivate(mockContext);

      expect(result).to.be.true;
    });

    it('should handle special actions from URL patterns', async () => {
      const mockContext = createMockContext({
        user: { id: '1', role: UserRole.ADMIN },
        method: 'POST',
        url: '/orders/123/approve',
        params: { id: '123' },
      });

      // Mock required permissions
      (reflector as any).set('permissions', {
        permissions: [{ resource: 'orders', action: 'approve' }]
      }, mockContext.getHandler());

      const result = await guard.canActivate(mockContext);

      expect(result).to.be.true;
    });

    it('should add permission metadata to request', async () => {
      const mockContext = createMockContext({
        user: { id: '1', role: UserRole.ADMIN },
        method: 'GET',
        url: '/users',
      });

      // Mock required permissions
      (reflector as any).set('permissions', {
        permissions: [{ resource: 'users', action: 'read' }]
      }, mockContext.getHandler());

      await guard.canActivate(mockContext);

      const request = mockContext.switchToHttp().getRequest();
      expect(request).to.have.property('permissions');
      expect(request).to.have.property('resourceInfo');
    });
  });

  // Helper function to create mock execution context
  function createMockContext(overrides: any = {}): ExecutionContext {
    const defaultRequest = {
      user: null,
      method: 'GET',
      url: '/',
      headers: {},
      params: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      correlationId: 'test-correlation-id',
    };

    const request = { ...defaultRequest, ...overrides };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          setHeader: () => {},
          status: () => ({ json: () => {} }),
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }
});