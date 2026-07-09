const assert = require('assert');
const { TenantChannelConfigLoader } = require('../../src/config/TenantChannelConfigLoader.ts');
const { TenantChannelConfigValidator } = require('../../src/config/TenantChannelConfigValidator.ts');
const { tenantConfig } = require('./webhook-test-utils.ts');

function run() {
  const validator = new TenantChannelConfigValidator();
  const validation = validator.validate(tenantConfig());
  assert.strictEqual(validation.valid, true);

  const invalid = validator.validate({ ...tenantConfig(), accessTokenRef: null, mode: 'invalid' });
  assert.strictEqual(invalid.valid, false);
  assert(invalid.violations.some(({ path }) => path === '$.accessTokenRef'));
  assert(invalid.violations.some(({ path }) => path === '$.mode'));

  const loader = new TenantChannelConfigLoader({ configs: [tenantConfig()] });
  assert.strictEqual(loader.findByProvider('whatsapp-cloud').tenantId, 'autopecas');
  assert.strictEqual(loader.findByPhoneNumberId('whatsapp-cloud', 'phone-number-id-1').enabled, true);

  return { name: 'tenant-channel-config', pass: true };
}

module.exports = { run };
