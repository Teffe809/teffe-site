CREATE TABLE IF NOT EXISTS mia_whitelist (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia  TEXT        NOT NULL,
  telefone   TEXT        NOT NULL,
  nome       TEXT,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instancia, telefone)
);

ALTER TABLE mia_whitelist ENABLE ROW LEVEL SECURITY;

INSERT INTO mia_whitelist (instancia, telefone, nome) VALUES
  ('teffe-press', '5514981433274', 'Grafica Damasceno'),
  ('teffe-press', '5515991117872', 'Grafica Do Beto')
ON CONFLICT (instancia, telefone) DO NOTHING;
