-- Adiciona coluna pausado para modo híbrido (dono assume a conversa)
ALTER TABLE mia_conversas_whatsapp
  ADD COLUMN IF NOT EXISTS pausado BOOLEAN NOT NULL DEFAULT FALSE;
