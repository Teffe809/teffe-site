-- ── Tabela de custo por chamada Anthropic ──────────────────────────────────
CREATE TABLE IF NOT EXISTS mia_cost_log (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  instancia   TEXT         NOT NULL DEFAULT '',
  telefone    TEXT         NOT NULL DEFAULT '',
  modelo      TEXT         NOT NULL,
  tipo        TEXT         NOT NULL,
  input_tokens  INTEGER    NOT NULL DEFAULT 0,
  output_tokens INTEGER    NOT NULL DEFAULT 0,
  custo_usd   NUMERIC(12,8) NOT NULL DEFAULT 0,
  metadata    JSONB
);

CREATE INDEX IF NOT EXISTS idx_mia_cost_log_instancia ON mia_cost_log (instancia, telefone);
CREATE INDEX IF NOT EXISTS idx_mia_cost_log_created_at ON mia_cost_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mia_cost_log_tipo ON mia_cost_log (tipo);

-- ── Views de observabilidade ─────────────────────────────────────────────────

-- Custo agrupado por tipo de chamada
CREATE OR REPLACE VIEW v_custo_por_tipo AS
SELECT
  tipo,
  COUNT(*)                                    AS chamadas,
  SUM(input_tokens)                           AS total_input_tokens,
  SUM(output_tokens)                          AS total_output_tokens,
  ROUND(SUM(custo_usd)::NUMERIC,  6)          AS custo_total_usd,
  ROUND(AVG(custo_usd)::NUMERIC,  8)          AS custo_medio_usd
FROM mia_cost_log
GROUP BY tipo
ORDER BY custo_total_usd DESC;

-- Custo por conversa (instancia + telefone + dia, horário de Brasília)
CREATE OR REPLACE VIEW v_custo_por_conversa AS
SELECT
  instancia,
  telefone,
  DATE(created_at AT TIME ZONE 'America/Sao_Paulo')  AS data,
  COUNT(*)                                           AS chamadas,
  ROUND(SUM(custo_usd)::NUMERIC, 6)                  AS custo_total_usd,
  SUM(CASE WHEN tipo IN ('conversa_texto','conversa_logo') THEN 1 ELSE 0 END)     AS turnos_conversa,
  SUM(CASE WHEN (metadata->>'gerou_arte')::boolean THEN 1 ELSE 0 END)             AS artes_geradas
FROM mia_cost_log
GROUP BY instancia, telefone, DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY data DESC, custo_total_usd DESC;

-- Custo diário total com breakdown por categoria
CREATE OR REPLACE VIEW v_custo_diario AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Sao_Paulo')  AS data,
  COUNT(*)                                           AS chamadas,
  ROUND(SUM(custo_usd)::NUMERIC, 6)                  AS custo_total_usd,
  ROUND(SUM(CASE WHEN tipo IN ('conversa_texto','conversa_logo') THEN custo_usd ELSE 0 END)::NUMERIC, 6) AS custo_conversas,
  ROUND(SUM(CASE WHEN tipo = 'analise_logo'          THEN custo_usd ELSE 0 END)::NUMERIC, 6) AS custo_logos,
  ROUND(SUM(CASE WHEN tipo = 'extracao_dados'        THEN custo_usd ELSE 0 END)::NUMERIC, 6) AS custo_extracoes,
  ROUND(SUM(CASE WHEN tipo = 'enriquecimento_prompt' THEN custo_usd ELSE 0 END)::NUMERIC, 6) AS custo_enriquecimentos,
  SUM(CASE WHEN (metadata->>'gerou_arte')::boolean THEN 1 ELSE 0 END)             AS artes_geradas
FROM mia_cost_log
GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
ORDER BY data DESC;

-- Custo por geração de arte (resposta à pergunta "quanto custa um cartão?")
CREATE OR REPLACE VIEW v_custo_por_arte AS
SELECT
  instancia,
  telefone,
  created_at,
  tipo,
  modelo,
  input_tokens,
  output_tokens,
  custo_usd,
  metadata->>'tipo_produto'  AS produto,
  metadata->>'tipo_evento'   AS evento
FROM mia_cost_log
WHERE (metadata->>'gerou_arte')::boolean = true
ORDER BY created_at DESC;
