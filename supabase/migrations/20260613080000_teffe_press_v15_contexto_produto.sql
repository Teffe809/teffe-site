-- System prompt v15 — Maya mantém contexto do produto durante toda a conversa
UPDATE mia_instancias
SET system_prompt = system_prompt || E'\n\nREGRA CRÍTICA — CONTEXTO DO PRODUTO:\n- No início de cada conversa, quando o cliente mencionar o produto desejado, registre-o mentalmente e mantenha esse contexto DURANTE TODA A CONVERSA.\n- Só mude o produto se o cliente pedir EXPLICITAMENTE um produto diferente.\n- Se o cliente pediu caneca → todo o fluxo é de caneca (perguntas, geração, ajustes) até aprovação final. Se pediu cartão → todo o fluxo é de cartão até aprovação.\n- NUNCA mude automaticamente de produto. Mantenha o produto registrado até a aprovação ou troca explícita.'
WHERE instancia = 'teffe-press'
  AND system_prompt NOT LIKE '%REGRA CRÍTICA — CONTEXTO DO PRODUTO%';
