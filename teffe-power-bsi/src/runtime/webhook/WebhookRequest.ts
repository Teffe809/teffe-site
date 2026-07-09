function createWebhookRequest(input = {}) {
  const method = String(input.method ?? '').trim().toUpperCase();
  const provider = String(input.provider ?? '').trim().toLowerCase();
  return {
    method,
    provider,
    path: input.path ?? '',
    query: input.query ?? {},
    headers: normalizeHeaders(input.headers ?? {}),
    rawBody: input.rawBody ?? '',
    body: input.body ?? null,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
  };
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(',') : String(value),
    ])
  );
}

module.exports = { createWebhookRequest, normalizeHeaders };
