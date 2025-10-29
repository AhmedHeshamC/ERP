import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SecurityService } from '../../shared/security/security.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CreateUserDto, UpdateUserDto, UserRole, UserResponse } from './dto/user.dto';

describe('UserController - Enterprise User Management API', () => {
  let controller: UserController;
  let userService: any;
  let securityService: any;

  beforeEach(async () => {
    const mockUserService = {
      createUser: sinon.stub(),
      findById: sinon.stub(),
      findByEmailOrUsername: sinon.stub(),
      updateUser: sinon.stub(),
      getUsers: sinon.stub(),
      softDeleteUser: sinon.stub(),
      changePassword: sinon.stub(),
    };

    const mockSecurityService = {
      logSecurityEvent: sinon.stub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    securityService = module.get<SecurityService>(SecurityService);
  });

  describe('POST /users - Create User', () => {
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

    it('should create a new user successfully', async () => {
      // Arrange
      userService.createUser.resolves(mockUser);
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await controller.createUser(createUserDto);

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockUser);
      expect(result.message).to.include('User created successfully');
      expect(userService.createUser.calledOnce).to.be.true;
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
    });

    it('should handle ConflictException when user already exists', async () => {
      // Arrange
      const conflictError = new ConflictException('User with email already exists');
      userService.createUser.rejects(conflictError);
      securityService.logSecurityEvent.resolves();

      // Act & Assert
      try {
        await controller.createUser(createUserDto);
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error.message).to.include('already exists');
      }
    });

    it('should handle BadRequestException for invalid input', async () => {
      // Arrange
      const badRequestError = new BadRequestException('Password does not meet security requirements');
      userService.createUser.rejects(badRequestError);
      securityService.logSecurityEvent.resolves();

      // Act & Assert
      try {
        await controller.createUser(createUserDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('security requirements');
      }
    });
  });

  describe('GET /users/:id - Get User by ID', () => {
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
      userService.findById.resolves(mockUser);

      // Act
      const result = await controller.getUserById(userId);

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockUser);
      expect(userService.findById.calledOnce).to.be.true;
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`User with id ${userId} not found`);
      userService.findById.rejects(notFoundError);

      // Act & Assert
      try {
        await controller.getUserById(userId);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('not found');
      }
    });
  });

  describe('PUT /users/:id - Update User', () => {
    const userId = 'user-123';
    const updateUserDto: UpdateUserDto = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
    };

    const updatedUser: UserResponse = {
      id: userId,
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John Updated',
      lastName: 'Doe Updated',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    it('should update user successfully', async () => {
      // Arrange
      userService.updateUser.resolves(updatedUser);
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await controller.updateUser(userId, updateUserDto);

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(updatedUser);
      expect(result.message).to.include('User updated successfully');
      expect(userService.updateUser.calledOnce).to.be.true;
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`User with id ${userId} not found`);
      userService.updateUser.rejects(notFoundError);

      // Act & Assert
      try {
        await controller.updateUser(userId, updateUserDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('GET /users - Get Users with Filtering', () => {
    const mockUsers: UserResponse[] = [
      {
        id: 'user-1',
        email: 'user1@company.com',
        username: 'user1',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
      {
        id: 'user-2',
        email: 'admin@company.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
    ];

    it('should return paginated users successfully', async () => {
      // Arrange
      userService.getUsers.resolves({
        users: mockUsers,
        total: 2,
      });

      // Act
      const result = await controller.getUsers({});

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.data.users).to.have.length(2);
      expect(result.data.pagination.total).to.equal(2);
      expect(userService.getUsers.calledOnce).to.be.true;
    });

    it('should filter users by role', async () => {
      // Arrange
      const adminUsers = mockUsers.filter(user => user.role === UserRole.ADMIN);
      userService.getUsers.resolves({
        users: adminUsers,
        total: 1,
      });

      // Act
      const result = await controller.getUsers({ role: UserRole.ADMIN });

      // Assert
      expect(result.data.users).to.have.length(1);
      expect(result.data.users[0].role).to.equal(UserRole.ADMIN);
      expect(userService.getUsers.calledOnce).to.be.true;
    });

    it('should search users by term', async () => {
      // Arrange
      const searchResults = mockUsers.filter(user =>
        user.firstName.toLowerCase().includes('admin') ||
        user.lastName.toLowerCase().includes('admin')
      );
      userService.getUsers.resolves({
        users: searchResults,
        total: 1,
      });

      // Act
      const result = await controller.getUsers({ search: 'admin' });

      // Assert
      expect(result.data.users).to.have.length(1);
      expect(userService.getUsers.calledOnce).to.be.true;
    });
  });

  describe('DELETE /users/:id - Soft Delete User', () => {
    const userId = 'user-123';

    it('should soft delete user successfully', async () => {
      // Arrange
      userService.softDeleteUser.resolves({ success: true });
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await controller.deleteUser(userId);

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.message).to.include('User deactivated successfully');
      expect(userService.softDeleteUser.calledOnce).to.be.true;
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const notFoundError = new NotFoundException(`User with id ${userId} not found`);
      userService.softDeleteUser.rejects(notFoundError);

      // Act & Assert
      try {
        await controller.deleteUser(userId);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('POST /users/:id/change-password - Change Password', () => {
    const userId = 'user-123';
    const changePasswordDto = {
      currentPassword: 'OldSecureP@ss123!',
      newPassword: 'NewSecureP@ss123!',
      confirmPassword: 'NewSecureP@ss123!',
    };

    it('should change password successfully', async () => {
      // Arrange
      userService.changePassword.resolves({ success: true });
      securityService.logSecurityEvent.resolves();

      // Act
      const result = await controller.changePassword(userId, changePasswordDto);

      // Assert
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.message).to.include('Password changed successfully');
      expect(userService.changePassword.calledOnce).to.be.true;
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
    });

    it('should throw BadRequestException for password mismatch', async () => {
      // Arrange
      const mismatchDto = {
        ...changePasswordDto,
        confirmPassword: 'DifferentP@ss123!',
      };
      const badRequestError = new BadRequestException('New password and confirmation do not match');
      userService.changePassword.rejects(badRequestError);

      // Act & Assert
      try {
        await controller.changePassword(userId, mismatchDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('do not match');
      }
    });
  });

  describe('Security Integration', () => {
    it('should log all user management operations', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'test@company.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecureP@ss123!',
        role: UserRole.USER,
      };
      const mockUser = {
        id: 'test-id',
        ...createUserDto,
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      userService.createUser.resolves(mockUser);
      securityService.logSecurityEvent.resolves();

      // Act
      await controller.createUser(createUserDto);

      // Assert
      expect(securityService.logSecurityEvent.calledOnce).to.be.true;
      const [event, userId, ip, userAgent, details] = securityService.logSecurityEvent.getCall(0).args;
      expect(event).to.be.a('string');
      expect(userId).to.be.a('string');
      expect(ip).to.be.a('string');
      expect(userAgent).to.be.a('string');
      expect(details).to.be.an('object');
    });

    it('should handle service errors gracefully and log them', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'test@company.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecureP@ss123!',
        role: UserRole.USER,
      };
      const internalError = new Error('Database connection failed');
      userService.createUser.rejects(internalError);
      securityService.logSecurityEvent.resolves();

      // Act & Assert
      try {
        await controller.createUser(createUserDto);
        expect.fail('Should have thrown the original error');
      } catch (error) {
        expect(error.message).to.equal('Database connection failed');
      }
    });
  });
});