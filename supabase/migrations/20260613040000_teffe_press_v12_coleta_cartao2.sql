-- System prompt v12 — nova frase de coleta do cartão de visita
-- Dois REPLACEs para cobrir DB na v10 (antes de v11) ou na v11 (depois de v11)

-- Caso o banco ainda esteja na v10
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '- Cartão de visita: "Me passa: nome completo, cargo, empresa, telefone, e-mail e site. Cores? Logo pode mandar! 😊"',
  '- Cartão de visita: "Me passa os dados que você gostaria de colocar no cartão! Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan... Se tiver logo pode mandar junto também! 😊"'
)
WHERE instancia = 'teffe-press';

-- Caso o banco já esteja na v11
UPDATE mia_instancias
SET system_prompt = REPLACE(
  system_prompt,
  '- Cartão de visita: "Quais dados você gostaria de colocar no cartão? Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan — você decide o que faz mais sentido pra você! 😊 Tem logo também?"',
  '- Cartão de visita: "Me passa os dados que você gostaria de colocar no cartão! Pode ser nome, empresa, cargo, telefone, e-mail, site, redes sociais, slogan... Se tiver logo pode mandar junto também! 😊"'
)
WHERE instancia = 'teffe-press';
