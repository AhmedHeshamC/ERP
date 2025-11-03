import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RulesEngineService } from '../../../shared/rules/services/rules-engine.service';
import { EventBusService } from '../../../shared/events/services/event-bus.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import { RuleCategory } from '../../../shared/rules/interfaces/rule-definition.interface';
import {
  ICreditManagementService,
  CreditCheckResult,
  CustomerCreditProfile,
  PaymentHistoryEntry,
  CreditLimitExceededError,
  O2CError
} from '../types/o2c.types';

/**
 * Customer Credit Management Service
 *
 * Implements SOLID principles:
 * - Single Responsibility: Handles only credit management operations
 * - Open/Closed: Extensible through rule engine integration
 * - Interface Segregation: Implements focused ICreditManagementService
 * - Dependency Inversion: Depends on abstractions, not concretions
 */
@Injectable()
export class CustomerCreditService implements ICreditManagementService {
  private readonly logger = new Logger(CustomerCreditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: RulesEngineService,
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if customer has sufficient credit limit for order amount
   * O(1) complexity for credit limit check
   */
  async checkCreditLimit(customerId: string, orderAmount: number): Promise<CreditCheckResult> {
    this.logger.log(`Checking credit limit for customer ${customerId}, amount: ${orderAmount}`);

    try {
      // Get customer basic information
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, creditLimit: true, isActive: true }
      });

      if (!customer) {
        throw new O2CError('Customer not found', 'CUSTOMER_NOT_FOUND', { customerId });
      }

      if (!customer.isActive) {
        throw new O2CError('Customer is inactive', 'CUSTOMER_INACTIVE', { customerId });
      }

