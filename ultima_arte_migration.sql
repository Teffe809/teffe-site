-- Adiciona coluna de memória da última arte por conversa
ALTER TABLE mia_conversas_whatsapp
ADD COLUMN IF NOT EXISTS ultima_arte JSONB;

-- Índice para buscas por instancia+telefone (já deve existir pela PK/unique constraint)
-- Não precisa de novo índice — o existente em (instancia, telefone) cobre a busca
