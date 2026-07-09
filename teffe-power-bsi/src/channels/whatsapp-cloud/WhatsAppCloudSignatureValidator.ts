const crypto = require('crypto');

class WhatsAppCloudSignatureValidator {
  validate({ rawBody, signature, appSecret } = {}) {
    if (!rawBody) {
      return { ok: false, reason: 'raw_body_required' };
    }

    if (!appSecret) {
      return { ok: false, reason: 'signature_secret_missing' };
    }

    if (!signature || !String(signature).startsWith('sha256=')) {
      return { ok: false, reason: 'signature_missing' };
    }

    const expected = this.sign(rawBody, appSecret);
    return {
      ok: timingSafeEqual(signature, expected),
      reason: timingSafeEqual(signature, expected) ? null : 'signature_invalid',
    };
  }

  sign(rawBody, appSecret) {
    return `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
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

module.exports = { WhatsAppCloudSignatureValidator };
