import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../security/guards/jwt-auth.guard';
import { RolesGuard } from '../../security/guards/roles.guard';
import { JobService, JobDefinition } from '../job.service';

@ApiTags('Job Queue Management')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  async createJob(@Body() createJobDto: {
    name: string;
    type: string;
    data: any;
    priority?: number;
    delay?: number;
    maxAttempts?: number;
    scheduledAt?: string;
  }) {
    const jobId = await this.jobService.addJob(
      createJobDto.name,
      createJobDto.type,
      createJobDto.data,
      {
        priority: createJobDto.priority,
        delay: createJobDto.delay,
        maxAttempts: createJobDto.maxAttempts,
        scheduledAt: createJobDto.scheduledAt ? new Date(createJobDto.scheduledAt) : undefined,
      }
    );

    return {
      success: true,
      data: { jobId },
      message: 'Job created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all jobs' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by job type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by job status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of jobs to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of jobs to skip' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async getJobs(
    @Query('type') type?: string,
    @Query('status') status?: JobDefinition['status'],
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const jobs = this.jobService.getJobs({
      type,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return {
      success: true,
      data: jobs,
      count: jobs.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved successfully' })
  async getQueueStats() {
    const stats = this.jobService.getQueueStats();

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId') jobId: string) {
    const job = this.jobService.getJob(jobId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('jobId') jobId: string) {
    const cancelled = await this.jobService.cancelJob(jobId);

    if (!cancelled) {
      return {
        success: false,
        error: 'Job not found or cannot be cancelled',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Job cancelled successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retry scheduled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(@Param('jobId') jobId: string) {
    const retried = await this.jobService.retryJob(jobId);

    if (!retried) {
      return {
        success: false,
        error: 'Job not found or cannot be retried',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Job retry scheduled successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('completed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear completed jobs' })
  @ApiQuery({ name: 'olderThan', required: false, type: String, description: 'Clear jobs older than this date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Completed jobs cleared successfully' })
  async clearCompletedJobs(@Query('olderThan') olderThan?: string) {
    const cutoff = olderThan ? new Date(olderThan) : undefined;
    const cleared = this.jobService.clearCompletedJobs(cutoff);

    return {
      success: true,
      message: `${cleared} completed jobs cleared`,
      timestamp: new Date().toISOString(),
    };
  }
}