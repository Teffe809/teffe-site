-- Insumos (toners, cartuchos, etc vinculados ao modelo do equipamento)
CREATE TABLE IF NOT EXISTS insumos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  nome text NOT NULL,
  codigo text,
  modelo_equipamento text,
  marca_equipamento text,
  tipo text DEFAULT 'toner' CHECK (tipo IN ('toner','cartucho','cilindro','fita','outro')),
  quantidade_estoque integer DEFAULT 0,
  quantidade_minima integer DEFAULT 1,
  fornecedor_id uuid REFERENCES fornecedores(id),
  observacoes text
);

-- Insumos vinculados ao equipamento (modelo específico)
CREATE TABLE IF NOT EXISTS equipamento_insumos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid REFERENCES equipamentos(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES insumos(id),
  cor text,
  UNIQUE(equipamento_id, insumo_id)
);

ALTER TABLE insumos DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipamento_insumos DISABLE ROW LEVEL SECURITY;
ALTER TABLE pecas DISABLE ROW LEVEL SECURITY;
