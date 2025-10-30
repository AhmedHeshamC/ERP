import { test, expect } from '@playwright/test';
import { createAdminUser, createTestUser, createManagerUser } from '../fixtures/users';

/**
 * User Management E2E Tests - SOLID & KISS
 * Tests real user flows without over-engineering
 */

test.describe('User Management Flows', () => {
  test('admin creates new user successfully', async ({ request }) => {
    // Arrange
    const timestamp = Date.now();
    const adminUser = createAdminUser({
      email: `admin.${timestamp}@company.com`,
      username: `admin${timestamp}`,
    });
    const newUser = createTestUser({
      email: `new.employee.${timestamp}@company.com`,
      username: `newemployee${timestamp}`,
      firstName: 'New',
      lastName: 'Employee',
    });

    // Act - Create admin user first
    const adminResponse = await request.post('/api/v1/users', {
      data: adminUser,
    });
    expect(adminResponse.ok()).toBeTruthy();

    // Create new user
    const response = await request.post('/api/v1/users', {
      data: newUser,
    });

    // Assert
    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.email).toBe(newUser.email);
    expect(responseBody.data.username).toBe(newUser.username);
    expect(responseBody.data.firstName).toBe(newUser.firstName);
    expect(responseBody.data.lastName).toBe(newUser.lastName);
    expect(responseBody.data.isActive).toBe(true);
  });

  test('admin lists users with pagination', async ({ request }) => {
    // Arrange - Create admin and some users
    const timestamp = Date.now();
    const adminUser = createAdminUser({
      email: `admin.${timestamp}@company.com`,
      username: `admin${timestamp}`,
    });
    await request.post('/api/v1/users', { data: adminUser });

    // Create multiple users with unique identifiers and valid names
    const userNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson'];

    for (let i = 1; i <= 5; i++) {
      const response = await request.post('/api/v1/users', {
        data: createTestUser({
          email: `user${i}.${timestamp}@company.com`,
          username: `user${i}${timestamp}`,
          firstName: userNames[i - 1],
          lastName: lastNames[i - 1],
        }),
      });
      // Log if user creation fails
      if (!response.ok()) {
        console.log(`Failed to create user ${i}:`, await response.text());
      }
    }

    // Act - Get users list
    const response = await request.get('/api/v1/users?skip=0&take=3');

    // Assert
    expect(response.ok()).toBeTruthy();
    const usersData = await response.json();
    expect(usersData.success).toBe(true);
    expect(usersData.data.users).toHaveLength(3);
    expect(usersData.data.pagination.total).toBeGreaterThanOrEqual(5);
  });

  test('admin updates user information', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const createResponse = await request.post('/api/v1/users', {
      data: createTestUser({
        email: 'update.test@company.com',
        username: 'updatetest',
        firstName: 'Original',
        lastName: 'Name',
      }),
    });
    const createdUser = (await createResponse.json()).data;

    // Act - Update user
    const updateResponse = await request.put(`/api/v1/users/${createdUser.id}`, {
      data: {
        firstName: 'Updated',
        lastName: 'Name',
      },
    });

    // Assert
    expect(updateResponse.ok()).toBeTruthy();
    const updatedUser = (await updateResponse.json()).data;
    expect(updatedUser.firstName).toBe('Updated');
    expect(updatedUser.lastName).toBe('Name');
  });

  test('admin deactivates user', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    const createResponse = await request.post('/api/v1/users', {
      data: createTestUser({
        email: 'deactivate.test@company.com',
        username: 'deactivatetest',
      }),
    });
    const createdUser = (await createResponse.json()).data;

    // Act - Deactivate user
    const response = await request.delete(`/api/v1/users/${createdUser.id}`);

    // Assert
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);
  });

  test('search users by name', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Create users with searchable names
    await request.post('/api/v1/users', {
      data: createTestUser({
        email: 'john.doe@company.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
      }),
    });

    await request.post('/api/v1/users', {
      data: createTestUser({
        email: 'jane.smith@company.com',
        username: 'janesmith',
        firstName: 'Jane',
        lastName: 'Smith',
      }),
    });

    // Act - Search for "John"
    const response = await request.get('/api/v1/users?search=John');

    // Assert
    expect(response.ok()).toBeTruthy();
    const usersData = await response.json();
    expect(usersData.success).toBe(true);
    expect(usersData.data.users.length).toBeGreaterThanOrEqual(1);
    expect(usersData.data.users.some((user: any) => user.firstName === 'John')).toBe(true);
  });

  test('filter users by role', async ({ request }) => {
    // Arrange
    const adminUser = createAdminUser();
    await request.post('/api/v1/users', { data: adminUser });

    // Create users with different roles
    await request.post('/api/v1/users', {
      data: createManagerUser({
        email: 'manager1@company.com',
        username: 'manager1',
      }),
    });

    await request.post('/api/v1/users', {
      data: createManagerUser({
        email: 'manager2@company.com',
        username: 'manager2',
      }),
    });

    // Act - Filter by MANAGER role
    const response = await request.get('/api/v1/users?role=MANAGER');

    // Assert
    expect(response.ok()).toBeTruthy();
    const usersData = await response.json();
    expect(usersData.success).toBe(true);
    expect(usersData.data.users.length).toBeGreaterThan(0);
    usersData.data.users.forEach((user: any) => {
      expect(user.role).toBe('MANAGER');
    });
  });
});