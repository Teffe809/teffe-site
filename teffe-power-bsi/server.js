require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { bootPlatform } = require('./platform');

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const platform = bootPlatform();

/* ── GET /health ──────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: {
      status: platform.status,
      bootedAt: platform.bootedAt,
      plugins: platform.plugins,
    },
  });
});

app.post('/capabilities/vehicle-identification/manual', (req, res) => {
  try {
    const { plate, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleManualVehicleIdentification({ plate, userId });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/vehicle-identification/manual]', err.message);
    res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/vehicle-compatibility', (req, res) => {
  try {
    const { vehicle, category, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleVehicleCompatibility({
      vehicle,
      category,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/vehicle-compatibility]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/stock-availability', (req, res) => {
  try {
    const { vehicle, part, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleStockAvailability({
      vehicle,
      part,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/stock-availability]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/service-intelligence', (req, res) => {
  try {
    const { vehicle, part, category, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleServiceIntelligence({
      vehicle,
      part,
      category,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/service-intelligence]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/recommendation', (req, res) => {
  try {
    const { vehicle, part, category, serviceIntelligence, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleRecommendation({
      vehicle,
      part,
      category,
      serviceIntelligence,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/recommendation]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/budget', (req, res) => {
  try {
    const {
      vehicle,
      part,
      category,
      serviceIntelligence,
      recommendation,
      userId,
    } = req.body ?? {};
    const result = platform.engines.miaCore.handleBudgetIntelligence({
      vehicle,
      part,
      category,
      serviceIntelligence,
      recommendation,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/budget]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/pricing', (req, res) => {
  try {
    const { budget, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handlePricingIntelligence({
      budget,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/pricing]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/decision', (req, res) => {
  try {
    const { pricing, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleDecisionIntelligence({
      pricing,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/decision]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/capabilities/sales', (req, res) => {
  try {
    const { pricing, decision, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleSalesIntelligence({
      pricing,
      decision,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/capabilities/sales]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/workflows/autoparts/full-sales-flow', (req, res) => {
  try {
    const { plate, category, partCategory, tenantId, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleAutopartsFullSalesFlow({
      plate,
      category,
      partCategory,
      tenantId,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/workflows/autoparts/full-sales-flow]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/tenants/specialization', (req, res) => {
  try {
    const { tenantId, tenant_id, userId } = req.body ?? {};
    const result = platform.engines.miaCore.handleTenantSpecialization({
      tenantId,
      tenant_id,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/tenants/specialization]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/gateway/messages', (req, res) => {
  try {
    const { userId, ...message } = req.body ?? {};
    const result = platform.engines.miaCore.handleCommunicationMessage({
      message,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/gateway/messages]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
});

app.post('/gateway/dispatch', (req, res) => {
  try {
    const { userId, ...message } = req.body ?? {};
    const result = platform.engines.miaCore.handleWorkflowDispatch({
      message,
      userId,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[/gateway/dispatch]', err.message);
    return res.status(500).json({ ok: false, reason: 'internal server error' });
  }
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
  console.log(`  POST  /capabilities/vehicle-identification/manual`);
  console.log(`  POST  /capabilities/vehicle-compatibility`);
  console.log(`  POST  /capabilities/stock-availability`);
  console.log(`  POST  /capabilities/service-intelligence`);
  console.log(`  POST  /capabilities/recommendation`);
  console.log(`  POST  /capabilities/budget`);
  console.log(`  POST  /capabilities/pricing`);
  console.log(`  POST  /capabilities/decision`);
  console.log(`  POST  /capabilities/sales`);
  console.log(`  POST  /workflows/autoparts/full-sales-flow`);
  console.log(`  POST  /tenants/specialization`);
  console.log(`  POST  /gateway/messages`);
  console.log(`  POST  /gateway/dispatch`);
  console.log(`  GET   /health`);
});
