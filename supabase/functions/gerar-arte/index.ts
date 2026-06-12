const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

interface CartaoInput {
  nome:           string;
  cargo:          string;
  empresa:        string;
  telefone?:      string;
  email?:         string;
  site?:          string;
  logo_url?:      string;
  cor_primaria:   string;   // ex: "#6C63FF"
  cor_secundaria: string;   // ex: "#3ECFCF"
  estilo?:        string;   // "moderno" | "elegante" | "minimalista" (futuro)
}

// ── Converte logo_url para base64 embutível ──────────────────────────────────
async function logoParaBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return '';
    const buf   = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const b64   = btoa(bytes.reduce((acc: string, b: number) => acc + String.fromCharCode(b), ''));
    const ct    = res.headers.get('content-type') ?? 'image/png';
    return `data:${ct};base64,${b64}`;
  } catch (e) {
    console.log('[gerar-arte] erro ao buscar logo:', e);
    return '';
  }
}

// ── Template HTML — Cartão de Visita Frente + Verso (2100×600px) ─────────────
function gerarHTML(d: CartaoInput, logo: string): string {
  const cp = d.cor_primaria;
  const cs = d.cor_secundaria;

  // SVG icons inline
  const icoTel  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cp}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
  const icoMail = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cp}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>`;
  const icoWeb  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cp}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`;

  const contatos = [
    d.telefone ? `<div style="display:flex;align-items:center;gap:10px;">${icoTel}<span style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);letter-spacing:.3px;">${d.telefone}</span></div>` : '',
    d.email    ? `<div style="display:flex;align-items:center;gap:10px;">${icoMail}<span style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);letter-spacing:.3px;">${d.email}</span></div>` : '',
    d.site     ? `<div style="display:flex;align-items:center;gap:10px;">${icoWeb}<span style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);letter-spacing:.3px;">${d.site}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#111; }
</style>
</head>
<body>
<div id="cartao-container" style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">

  <!-- ══════════════ FRENTE ══════════════ -->
  <div style="width:1050px;height:600px;background:linear-gradient(148deg,#07071a 0%,#11112b 45%,#090918 100%);position:relative;overflow:hidden;flex-shrink:0;">

    <!-- Círculos decorativos fundo -->
    <div style="position:absolute;top:-130px;right:-90px;width:400px;height:400px;border-radius:50%;border:1.5px solid ${cp}22;"></div>
    <div style="position:absolute;top:-70px;right:-30px;width:260px;height:260px;border-radius:50%;border:1px solid ${cp}44;"></div>
    <div style="position:absolute;bottom:-110px;left:-70px;width:320px;height:320px;border-radius:50%;border:1px solid ${cs}33;"></div>
    <div style="position:absolute;bottom:80px;right:60px;width:120px;height:120px;border-radius:50%;border:1px solid ${cs}55;"></div>

    <!-- Ponto de luz sutil no canto superior direito -->
    <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,${cp}18 0%,transparent 70%);"></div>

    <!-- Barra lateral esquerda degradê -->
    <div style="position:absolute;left:0;top:0;width:4px;height:100%;background:linear-gradient(180deg,${cp} 0%,${cs} 100%);"></div>

    <!-- Linha horizontal sutil -->
    <div style="position:absolute;bottom:110px;left:52px;right:52px;height:1px;background:linear-gradient(90deg,${cp}66,transparent);"></div>

    <!-- Logo / Nome empresa no topo -->
    <div style="position:absolute;top:44px;left:52px;display:flex;align-items:center;gap:12px;">
      ${logo
        ? `<img src="${logo}" style="max-height:52px;max-width:150px;object-fit:contain;filter:drop-shadow(0 0 8px ${cp}66);">`
        : `<span style="font-size:17px;font-weight:700;color:#fff;letter-spacing:3px;text-transform:uppercase;">${d.empresa}</span>`}
    </div>

    <!-- Ponto decorativo ao lado da empresa -->
    <div style="position:absolute;top:62px;right:52px;width:8px;height:8px;border-radius:50%;background:${cp};box-shadow:0 0 12px ${cp}99;"></div>

    <!-- Nome + Cargo + Empresa (centro vertical) -->
    <div style="position:absolute;top:50%;left:52px;transform:translateY(-58%);max-width:600px;">
      <div style="font-size:42px;font-weight:800;color:#ffffff;line-height:1.08;letter-spacing:-0.5px;text-shadow:0 2px 24px rgba(0,0,0,.6);">${d.nome}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:13px;">
        <div style="width:28px;height:2px;background:${cp};border-radius:1px;"></div>
        <div style="font-size:14px;font-weight:500;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${d.cargo}</div>
      </div>
      <div style="margin-top:6px;font-size:12.5px;font-weight:300;color:rgba(255,255,255,.45);letter-spacing:.8px;">${d.empresa}</div>
    </div>

    <!-- Contatos no rodapé -->
    <div style="position:absolute;bottom:40px;left:52px;display:flex;flex-direction:column;gap:9px;">
      ${contatos}
    </div>
  </div>

  <!-- ══════════════ VERSO ══════════════ -->
  <div style="width:1050px;height:600px;background:linear-gradient(148deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;flex-shrink:0;">

    <!-- Esferas decorativas -->
    <div style="position:absolute;top:-160px;right:-110px;width:480px;height:480px;border-radius:50%;background:rgba(255,255,255,0.09);"></div>
    <div style="position:absolute;bottom:-130px;left:-90px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>

    <!-- Anéis concêntricos centrais -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:720px;height:720px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:540px;height:540px;border-radius:50%;border:1px solid rgba(255,255,255,0.09);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;border-radius:50%;border:1px solid rgba(255,255,255,0.07);"></div>

    <!-- Conteúdo central -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;width:720px;">
      ${logo
        ? `<div style="margin-bottom:20px;"><img src="${logo}" style="max-height:90px;max-width:280px;object-fit:contain;filter:brightness(0) invert(1);drop-shadow:0 4px 20px rgba(0,0,0,.3);display:inline-block;"></div>`
        : ''}
      <div style="font-size:${logo ? '26px' : '44px'};font-weight:800;color:#fff;letter-spacing:${logo ? '5px' : '7px'};text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.25);">${d.empresa.toUpperCase()}</div>
      ${d.cargo ? `<div style="margin-top:10px;font-size:13px;font-weight:300;color:rgba(255,255,255,.65);letter-spacing:2px;text-transform:uppercase;">${d.cargo}</div>` : ''}
      ${d.site  ? `<div style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.15);padding:8px 20px;border-radius:40px;backdrop-filter:blur(10px);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                    <span style="font-size:12px;font-weight:400;color:rgba(255,255,255,.9);letter-spacing:1px;">${d.site}</span>
                  </div>` : ''}
    </div>

    <!-- Rodapé -->
    <div style="position:absolute;bottom:28px;left:0;right:0;text-align:center;">
      <div style="font-size:10px;font-weight:300;color:rgba(255,255,255,.35);letter-spacing:2.5px;text-transform:uppercase;">Arte gerada por Maya · Gráfica Damasceno</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ── Renderiza HTML → PNG via htmlcsstoimage.com (primary) ────────────────────
async function renderizarHCTI(html: string): Promise<string | null> {
  const userId = Deno.env.get('HCTI_USER_ID') ?? '';
  const apiKey = Deno.env.get('HCTI_API_KEY') ?? '';
  if (!userId || !apiKey) return null;

  try {
    const res = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${userId}:${apiKey}`)}`,
      },
      body: JSON.stringify({
        html,
        google_fonts:    'Poppins:300,400,600,700,800',
        viewport_width:  2100,
        viewport_height: 600,
        selector:        '#cartao-container',
      }),
    });
    if (res.ok) {
      const data = await res.json() as { url: string };
      console.log('[hcti] imagem gerada:', data.url);
      return data.url ?? null;
    }
    console.log('[hcti] erro:', res.status, await res.text());
  } catch (e) {
    console.log('[hcti] exceção:', e);
  }
  return null;
}

// ── Renderiza HTML → PNG via Browserless + upload Supabase Storage ───────────
async function renderizarBrowserless(html: string): Promise<string | null> {
  const blKey = Deno.env.get('BROWSERLESS_API_KEY') ?? '';
  const blUrl = Deno.env.get('BROWSERLESS_URL') ?? 'https://chrome.browserless.io';
  if (!blKey) return null;

  try {
    const res = await fetch(`${blUrl}/screenshot?token=${blKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        options:     { type: 'png', clip: { x: 0, y: 0, width: 2100, height: 600 } },
        gotoOptions: { waitUntil: 'networkidle2' },
      }),
    });
    if (!res.ok) { console.log('[browserless] erro:', res.status); return null; }

    const bytes       = new Uint8Array(await res.arrayBuffer());
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const fileName    = `cartao-${Date.now()}.png`;

    const upload = await fetch(
      `${supabaseUrl}/storage/v1/object/artes/${fileName}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: bytes,
      },
    );
    if (upload.ok) return `${supabaseUrl}/storage/v1/object/public/artes/${fileName}`;
    console.log('[browserless] upload erro:', upload.status, await upload.text());
  } catch (e) {
    console.log('[browserless] exceção:', e);
  }
  return null;
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dados = await req.json() as CartaoInput;

    if (!dados.nome || !dados.empresa || !dados.cor_primaria || !dados.cor_secundaria) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: nome, empresa, cor_primaria, cor_secundaria' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[gerar-arte] iniciando para:', dados.empresa, '/', dados.nome);

    const logo     = dados.logo_url ? await logoParaBase64(dados.logo_url) : '';
    const html     = gerarHTML(dados, logo);
    const imageUrl = await renderizarHCTI(html) ?? await renderizarBrowserless(html);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({
          error: 'Renderização indisponível. Configure os secrets: HCTI_USER_ID + HCTI_API_KEY (htmlcsstoimage.com) ou BROWSERLESS_API_KEY.',
          html,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ url: imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
