import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { CommonModule } from '../../shared/common/common.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { CustomerController } from './controllers/customer.controller';
import { OrderController } from './controllers/order.controller';
import { InvoiceController } from './controllers/invoice.controller';

// Services
import { CustomerService } from './services/customer.service';
import { OrderService } from './services/order.service';
import { InvoiceService } from './services/invoice.service';

// Guards
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';

// DTOs are automatically picked up by NestJS when referenced in controllers

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    CustomerController,
    OrderController,
    InvoiceController,
  ],
  providers: [
    CustomerService,
    OrderService,
    InvoiceService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    CustomerService,
    OrderService,
    InvoiceService,
  ],
})
export class SalesModule {}