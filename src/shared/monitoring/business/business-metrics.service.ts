import { Injectable } from '@nestjs/common';

@Injectable()
export class BusinessMetricsService {
  getBusinessMetrics() {
    return {
      totalUsers: 0,
      totalOrders: 0,
      totalRevenue: 0,
      metrics: {},
    };
  }
}