import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { ErrorsFilter } from './filters/errors.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { EnhancedErrorsFilter } from './filters/enhanced-errors.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { EnhancedValidationPipe } from './pipes/enhanced-validation.pipe';
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
    ErrorsFilter,
    HttpExceptionFilter,
    EnhancedErrorsFilter,
    ValidationPipe,
    // EnhancedValidationPipe, // Temporarily disabled due to dependency issues
    PrismaService,
    TransactionReferenceService,
    ConcurrencyControlService,
    ErrorHandlingService,
  ],
  exports: [
    LoggingInterceptor,
    TimeoutInterceptor,
    ErrorsFilter,
    HttpExceptionFilter,
    EnhancedErrorsFilter,
    ValidationPipe,
    // EnhancedValidationPipe, // Temporarily disabled due to dependency issues
    PrismaService,
    TransactionReferenceService,
    ConcurrencyControlService,
    ErrorHandlingService,
  ],
})
export class CommonModule {}