const crypto = require('crypto');

class WhatsAppCloudWebhookVerifier {
  constructor({ verifyToken = null } = {}) {
    this.verifyToken = verifyToken;
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
    if (!secret) {
      return {
        ok: false,
        reason: 'signature_secret_missing',
      };
    }

    if (!signature || !signature.startsWith('sha256=')) {
      return {
        ok: false,
        reason: 'signature_missing',
      };
    }

    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;
    const ok = timingSafeEqual(signature, expected);

    return {
      ok,
      reason: ok ? null : 'signature_invalid',
    };
  }
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { WhatsAppCloudWebhookVerifier };
