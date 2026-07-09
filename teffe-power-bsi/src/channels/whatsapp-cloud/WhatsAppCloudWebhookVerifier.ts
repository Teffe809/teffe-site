const { WhatsAppCloudSignatureValidator } = require('./WhatsAppCloudSignatureValidator.ts');

class WhatsAppCloudWebhookVerifier {
  constructor({ verifyToken = null } = {}) {
    this.verifyToken = verifyToken;
    this.signatureValidator = new WhatsAppCloudSignatureValidator();
  }

  verifyHandshake(query = {}, verifyToken = this.verifyToken) {
    const token = query['hub.verify_token'];
    if (!verifyToken) {
      return {
        ok: false,
        mode: query['hub.mode'] ?? null,
        challenge: null,
        reason: 'verify_secret_missing',
      };
    }

    const ok = token === verifyToken;
    return {
      ok,
      mode: query['hub.mode'] ?? null,
      challenge: ok ? query['hub.challenge'] ?? null : null,
      reason: ok ? null : 'verify_token_invalid',
    };
  }

  verifySignature({ rawBody = '', signature = '', secret = null } = {}) {
    return this.signatureValidator.validate({ rawBody, signature, appSecret: secret });
  }
}

module.exports = { WhatsAppCloudWebhookVerifier };
