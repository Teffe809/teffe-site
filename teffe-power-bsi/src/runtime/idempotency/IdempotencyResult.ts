function createIdempotencyResult(input = {}) {
  return {
    firstSeen: Boolean(input.firstSeen),
    duplicate: Boolean(input.duplicate),
    key: input.key ?? null,
    reason: input.reason ?? null,
    firstSeenAt: input.firstSeenAt ?? null,
    seenAt: input.seenAt ?? new Date().toISOString(),
  };
}

module.exports = { createIdempotencyResult };
