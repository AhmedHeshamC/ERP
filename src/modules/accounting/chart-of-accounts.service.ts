import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateChartOfAccountsDto } from './dto/create-chart-of-accounts.dto';
import { UpdateChartOfAccountsDto } from './dto/update-chart-of-accounts.dto';
import { AccountType } from './enums/accounting.enum';

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createChartOfAccountsDto: CreateChartOfAccountsDto, createdBy: string) {
    // Check if account code already exists
    const existingAccount = await this.prisma.chartOfAccounts.findUnique({
      where: { code: createChartOfAccountsDto.code },
    });

    if (existingAccount) {
      throw new ConflictException(`Account with code ${createChartOfAccountsDto.code} already exists`);
    }

    // Determine level based on parent
    let level = 0;
    if (createChartOfAccountsDto.parentId) {
      const parent = await this.prisma.chartOfAccounts.findUnique({
        where: { id: createChartOfAccountsDto.parentId },
      });
      level = parent ? parent.level + 1 : 0;
    }

    return this.prisma.chartOfAccounts.create({
      data: {
        ...createChartOfAccountsDto,
        createdBy,
        level,
      },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    type?: AccountType;
    search?: string;
  }) {
    const { skip = 0, take = 10, type, search } = params;

    const where: any = { isActive: true };

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      this.prisma.chartOfAccounts.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.chartOfAccounts.count({ where }),
    ]);

    return {
      accounts,
      total,
    };
  }

  async findOne(id: string) {
    const account = await this.prisma.chartOfAccounts.findUnique({
      where: { id, isActive: true },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(id: string, updateChartOfAccountsDto: UpdateChartOfAccountsDto, updatedBy: string) {
    const existingAccount = await this.prisma.chartOfAccounts.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    if (existingAccount.isSystem) {
      throw new ForbiddenException('System accounts cannot be modified');
    }

    return this.prisma.chartOfAccounts.update({
      where: { id },
      data: {
        ...updateChartOfAccountsDto,
        updatedBy,
      },
    });
  }

  async remove(id: string, deletedBy: string) {
    const existingAccount = await this.prisma.chartOfAccounts.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    if (existingAccount.isSystem) {
      throw new ForbiddenException('System accounts cannot be deleted');
    }

    // Soft delete
    return this.prisma.chartOfAccounts.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: deletedBy,
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.chartOfAccounts.findUnique({
      where: { code, isActive: true },
    });
  }

  async findChildren(parentId: string) {
    return this.prisma.chartOfAccounts.findMany({
      where: { parentId, isActive: true },
      orderBy: { code: 'asc' },
    });
  }
}