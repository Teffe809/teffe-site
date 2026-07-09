class IdempotencyStore {
  checkAndStore() {
    throw new Error('checkAndStore must be implemented by idempotency store');
  }
}

module.exports = { IdempotencyStore };
