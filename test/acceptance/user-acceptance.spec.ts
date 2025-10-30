import { test, expect } from '@playwright/test';
import { createAdminUser, createManagerUser, createTestUser } from '../fixtures/users';

/**
 * User Acceptance Tests - SOLID & KISS
 * Tests business requirements and user stories
 */

test.describe('User Acceptance Criteria', () => {
  test('business requirement: system can create and manage users', async ({ request }) => {
    // Business Rule: Company must be able to add new employees to the system

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const newEmployee = createTestUser({
      email: 'john.doe@company.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    });

    // Act - Add new employee
    const createResponse = await request.post('/api/v1/users', { data: newEmployee });

    // Assert - Employee should be successfully added
    expect(createResponse.ok()).toBeTruthy();
    const employee = await createResponse.json();

    // Verify employee data is correct
    expect(employee.email).toBe(newEmployee.email);
    expect(employee.isActive).toBe(true);
    expect(employee.role).toBe('USER');

    // Verify employee can be retrieved
    const getResponse = await request.get(`/api/v1/users/${employee.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const retrievedEmployee = await getResponse.json();
    expect(retrievedEmployee.id).toBe(employee.id);
  });

  test('business requirement: admin can manage user roles', async ({ request }) => {
    // Business Rule: Administrators can assign and change user roles

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const regularUser = createTestUser({
      email: 'promote.me@company.com',
      username: 'promoteme',
      role: 'USER', // Start as regular user
    });

    const createResponse = await request.post('/api/v1/users', { data: regularUser });
    const createdUser = await createResponse.json();

    // Act - Promote user to manager
    const updateResponse = await request.put(`/api/v1/users/${createdUser.id}`, {
      data: { role: 'MANAGER' },
    });

    // Assert - User role should be updated
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = await updateResponse.json();
    expect(updatedUser.role).toBe('MANAGER');
  });

  test('business requirement: system maintains audit trail', async ({ request }) => {
    // Business Rule: All user changes must be tracked for compliance

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const testUser = createTestUser({
      email: 'audit.test@company.com',
      username: 'audittest',
    });

    const createResponse = await request.post('/api/v1/users', { data: testUser });
    const createdUser = await createResponse.json();

    // Act - Update user
    const updateResponse = await request.put(`/api/v1/users/${createdUser.id}`, {
      data: { firstName: 'Updated Name' },
    });

    // Assert - Audit fields should be present and updated
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = await updateResponse.json();

    // Verify audit trail exists
    expect(updatedUser.createdAt).toBeDefined();
    expect(updatedUser.updatedAt).toBeDefined();
    expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(createdUser.updatedAt.getTime());
  });

  test('business requirement: system enforces data validation', async ({ request }) => {
    // Business Rule: System must prevent invalid data entry

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Act & Assert - Test various validation scenarios

    // Test invalid email
    const emailResponse = await request.post('/api/v1/users', {
      data: createTestUser({ email: 'invalid-email-format' }),
    });
    expect(emailResponse.status()).toBe(400);

    // Test short username
    const usernameResponse = await request.post('/api/v1/users', {
      data: createTestUser({ username: 'ab' }), // Too short
    });
    expect(usernameResponse.status()).toBe(400);

    // Test weak password
    const passwordResponse = await request.post('/api/v1/users', {
      data: createTestUser({ password: 'weak' }),
    });
    expect(passwordResponse.status()).toBe(400);
  });

  test('business requirement: users can update their profile', async ({ request }) => {
    // Business Rule: Users should be able to update their personal information

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const employee = createTestUser({
      email: 'self.service@company.com',
      username: 'selfservice',
      firstName: 'Original',
      lastName: 'Name',
    });

    const createResponse = await request.post('/api/v1/users', { data: employee });
    const createdUser = await createResponse.json();

    // Act - User updates their profile
    const updateResponse = await request.put(`/api/v1/users/${createdUser.id}`, {
      data: {
        firstName: 'Updated',
        lastName: 'Profile',
      },
    });

    // Assert - Profile should be updated
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = await updateResponse.json();
    expect(updatedUser.firstName).toBe('Updated');
    expect(updatedUser.lastName).toBe('Profile');
  });

  test('business requirement: system supports user search and filtering', async ({ request }) => {
    // Business Rule: Admin should be able to find users quickly

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Create multiple users for testing
    const searchUser = createTestUser({
      firstName: 'Searchable',
      lastName: 'User',
      username: 'searchableuser',
      email: 'searchable@company.com',
      role: 'MANAGER',
    });

    await request.post('/api/v1/users', { data: searchUser });

    // Act & Assert - Test search functionality
    const searchResponse = await request.get('/api/v1/users?search=Searchable');
    expect(searchResponse.ok()).toBeTruthy();
    const searchResults = await searchResponse.json();
    expect(searchResults.users.length).toBeGreaterThan(0);
    searchResults.users.forEach((user: any) => {
      expect(user.firstName).toContain('Searchable') ||
             user.lastName).toContain('Searchable') ||
             user.username).toContain('searchable') ||
             user.email).toContain('searchable');
    });

    // Test role filtering
    const roleResponse = await request.get('/api/v1/users?role=MANAGER');
    expect(roleResponse.ok()).toBeTruthy();
    const roleResults = await roleResponse.json();
    roleResults.users.forEach((user: any) => {
      expect(user.role).toBe('MANAGER');
    });
  });

  test('business requirement: system supports soft delete', async ({ request }) => {
    // Business Rule: User data should not be permanently deleted for compliance

    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const testUser = createTestUser({
      email: 'soft.delete@company.com',
      username: 'softdelete',
    });

    const createResponse = await request.post('/api/v1/users', { data: testUser });
    const createdUser = await createResponse.json();

    // Act - Soft delete user
    const deleteResponse = await request.delete(`/api/v1/users/${createdUser.id}`);

    // Assert - User should be deactivated but not deleted
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify user is deactivated
    const getResponse = await request.get(`/api/v1/users/${createdUser.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const deactivatedUser = await getResponse.json();
    expect(deactivatedUser.isActive).toBe(false);
    expect(deactivatedUser.id).toBe(createdUser.id); // User still exists in system
  });
});