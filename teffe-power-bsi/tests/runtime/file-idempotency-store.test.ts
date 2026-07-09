const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileIdempotencyStore } = require('../../src/runtime/idempotency/FileIdempotencyStore.ts');

function run() {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'teffe-idempotency-')), 'store.json');
  const firstStore = new FileIdempotencyStore({ filePath });
  const first = firstStore.checkAndStore('wamid.persisted');
  assert.strictEqual(first.firstSeen, true);
  assert.strictEqual(fs.existsSync(filePath), true);

  const secondStore = new FileIdempotencyStore({ filePath });
  const duplicate = secondStore.checkAndStore('wamid.persisted');
  assert.strictEqual(duplicate.duplicate, true);
  assert.strictEqual(duplicate.reason, 'duplicate_message');

  const missing = secondStore.checkAndStore(null);
  assert.strictEqual(missing.reason, 'message_id_missing');

  return { name: 'file-idempotency-store', pass: true };
}

module.exports = { run };
