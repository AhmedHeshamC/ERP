import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SecurityService } from './shared/security/security.service';
import { LoggingInterceptor } from './shared/common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './shared/common/interceptors/timeout.interceptor';
import { ErrorsFilter } from './shared/common/filters/errors.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const securityService = app.get(SecurityService);
  const logger = new Logger('Bootstrap');

  // Security Middleware (OWASP Top 10)
  app.use(helmet(securityService.getHelmetConfig()));
  app.use(compression());
  app.use(cookieParser(configService.get<string>('COOKIE_SECRET')));

  // CORS Configuration
  const corsOrigins = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(',');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Accept',
      'Authorization',
      'Content-Type',
      'X-XSRF-TOKEN',
      'X-CSRF-TOKEN',
    ],
  });

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global Interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
  );

  // Global Filters
  app.useGlobalFilters(new ErrorsFilter(configService));

  // API Prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Swagger Documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ERP System API')
      .setDescription('Secure ERP System with OWASP Top 10 compliance')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access-token')
      .addCookieAuth('refresh-token')
      .addTag('Authentication')
      .addTag('Users')
      .addTag('Accounting')
      .addTag('Inventory')
      .addTag('Sales')
      .addTag('Purchasing')
      .addTag('Reports')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      customSiteTitle: 'ERP System API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
    });
  }

  // Graceful Shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application is running on: http://0.0.0.0:${port}/${apiPrefix}`);
  logger.log(`📚 API Documentation: http://0.0.0.0:${port}/${apiPrefix}/docs`);
  logger.log(`🔒 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});