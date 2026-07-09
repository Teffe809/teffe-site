const { maskPhone } = require('../logging/LogSanitizer.ts');

function createInboundObservationRecord(input = {}) {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    provider: safeText(input.provider),
    channel: safeText(input.channel),
    tenantId: safeText(input.tenantId),
    messageId: maskIdentifier(input.messageId),
    sender: maskPhone(input.sender ?? ''),
    messageType: safeText(input.messageType),
    signature: safeStatus(input.signature),
    parser: safeStatus(input.parser),
    idempotency: safeStatus(input.idempotency),
    workflow: safeText(input.workflow),
    processing: safeStatus(input.processing),
    outbound: {
      blocked: input.outboundBlocked === true,
      reason: safeText(input.outboundReason),
    },
    dryRun: input.dryRun === true,
  };
}

function maskIdentifier(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (text.length <= 8) return `${text.slice(0, 2)}***`;
  return `${text.slice(0, 6)}***${text.slice(-4)}`;
}

function safeText(value) {
  return value == null ? null : String(value);
}

function safeStatus(value) {
  return value == null ? 'unknown' : String(value);
}

module.exports = { createInboundObservationRecord, maskIdentifier };
