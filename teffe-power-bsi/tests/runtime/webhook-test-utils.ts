const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootPlatform } = require('../../platform');
const { TenantChannelConfigLoader } = require('../../src/config/TenantChannelConfigLoader.ts');
const { MockSecretProvider } = require('../../src/secrets/MockSecretProvider.ts');
const { WebhookRuntime } = require('../../src/runtime/webhook/WebhookRuntime.ts');

const VERIFY_REF = 'WHATSAPP_VERIFY_REF';
const APP_SECRET_REF = 'WHATSAPP_APP_SECRET_REF';
const ACCESS_REF = 'WHATSAPP_ACCESS_REF';
const VERIFY_SECRET = 'mock-verify-value';
const APP_SECRET = 'mock-app-value';
const ACCESS_SECRET = 'mock-access-value';

function createRuntime({ enabled = true, secrets = null, requireSignature = true } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-webhook-test-'));
  const platform = bootPlatform({ dataDir });
  const configLoader = new TenantChannelConfigLoader({
    configs: [tenantConfig({ enabled })],
  });
  const secretProvider = new MockSecretProvider(secrets ?? {
    [VERIFY_REF]: VERIFY_SECRET,
    [APP_SECRET_REF]: APP_SECRET,
    [ACCESS_REF]: ACCESS_SECRET,
  });

  return {
    runtime: new WebhookRuntime({
      configLoader,
      secretProvider,
      platform,
      runtimeConfig: { requireSignature },
    }),
    dataDir,
    platform,
    configLoader,
    secretProvider,
  };
}

function tenantConfig({ enabled = true } = {}) {
  return {
    tenantId: 'autopecas',
    channel: 'whatsapp',
    provider: 'whatsapp-cloud',
    phoneNumberId: 'phone-number-id-1',
    businessAccountId: 'business-account-id-1',
    verifyTokenRef: VERIFY_REF,
    appSecretRef: APP_SECRET_REF,
    accessTokenRef: ACCESS_REF,
    enabled,
    mode: 'mock',
    metadata: {
      displayName: 'MIA Autopecas',
    },
  };
}

function whatsappPayload(text = 'ABC-1D23 preciso de amortecedor') {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: 'phone-number-id-1',
            display_phone_number: '+5511888880001',
          },
          contacts: [{
            profile: { name: 'Cliente Teste' },
          }],
          messages: [{
            id: 'wamid.test',
            from: '+5511999990001',
            timestamp: '1783630000',
            type: 'text',
            text: { body: text },
          }],
        },
      }],
    }],
  };
}

function sign(rawBody, secret = APP_SECRET) {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

module.exports = {
  ACCESS_REF,
  ACCESS_SECRET,
  APP_SECRET,
  APP_SECRET_REF,
  VERIFY_REF,
  VERIFY_SECRET,
  createRuntime,
  sign,
  tenantConfig,
  whatsappPayload,
};
