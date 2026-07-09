const { createWhatsAppCloudFeatureFlags } = require('./WhatsAppCloudFeatureFlags.ts');

class WhatsAppCloudDeliveryGuard {
  constructor(flags = {}) {
    this.flags = createWhatsAppCloudFeatureFlags(flags);
  }

  evaluateOutbound(message = {}) {
    if (!this.flags.sendEnabled) {
      return {
        allowed: false,
        reason: 'real_send_disabled_by_feature_flag',
        channel: 'whatsapp',
        messageId: message.id ?? null,
      };
    }

    return {
      allowed: true,
      reason: null,
      channel: 'whatsapp',
      messageId: message.id ?? null,
    };
  }
}

module.exports = { WhatsAppCloudDeliveryGuard };
