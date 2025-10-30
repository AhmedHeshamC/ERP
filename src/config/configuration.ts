import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_PASSWORD: z.string().min(8),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().min(8),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  COOKIE_SECRET: z.string().min(32),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  UPLOAD_PATH: z.string().default('./uploads'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // Monitoring (optional)
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  PROMETHEUS_PORT: z.coerce.number().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const configuration = registerAs('app', () => {
  const validatedEnv = envSchema.parse(process.env);

  return {
    nodeEnv: validatedEnv.NODE_ENV,
    port: validatedEnv.PORT,
    apiPrefix: validatedEnv.API_PREFIX,

    database: {
      url: validatedEnv.DATABASE_URL,
    },

    redis: {
      url: validatedEnv.REDIS_URL,
    },

    jwt: {
      secret: validatedEnv.JWT_SECRET,
      refreshSecret: validatedEnv.JWT_REFRESH_SECRET,
      expiration: validatedEnv.JWT_EXPIRATION,
      refreshExpiration: validatedEnv.JWT_REFRESH_EXPIRATION,
    },

    security: {
      bcryptRounds: validatedEnv.BCRYPT_ROUNDS,
      rateLimitWindowMs: validatedEnv.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: validatedEnv.RATE_LIMIT_MAX_REQUESTS,
      cookieSecret: validatedEnv.COOKIE_SECRET,
    },

    cors: {
      origins: validatedEnv.CORS_ORIGIN.split(','),
    },

    upload: {
      maxFileSize: validatedEnv.MAX_FILE_SIZE,
      uploadPath: validatedEnv.UPLOAD_PATH,
    },

    logging: {
      level: validatedEnv.LOG_LEVEL,
      file: validatedEnv.LOG_FILE,
    },

    email: {
      host: validatedEnv.SMTP_HOST,
      port: validatedEnv.SMTP_PORT,
      user: validatedEnv.SMTP_USER,
      pass: validatedEnv.SMTP_PASS,
      from: validatedEnv.FROM_EMAIL,
    },

    monitoring: {
      sentryDsn: validatedEnv.SENTRY_DSN,
      prometheusPort: validatedEnv.PROMETHEUS_PORT,
    },
  };
});