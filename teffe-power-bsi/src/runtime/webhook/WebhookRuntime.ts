const { createWebhookRequest } = require('./WebhookRequest.ts');
const { createWebhookResponse, safeErrorResponse } = require('./WebhookResponse.ts');
const { createWebhookRuntimeConfig } = require('./WebhookRuntimeConfig.ts');
const { createWebhookSecurityResult } = require('./WebhookSecurityResult.ts');
const { WhatsAppCloudAdapter } = require('../../channels/whatsapp-cloud/WhatsAppCloudAdapter.ts');
const { WhatsAppCloudMessageMapper } = require('../../channels/whatsapp-cloud/WhatsAppCloudMessageMapper.ts');
const { WhatsAppCloudWebhookVerifier } = require('../../channels/whatsapp-cloud/WhatsAppCloudWebhookVerifier.ts');

class WebhookRuntime {
  constructor({
    configLoader,
    secretProvider,
    platform,
    verifier = new WhatsAppCloudWebhookVerifier(),
    runtimeConfig = {},
  } = {}) {
    if (!configLoader) throw new Error('configLoader is required');
    if (!secretProvider) throw new Error('secretProvider is required');
    if (!platform) throw new Error('platform is required');

    this.configLoader = configLoader;
    this.secretProvider = secretProvider;
    this.platform = platform;
    this.verifier = verifier;
    this.runtimeConfig = createWebhookRuntimeConfig(runtimeConfig);
  }

  handle(input) {
    const request = createWebhookRequest(input);
    if (request.provider !== this.runtimeConfig.provider) {
      return safeErrorResponse(404, 'webhook_provider_not_supported', 'Webhook provider is not supported');
    }

    if (request.method === 'GET') {
      return this.handleVerification(request);
    }

    if (request.method === 'POST') {
      return this.handleInbound(request);
    }

    return safeErrorResponse(405, 'method_not_allowed', 'Webhook method is not allowed');
  }

  handleVerification(request) {
    const config = this.configLoader.findByProvider(request.provider);
    if (!config) {
      return safeErrorResponse(404, 'tenant_channel_not_found', 'Tenant channel configuration was not found');
    }

    if (!config.enabled) {
      return safeErrorResponse(403, 'tenant_channel_disabled', 'Tenant channel is disabled');
    }

    const verifySecret = this.secretProvider.getSecret(config.verifyTokenRef);
    if (!verifySecret) {
      return safeErrorResponse(500, 'secret_missing', 'Required webhook secret is not available');
    }

    const verification = this.verifier.verifyHandshake(request.query, verifySecret);
    if (!verification.ok) {
      return safeErrorResponse(403, 'webhook_verification_failed', 'Webhook verification failed');
    }

    return createWebhookResponse({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: verification.challenge ?? '',
    });
  }

  handleInbound(request) {
    const body = this.parseJson(request.rawBody);
    if (!body.ok) {
      return safeErrorResponse(400, 'invalid_json_payload', 'Webhook payload is invalid');
    }

    const phoneNumberId = this.extractPhoneNumberId(body.value);
    const config = this.configLoader.findByPhoneNumberId(request.provider, phoneNumberId)
      ?? this.configLoader.findByProvider(request.provider);

    if (!config) {
      return safeErrorResponse(404, 'tenant_channel_not_found', 'Tenant channel configuration was not found');
    }

    if (!config.enabled) {
      return safeErrorResponse(403, 'tenant_channel_disabled', 'Tenant channel is disabled');
    }

    const security = this.validateInboundSecurity(request, config);
    if (!security.ok) {
      return safeErrorResponse(security.statusCode, security.reason, 'Webhook security validation failed');
    }

    const adapter = this.createAdapter(config);
    const inbound = adapter.normalizeInbound(body.value);
    const result = this.platform.engines.miaCore.handleChannelInbound({
      channelMessage: inbound,
      channelAdapter: adapter,
      userId: 'webhook-runtime',
    });

    if (!result.ok) {
      return createWebhookResponse({
        statusCode: 400,
        body: {
          ok: false,
          error: result.error ?? result.delivery?.error ?? { code: 'workflow_dispatch_failed' },
        },
      });
    }

    return createWebhookResponse({
      statusCode: 200,
      body: {
        ok: true,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
        inboundMessageId: inbound.id,
        workflow: result.dispatch.workflow,
        delivery: {
          ok: result.delivery.ok,
          status: result.delivery.status,
          messageId: result.delivery.messageId,
          providerMessageId: result.delivery.providerMessageId,
        },
      },
    });
  }

  validateInboundSecurity(request, config) {
    const verifySecret = this.secretProvider.getSecret(config.verifyTokenRef);
    if (!verifySecret) {
      return createWebhookSecurityResult({
        ok: false,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
        reason: 'secret_missing',
        statusCode: 500,
      });
    }

    const accessSecret = this.secretProvider.getSecret(config.accessTokenRef);
    if (!accessSecret) {
      return createWebhookSecurityResult({
        ok: false,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
        reason: 'secret_missing',
        statusCode: 500,
      });
    }

    if (!this.runtimeConfig.requireSignature) {
      return createWebhookSecurityResult({
        ok: true,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
      });
    }

    const signature = request.headers['x-hub-signature-256'];
    const signatureResult = this.verifier.verifySignature({
      rawBody: request.rawBody,
      signature,
      secret: verifySecret,
    });

    if (!signatureResult.ok) {
      return createWebhookSecurityResult({
        ok: false,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
        reason: 'signature_invalid',
        statusCode: 401,
      });
    }

    return createWebhookSecurityResult({
      ok: true,
      provider: request.provider,
      tenantId: config.tenantId,
      channel: config.channel,
    });
  }

  createAdapter(config) {
    return new WhatsAppCloudAdapter({
      mapper: new WhatsAppCloudMessageMapper({
        tenantResolver: ({ phoneNumberId }) => ({
          tenantId: config.tenantId,
          channelTenantId: phoneNumberId ?? config.phoneNumberId,
          displayName: config.metadata.displayName ?? null,
          metadata: {
            provider: config.provider,
            businessAccountId: config.businessAccountId,
            mode: config.mode,
          },
        }),
      }),
    });
  }

  parseJson(rawBody) {
    try {
      return { ok: true, value: JSON.parse(rawBody || '{}') };
    } catch (_error) {
      return { ok: false };
    }
  }

  extractPhoneNumberId(payload) {
    return payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
      ?? payload?.value?.metadata?.phone_number_id
      ?? payload?.metadata?.phone_number_id
      ?? null;
  }
}

module.exports = { WebhookRuntime };
