INSERT INTO mia_whitelist (instancia, telefone, nome) VALUES
  ('teffe-press', '5511995868955', 'Teste Jefferson')
ON CONFLICT (instancia, telefone) DO NOTHING;
