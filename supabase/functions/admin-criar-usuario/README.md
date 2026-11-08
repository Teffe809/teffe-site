# admin-criar-usuario

Preparado localmente; sem deploy e sem SQL aplicado. O frontend do ERP não foi alterado.

POST JSON, `Authorization: Bearer <JWT do funcionário>`, Origin permitido:
`https://erp.teffe.com.br`. Autentica no Auth com getUser e consulta
`public.sou_funcionario()` com esse mesmo JWT; nunca consulta o schema privado
com service_role. Revalida a aprovação antes de gravar e antes de responder sucesso.

Campos comuns: `tipo`, `email`, `nome`, `senha_inicial` (8–128 caracteres).
O papel não é aceito do cliente: funcionario → admin, tecnico → tecnico,
adicional_cliente → cliente. Somente nome vai em user_metadata.

- `funcionario`: `acesso_total` booleano, `permissoes` com os módulos do ERP
  (estoque, comercial, financeiro, operacional, crm, clientes, chamados,
  teffe_power, admin). Exige também acesso_total do operador, como recomendado
  pelo plano para reproduzir a restrição master da tela.
- `tecnico`: `tecnico_id` opcional para vincular cadastro existente sem user_id;
  sem ele, cria o registro com `telefone` e `matricula` opcionais. Vínculo existente
  nunca é substituído; a atualização exige user_id IS NULL.
- `adicional_cliente`: `cliente_id` existente, `acesso_total` e `permissoes`
  booleanas de chamados, financeiro e equipamentos. Cria vínculo novo, ativo,
  por UUID; nunca reaproveita conta Auth por coincidência de e-mail.

Exemplo:

```json
{"tipo":"adicional_cliente","email":"pessoa@example.com","nome":"Pessoa","senha_inicial":"Trocar123!","cliente_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","acesso_total":false,"permissoes":{"chamados":true}}
```

Sucesso: HTTP 201 com user_id e tipo. Erros em português. Não devolve senha ou
metadados Auth. A função não envia convite/e-mail nem força troca de senha.

## SQL e publicação futura

Revisar `signup-sql.sql` (cópia em tf-control/docs/signup-sql.sql) em homologação.
A definição integral de handle_new_user não consta dos fontes: o SQL obtém a
definição instalada e troca apenas raw_user_meta_data role por raw_app_meta_data
role, preservando o restante, inclusive o fallback cliente. Aborta se não reconhecer
o formato informado. Não faz UPDATE de contas/perfis existentes.

Aplicar o SQL revisado antes de usar o endpoint. As variáveis padrão das Edge
Functions são SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY;
nenhuma credencial deve ser incluída no navegador. Publicar com verify_jwt
habilitado (padrão, sem --no-verify-jwt), pois todos os chamadores precisam
de JWT de sessão. A checagem da plataforma não substitui getUser e a RPC.

```powershell
npx supabase login
npx supabase functions deploy admin-criar-usuario --project-ref hlfjcpgrxiktgctozilk --use-api
```

Homologar negações 401/403, os três cadastros e compensação antes de migrar as
três telas do ERP. Só fechar signup após essa migração; esta entrega não a faz.

## Falhas e limites

Os HTTPs de Auth e PostgREST não formam uma transação única. Em falha depois
de receber o ID da conta nova, a função desfaz vínculos/perfil e exclui somente
essa conta; restaura para NULL um vínculo de técnico existente, sem apagar seu
cadastro. A compensação usa filtros pelo UUID recém-criado e tenta excluir Auth
até três vezes. Se falhar, tenta bloquear a conta, retorna erro explícito com
user_id e registra só esse UUID para reconciliação (não senha/JWT).

Uma indisponibilidade pode impedir também a compensação/bloqueio ou perder a
resposta de criação Auth. Não há garantia de atomicidade, log durável nem chave
de idempotência nesta versão. Não repetir silenciosamente uma conta existente;
reconciliar manualmente falhas ambíguas antes de tentar novamente.

Teste sem rede: `node tests/admin-criar-usuario.mjs` (Node 24). Exercita o handler
real com SDK simulado; não substitui testes de Auth, triggers, RLS e SQL no Supabase.
