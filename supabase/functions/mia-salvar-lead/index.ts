const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, historico } = await req.json();

    const apiKey           = Deno.env.get('ANTHROPIC_API_KEY')!;
    const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
    const serviceKey       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey        = 're_6wWMHw6G_JKmjCqire1xwrVdQQoYwgJ5W';

    // Formata histórico como texto legível para extração e email
    const historicoTexto = (historico as Array<{ role: string; content: string }>)
      .map(m => (m.role === 'user' ? 'Visitante' : 'Mia') + ': ' + m.content)
      .join('\n\n');

    // Extrai dados estruturados com Claude Haiku (rápido e barato)
    const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'Você extrai dados de conversas de vendas e retorna SOMENTE JSON válido, sem texto adicional, sem markdown. Campos obrigatórios: {"nome": string, "necessidade": "outsourcing impressão" | "locação notebook" | "locação desktop" | "teffe ia" | "outro", "contato": "WhatsApp" | "e-mail" | "ligação", "valor_contato": string, "detalhes": string}. detalhes deve resumir as informações coletadas (quantidade, situação atual, volume etc.).',
        messages: [
          { role: 'user', content: 'Extraia os dados do lead desta conversa:\n\n' + historicoTexto },
        ],
      }),
    });

    const extractData = await extractRes.json();
    let lead = { nome: nome || '', necessidade: '', contato: '', valor_contato: '', detalhes: '' };

    try {
      const parsed = JSON.parse(extractData.content?.[0]?.text ?? '{}');
      lead = {
        nome:          parsed.nome          || nome || '',
        necessidade:   parsed.necessidade   || '',
        contato:       parsed.contato       || '',
        valor_contato: parsed.valor_contato || '',
        detalhes:      parsed.detalhes      || '',
      };
    } catch (_) { /* keep defaults */ }

    // Salva na tabela mia_leads
    await fetch(supabaseUrl + '/rest/v1/mia_leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        nome:          lead.nome,
        contato:       lead.contato,
        valor_contato: lead.valor_contato,
        necessidade:   lead.necessidade,
        detalhes:      lead.detalhes,
        historico:     historicoTexto,
        status:        'novo',
      }),
    });

    // Envia email de notificação para a equipe
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="background:#1A3F80;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:20px">🤖 Novo Lead — Mia Teffe</h2>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none">
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80;width:160px;border-bottom:1px solid #e2e8f0">Nome</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${lead.nome}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80;border-bottom:1px solid #e2e8f0">Contato</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${lead.contato}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80;border-bottom:1px solid #e2e8f0">Dado de contato</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><strong>${lead.valor_contato}</strong></td>
          </tr>
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80;border-bottom:1px solid #e2e8f0">Necessidade</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${lead.necessidade}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80;border-bottom:1px solid #e2e8f0">Detalhes</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${lead.detalhes}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;background:#f8fafc;font-weight:600;color:#1A3F80">Data/hora</td>
            <td style="padding:12px 16px">${now}</td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:12px;margin-top:16px">Enviado automaticamente pela Mia · Teffe Tecnologia</p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mia Teffe <contato@teffe.com.br>',
        to: 'contato@teffe.com.br',
        subject: '🤖 Novo Lead Mia — ' + lead.nome + ' | ' + lead.necessidade,
        html: emailHtml,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[mia-salvar-lead]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
