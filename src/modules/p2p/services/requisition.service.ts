/**
 * Purchase Requisition Service
 * Following SOLID principles with Single Responsibility for requisition management
 * GREEN PHASE: Implementation to pass TDD tests
 */

import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IP2PWorkflowService } from '../interfaces/p2p.service.interface';
import { IP2PEventService } from '../interfaces/p2p.service.interface';
import { IP2PConfigurationService } from '../interfaces/p2p.service.interface';
import {
  PurchaseRequisition,
  RequisitionItem,
  RequisitionApproval,
  CreateRequisitionDto,
  UpdateRequisitionDto,
  RequisitionQueryDto,
  P2PProcessState,
  RequisitionValidationError,
  P2P_CONSTANTS,
  P2PWorkflowContext
} from '../types/p2p.types';

@Injectable()
export class PurchaseRequisitionService {
  private readonly logger = new Logger(PurchaseRequisitionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly workflowService: IP2PWorkflowService,
    private readonly eventService: IP2PEventService,
    private readonly configService: IP2PConfigurationService,
    private readonly auditService: any
  ) {}

  /**
   * Create a new purchase requisition
   * Implements validation, business rules, and audit trail
   */
  async createRequisition(dto: CreateRequisitionDto, requestorId: string): Promise<PurchaseRequisition> {
    this.logger.log(`Creating purchase requisition for user: ${requestorId}`);

    // Validate input data
    await this.validateCreateRequisitionDto(dto);

    // Generate unique requisition number
    const requestNumber = await this.generateRequisitionNumber();

    // Calculate total amount
    const totalAmount = this.calculateTotalAmount(dto.items);

    return await this.prismaService.$transaction(async (tx) => {
      // Create main requisition record
      const requisition = await tx.purchaseRequisition.create({
        data: {
          requestNumber,
          title: dto.title,
          description: dto.description,
          requestorId,
          departmentId: dto.departmentId,
          priority: dto.priority,
          type: dto.type,
          status: P2PProcessState.DRAFT,
          totalAmount,
          currency: P2P_CONSTANTS.DEFAULT_CURRENCY,
          requiredDate: new Date(dto.requiredDate),
          justification: dto.justification,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create requisition items
      const items = await Promise.all(
        dto.items.map(item =>
          tx.requisitionItem.create({
            data: {
              requisitionId: requisition.id,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              estimatedPrice: item.estimatedPrice,
              currency: item.currency,
              uom: item.uom,
              specifications: item.specifications,
              preferredSupplier: item.preferredSupplier,
              suggestedSuppliers: item.suggestedSuppliers ? JSON.stringify(item.suggestedSuppliers) : '[]',
              category: item.category,
              requestedDeliveryDate: new Date(item.requestedDeliveryDate),
              notes: item.notes
            }
          })
        )
      );

      // Create initial approval workflow if needed
      await this.initializeApprovalWorkflow(requisition.id, totalAmount, tx);

      // Log audit event
      await this.auditService.logEvent({
        action: 'REQUISITION_CREATED',
        entityId: requisition.id,
        entityType: 'REQUISITION',
        userId: requestorId,
        details: { requestNumber, totalAmount, itemCount: items.length }
      });

      // Publish event
      await this.eventService.publishEvent({
        id: `evt-${Date.now()}`,
        eventType: 'REQUISITION_CREATED',
        entityType: 'REQUISITION',
        entityId: requisition.id,
        data: {
          requestNumber,
          requestorId,
          departmentId: dto.departmentId,
          totalAmount,
          itemCount: items.length
        },
        userId: requestorId,
        timestamp: new Date(),
        correlationId: requisition.id,
        source: 'P2P_MODULE',
        version: '1.0'
      });

      this.logger.log(`Successfully created requisition: ${requestNumber}`);

      return {
        ...requisition,
        totalAmount: Number(requisition.totalAmount),
        items: items.map(item => ({
          ...item,
          estimatedPrice: Number(item.estimatedPrice),
          unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
          suggestedSuppliers: item.suggestedSuppliers ? JSON.parse(item.suggestedSuppliers) : []
        })),
        approvals: [],
        attachments: []
      } as PurchaseRequisition;
    });
  }

  /**
   * Submit requisition for approval workflow
   */
  async submitRequisition(id: string, userId: string): Promise<PurchaseRequisition> {
    this.logger.log(`Submitting requisition ${id} by user ${userId}`);

    // Get existing requisition
    const requisition = await this.getRequisitionEntity(id);

    if (!requisition) {
      throw new NotFoundException(`Requisition with id ${id} not found`);
    }

    if (requisition.status !== P2PProcessState.DRAFT) {
      throw new ConflictException(`Requisition is already submitted or processed`);
    }

    // Update status
    const updatedRequisition = await this.prismaService.purchaseRequisition.update({
      where: { id },
      data: {
        status: P2PProcessState.SUBMITTED,
        submittedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Start approval workflow
    try {
      const workflowContext: P2PWorkflowContext = {
        processType: 'REQUISITION',
        entityId: id,
        entityData: updatedRequisition,
        initiatorId: userId,
        currentStep: 'SUBMISSION',
        variables: {
          totalAmount: requisition.totalAmount,
          departmentId: requisition.departmentId,
          priority: requisition.priority
        },
        metadata: {
          requestNumber: requisition.requestNumber
        },
        startTime: new Date(),
        correlationId: id
      };

      await this.workflowService.startWorkflow(workflowContext);
    } catch (error: any) {
      this.logger.error(`Failed to start workflow for requisition ${id}:`, error);

      // Publish workflow error event but don't fail the submission
      await this.eventService.publishEvent({
        id: `evt-${Date.now()}`,
        eventType: 'WORKFLOW_ERROR',
        entityType: 'REQUISITION',
        entityId: id,
        data: {
          error: error.message,
          workflowType: 'APPROVAL'
        },
        userId,
        timestamp: new Date(),
        correlationId: id,
        source: 'P2P_MODULE',
        version: '1.0'
      });
    }

    // Publish submission event
    await this.eventService.publishEvent({
      id: `evt-${Date.now()}`,
      eventType: 'REQUISITION_SUBMITTED',
      entityType: 'REQUISITION',
      entityId: id,
      data: {
        requestNumber: requisition.requestNumber,
        totalAmount: requisition.totalAmount
      },
      userId,
      timestamp: new Date(),
      correlationId: id,
      source: 'P2P_MODULE',
      version: '1.0'
    });

    return await this.getRequisition(id);
  }

  /**
   * Approve requisition
   */
  async approveRequisition(id: string, approverId: string, comments?: string): Promise<PurchaseRequisition> {
    this.logger.log(`Approving requisition ${id} by user ${approverId}`);

    const requisitionData = await this.getRequisitionEntity(id);
    if (!requisitionData) {
      throw new NotFoundException(`Requisition with id ${id} not found`);
    }

    if (requisitionData.status !== P2PProcessState.SUBMITTED) {
      throw new ConflictException(`Requisition is not in submitted status`);
    }

    // Get pending approvals for this user
    const pendingApprovals = await this.prismaService.requisitionApproval.findMany({
      where: {
        requisitionId: id,
        approverId,
        status: 'PENDING'
      }
    });

    if (pendingApprovals.length === 0) {
      throw new BadRequestException(`User ${approverId} is not authorized to approve this requisition`);
    }

    // Update approval status
    const approval = pendingApprovals[0];
    await this.prismaService.requisitionApproval.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        comments,
        approvedAt: new Date()
      }
    });

    // Check if all required approvals are completed
    const allApprovals = await this.prismaService.requisitionApproval.findMany({
      where: { requisitionId: id }
    });

    const requiredApprovals = allApprovals.filter(a => a.isRequired);
    const completedApprovals = requiredApprovals.filter(a => a.status === 'APPROVED');

    let finalStatus = P2PProcessState.SUBMITTED;
    let approvedAt = undefined;

    if (completedApprovals.length === requiredApprovals.length) {
      finalStatus = P2PProcessState.APPROVED;
      approvedAt = new Date();
    }

    // Update requisition status
    await this.prismaService.purchaseRequisition.update({
      where: { id },
      data: {
        status: finalStatus,
        approvedAt,
        updatedAt: new Date()
      }
    });

    // Publish approval event
    await this.eventService.publishEvent({
      id: `evt-${Date.now()}`,
      eventType: 'REQUISITION_APPROVED',
      entityType: 'REQUISITION',
      entityId: id,
      data: {
        approverId,
        approvalLevel: approval.level,
        finalStatus,
        comments
      },
      userId: approverId,
      timestamp: new Date(),
      correlationId: id,
      source: 'P2P_MODULE',
      version: '1.0'
    });

    const requisition = await this.getRequisition(id);
    return {
      ...requisition,
      totalAmount: Number(requisition.totalAmount),
      approvals: requisition.approvals.map((approval: any) => ({
        ...approval
      }))
    } as PurchaseRequisition;
  }

  /**
   * Get a specific requisition
   */
  async getRequisition(id: string): Promise<PurchaseRequisition> {
    const requisitionData = await this.prismaService.purchaseRequisition.findUnique({
      where: { id },
      include: {
        items: true,
        approvals: true
      }
    });

    if (!requisitionData) {
      throw new NotFoundException(`Requisition with id ${id} not found`);
    }

    return {
      ...requisitionData,
      totalAmount: Number(requisitionData.totalAmount),
      items: requisitionData.items?.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
        estimatedPrice: item.estimatedPrice ? Number(item.estimatedPrice) : undefined
      })) || [],
      approvals: requisitionData.approvals || [],
      attachments: []
    } as unknown as PurchaseRequisition;
  }

