import { createClient } from 'npm:@supabase/supabase-js@2.80.0';

const origin = 'https://erp.teffe.com.br';
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
class Falha extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = { funcionario: 'admin', tecnico: 'tecnico', adicional_cliente: 'cliente' } as const;
const modules: Record<keyof typeof roles, string[]> = {
  funcionario: ['estoque', 'comercial', 'financeiro', 'operacional', 'crm', 'clientes', 'chamados', 'teffe_power', 'admin'],
  tecnico: [],
  adicional_cliente: ['chamados', 'financeiro', 'equipamentos'],
};
function texto(value: unknown, field: string, max: number, required = true): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new Falha(400, `Campo ${field} inválido.`);
  }
  return value.trim();
}

Deno.serve(async (req: Request) => {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  if (req.headers.has('Origin') && req.headers.get('Origin') !== origin) return reply(403, { error: 'Origem não permitida.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Método não permitido. Use POST.' });
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.get('Authorization') || '');
  if (!bearer || bearer[1].split('.').length !== 3) return reply(401, { error: 'JWT de usuário ausente ou inválido.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply(500, { error: 'Credenciais Supabase não configuradas.' });
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const caller = createClient(url, anon, { ...options, global: { headers: { Authorization: `Bearer ${bearer[1]}` } } });
  const admin = createClient(url, service, options);
  let userId: string | undefined;
  let tecnicoId: string | undefined;
  let existingTecnico = false;
  // Somente IDs criados nesta requisição podem ser removidos na compensação.
  async function autorizado() {
    const { data, error } = await caller.rpc('sou_funcionario');
    if (error) throw new Falha(503, 'Não foi possível verificar o funcionário. Confira a RPC sou_funcionario.');
    if (data !== true) throw new Falha(403, 'Acesso permitido somente a funcionário aprovado.');
  }
  try {
    const { data: identity, error: authError } = await caller.auth.getUser(bearer[1]);
    if (authError || !identity.user) throw new Falha(401, 'JWT de usuário inválido ou expirado.');
    await autorizado();
    let body;
    try { body = await req.json(); } catch { throw new Falha(400, 'Corpo JSON inválido.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Falha(400, 'Corpo JSON inválido.');
    const tipo = body.tipo as keyof typeof roles;
    if (!Object.hasOwn(roles, tipo)) throw new Falha(400, 'Tipo permitido: funcionario, tecnico ou adicional_cliente.');
    const email = texto(body.email, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Falha(400, 'E-mail inválido.');
    const nome = texto(body.nome, 'nome', 200);
    const senha = body.senha_inicial;
    if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128 || !senha.trim()) throw new Falha(400, 'Senha inicial deve ter entre 8 e 128 caracteres.');
    if (body.acesso_total !== undefined && typeof body.acesso_total !== 'boolean') throw new Falha(400, 'acesso_total deve ser booleano.');
    const acessoTotal = body.acesso_total === true;
    const permissoes = body.permissoes ?? {};
    if (!permissoes || typeof permissoes !== 'object' || Array.isArray(permissoes)
      || Object.entries(permissoes).some(([key, value]) => !modules[tipo].includes(key) || typeof value !== 'boolean')) {
      throw new Falha(400, 'Permissões inválidas para o tipo de usuário.');
    }
    // A tela de funcionários é master no ERP; aplicar a restrição também no servidor.
    if (tipo === 'funcionario') {
      const { data, error } = await admin.from('profiles').select('acesso_total').eq('id', identity.user.id).single();
      if (error) throw new Falha(500, 'Não foi possível consultar as permissões do funcionário.');
      if (data.acesso_total !== true) throw new Falha(403, 'Somente funcionário com acesso total pode criar funcionário.');
    }
    let clienteId: string | undefined;
    const telefone = texto(body.telefone, 'telefone', 40, false);
    const matricula = texto(body.matricula, 'matricula', 80, false);
    if (tipo === 'adicional_cliente') {
      clienteId = texto(body.cliente_id, 'cliente_id', 36);
      if (!uuid.test(clienteId)) throw new Falha(400, 'cliente_id inválido.');
      const { data, error } = await admin.from('clientes').select('id').eq('id', clienteId).maybeSingle();
      if (error) throw new Falha(500, 'Não foi possível consultar o cliente.');
      if (!data) throw new Falha(400, 'Cliente não encontrado.');
    }
    if (tipo === 'tecnico' && body.tecnico_id !== undefined) {
      existingTecnico = true;
      tecnicoId = texto(body.tecnico_id, 'tecnico_id', 36);
      if (!uuid.test(tecnicoId)) throw new Falha(400, 'tecnico_id inválido.');
      const { data, error } = await admin.from('tecnicos').select('id,user_id').eq('id', tecnicoId).maybeSingle();
      if (error) throw new Falha(500, 'Não foi possível consultar o técnico.');
      if (!data || data.user_id) throw new Falha(409, 'Técnico inexistente ou já vinculado a uma conta.');
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      app_metadata: { role: roles[tipo] }, user_metadata: { nome },
    });
    if (createError) throw new Falha(createError.code === 'email_exists' ? 409 : 400, 'Não foi possível criar a conta. Verifique se o e-mail já está cadastrado e se a senha atende às regras do Auth.');
    if (!created.user) throw new Falha(500, 'O Auth não retornou a conta criada.');
    userId = created.user.id;
    await autorizado();
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId, nome: tipo === 'funcionario' ? nome.toUpperCase() : nome, email, role: roles[tipo],
      ...(tipo === 'funcionario' ? { acesso_total: acessoTotal, permissoes: acessoTotal ? {} : permissoes } : {}),
    }, { onConflict: 'id' });
    if (profileError) throw new Falha(500, 'Não foi possível gravar o perfil.');
    if (tipo === 'tecnico') {
      if (tecnicoId) {
        // Compare-and-set impede substituir o vínculo de uma requisição concorrente.
        const { data, error } = await admin.from('tecnicos').update({ user_id: userId }).eq('id', tecnicoId).is('user_id', null).select('id');
        if (error || data?.length !== 1) throw new Falha(409, 'Não foi possível vincular o técnico; o cadastro pode ter sido vinculado por outra operação.');
      } else {
        const { data, error } = await admin.from('tecnicos').insert({ user_id: userId, nome: nome.toUpperCase(), email, telefone: telefone || null, matricula: matricula.toUpperCase() || null }).select('id').single();
        if (error) throw new Falha(500, 'Não foi possível cadastrar o técnico.');
        tecnicoId = data.id;
      }
    } else if (tipo === 'adicional_cliente') {
      const { error } = await admin.from('cliente_usuarios').insert({ user_id: userId, cliente_id: clienteId, nome, email, ativo: true, acesso_total: acessoTotal, permissoes: acessoTotal ? {} : permissoes });
      if (error) throw new Falha(500, 'Não foi possível cadastrar o usuário adicional do cliente.');
    }
    await autorizado();
    return reply(201, { user_id: userId, tipo });
  } catch (err) {
    if (userId) {
      // Compensação: limpar vínculos exclusivamente da conta nova, sem tocar contas existentes.
      let cleanupFailed = false;
      const attempt = async (operation: () => PromiseLike<{ error: unknown }>) => {
        try { const result = await operation(); if (result.error) cleanupFailed = true; } catch { cleanupFailed = true; }
      };
      if (existingTecnico && tecnicoId) await attempt(() => admin.from('tecnicos').update({ user_id: null }).eq('id', tecnicoId!).eq('user_id', userId!));
      // Também cobre inserções cujo retorno HTTP tenha se perdido.
      if (!existingTecnico) await attempt(() => admin.from('tecnicos').delete().eq('user_id', userId!));
      await attempt(() => admin.from('cliente_usuarios').delete().eq('user_id', userId!));
      await attempt(() => admin.from('profiles').delete().eq('id', userId!));
      let deleted = false;
      for (let retry = 0; retry < 3 && !deleted; retry++) {
        try { deleted = !(await admin.auth.admin.deleteUser(userId)).error; } catch { /* tentar novamente */ }
      }
      if (!deleted) {
        await attempt(() => admin.auth.admin.updateUserById(userId!, { ban_duration: '876000h' }));
        console.error('[admin-criar-usuario] Exclusão pendente; reconciliar user_id:', userId);
      }
      if (!deleted || cleanupFailed) return reply(500, { error: 'Cadastro cancelado, mas a limpeza não foi concluída. Contate o administrador para reconciliação.', user_id: userId });
    }
    return reply(err instanceof Falha ? err.status : 500, { error: err instanceof Falha ? err.message : 'Erro interno ao criar usuário.' });
  }
});
