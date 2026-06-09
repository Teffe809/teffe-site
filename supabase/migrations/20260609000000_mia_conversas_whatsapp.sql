-- Histórico de conversas WhatsApp da Mia (uma linha por número de telefone)
CREATE TABLE IF NOT EXISTS mia_conversas_whatsapp (
  telefone   TEXT        PRIMARY KEY,
  historico  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas a service role acessa esta tabela (Edge Function usa service role key)
ALTER TABLE mia_conversas_whatsapp ENABLE ROW LEVEL SECURITY;
