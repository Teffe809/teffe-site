-- Preparado para revisão. NÃO aplicado. Executar futuramente como postgres.
BEGIN;

CREATE OR REPLACE FUNCTION public.sou_funcionario()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT tf_rls_final_v1.eh_funcionario(); $$;
ALTER FUNCTION public.sou_funcionario() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sou_funcionario() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sou_funcionario() TO authenticated;

-- A definição integral do trigger de produção não está nos repositórios.
-- Usar a definição instalada preserva assinatura, corpo, fallback 'cliente',
-- nome, e-mail, atributos e configurações; altera SOMENTE a origem da role.
-- Se o formato não corresponder ao esperado, abortar, sem inventar o corpo.
DO $migration$
DECLARE
  original text;
  updated text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.handle_new_user()'::regprocedure)
    INTO original;
  IF original !~ 'SECURITY DEFINER' OR original !~ '''cliente''' THEN
    RAISE EXCEPTION 'Revisar handle_new_user: SECURITY DEFINER ou padrão cliente não encontrado';
  END IF;
  updated := pg_catalog.regexp_replace(
    original,
    $pattern$raw_user_meta_data\s*->>\s*'role'$pattern$,
    $replacement$raw_app_meta_data->>'role'$replacement$,
    'g'
  );
  IF updated = original THEN
    RAISE EXCEPTION 'Revisar handle_new_user: leitura esperada de raw_user_meta_data role não encontrada';
  END IF;
  EXECUTE updated;
END;
$migration$;

COMMIT;
-- Depois da aplicação: revisar pg_get_functiondef e testar os três tipos em homologação.
