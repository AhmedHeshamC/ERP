import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';
import { AuditOptions, AUDIT_KEY } from '../decorators/audit.decorator';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const correlationId = request.headers['x-correlation-id'];
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap((result) => {
        // Log successful operation
        this.logOperation(
          auditOptions,
          context,
          result,
          user?.id,
          correlationId,
          ipAddress,
          userAgent,
          false,
        );
      }),
      catchError((error) => {
        // Log failed operation
        if (!auditOptions.ignoreOnError) {
          this.logOperation(
            auditOptions,
            context,
            null,
            user?.id,
            correlationId,
            ipAddress,
            userAgent,
            true,
            error,
          );
        }
        return throwError(() => error);
      }),
    );
  }

  private async logOperation(
    auditOptions: AuditOptions,
    context: ExecutionContext,
    result: any,
    userId?: string,
    correlationId?: string,
    ipAddress?: string,
    userAgent?: string,
    isError: boolean = false,
    error?: any,
  ): Promise<void> {
    try {
      const args = context.getArgs();

      // Extract resource ID
      const resourceId = auditOptions.getResourceId
        ? auditOptions.getResourceId(args, result)
        : this.extractResourceId(args, result);

      // Extract old values (for updates)
      const oldValues = auditOptions.getOldValues
        ? auditOptions.getOldValues(args, result)
        : this.extractOldValues(args, result);

      // Extract new values
      const newValues = auditOptions.getNewValues
        ? auditOptions.getNewValues(args, result)
        : this.extractNewValues(args, result);

      // Extract metadata
      const metadata = auditOptions.getMetadata
        ? auditOptions.getMetadata(args, result)
        : this.extractMetadata(args, result, isError, error);

      // Determine event type
      const eventType = isError
        ? `${auditOptions.eventType}_FAILED`
        : auditOptions.eventType;

      // Determine severity
      let severity = auditOptions.severity || 'MEDIUM';
      if (isError) {
        severity = 'HIGH';
      }

      // Create audit log
      const auditLog = new AuditLog({
        eventType,
        resourceType: auditOptions.resourceType,
        resourceId,
        action: auditOptions.action,
        userId,
        oldValues,
        newValues,
        metadata,
        ipAddress,
        userAgent,
        correlationId,
        severity,
        timestamp: new Date(),
      });

      await this.auditService.logEvent(auditLog);
      } catch (auditError) {
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      const errorStack = auditError instanceof Error ? auditError.stack : undefined;
      this.logger.error(
        `Failed to create audit log: ${errorMessage}`,
        errorStack,
      );
    }
  }

  private extractResourceId(args: any[], result: any): string {
    // Try to get ID from method arguments
    for (const arg of args) {
      if (typeof arg === 'object' && arg?.id) {
        return arg.id;
      }
    }

    // Try to get ID from result
    if (result?.id) {
      return result.id;
    }

    // Try to get ID from URL params
    for (const arg of args) {
      if (typeof arg === 'object' && arg?.params?.id) {
        return arg.params.id;
      }
    }

    return 'unknown';
  }

  private extractOldValues(args: any[], _result: any): any {
    // For update operations, try to extract old values from the first argument
    const firstArg = args[0];
    if (typeof firstArg === 'object' && firstArg?.oldData) {
      return firstArg.oldData;
    }
    return null;
  }

  private extractNewValues(args: any[], result: any): any {
    // Try to extract new values from result or input data
    if (result && typeof result === 'object') {
      return result;
    }

    const firstArg = args[0];
    if (typeof firstArg === 'object') {
      return firstArg;
    }

    return null;
  }

  private extractMetadata(
    _args: any[],
    _result: any,
    isError: boolean,
    error?: any,
  ): any {
    const metadata: any = {
      timestamp: new Date().toISOString(),
      success: !isError,
    };

    if (isError && error) {
      metadata.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    // Add method information
    metadata.method = {
      controller: 'unknown',
      handler: 'unknown',
    };

    return metadata;
  }
}