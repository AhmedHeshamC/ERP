import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { JwtAuthGuard } from '../../../modules/authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/authentication/guards/roles.guard';
import { Roles } from '../../../modules/authentication/decorators/roles.decorator';
import { ResourcePermission } from '../../security/decorators/permissions.decorator';
import { ResourceBasedGuard } from '../../security/guards/resource-based.guard';
import { UserRole } from '../../../modules/users/dto/user.dto';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, ResourceBasedGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs with filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  async findAll(@Query() query: AuditQueryDto) {
    const result = await this.auditService.findAuditLogs(query);
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit statistics retrieved successfully' })
  async getStatistics(@Query('days') days?: string) {
    const statistics = await this.auditService.getAuditStatistics(days ? parseInt(days) : 30);
    return statistics;
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit log retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Audit log not found' })
  async findOne(@Param('id') id: string) {
    return await this.auditService.findAuditLogById(id);
  }

  @Get('resource/:resourceType/:resourceId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs for a specific resource' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  async findByResource(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit?: string,
  ) {
    return await this.auditService.findAuditLogsForResource(
      resourceType,
      resourceId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  async findByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return await this.auditService.findAuditLogsForUser(
      userId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('event/:eventType')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ResourcePermission('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs by event type' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  async findByEventType(
    @Param('eventType') eventType: string,
    @Query('limit') limit?: string,
  ) {
    return await this.auditService.findAuditLogsByEventType(
      eventType,
      limit ? parseInt(limit) : 50,
    );
  }

  @Delete('cleanup')
  @Roles(UserRole.ADMIN)
  @ResourcePermission('audit', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup old audit logs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs cleaned up successfully' })
  async cleanupOldLogs(@Query('days') days?: string) {
    const deletedCount = await this.auditService.cleanupOldLogs(days ? parseInt(days) : 365);
    return {
      message: `Successfully cleaned up ${deletedCount} old audit logs`,
      deletedCount,
    };
  }
}