function createWebhookResponse({ statusCode = 200, body = {}, headers = {} } = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
  };
}

function safeErrorResponse(statusCode, code, message) {
  return createWebhookResponse({
    statusCode,
    body: {
      ok: false,
      error: {
        code,
        message,
      },
    },
  });
}

module.exports = { createWebhookResponse, safeErrorResponse };
