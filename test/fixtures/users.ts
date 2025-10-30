// Define UserRole locally to avoid decorator issues
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  ACCOUNTANT = 'ACCOUNTANT',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
}

/**
 * Simple user test data factory - KISS principle
 * Provides realistic test data for different user roles
 */

export const createTestUser = (overrides: Partial<any> = {}) => {
  const baseUser = {
    email: 'test.user@company.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: 'SecureP@ss123!',
    role: UserRole.USER,
  };

  return { ...baseUser, ...overrides };
};

export const createAdminUser = (overrides: Partial<any> = {}) => {
  return createTestUser({
    email: 'admin@company.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    ...overrides,
  });
};

export const createManagerUser = (overrides: Partial<any> = {}) => {
  return createTestUser({
    email: 'manager@company.com',
    username: 'manager',
    firstName: 'Manager',
    lastName: 'User',
    role: UserRole.MANAGER,
    ...overrides,
  });
};

export const createAccountantUser = (overrides: Partial<any> = {}) => {
  return createTestUser({
    email: 'accountant@company.com',
    username: 'accountant',
    firstName: 'Accountant',
    lastName: 'User',
    role: UserRole.ACCOUNTANT,
    ...overrides,
  });
};

export const createWeakPasswordUser = () => {
  return createTestUser({
    password: '123', // Weak password for security testing
  });
};

export const createMaliciousUser = () => {
  return createTestUser({
    firstName: '<script>alert("xss")</script>',
    lastName: 'Doe',
    username: 'user_sql_injection',
  });
};