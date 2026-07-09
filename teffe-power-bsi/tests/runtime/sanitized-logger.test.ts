const assert = require('assert');
const { LogSanitizer } = require('../../src/runtime/logging/LogSanitizer.ts');
const { SanitizedLogger } = require('../../src/runtime/logging/SanitizedLogger.ts');

function run() {
  const sanitizer = new LogSanitizer();
  const sanitized = sanitizer.sanitize({
    authorization: 'auth-placeholder-value',
    appSecret: 'private-placeholder-value',
    verifyToken: 'verify-placeholder-value',
    rawBody: '{"phone":"+5511999990001"}',
    customerPhone: '+5511999990001',
    nested: {
      header: 'token=private-placeholder-value',
    },
  });

  const serialized = JSON.stringify(sanitized);
  assert(!serialized.includes('private-placeholder-value'));
  assert(!serialized.includes('verify-placeholder-value'));
  assert(!serialized.includes('+5511999990001'));
  assert(serialized.includes('+55******01'));

  const lines = [];
  const logger = new SanitizedLogger({
    sink: {
      info: (line) => lines.push(line),
    },
  });
  logger.info('test.log', {
    authorization: 'auth-placeholder-value',
    phone: '+5511999990001',
  });
  assert.strictEqual(lines.length, 1);
  assert(!lines[0].includes('auth-placeholder-value'));
  assert(lines[0].includes('+55******01'));

  return { name: 'sanitized-logger', pass: true };
}

module.exports = { run };
