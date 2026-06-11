-- ── Perfis de acesso ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_perfis (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT      NOT NULL,
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN     DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_per" ON teffe_power_perfis FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Permissões por perfil por impressora ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_permissoes (
  id                 UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id          UUID    REFERENCES teffe_power_perfis(id),
  impressora_id      UUID    REFERENCES teffe_power_impressoras(id),
  licenca_chave      TEXT    NOT NULL,
  pode_imprimir_pb   BOOLEAN DEFAULT true,
  pode_imprimir_color BOOLEAN DEFAULT false,
  pode_copiar        BOOLEAN DEFAULT false,
  pode_digitalizar   BOOLEAN DEFAULT false,
  pode_frente_verso  BOOLEAN DEFAULT true,
  limite_paginas_dia INTEGER DEFAULT 0,
  limite_paginas_mes INTEGER DEFAULT 0,
  ativo              BOOLEAN DEFAULT true,
  UNIQUE(perfil_id, impressora_id)
);
ALTER TABLE teffe_power_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_perm" ON teffe_power_permissoes FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Bloqueios de impressão ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teffe_power_bloqueios (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  licenca_chave TEXT        NOT NULL,
  usuario_id    UUID        REFERENCES teffe_power_usuarios(id),
  impressora_id UUID        REFERENCES teffe_power_impressoras(id),
  motivo        TEXT,
  tentado_em    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teffe_power_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tp_blq" ON teffe_power_bloqueios FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Adiciona colunas em usuarios ──────────────────────────────────────────────
ALTER TABLE teffe_power_usuarios
  ADD COLUMN IF NOT EXISTS perfil_id          UUID    REFERENCES teffe_power_perfis(id),
  ADD COLUMN IF NOT EXISTS pin                TEXT,
  ADD COLUMN IF NOT EXISTS cracha_id          TEXT,
  ADD COLUMN IF NOT EXISTS limite_paginas_dia INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_paginas_mes INTEGER DEFAULT 0;

-- ── Perfis de demo ────────────────────────────────────────────────────────────
INSERT INTO teffe_power_perfis (licenca_chave, nome, descricao) VALUES
('TEFFE-POWER-DEMO-2026', 'Administrador', 'Acesso total a todos os recursos'),
('TEFFE-POWER-DEMO-2026', 'Gerente',       'Impressão colorida liberada, sem limite'),
('TEFFE-POWER-DEMO-2026', 'Funcionário',   'Apenas P&B, limite 50 páginas/dia'),
('TEFFE-POWER-DEMO-2026', 'Visitante',     'Apenas cópia, limite 10 páginas')
ON CONFLICT DO NOTHING;

-- ── Vincula usuários demo aos perfis ─────────────────────────────────────────
UPDATE teffe_power_usuarios
SET perfil_id = (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Administrador' LIMIT 1)
WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Carla Mendes';

UPDATE teffe_power_usuarios
SET perfil_id = (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Gerente' LIMIT 1)
WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Ana Costa';

UPDATE teffe_power_usuarios
SET perfil_id = (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Funcionário' LIMIT 1),
    pin='1234', limite_paginas_dia=50
WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome IN ('Bruno Lima','Diego Souza');

UPDATE teffe_power_usuarios
SET perfil_id = (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Visitante' LIMIT 1),
    pin='0000', limite_paginas_dia=10
WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Elisa Ferreira';

-- ── Permissões demo (Funcionário x todas as impressoras) ─────────────────────
INSERT INTO teffe_power_permissoes
  (perfil_id, impressora_id, licenca_chave, pode_imprimir_pb, pode_imprimir_color, pode_copiar, pode_digitalizar, pode_frente_verso, limite_paginas_dia, limite_paginas_mes)
SELECT
  (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Funcionário'),
  i.id,
  'TEFFE-POWER-DEMO-2026',
  true, false, true, false, true, 50, 500
FROM teffe_power_impressoras i WHERE i.licenca_chave='TEFFE-POWER-DEMO-2026'
ON CONFLICT (perfil_id, impressora_id) DO NOTHING;

-- Visitante: só cópia, 10 págs
INSERT INTO teffe_power_permissoes
  (perfil_id, impressora_id, licenca_chave, pode_imprimir_pb, pode_imprimir_color, pode_copiar, pode_digitalizar, pode_frente_verso, limite_paginas_dia, limite_paginas_mes)
SELECT
  (SELECT id FROM teffe_power_perfis WHERE licenca_chave='TEFFE-POWER-DEMO-2026' AND nome='Visitante'),
  i.id,
  'TEFFE-POWER-DEMO-2026',
  false, false, true, false, false, 10, 50
FROM teffe_power_impressoras i WHERE i.licenca_chave='TEFFE-POWER-DEMO-2026'
ON CONFLICT (perfil_id, impressora_id) DO NOTHING;

-- ── Bloqueios demo ────────────────────────────────────────────────────────────
INSERT INTO teffe_power_bloqueios (licenca_chave, impressora_id, motivo, tentado_em)
SELECT 'TEFFE-POWER-DEMO-2026', id, 'sem_permissao_color',   NOW() - interval '2 hours'
FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' ORDER BY nome LIMIT 1;

INSERT INTO teffe_power_bloqueios (licenca_chave, impressora_id, motivo, tentado_em)
SELECT 'TEFFE-POWER-DEMO-2026', id, 'limite_dia_excedido',   NOW() - interval '1 hour'
FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' ORDER BY nome LIMIT 1;

INSERT INTO teffe_power_bloqueios (licenca_chave, impressora_id, motivo, tentado_em)
SELECT 'TEFFE-POWER-DEMO-2026', id, 'sem_permissao_color',   NOW() - interval '30 minutes'
FROM teffe_power_impressoras WHERE licenca_chave='TEFFE-POWER-DEMO-2026' ORDER BY nome DESC LIMIT 1;
