import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
  LogoutResponseDto,
  PasswordChangeResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenInvalidationService } from '../../shared/security/token-invalidation.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser, UserProfileResponse } from './interfaces/jwt.interface';

/**
 * Enterprise Authentication Controller
 * Implements comprehensive authentication and authorization endpoints
 * Follows SOLID principles with single responsibility for HTTP handling
 * OWASP A01, A02, A03, A07 compliance for security
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly tokenInvalidationService: TokenInvalidationService,
  ) {}

  /**
   * Register a new user
   * OWASP A03: Input validation and sanitization
   * OWASP A07: Authentication failure handling
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body(ValidationPipe) registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      this.logger.log(`User registration attempt!: ${registerDto.email}`);

      // Additional validation (OWASP A03)
      this.validateRegisterData(registerDto);

      const result = await this.authService.register(registerDto);

      this.logger.log(`User registered successfully!: ${result.user.email}`);

      // Add expiresIn to response
      const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '1h');
      const response = {
        ...result,
        expiresIn: expiresIn === '1h' ? 3600 : parseInt(expiresIn) || 3600,
      };

      return response;

    } catch (error) {
      this.logger.error(`User registration failed: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : 'Unknown error'}`, error instanceof Error ? error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined : undefined);

      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException('Registration failed');
    }
  }

  /**
   * User login
   * OWASP A02: JWT token generation
   * OWASP A07: Authentication failure handling
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body(ValidationPipe) loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      this.logger.log(`Login attempt for!: ${loginDto.email}`);

      const result = await this.authService.login(loginDto);

      this.logger.log(`User logged in successfully!: ${loginDto.email}`);

      // Add expiresIn to response
      const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '1h');
      const response = {
        ...result,
        expiresIn: expiresIn === '1h' ? 3600 : parseInt(expiresIn) || 3600,
      };

      return response;

    } catch (error) {
      this.logger.error(`Login failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Login failed');
    }
  }

  /**
   * Refresh JWT token
   * OWASP A02: Token refresh mechanism
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body(ValidationPipe) refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      this.logger.log('Token refresh attempt');

      const result = await this.authService.refreshToken(refreshTokenDto);

      this.logger.log('Token refreshed successfully');

      // Add expiresIn to response
      const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '1h');
      const response = {
        ...result,
        expiresIn: expiresIn === '1h' ? 3600 : parseInt(expiresIn) || 3600,
      };

      return response;

    } catch (error) {
      this.logger.error(`Token refresh failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Token refresh failed');
    }
  }

  /**
   * Get current user profile
   * OWASP A01: Authorization check
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponse> {
    try {
      this.logger.log(`Profile request for user!: ${user.sub}`);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      };

    } catch (error) {
      this.logger.error(`Profile retrieval failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      throw new InternalServerErrorException('Profile retrieval failed');
    }
  }

  /**
   * Change user password
   * OWASP A02: Password security
   */
  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully', type: PasswordChangeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PasswordChangeResponseDto> {
    try {
      this.logger.log(`Password change attempt for user!: ${user.sub}`);

      const result = await this.authService.changePassword(user.id, changePasswordDto);

      this.logger.log(`Password changed successfully for user!: ${user.sub}`);
      return result;

    } catch (error) {
      this.logger.error(`Password change failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);

      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Password change failed');
    }
  }

  /**
   * Initiate password reset
   * OWASP A07: Password recovery
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent', type: ForgotPasswordResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
    try {
      this.logger.log(`Password reset request!: ${forgotPasswordDto.email}`);

      const result = await this.authService.forgotPassword(forgotPasswordDto);

      this.logger.log(`Password reset email sent to!: ${forgotPasswordDto.email}`);
      return result;

    } catch (error) {
      this.logger.error(`Password reset request failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Password reset request failed');
    }
  }

  /**
   * Reset password with token
   * OWASP A02: Secure password reset
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful', type: ResetPasswordResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    try {
      this.logger.log('Password reset attempt with token');

      await this.authService.resetPassword(resetPasswordDto);

      this.logger.log('Password reset successful');
      return {
        success: true,
        message: 'Password reset successful',
      };

    } catch (error) {
      this.logger.error(`Password reset failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Password reset failed');
    }
  }

  /**
   * User logout with token invalidation
   * OWASP A02: Session management
   * OWASP A07: Authentication failures
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout with token invalidation' })
  @ApiResponse({ status: 200, description: 'Logout successful', type: LogoutResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() body?: { token?: string }): Promise<LogoutResponseDto> {
    try {
      const correlationId = (user as any).correlationId || this.generateCorrelationId();
      this.logger.log(`Logout request for user ${user.sub} [${correlationId}]`);

      // Invalidate the current token (if provided in request)
      if (body?.token) {
        await this.tokenInvalidationService.invalidateToken(
          body.token,
          user.sub,
          'user_logout'
        );
      }

      // Invalidate all user tokens for security
      await this.tokenInvalidationService.invalidateUserTokens(
        user.sub,
        'user_logout'
      );

      this.logger.log(`User ${user.sub} logged out successfully [${correlationId}]`);
      return {
        success: true,
        message: 'Logged out successfully',
      };

    } catch (error) {
      this.logger.error(`Logout failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Logout failed');
    }
  }

  /**
   * Validate JWT token
   * OWASP A01: Token validation
   */
  @Get('validate-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async validateToken(@CurrentUser() user: AuthenticatedUser): Promise<{ valid: boolean; user: UserProfileResponse | undefined }> {
    try {
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
        },
      };

    } catch (error) {
      this.logger.error(`Token validation failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      return {
        valid: false,
        user: undefined,
      };
    }
  }

  /**
   * Validate token (public endpoint)
   * OWASP A01: Token validation without auth guard
   */
  @Post('validate-token')
  @ApiOperation({ summary: 'Validate JWT token (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Token validation result' })
  async validateTokenPublic(@Body() token: { token: string }): Promise<{ valid: boolean; user?: UserProfileResponse }> {
    try {
      this.logger.log('Public token validation attempt');

      const result = await this.authService.validateToken(token.token);

    // Convert Date objects to strings for type compatibility
      if (result.valid && result.user) {
        return {
          valid: result.valid,
          user: {
            ...result.user,
            createdAt: result.user.createdAt instanceof Date
              ? result.user.createdAt.toISOString()
              : result.user.createdAt,
            updatedAt: result.user.updatedAt instanceof Date
              ? result.user.updatedAt.toISOString()
              : result.user.updatedAt,
            lastLoginAt: result.user.lastLoginAt instanceof Date
              ? result.user.lastLoginAt.toISOString()
              : result.user.lastLoginAt || undefined,
          }
        };
      }
      // Type guard to ensure proper return type
      if (result.valid && result.user && typeof result.user.createdAt === 'object' && typeof result.user.updatedAt === 'object') {
        return {
          valid: result.valid,
          user: {
            ...result.user,
            createdAt: result.user.createdAt.toISOString(),
            updatedAt: result.user.updatedAt.toISOString(),
            lastLoginAt: result.user.lastLoginAt?.toISOString() || undefined,
          }
        };
      }
      return result as { valid: boolean; user?: UserProfileResponse | undefined };

    } catch (error) {
      this.logger.error(`Public token validation failed: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      return {
        valid: false,
        user: undefined,
      };
    }
  }

  /**
   * Helper method to validate registration data
   */
  private validateRegisterData(registerDto: RegisterDto): void {
    // Additional business validation beyond class-validator
    if (!registerDto.email || !registerDto.email.includes('@')) {
      throw new BadRequestException('Valid email address is required');
    }

    if (registerDto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    if (!registerDto.firstName || registerDto.firstName.trim().length < 2) {
      throw new BadRequestException('First name is required');
    }

    if (!registerDto.lastName || registerDto.lastName.trim().length < 2) {
      throw new BadRequestException('Last name is required');
    }

    // Email domain validation
    const emailDomain = registerDto.email.split('@')[1];
    if (!emailDomain || emailDomain.length < 3) {
      throw new BadRequestException('Invalid email domain');
    }
  }

  /**
   * Generate correlation ID for logging
   */
  private generateCorrelationId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}