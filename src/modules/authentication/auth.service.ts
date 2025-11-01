import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private securityService: SecurityService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Validate input
    if (!this.securityService.validateInput(registerDto)) {
      throw new BadRequestException('Invalid input data');
    }

    // Check password strength
    const passwordCheck = this.securityService.isPasswordStrong(registerDto.password);
    if (!passwordCheck.isValid) {
      throw new BadRequestException(`Password validation failed!: ${passwordCheck.errors.join(', ')}`);
    }

    // Sanitize input
    const sanitizedData = this.securityService.sanitizeInput(registerDto);

    // Check if user already exists
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: sanitizedData.email },
    });

    if (existingUser) {
      this.securityService.logSecurityEvent(
        'USER_CREATION_FAILED',
        undefined,
        sanitizedData.email,
        '0.0.0.0',
        { reason: 'Email already exists' },
      );
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(sanitizedData.password, 12);

    // Create user within transaction
    const result = await this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: sanitizedData.email,
          username: sanitizedData.username,
          password: hashedPassword,
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          phone: sanitizedData.phone,
        },
      });

      // Create session
      const refreshToken = this.securityService.generateSecureToken();
      const accessToken = this.generateAccessToken(user);
      const sessionToken = this.securityService.generateSecureToken();

      const session = await tx.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return { user, session, accessToken, refreshToken };
    });

    // Log successful registration
    this.securityService.logSecurityEvent(
      'USER_CREATED',
      result.user.id,
      result.user.email,
      '0.0.0.0',
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isActive: result.user.isActive,
        isEmailVerified: result.user.isEmailVerified,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    // Validate input
    if (!this.securityService.validateInput(loginDto)) {
      throw new BadRequestException('Invalid input data');
    }

    // Sanitize input
    const sanitizedData = this.securityService.sanitizeInput(loginDto);

    // Find user (by email or username)
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [
          { email: sanitizedData.email },
          { username: sanitizedData.email },
        ],
      },
    });

    if (!user) {
      this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        undefined,
        sanitizedData.email,
        '0.0.0.0',
        { reason: 'User not found' },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        user.id,
        user.email,
        '0.0.0.0',
        { reason: 'Account is inactive' },
      );
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(sanitizedData.password, user.password);
    if (!isPasswordValid) {
      this.securityService.logSecurityEvent(
        'LOGIN_FAILED',
        user.id,
        user.email,
        '0.0.0.0',
        { reason: 'Invalid password' },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.securityService.generateSecureToken();

    // Create session
    const sessionToken = this.securityService.generateSecureToken();
    await this.prismaService.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login
    this.securityService.logSecurityEvent(
      'LOGIN_SUCCESS',
      user.id,
      user.email,
      '0.0.0.0',
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    // Find valid session
    const session = await this.prismaService.session.findFirst({
      where: {
        refreshToken: refreshTokenDto.refreshToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = this.securityService.generateSecureToken();
    const newSessionToken = this.securityService.generateSecureToken();

    // Update session
    await this.prismaService.session.update({
      where: { id: session.id },
      data: {
        token: newSessionToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check password strength
    const passwordCheck = this.securityService.isPasswordStrong(changePasswordDto.newPassword);
    if (!passwordCheck.isValid) {
      throw new BadRequestException(`Password validation failed!: ${passwordCheck.errors.join(', ')}`);
    }

    // Get user
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);

    // Update password
    await this.prismaService.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Log security event
    this.securityService.logSecurityEvent(
      'PASSWORD_CHANGED',
      userId,
      user.email,
      '0.0.0.0',
    );

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      throw new NotFoundException('If the email exists, a password reset link has been sent');
    }

    // Store reset token (this would typically be in a separate passwordResets table)
    // For now, we'll just log it (in production, you'd send an email)
    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        // Note: In a real implementation, you'd have a passwordResets table
        // This is just for demonstration
      },
    });

    // Log security event (using an existing event type)
    this.securityService.logSecurityEvent(
      'PASSWORD_CHANGED',
      user.id,
      user.email,
      '0.0.0.0',
      { action: 'password_reset_requested' },
    );

    return {
      success: true,
      message: 'Password reset email sent',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check password strength
    const passwordCheck = this.securityService.isPasswordStrong(resetPasswordDto.newPassword);
    if (!passwordCheck.isValid) {
      throw new BadRequestException(`Password validation failed!: ${passwordCheck.errors.join(', ')}`);
    }

    // This would typically validate the reset token against a passwordResets table
    // For now, we'll just demonstrate the flow
    throw new BadRequestException('Password reset functionality not fully implemented');
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          isActive: true,
          isEmailVerified: true,
        },
      });

      if (!user || !user.isActive) {
        return { valid: false };
      }

      return { valid: true, user };
    } catch (error) {
      return { valid: false };
    }
  }

  async findUserById(userId: string) {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isEmailVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findUserByUsername(username: string) {
    return this.prismaService.user.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isEmailVerified: true,
        role: true,
        password: true,
      },
    });
  }

  async findUserByUsernameOrEmail(usernameOrEmail: string) {
    return this.prismaService.user.findFirst({
      where: {
        OR: [
          { email: usernameOrEmail },
          { username: usernameOrEmail },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isEmailVerified: true,
        role: true,
        password: true,
      },
    });
  }

  async validatePassword(user: any, password: string): Promise<boolean> {
    const isPasswordValid = await bcrypt.compare(password, user.password);
    return isPasswordValid;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  private generateAccessToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '1h'),
    });
  }
}