# Sprint 28 - First Real WhatsApp Inbound Event

## Objetivo

Preparar a TEFFE Platform para receber o primeiro webhook real inbound do WhatsApp Cloud API em sandbox, validando assinatura, parser, normalizacao, tenant, dispatch interno, auditoria e bloqueio total de outbound.

## Status da Sprint

- Parte A: preparacao tecnica automatizada.
- Parte B: execucao operacional manual com Meta, dependente de credenciais e tunnel HTTPS local.

O envio real continua desativado por `TEFFE_WHATSAPP_SEND_ENABLED=false` e o runtime operacional exige `TEFFE_INBOUND_DRY_RUN=true` em sandbox.

## Componentes Criados

- Observation runtime: persiste evidencias sanitizadas em `data/inbound-observations.jsonl`.
- Dry-run guard: impede entrega outbound durante validacao inbound.
- First inbound report: gera conclusao PASS/FAIL a partir de evidencias locais sanitizadas.

## Fluxo Tecnico

1. Meta envia POST para `/webhook/whatsapp-cloud`.
2. Runtime preserva `rawBody`.
3. Assinatura `X-Hub-Signature-256` e validada antes do processamento.
4. Parser identifica evento de mensagem ou ignora status/eventos sem acao.
5. Tenant e resolvido por `phoneNumberId`.
6. Idempotencia bloqueia duplicados.
7. Communication Gateway e Workflow Dispatcher processam o inbound permitido.
8. Outbound permanece bloqueado por feature flag e dry-run.
9. Evidencia sanitizada e gravada localmente.

## Evidencia Sanitizada

O arquivo local registra apenas:

- timestamp;
- provider;
- channel;
- tenant;
- messageId mascarado;
- telefone mascarado;
- tipo de mensagem;
- status da assinatura;
- status do parser;
- status da idempotencia;
- workflow selecionado;
- resultado do processamento;
- outbound bloqueado.

Nao sao persistidos tokens, segredos, payload bruto, assinatura, headers sensiveis ou telefone completo.

## Resultado Esperado

Parte A conclui como `PASS TECNICO` quando testes, readiness e protecoes Git passam.

Parte B so pode concluir como `PASS OPERACIONAL` apos Jefferson executar o runbook com credenciais locais e gerar evidencia real do webhook da Meta.
