const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { to, subject, html, lead } = await req.json();

  // 1. Envia email via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer re_6wWMHw6G_JKmjCqire1xwrVdQQoYwgJ5W',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Teffe Tecnologia <contato@teffe.com.br>',
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();

  // 2. Cria prospecto no CRM se dados do lead foram enviados
  if (lead?.email || lead?.telefone) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const dbHeaders = {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Prefer': 'return=minimal',
      };

      // Proteção anti-duplicata: mesmo email OU telefone nos últimos 5 minutos
      const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      let isDuplicate = false;

      if (lead.email) {
        const r = await fetch(
          supabaseUrl + '/rest/v1/prospectos?email=eq.' + encodeURIComponent(lead.email)
            + '&created_at=gt.' + cincoMinAtras + '&select=id&limit=1',
          { headers: dbHeaders }
        );
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) isDuplicate = true;
      }

      if (!isDuplicate && lead.telefone) {
        const r = await fetch(
          supabaseUrl + '/rest/v1/prospectos?telefone=eq.' + encodeURIComponent(lead.telefone)
            + '&created_at=gt.' + cincoMinAtras + '&select=id&limit=1',
          { headers: dbHeaders }
        );
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) isDuplicate = true;
      }

      if (!isDuplicate) {
        await fetch(supabaseUrl + '/rest/v1/prospectos', {
          method: 'POST',
          headers: dbHeaders,
          body: JSON.stringify({
            contato:    lead.nome      || '',
            empresa:    lead.empresa   || null,
            email:      lead.email     || null,
            telefone:   lead.telefone  || null,
            interesse:  lead.interesse || null,
            observacao: lead.observacao || null,
            origem:     lead.origem    || 'Site Teffe',
            status:     'novo',
          }),
        });
      }
    } catch (crmErr) {
      // Falha no CRM não deve quebrar a resposta do email
      console.error('[enviar-email] CRM insert error:', crmErr);
    }
  }

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: res.status,
  });
});
