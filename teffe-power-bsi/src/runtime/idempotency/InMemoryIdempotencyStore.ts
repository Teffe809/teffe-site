const { IdempotencyStore } = require('./IdempotencyStore.ts');
const { createIdempotencyResult } = require('./IdempotencyResult.ts');

class InMemoryIdempotencyStore extends IdempotencyStore {
  constructor() {
    super();
    this.records = new Map();
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
    if (this.records.has(key)) {
      return createIdempotencyResult({
        firstSeen: false,
        duplicate: true,
        key,
        reason: 'duplicate_message',
        firstSeenAt: this.records.get(key),
        seenAt: now,
      });
    }

    this.records.set(key, now);
    return createIdempotencyResult({
      firstSeen: true,
      duplicate: false,
      key,
      firstSeenAt: now,
      seenAt: now,
    });
  }
}

module.exports = { InMemoryIdempotencyStore };
