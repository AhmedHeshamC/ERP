import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CreateUserDto, UpdateUserDto, UserResponse, UserRole } from './dto/user.dto';

describe('UserService - Enterprise User Management', () => {
  let service: UserService;
  let prismaService: any;
  let securityService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: sinon.stub(),
        findFirst: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        findMany: sinon.stub(),
        count: sinon.stub(),
      },
      $transaction: sinon.stub(),
    };

    const mockSecurityService = {
      sanitizeInput: sinon.stub(),
      validateInput: sinon.stub(),
      isPasswordStrong: sinon.stub(),
      generateSecureToken: sinon.stub(),
      logSecurityEvent: sinon.stub(),
      hashPassword: sinon.stub(),
      verifyPassword: sinon.stub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      password: 'SecureP@ss123!',
      role: UserRole.USER,
    };

    const mockUser: UserResponse = {
      id: 'user-123',
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    it('should create a new user successfully following TDD Red-Green-Refactor', async () => {
      // Arrange - Following AAA pattern (Arrange, Act, Assert)
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(createUserDto);
      securityService.isPasswordStrong.returns({ isValid: true, errors: [] });
      securityService.hashPassword.resolves('hashed-password-123');
      prismaService.user.findFirst.resolves(null); // No existing user
      prismaService.$transaction.resolves(mockUser);
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await service.createUser(createUserDto);

      // Assert - Chai assertions with descriptive messages
      expect(result).to.be.an('object');
      expect(result.email).to.equal(createUserDto.email);
      expect(result.username).to.equal(createUserDto.username);
      expect(result.firstName).to.equal(createUserDto.firstName);
      expect(result.lastName).to.equal(createUserDto.lastName);
      expect(result.role).to.equal(createUserDto.role);
      expect(result.isActive).to.be.true;
      expect(result.isEmailVerified).to.be.false;

      // Verify security measures were applied
      expect(securityService.validateInput.calledOnce).to.be.true;
      expect(securityService.sanitizeInput.calledOnce).to.be.true;
      expect(securityService.isPasswordStrong.calledOnceWith(createUserDto.password)).to.be.true;
      expect(securityService.hashPassword.calledOnceWith(createUserDto.password)).to.be.true;
      expect(prismaService.user.findFirst.calledOnce).to.be.true;
      expect(prismaService.$transaction.calledOnce).to.be.true;
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
    });

    it('should throw ConflictException when user already exists', async () => {
      // Arrange - Security first: Check for existing user
      securityService.validateInput.reset();
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.reset();
      const sanitizedData = { ...createUserDto };
      securityService.sanitizeInput.returns(sanitizedData);

      // MOCK isPasswordStrong and hashPassword - THIS WAS THE MISSING PIECE!
      securityService.isPasswordStrong.reset();
      securityService.isPasswordStrong.returns({ isValid: true, errors: [] });
      securityService.hashPassword.reset();
      securityService.hashPassword.resolves('hashed-password-123');

      // Mock logSecurityEvent to avoid any issues there
      securityService.logSecurityEvent.reset();
      securityService.logSecurityEvent.resolves();

      // Reset and properly mock findFirst to return existing user
      prismaService.user.findFirst.reset();
      prismaService.user.findFirst.resolves({ ...mockUser });

      // Act & Assert - Follow enterprise error handling
      try {
        await service.createUser(createUserDto);
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error.message).to.include('already exists');
      }

      // Verify security logging
      expect(securityService.logSecurityEvent.called).to.be.true;
    });

    it('should throw BadRequestException for weak password', async () => {
      // Arrange - Password strength validation (OWASP A07)
      const weakPasswordDto = { ...createUserDto, password: '123' };
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(weakPasswordDto);
      securityService.isPasswordStrong.returns({
        isValid: false,
        errors: ['Password must be at least 8 characters', 'Password must contain uppercase letter'],
      });

      // Act & Assert
      try {
        await service.createUser(weakPasswordDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Password does not meet security requirements');
      }

      // Security logging for weak password attempt
      expect(securityService.logSecurityEvent.calledWith(
        'WEAK_PASSWORD_ATTEMPT',
        undefined,
        'system',
        'user-service',
        sinon.match.any
      )).to.be.true;
    });

    it('should throw BadRequestException for invalid input', async () => {
      // Arrange - Input validation (OWASP A03)
      securityService.validateInput.returns(false);

      // Act & Assert
      try {
        await service.createUser(createUserDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Invalid input data');
      }
    });
  });

  describe('findById', () => {
    const userId = 'user-123';
    const mockUser: UserResponse = {
      id: userId,
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    it('should return user when found', async () => {
      // Arrange
      prismaService.user.findUnique.resolves(mockUser);

      // Act
      const result = await service.findById(userId);

      // Assert
      expect(result).to.deep.equal(mockUser);
      expect(prismaService.user.findUnique.calledWith({
        where: { id: userId },
        select: sinon.match.object, // Should exclude sensitive fields
      })).to.be.true;
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      prismaService.user.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.findById(userId);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include(`User with id ${userId} not found`);
      }
    });
  });

  describe('updateUser', () => {
    const userId = 'user-123';
    const updateUserDto: UpdateUserDto = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
    };

    const existingUser: UserResponse = {
      id: userId,
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    it('should update user successfully', async () => {
      // Arrange
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(updateUserDto);

      // Reset mocks to avoid interference
      prismaService.user.findUnique.reset();
      prismaService.user.update.reset();

      // Mock findUnique to return existing user
      prismaService.user.findUnique.resolves(existingUser);

      const updatedUser = { ...existingUser, ...updateUserDto, updatedAt: new Date() };
      // Mock update to return updated user
      prismaService.user.update.resolves(updatedUser);
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await service.updateUser(userId, updateUserDto);

      // Assert
      expect(result.firstName).to.equal(updateUserDto.firstName);
      expect(result.lastName).to.equal(updateUserDto.lastName);
      expect(prismaService.user.update.calledOnce).to.be.true;
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(updateUserDto);
      prismaService.user.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.updateUser(userId, updateUserDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('Security Integration Tests', () => {
    it('should sanitize all input data to prevent XSS (OWASP A03)', async () => {
      // Arrange - Test XSS prevention
      const maliciousDto: CreateUserDto = {
        email: 'john.doe@company.com',
        username: 'johndoe',
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe',
        password: 'SecureP@ss123!',
        role: UserRole.USER,
      };
      const sanitizedDto = {
        ...maliciousDto,
        firstName: 'John', // Script removed
      };

      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(sanitizedDto);
      securityService.isPasswordStrong.returns({ isValid: true, errors: [] });
      securityService.hashPassword.resolves('hashed-password-123');
      prismaService.user.findFirst.resolves(null);
      prismaService.$transaction.resolves(sinon.match.any);

      // Act
      await service.createUser(maliciousDto);

      // Assert
      expect(securityService.sanitizeInput.calledWith(maliciousDto)).to.be.true;
    });

    it('should log all security-sensitive operations (OWASP A09)', async () => {
      // Arrange - Test security logging
      const testUserData = {
        email: 'test@company.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecureP@ss123!',
        role: UserRole.USER,
      };

      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(testUserData); // Return proper object with valid password
      securityService.isPasswordStrong.returns({ isValid: true, errors: [] });
      securityService.hashPassword.resolves('hashed-password-123');
      prismaService.user.findFirst.resolves(null);
      prismaService.$transaction.resolves({ ...testUserData, id: 'test-id', isActive: true, isEmailVerified: false, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null });
      securityService.logSecurityEvent.resolves();

      // Act
      await service.createUser(testUserData);

      // Assert - Verify comprehensive security logging
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
      const [event, userId, ip, userAgent, details] = securityService.logSecurityEvent.getCall(0).args;
      expect(event).to.equal('USER_CREATED');
      expect(ip).to.equal('system');
      expect(userAgent).to.equal('user-service');
      expect(details).to.be.an('object');
      expect(details).to.have.property('email');
      expect(details).to.have.property('username');
    });
  });
});