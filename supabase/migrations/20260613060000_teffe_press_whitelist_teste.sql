INSERT INTO mia_whitelist (instancia, telefone, nome, ativo)
VALUES ('teffe-press', '5511932683441', 'Teste Externo', true)
ON CONFLICT (instancia, telefone) DO NOTHING;
