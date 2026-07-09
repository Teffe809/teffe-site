const ALLOWED_STATUSES = [
  'processed',
  'ignored',
  'duplicate',
  'invalid_signature',
  'unsupported_event',
  'tenant_not_found',
  'processing_failed',
  'outbound_blocked',
];

function createInboundDryRunResult(input = {}) {
  const status = ALLOWED_STATUSES.includes(input.status) ? input.status : 'processing_failed';
  return {
    enabled: input.enabled === true,
    status,
    processed: status === 'processed',
    ignored: status === 'ignored' || status === 'unsupported_event',
    duplicate: status === 'duplicate',
    invalidSignature: status === 'invalid_signature',
    tenantNotFound: status === 'tenant_not_found',
    processingFailed: status === 'processing_failed',
    outboundBlocked: input.outboundBlocked !== false,
    reason: input.reason ?? status,
  };
}

module.exports = { createInboundDryRunResult, ALLOWED_STATUSES };
