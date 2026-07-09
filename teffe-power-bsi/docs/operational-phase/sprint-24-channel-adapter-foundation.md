# Sprint 24 - Pilot Channel Adapter Foundation

## Objetivo

Criar a fundacao operacional para canais reais da TEFFE Platform, iniciando pelo WhatsApp Cloud API sem integrar a API real da Meta, sem token real e sem chamadas externas.

## Arquitetura

O canal externo fica isolado em adapters sob `src/channels`. Cada adapter converte payloads do provedor para um contrato interno comum:

- `ChannelInboundMessage`
- `ChannelOutboundMessage`
- `ChannelDeliveryResult`
- `ChannelTenantIdentity`
- `ChannelAdapter`

O fluxo operacional fica:

1. Adapter recebe ou simula mensagem inbound.
2. Communication Gateway normaliza a mensagem para o formato interno da plataforma.
3. Tenant Specialization resolve tenant, biblioteca e workflow.
4. Message Understanding interpreta a mensagem textual.
5. Workflow Dispatcher executa o workflow desacoplado.
6. Communication Gateway cria uma resposta outbound padronizada.
7. Adapter envia a resposta no canal, ainda mockado nesta sprint.

## Por Que WhatsApp Fica Isolado

O WhatsApp Cloud API possui payloads, verificacao de webhook, identificadores de telefone e formato de envio proprios. Esses detalhes nao devem entrar no Workflow Engine, capabilities ou regras de negocio.

Nesta sprint, `WhatsAppCloudAdapter`, `WhatsAppCloudMessageMapper` e `WhatsAppCloudWebhookVerifier` sao mockados e nao executam chamada externa. Isso permite validar contratos e fluxo antes de lidar com token, assinatura, webhook publico e limites reais da Meta.

## Preparacao Para Piloto Damasceno

A base permite configurar um tenant white-label com identidade propria e plugar um numero/canal no futuro sem alterar as capabilities. Para o piloto Damasceno, o proximo passo sera mapear o numero oficial do canal para `tenantId`, validar webhook real em ambiente seguro e transformar respostas do workflow em mensagens adequadas para atendimento.

## Proximos Passos Para Sprint 25

- Criar configuracao segura por tenant/canal.
- Implementar verificacao real de webhook sem versionar segredos.
- Adicionar camada de outbound templates e fallback humano.
- Validar retries e idempotencia de mensagens.
- Preparar ambiente de sandbox para WhatsApp Cloud API.