  /**
   * Query requisitions with filtering and pagination
   */
  async queryRequisitions(query: RequisitionQueryDto): Promise<{ items: PurchaseRequisition[]; total: number }> {
    const {
      status,
      priority,
      type,
      requestorId,
      departmentId,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    // Build where clause
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;
    if (requestorId) where.requestorId = requestorId;
    if (departmentId) where.departmentId = departmentId;

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requestNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await this.prismaService.purchaseRequisition.count({ where });

    // Get items with pagination and sorting
    const items = await this.prismaService.purchaseRequisition.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        approvals: true
      }
    });

    return {
      items: items.map(item => ({
        ...item,
        totalAmount: Number(item.totalAmount),
        items: item.items?.map((reqItem: any) => ({
          ...reqItem,
          unitPrice: reqItem.unitPrice ? Number(reqItem.unitPrice) : undefined,
          estimatedPrice: reqItem.estimatedPrice ? Number(reqItem.estimatedPrice) : undefined
        })) || [],
        approvals: item.approvals || [],
        attachments: []
      })) as PurchaseRequisition[],
      total
    };
  }

  /**
   * Validate requisition against business rules
   */
  async validateRequisition(id: string): Promise<{ valid: boolean; errors: string[] }> {
    const requisition = await this.getRequisitionEntity(id);
    if (!requisition) {
      return { valid: false, errors: ['Requisition not found'] };
    }

    const errors: string[] = [];

    // Check for duplicate requisitions
    const duplicates = await this.findDuplicateRequisitions(requisition);
    if (duplicates.length > 0) {
      errors.push('Duplicate requisition found for similar items');
    }

    // Validate items
    const items = await this.prismaService.requisitionItem.findMany({
      where: { requisitionId: id }
    });

    if (items.length === 0) {
      errors.push('Requisition must have at least one item');
    }

    // Validate business rules
    if (requisition.totalAmount <= 0) {
      errors.push('Total amount must be greater than zero');
    }

    if (new Date(requisition.requiredDate) <= new Date()) {
      errors.push('Required date must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check budget availability for requisition
   */
  async checkBudgetAvailability(requisitionId: string): Promise<{ available: boolean; amount: number }> {
    const requisition = await this.getRequisitionEntity(requisitionId);
    if (!requisition) {
      return { available: false, amount: 0 };
    }

    // TODO: Implement actual budget checking logic
    // This would integrate with budget/financial system
    const budgetLimit = 100000; // Example budget limit
    const currentSpend = 25000; // Example current spend

    const availableAmount = budgetLimit - currentSpend;
    const available = requisition.totalAmount <= availableAmount;

    return {
      available,
      amount: availableAmount
    };
  }

  // Private helper methods

  private async validateCreateRequisitionDto(dto: CreateRequisitionDto): Promise<void> {
    const errors: string[] = [];

    if (!dto.title || dto.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!dto.departmentId) {
      errors.push('Department ID is required');
    }

    if (!dto.items || dto.items.length === 0) {
      errors.push('Requisition must have at least one item');
    }

    if (dto.requiredDate && new Date(dto.requiredDate) <= new Date()) {
      errors.push('Required date must be in the future');
    }

    // Validate items
    if (dto.items) {
      for (let i = 0; i < dto.items.length; i++) {
      const index = i;
      const item = dto.items[i];
        if (!item.description || item.description.trim().length === 0) {
          errors.push(`Item ${index + 1}: Description is required`);
        }

        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be positive`);
        }

        if (!item.estimatedPrice || item.estimatedPrice <= 0) {
          errors.push(`Item ${index + 1}: Estimated price must be positive`);
        }

        if (!item.category) {
          errors.push(`Item ${index + 1}: Category is required`);
        }

        if (!item.requestedDeliveryDate) {
          errors.push(`Item ${index + 1}: Requested delivery date is required`);
        }
      }
    }

    if (errors.length > 0) {
      throw new RequisitionValidationError(`Validation failed: ${errors.join(', ')}`, { errors });
    }
  }

  private async generateRequisitionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}`;

    // Get the next sequence number
    const lastRequisition = await this.prismaService.purchaseRequisition.findFirst({
      where: {
        requestNumber: {
          startsWith: prefix
        }
      },
      orderBy: {
        requestNumber: 'desc'
      }
    });

    let sequence = 1;
    if (lastRequisition) {
      const lastSequence = parseInt(lastRequisition.requestNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  private calculateTotalAmount(items: CreateRequisitionDto['items']): number {
    return items.reduce((total, item) => {
      return total + (item.estimatedPrice * item.quantity);
    }, 0);
  }

  private async initializeApprovalWorkflow(requisitionId: string, totalAmount: number, tx: any): Promise<void> {
    // Get approval rules
    const approvalRules = await this.configService.getConfiguration('approvalRules');
    const applicableRules = approvalRules.filter((rule: any) =>
      rule.processType === 'REQUISITION' && this.evaluateCondition(rule.condition, { totalAmount })
    );

    // Create approval records
    for (const rule of applicableRules) {
      for (const approver of rule.approvers) {
        await tx.requisitionApproval.create({
          data: {
            requisitionId,
            approverId: approver.userId,
            approverName: approver.userId, // TODO: Get user name
            approverRole: approver.userId, // TODO: Get user role
            status: 'PENDING',
            level: approver.level,
            isRequired: approver.required,
            createdAt: new Date()
          }
        });
      }
    }
  }

  private evaluateCondition(condition: string, variables: any): boolean {
    // Simple condition evaluation - in real implementation, use proper expression engine
    try {
      // Example: "totalAmount > 1000"
      if (condition.includes('totalAmount >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return variables.totalAmount > threshold;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async getRequisitionEntity(id: string): Promise<any> {
    return await this.prismaService.purchaseRequisition.findUnique({
      where: { id }
    });
  }

  private async findDuplicateRequisitions(requisition: any): Promise<any[]> {
    // Simple duplicate check based on title and department
    return await this.prismaService.purchaseRequisition.findMany({
      where: {
        id: { not: requisition.id },
        departmentId: requisition.departmentId,
        title: { contains: requisition.title.split(' ')[0] }, // Simple keyword match
        status: { in: [P2PProcessState.APPROVED, P2PProcessState.SUBMITTED] },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });
  }

  // Additional methods that would be implemented based on interface requirements

  async updateRequisition(_id: string, _dto: UpdateRequisitionDto, _userId: string): Promise<PurchaseRequisition> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async rejectRequisition(_id: string, _approverId: string, _reason: string): Promise<PurchaseRequisition> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async cancelRequisition(_id: string, _userId: string, _reason: string): Promise<PurchaseRequisition> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async addRequisitionItem(_requisitionId: string, _item: Omit<RequisitionItem, 'id' | 'requisitionId'>): Promise<RequisitionItem> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async updateRequisitionItem(_itemId: string, _updates: Partial<RequisitionItem>): Promise<RequisitionItem> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async removeRequisitionItem(_itemId: string): Promise<void> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async getApprovalHistory(_requisitionId: string): Promise<RequisitionApproval[]> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async getNextApprovalLevel(_requisitionId: string): Promise<number> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }

  async canApprove(_requisitionId: string, _userId: string): Promise<boolean> {
    // Implementation would go here
    throw new Error('Method not implemented');
  }
}