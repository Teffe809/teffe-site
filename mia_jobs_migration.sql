-- Tabela de jobs/trabalhos por cliente (memória separada da conversa)
CREATE TABLE IF NOT EXISTS mia_jobs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia   TEXT        NOT NULL,
  telefone    TEXT        NOT NULL,
  produto     TEXT,
  status      TEXT        NOT NULL DEFAULT 'em_andamento',  -- em_andamento | em_revisao_manual | aprovado
  dados_arte  JSONB,
  ultima_arte JSONB,
  ajustes     INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mia_jobs_conv   ON mia_jobs (instancia, telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mia_jobs_status ON mia_jobs (instancia, telefone, status);

-- Coluna que aponta para o job ativo da conversa
ALTER TABLE mia_conversas_whatsapp
ADD COLUMN IF NOT EXISTS job_id_atual TEXT;
