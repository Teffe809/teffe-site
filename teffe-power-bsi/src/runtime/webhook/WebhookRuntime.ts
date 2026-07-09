const { createWebhookRequest } = require('./WebhookRequest.ts');
const { createWebhookResponse, safeErrorResponse } = require('./WebhookResponse.ts');
const { createWebhookRuntimeConfig } = require('./WebhookRuntimeConfig.ts');
const { createWebhookSecurityResult } = require('./WebhookSecurityResult.ts');
const { WhatsAppCloudAdapter } = require('../../channels/whatsapp-cloud/WhatsAppCloudAdapter.ts');
const { WhatsAppCloudDeliveryGuard } = require('../../channels/whatsapp-cloud/WhatsAppCloudDeliveryGuard.ts');
const { WhatsAppCloudMessageMapper } = require('../../channels/whatsapp-cloud/WhatsAppCloudMessageMapper.ts');
const { WhatsAppCloudWebhookParser } = require('../../channels/whatsapp-cloud/WhatsAppCloudWebhookParser.ts');
const { WhatsAppCloudWebhookVerifier } = require('../../channels/whatsapp-cloud/WhatsAppCloudWebhookVerifier.ts');
const { InboundDryRunGuard } = require('../dry-run/InboundDryRunGuard.ts');
const { InMemoryIdempotencyStore } = require('../idempotency/InMemoryIdempotencyStore.ts');
const { maskPhone } = require('../logging/LogSanitizer.ts');
const { InboundObservationService } = require('../observation/InboundObservationService.ts');
const { maskIdentifier } = require('../observation/InboundObservationRecord.ts');

