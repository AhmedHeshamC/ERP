import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';
export const CACHE_PREFIX_METADATA = 'cache_prefix';
export const CACHE_INVALIDATE_METADATA = 'cache_invalidate';

/**
 * Cache result of method execution
 */
export function Cache(options: {
  key?: string;
  ttl?: number;
  prefix?: string;
  unless?: (...args: any[]) => boolean;
}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    SetMetadata(CACHE_KEY_METADATA, { target, propertyKey, options });
    return descriptor;
  };
}

/**
 * Invalidate cache when method is called
 */
export function CacheInvalidate(patterns: string[]): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    SetMetadata(CACHE_INVALIDATE_METADATA, { target, propertyKey, patterns });
    return descriptor;
  };
}

/**
 * Cache result with custom key generation
 */
export function Cacheable(options: {
  keyGenerator?: (...args: any[]) => string;
  ttl?: number;
  prefix?: string;
  condition?: (...args: any[]) => boolean;
}): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    SetMetadata(CACHE_KEY_METADATA, { target, propertyKey, options });
    return descriptor;
  };
}