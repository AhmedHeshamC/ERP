import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { TokenInvalidationService } from '../../shared/security/token-invalidation.service';
import { ConfigService } from '@nestjs/config';

describe('TokenInvalidationService', () => {
  let service: TokenInvalidationService;
  let configService: ConfigService;
  let mockRedis: Map<string, string>;

  beforeEach(() => {
    // Mock Redis operations
    mockRedis = new Map();

    configService = new ConfigService();
    configService.set('JWT_EXPIRATION_TIME', '3600');
    configService.set('MAX_TOKENS_PER_USER', '5');

    service = new TokenInvalidationService(configService);

    // Override Redis methods with mock implementation
    (service as any).setRedisValue = async (key: string, value: string, ttl: number) => {
      mockRedis.set(key, value);
      // In real Redis, this would expire after ttl seconds
      // For testing, we'll just store the value
    };

    (service as any).getRedisValue = async (key: string) => {
      return mockRedis.get(key) || null;
    };

    (service as any).deleteRedisValue = async (key: string) => {
      mockRedis.delete(key);
    };
  });

  describe('invalidateToken', () => {
    it('should invalidate a token successfully', async () => {
      const token = 'test.jwt.token';
      const userId = 'user-123';

      await service.invalidateToken(token, userId, 'logout');

      const isInvalid = await service.isTokenInvalid(token);
      expect(isInvalid).to.be.true;
    });

    it('should handle token invalidation with different reasons', async () => {
      const token = 'test.jwt.token';
      const userId = 'user-123';

      await service.invalidateToken(token, userId, 'security_action');
      await service.invalidateToken('another.token', userId, 'user_logout');

      expect(await service.isTokenInvalid(token)).to.be.true;
      expect(await service.isTokenInvalid('another.token')).to.be.true;
    });

    it('should throw error when invalidation fails', async () => {
      // Simulate Redis failure
      (service as any).setRedisValue = async () => {
        throw new Error('Redis connection failed');
      };

      try {
        await service.invalidateToken('test.token', 'user-123');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Token invalidation failed');
      }
    });
  });

  describe('isTokenInvalid', () => {
    it('should return false for valid tokens', async () => {
      const token = 'valid.jwt.token';

      const isInvalid = await service.isTokenInvalid(token);
      expect(isInvalid).to.be.false;
    });

    it('should return true for invalidated tokens', async () => {
      const token = 'invalidated.jwt.token';
      await service.invalidateToken(token, 'user-123');

      const isInvalid = await service.isTokenInvalid(token);
      expect(isInvalid).to.be.true;
    });

    it('should handle Redis failures gracefully', async () => {
      // Simulate Redis failure
      (service as any).getRedisValue = async () => {
        throw new Error('Redis connection failed');
      };

      const token = 'test.jwt.token';
      const isInvalid = await service.isTokenInvalid(token);

      // Should fail open - if Redis is unavailable, assume token is valid
      expect(isInvalid).to.be.false;
    });
  });

  describe('invalidateUserTokens', () => {
    it('should invalidate all user tokens', async () => {
      const userId = 'user-123';
      const tokens = ['token1', 'token2', 'token3'];

      // Register tokens for user
      for (const token of tokens) {
        await service.registerToken(token, userId);
      }

      // Invalidate all user tokens
      await service.invalidateUserTokens(userId, 'security_action');

      // Check all tokens are invalidated
      for (const token of tokens) {
        expect(await service.isTokenInvalid(token)).to.be.true;
      }
    });

    it('should blacklist user when tokens are invalidated', async () => {
      const userId = 'user-123';

      await service.invalidateUserTokens(userId, 'security_action');

      const userBlacklistKey = `user_blacklist:${userId}`;
      expect(mockRedis.has(userBlacklistKey)).to.be.true;
    });

    it('should handle user with no active sessions', async () => {
      const userId = 'user-with-no-sessions';

      // Should not throw error
      await service.invalidateUserTokens(userId, 'security_action');
    });
  });

  describe('registerToken', () => {
    it('should register a new token for user', async () => {
      const token = 'new.jwt.token';
      const userId = 'user-123';
      const sessionInfo = { ip: '127.0.0.1', userAgent: 'test-agent' };

      await service.registerToken(token, userId, sessionInfo);

      const sessionKey = `user_sessions:${userId}`;
      const sessionData = JSON.parse(mockRedis.get(sessionKey) || '{}');

      expect(sessionData.tokens).to.include(token);
      expect(sessionData.sessionInfo).to.deep.equal(sessionInfo);
    });

    it('should limit number of active tokens per user', async () => {
      const userId = 'user-123';
      const maxTokens = 5; // From config

      // Register maximum + 1 tokens
      for (let i = 0; i < maxTokens + 1; i++) {
        await service.registerToken(`token-${i}`, userId);
      }

      const sessionKey = `user_sessions:${userId}`;
      const sessionData = JSON.parse(mockRedis.get(sessionKey) || '{}');

      // Should only keep the maximum number of tokens
      expect(sessionData.tokens).to.have.length(maxTokens);
    });

    it('should update last activity when registering token', async () => {
      const token = 'new.jwt.token';
      const userId = 'user-123';

      await service.registerToken(token, userId);

      const sessionKey = `user_sessions:${userId}`;
      const sessionData = JSON.parse(mockRedis.get(sessionKey) || '{}');

      expect(sessionData.lastActivity).to.be.a('string');
      expect(sessionData.lastActivity).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions with valid tokens', async () => {
      const userId = 'user-123';
      const validToken = 'valid.token';
      const invalidToken = 'invalid.token';

      // Register tokens
      await service.registerToken(validToken, userId);
      await service.registerToken(invalidToken, userId);

      // Invalidate one token
      await service.invalidateToken(invalidToken, userId);

      const sessions = await service.getUserSessions(userId);

      expect(sessions).to.not.be.null;
      expect(sessions.activeTokenCount).to.equal(1);
      expect(sessions.tokens).to.include(validToken);
      expect(sessions.tokens).to.not.include(invalidToken);
    });

    it('should return null for user with no sessions', async () => {
      const sessions = await service.getUserSessions('non-existent-user');

      expect(sessions).to.be.null;
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should complete cleanup without errors', async () => {
      // Redis handles TTL automatically, so this method mainly logs
      await service.cleanupExpiredTokens();
      // Should not throw any errors
    });
  });

  describe('JWT TTL extraction', () => {
    it('should extract TTL from valid JWT payload', async () => {
      // Create a mock JWT payload
      const payload = {
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
      };

      const token = `header.${btoa(JSON.stringify(payload))}.signature`;
      const userId = 'user-123';

      await service.invalidateToken(token, userId);

      const isInvalid = await service.isTokenInvalid(token);
      expect(isInvalid).to.be.true;
    });

    it('should use default TTL for malformed tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      const userId = 'user-123';

      await service.invalidateToken(invalidToken, userId);

      const isInvalid = await service.isTokenInvalid(invalidToken);
      expect(isInvalid).to.be.true;
    });
  });
});