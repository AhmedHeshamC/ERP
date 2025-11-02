import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { SecurityService } from '../../shared/security/security.service';
import { AuditService } from '../../shared/audit/services/audit.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto, UserPasswordChangeDto } from './dto/user.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { ResourceBasedGuard } from '../../shared/security/guards/resource-based.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { ResourcePermission } from '../../shared/security/decorators/permissions.decorator';
import { UserRole } from './dto/user.dto';

/**
 * Enterprise User Controller
 * Implements comprehensive user management with security best practices
 * Follows OWASP Top 10 security standards
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, ResourceBasedGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new user with comprehensive validation
   * OWASP A01: Broken Access Control - Role-based access
   * OWASP A03: Injection - Input validation and sanitization
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('users', 'create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      this.logger.log(`Creating new user!: ${createUserDto.email}`);

      const user = await this.userService.createUser(createUserDto);

      // Log security event
      await this.securityService.logSecurityEvent(
        'LOGIN_SUCCESS',
        user.id,
        'system',
        'user-controller',
        {
          email: createUserDto.email,
          username: createUserDto.username,
          role: createUserDto.role,
          endpoint: 'POST /users',
        },
      );

      return {
        success: true,
        message: 'User created successfully',
        data: user,
      };
    } catch (error) {
      this.logger.error(`Failed to create user: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      // Log security event for failed creation
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        undefined,
        'system',
        'user-controller',
        {
          email: createUserDto.email,
          error: error instanceof Error ? error.message : "Unknown error",
          endpoint: 'POST /users',
        },
      );

      throw error;
    }
  }

  /**
   * Get user by ID
   * OWASP A01: Broken Access Control - Resource-based access
   */
  @Get(':id')
  @ResourcePermission('users', 'read')
  async getUserById(@Param('id') id: string) {
    try {
      this.logger.log(`Retrieving user!: ${id}`);

      const user = await this.userService.findById(id);

      // Log access (excluding sensitive operations)
      await this.securityService.logSecurityEvent(
        'LOGIN_SUCCESS',
        id,
        'system',
        'user-controller',
        {
          endpoint: `GET /users/${id}`,
          requestedBy: 'system',
        },
      );

      return {
        success: true,
        message: 'User retrieved successfully',
        ...user, // Spread user data to root level for test compatibility
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve user ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Update user information
   * OWASP A01: Broken Access Control - Role-based and self-service access
   */
  @Put(':id')
  @ResourcePermission('users', 'update')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      this.logger.log(`Updating user!: ${id}`);

      const user = await this.userService.updateUser(id, updateUserDto);

      // Log security event
      await this.securityService.logSecurityEvent(
        'LOGIN_SUCCESS',
        id,
        'system',
        'user-controller',
        {
          updatedFields: Object.keys(updateUserDto),
          endpoint: `PUT /users/${id}`,
          updatedBy: 'system',
        },
      );

      return {
        success: true,
        message: 'User updated successfully',
        data: user,
      };
    } catch (error) {
      this.logger.error(`Failed to update user ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      // Log failed update attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error instanceof Error ? error.message : "Unknown error",
          endpoint: `PUT /users/${id}`,
          attemptedBy: 'system',
        },
      );

      throw error;
    }
  }

  /**
   * Get users with filtering and pagination
   * OWASP A01: Broken Access Control - Role-based access
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('users', 'read')
  async getUsers(@Query() query: UserQueryDto) {
    try {
      this.logger.log('Retrieving users with filters', { query });

      // Convert page/limit to skip/take for compatibility
      let skip = query.skip;
      let take = query.take;
      let page = 1;
      let limit = 10;

      if (query.page || query.limit) {
        page = parseInt(query.page || '1');
        limit = parseInt(query.limit || '10');
        skip = String((page - 1) * limit);
        take = String(limit);
      } else {
        skip = skip || '0';
        take = take || '10';
        page = Math.floor(parseInt(skip) / parseInt(take)) + 1;
        limit = parseInt(take);
      }

      const updatedQuery = { ...query, skip, take };
      const result = await this.userService.getUsers(updatedQuery);

      // Build pagination info matching test expectations
      const pagination = {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1,
      };

      return {
        data: result.users,
        pagination,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve users: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Soft delete user (deactivate)
   * OWASP A01: Broken Access Control - Admin only access
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ResourcePermission('users', 'delete')
  async deleteUser(@Param('id') id: string) {
    try {
      this.logger.log(`Deactivating user!: ${id}`);

      await this.userService.softDeleteUser(id);

      // Log security event
      await this.securityService.logSecurityEvent(
        'LOGIN_SUCCESS',
        id,
        'system',
        'user-controller',
        {
          endpoint: `DELETE /users/${id}`,
          deactivatedBy: 'system',
        },
      );

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to deactivate user ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      // Log failed deactivation attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error instanceof Error ? error.message : "Unknown error",
          endpoint: `DELETE /users/${id}`,
          attemptedBy: 'system',
        },
      );

      throw error;
    }
  }

  
  /**
   * Change user password (POST endpoint - for backward compatibility)
   * OWASP A02: Cryptographic Failures - Secure password handling
   * OWASP A07: Authentication Failures - Password strength requirements
   */
  @Post(':id/change-password')
  @ResourcePermission('users', 'update')
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: UserPasswordChangeDto,
  ) {
    try {
      this.logger.log(`Changing password for user!: ${id}`);

      await this.userService.changePassword(id, changePasswordDto);

      // Log security event
      await this.securityService.logSecurityEvent(
        'PASSWORD_CHANGE',
        id,
        'system',
        'user-controller',
        {
          endpoint: `POST /users/${id}/change-password`,
          changedBy: 'self',
        },
      );

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to change password for user ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      // Log failed password change attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error instanceof Error ? error.message : "Unknown error",
          endpoint: `POST /users/${id}/change-password`,
          attemptedBy: 'anonymous',
        },
      );

      throw error;
    }
  }

  /**
   * Get security events for audit and monitoring
   * OWASP A09: Security Logging - Security event monitoring
   * Note: This route is placed at the end to avoid conflicts with parameterized routes
   */
  @Get('security-events')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('system', 'monitor')
  async getSecurityEvents(@Query() query: any) {
    try {
      this.logger.log('Retrieving security events', { query });

      // Build audit query from request parameters
      const auditQuery = {
        page: parseInt(query.page as string) || 1,
        limit: Math.min(parseInt(query.limit as string) || 20, 100), // Cap at 100 for performance
        sortBy: query.sortBy as string || 'timestamp',
        sortOrder: query.sortOrder && ['asc', 'desc'].includes(query.sortOrder as string)
          ? query.sortOrder as 'asc' | 'desc'
          : 'desc',
        eventType: query.eventType as string || undefined,
        resourceType: query.resourceType as string || undefined,
        resourceId: query.resourceId as string || undefined,
        action: query.action as string || undefined,
        userId: query.userId as string || undefined,
        severity: query.severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(query.severity as string)
          ? query.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
          : undefined,
        dateFrom: query.dateFrom ? new Date(query.dateFrom as string) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo as string) : undefined,
      };

      // Query audit logs for security events
      const auditResult = await this.auditService.findAuditLogs(auditQuery);

      // Transform audit logs to security event format
      const securityEvents = auditResult.data.map(log => ({
        id: log.id,
        type: log.eventType,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action,
        userId: log.userId,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        correlationId: log.correlationId,
        severity: log.severity,
        details: this.extractSecurityEventDetails(log),
      }));

      // Calculate summary statistics
      const summary = this.calculateSecurityEventSummary(securityEvents);

      this.logger.log(`Retrieved ${securityEvents.length} security events`);

      return {
        success: true,
        message: 'Security events retrieved successfully',
        data: {
          events: securityEvents,
          pagination: {
            page: auditQuery.page,
            limit: auditQuery.limit,
            total: auditResult.total,
            totalPages: Math.ceil(auditResult.total / auditQuery.limit)
          },
          summary
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve security events: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Extract relevant details from audit log for security event display
   */
  private extractSecurityEventDetails(log: any): string {
    const details: string[] = [];

    // Extract common security-relevant information
    if (log.metadata) {
      if (log.metadata.reason) details.push(`Reason: ${log.metadata.reason}`);
      if (log.metadata.outcome) details.push(`Outcome: ${log.metadata.outcome}`);
      if (log.metadata.failureReason) details.push(`Failure: ${log.metadata.failureReason}`);
    }

    // Extract action-specific details
    if (log.action) {
      details.push(`Action: ${log.action}`);
    }

    // Add resource information
    if (log.resourceType && log.resourceId) {
      details.push(`Resource: ${log.resourceType}:${log.resourceId}`);
    }

    return details.length > 0 ? details.join('; ') : log.eventType;
  }

  /**
   * Calculate security event summary statistics
   */
  private calculateSecurityEventSummary(events: any[]): any {
    const summary = {
      totalEvents: events.length,
      byEventType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recentEvents: events.filter(e => {
        const eventTime = new Date(e.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return eventTime > oneDayAgo;
      }).length,
    };

    events.forEach(event => {
      // Count by event type
      summary.byEventType[event.type] = (summary.byEventType[event.type] || 0) + 1;

      // Count by severity
      summary.bySeverity[event.severity] = (summary.bySeverity[event.severity] || 0) + 1;
    });

    return summary;
  }
}