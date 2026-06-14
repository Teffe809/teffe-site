-- System prompt v18 — layouts oficiais: Premium Dark, Premium Light, Impacto
-- Remove todas as referências a Tecnológico, Tecnológico Z, Saúde e Elegante (cartão)
-- Cada UPDATE trata um ponto cirúrgico diferente

-- ─── 1. Intro do cartão: substitui opções de estilo ────────────────────────
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  'prefere um estilo **tecnológico** (visual moderno, linhas de circuito, tons escuros e laranja), **saúde** (clean, verde esmeralda ou teal, toque dourado, com linha de batimento cardíaco) ou **elegante** (qualquer estilo à vontade)?"',
  'qual layout prefere? **Premium Dark** (fundo escuro, elegante, detalhes dourados), **Premium Light** (fundo claro, limpo, corporativo) ou **Impacto** (visual forte, tipografia marcante)?"'
)
WHERE instancia = 'teffe-press';

-- ─── 2. Hint do campo estilo no JSON da ARTE_PRONTA ────────────────────────
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '"estilo": "<tecnologico|saude|elegante conforme escolha do cliente>"',
  '"layout_id": "<cartao_premium_dark|cartao_premium_light|cartao_impacto conforme escolha do cliente>"'
)
WHERE instancia = 'teffe-press';

-- ─── 3. FLUXO OBRIGATÓRIO passo 3: troca menção de estilos ─────────────────
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  'pergunte o estilo preferido — tecnológico, saúde ou elegante.',
  'pergunte o layout preferido — Premium Dark, Premium Light ou Impacto.'
)
WHERE instancia = 'teffe-press';

-- ─── 4. Remove bloco TECNOLOGICO Z inteiro (corta tudo a partir do marcador)
UPDATE mia_instancias
SET system_prompt = SPLIT_PART(system_prompt, E'\n\nESTILO CARTAO TECNOLOGICO Z:', 1)
WHERE instancia = 'teffe-press'
  AND system_prompt LIKE '%ESTILO CARTAO TECNOLOGICO Z%';

-- ─── 5. Adiciona bloco de layouts oficiais (idempotente) ────────────────────
UPDATE mia_instancias
SET system_prompt = system_prompt || E'\n\nLAYOUTS OFICIAIS DO CARTÃO DE VISITA:\nApresente SOMENTE estes três layouts ao cliente:\n1. Premium Dark — fundo escuro, elegante, detalhes dourados, visual sofisticado\n2. Premium Light — fundo claro, limpo, moderno e corporativo\n3. Impacto — visual forte, moderno, tipografia marcante e alto destaque\n\nREGRAS OBRIGATÓRIAS:\n- NUNCA citar Tecnológico, Tecnológico Z, Elegante, Saúde ou Premium genérico como opção de cartão.\n- Se o cliente não tiver logo: continuar normalmente. Será gerado monograma com a inicial da empresa. NUNCA bloquear a criação.\n- No JSON da ARTE_PRONTA usar: "layout_id": "cartao_premium_dark" OU "cartao_premium_light" OU "cartao_impacto"'
WHERE instancia = 'teffe-press'
  AND system_prompt NOT LIKE '%LAYOUTS OFICIAIS DO CARTÃO DE VISITA%';

-- ─── VERIFICAÇÃO: exibe o trecho final salvo ────────────────────────────────
SELECT RIGHT(system_prompt, 3000) AS system_prompt_final
FROM mia_instancias
WHERE instancia = 'teffe-press';
