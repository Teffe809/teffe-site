require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* ── GET /health ──────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── POST /auth/pin ───────────────────────────────────────────────────────── */
app.post('/auth/pin', async (req, res) => {
  try {
    const { usuario, pin } = req.body ?? {};

    if (!usuario || pin == null) {
      return res.status(400).json({
        autorizado: false,
        motivo: 'Campos obrigatórios: usuario e pin',
      });
    }

    // Reject wildcards to prevent ilike injection
    if (/[%_]/.test(String(usuario))) {
      return res.status(400).json({ autorizado: false, motivo: 'Formato de usuário inválido' });
    }

    const busca = String(usuario).trim();

    // Busca por nome (case-insensitive), depois por email
    let { data: usrs } = await supabase
      .from('teffe_power_usuarios')
      .select('*')
      .ilike('nome', busca)
      .eq('ativo', true)
      .limit(1);

    if (!usrs?.length) {
      ({ data: usrs } = await supabase
        .from('teffe_power_usuarios')
        .select('*')
        .ilike('email', busca)
        .eq('ativo', true)
        .limit(1));
    }

    if (!usrs?.length) {
      return res.json({ autorizado: false, motivo: 'Usuário não encontrado ou inativo' });
    }

    const usr = usrs[0];

    if (!usr.pin || String(usr.pin) !== String(pin)) {
      return res.json({ autorizado: false, motivo: 'PIN inválido' });
    }

    // Busca permissões do perfil vinculado
    let permissoes = [];
    if (usr.perfil_id) {
      const { data: perms } = await supabase
        .from('teffe_power_permissoes')
        .select('*')
        .eq('perfil_id', usr.perfil_id)
        .eq('ativo', true);
      permissoes = perms ?? [];
    }

    return res.json({
      autorizado: true,
      usuario: {
        id: usr.id,
        nome: usr.nome,
        email: usr.email,
        departamento: usr.departamento,
        perfil_id: usr.perfil_id,
        limite_paginas_dia: usr.limite_paginas_dia,
        limite_paginas_mes: usr.limite_paginas_mes,
      },
      permissoes,
    });
  } catch (err) {
    console.error('[/auth/pin]', err.message);
    res.status(500).json({ autorizado: false, motivo: 'Erro interno do servidor' });
  }
});

/* ── POST /log/acesso ─────────────────────────────────────────────────────── */
app.post('/log/acesso', async (req, res) => {
  try {
    const { usuario_id, impressora_id, acao, paginas } = req.body ?? {};

    if (!usuario_id || !impressora_id) {
      return res.status(400).json({
        ok: false,
        motivo: 'Campos obrigatórios: usuario_id e impressora_id',
      });
    }

    // Obtém licenca_chave do usuário
    const { data: usrs } = await supabase
      .from('teffe_power_usuarios')
      .select('licenca_chave')
      .eq('id', usuario_id)
      .limit(1);

    if (!usrs?.length) {
      return res.status(404).json({ ok: false, motivo: 'Usuário não encontrado' });
    }

    const { licenca_chave } = usrs[0];
    const colorido = acao === 'imprimir_color';
    const numPags = Math.max(1, parseInt(paginas) || 1);

    // Busca custo da impressora para calcular valor
    const { data: imps } = await supabase
      .from('teffe_power_impressoras')
      .select('custo_pb, custo_color')
      .eq('id', impressora_id)
      .limit(1);

    const imp = imps?.[0];
    const custo = imp
      ? Number(colorido ? imp.custo_color : imp.custo_pb) * numPags
      : null;

    const { data, error } = await supabase
      .from('teffe_power_impressoes')
      .insert({
        licenca_chave,
        usuario_id,
        impressora_id,
        paginas: numPags,
        colorido,
        custo,
      })
      .select()
      .single();

    if (error) {
      console.error('[/log/acesso] insert:', error.message);
      return res.status(500).json({ ok: false, motivo: error.message });
    }

    return res.json({ ok: true, registro: data });
  } catch (err) {
    console.error('[/log/acesso]', err.message);
    res.status(500).json({ ok: false, motivo: 'Erro interno do servidor' });
  }
});

/* ── Boot ─────────────────────────────────────────────────────────────────── */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Teffe Power BSI rodando na porta ${PORT}`);
  console.log(`  POST  /auth/pin`);
  console.log(`  POST  /log/acesso`);
  console.log(`  GET   /health`);
});
