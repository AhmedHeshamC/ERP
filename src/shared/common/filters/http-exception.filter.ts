import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private configService: ConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message!: string;
    let details!: any;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || responseObj.error || exception.message;
      details = responseObj.errors || responseObj.details;

      // Handle validation errors
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
        details = message;
        message = 'Validation failed';
      }
    } else {
      message = exception.message;
    }

    // Log HTTP exceptions
    const logData = {
      method: request.method,
      url: request.url,
      status,
      message,
      userId: (request as any).user?.id || 'anonymous',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(`HTTP Error!: ${message}`, exception.stack, logData);
    } else if (status >= 400) {
      this.logger.warn(`HTTP Warning!: ${message}`, logData);
    }

    // Build consistent error response
    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(details && { details }),
      ...(this.configService.get<string>('NODE_ENV') === 'development' && {
        stack: exception.stack,
      }),
    };

    response.status(status).json(errorResponse);
  }
}