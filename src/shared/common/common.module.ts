import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { ErrorsFilter } from './filters/errors.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { SecurityService } from '../security/security.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LoggingInterceptor,
    TimeoutInterceptor,
    ErrorsFilter,
    HttpExceptionFilter,
    ValidationPipe,
    SecurityService,
  ],
  exports: [
    LoggingInterceptor,
    TimeoutInterceptor,
    ErrorsFilter,
    HttpExceptionFilter,
    ValidationPipe,
    SecurityService,
  ],
})
export class CommonModule {}