const { createInboundDryRunResult } = require('./InboundDryRunResult.ts');

class InboundDryRunGuard {
  constructor({ enabled = false, sendEnabled = false } = {}) {
    this.enabled = enabled === true || enabled === 'true';
    this.sendEnabled = sendEnabled === true || sendEnabled === 'true';
  }

  assertBootAllowed() {
    if (!this.enabled) {
      return createInboundDryRunResult({
        enabled: false,
        status: 'processing_failed',
        outboundBlocked: !this.sendEnabled,
        reason: 'inbound_dry_run_required',
      });
    }

    if (this.sendEnabled) {
      return createInboundDryRunResult({
        enabled: true,
        status: 'processing_failed',
        outboundBlocked: false,
        reason: 'real_send_must_remain_disabled',
      });
    }

    return createInboundDryRunResult({
      enabled: true,
      status: 'outbound_blocked',
      outboundBlocked: true,
      reason: 'dry_run_active',
    });
  }

  evaluate({ status = 'processed', reason = null, outboundBlocked = true } = {}) {
    return createInboundDryRunResult({
      enabled: this.enabled,
      status,
      reason,
      outboundBlocked: this.enabled ? true : outboundBlocked,
    });
  }
}

module.exports = { InboundDryRunGuard };