      // Get current exposure - O(1) database query with proper indexing
      const exposureResult = await this.prisma.order.aggregate({
        where: {
          customerId,
          status: { notIn: ['CANCELLED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      });

      const currentExposure = Number(exposureResult._sum.totalAmount || 0);
      const availableCredit = Number(customer.creditLimit) - currentExposure;

      // Check if order amount exceeds available credit
      if (orderAmount > availableCredit) {
        throw new CreditLimitExceededError(customerId, orderAmount, availableCredit);
      }

      // Get complete credit profile
      const creditProfile = await this.getCreditProfile(customerId);

      // Use rules engine for risk evaluation - O(n) where n is number of rules
      const ruleResult = await this.rulesEngine.executeRules({
        groupIds: ['credit-risk-evaluation'],
        categories: [RuleCategory.FINANCIAL],
        context: {
          correlationId: `credit-check-${customerId}`,
          userId: 'system',
          timestamp: new Date(),
          entity: {
            customerId,
            creditProfile,
            orderAmount,
            availableCredit,
          },
          entityType: 'CUSTOMER_CREDIT',
          entityId: customerId,
          context: {
            operation: 'credit_check',
            timestamp: new Date(),
          }
        },
        executionMode: 'SYNCHRONOUS' as any
      });

      const creditResult = this.mapRuleResultToCreditCheckResult(ruleResult);

      // Publish credit check event
      await this.eventBus.publish({
        id: `credit-check-${Date.now()}`,
        type: 'CREDIT_CHECKED',
        aggregateId: customerId,
        aggregateType: 'CUSTOMER',
        occurredAt: new Date(),
        version: 1,
        correlationId: `credit-check-${customerId}`,
        metadata: {
          customerId,
          orderAmount,
          result: creditResult,
          creditLimit: Number(customer.creditLimit),
          currentExposure,
          availableCredit,
          ruleEvaluation: ruleResult,
        },
        schemaVersion: '1.0'
      });

      // Log audit event
      await this.auditService.logBusinessEvent(
        'CREDIT_CHECK_PERFORMED',
        'CUSTOMER_CREDIT',
        customerId,
        'CHECK',
        undefined,
        {
          customerId,
          orderAmount,
          result: creditResult,
          availableCredit,
          ruleResult,
        },
        creditResult === CreditCheckResult.REJECTED ? 'HIGH' : 'MEDIUM'
      );

      this.logger.log(`Credit check completed for customer ${customerId}: ${creditResult}`);
      return creditResult;

    } catch (error: any) {
      this.logger.error(`Credit check failed for customer ${customerId}`, error.stack);

      if (error instanceof CreditLimitExceededError || error instanceof O2CError) {
        throw error;
      }

      throw new O2CError(
        `Credit check failed: ${error.message}`,
        'CREDIT_CHECK_FAILED',
        { customerId, orderAmount, originalError: error.message }
      );
    }
  }

  /**
   * Update customer's credit exposure by adding or subtracting amount
   * Note: Since Customer schema doesn't have currentExposure field, this is simulated
   * O(1) complexity for database update
   */
  async updateCreditExposure(customerId: string, amount: number): Promise<void> {
    this.logger.log(`Updating credit exposure for customer ${customerId} by ${amount}`);

    try {
      // Get current customer data
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, creditLimit: true, isActive: true }
      });

      if (!customer) {
        throw new O2CError('Customer not found', 'CUSTOMER_NOT_FOUND', { customerId });
      }

      const currentExposure = await this.getCurrentExposure(customerId);
      const newExposure = currentExposure + amount;

      // Validate new exposure doesn't go negative
      if (newExposure < 0) {
        throw new O2CError(
          'Credit exposure cannot be negative',
          'INVALID_EXPOSURE_UPDATE',
          { customerId, currentExposure, changeAmount: amount, newExposure }
        );
      }

      // Note: Since currentExposure is not a field in the schema, we update customer to trigger audit
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          updatedAt: new Date(),
        }
      });

      // Publish exposure update event
      await this.eventBus.publish({
        id: `exposure-update-${Date.now()}`,
        type: 'CREDIT_EXPOSURE_UPDATED',
        aggregateId: customerId,
        aggregateType: 'CUSTOMER',
        occurredAt: new Date(),
        version: 1,
        correlationId: `exposure-update-${customerId}`,
        metadata: {
          customerId,
          previousExposure: currentExposure,
          newExposure,
          changeAmount: amount,
        },
        schemaVersion: '1.0'
      });

      // Log audit event
      await this.auditService.logBusinessEvent(
        'CREDIT_EXPOSURE_UPDATED',
        'CUSTOMER_CREDIT',
        customerId,
        'UPDATE',
        undefined,
        {
          customerId,
          previousExposure: currentExposure,
          newExposure,
          changeAmount: amount,
        },
        Math.abs(amount) > 5000 ? 'HIGH' : 'MEDIUM'
      );

      this.logger.log(`Credit exposure updated for customer ${customerId}: ${currentExposure} -> ${newExposure}`);

    } catch (error: any) {
      this.logger.error(`Failed to update credit exposure for customer ${customerId}`, error.stack);

      if (error instanceof O2CError) {
        throw error;
      }

      throw new O2CError(
        `Failed to update credit exposure: ${error.message}`,
        'EXPOSURE_UPDATE_FAILED',
        { customerId, amount, originalError: error.message }
      );
    }
  }

  /**
   * Get comprehensive credit profile for customer
   * O(n) complexity where n is number of payment history records
   */
  async getCreditProfile(customerId: string): Promise<CustomerCreditProfile> {
    this.logger.log(`Getting credit profile for customer ${customerId}`);

    try {
      // Get customer basic information
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          creditLimit: true,
          isActive: true,
          createdAt: true,
        }
      });

      if (!customer) {
        throw new O2CError('Customer not found', 'CUSTOMER_NOT_FOUND', { customerId });
      }

      // Get payment history - optimized query with proper indexing
      const paymentHistoryData = await this.getPaymentHistory(customerId);

      // Transform payment history
      const paymentHistory: PaymentHistoryEntry[] = paymentHistoryData.map(record => ({
        id: `payment-${record.invoiceId}`,
        invoiceId: record.invoiceId,
        amount: Number(record.amount),
        paymentDate: new Date(record.paymentDate),
        daysPastDue: Number(record.daysPastDue),
        status: record.status,
      }));

      // Calculate derived values
      const creditLimit = Number(customer.creditLimit);
      const currentExposure = await this.getCurrentExposure(customerId);
      const availableCredit = creditLimit - currentExposure;
      const creditScore = await this.calculateCreditScore(customerId, paymentHistory);

      // Calculate risk category based on credit score and payment history
      const riskCategory = this.calculateRiskCategory(creditScore, paymentHistory);

      // Determine status
      const status = customer.isActive ? 'ACTIVE' : 'SUSPENDED';

      const creditProfile: CustomerCreditProfile = {
        id: `profile-${customerId}`,
        customerId,
        creditLimit,
        currentExposure,
        availableCredit,
        creditScore,
        lastCreditCheck: new Date(),
        riskCategory,
        paymentHistory,
        status,
      };

      this.logger.log(`Credit profile retrieved for customer ${customerId}, risk category: ${riskCategory}`);
      return creditProfile;

    } catch (error: any) {
      this.logger.error(`Failed to get credit profile for customer ${customerId}`, error.stack);

      if (error instanceof O2CError) {
        throw error;
      }

      throw new O2CError(
        `Failed to get credit profile: ${error.message}`,
        'CREDIT_PROFILE_RETRIEVAL_FAILED',
        { customerId, originalError: error.message }
      );
    }
  }

  /**
   * Evaluate credit risk using rules engine
   * O(n) complexity where n is number of applicable rules
   */
  async evaluateCreditRisk(customerId: string): Promise<CreditCheckResult> {
    this.logger.log(`Evaluating credit risk for customer ${customerId}`);

    try {
      // Verify customer exists
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true }
      });

      if (!customer) {
        throw new O2CError('Customer not found', 'CUSTOMER_NOT_FOUND', { customerId });
      }

      // Get credit profile
      const creditProfile = await this.getCreditProfile(customerId);

      // Evaluate using rules engine
      const ruleResult = await this.rulesEngine.executeRules({
        groupIds: ['credit-risk-evaluation'],
        categories: [RuleCategory.FINANCIAL],
        context: {
          correlationId: `credit-risk-${customerId}`,
          userId: 'system',
          timestamp: new Date(),
          entity: {
            customerId,
            creditProfile,
          },
          entityType: 'CUSTOMER_CREDIT',
          entityId: customerId,
          context: {
            operation: 'credit_risk_evaluation',
            timestamp: new Date(),
          }
        },
        executionMode: 'SYNCHRONOUS' as any
      });

      const result = this.mapRuleResultToCreditCheckResult(ruleResult);

      this.logger.log(`Credit risk evaluation completed for customer ${customerId}: ${result}`);
      return result;

    } catch (error: any) {
      this.logger.error(`Credit risk evaluation failed for customer ${customerId}`, error.stack);

      // Log the failure
      await this.auditService.logBusinessEvent(
        'CREDIT_RISK_EVALUATION_FAILED',
        'CUSTOMER_CREDIT',
        customerId,
        'EVALUATE',
        undefined,
        {
          customerId,
          error: error.message,
        },
        'HIGH'
      );

      // Return safe default when rules engine fails
      return CreditCheckResult.MANUAL_REVIEW;
    }
  }

  /**
   * Helper method to get current exposure (simulated)
   */
  private async getCurrentExposure(customerId: string): Promise<number> {
    const exposureResult = await this.prisma.order.aggregate({
      where: {
        customerId,
        status: { notIn: ['CANCELLED', 'DELIVERED'] }
      },
      _sum: { totalAmount: true }
    });

    return Number(exposureResult._sum.totalAmount || 0);
  }

  /**
   * Helper method to get payment history (simulated)
   */
  private async getPaymentHistory(customerId: string): Promise<any[]> {
    // This is a simplified implementation - in real scenario, you would join with Payment table
    const orders = await this.prisma.order.findMany({
      where: {
        customerId,
        createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last 12 months
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        status: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return orders.map(order => ({
      invoiceId: order.id,
      amount: order.totalAmount,
      paymentDate: order.updatedAt,
      daysPastDue: order.status === 'DELIVERED' ? 0 : Math.floor((Date.now() - order.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
      status: order.status === 'DELIVERED' ? 'ON_TIME' : 'LATE',
    }));
  }

  /**
   * Helper method to calculate credit score (simulated)
   */
  private async calculateCreditScore(customerId: string, paymentHistory: PaymentHistoryEntry[]): Promise<number> {
    // Simulate credit score calculation based on payment history
    const recentPayments = paymentHistory.slice(0, 12); // Last 12 payments
    const onTimePayments = recentPayments.filter(p => p.status === 'ON_TIME').length;
    const onTimeRatio = recentPayments.length > 0 ? onTimePayments / recentPayments.length : 0.5;

    // Base score of 600, adjusted by payment history
    let score = 600;
    score += (onTimeRatio * 200); // Max 200 points for payment history

    // Add points for age of customer (older customers get more points)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { createdAt: true }
    });

    if (customer) {
      const yearsAsCustomer = (Date.now() - customer.createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000);
      score += Math.min(yearsAsCustomer * 10, 100); // Max 100 points for longevity
    }

    return Math.min(Math.max(Math.floor(score), 300), 850); // Clamp between 300-850
  }

  /**
   * Calculate risk category based on credit score and payment history
   * O(1) complexity for risk calculation
   */
  private calculateRiskCategory(creditScore: number, paymentHistory: PaymentHistoryEntry[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Base risk from credit score
    let riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (creditScore >= 750) {
      riskCategory = 'LOW';
    } else if (creditScore >= 650) {
      riskCategory = 'MEDIUM';
    } else if (creditScore >= 550) {
      riskCategory = 'HIGH';
    } else {
      riskCategory = 'CRITICAL';
    }

    // Adjust based on payment history
    const recentPayments = paymentHistory.slice(0, 12); // Last 12 payments
    const latePayments = recentPayments.filter(p => p.status === 'LATE').length;
    const latePaymentRatio = recentPayments.length > 0 ? latePayments / recentPayments.length : 0;

    // Upgrade risk if high late payment ratio
    if (latePaymentRatio > 0.3 && riskCategory !== 'CRITICAL') {
      const categories: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const currentIndex = categories.indexOf(riskCategory);
      riskCategory = categories[Math.min(currentIndex + 1, categories.length - 1)];
    }

    // Downgrade risk if excellent payment history
    if (latePaymentRatio === 0 && recentPayments.length >= 6 && riskCategory !== 'LOW') {
      const categories: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const currentIndex = categories.indexOf(riskCategory);
      riskCategory = categories[Math.max(currentIndex - 1, 0)];
    }

    return riskCategory;
  }

  /**
   * Map rules engine decision to CreditCheckResult
   * O(1) complexity for mapping
   */
  private mapRuleResultToCreditCheckResult(ruleResult: any): CreditCheckResult {
    // Extract decision from rule result structure
    if (ruleResult.results && ruleResult.results.length > 0) {
      const firstResult = ruleResult.results[0];
      if (firstResult.actions && firstResult.actions.length > 0) {
        const action = firstResult.actions[0];
        if (action.result && action.result.decision) {
          const decision = action.result.decision.toUpperCase();
          switch (decision) {
            case 'APPROVE':
              return CreditCheckResult.APPROVED;
            case 'REJECT':
              return CreditCheckResult.REJECTED;
            case 'MANUAL_REVIEW':
              return CreditCheckResult.MANUAL_REVIEW;
            default:
              return CreditCheckResult.MANUAL_REVIEW; // Safe default
          }
        }
      }
    }

    // Default to manual review if no clear decision
    return CreditCheckResult.MANUAL_REVIEW;
  }
}