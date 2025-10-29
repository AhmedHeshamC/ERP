import { expect } from 'chai';

describe('Mocha Test Setup', () => {
  it('should run basic Mocha test', () => {
    expect(true).to.be.true;
    expect(1 + 1).to.equal(2);
  });

  it('should handle async tests', async () => {
    const result = await Promise.resolve('Hello Mocha!');
    expect(result).to.equal('Hello Mocha!');
  });
});