-- ── Licenças ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_licencas (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chave           TEXT        UNIQUE NOT NULL,
  empresa         TEXT        NOT NULL,
  plano           TEXT        NOT NULL,
  max_impressoras INTEGER     DEFAULT 10,
  ativo           BOOLEAN     DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  expira_em       TIMESTAMPTZ
);
ALTER TABLE teffe_power_licencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_tp_lic" ON teffe_power_licencas FOR SELECT TO anon USING (true);

-- ── Impressoras ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_impressoras (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT        NOT NULL,
  nome          TEXT        NOT NULL,
  modelo        TEXT,
  fabricante    TEXT,
  ip            TEXT        NOT NULL,
  localizacao   TEXT,
  custo_pb      DECIMAL(10,4) DEFAULT 0.05,
  custo_color   DECIMAL(10,4) DEFAULT 0.15,
  ativo         BOOLEAN     DEFAULT true,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_impressoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_imp" ON teffe_power_impressoras FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Leituras SNMP ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_leituras (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  impressora_id  UUID        REFERENCES teffe_power_impressoras(id),
  licenca_chave  TEXT        NOT NULL,
  status         TEXT        DEFAULT 'online',
  toner_preto    INTEGER,
  toner_ciano    INTEGER,
  toner_magenta  INTEGER,
  toner_amarelo  INTEGER,
  nivel_papel    INTEGER,
  paginas_total  INTEGER     DEFAULT 0,
  paginas_hoje   INTEGER     DEFAULT 0,
  paginas_pb     INTEGER     DEFAULT 0,
  paginas_color  INTEGER     DEFAULT 0,
  ultimo_erro    TEXT,
  coletado_em    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_lei" ON teffe_power_leituras FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Usuários ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_usuarios (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT        NOT NULL,
  nome          TEXT        NOT NULL,
  email         TEXT,
  departamento  TEXT,
  ativo         BOOLEAN     DEFAULT true,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_usr" ON teffe_power_usuarios FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Impressões por usuário ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_impressoes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT        NOT NULL,
  usuario_id    UUID        REFERENCES teffe_power_usuarios(id),
  impressora_id UUID        REFERENCES teffe_power_impressoras(id),
  paginas       INTEGER     DEFAULT 1,
  colorido      BOOLEAN     DEFAULT false,
  custo         DECIMAL(10,4),
  impresso_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_impressoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_imp2" ON teffe_power_impressoes FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Alertas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_alertas (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT        NOT NULL,
  impressora_id UUID        REFERENCES teffe_power_impressoras(id),
  tipo          TEXT        NOT NULL,
  mensagem      TEXT        NOT NULL,
  resolvido     BOOLEAN     DEFAULT false,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_ale" ON teffe_power_alertas FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Licença demo ──────────────────────────────────────────────────────────────
INSERT INTO teffe_power_licencas (chave, empresa, plano, max_impressoras)
VALUES ('TEFFE-POWER-DEMO-2026', 'Cliente Teste', 'Pro', 50)
ON CONFLICT (chave) DO NOTHING;

-- ── Impressoras demo ──────────────────────────────────────────────────────────
INSERT INTO teffe_power_impressoras (licenca_chave, nome, modelo, fabricante, ip, localizacao, custo_pb, custo_color) VALUES
('TEFFE-POWER-DEMO-2026', 'Brother DCP-L5652DN', 'DCP-L5652DN', 'Brother', '192.168.1.100', 'Escritório', 0.04, 0.00),
('TEFFE-POWER-DEMO-2026', 'Canon iR1643',        'iR1643',      'Canon',   '192.168.1.101', 'Recepção',  0.05, 0.00),
('TEFFE-POWER-DEMO-2026', 'HP LaserJet Pro M404','M404dn',      'HP',      '192.168.1.102', 'RH',        0.05, 0.00),
('TEFFE-POWER-DEMO-2026', 'Kyocera ECOSYS M3145','M3145dn',     'Kyocera', '192.168.1.103', 'Financeiro',0.04, 0.13),
('TEFFE-POWER-DEMO-2026', 'Ricoh IM 2702',       'IM 2702',     'Ricoh',   '192.168.1.104', 'Diretoria', 0.06, 0.18)
ON CONFLICT DO NOTHING;

-- ── Leituras demo (estado atual) ─────────────────────────────────────────────
INSERT INTO teffe_power_leituras
  (impressora_id, licenca_chave, status, toner_preto, toner_ciano, toner_magenta, toner_amarelo, nivel_papel, paginas_total, paginas_hoje, paginas_pb, paginas_color)
SELECT
  id, 'TEFFE-POWER-DEMO-2026',
  CASE row_number() OVER() WHEN 2 THEN 'offline' WHEN 4 THEN 'alerta' ELSE 'online' END,
  CASE row_number() OVER() WHEN 3 THEN 15 WHEN 4 THEN 8 ELSE (40 + (random()*55)::int) END,
  (random()*100)::int,
  (random()*100)::int,
  (random()*100)::int,
  (50 + (random()*50)::int),
  (5000 + (random()*20000)::int),
  (random()*350)::int,
  (random()*280)::int,
  (random()*70)::int
FROM teffe_power_impressoras WHERE licenca_chave = 'TEFFE-POWER-DEMO-2026';

-- ── Usuários demo ────────────────────────────────────────────────────────────
INSERT INTO teffe_power_usuarios (licenca_chave, nome, email, departamento) VALUES
('TEFFE-POWER-DEMO-2026', 'Ana Costa',      'ana.costa@empresa.com',      'Financeiro'),
('TEFFE-POWER-DEMO-2026', 'Bruno Lima',     'bruno.lima@empresa.com',     'RH'),
('TEFFE-POWER-DEMO-2026', 'Carla Mendes',   'carla.mendes@empresa.com',   'Diretoria'),
('TEFFE-POWER-DEMO-2026', 'Diego Souza',    'diego.souza@empresa.com',    'Escritório'),
('TEFFE-POWER-DEMO-2026', 'Elisa Ferreira', 'elisa.ferreira@empresa.com', 'Recepção')
ON CONFLICT DO NOTHING;

-- ── Impressões demo (últimos 30 dias) ────────────────────────────────────────
INSERT INTO teffe_power_impressoes (licenca_chave, usuario_id, impressora_id, paginas, colorido, custo, impresso_em)
SELECT
  'TEFFE-POWER-DEMO-2026',
  u.id,
  p.id,
  (1 + (random()*19)::int),
  (random() < 0.2),
  CASE WHEN (random() < 0.2) THEN p.custo_color * (1+(random()*19)::int)
                              ELSE p.custo_pb    * (1+(random()*19)::int) END,
  NOW() - ((random()*30)::int || ' days')::interval - ((random()*24)::int || ' hours')::interval
FROM
  generate_series(1,200) AS s,
  (SELECT id, custo_pb, custo_color FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' ORDER BY random() LIMIT 1) p,
  (SELECT id FROM teffe_power_usuarios WHERE licenca_chave='TEFFE-POWER-DEMO-2026' ORDER BY random() LIMIT 1) u;

-- ── Alertas demo ─────────────────────────────────────────────────────────────
INSERT INTO teffe_power_alertas (licenca_chave, impressora_id, tipo, mensagem, resolvido, criado_em)
SELECT
  'TEFFE-POWER-DEMO-2026',
  (SELECT id FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='M404dn'),
  'toner_baixo',
  'HP LaserJet Pro M404 — Toner preto em 15%. Reposição necessária.',
  false,
  NOW() - interval '2 hours'
WHERE EXISTS (SELECT 1 FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='M404dn');

INSERT INTO teffe_power_alertas (licenca_chave, impressora_id, tipo, mensagem, resolvido, criado_em)
SELECT
  'TEFFE-POWER-DEMO-2026',
  (SELECT id FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='iR1643'),
  'offline',
  'Canon iR1643 — Impressora offline. Verificar conexão de rede.',
  false,
  NOW() - interval '45 minutes'
WHERE EXISTS (SELECT 1 FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='iR1643');

INSERT INTO teffe_power_alertas (licenca_chave, impressora_id, tipo, mensagem, resolvido, criado_em)
SELECT
  'TEFFE-POWER-DEMO-2026',
  (SELECT id FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='M3145dn'),
  'toner_baixo',
  'Kyocera ECOSYS M3145 — Toner preto em 8%. Substituição urgente.',
  false,
  NOW() - interval '1 hour'
WHERE EXISTS (SELECT 1 FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='M3145dn');

INSERT INTO teffe_power_alertas (licenca_chave, impressora_id, tipo, mensagem, resolvido, criado_em)
SELECT
  'TEFFE-POWER-DEMO-2026',
  (SELECT id FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='DCP-L5652DN'),
  'papel_baixo',
  'Brother DCP-L5652DN — Papel abaixo de 20%. Reabastecer bandeja.',
  true,
  NOW() - interval '3 hours'
WHERE EXISTS (SELECT 1 FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND modelo='DCP-L5652DN');
