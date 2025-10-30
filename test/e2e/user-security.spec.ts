import { test, expect } from '@playwright/test';
import { createAdminUser, createWeakPasswordUser, createMaliciousUser, createTestUser } from '../fixtures/users';

/**
 * User Security E2E Tests - SOLID & KISS
 * Tests security scenarios without over-engineering
 */

test.describe('User Security Scenarios', () => {
  test('rejects weak password during user creation', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const weakPasswordUser = createWeakPasswordUser();

    // Act - Try to create user with weak password
    const response = await request.post('/api/v1/users', {
      data: weakPasswordUser,
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "Password must be at least 8 characters long"
    ]));
  });

  test('sanitizes malicious input in user creation', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const maliciousUser = createTestUser({
      firstName: '<script>alert("xss")</script>',
      lastName: 'Doe',
      username: 'user_sql_injection',
      email: 'test@company.com',
    });

    // Act - Try to create user with malicious input
    const response = await request.post('/api/v1/users', {
      data: maliciousUser,
    });

    // Assert - Should reject malicious input
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      expect.stringContaining('First name can only contain')
    ]));
  });

  test('prevents duplicate user creation', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Create first user
    const duplicateUser = createTestUser({
      email: 'duplicate@company.com',
      username: 'duplicate',
    });

    const firstResponse = await request.post('/api/v1/users', {
      data: duplicateUser,
    });

    // Ensure first user was created successfully
    expect(firstResponse.ok()).toBeTruthy();

    // Act - Try to create duplicate user
    const duplicateResponse = await request.post('/api/v1/users', {
      data: duplicateUser,
    });

    // Assert
    expect(duplicateResponse.status()).toBe(409);
    const error = await duplicateResponse.json();
    expect(error.message).toContain('already exists');
  });

  test('validates required fields in user creation', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Act - Try to create user with missing required fields
    const response = await request.post('/api/v1/users', {
      data: {
        email: 'test@company.com',
        // Missing username, firstName, lastName, password, role
      },
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      expect.stringContaining('Username must'),
      expect.stringContaining('First name is required'),
      expect.stringContaining('Last name is required'),
      expect.stringContaining('Password must'),
      expect.stringContaining('Invalid role provided')
    ]));
  });

  test('enforces email format validation', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Act - Try to create user with invalid email
    const response = await request.post('/api/v1/users', {
      data: createTestUser({
        email: 'invalid-email', // Invalid email format
      }),
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      expect.stringContaining('email address')
    ]));
  });

  test('enforces username length and format', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Act - Try to create user with invalid username
    const response = await request.post('/api/v1/users', {
      data: createTestUser({
        username: 'ab', // Too short (minimum 3 characters)
      }),
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      expect.stringContaining('Username')
    ]));
  });

  test('user password change requires current password', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const testUser = createTestUser({
      email: 'password.change@company.com',
      username: 'passwordchange',
    });

    const createResponse = await request.post('/api/v1/users', {
      data: testUser,
    });
    const createdUser = (await createResponse.json()).data;

    // Act - Try to change password without current password
    const response = await request.post(`/api/v1/users/${createdUser.id}/change-password`, {
      data: {
        newPassword: 'NewSecureP@ss123!',
        confirmPassword: 'NewSecureP@ss123!',
        // Missing currentPassword
      },
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      expect.stringContaining('Current password')
    ]));
  });

  test('user password change validates new password strength', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const testUser = createTestUser({
      email: 'password.strong@company.com',
      username: 'passwordstrong',
    });

    const createResponse = await request.post('/api/v1/users', {
      data: testUser,
    });
    const createdUser = (await createResponse.json()).data;

    // Act - Try to change to weak password
    const response = await request.post(`/api/v1/users/${createdUser.id}/change-password`, {
      data: {
        currentPassword: testUser.password,
        newPassword: '123', // Weak password
        confirmPassword: '123',
      },
    });

    // Assert
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.message).toEqual(expect.arrayContaining([
      "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "New password must be at least 8 characters long"
    ]));
  });
});