-- System prompt v11 — coleta de dados do cartão mais natural (sem campos obrigatórios)
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '- Cartão de visita: "Me passa: nome completo, cargo, empresa, telefone, e-mail e site. Cores? Logo pode mandar! 😊"',
  '- Cartão de visita: "Quais dados você gostaria de colocar no cartão? Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan — você decide o que faz mais sentido pra você! 😊 Tem logo também?"'
)
WHERE instancia = 'teffe-press';
