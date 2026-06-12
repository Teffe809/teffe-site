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
  cor_primaria:   string;   // ex: "#1B3A6B"
  cor_secundaria: string;   // ex: "#C9A84C"
  estilo?:        string;   // "moderno" | "elegante" | "minimalista"
  observacoes?:   string;   // ajustes solicitados pelo cliente após prévia
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

// ── CSS override baseado em observacoes (aplicado via <style> no <head>) ─────
function gerarCSSObservacoes(obs: string): string {
  if (!obs) return '';
  const o = obs.toLowerCase();
  const r: string[] = [];

  // Frente branca / lado esquerdo branco
  if (o.match(/frente\s+(branca?|white|clara?)|lado\s+(esquerdo|da\s+frente)\s+(branco?|white|claro)|totalmente\s+branca?/)) {
    r.push('#frente { background: #ffffff !important; }');
    r.push('#frente .nome-text  { color: #111111 !important; }');
    r.push('#frente .cargo-text { color: #333333 !important; }');
    r.push('#frente .contact-text { color: #555555 !important; }');
    r.push('#frente .decos { opacity: 0.04 !important; }');
  }

  // Verso branco / lado direito branco
  if (o.match(/verso\s+(branco?|white|claro)|lado\s+(direito|do\s+verso)\s+(branco?|white|claro)/)) {
    r.push('#verso { background: #ffffff !important; }');
    r.push('#verso * { color: #1a1a1a !important; }');
    r.push('#verso .deco-ring { border-color: #cccccc !important; }');
  }

  // Tire a cor / fundo neutro (remove o azul e deixa escuro neutro)
  if (o.match(/tire\s+(o\s+)?(azul|verde|vermelho|cor|a\s+cor)|fundo\s+neutro|sem\s+cor/)) {
    r.push('#frente { background: linear-gradient(148deg,#080808 0%,#141414 45%,#080808 100%) !important; }');
  }

  // Mais escuro
  if (o.match(/(mais\s+escuro|escurecer|sombrio)/)) {
    r.push('#frente { filter: brightness(0.78) !important; }');
    r.push('#verso  { filter: brightness(0.78) !important; }');
  }

  // Mais claro
  if (o.match(/(mais\s+claro|clarear|suavizar)/)) {
    r.push('#frente { filter: brightness(1.22) !important; }');
    r.push('#verso  { filter: brightness(1.22) !important; }');
  }

  // Sem logo / remover logo
  if (o.match(/sem\s+logo|remove?\s+o?\s*logo|tir[ae]\s+o?\s*logo/)) {
    r.push('.logo-area { display: none !important; }');
  }

  return r.length > 0 ? `\n<style id="obs-overrides">\n${r.join('\n')}\n</style>` : '';
}

