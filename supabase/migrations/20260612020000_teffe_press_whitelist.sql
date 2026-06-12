INSERT INTO mia_whitelist (instancia, telefone, nome, ativo)
VALUES ('teffe-press', '5514991468124', 'Autorizado', true)
ON CONFLICT (instancia, telefone) DO NOTHING;
