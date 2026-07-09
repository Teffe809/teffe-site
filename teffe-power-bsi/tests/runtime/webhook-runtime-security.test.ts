const assert = require('assert');
const { ACCESS_REF, VERIFY_REF, createRuntime, sign, whatsappPayload } = require('./webhook-test-utils.ts');

function run() {
  const rawBody = JSON.stringify(whatsappPayload());

  const invalidSignature = createRuntime().runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: {
      'x-hub-signature-256': sign(rawBody, 'wrong-secret'),
    },
    rawBody,
  });
  assert.strictEqual(invalidSignature.statusCode, 401);
  assert.strictEqual(invalidSignature.body.error.code, 'signature_invalid');

  const disabled = createRuntime({ enabled: false }).runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: {
      'x-hub-signature-256': sign(rawBody),
    },
    rawBody,
  });
  assert.strictEqual(disabled.statusCode, 403);
  assert.strictEqual(disabled.body.error.code, 'tenant_channel_disabled');

  const missingSecret = createRuntime({
    secrets: {
      [VERIFY_REF]: 'mock-verify-value',
    },
  }).runtime.handle({
    method: 'POST',
    provider: 'whatsapp-cloud',
    headers: {
      'x-hub-signature-256': sign(rawBody),
    },
    rawBody,
  });
  assert.strictEqual(missingSecret.statusCode, 500);
  assert.strictEqual(missingSecret.body.error.code, 'secret_missing');

  const body = JSON.stringify(missingSecret.body);
  assert(!body.includes('mock-verify-value'));
  assert(!body.includes(ACCESS_REF));

  return { name: 'webhook-runtime-security', pass: true };
}

module.exports = { run };