class WebhookRuntime {
  constructor({
    configLoader,
    secretProvider,
    platform,
    verifier = new WhatsAppCloudWebhookVerifier(),
    parser = new WhatsAppCloudWebhookParser(),
    idempotencyStore = new InMemoryIdempotencyStore(),
    observationService = new InboundObservationService(),
    dryRunGuard = null,
    runtimeConfig = {},
  } = {}) {
    if (!configLoader) throw new Error('configLoader is required');
    if (!secretProvider) throw new Error('secretProvider is required');
    if (!platform) throw new Error('platform is required');

    this.configLoader = configLoader;
    this.secretProvider = secretProvider;
    this.platform = platform;
    this.verifier = verifier;
    this.parser = parser;
    this.idempotencyStore = idempotencyStore;
    this.observationService = observationService;
    this.runtimeConfig = createWebhookRuntimeConfig(runtimeConfig);
    this.dryRunGuard = dryRunGuard ?? new InboundDryRunGuard({
      enabled: this.runtimeConfig.inboundDryRun,
      sendEnabled: this.runtimeConfig.whatsappSendEnabled,
    });
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
    if (this.runtimeConfig.requireSignature && !request.rawBody) {
      return safeErrorResponse(400, 'raw_body_required', 'Raw body is required for webhook signature validation');
    }

    const body = this.parseJson(request.rawBody);
    if (!body.ok) {
      return safeErrorResponse(400, 'invalid_json_payload', 'Webhook payload is invalid');
    }

    const parsed = this.parser.parse(body.value);
    const phoneNumberId = parsed.phoneNumberId ?? this.extractPhoneNumberId(body.value);
    const config = this.configLoader.findByPhoneNumberId(request.provider, phoneNumberId)
      ?? this.configLoader.findByProvider(request.provider);

    if (!config) {
      this.recordObservation({
        request,
        parsed,
        provider: request.provider,
        channel: this.runtimeConfig.channel,
        signature: 'not_validated',
        parser: parsed.supported ? 'accepted' : parsed.reason,
        idempotency: 'not_checked',
        workflow: null,
        processing: 'tenant_not_found',
        outboundBlocked: true,
        outboundReason: 'tenant_not_found',
      });
      return safeErrorResponse(404, 'tenant_channel_not_found', 'Tenant channel configuration was not found');
    }

    if (!config.enabled) {
      this.recordObservation({
        request,
        parsed,
        config,
        signature: 'not_validated',
        parser: parsed.supported ? 'accepted' : parsed.reason,
        idempotency: 'not_checked',
        workflow: null,
        processing: 'tenant_channel_disabled',
        outboundBlocked: true,
        outboundReason: 'tenant_channel_disabled',
      });
      return safeErrorResponse(403, 'tenant_channel_disabled', 'Tenant channel is disabled');
    }

    const security = this.validateInboundSecurity(request, config);
    if (!security.ok) {
      this.recordObservation({
        request,
        parsed,
        config,
        signature: security.reason,
        parser: parsed.supported ? 'accepted' : parsed.reason,
        idempotency: 'not_checked',
        workflow: null,
        processing: security.reason === 'signature_invalid' ? 'invalid_signature' : 'security_failed',
        outboundBlocked: true,
        outboundReason: security.reason,
      });
      return safeErrorResponse(security.statusCode, security.reason, 'Webhook security validation failed');
    }

    if (!parsed.supported) {
      this.recordObservation({
        request,
        parsed,
        config,
        signature: 'valid',
        parser: parsed.reason,
        idempotency: 'not_checked',
        workflow: null,
        processing: 'ignored',
        outboundBlocked: true,
        outboundReason: 'unsupported_event',
      });
      return createWebhookResponse({
        statusCode: 200,
        body: {
          ok: true,
          ignored: true,
          reason: parsed.reason,
          provider: request.provider,
          tenantId: config.tenantId,
          channel: config.channel,
        },
      });
    }

    const idempotency = this.idempotencyStore.checkAndStore(parsed.messageId);
    if (idempotency.reason === 'message_id_missing') {
      this.recordObservation({
        request,
        parsed,
        config,
        signature: 'valid',
        parser: 'accepted',
        idempotency: 'message_id_missing',
        workflow: null,
        processing: 'ignored',
        outboundBlocked: true,
        outboundReason: 'message_id_missing',
      });
      return safeErrorResponse(202, 'message_id_missing', 'Webhook event did not include a message id');
    }

    if (idempotency.duplicate) {
      this.recordObservation({
        request,
        parsed,
        config,
        signature: 'valid',
        parser: 'accepted',
        idempotency: 'duplicate',
        workflow: null,
        processing: 'duplicate',
        outboundBlocked: true,
        outboundReason: 'duplicate_message',
      });
      return createWebhookResponse({
        statusCode: 200,
        body: {
          ok: true,
          duplicate: true,
          messageId: maskIdentifier(parsed.messageId),
          reason: idempotency.reason,
        },
      });
    }

    const adapter = this.createAdapter(config);
    const inbound = adapter.normalizeInbound(body.value);
    let result;
    try {
      result = this.platform.engines.miaCore.handleChannelInbound({
        channelMessage: inbound,
        channelAdapter: adapter,
        userId: 'webhook-runtime',
      });
    } catch (_error) {
      this.recordObservation({
        request,
        parsed,
        config,
        inbound,
        signature: 'valid',
        parser: 'accepted',
        idempotency: 'first_seen',
        workflow: null,
        processing: 'processing_failed',
        outboundBlocked: true,
        outboundReason: 'internal_error',
      });
      return safeErrorResponse(500, 'webhook_processing_failed', 'Webhook processing failed');
    }

    if (!result.ok) {
      this.recordObservation({
        request,
        parsed,
        config,
        inbound,
        signature: 'valid',
        parser: 'accepted',
        idempotency: 'first_seen',
        workflow: result.dispatch?.workflow ?? null,
        processing: 'processing_failed',
        outboundBlocked: true,
        outboundReason: result.error?.code ?? result.delivery?.error?.code ?? 'workflow_dispatch_failed',
      });
      return createWebhookResponse({
        statusCode: 400,
        body: {
          ok: false,
          error: result.error ?? result.delivery?.error ?? { code: 'workflow_dispatch_failed' },
        },
      });
    }

    const outboundBlocked = result.delivery?.status === 'blocked'
      || result.delivery?.metadata?.realSendBlocked === true
      || this.runtimeConfig.whatsappSendEnabled !== true
      || this.runtimeConfig.inboundDryRun === true;
    const dryRun = this.dryRunGuard.evaluate({
      status: outboundBlocked ? 'outbound_blocked' : 'processed',
      outboundBlocked,
      reason: outboundBlocked ? 'real_send_blocked' : 'processed',
    });

    this.recordObservation({
      request,
      parsed,
      config,
      inbound,
      signature: 'valid',
      parser: 'accepted',
      idempotency: 'first_seen',
      workflow: result.dispatch.workflow,
      processing: 'processed',
      outboundBlocked: dryRun.outboundBlocked,
      outboundReason: dryRun.reason,
    });

    return createWebhookResponse({
      statusCode: 200,
      body: {
        ok: true,
        provider: request.provider,
        tenantId: config.tenantId,
        channel: config.channel,
        inboundMessageId: maskIdentifier(inbound.id),
          idempotency: sanitizeIdempotency(idempotency),
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
    const signatureSecret = this.secretProvider.getSecret(config.appSecretRef ?? config.verifyTokenRef);
    if (!signatureSecret) {
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
      secret: signatureSecret,
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
      deliveryGuard: new WhatsAppCloudDeliveryGuard({
        sendEnabled: this.runtimeConfig.whatsappSendEnabled,
      }),
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

  recordObservation({
    request,
    parsed = {},
    config = {},
    inbound = null,
    provider = null,
    channel = null,
    signature,
    parser,
    idempotency,
    workflow,
    processing,
    outboundBlocked,
    outboundReason,
  }) {
    this.observationService.record({
      timestamp: request.receivedAt,
      provider: provider ?? config.provider ?? request.provider,
      channel: channel ?? config.channel ?? this.runtimeConfig.channel,
      tenantId: config.tenantId ?? null,
      messageId: parsed.messageId ?? inbound?.id ?? null,
      sender: inbound?.sender?.phone ?? parsed.message?.from ?? null,
      messageType: parsed.messageType ?? parsed.message?.type ?? null,
      signature,
      parser,
      idempotency,
      workflow,
      processing,
      outboundBlocked,
      outboundReason,
      dryRun: this.runtimeConfig.inboundDryRun,
      maskedSender: maskPhone(inbound?.sender?.phone ?? parsed.message?.from ?? ''),
    });
  }
}

function sanitizeIdempotency(idempotency) {
  if (!idempotency) return idempotency;
  return {
    ...idempotency,
    key: maskIdentifier(idempotency.key),
  };
}

module.exports = { WebhookRuntime };
