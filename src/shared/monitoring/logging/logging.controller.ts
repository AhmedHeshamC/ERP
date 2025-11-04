import { Controller, Get, Query } from '@nestjs/common';

@Controller('logging')
export class LoggingController {
  @Get('logs')
  getLogs(@Query('level') level?: string) {
    return {
      logs: [],
      level: level || 'info',
    };
  }
}