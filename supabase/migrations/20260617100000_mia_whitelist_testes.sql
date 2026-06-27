INSERT INTO mia_whitelist (instancia, telefone, nome, ativo) VALUES
  ('teffe-press', '5514991468124', 'Teste',                    true),
  ('teffe-press', '5514981433274', 'Grafica Damasceno',         true),
  ('teffe-press', '5514988055116', 'Teste Novo',               true),
  ('teffe-press', '5511932683441', 'Teste Externo',            true)
ON CONFLICT (instancia, telefone) DO NOTHING;
