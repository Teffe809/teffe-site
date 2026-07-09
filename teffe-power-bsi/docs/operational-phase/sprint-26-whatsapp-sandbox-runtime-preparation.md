# Sprint 26 - WhatsApp Sandbox Runtime Preparation

## Objetivo

Preparar a TEFFE Platform para validar webhooks reais do WhatsApp Cloud API em sandbox ou ambiente local exposto, mantendo envio real desativado por feature flag e sem versionar segredos.

## Arquitetura

O fluxo de webhook do WhatsApp passa pelas seguintes camadas:

1. `WebhookRuntime` recebe request HTTP com raw body e headers normalizados.
2. `WhatsAppCloudSignatureValidator` valida `X-Hub-Signature-256` com HMAC SHA-256.
3. `WhatsAppCloudWebhookParser` identifica mensagem suportada, status event ou evento ignorado.
4. `InMemoryIdempotencyStore` bloqueia reprocessamento por `messageId`.
5. `WhatsAppCloudAdapter` normaliza a mensagem para contrato de canal.
6. Communication Gateway, Message Understanding e Workflow Dispatcher executam o fluxo interno.
7. `WhatsAppCloudDeliveryGuard` bloqueia envio real quando `TEFFE_WHATSAPP_SEND_ENABLED=false`.

Nenhuma regra de negocio fica dentro do WhatsApp adapter.

## Variaveis Locais

Use `.env.example.local` como referencia segura. Os valores ali sao fake e devem ser substituidos localmente fora do Git.

Variaveis principais:

- `TEFFE_WEBHOOK_PORT`
- `TEFFE_WEBHOOK_TENANT_ID`
- `TEFFE_WEBHOOK_PHONE_NUMBER_ID`
- `TEFFE_WEBHOOK_BUSINESS_ACCOUNT_ID`
- `TEFFE_WHATSAPP_VERIFY_TOKEN_REF`
- `TEFFE_WHATSAPP_APP_SECRET_REF`
- `TEFFE_WHATSAPP_ACCESS_TOKEN_REF`
- `TEFFE_WHATSAPP_SEND_ENABLED=false`

As variaveis terminadas em `_REF` sao nomes de referencias. Os valores reais devem estar no ambiente local e nunca no repositorio.

## Testar GET Verification

Subir runtime local:

```bash
node scripts/start-webhook-runtime.js
```

Chamar:

```bash
curl "http://localhost:3100/webhook/whatsapp-cloud?hub.mode=subscribe&hub.verify_token=<valor-local>&hub.challenge=123"
```

Resposta esperada com token correto: `123`.

## Testar POST Inbound

O POST deve enviar o raw body exatamente igual ao usado para calcular `X-Hub-Signature-256`.

Eventos sem mensagem ou com tipo nao suportado retornam `200` com `ignored: true`.

Eventos repetidos com o mesmo `messageId` retornam `200` com `duplicate: true` e nao reexecutam workflow.

## Exposicao Local Futura

Para expor localmente em uma proxima sprint, usar tunnel controlado e apontar a URL publica para:

- `GET /webhook/whatsapp-cloud`
- `POST /webhook/whatsapp-cloud`

Antes disso, confirmar variaveis locais, assinatura, idempotencia e logs.

## Por Que Envio Real Continua Bloqueado

`WhatsAppCloudDeliveryGuard` bloqueia envio real quando `TEFFE_WHATSAPP_SEND_ENABLED=false`. O adapter pode montar payload de provider, mas nao faz chamada externa. Isso permite validar inbound real sem risco de disparar mensagens pela Meta.

## Checklist Antes De Usar Sandbox Meta

- `.env` fora do Git.
- App secret real somente no ambiente local.
- Verify token real somente no ambiente local.
- Access token real somente no ambiente local.
- `TEFFE_WHATSAPP_SEND_ENABLED=false`.
- Raw body preservado.
- Assinatura validada.
- Idempotencia ativa.
- Tenant/canal habilitado explicitamente.
- Nenhuma regra de negocio acoplada ao WhatsApp.
