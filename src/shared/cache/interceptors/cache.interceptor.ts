import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../cache.service';
import {
  CACHE_KEY_METADATA,
  CACHE_INVALIDATE_METADATA,
} from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheMetadata = this.reflector.get<any>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    const invalidateMetadata = this.reflector.get<any>(
      CACHE_INVALIDATE_METADATA,
      context.getHandler(),
    );

    // Handle cache invalidation
    if (invalidateMetadata) {
      await this.handleInvalidation(invalidateMetadata);
      return next.handle();
    }

    // Handle caching
    if (!cacheMetadata) {
      return next.handle();
    }

    const options = (cacheMetadata as any).options || {};
    const cacheKey = this.generateCacheKey(context, options);

    // Check cache
    const cachedResult = await this.cacheService.get(cacheKey, {
      ttl: options.ttl,
      keyPrefix: options.prefix,
    });

    if (cachedResult !== null) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return of(cachedResult);
    }

    // Execute method and cache result
    return next.handle().pipe(
      tap(async (response) => {
        // Check unless condition
        if (options.unless && options.unless(...this.getArguments(context))) {
          return;
        }

        await this.cacheService.set(cacheKey, response, {
          ttl: options.ttl,
          keyPrefix: options.prefix,
        });

        this.logger.debug(`Cached result for key: ${cacheKey}`);
      }),
    );
  }

  /**
   * Generate cache key based on context and options
   */
  private generateCacheKey(
    context: ExecutionContext,
    options: any,
  ): string {
    const request = context.switchToHttp().getRequest();
    const { method, url, params, query } = request;

    if (options.key) {
      return options.key;
    }

    // Generate key from request details
    const keyParts = [
      method,
      url,
      JSON.stringify(params),
      JSON.stringify(query),
    ];

    return keyParts.join(':').replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  /**
   * Handle cache invalidation
   */
  private async handleInvalidation(invalidateMetadata: any): Promise<void> {
    const { patterns } = invalidateMetadata;

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
      this.logger.debug(`Invalidated cache pattern: ${pattern}`);
    }
  }

  /**
   * Get method arguments from context
   */
  private getArguments(context: ExecutionContext): any[] {
    return context.getArgs();
  }
}