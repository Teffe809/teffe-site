-- Licenças das gráficas
CREATE TABLE IF NOT EXISTS teffe_press_licencas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chave       TEXT        UNIQUE NOT NULL,
  instancia   TEXT        NOT NULL,
  nome_grafica TEXT       NOT NULL,
  plano       TEXT        NOT NULL,
  ativo       BOOLEAN     DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  expira_em   TIMESTAMPTZ
);

ALTER TABLE teffe_press_licencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_licencas" ON teffe_press_licencas FOR SELECT TO anon USING (true);

-- Pedidos recebidos pela Mia
CREATE TABLE IF NOT EXISTS teffe_press_pedidos (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia        TEXT        NOT NULL,
  numero_pedido    INTEGER     GENERATED ALWAYS AS IDENTITY,
  cliente_nome     TEXT,
  cliente_telefone TEXT,
  produto          TEXT        NOT NULL,
  especificacoes   JSONB,
  valor            DECIMAL(10,2),
  status           TEXT        DEFAULT 'aguardando_pagamento',
  prazo_entrega    DATE,
  arte_pronta      BOOLEAN     DEFAULT false,
  observacoes      TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teffe_press_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_pedidos" ON teffe_press_pedidos FOR ALL TO anon USING (true) WITH CHECK (true);

-- Clientes da gráfica
CREATE TABLE IF NOT EXISTS teffe_press_clientes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia     TEXT        NOT NULL,
  nome          TEXT        NOT NULL,
  telefone      TEXT        NOT NULL,
  empresa       TEXT,
  total_pedidos INTEGER     DEFAULT 0,
  valor_total   DECIMAL(10,2) DEFAULT 0,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instancia, telefone)
);

ALTER TABLE teffe_press_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_clientes" ON teffe_press_clientes FOR ALL TO anon USING (true) WITH CHECK (true);

-- Licença de teste
INSERT INTO teffe_press_licencas (chave, instancia, nome_grafica, plano)
VALUES ('TEFFE-PRESS-DEMO-2026', 'teffe-press', 'Gráfica Damasceno', 'Pro')
ON CONFLICT (chave) DO NOTHING;

-- Dados de exemplo para dashboard
INSERT INTO teffe_press_pedidos (instancia, cliente_nome, cliente_telefone, produto, especificacoes, valor, status, prazo_entrega, arte_pronta) VALUES
('teffe-press', 'João Silva', '5514981433274', 'Cartão de Visita', '{"tamanho":"9x5cm","quantidade":1000,"papel":"Couchê 300g","acabamento":"Verniz brilho","frente_verso":true}', 120.00, 'em_producao', CURRENT_DATE + 2, true),
('teffe-press', 'Maria Santos', '5515991117872', 'Panfleto A5', '{"tamanho":"A5","quantidade":500,"papel":"Couchê 115g","acabamento":"sem","frente_verso":false}', 85.00, 'pago', CURRENT_DATE + 1, false),
('teffe-press', 'Padaria Bom Dia', '5511995868955', 'Banner 2x1m', '{"tamanho":"200x100cm","quantidade":2,"material":"Lona 440g","acabamento":"Ilhós + Bastão"}', 180.00, 'pronto', CURRENT_DATE, true),
('teffe-press', 'João Silva', '5514981433274', 'Folder A4', '{"tamanho":"A4 dobrado","quantidade":200,"papel":"Couchê 150g fosco","dobras":2}', 210.00, 'aguardando_pagamento', CURRENT_DATE + 5, false),
('teffe-press', 'Auto Peças Rápida', '5514999887766', 'Adesivo Vinil', '{"tamanho":"10x10cm","quantidade":500,"material":"Vinil adesivo","uso":"externo"}', 340.00, 'entregue', CURRENT_DATE - 3, true)
ON CONFLICT DO NOTHING;

INSERT INTO teffe_press_clientes (instancia, nome, telefone, empresa, total_pedidos, valor_total) VALUES
('teffe-press', 'João Silva', '5514981433274', NULL, 2, 330.00),
('teffe-press', 'Maria Santos', '5515991117872', NULL, 1, 85.00),
('teffe-press', 'Padaria Bom Dia', '5511995868955', 'Padaria Bom Dia LTDA', 1, 180.00),
('teffe-press', 'Auto Peças Rápida', '5514999887766', 'Auto Peças Rápida ME', 1, 340.00)
ON CONFLICT (instancia, telefone) DO NOTHING;
