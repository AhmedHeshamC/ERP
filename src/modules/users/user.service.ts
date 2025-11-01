import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import { CreateUserDto, UpdateUserDto, UserResponse, UserQueryDto, UserPasswordChangeDto, validatePasswordConfirmation } from './dto/user.dto';
import { Logger } from '@nestjs/common';

/**
 * Enterprise User Service
 * Implements SOLID principles, OWASP security standards, and clean architecture
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new user with comprehensive security validation
   * Follows OWASP A01, A03, A07 security requirements
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponse> {
    // Input validation and sanitization (OWASP A03)
    if (!this.securityService.validateInput(createUserDto)) {
      await this.securityService.logSecurityEvent(
        'USER_CREATION_FAILED',
        undefined,
        'system',
        'user-service',
        { reason: 'Invalid input data', email: createUserDto.email },
      );
      throw new BadRequestException('Invalid input data');
    }

    const sanitizedData = this.securityService.sanitizeInput(createUserDto) as CreateUserDto;

    // Password strength validation (OWASP A07)
    const passwordValidation = this.securityService.isPasswordStrong(sanitizedData.password);
    if (!passwordValidation.isValid) {
      await this.securityService.logSecurityEvent(
        'WEAK_PASSWORD_ATTEMPT',
        undefined,
        'system',
        'user-service',
        {
          email: sanitizedData.email,
          reason: 'Password too weak',
          errors: passwordValidation.errors
        },
      );
      throw new BadRequestException(
        `Password does not meet security requirements: ${passwordValidation.errors.join(', ')}`,
      );
    }

    // Check for existing user (OWASP A01) - Moved outside try-catch to let ConflictException propagate
    const existingUser = await this.prismaService.user.findFirst({
      where: {
        OR: [
          { email: sanitizedData.email },
          { username: sanitizedData.username },
        ],
      },
    });

    if (existingUser) {
      const conflictReason = existingUser.email === sanitizedData.email ? 'email already exists' : 'username already exists';
      await this.securityService.logSecurityEvent(
        'USER_CREATION_FAILED',
        undefined,
        'system',
        'user-service',
        { reason: 'User already exists', email: sanitizedData.email, conflictReason },
      );
      throw new ConflictException(`User with ${conflictReason}`);
    }

    try {
      // Hash password securely using Argon2
      const hashedPassword = await this.securityService.hashPassword(sanitizedData.password);

      // Create user in database transaction
      const newUser = await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            ...sanitizedData,
            password: hashedPassword,
          },
        });

        // Remove sensitive data from response
        const { password: _password, ...userResponse } = user;
        return userResponse as UserResponse;
      });

      // Log successful user creation (OWASP A09)
      await this.securityService.logSecurityEvent(
        'USER_CREATED',
        newUser.id,
        'system',
        'user-service',
        {
          email: sanitizedData.email,
          username: sanitizedData.username,
          role: sanitizedData.role
        },
      );

      this.logger.log(`User created successfully!: ${newUser.email} (${newUser.id})`);
      return newUser;

    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      // Handle Prisma unique constraint violations
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const target = (error as { meta?: { target?: string[] } }).meta?.target || [];
        const conflictField = target.includes('email') ? 'email' : 'username';

        await this.securityService.logSecurityEvent(
          'USER_CREATION_FAILED',
          undefined,
          'system',
          'user-service',
          {
            reason: `User with ${conflictField} already exists`,
            email: createUserDto.email,
            conflictField
          },
        );
        throw new ConflictException(`User with ${conflictField} already exists`);
      }

      this.logger.error(`Failed to create user: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      await this.securityService.logSecurityEvent(
        'USER_CREATION_ERROR',
        undefined,
        'system',
        'user-service',
        { error: error instanceof Error ? error.message : "Unknown error", email: createUserDto.email },
      );
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  /**
   * Find user by ID with security considerations
   * Excludes sensitive information from response
   */
  async findById(id: string): Promise<UserResponse> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id, isActive: true },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          // Explicitly exclude sensitive fields
          password: false,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      return user as UserResponse;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to find user by ID: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  /**
   * Find user by email or username
   */
  async findByEmailOrUsername(identifier: string): Promise<UserResponse | null> {
    try {
      const user = await this.prismaService.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier },
          ],
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      return user as UserResponse | null;
    } catch (error) {
      this.logger.error(`Failed to find user by email/username: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  /**
   * Update user with validation and security logging
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    try {
      // Input validation
      if (!this.securityService.validateInput(updateUserDto)) {
        throw new BadRequestException('Invalid input data');
      }

      // Check if user exists
      await this.findById(id);

      // Sanitize input
      const sanitizedData = this.securityService.sanitizeInput(updateUserDto) as UpdateUserDto;

      // Update user
      const updatedUser = await this.prismaService.user.update({
        where: { id },
        data: sanitizedData,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      // Log security event
      await this.securityService.logSecurityEvent(
        'USER_UPDATED',
        id,
        'system',
        'user-service',
        { updatedFields: Object.keys(sanitizedData) },
      );

      this.logger.log(`User updated successfully!: ${updatedUser.email} (${id})`);
      return updatedUser as UserResponse;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update user: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Change user password with comprehensive validation
   */
  async changePassword(id: string, passwordChangeDto: UserPasswordChangeDto): Promise<{ success: boolean }> {
    try {
      // Validate password confirmation
      if (!validatePasswordConfirmation(passwordChangeDto)) {
        throw new BadRequestException('New password and confirmation do not match');
      }

      // Get current user
      const currentUser = await this.prismaService.user.findUnique({
        where: { id },
        select: { password: true, email: true },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      // Verify current password using Argon2
      const isCurrentPasswordValid = await this.securityService.verifyPassword(
        passwordChangeDto.currentPassword,
        currentUser.password,
      );

      if (!isCurrentPasswordValid) {
        await this.securityService.logSecurityEvent(
          'INVALID_PASSWORD_CHANGE_ATTEMPT',
          id,
          'system',
          'user-service',
          { reason: 'Current password is incorrect' },
        );
        throw new BadRequestException('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = this.securityService.isPasswordStrong(passwordChangeDto.newPassword);
      if (!passwordValidation.isValid) {
        throw new BadRequestException(
          `New password does not meet security requirements: ${passwordValidation.errors.join(', ')}`,
        );
      }

      // Hash new password using Argon2
      const hashedNewPassword = await this.securityService.hashPassword(passwordChangeDto.newPassword);

      // Update password
      await this.prismaService.user.update({
        where: { id },
        data: { password: hashedNewPassword },
      });

      // Log successful password change
      await this.securityService.logSecurityEvent(
        'PASSWORD_CHANGED',
        id,
        'system',
        'user-service',
        { timestamp: new Date().toISOString() },
      );

      this.logger.log(`Password changed successfully for user!: ${currentUser.email} (${id})`);
      return { success: true };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to change password: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to change password');
    }
  }

  /**
   * Get users with filtering and pagination
   */
  async getUsers(query: UserQueryDto = {}): Promise<{ users: UserResponse[]; total: number }> {
    try {
      const { role, isActive, search, skip = '0', take = '10', sortBy, sortOrder } = query;

      const where: Record<string, unknown> = {};

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Build sort order
      let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
      if (sortBy) {
        const allowedSortFields = ['email', 'username', 'firstName', 'lastName', 'createdAt', 'updatedAt'];
        if (allowedSortFields.includes(sortBy)) {
          const direction = sortOrder === 'desc' ? 'desc' : 'asc';
          orderBy = { [sortBy]: direction };
        }
      }

      const [users, total] = await Promise.all([
        this.prismaService.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
          skip: parseInt(skip),
          take: Math.min(parseInt(take), 100), // Limit maximum results
          orderBy,
        }),
        this.prismaService.user.count({ where }),
      ]);

      return { users: users as UserResponse[], total };
    } catch (error) {
      this.logger.error(`Failed to get users: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve users');
    }
  }

  /**
   * Soft delete user (maintain audit trail)
   */
  async softDeleteUser(id: string): Promise<{ success: boolean }> {
    try {
      const user = await this.findById(id);

      await this.prismaService.user.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });

      await this.securityService.logSecurityEvent(
        'USER_DEACTIVATED',
        id,
        'system',
        'user-service',
        { email: user.email },
      );

      this.logger.log(`User deactivated!: ${user.email} (${id})`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to deactivate user: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to deactivate user');
    }
  }
}