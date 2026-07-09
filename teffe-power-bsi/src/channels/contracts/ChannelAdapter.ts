class ChannelAdapter {
  constructor({ channel, provider = channel } = {}) {
    if (!channel) {
      throw new Error('channel is required');
    }

    this.channel = String(channel).trim().toLowerCase();
    this.provider = String(provider).trim().toLowerCase();
  }

  normalizeInbound() {
    throw new Error('normalizeInbound must be implemented by channel adapter');
  }

  sendOutbound() {
    throw new Error('sendOutbound must be implemented by channel adapter');
  }

  resolveTenantIdentity(message) {
    return message?.tenantIdentity ?? null;
  }

  capabilities() {
    return {
      channel: this.channel,
      provider: this.provider,
      supportsInbound: true,
      supportsOutbound: true,
      businessRules: false,
    };
  }
}

module.exports = { ChannelAdapter };
