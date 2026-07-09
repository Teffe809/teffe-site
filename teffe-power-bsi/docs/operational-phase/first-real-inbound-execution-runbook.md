# First Real Inbound Execution Runbook

1. Criar ou conferir o `.env` local a partir de `.env.example.local`.
2. Confirmar `TEFFE_WHATSAPP_SEND_ENABLED=false`.
3. Confirmar `TEFFE_INBOUND_DRY_RUN=true`.
4. Rodar `node scripts/check-webhook-readiness.js`.
5. Subir o runtime com `node scripts/start-webhook-runtime.js`.
6. Expor a porta local por um tunnel HTTPS controlado.
7. Configurar a callback URL na Meta usando a URL publica do tunnel mais `/webhook/whatsapp-cloud`.
8. Informar o Verify Token local configurado no `.env`.
9. Confirmar a verificacao GET da Meta.
10. Assinar o campo `messages` no webhook da Meta.
11. Enviar uma unica mensagem de teste para o numero sandbox.
12. Confirmar recebimento no runtime.
13. Confirmar que a assinatura foi validada.
14. Confirmar que a mensagem foi normalizada.
15. Confirmar que o tenant foi resolvido.
16. Confirmar que o outbound ficou bloqueado.
17. Reenviar o mesmo payload apenas em teste controlado para validar idempotencia.
18. Rodar `node scripts/report-first-whatsapp-inbound.js`.
19. Parar o runtime e o tunnel.
20. Remover ou proteger evidencias locais.

## Comandos Locais

```powershell
node scripts/check-webhook-readiness.js
node scripts/start-webhook-runtime.js
node scripts/report-first-whatsapp-inbound.js
```

## Regras

- Nao colocar token real, App Secret, Verify Token ou URL privada real em arquivos versionados.
- Nao desativar validacao de assinatura.
- Nao ativar envio real.
- Nao versionar `data/inbound-observations.jsonl`.
- Nao publicar payload bruto da Meta.
