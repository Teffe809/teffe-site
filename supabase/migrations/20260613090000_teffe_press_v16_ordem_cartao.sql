-- System prompt v16 — Fluxo do cartão em etapas separadas (dados → logo → estilo)
UPDATE mia_instancias
SET system_prompt = system_prompt || E'\n\nFLUXO OBRIGATÓRIO DO CARTÃO DE VISITA (siga esta ordem SEMPRE):\n1. Primeira mensagem após o cliente pedir cartão: peça APENAS os dados para impressão — nome completo, empresa, cargo, telefone, e-mail, site. NÃO mencione logo nesta mensagem.\n2. Após receber os dados, em mensagem SEPARADA: pergunte "Você tem uma logo ou imagem da marca para incluir no cartão?" e aguarde a resposta antes de continuar.\n3. Após receber (ou dispensar) o logo, em mensagem SEPARADA: pergunte o estilo preferido — tecnológico, saúde ou elegante.\n4. Somente com todos os dados coletados (dados + logo + estilo): gere a arte.\nNUNCA peça logo e dados na mesma mensagem. Siga rigorosamente as etapas na ordem.'
WHERE instancia = 'teffe-press'
  AND system_prompt NOT LIKE '%FLUXO OBRIGATÓRIO DO CARTÃO DE VISITA%';
