import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = (request as any).user?.id || 'anonymous';

    // Log incoming request
    this.logger.log(`Incoming Request: ${method} ${url}`, {
      method,
      url,
      ip,
      userAgent,
      userId,
      timestamp: new Date().toISOString(),
    });

    return next
      .handle()
      .pipe(
        tap({
          next: (data) => {
            const duration = Date.now() - now;
            const statusCode = response.statusCode;

            this.logger.log(`Request completed: ${method} ${url} - ${statusCode}`, {
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              userId,
              timestamp: new Date().toISOString(),
            });

            // Log slow requests
            if (duration > 1000) {
              this.logger.warn(`Slow request detected: ${method} ${url}`, {
                method,
                url,
                duration: `${duration}ms`,
                userId,
              });
            }
          },
          error: (error) => {
            const duration = Date.now() - now;
            const statusCode = error.status || 500;

            this.logger.error(`Request failed: ${method} ${url} - ${statusCode}`, error.stack, {
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              userId,
              error: error.message,
              timestamp: new Date().toISOString(),
            });
          },
        }),
      );
  }
}