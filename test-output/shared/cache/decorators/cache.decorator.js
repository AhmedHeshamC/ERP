"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_INVALIDATE_METADATA = exports.CACHE_PREFIX_METADATA = exports.CACHE_TTL_METADATA = exports.CACHE_KEY_METADATA = void 0;
exports.Cache = Cache;
exports.CacheInvalidate = CacheInvalidate;
exports.Cacheable = Cacheable;
const common_1 = require("@nestjs/common");
exports.CACHE_KEY_METADATA = 'cache_key';
exports.CACHE_TTL_METADATA = 'cache_ttl';
exports.CACHE_PREFIX_METADATA = 'cache_prefix';
exports.CACHE_INVALIDATE_METADATA = 'cache_invalidate';
/**
 * Cache result of method execution
 */
function Cache(options) {
    return function (target, propertyKey, descriptor) {
        (0, common_1.SetMetadata)(exports.CACHE_KEY_METADATA, { target, propertyKey, options });
        return descriptor;
    };
}
/**
 * Invalidate cache when method is called
 */
function CacheInvalidate(patterns) {
    return function (target, propertyKey, descriptor) {
        (0, common_1.SetMetadata)(exports.CACHE_INVALIDATE_METADATA, { target, propertyKey, patterns });
        return descriptor;
    };
}
/**
 * Cache result with custom key generation
 */
function Cacheable(options) {
    return function (target, propertyKey, descriptor) {
        (0, common_1.SetMetadata)(exports.CACHE_KEY_METADATA, { target, propertyKey, options });
        return descriptor;
    };
}
