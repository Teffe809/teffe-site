const SENSITIVE_KEYS = [
  'authorization',
  'x-hub-signature-256',
  'access_token',
  'accessToken',
  'accessTokenRef',
  'appSecret',
  'appSecretRef',
  'verifyToken',
  'verifyTokenRef',
  'rawBody',
  'body',
];

class LogSanitizer {
  sanitize(value) {
    return sanitizeValue(value);
  }
}

function sanitizeValue(value, key = '') {
  if (value == null) {
    return value;
  }

  if (isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return maskString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, entryKey),
      ])
    );
  }

  return value;
}

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.some((sensitive) => sensitive.toLowerCase() === String(key).toLowerCase());
}

function maskString(value) {
  return String(value)
    .replace(/\+?\d{10,15}/g, (match) => maskPhone(match))
    .replace(/sha256=[a-f0-9]{64}/gi, 'sha256=[REDACTED]')
    .replace(/(token|secret|authorization)=([^&\s]+)/gi, '$1=[REDACTED]');
}

function maskPhone(phone) {
  const raw = String(phone);
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) {
    return raw;
  }

  return `${raw.startsWith('+') ? '+' : ''}${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

module.exports = { LogSanitizer, maskPhone };
