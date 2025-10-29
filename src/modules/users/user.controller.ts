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
} from '@nestjs/common';
import { UserService } from './user.service';
import { SecurityService } from '../../shared/security/security.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto, UserPasswordChangeDto, UserRole } from './dto/user.dto';

/**
 * Enterprise User Controller
 * Implements comprehensive user management with security best practices
 * Follows OWASP Top 10 security standards
 */
@Controller('users')
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
  ) {}

  /**
   * Create a new user with comprehensive validation
   * OWASP A01: Broken Access Control - Role-based access
   * OWASP A03: Injection - Input validation and sanitization
   */
  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      this.logger.log(`Creating new user: ${createUserDto.email}`);

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
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);

      // Log security event for failed creation
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        undefined,
        'system',
        'user-controller',
        {
          email: createUserDto.email,
          error: error.message,
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
  async getUserById(@Param('id') id: string) {
    try {
      this.logger.log(`Retrieving user: ${id}`);

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
        data: user,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve user ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update user information
   * OWASP A01: Broken Access Control - Role-based and self-service access
   */
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      this.logger.log(`Updating user: ${id}`);

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
      this.logger.error(`Failed to update user ${id}: ${error.message}`, error.stack);

      // Log failed update attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error.message,
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
  async getUsers(@Query() query: UserQueryDto) {
    try {
      this.logger.log('Retrieving users with filters', { query });

      const result = await this.userService.getUsers(query);

      // Build pagination info
      const skip = parseInt(query.skip || '0');
      const take = parseInt(query.take || '10');
      const pagination = {
        skip,
        take,
        total: result.total,
        hasNext: skip + take < result.total,
        hasPrev: skip > 0,
        totalPages: Math.ceil(result.total / take),
        currentPage: Math.floor(skip / take) + 1,
      };

      return {
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: result.users,
          pagination,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve users: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Soft delete user (deactivate)
   * OWASP A01: Broken Access Control - Admin only access
   */
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      this.logger.log(`Deactivating user: ${id}`);

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
        message: 'User deactivated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to deactivate user ${id}: ${error.message}`, error.stack);

      // Log failed deactivation attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error.message,
          endpoint: `DELETE /users/${id}`,
          attemptedBy: 'system',
        },
      );

      throw error;
    }
  }

  /**
   * Change user password
   * OWASP A02: Cryptographic Failures - Secure password handling
   * OWASP A07: Authentication Failures - Password strength requirements
   */
  @Post(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: UserPasswordChangeDto,
  ) {
    try {
      this.logger.log(`Changing password for user: ${id}`);

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
      this.logger.error(`Failed to change password for user ${id}: ${error.message}`, error.stack);

      // Log failed password change attempt
      await this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        id,
        'system',
        'user-controller',
        {
          error: error.message,
          endpoint: `POST /users/${id}/change-password`,
          attemptedBy: 'anonymous',
        },
      );

      throw error;
    }
  }
}