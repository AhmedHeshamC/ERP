import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ProductionErrorFilter } from '../../shared/filters/production-error.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('ProductionErrorFilter', () => {
  let filter: ProductionErrorFilter;
  let configService: ConfigService;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    configService = new ConfigService();
    filter = new ProductionErrorFilter(configService);

    mockResponse = {
      status: (code: number) => ({
        json: (data: any) => {
          mockResponse.lastStatus = code;
          mockResponse.lastJson = data;
        }
      }),
      setHeader: () => {},
    };

    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      ip: '127.0.0.1',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;
  });

  describe('catch', () => {
    it('should handle HttpException with sanitized message', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.lastStatus).to.equal(HttpStatus.BAD_REQUEST);
      expect(mockResponse.lastJson).to.have.property('statusCode', HttpStatus.BAD_REQUEST);
      expect(mockResponse.lastJson).to.have.property('message', 'Test error');
      expect(mockResponse.lastJson).to.have.property('correlationId');
      expect(mockResponse.lastJson).to.have.property('timestamp');
    });

    it('should sanitize database connection strings from error messages', () => {
      const errorMessage = 'Database error: postgresql://user:password@localhost:5432/db';
      const exception = new Error(errorMessage);

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.message).to.not.include('password');
      expect(mockResponse.lastJson.message).to.include('***');
    });

    it('should sanitize file paths from error messages', () => {
      const errorMessage = 'Error at /src/app.module.ts:45:10';
      const exception = new Error(errorMessage);

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.message).to.not.include('.ts');
      expect(mockResponse.lastJson.message).to.include('***');
    });

    it('should sanitize stack traces in production', () => {
      configService.set('NODE_ENV', 'production');
      const exception = new Error('Test error');
      exception.stack = 'Error: Test error\n    at test (/src/app.module.ts:45:10)';

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson).to.not.have.property('stack');
    });

    it('should include stack traces in development', () => {
      configService.set('NODE_ENV', 'development');
      const exception = new Error('Test error');
      exception.stack = 'Error: Test error\n    at test (/src/app.module.ts:45:10)';

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson).to.have.property('stack');
      expect(mockResponse.lastJson.stack).to.include('test');
    });

    it('should handle validation errors with array messages', () => {
      const exception = new HttpException({
        message: ['Field is required', 'Email is invalid'],
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.message).to.include('Field is required');
      expect(mockResponse.lastJson.message).to.include('Email is invalid');
    });

    it('should use correlation ID from request headers', () => {
      mockRequest.headers['x-correlation-id'] = 'test-correlation-123';
      const exception = new Error('Test error');

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.correlationId).to.equal('test-correlation-123');
    });

    it('should generate correlation ID if not provided', () => {
      const exception = new Error('Test error');

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.correlationId).to.be.a('string');
      expect(mockResponse.lastJson.correlationId).to.match(/^err_\d+_[a-z0-9]+$/);
    });

    it('should include path in error response', () => {
      mockRequest.url = '/api/v1/users/123';
      const exception = new Error('Test error');

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.path).to.equal('/api/v1/users/123');
    });

    it('should handle UnauthorizedException with correlation ID', () => {
      const exception = new HttpException({
        message: 'Access token required',
        correlationId: 'auth-123'
      }, HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.statusCode).to.equal(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.lastJson.message).to.include('Access token required');
      expect(mockResponse.lastJson.error).to.equal('Unauthorized');
    });

    it('should sanitize database query details', () => {
      const exception = new Error('SQL error: SELECT * FROM users WHERE password = "test"');

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.message).to.not.include('SELECT');
      expect(mockResponse.lastJson.message).to.not.include('password');
      expect(mockResponse.lastJson.message).to.include('Database query');
    });

    it('should use generic message for highly sensitive errors', () => {
      const exception = new Error('Internal server error at /src/auth/jwt.service.ts:123:45');

      filter.catch(exception, mockHost);

      expect(mockResponse.lastJson.message).to.equal('An unexpected error occurred');
      expect(mockResponse.lastJson.message).to.not.include('.ts');
    });
  });

  describe('error type categorization', () => {
    it('should categorize HTTP status codes correctly', () => {
      const testCases = [
        { status: HttpStatus.BAD_REQUEST, expected: 'Bad Request' },
        { status: HttpStatus.UNAUTHORIZED, expected: 'Unauthorized' },
        { status: HttpStatus.FORBIDDEN, expected: 'Forbidden' },
        { status: HttpStatus.NOT_FOUND, expected: 'Not Found' },
        { status: HttpStatus.CONFLICT, expected: 'Conflict' },
        { status: HttpStatus.TOO_MANY_REQUESTS, expected: 'Too Many Requests' },
        { status: HttpStatus.INTERNAL_SERVER_ERROR, expected: 'Internal Server Error' },
      ];

      testCases.forEach(({ status, expected }) => {
        const exception = new HttpException('Test error', status);
        filter.catch(exception, mockHost);
        expect(mockResponse.lastJson.error).to.equal(expected);
      });
    });
  });
});