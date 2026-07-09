const SUPPORTED_MESSAGE_TYPES = ['text', 'audio', 'image', 'document'];

class WhatsAppCloudWebhookParser {
  parse(payload = {}) {
    const value = payload.entry?.[0]?.changes?.[0]?.value ?? payload.value ?? payload;
    const metadata = value.metadata ?? {};
    const message = value.messages?.[0] ?? null;

    if (!message) {
      return {
        ok: true,
        supported: false,
        reason: value.statuses?.[0] ? 'status_event_ignored' : 'message_event_missing',
        provider: 'whatsapp-cloud',
        phoneNumberId: metadata.phone_number_id ?? null,
        messageId: null,
        value,
      };
    }

    if (!SUPPORTED_MESSAGE_TYPES.includes(message.type)) {
      return {
        ok: true,
        supported: false,
        reason: 'message_type_unsupported',
        provider: 'whatsapp-cloud',
        phoneNumberId: metadata.phone_number_id ?? null,
        messageId: message.id ?? null,
        value,
        message,
      };
    }

    return {
      ok: true,
      supported: true,
      reason: null,
      provider: 'whatsapp-cloud',
      phoneNumberId: metadata.phone_number_id ?? null,
      messageId: message.id ?? null,
      messageType: message.type,
      value,
      message,
    };
  }
}

module.exports = { WhatsAppCloudWebhookParser, SUPPORTED_MESSAGE_TYPES };
