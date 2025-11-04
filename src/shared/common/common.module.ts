import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { ApiResponseInterceptor, ResponseInterceptorOptions } from './interceptors/api-response.interceptor';
import { ErrorsFilter } from './filters/errors.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { EnhancedErrorsFilter } from './filters/enhanced-errors.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { EnhancedValidationPipe, ValidationPipeOptions } from './pipes/enhanced-validation.pipe';
import { UnifiedValidationPipe, UnifiedValidationOptions } from './pipes/unified-validation.pipe';
import { SecurityModule } from '../security/security.module';
import { PrismaService } from '../database/prisma.service';
import { TransactionReferenceService } from './services/transaction-reference.service';
import { ConcurrencyControlService } from './services/concurrency-control.service';
import { ErrorHandlingService } from './services/error-handling.service';

@Module({
  imports: [ConfigModule, SecurityModule],
  providers: [
    LoggingInterceptor,
    TimeoutInterceptor,
    ApiResponseInterceptor,
    {
      provide: 'ResponseInterceptorOptions',
      useValue: {
        includePerformance: true,
        includeRequestDetails: true,
        sanitizeResponses: false,
      } as ResponseInterceptorOptions,
    },
    ErrorsFilter,
    HttpExceptionFilter,
    EnhancedErrorsFilter,
    ValidationPipe,
    EnhancedValidationPipe,
    {
      provide: 'ValidationPipeOptions',
      useValue: {
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: false,
        skipSecurityValidation: false,
      } as ValidationPipeOptions,
    },
    UnifiedValidationPipe,
    {
      provide: 'UnifiedValidationOptions',
      useValue: {
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: false,
        skipSecurityValidation: false,
        handleSpecialCharacters: true,
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
      } as UnifiedValidationOptions,
    },
    PrismaService,
    TransactionReferenceService,
    ConcurrencyControlService,
    ErrorHandlingService,
  ],
  exports: [
    LoggingInterceptor,
    TimeoutInterceptor,
    ApiResponseInterceptor,
    ErrorsFilter,
    HttpExceptionFilter,
    EnhancedErrorsFilter,
    ValidationPipe,
    EnhancedValidationPipe,
    UnifiedValidationPipe,
    PrismaService,
    TransactionReferenceService,
    ConcurrencyControlService,
    ErrorHandlingService,
    SecurityModule,
  ],
})
export class CommonModule {}