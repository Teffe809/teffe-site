-- System prompt v14 — Maya pergunta estilo do cartão e repassa campo estilo no JSON
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '- Cartão de visita: "Me passa os dados que você gostaria de colocar no cartão! Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan... Se tiver logo pode mandar junto também! 😊"',
  '- Cartão de visita: "Me passa os dados que você gostaria de colocar no cartão! Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan... Se tiver logo pode mandar junto também! 😊 E me diz: prefere um estilo **tecnológico** (visual moderno, linhas de circuito, tons escuros e laranja), **saúde** (clean, verde esmeralda ou teal, toque dourado, com linha de batimento cardíaco) ou **elegante** (qualquer estilo à vontade)?"'
)
WHERE instancia = 'teffe-press';

-- Garante que o campo estilo seja incluído no JSON da ARTE_PRONTA
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '"tipo_produto": "cartao_visita"',
  '"tipo_produto": "cartao_visita", "estilo": "<tecnologico|saude|elegante conforme escolha do cliente>"'
)
WHERE instancia = 'teffe-press'
  AND system_prompt LIKE '%"tipo_produto": "cartao_visita"%'
  AND system_prompt NOT LIKE '%"estilo":%';
