const { ChannelAdapter } = require('../contracts/ChannelAdapter.ts');
const { createChannelDeliveryResult } = require('../contracts/ChannelDeliveryResult.ts');
const { WhatsAppCloudDeliveryGuard } = require('./WhatsAppCloudDeliveryGuard.ts');
const { WhatsAppCloudMessageMapper } = require('./WhatsAppCloudMessageMapper.ts');

class WhatsAppCloudAdapter extends ChannelAdapter {
  constructor({
    mapper = new WhatsAppCloudMessageMapper(),
    failSend = false,
    deliveryGuard = new WhatsAppCloudDeliveryGuard({ sendEnabled: false }),
  } = {}) {
    super({ channel: 'whatsapp', provider: 'whatsapp-cloud' });
    this.mapper = mapper;
    this.failSend = failSend;
    this.deliveryGuard = deliveryGuard;
    this.sent = [];
  }

  normalizeInbound(payload) {
    return this.mapper.toChannelInbound(payload);
  }

  sendOutbound(message) {
    const guard = this.deliveryGuard.evaluateOutbound(message);
    if (!guard.allowed) {
      const providerPayload = this.mapper.toWhatsAppOutbound(message);
      this.sent.push({ message, providerPayload, blocked: true, reason: guard.reason });
      return createChannelDeliveryResult({
        ok: true,
        channel: this.channel,
        messageId: message.id,
        providerMessageId: null,
        tenantId: message.tenantIdentity.tenantId,
        status: 'blocked',
        metadata: {
          providerPayload,
          realSendBlocked: true,
          reason: guard.reason,
          mock: true,
        },
      });
    }

    if (this.failSend) {
      return createChannelDeliveryResult({
        ok: false,
        channel: this.channel,
        messageId: message.id,
        tenantId: message.tenantIdentity.tenantId,
        error: {
          code: 'whatsapp_cloud_mock_send_failed',
          message: 'Mock WhatsApp Cloud delivery failure',
        },
      });
    }

    const providerPayload = this.mapper.toWhatsAppOutbound(message);
    this.sent.push({ message, providerPayload });
    return createChannelDeliveryResult({
      ok: true,
      channel: this.channel,
      messageId: message.id,
      providerMessageId: `mock_whatsapp_${Date.now()}`,
      tenantId: message.tenantIdentity.tenantId,
      metadata: {
        providerPayload,
        mock: true,
      },
    });
  }
}

module.exports = { WhatsAppCloudAdapter };
