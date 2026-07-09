class WhatsAppCloudWebhookVerifier {
  constructor({ verifyToken = null } = {}) {
    this.verifyToken = verifyToken;
  }

  verifyHandshake(query = {}) {
    if (!this.verifyToken) {
      return {
        ok: true,
        mode: query['hub.mode'] ?? null,
        challenge: query['hub.challenge'] ?? null,
        mock: true,
      };
    }

    const token = query['hub.verify_token'];
    const ok = token === this.verifyToken;
    return {
      ok,
      mode: query['hub.mode'] ?? null,
      challenge: ok ? query['hub.challenge'] ?? null : null,
      mock: false,
    };
  }

  verifySignature() {
    return {
      ok: true,
      mock: true,
      reason: 'signature verification is not enabled until real Meta integration',
    };
  }
}

module.exports = { WhatsAppCloudWebhookVerifier };
