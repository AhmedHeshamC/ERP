import { Controller, Get } from '@nestjs/common';

@Controller('dashboard')
export class DashboardController {
  @Get()
  getDashboard() {
    return {
      users: 0,
      orders: 0,
      revenue: 0,
    };
  }
}