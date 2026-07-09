const { createChannelInboundMessage } = require('../contracts/ChannelInboundMessage.ts');
const { createChannelOutboundMessage } = require('../contracts/ChannelOutboundMessage.ts');
const { WHATSAPP_CLOUD_CHANNEL } = require('./WhatsAppCloudTypes.ts');

class WhatsAppCloudMessageMapper {
  constructor({ tenantResolver } = {}) {
    this.tenantResolver = tenantResolver || defaultTenantResolver;
  }

  toChannelInbound(webhookPayload = {}) {
    const value = webhookPayload.entry?.[0]?.changes?.[0]?.value ?? webhookPayload.value ?? {};
    const message = value.messages?.[0] ?? webhookPayload.message ?? {};
    const contact = value.contacts?.[0] ?? {};
    const metadata = value.metadata ?? {};
    const tenantIdentity = this.tenantResolver({
      phoneNumberId: metadata.phone_number_id,
      displayPhoneNumber: metadata.display_phone_number,
      payload: webhookPayload,
    });

    return createChannelInboundMessage({
      id: message.id,
      channel: WHATSAPP_CLOUD_CHANNEL,
      type: normalizeType(message.type),
      tenantIdentity,
      sender: {
        id: message.from,
        phone: message.from,
        name: contact.profile?.name ?? null,
      },
      recipient: {
        id: metadata.phone_number_id,
        phone: metadata.display_phone_number,
      },
      timestamp: message.timestamp
        ? new Date(Number(message.timestamp) * 1000).toISOString()
        : undefined,
      payload: normalizePayload(message),
      metadata: {
        provider: 'whatsapp-cloud',
        phoneNumberId: metadata.phone_number_id ?? null,
        displayPhoneNumber: metadata.display_phone_number ?? null,
      },
      raw: webhookPayload,
    });
  }

  toWhatsAppOutbound(channelMessage) {
    if (channelMessage.type !== 'text') {
      return {
        messaging_product: 'whatsapp',
        to: channelMessage.recipient.address || channelMessage.recipient.id,
        type: channelMessage.type,
        mock: true,
        payload: channelMessage.payload,
      };
    }

    return {
      messaging_product: 'whatsapp',
      to: channelMessage.recipient.address || channelMessage.recipient.id,
      type: 'text',
      text: {
        body: channelMessage.payload.text,
      },
      mock: true,
    };
  }

  fromGatewayOutbound(input) {
    return createChannelOutboundMessage({
      ...input,
      channel: WHATSAPP_CLOUD_CHANNEL,
    });
  }
}

function normalizeType(type) {
  return ['text', 'audio', 'image', 'document'].includes(type) ? type : 'text';
}

function normalizePayload(message) {
  if (message.type === 'text') {
    return { text: String(message.text?.body ?? '').trim() };
  }

  if (message.type === 'audio') {
    return {
      url: message.audio?.id ?? '',
      durationSeconds: 0,
      mimeType: message.audio?.mime_type ?? '',
      transcript: null,
    };
  }

  if (message.type === 'image') {
    return {
      url: message.image?.id ?? '',
      mimeType: message.image?.mime_type ?? '',
      caption: message.image?.caption ?? null,
    };
  }

  if (message.type === 'document') {
    return {
      url: message.document?.id ?? '',
      mimeType: message.document?.mime_type ?? '',
      fileName: message.document?.filename ?? 'document',
      title: message.document?.caption ?? null,
    };
  }

  return { text: '' };
}

function defaultTenantResolver({ phoneNumberId }) {
  return {
    tenantId: 'autopecas',
    channelTenantId: phoneNumberId ?? null,
    displayName: null,
    metadata: {
      resolver: 'mock',
    },
  };
}

module.exports = { WhatsAppCloudMessageMapper };
