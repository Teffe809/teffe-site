# WhatsApp Sandbox - First Webhook Checklist

## 1. Preparar Ambiente Local

1. Criar `.env` local a partir de `.env.example.local`.
2. Preencher valores reais somente no `.env` local.
3. Confirmar `TEFFE_WHATSAPP_SEND_ENABLED=false`.
4. Confirmar `TEFFE_IDEMPOTENCY_STORE_FILE=data/idempotency-store.json`.
5. Executar `node scripts/check-webhook-readiness.js`.

## 2. Subir Runtime

```bash
node scripts/start-webhook-runtime.js
```

Confirmar no boot:

- porta correta
- URL publica esperada
- `real_send_blocked`
- arquivo de idempotencia local

## 3. Expor Com Tunnel Local

Usar uma ferramenta de tunnel aprovada pelo ambiente operacional. A URL publica deve apontar para:

```text
http://localhost:<porta>/webhook/whatsapp-cloud
```

## 4. Configurar Callback URL Na Meta

No painel da Meta, configurar a callback URL do tunnel:

```text
https://<tunnel>/webhook/whatsapp-cloud
```

Usar o verify token configurado localmente. Nao registrar token em documento.

## 5. Validar GET Verification

A Meta chamara `GET /webhook/whatsapp-cloud`.

Resultado esperado:

- HTTP 200
- body igual ao challenge
- nenhum segredo nos logs

## 6. Enviar Primeira Mensagem De Teste

Enviar uma mensagem sandbox para o numero configurado.

Resultado esperado:

- HTTP 200 no POST inbound
- assinatura validada
- mensagem normalizada
- workflow executado se mensagem suportada
- envio outbound bloqueado por feature flag

## 7. Confirmar Inbound Recebido

Verificar logs sanitizados:

- `webhook.request.handled`
- status 200
- telefone mascarado
- raw body redigido
- nenhuma credencial exposta

## 8. Confirmar Envio Bloqueado

Confirmar que a resposta/delivery indica bloqueio por:

```text
real_send_disabled_by_feature_flag
```

## 9. Parar Runtime

Encerrar o processo local e desativar o tunnel.

## 10. Salvar Relatorio

Registrar apenas:

- data/hora
- tenant
- provider
- status GET verification
- status POST inbound
- messageId mascarado ou parcial
- resultado da idempotencia
- confirmacao de envio bloqueado
- erros observados sem segredos
