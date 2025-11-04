import { Controller, Get } from '@nestjs/common';

@Controller('performance')
export class PerformanceController {
  @Get('metrics')
  getMetrics() {
    return {
      cpu: 0,
      memory: 0,
      requests: 0,
    };
  }
}