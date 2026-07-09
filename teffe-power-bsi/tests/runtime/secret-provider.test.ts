const assert = require('assert');
const { EnvSecretProvider } = require('../../src/secrets/EnvSecretProvider.ts');
const { MockSecretProvider } = require('../../src/secrets/MockSecretProvider.ts');

function run() {
  const mock = new MockSecretProvider({ REF_A: 'mock-value-a' });
  assert.strictEqual(mock.getSecret('REF_A'), 'mock-value-a');
  assert.strictEqual(mock.getSecret('MISSING'), null);
  assert.throws(() => mock.requireSecret('MISSING'), /Secret is not available/);

  const env = new EnvSecretProvider({ env: { PREFIX_REF: 'env-mock-value' }, prefix: 'PREFIX_' });
  assert.strictEqual(env.getSecret('REF'), 'env-mock-value');
  assert.strictEqual(env.getSecret('OTHER'), null);

  return { name: 'secret-provider', pass: true };
}

module.exports = { run };
