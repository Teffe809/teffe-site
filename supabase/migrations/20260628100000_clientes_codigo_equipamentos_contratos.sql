-- Código sequencial para clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo text UNIQUE;

CREATE SEQUENCE IF NOT EXISTS clientes_codigo_seq START 1;

UPDATE clientes SET codigo = LPAD(nextval('clientes_codigo_seq')::text, 4, '0') WHERE codigo IS NULL;

CREATE OR REPLACE FUNCTION gerar_codigo_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL THEN
    NEW.codigo := LPAD(nextval('clientes_codigo_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_codigo_cliente ON clientes;
CREATE TRIGGER trigger_codigo_cliente
  BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION gerar_codigo_cliente();

-- Tabela equipamentos completa
DROP TABLE IF EXISTS equipamentos CASCADE;
CREATE TABLE equipamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  codigo_teffe text UNIQUE,
  marca text NOT NULL,
  modelo text NOT NULL,
  serial text UNIQUE,
  fornecedor_id uuid REFERENCES fornecedores(id),
  data_compra date,
  garantia_dias integer,
  data_vencimento_garantia date GENERATED ALWAYS AS (data_compra + garantia_dias) STORED,
  tipo_impressao text DEFAULT 'monocromatico' CHECK (tipo_impressao IN ('monocromatico', 'colorido')),
  status text DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'instalado', 'manutencao')),
  localizacao text,
  observacoes text,
  ultimo_contador integer DEFAULT 0
);

CREATE OR REPLACE FUNCTION gerar_codigo_teffe()
RETURNS TRIGGER AS $$
DECLARE
  novo_codigo text;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i integer;
BEGIN
  IF NEW.codigo_teffe IS NULL THEN
    LOOP
      novo_codigo := '';
      FOR i IN 1..4 LOOP
        novo_codigo := novo_codigo || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM equipamentos WHERE codigo_teffe = novo_codigo);
    END LOOP;
    NEW.codigo_teffe := novo_codigo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_codigo_teffe ON equipamentos;
CREATE TRIGGER trigger_codigo_teffe
  BEFORE INSERT ON equipamentos
  FOR EACH ROW EXECUTE FUNCTION gerar_codigo_teffe();

-- Tabela de vínculo contrato-equipamento
CREATE TABLE IF NOT EXISTS contrato_equipamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  contrato_id uuid REFERENCES contratos(id) ON DELETE CASCADE,
  equipamento_id uuid REFERENCES equipamentos(id),
  adicionado_por text,
  UNIQUE(contrato_id, equipamento_id)
);

ALTER TABLE equipamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_equipamentos DISABLE ROW LEVEL SECURITY;
