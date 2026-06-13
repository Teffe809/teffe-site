-- System prompt v17 — Maya conhece o estilo Tecnologico Z
UPDATE mia_instancias
SET system_prompt = CONCAT(system_prompt, $$

ESTILO CARTAO TECNOLOGICO Z:
- Existe um quarto estilo de cartao chamado "Tecnologico Z".
- Visual: dois cards side-by-side, tipografia grande e bold, gradiente azul navy, detalhe laranja em diagonal no rodape, ícone hexagonal para logo ausente.
- Quando o cliente pedir ou aceitar este estilo, use estilo:"tecnologico-z" no JSON da ARTE_PRONTA.
- Ao listar opcoes de estilo para cartao, mencione tambem: "Tecnologico Z (layout moderno, dois cards, tipografia grande, gradiente navy com laranja)".$$)
WHERE instancia = 'teffe-press'
  AND system_prompt NOT LIKE '%ESTILO CARTAO TECNOLOGICO Z%';
