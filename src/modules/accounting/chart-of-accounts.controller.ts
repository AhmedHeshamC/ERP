import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateChartOfAccountsDto } from './dto/create-chart-of-accounts.dto';
import { UpdateChartOfAccountsDto } from './dto/update-chart-of-accounts.dto';
import { AccountType } from './enums/accounting.enum';
import { JwtAuthGuard } from '../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/security/guards/roles.guard';
import { Roles } from '../../shared/security/decorators/roles.decorator';

@ApiTags('Chart of Accounts')
@Controller('chart-of-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new chart of accounts account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Account code already exists' })
  create(@Body() createChartOfAccountsDto: CreateChartOfAccountsDto, @Request() req) {
    return this.chartOfAccountsService.create(createChartOfAccountsDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all chart of accounts with pagination' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: any) {
    return this.chartOfAccountsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chart of accounts account by ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.chartOfAccountsService.findOne(id);
  }

  @Get('code/:code')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chart of accounts account by code' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiParam({ name: 'code', type: String })
  findByCode(@Param('code') code: string) {
    return this.chartOfAccountsService.findByCode(code);
  }

  @Get(':id/children')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get child accounts of a parent account' })
  @ApiResponse({ status: 200, description: 'Child accounts retrieved successfully' })
  @ApiParam({ name: 'id', type: String })
  findChildren(@Param('id') id: string) {
    return this.chartOfAccountsService.findChildren(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update chart of accounts account' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 403, description: 'System accounts cannot be modified' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() updateChartOfAccountsDto: UpdateChartOfAccountsDto, @Request() req) {
    return this.chartOfAccountsService.update(id, updateChartOfAccountsDto, req.user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete chart of accounts account (soft delete)' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 403, description: 'System accounts cannot be deleted' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string, @Request() req) {
    return this.chartOfAccountsService.remove(id, req.user.id);
  }
}