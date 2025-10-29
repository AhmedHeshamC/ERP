/**
 * Mocha test hooks and setup
 * Configures global test environment for Mocha
 */

import 'chai/register-should';
import 'chai/register-expect';
import * as sinon from 'sinon';
import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinonChai from 'sinon-chai';

use(chaiAsPromised);
use(sinonChai);

// Global test setup
before(() => {
  console.log('Starting test suite...');
});

after(() => {
  console.log('Test suite completed.');
});

beforeEach(() => {
  // Restore all sinon stubs before each test
  sinon.restore();
});

// Global test cleanup
afterEach(() => {
  // Cleanup after each test
});

// Export sinon for use in tests
export { sinon };