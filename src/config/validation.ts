import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  DATABASE_URL: Joi.string().uri().required(),
  DB_PASSWORD: Joi.string().min(8).required(),

  // Redis
  REDIS_URL: Joi.string().uri().required(),
  REDIS_PASSWORD: Joi.string().min(8).required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Security
  BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  COOKIE_SECRET: Joi.string().min(32).required(),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(10485760),
  UPLOAD_PATH: Joi.string().default('./uploads'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_FILE: Joi.string().default('./logs/app.log'),

  // Email (optional)
  SMTP_HOST: Joi.string().optional().allow('', null),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional().allow('', null),
  SMTP_PASS: Joi.string().optional().allow('', null),
  FROM_EMAIL: Joi.string().optional().allow('', null).email({ tlds: { allow: false } }),

  // Monitoring (optional)
  SENTRY_DSN: Joi.string().uri().optional().allow('', null),
  PROMETHEUS_PORT: Joi.number().optional(),

  // Additional optional fields (for development tools)
  PGADMIN_EMAIL: Joi.string().optional().allow('', null).email({ tlds: { allow: false } }),
  PGADMIN_PASSWORD: Joi.string().optional().allow('', null),
});