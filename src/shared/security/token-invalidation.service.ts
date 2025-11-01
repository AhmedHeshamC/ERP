import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Token Invalidation Service
 * Manages JWT token invalidation using Redis-based blacklisting
 * Follows OWASP Top 10 A07: Authentication Failures
 *
 * Features:
 * - Redis-based token blacklisting
 * - Automatic token expiration cleanup
 * - Session-based invalidation
 * - User logout functionality
 * - Security event logging
 */
@Injectable()
export class TokenInvalidationService {
  private readonly logger = new Logger(TokenInvalidationService.name);
  private readonly redisPrefix = 'token_blacklist:';
  private readonly sessionPrefix = 'user_sessions:';
  private readonly defaultTtl: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtl = this.configService.get<number>('JWT_EXPIRATION_TIME', 3600); // 1 hour default
  }

  /**
   * Invalidate a specific token
   * @param token - JWT token to invalidate
   * @param userId - User ID for audit logging
   * @param reason - Reason for invalidation
   */
  async invalidateToken(token: string, userId?: string, reason: string = 'logout'): Promise<void> {
    try {
      // Extract token expiration time from JWT payload
      const ttl = await this.getTokenTtl(token);

      // Add token to blacklist
      const key = this.redisPrefix + token;
      await this.setRedisValue(key, '1', ttl);

      // Log security event
      this.logger.log(`Token invalidated [${reason}]`, {
        userId,
        reason,
        tokenPrefix: token.substring(0, 10) + '...',
        timestamp: new Date().toISOString(),
      });

      // Log security event for audit
      await this.logSecurityEvent('TOKEN_INVALIDATED', userId, 'token-invalidation-service', {
        reason,
        tokenPrefix: token.substring(0, 10) + '...',
        ttl,
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate token: ${error instanceof Error ? error.message : "Unknown error"}`, error);
      throw new Error('Token invalidation failed');
    }
  }

  /**
   * Check if a token is invalidated
   * @param token - JWT token to check
   */
  async isTokenInvalid(token: string): Promise<boolean> {
    try {
      const key = this.redisPrefix + token;
      const result = await this.getRedisValue(key);
      return result === '1';
    } catch (error) {
      this.logger.error(`Failed to check token validity: ${error instanceof Error ? error.message : "Unknown error"}`, error);
      // If Redis is unavailable, assume token is valid (fail open)
      return false;
    }
  }

  /**
   * Invalidate all tokens for a user
   * @param userId - User ID whose tokens should be invalidated
   * @param reason - Reason for invalidation
   */
  async invalidateUserTokens(userId: string, reason: string = 'security_action'): Promise<void> {
    try {
      // Get all active sessions for user
      const sessionKey = this.sessionPrefix + userId;
      const sessions = await this.getRedisValue(sessionKey);

      if (sessions) {
        const sessionData = JSON.parse(sessions);
        const tokens = sessionData.tokens || [];

        // Invalidate each token
        const invalidationPromises = tokens.map((token: string) =>
          this.invalidateToken(token, userId, reason)
        );

        await Promise.all(invalidationPromises);

        // Clear user sessions
        await this.deleteRedisValue(sessionKey);
      }

      // Add user to blacklist (prevents new token issuance)
      const userBlacklistKey = `user_blacklist:${userId}`;
      await this.setRedisValue(userBlacklistKey, '1', this.defaultTtl);

      this.logger.log(`All tokens invalidated for user ${userId} [${reason}]`, {
        userId,
        reason,
        timestamp: new Date().toISOString(),
      });

      // Log security event
      const tokensCount = sessions ? (JSON.parse(sessions)).tokens?.length || 0 : 0;
      await this.logSecurityEvent('USER_TOKENS_INVALIDATED', userId, 'token-invalidation-service', {
        reason,
        invalidatedCount: tokensCount,
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate user tokens: ${error instanceof Error ? error.message : "Unknown error"}`, error);
      throw new Error('User token invalidation failed');
    }
  }

  /**
   * Register a new token for session tracking
   * @param token - JWT token
   * @param userId - User ID
   * @param sessionInfo - Additional session information
   */
  async registerToken(token: string, userId: string, sessionInfo?: any): Promise<void> {
    try {
      const sessionKey = this.sessionPrefix + userId;
      const existingSessions = await this.getRedisValue(sessionKey);

      let sessionData: any = {
        userId,
        tokens: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };

      if (existingSessions) {
        sessionData = JSON.parse(existingSessions);
      }

      // Add new token
      sessionData.tokens.push(token);
      sessionData.lastActivity = new Date().toISOString();

      // Add session info if provided
      if (sessionInfo) {
        sessionData.sessionInfo = sessionInfo;
      }

      // Limit number of active tokens per user (prevent abuse)
      const maxTokens = this.configService.get<number>('MAX_TOKENS_PER_USER', 5);
      if (sessionData.tokens.length > maxTokens) {
        // Remove oldest tokens
        const tokensToInvalidate = sessionData.tokens.splice(0, sessionData.tokens.length - maxTokens);
        for (const oldToken of tokensToInvalidate) {
          await this.invalidateToken(oldToken, userId, 'token_limit_exceeded');
        }
      }

      // Update session data
      await this.setRedisValue(sessionKey, JSON.stringify(sessionData), this.defaultTtl);

      this.logger.debug(`Token registered for user ${userId}`, {
        userId,
        tokenPrefix: token.substring(0, 10) + '...',
        activeTokens: sessionData.tokens.length,
      });
    } catch (error) {
      this.logger.error(`Failed to register token: ${error instanceof Error ? error.message : "Unknown error"}`, error);
      throw new Error('Token registration failed');
    }
  }

  /**
   * Get active sessions for a user
   * @param userId - User ID
   */
  async getUserSessions(userId: string): Promise<any> {
    try {
      const sessionKey = this.sessionPrefix + userId;
      const sessions = await this.getRedisValue(sessionKey);

      if (!sessions) {
        return null;
      }

      const sessionData = JSON.parse(sessions);

      // Filter out invalidated tokens
      const validTokens = [];
      for (const token of sessionData.tokens) {
        if (!(await this.isTokenInvalid(token))) {
          validTokens.push(token);
        }
      }

      return {
        ...sessionData,
        tokens: validTokens,
        activeTokenCount: validTokens.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get user sessions: ${error instanceof Error ? error.message : "Unknown error"}`, error);
      return null;
    }
  }

  /**
   * Clean up expired tokens and sessions
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Redis automatically expires keys with TTL
      // This method can be used for additional cleanup if needed

      this.logger.debug('Token cleanup completed', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Token cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`, error);
    }
  }

  /**
   * Extract TTL from JWT token
   * @param token - JWT token
   */
  private async getTokenTtl(token: string): Promise<number> {
    try {
      // Decode JWT payload (without verification for TTL extraction)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp;
      const currentTime = Math.floor(Date.now() / 1000);

      if (expirationTime && expirationTime > currentTime) {
        return expirationTime - currentTime;
      }

      return this.defaultTtl;
    } catch (error) {
      this.logger.warn(`Failed to extract TTL from token: ${error instanceof Error ? error.message : "Unknown error"}`);
      return this.defaultTtl;
    }
  }

  /**
   * Log security event
   * @param eventType - Type of security event
   * @param userId - User ID
   * @param source - Source of the event
   * @param details - Additional event details
   */
  private async logSecurityEvent(
    eventType: string,
    userId: string | undefined,
    source: string,
    details: any
  ): Promise<void> {
    this.logger.log(`Security event: ${eventType}`, {
      eventType,
      userId,
      source,
      details,
      timestamp: new Date().toISOString(),
    });

    // In a production environment, you would send this to a security event system
    // For now, we just log it
  }

  // Redis operation methods (to be implemented based on your Redis setup)
  private async setRedisValue(key: string, value: string, ttl: number): Promise<void> {
    // This should be implemented with your Redis client
    // Example implementation:
    // await this.redis.setex(key, ttl, value);

    // For now, simulate Redis operations (replace with actual Redis client)
    console.log(`Redis SETEX ${key} ${ttl} ${value}`);
  }

  private async getRedisValue(key: string): Promise<string | null> {
    // This should be implemented with your Redis client
    // Example implementation:
    // return await this.redis.get(key);

    // For now, simulate Redis operations (replace with actual Redis client)
    console.log(`Redis GET ${key}`);
    return null;
  }

  private async deleteRedisValue(key: string): Promise<void> {
    // This should be implemented with your Redis client
    // Example implementation:
    // await this.redis.del(key);

    // For now, simulate Redis operations (replace with actual Redis client)
    console.log(`Redis DEL ${key}`);
  }
}