// ── Icons SVG helper ──────────────────────────────────────────────────────────
function icons(stroke: string) {
  const s = `stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return {
    tel:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${s}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`,
    mail: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>`,
    web:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  };
}

// ── Template 1 — Clássico (dark navy + barra lateral + anéis) ─────────────────
function tplClassico(d: CartaoInput, logo: string): string {
  const cp  = d.cor_primaria;
  const cs  = d.cor_secundaria;
  const ico = icons(cp);
  const contatos = [
    d.telefone ? `<div style="display:flex;align-items:center;gap:10px;">${ico.tel}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);">${d.telefone}</span></div>` : '',
    d.email    ? `<div style="display:flex;align-items:center;gap:10px;">${ico.mail}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);">${d.email}</span></div>` : '',
    d.site     ? `<div style="display:flex;align-items:center;gap:10px;">${ico.web}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,0.85);">${d.site}</span></div>` : '',
  ].filter(Boolean).join('');

  return `
  <!-- FRENTE — Clássico -->
  <div id="frente" style="width:1050px;height:600px;background:linear-gradient(148deg,#07071a 0%,#11112b 45%,#090918 100%);position:relative;overflow:hidden;flex-shrink:0;">
    <div class="decos">
      <div style="position:absolute;top:-130px;right:-90px;width:400px;height:400px;border-radius:50%;border:1.5px solid ${cp}22;"></div>
      <div style="position:absolute;top:-70px;right:-30px;width:260px;height:260px;border-radius:50%;border:1px solid ${cp}44;"></div>
      <div style="position:absolute;bottom:-110px;left:-70px;width:320px;height:320px;border-radius:50%;border:1px solid ${cs}33;"></div>
      <div style="position:absolute;bottom:80px;right:60px;width:120px;height:120px;border-radius:50%;border:1px solid ${cs}55;"></div>
      <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,${cp}18 0%,transparent 70%);"></div>
    </div>
    <div style="position:absolute;left:0;top:0;width:4px;height:100%;background:linear-gradient(180deg,${cp} 0%,${cs} 100%);"></div>
    <div style="position:absolute;bottom:110px;left:52px;right:52px;height:1px;background:linear-gradient(90deg,${cp}66,transparent);"></div>
    <div class="logo-area" style="position:absolute;top:44px;left:52px;display:flex;align-items:center;gap:12px;">
      ${logo
        ? `<img src="${logo}" style="max-height:52px;max-width:150px;object-fit:contain;filter:drop-shadow(0 0 8px ${cp}66);">`
        : `<span style="font-size:17px;font-weight:700;color:#fff;letter-spacing:3px;text-transform:uppercase;">${d.empresa}</span>`}
    </div>
    <div style="position:absolute;top:62px;right:52px;width:8px;height:8px;border-radius:50%;background:${cp};box-shadow:0 0 12px ${cp}99;"></div>
    <div style="position:absolute;top:50%;left:52px;transform:translateY(-58%);max-width:600px;">
      <div class="nome-text" style="font-size:42px;font-weight:800;color:#fff;line-height:1.08;letter-spacing:-0.5px;text-shadow:0 2px 24px rgba(0,0,0,.6);">${d.nome}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:13px;">
        <div style="width:28px;height:2px;background:${cp};border-radius:1px;"></div>
        <div class="cargo-text" style="font-size:14px;font-weight:500;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${d.cargo}</div>
      </div>
      <div style="margin-top:6px;font-size:12.5px;font-weight:300;color:rgba(255,255,255,.45);letter-spacing:.8px;">${d.empresa}</div>
    </div>
    <div style="position:absolute;bottom:40px;left:52px;display:flex;flex-direction:column;gap:9px;">${contatos}</div>
  </div>

  <!-- VERSO — Clássico -->
  <div id="verso" style="width:1050px;height:600px;background:linear-gradient(148deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;flex-shrink:0;">
    <div class="deco-ring" style="position:absolute;top:-160px;right:-110px;width:480px;height:480px;border-radius:50%;background:rgba(255,255,255,.09);"></div>
    <div class="deco-ring" style="position:absolute;bottom:-130px;left:-90px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.07);"></div>
    <div class="deco-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:720px;height:720px;border-radius:50%;border:1px solid rgba(255,255,255,.12);"></div>
    <div class="deco-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:540px;height:540px;border-radius:50%;border:1px solid rgba(255,255,255,.09);"></div>
    <div class="deco-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;border-radius:50%;border:1px solid rgba(255,255,255,.07);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;width:720px;">
      ${logo ? `<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:90px;max-width:280px;object-fit:contain;filter:brightness(0) invert(1);display:inline-block;"></div>` : ''}
      <div style="font-size:${logo ? '26px' : '44px'};font-weight:800;color:#fff;letter-spacing:${logo ? '5px' : '7px'};text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.25);">${d.empresa.toUpperCase()}</div>
      ${d.cargo ? `<div style="margin-top:10px;font-size:13px;font-weight:300;color:rgba(255,255,255,.65);letter-spacing:2px;text-transform:uppercase;">${d.cargo}</div>` : ''}
      ${d.site  ? `<div style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.15);padding:8px 20px;border-radius:40px;"><span style="font-size:12px;color:rgba(255,255,255,.9);letter-spacing:1px;">${d.site}</span></div>` : ''}
    </div>
  </div>`;
}

// ── Template 2 — Executivo (faixa colorida + frente branca) ──────────────────
function tplExecutivo(d: CartaoInput, logo: string): string {
  const cp  = d.cor_primaria;
  const cs  = d.cor_secundaria;
  const ico = icons('#777');
  const contatos = [
    d.telefone ? `<div style="display:flex;align-items:center;gap:9px;">${ico.tel}<span class="contact-text" style="font-size:12px;color:#555;">${d.telefone}</span></div>` : '',
    d.email    ? `<div style="display:flex;align-items:center;gap:9px;">${ico.mail}<span class="contact-text" style="font-size:12px;color:#555;">${d.email}</span></div>` : '',
    d.site     ? `<div style="display:flex;align-items:center;gap:9px;">${ico.web}<span class="contact-text" style="font-size:12px;color:#555;">${d.site}</span></div>` : '',
  ].filter(Boolean).join('');

  return `
  <!-- FRENTE — Executivo -->
  <div id="frente" style="width:1050px;height:600px;background:#ffffff;position:relative;overflow:hidden;flex-shrink:0;">
    <div style="position:absolute;left:0;top:0;width:290px;height:100%;background:linear-gradient(180deg,${cp} 0%,${cs} 100%);"></div>
    <div style="position:absolute;left:0;top:0;width:290px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 22px;text-align:center;">
      ${logo ? `<img src="${logo}" class="logo-area" style="max-height:66px;max-width:190px;object-fit:contain;filter:brightness(0) invert(1);">` : ''}
      <div style="font-size:${logo ? '10px' : '14px'};font-weight:700;color:rgba(255,255,255,.88);letter-spacing:3px;text-transform:uppercase;line-height:1.5;">${d.empresa}</div>
    </div>
    <div style="position:absolute;left:290px;top:18%;width:1px;height:64%;background:linear-gradient(180deg,transparent,${cp}33,transparent);"></div>
    <div style="position:absolute;top:0;right:0;width:760px;height:100%;background:radial-gradient(ellipse at 85% 10%,rgba(0,0,0,.025),transparent 60%);"></div>
    <div style="position:absolute;left:326px;top:50%;transform:translateY(-60%);right:44px;">
      <div class="nome-text" style="font-size:38px;font-weight:800;color:#111;line-height:1.05;letter-spacing:-0.5px;">${d.nome}</div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:12px;">
        <div style="width:32px;height:2px;background:${cp};border-radius:1px;"></div>
        <div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${d.cargo}</div>
      </div>
      <div style="margin-top:5px;font-size:11px;color:#bbb;letter-spacing:.8px;">${d.empresa}</div>
    </div>
    <div style="position:absolute;bottom:36px;left:326px;right:44px;display:flex;flex-direction:column;gap:8px;">${contatos}</div>
  </div>

  <!-- VERSO — Executivo -->
  <div id="verso" style="width:1050px;height:600px;background:#f5f5f5;position:relative;overflow:hidden;flex-shrink:0;">
    <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cp},${cs});opacity:.4;"></div>
    <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 8%,${cp}22 50%,transparent 92%);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:800px;">
      ${logo ? `<div class="logo-area" style="margin-bottom:22px;"><img src="${logo}" style="max-height:90px;max-width:280px;object-fit:contain;display:inline-block;"></div>` : ''}
      <div style="font-size:${logo ? '28px' : '42px'};font-weight:800;color:#111;letter-spacing:6px;text-transform:uppercase;">${d.empresa.toUpperCase()}</div>
      ${d.cargo ? `<div style="margin-top:8px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">${d.cargo}</div>` : ''}
      ${d.site  ? `<div style="margin-top:20px;display:inline-flex;align-items:center;gap:8px;border:1.5px solid ${cp}55;padding:9px 24px;border-radius:40px;"><span style="font-size:12px;color:${cp};font-weight:500;letter-spacing:1px;">${d.site}</span></div>` : ''}
    </div>
  </div>`;
}

// ── Template 3 — Bold (diagonal + geométrico) ─────────────────────────────────
function tplBold(d: CartaoInput, logo: string): string {
  const cp  = d.cor_primaria;
  const cs  = d.cor_secundaria;
  const ico = icons(cp);
  const letra = (d.empresa.charAt(0) || 'G').toUpperCase();
  const contatos = [
    d.telefone ? `<div style="display:flex;align-items:center;gap:10px;">${ico.tel}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${d.telefone}</span></div>` : '',
    d.email    ? `<div style="display:flex;align-items:center;gap:10px;">${ico.mail}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${d.email}</span></div>` : '',
    d.site     ? `<div style="display:flex;align-items:center;gap:10px;">${ico.web}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${d.site}</span></div>` : '',
  ].filter(Boolean).join('');

  return `
  <!-- FRENTE — Bold -->
  <div id="frente" style="width:1050px;height:600px;background:#0d0d0d;position:relative;overflow:hidden;flex-shrink:0;">
    <div class="decos" style="position:absolute;top:0;right:0;width:500px;height:100%;background:linear-gradient(160deg,${cp} 0%,${cs} 100%);clip-path:polygon(22% 0%,100% 0%,100% 100%,0% 100%);"></div>
    <div style="position:absolute;bottom:-24px;right:155px;font-size:360px;font-weight:900;color:rgba(255,255,255,.04);line-height:1;pointer-events:none;font-family:'Poppins',sans-serif;">${letra}</div>
    <div style="position:absolute;top:32px;left:44px;display:flex;gap:7px;">
      <div style="width:9px;height:9px;border-radius:50%;background:${cp};"></div>
      <div style="width:9px;height:9px;border-radius:50%;background:${cs}88;"></div>
      <div style="width:9px;height:9px;border-radius:50%;background:${cp}44;"></div>
    </div>
    ${logo ? `<div class="logo-area" style="position:absolute;top:32px;right:44px;"><img src="${logo}" style="max-height:50px;max-width:150px;object-fit:contain;filter:brightness(0) invert(1);"></div>` : ''}
    <div style="position:absolute;top:50%;left:44px;transform:translateY(-55%);max-width:520px;">
      <div class="nome-text" style="font-size:44px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-1px;">${d.nome}</div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:3px;background:linear-gradient(90deg,${cp},${cs});border-radius:2px;"></div>
        <div class="cargo-text" style="font-size:12px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${d.cargo}</div>
      </div>
      <div style="margin-top:6px;font-size:11.5px;color:rgba(255,255,255,.4);letter-spacing:1px;">${d.empresa}</div>
    </div>
    <div style="position:absolute;bottom:36px;left:44px;display:flex;flex-direction:column;gap:9px;">${contatos}</div>
  </div>

  <!-- VERSO — Bold -->
  <div id="verso" style="width:1050px;height:600px;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;flex-shrink:0;">
    <div class="deco-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:620px;height:620px;border:2px solid rgba(255,255,255,.10);"></div>
    <div class="deco-ring" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:460px;height:460px;border:1px solid rgba(255,255,255,.07);"></div>
    <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:rgba(255,255,255,.25);"></div>
    <div style="position:absolute;bottom:0;right:0;width:4px;height:100%;background:rgba(255,255,255,.15);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;">
      ${logo ? `<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:80px;max-width:240px;object-fit:contain;filter:brightness(0) invert(1);display:inline-block;"></div>` : ''}
      <div style="font-size:${logo ? '26px' : '42px'};font-weight:900;color:#fff;letter-spacing:6px;text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.2);">${d.empresa.toUpperCase()}</div>
      ${d.cargo ? `<div style="margin-top:10px;font-size:11px;color:rgba(255,255,255,.65);letter-spacing:2.5px;text-transform:uppercase;">${d.cargo}</div>` : ''}
      ${d.site  ? `<div style="margin-top:18px;display:inline-flex;align-items:center;background:rgba(255,255,255,.15);padding:9px 22px;border-radius:40px;"><span style="font-size:12px;color:rgba(255,255,255,.9);letter-spacing:1.5px;">${d.site}</span></div>` : ''}
    </div>
  </div>`;
}

// ── Monta HTML completo com template selecionado e CSS de observacoes ─────────
function gerarHTML(d: CartaoInput, logo: string, template: number): string {
  const inner  = template === 0 ? tplClassico(d, logo)
               : template === 1 ? tplExecutivo(d, logo)
               :                  tplBold(d, logo);
  const cssObs = gerarCSSObservacoes(d.observacoes ?? '');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a14; }
</style>${cssObs}
</head>
<body>
<div id="cartao-wrapper" style="width:2100px;background:#0a0a14;">
<div id="cartao-container" style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
${inner}
</div>
<div style="width:2100px;height:30px;background:#0a0a14;display:flex;align-items:center;justify-content:center;gap:10px;">
  <span style="font-size:9px;font-weight:300;color:rgba(255,255,255,.28);letter-spacing:2.5px;text-transform:uppercase;font-family:'Poppins',sans-serif;">Arte gerada por Maya</span>
  <span style="font-size:9px;color:rgba(255,255,255,.18);font-family:'Poppins',sans-serif;">•</span>
  <span style="font-size:9px;font-weight:300;color:rgba(255,255,255,.28);letter-spacing:2.5px;text-transform:uppercase;font-family:'Poppins',sans-serif;">Gráfica Damasceno</span>
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
        google_fonts:    'Poppins:300,400,600,700,800,900',
        viewport_width:  2100,
        viewport_height: 630,
        selector:        '#cartao-wrapper',
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
        options:     { type: 'png', clip: { x: 0, y: 0, width: 2100, height: 630 } },
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

    // Seleciona template aleatório: 0=Clássico, 1=Executivo, 2=Bold
    const template = Math.floor(Math.random() * 3);
    console.log('[gerar-arte] empresa:', dados.empresa, '| nome:', dados.nome, '| template:', template);
    if (dados.observacoes) console.log('[gerar-arte] observacoes:', dados.observacoes);

    const logo     = dados.logo_url ? await logoParaBase64(dados.logo_url) : '';
    const html     = gerarHTML(dados, logo, template);
    const imageUrl = await renderizarHCTI(html) ?? await renderizarBrowserless(html);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({
          error: 'Renderização indisponível. Configure HCTI_USER_ID + HCTI_API_KEY ou BROWSERLESS_API_KEY.',
          html,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ url: imageUrl, template }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
