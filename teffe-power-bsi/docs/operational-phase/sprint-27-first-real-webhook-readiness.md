# Sprint 27 - First Real Webhook Readiness

## Objetivo

Preparar a TEFFE Platform para receber o primeiro webhook real inbound da Meta/WhatsApp Cloud API em sandbox, com tunnel local controlado, logs sanitizados, idempotencia persistente local e envio real bloqueado.

## Arquitetura

O runtime local usa:

- `FileIdempotencyStore` para persistir `messageId` processado em arquivo local fora do Git.
- `SanitizedLogger` para registrar boot e requests sem segredo, telefone completo ou raw body.
- `WebhookRuntime` para validar assinatura, parsear payload, deduplicar e encaminhar ao adapter.
- `WhatsAppCloudDeliveryGuard` para bloquear envio real quando `TEFFE_WHATSAPP_SEND_ENABLED=false`.

## Variaveis Locais

Configurar apenas em `.env` local:

- `TEFFE_WEBHOOK_PORT`
- `TEFFE_WEBHOOK_PUBLIC_URL`
- `TEFFE_WHATSAPP_VERIFY_TOKEN_REF`
- `TEFFE_WHATSAPP_APP_SECRET_REF`
- `TEFFE_WHATSAPP_SEND_ENABLED=false`
- `TEFFE_IDEMPOTENCY_STORE_FILE=data/idempotency-store.json`

Os valores reais referenciados por `_REF` ficam somente no ambiente local.

## Readiness Check

Executar:

```bash
node scripts/check-webhook-readiness.js
```

O check valida `.env` local, envio bloqueado, refs obrigatorias, porta configurada, arquivo de idempotencia fora do Git e inicializacao segura da configuracao.

## Resultado Esperado

O primeiro webhook real deve:

1. Ser recebido com raw body preservado.
2. Ter assinatura validada.
3. Ser normalizado pelo adapter.
4. Ser auditado pela plataforma.
5. Executar workflow interno se for mensagem suportada.
6. Bloquear qualquer envio real para Meta.
7. Persistir `messageId` para evitar reprocessamento apos restart.

## Pontos De Atencao

- Nao ativar `TEFFE_WHATSAPP_SEND_ENABLED=true` nesta fase.
- Nao commitar `.env`.
- Nao copiar segredo em log, ticket ou relatorio.
- A URL publica do tunnel deve ser temporaria e controlada.
