-- Adiciona campo para PDF do extrato separado do boleto bancário
ALTER TABLE boletos ADD COLUMN IF NOT EXISTS arquivo_extrato_url text;
