# Sprint 25 - Secure Webhook Runtime Foundation

## Objetivo

Criar a fundacao segura para receber webhooks reais de canais externos, iniciando pelo WhatsApp Cloud API, sem usar token real, sem versionar segredos e sem envio real para a Meta.

## Arquitetura

O runtime de webhook fica em `src/runtime/webhook` e atua antes dos adapters de canal:

1. Recebe request HTTP bruto.
2. Identifica provider/canal.
3. Resolve configuracao do tenant em `TenantChannelConfigLoader`.
4. Busca segredos apenas por referencia via `SecretProvider`.
5. Valida handshake ou assinatura.
6. Encaminha payload validado ao `WhatsAppCloudAdapter`.
7. O adapter normaliza para `ChannelInboundMessage`.
8. A plataforma executa Communication Gateway, Message Understanding e Workflow Dispatcher.
9. A resposta outbound ainda e mockada.

## Fluxo GET Verification

`GET /webhook/whatsapp-cloud` recebe os parametros `hub.mode`, `hub.verify_token` e `hub.challenge`.

O runtime compara `hub.verify_token` com o valor resolvido por `verifyTokenRef`. A resposta de sucesso retorna apenas o challenge. Falhas retornam erro seguro sem expor segredos ou nomes sensiveis.

## Fluxo POST Inbound

`POST /webhook/whatsapp-cloud` recebe o payload bruto e o header `x-hub-signature-256`.

Nesta sprint a assinatura e validada com HMAC SHA-256 usando o segredo resolvido por referencia. O payload e entao mapeado pelo adapter do WhatsApp Cloud e enviado ao fluxo existente da plataforma.

## Configuracao Por Tenant

Cada configuracao de canal contem:

- `tenantId`
- `channel`
- `provider`
- `phoneNumberId`
- `businessAccountId`
- `verifyTokenRef`
- `accessTokenRef`
- `enabled`
- `mode`

`verifyTokenRef` e `accessTokenRef` sao referencias para um provider de segredo. Eles nao devem conter valores reais.

## Preparacao Para WhatsApp Sandbox

Para uma futura Sprint 26, o sandbox deve fornecer variaveis de ambiente locais para as referencias configuradas. O envio real para a Meta continua fora desta sprint.

## Checklist De Seguranca

- Nao versionar `.env`.
- Nao colocar token direto em codigo, teste ou documentacao.
- Usar `MockSecretProvider` em teste.
- Usar `EnvSecretProvider` em runtime local.
- Rejeitar assinatura invalida.
- Rejeitar canal desabilitado.
- Retornar erro seguro quando segredo faltar.
- Manter WhatsApp isolado do Workflow Engine e das capabilities.
