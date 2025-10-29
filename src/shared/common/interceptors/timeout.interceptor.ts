import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Different timeouts for different operations
    let timeoutValue = this.DEFAULT_TIMEOUT;

    if (url.includes('/upload')) {
      timeoutValue = 60000; // 1 minute for file uploads
    } else if (url.includes('/reports') || url.includes('/export')) {
      timeoutValue = 120000; // 2 minutes for reports
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      timeoutValue = 45000; // 45 seconds for write operations
    }

    return next.handle().pipe(
      timeout(timeoutValue),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.logger.warn(`Request timeout: ${method} ${url} after ${timeoutValue}ms`);
          return throwError(() => new RequestTimeoutException(`Request timeout after ${timeoutValue}ms`));
        }
        return throwError(() => err);
      }),
    );
  }
}