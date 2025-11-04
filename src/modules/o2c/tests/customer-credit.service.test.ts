import { expect } from 'chai';
import * as sinon from 'sinon';
import { CustomerCreditService } from '../services/customer-credit.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RulesEngineService } from '../../../shared/rules/services/rules-engine.service';
import { EventBusService } from '../../../shared/events/services/event-bus.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import {
  CreditCheckResult,
  CustomerCreditProfile,
  CreditLimitExceededError,
  O2CError
} from '../types/o2c.types';

describe('CustomerCreditService', () => {
  let service: CustomerCreditService;
  let sandbox: sinon.SinonSandbox;
  let prismaService: PrismaService;
  let rulesEngineService: RulesEngineService;
  let eventBusService: EventBusService;
  let auditService: AuditService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock dependencies
    prismaService = {
      customer: {
        findUnique: sandbox.stub(),
        update: sandbox.stub(),
      },
      order: {
        findMany: sandbox.stub(),
        aggregate: sandbox.stub(),
      },
      $queryRaw: sandbox.stub(),
    } as any;

    rulesEngineService = {
      executeRules: sandbox.stub(),
    } as any;

    eventBusService = {
      publish: sandbox.stub(),
    } as any;

    auditService = {
      logBusinessEvent: sandbox.stub(),
    } as any;

    service = new CustomerCreditService(
      prismaService,
      rulesEngineService,
      eventBusService,
      auditService
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkCreditLimit', () => {
    it('should approve credit for low-risk customer with sufficient limit', async () => {
      // Arrange
      const customerId = 'cust-001';
      const orderAmount = 5000;

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        isActive: true,
        paymentHistory: [],
      };

      const mockCurrentExposure = 2000;

      const mockRuleResult = {
        decision: 'APPROVE',
        confidence: 0.95,
        explanation: 'Low risk customer with good payment history',
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.order.aggregate as any).resolves({ _sum: { totalAmount: mockCurrentExposure } });
      (rulesEngineService.executeRules as any).resolves(mockRuleResult);
      (eventBusService.publish as any).resolves();
      (auditService.logBusinessEvent as any).resolves();

      // Act
      const result = await service.checkCreditLimit(customerId, orderAmount);

      // Assert
      expect(result).to.equal(CreditCheckResult.APPROVED);
      expect((prismaService.customer.findUnique as sinon.SinonStub).calledOnce).to.be.true;
      expect((prismaService.customer.findUnique as sinon.SinonStub).getCall(0).args[0]).to.deep.equal({
        where: { id: customerId },
        select: { id: true, creditLimit: true, isActive: true }
      });
      expect((rulesEngineService.executeRules as sinon.SinonStub).calledOnce).to.be.true;
      expect((eventBusService.publish as sinon.SinonStub).calledOnce).to.be.true;
      expect((auditService.logBusinessEvent as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should reject credit when order amount exceeds available credit', async () => {
      // Arrange
      const customerId = 'cust-002';
      const orderAmount = 15000;

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        isActive: true,
      };

      const mockCurrentExposure = 8000;

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.order.aggregate as any).resolves({ _sum: { totalAmount: mockCurrentExposure } });

      // Act & Assert
      try {
        await service.checkCreditLimit(customerId, orderAmount);
        expect.fail('Should have thrown CreditLimitExceededError');
      } catch (error) {
        expect(error).to.be.instanceOf(CreditLimitExceededError);
        const creditError = error as CreditLimitExceededError;
        expect(creditError.code).to.equal('CREDIT_LIMIT_EXCEEDED');
        expect(creditError.details).to.not.be.undefined;
        expect(creditError.details!.requestedAmount).to.equal(orderAmount);
        expect(creditError.details!.availableCredit).to.equal(2000);
      }
    });

    it('should require manual review for high-risk customers', async () => {
      // Arrange
      const customerId = 'cust-003';
      const orderAmount = 3000;

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        isActive: true,
      };

      const mockCurrentExposure = 1000;
      const mockRuleResult = {
        decision: 'MANUAL_REVIEW',
        confidence: 0.6,
        explanation: 'High risk customer with limited payment history',
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.order.aggregate as any).resolves({ _sum: { totalAmount: mockCurrentExposure } });
      (rulesEngineService.executeRules as any).resolves(mockRuleResult);
      (eventBusService.publish as any).resolves();
      (auditService.logBusinessEvent as any).resolves();

      // Act
      const result = await service.checkCreditLimit(customerId, orderAmount);

      // Assert
      expect(result).to.equal(CreditCheckResult.MANUAL_REVIEW);
      expect((eventBusService.publish as sinon.SinonStub).calledOnce).to.be.true;
      const publishCall = (eventBusService.publish as any).getCall(0);
      expect(publishCall.args[0]).to.have.property('type', 'CREDIT_CHECKED');
      expect(publishCall.args[0].metadata).to.deep.include({
        customerId,
        orderAmount,
        result: CreditCheckResult.MANUAL_REVIEW
      });
    });

    it('should reject credit for inactive customers', async () => {
      // Arrange
      const customerId = 'cust-004';
      const orderAmount = 1000;

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        isActive: false,
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);

      // Act & Assert
      try {
        await service.checkCreditLimit(customerId, orderAmount);
        expect.fail('Should have thrown O2CError');
      } catch (error) {
        expect(error).to.be.instanceOf(O2CError);
        const o2cError = error as O2CError;
        expect(o2cError.code).to.equal('CUSTOMER_INACTIVE');
        expect(o2cError.message).to.include('inactive');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const customerId = 'cust-005';
      const orderAmount = 1000;

      (prismaService.customer.findUnique as any).rejects(new Error('Database connection failed'));

      // Act & Assert
      try {
        await service.checkCreditLimit(customerId, orderAmount);
        expect.fail('Should have thrown O2CError');
      } catch (error) {
        expect(error).to.be.instanceOf(O2CError);
        const o2cError = error as O2CError;
        expect(o2cError.code).to.equal('CREDIT_CHECK_FAILED');
      }
    });
  });

  describe('updateCreditExposure', () => {
    it('should update credit exposure correctly for new order', async () => {
      // Arrange
      const customerId = 'cust-006';
      const amount = 5000;

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        currentExposure: 2000,
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.customer.update as any).resolves({ ...mockCustomer, currentExposure: 7000 });
      (eventBusService.publish as any).resolves();
      (auditService.logBusinessEvent as any).resolves();

      // Act
      await service.updateCreditExposure(customerId, amount);

      // Assert
      expect((prismaService.customer.update as sinon.SinonStub).calledOnce).to.be.true;
      const updateCall = (prismaService.customer.update as sinon.SinonStub).getCall(0);
      expect(updateCall.args[0]).to.deep.include({
        where: { id: customerId },
        data: {
          currentExposure: 7000,
        }
      });
      expect(updateCall.args[0].data.updatedAt).to.be.instanceOf(Date);
      // Verify event bus was called
      expect((eventBusService.publish as sinon.SinonStub).calledOnce).to.be.true;
      const publishCall = (eventBusService.publish as any).getCall(0);
      expect(publishCall.args[0]).to.have.property('type', 'CREDIT_EXPOSURE_UPDATED');
      expect(publishCall.args[0].metadata).to.deep.include({
        customerId,
        newExposure: 7000,
        changeAmount: amount
      });
    });

    it('should handle negative exposure updates (refunds/cancellations)', async () => {
      // Arrange
      const customerId = 'cust-007';
      const amount = -2000; // Refund

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        currentExposure: 8000,
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.customer.update as any).resolves({ ...mockCustomer, currentExposure: 6000 });
      (eventBusService.publish as any).resolves();
      (auditService.logBusinessEvent as any).resolves();

      // Act
      await service.updateCreditExposure(customerId, amount);

      // Assert
      expect((prismaService.customer.update as sinon.SinonStub).calledOnce).to.be.true;
      const updateCall = (prismaService.customer.update as sinon.SinonStub).getCall(0);
      expect(updateCall.args[0]).to.deep.include({
        where: { id: customerId },
        data: {
          currentExposure: 6000,
        }
      });
      expect(updateCall.args[0].data.updatedAt).to.be.instanceOf(Date);
    });

    it('should prevent exposure from going negative', async () => {
      // Arrange
      const customerId = 'cust-008';
      const amount = -10000; // Large refund

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        currentExposure: 2000,
      };

      (prismaService.customer.findUnique as any).resolves(mockCustomer);

      // Act & Assert
      try {
        await service.updateCreditExposure(customerId, amount);
        expect.fail('Should have thrown O2CError');
      } catch (error) {
        expect(error).to.be.instanceOf(O2CError);
        const o2cError = error as O2CError;
        expect(o2cError.code).to.equal('INVALID_EXPOSURE_UPDATE');
      }
    });
  });

  describe('getCreditProfile', () => {
    it('should return complete credit profile for customer', async () => {
      // Arrange
      const customerId = 'cust-009';

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        currentExposure: 3000,
        creditScore: 720,
        paymentHistory: [],
        createdAt: new Date('2023-01-01'),
      };

      const mockPaymentHistory = [
        {
          invoiceId: 'inv-001',
          amount: 1000,
          paymentDate: new Date('2023-06-15'),
          daysPastDue: 0,
          status: 'ON_TIME',
        },
        {
          invoiceId: 'inv-002',
          amount: 1500,
          paymentDate: new Date('2023-07-20'),
          daysPastDue: 5,
          status: 'LATE',
        },
      ];

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.$queryRaw as any).resolves(mockPaymentHistory);

      // Act
      const profile = await service.getCreditProfile(customerId);

      // Assert
      expect(profile.customerId).to.equal(customerId);
      expect(profile.creditLimit).to.equal(10000);
      expect(profile.currentExposure).to.equal(3000);
      expect(profile.availableCredit).to.equal(7000);
      expect(profile.creditScore).to.equal(720);
      expect(profile.paymentHistory).to.have.length(2);
      expect(profile.riskCategory).to.be.oneOf(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
      expect(profile.status).to.equal('ACTIVE');
    });

    it('should handle customer not found', async () => {
      // Arrange
      const customerId = 'cust-010';
      (prismaService.customer.findUnique as any).resolves(null);

      // Act & Assert
      try {
        await service.getCreditProfile(customerId);
        expect.fail('Should have thrown O2CError');
      } catch (error) {
        expect(error).to.be.instanceOf(O2CError);
        const o2cError = error as O2CError;
        expect(o2cError.code).to.equal('CUSTOMER_NOT_FOUND');
      }
    });

    it('should calculate risk category based on credit score and payment history', async () => {
      // Arrange
      const customerId = 'cust-011';

      const mockCustomer = {
        id: customerId,
        creditLimit: 10000,
        currentExposure: 8000,
        creditScore: 450, // Low credit score
        paymentHistory: [],
        createdAt: new Date('2023-01-01'),
      };

      const mockPaymentHistory = [
        {
          invoiceId: 'inv-001',
          amount: 1000,
          paymentDate: new Date('2023-06-15'),
          daysPastDue: 30,
          status: 'LATE',
        },
      ];

      (prismaService.customer.findUnique as any).resolves(mockCustomer);
      (prismaService.$queryRaw as any).resolves(mockPaymentHistory);

      // Act
      const profile = await service.getCreditProfile(customerId);

      // Assert
      expect(profile.riskCategory).to.be.oneOf(['HIGH', 'CRITICAL']);
    });
  });

  describe('evaluateCreditRisk', () => {
    it('should use rules engine to evaluate credit risk', async () => {
      // Arrange
      const customerId = 'cust-012';

      const mockCreditProfile: CustomerCreditProfile = {
        id: 'profile-012',
        customerId,
        creditLimit: 10000,
        currentExposure: 2000,
        availableCredit: 8000,
        creditScore: 750,
        lastCreditCheck: new Date(),
        riskCategory: 'LOW',
        paymentHistory: [],
        status: 'ACTIVE',
      };

      const mockRuleResult = {
        decision: 'APPROVE',
        confidence: 0.92,
        explanation: 'Excellent credit history and low utilization',
      };

      (prismaService.customer.findUnique as any).resolves({ id: customerId });
      sandbox.stub(service, 'getCreditProfile').resolves(mockCreditProfile);
      (rulesEngineService.executeRules as any).resolves(mockRuleResult);

      // Act
      const result = await service.evaluateCreditRisk(customerId);

      // Assert
      expect(result).to.equal(CreditCheckResult.APPROVED);
      expect((rulesEngineService.executeRules as sinon.SinonStub).calledOnce).to.be.true;
      const executeCall = (rulesEngineService.executeRules as any).getCall(0);
      expect(executeCall.args[0]).to.deep.include({
        groupIds: ['credit-risk-evaluation'],
      });
      expect(executeCall.args[0].context.entity).to.deep.include({
        customerId,
        creditProfile: mockCreditProfile,
      });
      expect(executeCall.args[0].context.timestamp).to.be.instanceOf(Date);
    });

    it('should handle rules engine failure gracefully', async () => {
      // Arrange
      const customerId = 'cust-013';

      const mockCreditProfile: CustomerCreditProfile = {
        id: 'profile-013',
        customerId,
        creditLimit: 10000,
        currentExposure: 2000,
        availableCredit: 8000,
        creditScore: 750,
        lastCreditCheck: new Date(),
        riskCategory: 'LOW',
        paymentHistory: [],
        status: 'ACTIVE',
      };

      (prismaService.customer.findUnique as any).resolves({ id: customerId });
      sandbox.stub(service, 'getCreditProfile').resolves(mockCreditProfile);
      (rulesEngineService.executeRules as any).rejects(new Error('Rules engine unavailable'));

      // Act
      const result = await service.evaluateCreditRisk(customerId);

      // Assert
      expect(result).to.equal(CreditCheckResult.MANUAL_REVIEW);
      expect((auditService.logBusinessEvent as sinon.SinonStub).calledOnce).to.be.true;
      const auditCall = (auditService.logBusinessEvent as any).getCall(0);
      expect(auditCall.args[0]).to.equal('CREDIT_RISK_EVALUATION_FAILED');
      expect(auditCall.args[4]).to.deep.include({
        customerId,
        error: 'Rules engine unavailable',
      });
    });
  });
});