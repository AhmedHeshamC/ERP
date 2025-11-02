import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '../../shared/common/interceptors/api-response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { expect } from 'chai';
import Sinon = require('sinon');

describe('ApiResponseInterceptor', () => {
  let interceptor: ApiResponseInterceptor;
  let sandbox: Sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = Sinon.createSandbox();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ApiResponseInterceptor,
          useFactory: () => new ApiResponseInterceptor({}),
        },
      ],
    }).compile();

    interceptor = module.get<ApiResponseInterceptor>(ApiResponseInterceptor);
  });

  afterEach(() => {
    sandbox.restore();
  });

  const createMockContext = (correlationId?: string) => {
    const request = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'user-agent': 'test-agent',
        'x-correlation-id': correlationId,
      },
      ip: '127.0.0.1',
    };

    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      get: sandbox.stub().returns('application/json'),
    };

    const mockContext = {
      switchToHttp: sandbox.stub().returns({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    return { mockContext, request, response };
  };

  describe('Basic Response Formatting', () => {
    it('should format simple object responses', async () => {
      const { mockContext } = createMockContext('test-correlation-123');
      const testData = { id: 1, name: 'Test Data' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('data', testData);
      expect(result).to.have.property('message', 'Data retrieved successfully');
      expect(result).to.have.property('metadata');
      expect(result.metadata).to.have.property('requestId', 'test-correlation-123');
      expect(result.metadata).to.have.property('timestamp');
    });

    it('should generate correlation ID when not provided', async () => {
      const { mockContext } = createMockContext();
      const testData = { test: 'value' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('requestId');
      expect(result.metadata.requestId).to.match(/^resp_\d+_[a-z0-9]+$/);
    });

    it('should include performance timing when enabled', async () => {
      const options = { includePerformance: true };
      const interceptorWithOptions = new ApiResponseInterceptor(options);

      const { mockContext } = createMockContext('perf-test');
      const testData = { test: 'value' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptorWithOptions.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('processingTime');
      expect(result.metadata.processingTime).to.be.a('number');
      expect(result.metadata.processingTime).to.be.at.least(0);
    });

    it('should include API version in metadata', async () => {
      process.env.API_VERSION = '2.1.0';

      const { mockContext } = createMockContext('version-test');
      const testData = { test: 'value' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('version', '2.1.0');

      delete process.env.API_VERSION;
    });
  });

  describe('Message Generation', () => {
    it('should generate appropriate messages based on HTTP method', async () => {
      const testCases = [
        { method: 'POST', expectedMessage: 'Resource created successfully' },
        { method: 'PUT', expectedMessage: 'Resource updated successfully' },
        { method: 'PATCH', expectedMessage: 'Resource updated successfully' },
        { method: 'DELETE', expectedMessage: 'Resource deleted successfully' },
        { method: 'GET', expectedMessage: 'Data retrieved successfully' },
        { method: 'GET', url: '/api/search', expectedMessage: 'Search completed successfully' },
      ];

      for (const testCase of testCases) {
        const { mockContext, request } = createMockContext();
        request.method = testCase.method;
        if (testCase.url) {
          request.url = testCase.url;
        }

        const mockCallHandler: CallHandler = {
          handle: () => of({ test: 'value' }),
        };

        const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
        const result = await result$.toPromise();

        expect(result.message).to.equal(testCase.expectedMessage);
      }
    });

    it('should preserve existing message in data', async () => {
      const { mockContext } = createMockContext();
      const testData = { id: 1, message: 'Custom success message' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.message).to.equal('Custom success message');
    });
  });

  describe('Paginated Response Handling', () => {
    it('should format paginated responses', async () => {
      const { mockContext } = createMockContext('pagination-test');
      const paginatedData = {
        data: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(paginatedData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('data', paginatedData.data);
      expect(result).to.have.property('pagination', paginatedData.pagination);
      expect(result).to.have.property('message', 'Data retrieved successfully');
      expect(result.metadata).to.have.property('requestId', 'pagination-test');
    });

    it('should handle items-based pagination', async () => {
      const { mockContext } = createMockContext();
      const paginatedData = {
        items: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, limit: 10 },
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(paginatedData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('data', paginatedData.items);
      expect(result).to.have.property('pagination', paginatedData.pagination);
    });

    it('should handle simple pagination indicators', async () => {
      const { mockContext } = createMockContext();
      const paginatedData = {
        total: 50,
        page: 2,
        data: [{ id: 1 }, { id: 2 }],
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(paginatedData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('data', paginatedData.data);
      expect(result).to.have.property('pagination');
    });
  });

  describe('Bulk Operation Response Handling', () => {
    it('should format bulk operation responses', async () => {
      const { mockContext } = createMockContext('bulk-test');
      const bulkData = {
        successful: [{ id: 1 }, { id: 2 }],
        failed: [
          { item: { id: 3 }, error: 'Validation failed', index: 2 },
        ],
        total: 3,
        successfulCount: 2,
        failedCount: 1,
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(bulkData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('data');
      expect(result.data).to.have.property('successful');
      expect(result.data).to.have.property('failed');
      expect(result.data).to.have.property('summary');
      expect(result.metadata).to.have.property('requestId', 'bulk-test');
    });

    it('should handle minimal bulk operation data', async () => {
      const { mockContext } = createMockContext();
      const bulkData = {
        successful: [],
        failed: [],
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(bulkData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.data.successful).to.be.an('array');
      expect(result.data.failed).to.be.an('array');
      expect(result.data.summary).to.be.an('object');
    });
  });

  describe('File Response Handling', () => {
    it('should format file responses', async () => {
      const { mockContext } = createMockContext('file-test');
      const fileData = {
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test content'),
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(fileData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('data', fileData);
      expect(result).to.have.property('message', 'File processed successfully');
      expect(result.metadata).to.have.property('requestId', 'file-test');
    });

    it('should handle filename-based file responses', async () => {
      const { mockContext } = createMockContext();
      const fileData = { filename: 'test.txt' };

      const mockCallHandler: CallHandler = {
        handle: () => of(fileData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.data).to.deep.equal(fileData);
      expect(result.message).to.include('File');
    });
  });

  describe('Error Response Handling', () => {
    it('should preserve error responses', async () => {
      const { mockContext } = createMockContext('error-test');
      const errorData = {
        success: false,
        message: 'Something went wrong',
        errors: [{ code: 'ERROR_CODE', message: 'Detailed error' }],
        errorCode: 'OPERATION_FAILED',
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(errorData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('message', 'Something went wrong');
      expect(result).to.have.property('errors');
      expect(result).to.have.property('errorCode', 'OPERATION_FAILED');
      expect(result.metadata).to.have.property('requestId', 'error-test');
    });

    it('should handle status-code based errors', async () => {
      const { mockContext } = createMockContext();
      const errorData = {
        statusCode: 404,
        message: 'Not found',
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(errorData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.success).to.be.false;
      expect(result.message).to.include('Not found');
    });
  });

  describe('Skip Formatting', () => {
    it('should skip formatting for already formatted responses', async () => {
      const { mockContext } = createMockContext();
      const alreadyFormatted = {
        success: true,
        data: { test: 'value' },
        message: 'Already formatted',
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: 'existing-id',
        },
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(alreadyFormatted),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.equal(alreadyFormatted); // Should be the exact same object
    });

    it('should skip formatting for file downloads', async () => {
      const { mockContext, response } = createMockContext();
      response.headers['content-type'] = 'application/octet-stream';
      response.headers['content-disposition'] = 'attachment; filename="test.pdf"';

      const fileData = Buffer.from('file content');
      const mockCallHandler: CallHandler = {
        handle: () => of(fileData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.equal(fileData); // Should be the exact same Buffer
    });

    it('should skip formatting for binary data', async () => {
      const { mockContext } = createMockContext();
      const binaryData = Buffer.from('binary content');

      const mockCallHandler: CallHandler = {
        handle: () => of(binaryData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.equal(binaryData);
    });

    it('should skip formatting for streams', async () => {
      const { mockContext } = createMockContext();
      const streamData = {
        pipe: sandbox.stub(),
        readable: true,
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(streamData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result).to.equal(streamData);
    });
  });

  describe('Response Sanitization', () => {
    it('should sanitize sensitive fields when enabled', async () => {
      const options = { sanitizeResponses: true };
      const interceptorWithSanitization = new ApiResponseInterceptor(options);

      const { mockContext } = createMockContext('sanitize-test');
      const sensitiveData = {
        id: 1,
        name: 'John Doe',
        password: 'secret123',
        token: 'abc123token',
        apiKey: 'secret-key',
        nested: {
          credential: 'hidden-credential',
          safe: 'safe-value',
        },
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(sensitiveData),
      };

      const result$ = interceptorWithSanitization.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.data.password).to.equal('***');
      expect(result.data.token).to.equal('***');
      expect(result.data.apiKey).to.equal('***');
      expect(result.data.nested.credential).to.equal('***');
      expect(result.data.nested.safe).to.equal('safe-value');
      expect(result.data.name).to.equal('John Doe');
    });

    it('should not sanitize when disabled', async () => {
      const options = { sanitizeResponses: false };
      const interceptorWithoutSanitization = new ApiResponseInterceptor(options);

      const { mockContext } = createMockContext();
      const sensitiveData = {
        password: 'secret123',
        token: 'abc123token',
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(sensitiveData),
      };

      const result$ = interceptorWithoutSanitization.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.data.password).to.equal('secret123');
      expect(result.data.token).to.equal('abc123token');
    });
  });

  describe('Request Details', () => {
    it('should include request details when enabled', async () => {
      const options = { includeRequestDetails: true };
      const interceptorWithDetails = new ApiResponseInterceptor(options);

      const { mockContext, request } = createMockContext('details-test');
      request.headers['user-agent'] = 'Mozilla/5.0 (Test Browser) test@example.com';

      const mockCallHandler: CallHandler = {
        handle: () => of({ test: 'value' }),
      };

      const result$ = interceptorWithDetails.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('method', 'GET');
      expect(result.metadata).to.have.property('path', '/api/test');
      expect(result.metadata).to.have.property('userAgent');
      expect(result.metadata.userAgent).to.include('***@***.***'); // Email should be sanitized
    });

    it('should not include request details when disabled', async () => {
      const options = { includeRequestDetails: false };
      const interceptorWithoutDetails = new ApiResponseInterceptor(options);

      const { mockContext } = createMockContext();

      const mockCallHandler: CallHandler = {
        handle: () => of({ test: 'value' }),
      };

      const result$ = interceptorWithoutDetails.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.not.have.property('method');
      expect(result.metadata).to.not.have.property('path');
      expect(result.metadata).to.not.have.property('userAgent');
    });
  });

  describe('Error Handling', () => {
    it('should handle formatting errors gracefully', async () => {
      const { mockContext } = createMockContext('error-handling-test');

      // Create an object that might cause formatting issues
      const problematicData = {
        get: () => { throw new Error('Access denied'); },
        valueOf: () => { throw new Error('Conversion failed'); },
      };

      const mockCallHandler: CallHandler = {
        handle: () => of(problematicData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      // Should fallback to original data if formatting fails
      expect(result).to.equal(problematicData);
    });
  });

  describe('Environment Configuration', () => {
    it('should include environment in metadata', async () => {
      process.env.NODE_ENV = 'test';

      const { mockContext } = createMockContext('env-test');
      const testData = { test: 'value' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('environment', 'test');

      delete process.env.NODE_ENV;
    });

    it('should default environment to development', async () => {
      delete process.env.NODE_ENV;

      const { mockContext } = createMockContext();
      const testData = { test: 'value' };

      const mockCallHandler: CallHandler = {
        handle: () => of(testData),
      };

      const result$ = interceptor.intercept(mockContext as unknown as ExecutionContext, mockCallHandler);
      const result = await result$.toPromise();

      expect(result.metadata).to.have.property('environment', 'development');
    });
  });
});