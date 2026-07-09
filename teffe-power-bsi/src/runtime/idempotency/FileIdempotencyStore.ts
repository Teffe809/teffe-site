const fs = require('fs');
const path = require('path');
const { IdempotencyStore } = require('./IdempotencyStore.ts');
const { createIdempotencyResult } = require('./IdempotencyResult.ts');

class FileIdempotencyStore extends IdempotencyStore {
  constructor({ filePath } = {}) {
    super();
    if (!filePath) {
      throw new Error('filePath is required');
    }

    this.filePath = filePath;
    this.records = this.load();
  }

  checkAndStore(key) {
    if (!key) {
      return createIdempotencyResult({
        firstSeen: false,
        duplicate: false,
        key: null,
        reason: 'message_id_missing',
      });
    }

    const now = new Date().toISOString();
    if (this.records[key]) {
      return createIdempotencyResult({
        firstSeen: false,
        duplicate: true,
        key,
        reason: 'duplicate_message',
        firstSeenAt: this.records[key],
        seenAt: now,
      });
    }

    this.records[key] = now;
    this.persist();
    return createIdempotencyResult({
      firstSeen: true,
      duplicate: false,
      key,
      firstSeenAt: now,
      seenAt: now,
    });
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), 'utf8');
  }
}

module.exports = { FileIdempotencyStore };
