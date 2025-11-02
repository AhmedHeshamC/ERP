import { Test, TestingModule } from '@nestjs/testing';
import { UnifiedValidationPipe } from '../../shared/common/pipes/unified-validation.pipe';
import { SecurityValidationService } from '../../shared/security/services/security-validation.service';
import { SecurityService } from '../../shared/security/security.service';
import { ArgumentMetadata, Paramtype } from '@nestjs/common';
import { expect } from 'chai';
import Sinon = require('sinon');

describe('UnifiedValidationPipe', () => {
  let validationPipe: UnifiedValidationPipe;
  let securityValidationService: SecurityValidationService;
  let sandbox: Sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = Sinon.createSandbox();

    // Mock SecurityService which is a dependency of SecurityValidationService
    const mockSecurityService = {
      logSecurityEvent: sandbox.stub().resolves(undefined),
    };

    const mockSecurityValidationService = {
      validateInput: sandbox.stub().resolves({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'LOW',
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnifiedValidationPipe,
        {
          provide: SecurityValidationService,
          useValue: mockSecurityValidationService,
        },
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    })
    .overrideProvider(UnifiedValidationPipe)
    .useFactory({
      factory: () => {
        return new UnifiedValidationPipe(mockSecurityValidationService as any, {});
      },
    })
    .compile();

    validationPipe = module.get<UnifiedValidationPipe>(UnifiedValidationPipe);
    securityValidationService = module.get<any>(SecurityValidationService);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Basic Validation', () => {
    it('should return the value unchanged for primitive types', async () => {
      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: String };
      const result = await validationPipe.transform('test value', metadata);
      expect(result).to.equal('test value');
    });

    it('should return the value unchanged for null when not required', async () => {
      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: String };
      const result = await validationPipe.transform(null, metadata);
      expect(result).to.be.null;
    });

    it('should return the value unchanged for undefined when not required', async () => {
      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: String };
      const result = await validationPipe.transform(undefined, metadata);
      expect(result).to.be.undefined;
    });
  });

  describe('Correlation ID Tracking', () => {
    it('should extract correlation ID from request context', async () => {
      const correlationId = 'test-correlation-123';
      const mockContext = {
        getRequest: () => ({
          correlationId,
          url: '/test',
          method: 'POST',
          headers: { 'user-agent': 'test-agent' },
        }),
      };

      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: String };
      await validationPipe.transform('test', metadata, mockContext);

      // The correlation ID should be used in security validation
      expect((securityValidationService.validateInput as Sinon.SinonStub).called).to.be.true;
      const callArgs = (securityValidationService.validateInput as Sinon.SinonStub).getCall(0).args;
      expect(callArgs[2]).to.have.property('requestId', correlationId);
    });

    it('should generate correlation ID when not provided', async () => {
      const mockContext = {
        getRequest: () => ({
          url: '/test',
          method: 'POST',
          headers: {},
        }),
      };

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      await validationPipe.transform({ test: 'value' }, metadata, mockContext);

      expect((securityValidationService.validateInput as Sinon.SinonStub).called).to.be.true;
      const callArgs = (securityValidationService.validateInput as Sinon.SinonStub).getCall(0).args;
      expect(callArgs[2]).to.have.property('requestId');
      expect(callArgs[2].requestId).to.match(/^val_\d+_[a-z0-9]+$/);
    });

    it('should extract correlation ID from headers', async () => {
      const correlationId = 'header-correlation-456';
      const mockContext = {
        getRequest: () => ({
          headers: { 'x-correlation-id': correlationId },
          url: '/test',
          method: 'POST',
        }),
      };

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      await validationPipe.transform({ test: 'value' }, metadata, mockContext);

      expect((securityValidationService.validateInput as Sinon.SinonStub).called).to.be.true;
      const callArgs = (securityValidationService.validateInput as Sinon.SinonStub).getCall(0).args;
      expect(callArgs[2]).to.have.property('requestId', correlationId);
    });
  });

  describe('Special Character Handling', () => {
    it('should handle ampersands correctly', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        name: 'John & Jane Doe',
        description: 'Test & Special characters',
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.name).to.equal('John &amp; Jane Doe');
      expect(result.description).to.equal('Test &amp; Special characters');
    });

    it('should handle quotes correctly', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        title: 'Test "quoted" text',
        description: "Test 'single quotes' text",
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.title).to.include('"quoted"');
      expect(result.description).to.include("'single quotes'");
    });

    it('should handle control characters', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        text: 'Test\x00control\x08characters',
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.text).to.equal('Testcontrolcharacters');
    });

    it('should normalize line endings', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        text: 'Line 1\r\nLine 2\rLine 3\nLine 4',
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.text).to.equal('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('should handle nested objects with special characters', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        user: {
          name: 'John & Jane',
          address: {
            street: '123 "Main" St',
            city: 'Test & City',
          },
        },
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.user.name).to.equal('John &amp; Jane');
      expect(result.user.address.street).to.include('"Main"');
      expect(result.user.address.city).to.equal('Test &amp; City');
    });

    it('should handle arrays with special characters', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        items: [
          'Item 1 & test',
          'Item 2 "quoted"',
          'Item 3\x00control',
        ],
      };

      const result = await validationPipe.transform(input, metadata);
      expect(result.items[0]).to.equal('Item 1 &amp; test');
      expect(result.items[1]).to.include('"quoted"');
      expect(result.items[2]).to.equal('Item 3control');
    });
  });

  describe('JSON Parsing Error Handling', () => {
    it('should detect JSON parsing errors', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const errorValue = 'Unexpected token } in JSON at position 123';

      try {
        await validationPipe.transform(errorValue, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('errorCode', 'INVALID_JSON');
        expect((error as any).response.message).to.include('Invalid JSON format');
      }
    });

    it('should detect various JSON error patterns', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const errorPatterns = [
        'Unexpected end of JSON input',
        'JSON.parse: unexpected character',
        'Unexpected token < in JSON',
      ];

      for (const errorPattern of errorPatterns) {
        try {
          await validationPipe.transform(errorPattern, metadata);
          expect.fail(`Should have thrown for pattern: ${errorPattern}`);
        } catch (error) {
          expect((error as any).response.errorCode).to.equal('INVALID_JSON');
        }
      }
    });

    it('should parse valid JSON strings when type is object', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const jsonString = '{"name": "test", "value": 123}';

      const result = await validationPipe.transform(jsonString, metadata);
      expect(result).to.deep.equal({ name: 'test', value: 123 });
    });

    it('should handle malformed JSON gracefully', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const malformedJson = '{"name": "test", "value": 123'; // Missing closing brace

      try {
        await validationPipe.transform(malformedJson, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('errorCode', 'INVALID_JSON');
        expect(error.response.metadata).to.have.property('requestId');
      }
    });
  });

  describe('Payload Size Validation', () => {
    it('should accept payloads within size limit', async () => {
      const options = { maxPayloadSize: 1024 }; // 1KB
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = { data: 'x'.repeat(100) }; // 100 bytes

      const result = await pipe.transform(input, metadata);
      expect(result).to.deep.equal(input);
    });

    it('should reject payloads exceeding size limit', async () => {
      const options = { maxPayloadSize: 100 }; // 100 bytes
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = { data: 'x'.repeat(200) }; // 200 bytes

      try {
        await pipe.transform(input, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('errorCode', 'PAYLOAD_TOO_LARGE');
        expect((error as any).response.message).to.include('exceeds maximum allowed limit');
      }
    });

    it('should calculate size correctly for nested objects', async () => {
      const options = { maxPayloadSize: 50 };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = {
        level1: {
          level2: {
            data: 'x'.repeat(30),
          },
        },
      };

      try {
        await pipe.transform(input, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error) {
        expect((error as any).response.errorCode).to.equal('PAYLOAD_TOO_LARGE');
      }
    });
  });

  describe('Security Validation Integration', () => {
    it('should call security validation service', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = { test: 'value' };

      await validationPipe.transform(input, metadata);

      expect((securityValidationService.validateInput as Sinon.SinonStub).calledOnce).to.be.true;
      const callArgs = (securityValidationService.validateInput as Sinon.SinonStub).getCall(0).args;
      expect(callArgs[0]).to.deep.equal(input);
      expect(callArgs[1]).to.be.an('object');
      expect(callArgs[2]).to.be.an('object');
    });

    it('should handle security validation failures', async () => {
      (securityValidationService.validateInput as Sinon.SinonStub).resolves({
        isValid: false,
        errors: [
          {
            code: 'SQL_INJECTION_DETECTED',
            message: 'Potential SQL injection detected',
            field: 'input',
            severity: 'CRITICAL',
            owaspCategory: 'A03: Injection',
          },
        ],
        warnings: [],
        securityLevel: 'CRITICAL',
      });

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = { input: "'; DROP TABLE users; --" };

      try {
        await validationPipe.transform(input, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('errorCode', 'SECURITY_VALIDATION_ERROR');
        expect((error as any).response.errors).to.be.an('array');
        expect((error as any).response.errors[0]).to.have.property('code', 'SQL_INJECTION_DETECTED');
      }
    });

    it('should skip security validation when configured', async () => {
      const options = { skipSecurityValidation: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const input = { test: 'value' };

      await pipe.transform(input, metadata);

      expect((securityValidationService.validateInput as Sinon.SinonStub).called).to.be.false;
    });
  });

  describe('Whitelist Validation', () => {
    it('should apply whitelist when enabled', async () => {
      class TestDto {
        allowed?: string;
      }

      const options = { whitelist: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: TestDto };
      const input = {
        allowed: 'value',
        notAllowed: 'should be removed',
      };

      const result = await pipe.transform(input, metadata);
      expect(result).to.have.property('allowed', 'value');
      expect(result).to.not.have.property('notAllowed');
    });

    it('should forbid non-whitelisted properties when configured', async () => {
      class TestDto {
        allowed?: string;
      }

      const options = { whitelist: true, forbidNonWhitelisted: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: TestDto };
      const input = {
        allowed: 'value',
        notAllowed: 'should cause error',
      };

      try {
        await pipe.transform(input, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('errorCode', 'WHITELIST_VIOLATION');
        expect((error as any).response.message).to.include('notAllowed');
      }
    });
  });

  describe('Type Transformation', () => {
    it('should transform strings to numbers', async () => {
      const options = { transform: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: Number };
      const result = await pipe.transform('123', metadata);
      expect(result).to.equal(123);
    });

    it('should transform strings to booleans', async () => {
      const options = { transform: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: Boolean };

      const result1 = await pipe.transform('true', metadata);
      expect(result1).to.be.true;

      const result2 = await pipe.transform('false', metadata);
      expect(result2).to.be.false;
    });

    it('should wrap non-array values in arrays', async () => {
      const options = { transform: true };
      const pipe = new UnifiedValidationPipe(securityValidationService, options);

      const metadata: ArgumentMetadata = { type: 'custom' as Paramtype, metatype: Array };
      const result = await pipe.transform('single value', metadata);
      expect(result).to.deep.equal(['single value']);
    });
  });

  describe('Error Response Format', () => {
    it('should include correlation ID in error responses', async () => {
      const correlationId = 'test-error-correlation';
      const mockContext = {
        getRequest: () => ({
          correlationId,
          url: '/test',
          method: 'POST',
        }),
      };

      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const invalidJson = 'invalid json';

      try {
        await validationPipe.transform(invalidJson, metadata, mockContext);
        expect.fail('Should have thrown an exception');
      } catch (error) {
        expect((error as any).response).to.have.property('metadata');
        expect((error as any).response.metadata).to.have.property('requestId', correlationId);
      }
    });

    it('should include timestamp in error responses', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const invalidJson = 'invalid json';

      try {
        await validationPipe.transform(invalidJson, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error) {
        expect((error as any).response).to.have.property('metadata');
        expect((error as any).response.metadata).to.have.property('timestamp');

        const timestamp = new Date((error as any).response.metadata.timestamp);
        expect(timestamp).to.be.a('date');
        expect(timestamp.getTime()).to.be.closeTo(Date.now(), 1000); // Within 1 second
      }
    });

    it('should provide structured error details', async () => {
      const metadata: ArgumentMetadata = { type: 'body' as Paramtype, metatype: Object };
      const invalidJson = '{"unclosed": "value"';

      try {
        await validationPipe.transform(invalidJson, metadata);
        expect.fail('Should have thrown an exception');
      } catch (error: any) {
        expect(error.response).to.have.property('success', false);
        expect((error as any).response).to.have.property('message');
        expect((error as any).response).to.have.property('errorCode');
        expect((error as any).response).to.have.property('metadata');
      }
    });
  });
});