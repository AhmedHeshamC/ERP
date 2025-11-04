import { TestEnvironmentLoader } from './test-environment-loader';

/**
 * Integration Test Environment Setup
 *
 * This file provides centralized environment configuration for all integration tests.
 * It should be imported at the top of any integration test file that loads the full
 * NestJS application to ensure proper environment variables are available.
 *
 * Usage:
 *   import '../shared/testing/integration-test-env-setup';
 *   // ... rest of your imports
 */

/**
 * Setup integration test environment with proper error handling
 * Single Responsibility: Configure environment for integration tests only
 */
export function setupIntegrationTestEnvironment(): void {
  try {
    const envLoader = TestEnvironmentLoader.getInstance();

    // Load environment with fallback chain
    envLoader.loadTestEnvironment();

    // Validate only in test environment to avoid production impact
    if (process.env.NODE_ENV === 'test') {
      envLoader.validateEnvironment();
    }

    // Set test-specific environment overrides
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    // Ensure deterministic test behavior
    process.env.TZ = 'UTC';

    console.log('Integration test environment configured successfully');
  } catch (error) {
    console.error('Failed to setup integration test environment:', error);
    throw error;
  }
}

// Auto-execute setup for immediate-loading imports
setupIntegrationTestEnvironment();

// Export for explicit usage if needed
export { TestEnvironmentLoader };