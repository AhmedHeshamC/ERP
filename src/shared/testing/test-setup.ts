import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// @ts-ignore - sinon-chai doesn't have type definitions but works at runtime
import sinonChai from 'sinon-chai';

// Configure Chai plugins
chai.use(chaiAsPromised);
chai.use(sinonChai);

// Export chai for use in tests
export { chai };

// Global setup for tests can be added here
export function setupTestEnvironment(): void {
  // Any global test setup can go here
}

export function teardownTestEnvironment(): void {
  // Any global test cleanup can go here
}