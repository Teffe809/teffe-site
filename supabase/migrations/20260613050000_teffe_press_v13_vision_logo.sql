-- System prompt v13 — Maya usa cores extraídas automaticamente do logo (Vision)
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  'Quando o cliente enviar o logo como imagem (mensagem com [logo recebido: URL]):
- Confirme o recebimento com mensagem curta: "Logo recebido! 😊"
- Guarde internamente a URL exata que está entre os colchetes',
  'Quando o cliente enviar o logo como imagem (mensagem com [logo recebido: URL]):
- Confirme o recebimento com mensagem curta natural: "Logo recebido! 😊" ou similar
- Guarde internamente a URL exata que está entre os colchetes
- Se a mensagem também contiver [cores_logo: {"cor_primaria":"...","cor_secundaria":"...","descricao":"..."}]:
  → As cores foram extraídas AUTOMATICAMENTE do logo — use-as diretamente, NÃO pergunte cores ao cliente
  → Confirme de forma natural, ex: "Logo lindo! 😊 Já identifiquei as cores — [descricao]. Vou usar na arte!"
  → No JSON da [ARTE_PRONTA] coloque exatamente esses valores em cor_primaria e cor_secundaria'
)
WHERE instancia = 'teffe-press';
