/**
 * Purchase Requisition Controller
 * REST API endpoints for purchase requisition management
 */

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/guards/roles.guard';
import { Roles } from '../../../shared/security/decorators/roles.decorator';
import { PurchaseRequisitionService } from '../services/requisition.service';
import {
  CreateRequisitionDto,
  UpdateRequisitionDto,
  RequisitionQueryDto
} from '../types/p2p.types';

@ApiTags('purchase-requisitions')
@Controller('p2p/requisitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchaseRequisitionController {
  constructor(private readonly requisitionService: PurchaseRequisitionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new purchase requisition' })
  @ApiResponse({ status: 201, description: 'Requisition created successfully' })
  async createRequisition(@Body() dto: CreateRequisitionDto) {
    // This would get user ID from JWT token in real implementation
    const userId = 'current-user-id';
    return this.requisitionService.createRequisition(dto, userId);
  }

  @Get(':id')
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get a specific purchase requisition' })
  @ApiResponse({ status: 200, description: 'Requisition retrieved successfully' })
  async getRequisition(@Param('id') id: string) {
    return this.requisitionService.getRequisition(id);
  }

  @Put(':id')
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update a purchase requisition' })
  @ApiResponse({ status: 200, description: 'Requisition updated successfully' })
  async updateRequisition(@Param('id') id: string, @Body() dto: UpdateRequisitionDto) {
    const userId = 'current-user-id';
    return this.requisitionService.updateRequisition(id, dto, userId);
  }

  @Post(':id/submit')
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Submit requisition for approval' })
  @ApiResponse({ status: 200, description: 'Requisition submitted successfully' })
  async submitRequisition(@Param('id') id: string) {
    const userId = 'current-user-id';
    return this.requisitionService.submitRequisition(id, userId);
  }

  @Post(':id/approve')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Approve a purchase requisition' })
  @ApiResponse({ status: 200, description: 'Requisition approved successfully' })
  async approveRequisition(
    @Param('id') id: string,
    @Body() body: { comments?: string }
  ) {
    const userId = 'current-user-id';
    return this.requisitionService.approveRequisition(id, userId, body.comments);
  }

  @Post(':id/reject')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Reject a purchase requisition' })
  @ApiResponse({ status: 200, description: 'Requisition rejected successfully' })
  async rejectRequisition(
    @Param('id') id: string,
    @Body() body: { reason: string }
  ) {
    const userId = 'current-user-id';
    return this.requisitionService.rejectRequisition(id, userId, body.reason);
  }

  @Post(':id/cancel')
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a purchase requisition' })
  @ApiResponse({ status: 200, description: 'Requisition cancelled successfully' })
  async cancelRequisition(
    @Param('id') id: string,
    @Body() body: { reason: string }
  ) {
    const userId = 'current-user-id';
    return this.requisitionService.cancelRequisition(id, userId, body.reason);
  }

  @Get()
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Query purchase requisitions' })
  @ApiResponse({ status: 200, description: 'Requisitions retrieved successfully' })
  async queryRequisitions(@Query() query: RequisitionQueryDto) {
    return this.requisitionService.queryRequisitions(query);
  }

  @Post(':id/validate')
  @Roles('USER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Validate requisition against business rules' })
  @ApiResponse({ status: 200, description: 'Validation completed' })
  async validateRequisition(@Param('id') id: string) {
    return this.requisitionService.validateRequisition(id);
  }

  @Get(':id/budget')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Check budget availability for requisition' })
  @ApiResponse({ status: 200, description: 'Budget check completed' })
  async checkBudgetAvailability(@Param('id') id: string) {
    return this.requisitionService.checkBudgetAvailability(id);
  }
}