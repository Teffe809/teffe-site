const assert = require('assert');
const { WhatsAppCloudSignatureValidator } = require('../../src/channels/whatsapp-cloud/WhatsAppCloudSignatureValidator.ts');

function run() {
  const validator = new WhatsAppCloudSignatureValidator();
  const rawBody = JSON.stringify({ object: 'whatsapp_business_account' });
  const signature = validator.sign(rawBody, 'mock-app-value');

  assert.strictEqual(validator.validate({ rawBody, signature, appSecret: 'mock-app-value' }).ok, true);
  assert.strictEqual(validator.validate({ rawBody, signature, appSecret: 'other-value' }).ok, false);
  assert.strictEqual(validator.validate({ rawBody: '', signature, appSecret: 'mock-app-value' }).reason, 'raw_body_required');
  assert.strictEqual(validator.validate({ rawBody, signature: '', appSecret: 'mock-app-value' }).reason, 'signature_missing');

  return { name: 'whatsapp-signature-validator', pass: true };
}

module.exports = { run };
