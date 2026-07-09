const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkWebhookReadiness } = require('../../scripts/check-webhook-readiness.js');

function run() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-readiness-'));
  fs.writeFileSync(path.join(cwd, '.env'), 'local-only=true', 'utf8');

  const baseEnv = {
    TEFFE_WEBHOOK_PORT: '3100',
    TEFFE_WHATSAPP_SEND_ENABLED: 'false',
    TEFFE_WHATSAPP_VERIFY_TOKEN_REF: 'VERIFY_REF',
    TEFFE_WHATSAPP_APP_SECRET_REF: 'APP_REF',
    TEFFE_WHATSAPP_ACCESS_TOKEN_REF: 'ACCESS_REF',
    VERIFY_REF: 'mock-verify-value',
    APP_REF: 'mock-app-value',
    ACCESS_REF: 'mock-access-value',
    TEFFE_IDEMPOTENCY_STORE_FILE: 'data/idempotency-store.json',
  };

  const ok = checkWebhookReadiness({ cwd, env: baseEnv });
  assert.strictEqual(ok.ok, true);

  const sendEnabled = checkWebhookReadiness({
    cwd,
    env: { ...baseEnv, TEFFE_WHATSAPP_SEND_ENABLED: 'true' },
  });
  assert.strictEqual(sendEnabled.ok, false);
  assert(sendEnabled.checks.some((item) => item.name === 'send_disabled' && !item.ok));

  const missingRef = checkWebhookReadiness({
    cwd,
    env: { ...baseEnv, TEFFE_WHATSAPP_APP_SECRET_REF: '' },
  });
  assert.strictEqual(missingRef.ok, false);
  assert(missingRef.checks.some((item) => item.name === 'app_secret_ref_present' && !item.ok));

  const missingValue = checkWebhookReadiness({
    cwd,
    env: { ...baseEnv, APP_REF: '' },
  });
  assert.strictEqual(missingValue.ok, false);
  assert(missingValue.checks.some((item) => item.name === 'runtime_config_starts' && !item.ok));

  return { name: 'webhook-readiness-check', pass: true };
}

module.exports = { run };
