const { ChannelAdapter } = require('../contracts/ChannelAdapter.ts');
const { createChannelInboundMessage } = require('../contracts/ChannelInboundMessage.ts');
const { createChannelDeliveryResult } = require('../contracts/ChannelDeliveryResult.ts');

class MockChannelAdapter extends ChannelAdapter {
  constructor({ channel = 'mock', failSend = false } = {}) {
    super({ channel, provider: 'mock' });
    this.failSend = failSend;
    this.inbound = [];
    this.outbound = [];
  }

  simulateInbound(input = {}) {
    const message = this.normalizeInbound(input);
    this.inbound.push(message);
    return message;
  }

  normalizeInbound(input = {}) {
    return createChannelInboundMessage({
      id: input.id,
      channel: input.channel ?? this.channel,
      type: input.type ?? 'text',
      tenantIdentity: input.tenantIdentity ?? {
        tenantId: input.tenantId ?? 'autopecas',
        channelTenantId: input.channelTenantId ?? 'mock-autopecas',
        displayName: input.displayName ?? 'MIA Autopecas',
      },
      sender: input.sender ?? { id: input.from ?? 'customer-1', address: input.from ?? 'customer-1' },
      recipient: input.recipient ?? { id: input.to ?? 'tenant-number-1', address: input.to ?? 'tenant-number-1' },
      payload: input.payload ?? { text: input.text ?? '' },
      metadata: {
        provider: 'mock',
        ...(input.metadata ?? {}),
      },
      raw: input.raw ?? input,
    });
  }

  sendOutbound(message) {
    if (this.failSend) {
      return createChannelDeliveryResult({
        ok: false,
        channel: this.channel,
        messageId: message.id,
        tenantId: message.tenantIdentity.tenantId,
        error: {
          code: 'mock_send_failed',
          message: 'Mock channel send failed',
        },
      });
    }

    this.outbound.push(message);
    return createChannelDeliveryResult({
      ok: true,
      channel: this.channel,
      messageId: message.id,
      providerMessageId: `mock_delivery_${Date.now()}`,
      tenantId: message.tenantIdentity.tenantId,
      metadata: {
        mock: true,
      },
    });
  }
}

module.exports = { MockChannelAdapter };
