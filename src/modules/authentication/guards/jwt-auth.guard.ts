import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TokenInvalidationService } from '../../../shared/security/token-invalidation.service';

/**
 * Enhanced JWT Authentication Guard
 * Implements JWT validation with token invalidation checking
 * Follows OWASP Top 10 A07: Authentication Failures
 *
 * Features:
 * - JWT token validation
 * - Token blacklist checking
 * - Security event logging
 * - Correlation ID tracking
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenInvalidationService: TokenInvalidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const correlationId = (request as any).correlationId || this.generateCorrelationId();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logSecurityEvent('MISSING_TOKEN', request, correlationId);
      throw new UnauthorizedException({
        message: 'Access token required',
        correlationId,
      });
    }

    try {
      // Check if token is invalidated
      const isInvalid = await this.tokenInvalidationService.isTokenInvalid(token);
      if (isInvalid) {
        this.logSecurityEvent('INVALIDATED_TOKEN_USED', request, correlationId);
        throw new UnauthorizedException({
          message: 'Token has been invalidated',
          correlationId,
        });
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      });

      // Add additional security checks
      await this.validateSecurityRequirements(payload, request, correlationId);

      // Attach enhanced user payload to request
      request['user'] = {
        ...payload,
        correlationId,
        token,
      };

      // Log successful authentication
      this.logSuccessfulAuthentication(payload, request, correlationId);

      return true;
    } catch (error) {
      this.logSecurityEvent('AUTHENTICATION_FAILED', request, correlationId, {
        error: error instanceof Error ? error.message : "Unknown error",
        tokenPrefix: token.substring(0, 10) + '...',
      });

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        message: 'Invalid or expired token',
        correlationId,
      });
    }
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }

  /**
   * Validate additional security requirements
   */
  private async validateSecurityRequirements(
    payload: any,
    request: Request,
    correlationId: string
  ): Promise<void> {
    // Check if user is active
    if (payload.isActive === false) {
      this.logSecurityEvent('INACTIVE_USER_ACCESS_ATTEMPT', request, correlationId, {
        userId: payload.sub,
      });
      throw new UnauthorizedException({
        message: 'User account is inactive',
        correlationId,
      });
    }

    // Check for additional security requirements as needed
    // For example: IP whitelisting, device verification, etc.
  }

  /**
   * Log successful authentication
   */
  private logSuccessfulAuthentication(
    payload: any,
    request: Request,
    correlationId: string
  ): void {
    this.logger.debug(`Authentication successful [${correlationId}]`, {
      correlationId,
      userId: payload.sub,
      userRole: payload.role,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    eventType: string,
    request: Request,
    correlationId: string,
    details?: any
  ): void {
    this.logger.warn(`Security event: ${eventType} [${correlationId}]`, {
      eventType,
      correlationId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /**
   * Generate correlation ID if not present
   */
  private generateCorrelationId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}