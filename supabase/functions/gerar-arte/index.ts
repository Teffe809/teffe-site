const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

// ── Interface de entrada ──────────────────────────────────────────────────────
interface ProdutoInput {
  tipo_produto:       string;   // "cartao_visita" | "adesivo_redondo" | ...
  modo?:              string;   // "texto" | "ilustracao" | "combinado"
  ilustracao_prompt?: string;   // prompt em inglês para o Replicate (flux-schnell)
  background_url?:    string;   // URL de ilustração já gerada (pula o Replicate)
  nome?:              string;
  cargo?:             string;
  empresa?:           string;
  telefone?:          string;
  email?:             string;
  site?:              string;
  logo_url?:          string;
  cor_primaria:       string;
  cor_secundaria:     string;
  texto_principal?:   string;
  texto_secundario?:  string;
  estilo?:            string;
  layout_id?:         string;
  observacoes?:       string;
}

// ── Utilitários ───────────────────────────────────────────────────────────────
async function logoParaBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // já convertido em mia-chat
  try {
    // URLs do WhatsApp CDN e Evolution API exigem autenticação
    const needsAuth = url.startsWith('https://mmg.whatsapp.net') || url.startsWith('https://evolution-api');
    const headers: Record<string, string> = needsAuth
      ? { apikey: Deno.env.get('EVOLUTION_API_KEY') ?? '' }
      : {};
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return '';
    const buf  = await res.arrayBuffer();
    const b64  = btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''));
    const ct   = res.headers.get('content-type') ?? 'image/png';
    return `data:${ct};base64,${b64}`;
  } catch { return ''; }
}

function pick(n: number): number { return Math.floor(Math.random() * n); }

function esc(s: string | undefined): string { return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// SVG texto em arco no topo — para adesivo redondo
// Posicionado dentro da div 760×760 (border-radius:50%), raio 330px (≈45% dos 760px internos)
function arcTextSVG(texto: string): string {
  if (!texto) return '';
  const id = Math.random().toString(36).slice(2, 8);
  return `<svg style="position:absolute;top:0;left:0;width:760px;height:760px;pointer-events:none;z-index:10;overflow:visible;" viewBox="0 0 760 760"><defs><filter id="ats-${id}" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.93"/></filter><path id="atp-${id}" d="M 50,380 a 330,330,0,0,0,660,0"/></defs><text font-family="'Poppins',sans-serif" font-size="46" font-weight="700" fill="white" letter-spacing="3" filter="url(#ats-${id})" text-anchor="middle"><textPath href="#atp-${id}" startOffset="50%">${texto}</textPath></text></svg>`;
}

// ── Replicate flux-schnell ────────────────────────────────────────────────────
function replicateDims(w: number, h: number): [number, number] {
  const snap = (v: number) => Math.max(256, Math.min(1440, Math.round(v / 16) * 16));
  const MAX = 1440;
  if (w <= MAX && h <= MAX) return [snap(w), snap(h)];
  const r = w / h;
  if (w > h) return [MAX, snap(MAX / r)];
  return [snap(MAX * r), MAX];
}

async function gerarIlustracaoReplicate(prompt: string, pw: number, ph: number): Promise<string | null> {
  const token = Deno.env.get('REPLICATE_API_TOKEN') ?? '';
  if (!token) { console.log('[replicate] REPLICATE_API_TOKEN não configurado'); return null; }

  const [rw, rh] = replicateDims(pw, ph);
  console.log('[replicate] gerando', rw, 'x', rh, '|', prompt.substring(0, 60));

  try {
    const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        input: { prompt, width: rw, height: rh, num_inference_steps: 4, output_format: 'png' },
      }),
      signal: AbortSignal.timeout(70000),
    });

    if (!res.ok) { console.log('[replicate] erro:', res.status, await res.text()); return null; }

    const data = await res.json() as { status: string; output?: string[] | null; id?: string; urls?: { get: string } };
    if (data.status === 'succeeded' && data.output?.[0]) return data.output[0];

    // Polling fallback caso Prefer:wait não retorne imediatamente
    if (data.id && data.urls?.get) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(data.urls.get, { headers: { Authorization: `Bearer ${token}` } });
        if (!poll.ok) continue;
        const pd = await poll.json() as { status: string; output?: string[] | null };
        if (pd.status === 'succeeded' && pd.output?.[0]) { console.log('[replicate] ok via polling'); return pd.output[0]; }
        if (pd.status === 'failed') { console.log('[replicate] falhou'); return null; }
      }
    }

    console.log('[replicate] timeout / sem output');
    return null;
  } catch (e) { console.log('[replicate] exceção:', e); return null; }
}

function icons(stroke: string) {
  const a = `stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return {
    tel:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${a}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`,
    mail: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${a}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>`,
    web:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ${a}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  };
}

function gerarCSSObservacoes(obs: string): string {
  if (!obs) return '';
  const o = obs.toLowerCase();
  const r: string[] = [];
  if (o.match(/frente\s+(branca?|white)|lado\s+esquerdo\s+(branco?|white)/)) {
    r.push('#frente{background:#fff!important;}#frente .nome-text{color:#111!important;}#frente .cargo-text{color:#333!important;}#frente .contact-text{color:#555!important;}');
  }
  if (o.match(/verso\s+(branco?|white)|lado\s+direito\s+(branco?|white)/)) {
    r.push('#verso{background:#fff!important;}#verso *{color:#1a1a1a!important;}');
  }
  if (o.match(/tire\s+(o\s+)?(azul|verde|vermelho|cor)|fundo\s+neutro/)) {
    r.push('#frente,#produto>div:first-child{background:linear-gradient(148deg,#080808 0%,#141414 45%,#080808 100%)!important;}');
  }
  if (o.match(/(mais\s+escuro|escurecer)/)) {
    r.push('#frente,#verso,#produto>div:first-child{filter:brightness(.78)!important;}');
  }
  if (o.match(/(mais\s+claro|clarear)/)) {
    r.push('#frente,#verso,#produto>div:first-child{filter:brightness(1.22)!important;}');
  }
  if (o.match(/sem\s+logo|tir[ae]\s+o?\s*logo/)) {
    r.push('.logo-area{display:none!important;}');
  }
  return r.length ? `\n<style id="obs">${r.join('')}</style>` : '';
}

function wrapHTML(inner: string, obs: string, w: number, h: number, bgUrl?: string): string {
  const css = gerarCSSObservacoes(obs);
  // Camadas de fundo para modo "combinado": imagem gerada pelo Replicate + overlay escuro
  const bgLayer = bgUrl
    ? `<div style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;background-image:url('${bgUrl}');background-size:cover;background-position:center;z-index:0;"></div><div style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;background:rgba(0,0,0,0.48);z-index:1;"></div>`
    : '';
  // Marca d'água de prévia — visível em todas as imagens, removida na arte final aprovada
  const wmFs = Math.max(12, Math.min(22, Math.round(Math.max(w, h) * 0.007)));
  const wmH  = Math.round(wmFs * 2.6);
  const watermark = `<div id="preview-watermark" style="position:absolute;bottom:0;left:0;width:${w}px;height:${wmH}px;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;gap:${Math.round(wmFs * 0.6)}px;z-index:99;pointer-events:none;">
<span style="font-size:${wmFs}px;font-weight:400;color:rgba(255,255,255,.60);letter-spacing:1.2px;font-family:'Poppins',sans-serif;">Prévia — Arte gerada pela Maya IA</span>
<span style="font-size:${wmFs}px;color:rgba(255,255,255,.30);">•</span>
<span style="font-size:${wmFs}px;font-weight:600;color:rgba(255,255,255,.60);letter-spacing:.8px;font-family:'Poppins',sans-serif;">Gráfica Damasceno</span>
</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a14;font-family:'Poppins',sans-serif;}</style>${css}
</head><body>
<div id="wrapper" style="width:${w}px;background:#0a0a14;">
<div id="produto" style="width:${w}px;height:${h}px;overflow:hidden;position:relative;">${bgLayer}${inner}${watermark}
</div>
<div style="width:${w}px;height:30px;background:#0a0a14;display:flex;align-items:center;justify-content:center;gap:10px;">
<span style="font-size:9px;font-weight:300;color:rgba(255,255,255,.28);letter-spacing:2.5px;text-transform:uppercase;">Arte gerada por Maya</span>
<span style="font-size:9px;color:rgba(255,255,255,.18);">•</span>
<span style="font-size:9px;font-weight:300;color:rgba(255,255,255,.28);letter-spacing:2.5px;text-transform:uppercase;">Gráfica Damasceno</span>
</div>
</div></body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// CARTÃO DE VISITA  1050×600 cada lado  → produto: 2100×600
// ════════════════════════════════════════════════════════════════════════════

function cktBg(color: string, opacity: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 1050 600" preserveAspectRatio="xMidYMid slice"><g stroke="${color}" stroke-width="1.2" fill="none" opacity="${opacity}"><path d="M0 150 h80 v-40 h60 v40 h120 v80 h-40 v60"/><path d="M200 0 v80 h40 v60 h-40 v80 h80 v-40 h60"/><path d="M500 100 h60 v-60 h80 v60 h60 v120 h-40 v40"/><path d="M700 0 v120 h-60 v60 h60 v80 h80 v-60 h40"/><path d="M900 200 h80 v-80 h60 v180 h-60 v60"/><path d="M0 400 h100 v-40 h80 v80 h-40 v60 h100"/><path d="M300 500 h80 v-80 h60 v80 h100 v-40 h80"/><path d="M700 400 h80 v80 h60 v-100 h80 v40"/><circle cx="80" cy="150" r="4" fill="${color}"/><circle cx="200" cy="80" r="4" fill="${color}"/><circle cx="560" cy="100" r="4" fill="${color}"/><circle cx="760" cy="120" r="4" fill="${color}"/><circle cx="100" cy="400" r="4" fill="${color}"/><circle cx="380" cy="500" r="4" fill="${color}"/><circle cx="780" cy="400" r="4" fill="${color}"/></g></svg>`;
}

function pcbBg(color: string, opacity: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 1050 600" preserveAspectRatio="xMidYMid slice"><g stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"><path d="M20,60 H100 V140 H200"/><path d="M200,140 V60 H340"/><path d="M340,60 V200 H420 V130"/><path d="M20,400 H100 V340 H220"/><path d="M220,340 V460 H360 V380"/><path d="M40,260 H120 V320 H60 V420"/><path d="M600,40 H720 V120 H820 V60"/><path d="M820,60 H940 V160 H1000 V80"/><path d="M560,320 V440 H680 V300 H800 V380 H920"/><path d="M460,200 V280 H580 V220 H700"/></g><g fill="${color}" stroke="none" opacity="${opacity}"><circle cx="20" cy="60" r="4"/><circle cx="100" cy="60" r="3"/><circle cx="100" cy="140" r="4"/><circle cx="200" cy="140" r="4"/><circle cx="200" cy="60" r="3"/><circle cx="340" cy="60" r="4"/><circle cx="340" cy="200" r="3"/><circle cx="420" cy="200" r="4"/><circle cx="420" cy="130" r="3"/><circle cx="20" cy="400" r="4"/><circle cx="100" cy="400" r="3"/><circle cx="100" cy="340" r="4"/><circle cx="220" cy="340" r="4"/><circle cx="220" cy="460" r="3"/><circle cx="360" cy="460" r="4"/><circle cx="360" cy="380" r="3"/><circle cx="40" cy="260" r="4"/><circle cx="120" cy="260" r="3"/><circle cx="120" cy="320" r="4"/><circle cx="60" cy="420" r="3"/><circle cx="600" cy="40" r="4"/><circle cx="720" cy="40" r="3"/><circle cx="720" cy="120" r="4"/><circle cx="820" cy="120" r="3"/><circle cx="820" cy="60" r="4"/><circle cx="940" cy="60" r="3"/><circle cx="940" cy="160" r="4"/><circle cx="1000" cy="160" r="3"/><circle cx="1000" cy="80" r="4"/><circle cx="560" cy="320" r="4"/><circle cx="560" cy="440" r="3"/><circle cx="680" cy="440" r="4"/><circle cx="680" cy="300" r="3"/><circle cx="800" cy="300" r="4"/><circle cx="800" cy="380" r="3"/><circle cx="920" cy="380" r="4"/><circle cx="460" cy="200" r="4"/><circle cx="460" cy="280" r="3"/><circle cx="580" cy="280" r="4"/><circle cx="580" cy="220" r="3"/><circle cx="700" cy="220" r="4"/></g></svg>`;
}

function ekgLine(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 50" style="display:block;width:380px;height:50px;"><polyline points="0,25 50,25 70,25 88,5 105,45 122,2 140,48 158,25 200,25 380,25" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function circIco(bg: string, svgInner: string): string {
  return `<div style="width:28px;height:28px;border-radius:50%;background:${bg};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${svgInner}</div>`;
}
function icoTel(c: string): string { return circIco(c,`<svg viewBox="0 0 24 24" style="width:13px;height:13px;" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`); }
function icoMail(c: string): string { return circIco(c,`<svg viewBox="0 0 24 24" style="width:13px;height:13px;" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>`); }
function icoWeb(c: string): string  { return circIco(c,`<svg viewBox="0 0 24 24" style="width:13px;height:13px;" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`); }

// ── tplTecnologico1: navy diagonal left + PCB orange traces, white right ─────
function tplTecnologico1(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria||'#f97316', cs=d.cor_secundaria||'#1a2e4a';
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const hi=(inner: string)=>`<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 24,8.5 24,17.5 13,24 2,17.5 2,8.5" fill="rgba(0,0,0,.3)" stroke="rgba(255,255,255,.35)" stroke-width="1"/>${inner}</svg>`;
  const hexTel=hi(`<g transform="translate(6,6)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9.3v1.7a1.1 1.1 0 01-1.2 1.1 11 11 0 01-4.8-1.7A10.9 10.9 0 012.3 5.9 11 11 0 01.6 1.1 1.1 1.1 0 011.7 0h1.7A1.1 1.1 0 014.5 1c.07.53.2 1.05.39 1.55a1.1 1.1 0 01-.25 1.16l-.76.76a8.89 8.89 0 003.43 3.43l.76-.76a1.1 1.1 0 011.16-.25c.5.19 1.02.32 1.55.39A1.1 1.1 0 0112 9.3z"/></g>`);
  const hexMail=hi(`<g transform="translate(5,7)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="16" height="11" rx="1.5"/><path d="M0 2l8 5 8-5"/></g>`);
  const hexWeb=hi(`<g transform="translate(6,6)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="7"/><line x1="0" y1="7" x2="14" y2="7"/><path d="M7 0a9 9 0 012 7 9 9 0 01-2 7 9 9 0 01-2-7 9 9 0 012-7z"/></g>`);
  const bct=[
    d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">${hexTel}<span style="font-size:12px;color:rgba(255,255,255,.9);">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">${hexMail}<span style="font-size:12px;color:rgba(255,255,255,.9);">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:10px;">${hexWeb}<span style="font-size:12px;color:${cp};">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="width:460px;height:600px;background:${cs};clip-path:polygon(0 0,100% 0,82% 100%,0 100%);flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 70px 0 44px;">
    ${pcbBg(cp,0.18)}
    <div class="logo-area" style="position:relative;z-index:1;text-align:center;">
      ${logo?`<img src="${logo}" style="max-height:110px;max-width:260px;object-fit:contain;filter:brightness(0) invert(1);">`:`<div style="width:88px;height:88px;border-radius:12px;border:3px solid ${cp};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:40px;font-weight:900;color:${cp};">${(d.empresa||'E').charAt(0)}</span></div>`}
    </div>
    <div style="position:relative;z-index:1;margin-top:20px;display:flex;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:${cp};"></div><div style="width:8px;height:8px;border-radius:50%;background:${cp};opacity:.6;"></div><div style="width:8px;height:8px;border-radius:50%;background:${cp};opacity:.3;"></div></div>
  </div>
  <div style="flex:1;padding:0 44px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1;">
    <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${cp},${cs});"></div>
    <div style="font-size:10px;font-weight:700;color:${cp};letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;">${emp}</div>
    <div class="nome-text" style="font-size:40px;font-weight:900;color:${cs};line-height:1.0;letter-spacing:-1.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;"><div style="width:28px;height:2px;background:${cp};"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:#555;letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    ${d.telefone||d.email?`<div style="margin-top:20px;font-size:12px;color:#aaa;">${[d.telefone?esc(d.telefone):'',d.email?esc(d.email):''].filter(Boolean).join(' · ')}</div>`:''}
  </div>
</div>
<div id="verso" style="width:1050px;height:600px;background:${cp};position:relative;overflow:hidden;flex-shrink:0;">
  ${pcbBg(cs,0.15)}
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1;width:760px;text-align:center;">
    <div class="logo-area" style="margin-bottom:16px;">
      ${logo?`<img src="${logo}" style="max-height:72px;max-width:220px;object-fit:contain;filter:brightness(0) invert(1);display:inline-block;">`:`<div style="font-size:14px;font-weight:800;color:#fff;letter-spacing:4px;text-transform:uppercase;">${emp}</div>`}
    </div>
    <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:5px;text-transform:uppercase;">${emp}</div>
    <div style="width:48px;height:2px;background:rgba(0,0,0,.25);margin:14px auto;"></div>
    <div style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:0;">${bct}</div>
  </div>
</div></div>`;
}

// ── tplTecnologico2: white + triangle dark corners + logo, angular verso ─────
function tplTecnologico2(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria||'#f97316', cs=d.cor_secundaria||'#1a2e4a';
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const ct=[
    d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoTel(cp)}<span style="font-size:12px;color:#444;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoMail(cp)}<span style="font-size:12px;color:#444;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:10px;">${icoWeb(cp)}<span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;align-items:center;">
  ${pcbBg(cp,0.055)}
  <div style="position:absolute;top:0;left:0;width:0;height:0;border-style:solid;border-width:230px 290px 0 0;border-color:${cs} transparent transparent transparent;z-index:1;"></div>
  <div style="position:absolute;bottom:0;right:0;width:0;height:0;border-style:solid;border-width:0 0 200px 250px;border-color:transparent transparent ${cs} transparent;z-index:1;"></div>
  <div style="position:absolute;top:22px;left:22px;z-index:2;" class="logo-area">
    ${logo?`<img src="${logo}" style="max-height:36px;max-width:110px;object-fit:contain;filter:brightness(0) invert(1);">`:`<span style="font-size:9px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:3px;text-transform:uppercase;">${emp}</span>`}
  </div>
  <div style="position:absolute;right:40px;bottom:26px;z-index:2;"><div style="width:52px;height:3px;background:${cp};margin-bottom:5px;"></div><div style="width:32px;height:3px;background:${cp};opacity:.4;"></div></div>
  <div style="position:relative;z-index:2;padding:0 56px;flex:1;">
    <div class="logo-area" style="margin-bottom:16px;">${logo?`<img src="${logo}" style="max-height:78px;max-width:220px;object-fit:contain;">`:''}</div>
    <div class="nome-text" style="font-size:40px;font-weight:900;color:#111;line-height:1.0;letter-spacing:-1.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><div style="width:28px;height:3px;background:${cp};"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:4px;font-size:11px;color:#bbb;letter-spacing:2px;">${emp}</div>
  </div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="width:360px;height:600px;background:${cs};flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;">
    ${pcbBg(cp,0.15)}
    <div class="logo-area" style="position:relative;z-index:1;text-align:center;margin-bottom:14px;">
      ${logo?`<img src="${logo}" style="max-height:88px;max-width:210px;object-fit:contain;filter:brightness(0) invert(1);">`:`<div style="width:80px;height:80px;border-radius:50%;border:3px solid ${cp};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:36px;font-weight:900;color:${cp};">${(d.empresa||'E').charAt(0)}</span></div>`}
    </div>
    <div style="position:relative;z-index:1;font-size:9px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:3px;text-transform:uppercase;text-align:center;">${emp}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 44px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 90px 90px 0;border-color:transparent ${cp} transparent transparent;"></div>
    <div style="position:absolute;bottom:0;left:0;width:0;height:0;border-style:solid;border-width:0 0 80px 80px;border-color:transparent transparent ${cp} transparent;"></div>
    <div class="nome-text" style="font-size:34px;font-weight:900;color:#0f0f0f;line-height:1.05;letter-spacing:-1px;">${nom}</div>
    <div class="cargo-text" style="font-size:12px;font-weight:700;color:${cp};letter-spacing:2.5px;text-transform:uppercase;margin-top:8px;">${car}</div>
    <div style="width:36px;height:2px;background:${cs};margin:16px 0;border-radius:1px;"></div>
    ${ct}
  </div>
</div></div>`;
}

// ── tplTecnologico3: white clean + PCB texture + divider, navy PCB verso ─────
function tplTecnologico3(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria||'#f97316', cs=d.cor_secundaria||'#1a2e4a';
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const bct=[
    d.telefone?`<div style="display:flex;align-items:center;gap:11px;margin-bottom:11px;">${icoTel(cp)}<span style="font-size:13px;color:#fff;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:11px;margin-bottom:11px;">${icoMail(cp)}<span style="font-size:13px;color:#fff;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:11px;">${icoWeb(cp)}<span style="font-size:13px;color:${cp};">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  ${pcbBg(cp,0.06)}
  <div style="width:380px;height:600px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px;position:relative;z-index:1;">
    <div class="logo-area" style="text-align:center;">
      ${logo?`<img src="${logo}" style="max-height:120px;max-width:260px;object-fit:contain;">`:`<div style="width:88px;height:88px;border-radius:12px;background:${cp};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:44px;font-weight:900;color:#fff;">${(d.empresa||'E').charAt(0)}</span></div>`}
    </div>
  </div>
  <div style="position:absolute;left:380px;top:60px;width:1.5px;height:480px;background:linear-gradient(180deg,transparent,${cp},transparent);z-index:2;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 48px;position:relative;z-index:1;">
    <div style="font-size:10px;font-weight:700;color:${cp};letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">${emp}</div>
    <div class="nome-text" style="font-size:42px;font-weight:900;color:#0f0f0f;line-height:1.0;letter-spacing:-1.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;"><div style="width:28px;height:3px;background:${cp};"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:#666;letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    ${d.telefone?`<div style="margin-top:18px;font-size:12px;color:#bbb;">${esc(d.telefone)}</div>`:''}
    ${d.email?`<div style="margin-top:4px;font-size:12px;color:#bbb;">${esc(d.email)}</div>`:''}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${cp},${cs});z-index:3;"></div>
</div>
<div id="verso" style="width:1050px;height:600px;background:${cs};position:relative;overflow:hidden;flex-shrink:0;">
  ${pcbBg(cp,0.16)}
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:1;width:760px;">
    <div class="logo-area" style="margin-bottom:16px;">
      ${logo?`<img src="${logo}" style="max-height:80px;max-width:240px;object-fit:contain;filter:brightness(0) invert(1);display:inline-block;">`:`<div style="font-size:40px;font-weight:900;color:${cp};display:inline-block;">${(d.empresa||'E').charAt(0)}</div>`}
    </div>
    <div style="font-size:${logo?'22px':'34px'};font-weight:800;color:#fff;letter-spacing:5px;text-transform:uppercase;">${emp}</div>
    <div style="width:40px;height:3px;background:${cp};margin:16px auto;border-radius:2px;"></div>
    <div style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:0;">${bct}</div>
  </div>
</div></div>`;
}

// ── tplTecnologicoZ: full-doc template — dois cards side-by-side standalone ──
function tplTecnologicoZ(d: ProdutoInput, logoB64: string): string {
  const primeiraLetra = (d.empresa || d.nome || 'T')[0].toUpperCase();
  const cor1 = d.cor_primaria  || '#142D63';
  const cor2 = d.cor_secundaria || '#F58220';
  const emp  = esc(d.empresa  || 'EMPRESA');
  const nom  = esc(d.nome     || '');
  const car  = esc(d.cargo    || '');
  const tag  = esc(d.texto_secundario || '');
  const tel  = esc(d.telefone || '');
  const mail = esc(d.email    || '');
  const site = esc(d.site     || '');

  const logoHtml = logoB64
    ? `<img src="${logoB64}" style="width:130px;height:130px;object-fit:contain;">`
    : `<div style="background:${cor1};clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0% 50%);width:130px;height:130px;position:relative;display:flex;justify-content:center;align-items:center;"><span style="color:${cor2};font-size:70px;font-weight:800;">${primeiraLetra}</span></div>`;

  const logoSmallHtml = logoB64
    ? `<img src="${logoB64}" style="width:90px;height:90px;object-fit:contain;">`
    : `<div style="width:90px;height:90px;background:${cor1};border:4px solid ${cor2};clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0% 50%);display:flex;justify-content:center;align-items:center;color:${cor2};font-size:42px;font-weight:800;">${primeiraLetra}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Montserrat',sans-serif;}
body{background:#1b1b1b;display:flex;justify-content:center;align-items:center;gap:0;min-height:100vh;padding:0;flex-wrap:nowrap;}
.card{width:1050px;height:600px;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);position:relative;}
.front{background:#ffffff;position:relative;}
.front::after{content:'';position:absolute;bottom:0;left:0;width:100%;height:90px;background:linear-gradient(90deg,${cor1},${cor2});clip-path:polygon(0 30%,100% 0,100% 100%,0 100%);}
.logo-area{height:100%;display:flex;align-items:center;padding:80px;gap:35px;}
.company h1{font-size:82px;line-height:1;color:${cor1};}
.company h2{margin-top:10px;color:${cor2};letter-spacing:12px;font-weight:500;font-size:24px;}
.back{background:linear-gradient(135deg,#0d1d45,${cor1} 40%,#0d1d45);color:white;}
.back-content{display:flex;height:100%;}
.left{width:35%;padding:60px;border-right:1px solid rgba(255,255,255,.12);}
.brand{margin-top:25px;font-size:34px;font-weight:800;color:white;}
.brand span{color:${cor2};}
.right{flex:1;padding:60px;}
.name{font-size:42px;font-weight:700;}
.position{color:${cor2};font-size:20px;margin-top:8px;margin-bottom:40px;}
.info{display:flex;align-items:center;gap:15px;margin-bottom:22px;font-size:20px;}
.icon{width:40px;height:40px;border-radius:50%;background:${cor2};display:flex;justify-content:center;align-items:center;font-weight:700;color:white;flex-shrink:0;}
</style></head>
<body>
<div class="card front">
  <div class="logo-area">
    ${logoHtml}
    <div class="company">
      <h1>${emp}</h1>
      <h2>${tag}</h2>
    </div>
  </div>
</div>
<div class="card back">
  <div class="back-content">
    <div class="left">
      ${logoSmallHtml}
      <div class="brand">${emp}</div>
    </div>
    <div class="right">
      <div class="name">${nom}</div>
      <div class="position">${car}</div>
      ${mail ? `<div class="info"><div class="icon">@</div>${mail}</div>` : ''}
      ${tel  ? `<div class="info"><div class="icon">&#9990;</div>${tel}</div>` : ''}
      ${site ? `<div class="info"><div class="icon">W</div>${site}</div>` : ''}
    </div>
  </div>
</div>
</body></html>`;
}

// ── tplSaude1: emerald green + gold, EKG decoration ────────────────────────
function tplSaude1(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria||'#2e7d32', cs=d.cor_secundaria||'#b8860b';
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const ct=[
    d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoTel(cp)}<span style="font-size:12px;color:#444;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoMail(cp)}<span style="font-size:12px;color:#444;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:10px;">${icoWeb(cp)}<span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  const specs=(d.texto_secundario??'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
  const specsHtml=specs.map(s=>`<div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;"><div style="width:8px;height:8px;border-radius:50%;background:${cs};flex-shrink:0;"></div><span style="font-size:12px;color:#333;">${esc(s)}</span></div>`).join('');
  return `<div style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
<div id="frente" style="width:1050px;height:600px;background:#f9fbf8;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="position:absolute;bottom:-80px;right:-80px;width:360px;height:360px;border-radius:50%;background:${cp}22;z-index:0;"></div>
  <div style="position:absolute;bottom:-30px;right:-30px;width:220px;height:220px;border-radius:50%;background:${cp}33;z-index:0;"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cp},${cs});z-index:3;"></div>
  <div style="width:380px;height:600px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;position:relative;z-index:1;">
    <div class="logo-area" style="text-align:center;margin-bottom:16px;">
      ${logo?`<img src="${logo}" style="max-height:120px;max-width:250px;object-fit:contain;">`:`<div style="width:88px;height:88px;border-radius:50%;background:${cs};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:40px;font-weight:900;color:#fff;">${(d.empresa||'S').charAt(0)}</span></div>`}
    </div>
    <div style="font-size:10px;font-weight:700;color:${cs};letter-spacing:3px;text-transform:uppercase;text-align:center;">${emp}</div>
  </div>
  <div style="position:absolute;left:380px;top:60px;width:1px;height:480px;background:linear-gradient(180deg,transparent,${cp}55,transparent);z-index:2;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 44px;position:relative;z-index:1;">
    <div class="nome-text" style="font-size:40px;font-weight:800;color:#1a1a1a;line-height:1.0;letter-spacing:-.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><div style="width:28px;height:2px;background:${cs};border-radius:1px;"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cs};letter-spacing:2px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:18px;">${ekgLine(cp)}</div>
    <div style="margin-top:18px;">${ct}</div>
  </div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#f9fbf8;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="width:420px;height:600px;background:${cp};flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 36px;position:relative;overflow:hidden;">
    <div style="position:absolute;bottom:-20px;right:-20px;font-size:140px;color:rgba(255,255,255,.07);font-weight:900;line-height:1;user-select:none;">&#9829;</div>
    <div style="position:relative;z-index:1;margin-bottom:16px;">${ekgLine(cs)}</div>
    ${logo?`<div class="logo-area" style="position:relative;z-index:1;margin-bottom:14px;"><img src="${logo}" style="max-height:64px;max-width:200px;object-fit:contain;filter:brightness(0) invert(1);"></div>`:''}
    <div style="position:relative;z-index:1;font-size:${logo?'15px':'18px'};font-weight:700;color:#fff;letter-spacing:2px;text-transform:uppercase;text-align:center;line-height:1.4;">${emp}</div>
    ${d.texto_principal?`<div style="position:relative;z-index:1;margin-top:14px;font-size:12px;color:rgba(255,255,255,.75);text-align:center;font-style:italic;">"${esc(d.texto_principal)}"</div>`:''}
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cp},${cs});"></div>
    ${specsHtml?`<div style="margin-bottom:18px;">${specsHtml}</div>`:''}
    ${d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">${icoTel(cs)}<span style="font-size:13px;color:#333;font-weight:600;">${esc(d.telefone)}</span></div>`:''}
    ${d.email?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">${icoMail(cs)}<span style="font-size:12px;color:#555;">${esc(d.email)}</span></div>`:''}
    ${d.site?`<div style="display:flex;align-items:center;gap:10px;">${icoWeb(cs)}<span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:''}
  </div>
</div></div>`;
}

// ── tplSaude2: teal + navy, cross badge, specialties verso ──────────────────
function tplSaude2(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria||'#0d9488', cs=d.cor_secundaria||'#1e3a5f';
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const ct=[
    d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoTel(cp)}<span style="font-size:12px;color:#444;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">${icoMail(cp)}<span style="font-size:12px;color:#444;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:10px;">${icoWeb(cp)}<span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  const specs=(d.texto_secundario??'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean).slice(0,4);
  const specsHtml=specs.map(s=>`<div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;"><div style="width:16px;height:16px;border-radius:50%;background:${cp}22;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 10 10" style="width:10px;height:10px;" stroke="${cp}" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M2 5h6M5 2v6"/></svg></div><span style="font-size:12px;color:#333;">${esc(s)}</span></div>`).join('');
  return `<div style="display:flex;width:2100px;height:600px;font-family:'Poppins',sans-serif;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:-28px;left:-28px;width:110px;height:110px;border-radius:50%;background:${cp};z-index:1;display:flex;align-items:flex-end;justify-content:flex-end;padding:16px;">
    <svg viewBox="0 0 24 24" style="width:20px;height:20px;" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
  </div>
  <div style="position:absolute;top:0;right:0;width:320px;height:220px;background:${cs};clip-path:polygon(30% 0,100% 0,100% 100%,0 100%);z-index:1;overflow:hidden;">
    <div style="position:absolute;top:10px;left:60px;opacity:.18;">${ekgLine('#fff')}</div>
  </div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-46%,-52%);z-index:2;width:460px;">
    <div class="logo-area" style="margin-bottom:14px;">
      ${logo?`<img src="${logo}" style="max-height:80px;max-width:230px;object-fit:contain;">`:``}
    </div>
    <div class="nome-text" style="font-size:40px;font-weight:800;color:#1a1a1a;line-height:1.0;letter-spacing:-.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><div style="width:28px;height:2.5px;background:${cp};border-radius:1px;"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:4px;font-size:11px;color:#bbb;">${emp}</div>
  </div>
  <div style="position:absolute;bottom:28px;left:50%;transform:translateX(-46%);z-index:2;width:460px;">${ct}</div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${cp},${cs});z-index:3;"></div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="width:360px;height:600px;background:${cs};flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px;position:relative;overflow:hidden;">
    <div style="position:absolute;bottom:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.05);"></div>
    <div class="logo-area" style="position:relative;z-index:1;text-align:center;margin-bottom:18px;">
      ${logo?`<img src="${logo}" style="max-height:100px;max-width:230px;object-fit:contain;filter:brightness(0) invert(1);">`:`<div style="width:80px;height:80px;border-radius:50%;background:${cp};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:36px;font-weight:900;color:#fff;">${(d.empresa||'S').charAt(0)}</span></div>`}
    </div>
    <div style="position:relative;z-index:1;font-size:10px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:3px;text-transform:uppercase;text-align:center;">${emp}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:36px 44px;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cs},${cp});"></div>
    <div class="nome-text" style="font-size:22px;font-weight:800;color:#1a1a1a;margin-bottom:4px;">${nom}</div>
    <div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;">${car}</div>
    ${specsHtml?`<div style="margin-bottom:16px;">${specsHtml}</div>`:''}
    <div style="width:40px;height:1.5px;background:${cp}55;margin-bottom:16px;"></div>
    ${d.telefone?`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">${icoTel(cp)}<span style="font-size:12px;color:#333;font-weight:600;">${esc(d.telefone)}</span></div>`:''}
    ${d.email?`<div style="display:flex;align-items:center;gap:10px;">${icoMail(cp)}<span style="font-size:12px;color:#555;">${esc(d.email)}</span></div>`:''}
  </div>
</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ADESIVO REDONDO  800×800
// ════════════════════════════════════════════════════════════════════════════
function adRedondoMinimalista(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  return `<div style="width:800px;height:860px;background:#e8e8e8;display:flex;flex-direction:column;align-items:center;padding-top:20px;">
  <div style="width:760px;height:760px;border-radius:50%;background:${cp};overflow:hidden;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px;position:relative;">
    <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:700px;height:700px;border-radius:50%;border:1px solid rgba(255,255,255,.15);"></div>
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:160px;max-width:320px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:20px;position:relative;">`:''}
    <div style="font-size:${logo?'38px':'48px'};font-weight:800;color:#fff;letter-spacing:4px;text-transform:uppercase;position:relative;">${emp}</div>
  </div>
  ${tp?`<div style="margin-top:14px;font-size:11px;color:#888;letter-spacing:2.5px;text-transform:uppercase;text-align:center;">${tp}</div>`:''}
</div>`;
}

function adRedondoColorido(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  return `<div style="width:800px;height:860px;background:#f0f0f0;display:flex;flex-direction:column;align-items:center;padding-top:20px;">
  <div style="width:760px;height:760px;border-radius:50%;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);overflow:hidden;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px;position:relative;">
    <div style="position:absolute;width:680px;height:680px;border-radius:50%;border:2px solid rgba(255,255,255,.18);top:40px;left:40px;"></div>
    <div style="position:absolute;width:540px;height:540px;border-radius:50%;border:1px solid rgba(255,255,255,.10);top:110px;left:110px;"></div>
    <div style="position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.07);"></div>
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:130px;max-width:280px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:16px;position:relative;">`:''}
    <div style="font-size:${logo?'34px':'46px'};font-weight:900;color:#fff;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 16px rgba(0,0,0,.2);position:relative;">${emp}</div>
    ${d.site?`<div style="margin-top:18px;padding:6px 20px;background:rgba(255,255,255,.2);border-radius:30px;font-size:13px;color:rgba(255,255,255,.9);position:relative;">${esc(d.site)}</div>`:''}
  </div>
  ${tp?`<div style="margin-top:14px;font-size:11px;color:#888;letter-spacing:2.5px;text-transform:uppercase;text-align:center;">${tp}</div>`:''}
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ADESIVO RETANGULAR  1050×400
// ════════════════════════════════════════════════════════════════════════════
function adRetangularClean(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  return `<div style="width:1050px;height:400px;background:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;left:0;top:0;width:6px;height:100%;background:linear-gradient(180deg,${cp},${cs});"></div>
  <div style="position:absolute;right:0;top:0;width:220px;height:100%;background:${cp};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;">
    ${d.telefone?`<span style="color:#fff;font-size:13px;text-align:center;">${esc(d.telefone)}</span>`:''}
    ${d.site?`<span style="color:rgba(255,255,255,.8);font-size:12px;text-align:center;">${esc(d.site)}</span>`:''}
  </div>
  <div style="position:absolute;left:36px;top:50%;transform:translateY(-50%);right:240px;">
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:60px;max-width:180px;margin-bottom:12px;display:block;">`:''}
    <div style="font-size:${logo?'32px':'40px'};font-weight:800;color:#111;letter-spacing:1px;">${emp}</div>
    ${tp?`<div style="margin-top:8px;font-size:17px;color:#666;">${tp}</div>`:''}
  </div>
  <div style="position:absolute;right:220px;top:20%;width:1px;height:60%;background:${cp}33;"></div>
</div>`;
}

function adRetangularBold(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  return `<div style="width:1050px;height:400px;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;">
  <div style="position:absolute;right:-20px;top:-60px;font-size:480px;font-weight:900;color:rgba(255,255,255,.05);line-height:1;">${letra}</div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,.3);"></div>
  ${logo?`<div class="logo-area" style="position:absolute;top:30px;right:40px;"><img src="${logo}" style="max-height:50px;max-width:160px;filter:brightness(0) invert(1);"></div>`:''}
  <div style="position:absolute;left:50px;top:50%;transform:translateY(-50%);">
    <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;">${emp}</div>
    ${tp?`<div style="margin-top:10px;font-size:22px;color:rgba(255,255,255,.75);">${tp}</div>`:''}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// FLYER A5  750×1050
// ════════════════════════════════════════════════════════════════════════════
function flyerModerno(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons(cp);
  return `<div style="width:750px;height:1050px;background:#fff;position:relative;overflow:hidden;">
  <div style="width:750px;height:280px;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;">
    <div style="position:absolute;right:-60px;bottom:-80px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.10);"></div>
    <div style="position:absolute;right:60px;bottom:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.07);"></div>
    <div class="logo-area" style="position:absolute;top:24px;left:32px;">${logo?`<img src="${logo}" style="max-height:56px;max-width:180px;filter:brightness(0) invert(1);object-fit:contain;">`:`<span style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:3px;text-transform:uppercase;">${emp}</span>`}</div>
  </div>
  <div style="padding:36px 40px 0;">
    <div style="font-size:38px;font-weight:900;color:#111;line-height:1.1;">${tp||emp}</div>
    ${ts?`<div style="margin-top:16px;font-size:15px;color:#555;line-height:1.7;">${ts}</div>`:''}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 40px;border-top:2px solid ${cp}22;background:#fafafa;">
    <div style="font-size:14px;font-weight:700;color:${cp};">${emp}</div>
    <div style="display:flex;gap:20px;margin-top:8px;flex-wrap:wrap;">
      ${d.telefone?`<span style="display:flex;align-items:center;gap:6px;">${ico.tel}<span style="font-size:12px;color:#666;">${esc(d.telefone)}</span></span>`:''}
      ${d.email?`<span style="display:flex;align-items:center;gap:6px;">${ico.mail}<span style="font-size:12px;color:#666;">${esc(d.email)}</span></span>`:''}
      ${d.site?`<span style="display:flex;align-items:center;gap:6px;">${ico.web}<span style="font-size:12px;color:${cp};">${esc(d.site)}</span></span>`:''}
    </div>
  </div>
</div>`;
}

function flyerElegante(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  return `<div style="width:750px;height:1050px;background:linear-gradient(180deg,#fafafa,#f2f2f2);position:relative;overflow:hidden;">
  <div style="width:750px;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="text-align:center;padding:44px 50px 0;">
    ${logo?`<div class="logo-area" style="margin-bottom:16px;"><img src="${logo}" style="max-height:72px;max-width:220px;object-fit:contain;display:inline-block;"></div>`:''}
    ${!logo?`<div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:${cp};font-weight:600;margin-bottom:16px;">${emp}</div>`:''}
    <div style="width:40px;height:2px;background:${cp};margin:0 auto 28px;"></div>
    <div style="font-size:34px;font-weight:700;color:#1a1a1a;line-height:1.25;">${tp||emp}</div>
    ${ts?`<div style="margin-top:22px;font-size:15px;color:#666;line-height:1.75;text-align:left;">${ts}</div>`:''}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:130px;background:${cp};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
    ${!logo?`<div style="font-size:14px;font-weight:700;color:#fff;letter-spacing:2px;text-transform:uppercase;">${emp}</div>`:''}
    ${d.telefone?`<div style="color:rgba(255,255,255,.85);font-size:13px;">${esc(d.telefone)}</div>`:''}
    ${d.site?`<div style="color:rgba(255,255,255,.7);font-size:12px;">${esc(d.site)}</div>`:''}
  </div>
  <div style="position:absolute;right:-40px;top:200px;width:180px;height:180px;border-radius:50%;border:2px solid ${cp}22;"></div>
  <div style="position:absolute;left:-30px;bottom:200px;width:120px;height:120px;border-radius:50%;border:1px solid ${cs}33;"></div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// BANNER VERTICAL  600×1800
// ════════════════════════════════════════════════════════════════════════════
function bannerVerticalCorporativo(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons(cp);
  return `<div style="width:600px;height:1800px;background:#fff;position:relative;overflow:hidden;">
  <div style="width:600px;height:380px;background:linear-gradient(160deg,${cp},${cs});position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="position:absolute;right:-60px;bottom:-80px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.10);"></div>
    <div class="logo-area" style="margin-bottom:16px;">${logo?`<img src="${logo}" style="max-height:90px;max-width:280px;filter:brightness(0) invert(1);object-fit:contain;">`:`<div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;">${emp}</div>`}</div>
    <div style="font-size:15px;font-weight:300;color:rgba(255,255,255,.75);letter-spacing:3px;text-transform:uppercase;">${emp}</div>
  </div>
  <div style="padding:50px 44px;">
    <div style="font-size:42px;font-weight:800;color:#111;line-height:1.1;">${tp||'Bem-vindo!'}</div>
    ${ts?`<div style="margin-top:20px;font-size:16px;color:#666;line-height:1.75;">${ts}</div>`:''}
    <div style="margin-top:50px;width:40px;height:3px;background:${cp};"></div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:36px 44px;background:${cp}0a;border-top:2px solid ${cp}22;">
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${d.telefone?`<div style="display:flex;align-items:center;gap:12px;">${ico.tel}<span style="font-size:15px;color:#444;">${esc(d.telefone)}</span></div>`:''}
      ${d.email?`<div style="display:flex;align-items:center;gap:12px;">${ico.mail}<span style="font-size:14px;color:#444;">${esc(d.email)}</span></div>`:''}
      ${d.site?`<div style="display:flex;align-items:center;gap:12px;">${ico.web}<span style="font-size:14px;color:${cp};">${esc(d.site)}</span></div>`:''}
    </div>
  </div>
</div>`;
}

function bannerVerticalVibrante(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  return `<div style="width:600px;height:1800px;background:linear-gradient(180deg,${cp} 0%,${cs} 60%,#0a0a14 100%);position:relative;overflow:hidden;">
  <div style="position:absolute;top:-120px;left:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
  <div style="position:absolute;top:100px;right:-100px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.05);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,.4);"></div>
  <div class="logo-area" style="position:absolute;top:50px;left:50%;transform:translateX(-50%);">${logo?`<img src="${logo}" style="max-height:80px;max-width:260px;filter:brightness(0) invert(1);object-fit:contain;">`:`<span style="font-size:15px;font-weight:700;color:rgba(255,255,255,.8);letter-spacing:4px;text-transform:uppercase;">${emp}</span>`}</div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:500px;">
    <div style="font-size:56px;font-weight:900;color:#fff;line-height:1.05;text-shadow:0 4px 24px rgba(0,0,0,.3);">${tp||emp}</div>
    ${ts?`<div style="margin-top:22px;font-size:16px;color:rgba(255,255,255,.78);line-height:1.65;">${ts}</div>`:''}
  </div>
  <div style="position:absolute;bottom:60px;left:50%;transform:translateX(-50%);text-align:center;">
    ${d.telefone?`<div style="font-size:15px;color:rgba(255,255,255,.85);margin-bottom:8px;">${esc(d.telefone)}</div>`:''}
    ${d.site?`<div style="padding:10px 28px;border:1.5px solid rgba(255,255,255,.5);border-radius:40px;display:inline-block;font-size:14px;color:#fff;">${esc(d.site)}</div>`:''}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// BANNER HORIZONTAL  1800×600
// ════════════════════════════════════════════════════════════════════════════
function bannerHorizontalClean(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons(cp);
  return `<div style="width:1800px;height:600px;background:#fff;position:relative;overflow:hidden;display:flex;">
  <div style="width:340px;height:600px;background:linear-gradient(180deg,${cp},${cs});flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 24px;text-align:center;">
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:80px;max-width:240px;filter:brightness(0) invert(1);object-fit:contain;">`:''}
    <div style="font-size:${logo?'12px':'16px'};font-weight:700;color:rgba(255,255,255,.88);letter-spacing:3px;text-transform:uppercase;line-height:1.5;">${emp}</div>
  </div>
  <div style="flex:1;padding:50px 60px;position:relative;">
    <div style="font-size:52px;font-weight:900;color:#111;line-height:1.05;">${tp||emp}</div>
    ${ts?`<div style="margin-top:16px;font-size:17px;color:#666;line-height:1.6;max-width:900px;">${ts}</div>`:''}
    <div style="position:absolute;bottom:40px;left:60px;display:flex;gap:30px;align-items:center;">
      ${d.telefone?`<span style="display:flex;align-items:center;gap:8px;">${ico.tel}<span style="font-size:14px;color:#555;">${esc(d.telefone)}</span></span>`:''}
      ${d.email?`<span style="display:flex;align-items:center;gap:8px;">${ico.mail}<span style="font-size:14px;color:#555;">${esc(d.email)}</span></span>`:''}
      ${d.site?`<span style="display:flex;align-items:center;gap:8px;">${ico.web}<span style="font-size:14px;color:${cp};">${esc(d.site)}</span></span>`:''}
    </div>
  </div>
  <div style="position:absolute;right:-80px;top:-80px;width:400px;height:400px;border-radius:50%;border:2px solid ${cp}11;"></div>
</div>`;
}

function bannerHorizontalImpactante(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  return `<div style="width:1800px;height:600px;background:linear-gradient(135deg,#0d0d0d 0%,#1a1a2e 100%);position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;right:0;width:700px;height:100%;background:linear-gradient(160deg,${cp},${cs});clip-path:polygon(18% 0%,100% 0%,100% 100%,0% 100%);"></div>
  <div style="position:absolute;bottom:-40px;left:60px;font-size:540px;font-weight:900;color:rgba(255,255,255,.03);line-height:1;">${letra}</div>
  <div style="position:absolute;top:32px;left:60px;display:flex;gap:8px;">
    <div style="width:10px;height:10px;border-radius:50%;background:${cp};"></div>
    <div style="width:10px;height:10px;border-radius:50%;background:${cs}88;"></div>
    <div style="width:10px;height:10px;border-radius:50%;background:${cp}44;"></div>
  </div>
  ${logo?`<div class="logo-area" style="position:absolute;top:30px;right:60px;"><img src="${logo}" style="max-height:60px;max-width:200px;filter:brightness(0) invert(1);object-fit:contain;"></div>`:''}
  <div style="position:absolute;top:50%;left:60px;transform:translateY(-55%);max-width:900px;">
    <div style="font-size:64px;font-weight:900;color:#fff;line-height:1;letter-spacing:-2px;">${tp||emp}</div>
    ${ts?`<div style="margin-top:16px;font-size:18px;color:rgba(255,255,255,.65);">${ts}</div>`:''}
  </div>
  <div style="position:absolute;bottom:36px;left:60px;display:flex;gap:30px;">
    ${d.telefone?`<span style="font-size:14px;color:rgba(255,255,255,.7);">${esc(d.telefone)}</span>`:''}
    ${d.site?`<span style="font-size:14px;color:${cp};">${esc(d.site)}</span>`:''}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// PANFLETO FRENTE + VERSO  1050×1500 cada  → produto: 2100×1500
// ════════════════════════════════════════════════════════════════════════════
function panfletoModerno(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons(cp);
  return `<div style="display:flex;width:2100px;height:1500px;">
<div id="frente" style="width:1050px;height:1500px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="width:1050px;height:360px;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;">
    <div style="position:absolute;right:-80px;bottom:-100px;width:360px;height:360px;border-radius:50%;background:rgba(255,255,255,.10);"></div>
    <div class="logo-area" style="position:absolute;top:32px;left:44px;">${logo?`<img src="${logo}" style="max-height:72px;max-width:240px;filter:brightness(0) invert(1);object-fit:contain;">`:`<span style="font-size:16px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:3px;text-transform:uppercase;">${emp}</span>`}</div>
    <div style="position:absolute;bottom:40px;left:44px;right:44px;">
      <div style="font-size:44px;font-weight:900;color:#fff;line-height:1.1;">${tp||emp}</div>
    </div>
  </div>
  <div style="padding:44px;">
    ${ts?`<div style="font-size:16px;color:#555;line-height:1.8;">${ts}</div>`:''}
    <div style="margin-top:40px;width:40px;height:3px;background:${cp};"></div>
    <div style="margin-top:24px;font-size:15px;color:#333;font-weight:600;">${emp}</div>
    ${d.telefone?`<div style="margin-top:10px;font-size:14px;color:#666;">${esc(d.telefone)}</div>`:''}
    ${d.email?`<div style="margin-top:6px;font-size:14px;color:#666;">${esc(d.email)}</div>`:''}
    ${d.site?`<div style="margin-top:6px;font-size:14px;color:${cp};">${esc(d.site)}</div>`:''}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:linear-gradient(90deg,${cp},${cs});"></div>
</div>
<div id="verso" style="width:1050px;height:1500px;background:linear-gradient(160deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:-150px;right:-100px;width:500px;height:500px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
  <div style="position:absolute;bottom:-100px;left:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.06);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:900px;height:900px;border-radius:50%;border:1px solid rgba(255,255,255,.10);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;padding:0 80px;">
    ${logo?`<div class="logo-area" style="margin-bottom:32px;"><img src="${logo}" style="max-height:120px;max-width:320px;filter:brightness(0) invert(1);display:inline-block;object-fit:contain;"></div>`:''}
    <div style="font-size:${logo?'32px':'48px'};font-weight:800;color:#fff;letter-spacing:5px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.telefone?`<div style="margin-top:24px;font-size:17px;color:rgba(255,255,255,.8);">${esc(d.telefone)}</div>`:''}
    ${d.email?`<div style="margin-top:10px;font-size:15px;color:rgba(255,255,255,.7);">${esc(d.email)}</div>`:''}
    ${d.site?`<div style="margin-top:16px;display:inline-block;padding:10px 30px;border:1.5px solid rgba(255,255,255,.5);border-radius:40px;font-size:14px;color:#fff;">${esc(d.site)}</div>`:''}
  </div>
</div></div>`;
}

function panfletoElegante(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons('#777');
  return `<div style="display:flex;width:2100px;height:1500px;">
<div id="frente" style="width:1050px;height:1500px;background:linear-gradient(180deg,#fafafa,#efefef);position:relative;overflow:hidden;flex-shrink:0;">
  <div style="width:1050px;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="text-align:center;padding:52px 60px 0;">
    ${logo?`<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:80px;max-width:260px;display:inline-block;object-fit:contain;"></div>`:''}
    ${!logo?`<div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:${cp};font-weight:600;margin-bottom:20px;">${emp}</div>`:''}
    <div style="width:44px;height:2px;background:${cp};margin:0 auto 32px;"></div>
    <div style="font-size:38px;font-weight:700;color:#1a1a1a;line-height:1.25;text-align:left;">${tp||emp}</div>
    ${ts?`<div style="margin-top:24px;font-size:15px;color:#666;line-height:1.8;text-align:left;">${ts}</div>`:''}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:32px 60px;background:#fff;border-top:1px solid #e0e0e0;">
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${d.telefone?`<div style="display:flex;align-items:center;gap:10px;">${ico.tel}<span style="font-size:14px;color:#555;">${esc(d.telefone)}</span></div>`:''}
      ${d.email?`<div style="display:flex;align-items:center;gap:10px;">${ico.mail}<span style="font-size:14px;color:#555;">${esc(d.email)}</span></div>`:''}
      ${d.site?`<div style="display:flex;align-items:center;gap:10px;">${ico.web}<span style="font-size:14px;color:${cp};">${esc(d.site)}</span></div>`:''}
    </div>
  </div>
</div>
<div id="verso" style="width:1050px;height:1500px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;border-left:1px solid #e8e8e8;">
  <div style="width:1050px;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="width:1050px;height:280px;background:${cp};position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:80px;max-width:260px;filter:brightness(0) invert(1);object-fit:contain;">`:`<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;">${emp}</div>`}
  </div>
  <div style="padding:44px 60px;">
    <div style="font-size:24px;font-weight:700;color:#111;margin-bottom:16px;">Sobre nós</div>
    ${ts?`<div style="font-size:15px;color:#666;line-height:1.8;">${ts}</div>`:'<div style="font-size:15px;color:#aaa;line-height:1.8;">Entre em contato para saber mais sobre nossos produtos e serviços.</div>'}
    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #eee;">
      <div style="font-size:14px;font-weight:600;color:${cp};margin-bottom:12px;">${emp}</div>
      ${d.telefone?`<div style="font-size:14px;color:#666;margin-bottom:6px;">${esc(d.telefone)}</div>`:''}
      ${d.email?`<div style="font-size:14px;color:#666;margin-bottom:6px;">${esc(d.email)}</div>`:''}
      ${d.site?`<div style="font-size:14px;color:${cp};">${esc(d.site)}</div>`:''}
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// CANECA  2100×800 (área de impressão lateral)
// ════════════════════════════════════════════════════════════════════════════
function canecaBasico(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal);
  return `<div style="width:2100px;height:800px;background:#fff;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
  <div style="width:4px;height:100%;background:linear-gradient(180deg,${cp},${cs});position:absolute;left:0;top:0;"></div>
  <div style="width:4px;height:100%;background:linear-gradient(180deg,${cp},${cs});position:absolute;right:0;top:0;"></div>
  <div style="width:1px;height:100%;background:${cp}22;position:absolute;left:50%;top:0;"></div>
  <div style="text-align:center;max-width:1600px;padding:0 100px;">
    ${logo?`<div class="logo-area" style="margin-bottom:28px;"><img src="${logo}" style="max-height:140px;max-width:400px;object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'64px':'80px'};font-weight:900;color:#111;letter-spacing:6px;text-transform:uppercase;line-height:1.05;">${emp}</div>
    ${tp?`<div style="margin-top:20px;font-size:28px;color:#555;letter-spacing:2px;">${tp}</div>`:''}
    <div style="margin-top:24px;display:flex;align-items:center;justify-content:center;gap:20px;">
      <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,${cp});"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:${cp};"></div>
      <div style="width:80px;height:2px;background:linear-gradient(90deg,${cp},transparent);"></div>
    </div>
  </div>
</div>`;
}

function canecaColorido(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal);
  return `<div style="width:2100px;height:800px;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
  <div style="position:absolute;top:-150px;left:-150px;width:600px;height:600px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
  <div style="position:absolute;bottom:-150px;right:-150px;width:600px;height:600px;border-radius:50%;background:rgba(255,255,255,.06);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,.35);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,.35);"></div>
  <div style="text-align:center;max-width:1600px;padding:0 100px;position:relative;">
    ${logo?`<div class="logo-area" style="margin-bottom:28px;"><img src="${logo}" style="max-height:140px;max-width:400px;filter:brightness(0) invert(1);object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'60px':'80px'};font-weight:900;color:#fff;letter-spacing:6px;text-transform:uppercase;text-shadow:0 4px 20px rgba(0,0,0,.2);">${emp}</div>
    ${tp?`<div style="margin-top:18px;font-size:26px;color:rgba(255,255,255,.80);letter-spacing:2px;">${tp}</div>`:''}
    <div style="margin-top:24px;display:flex;align-items:center;justify-content:center;gap:20px;">
      <div style="width:100px;height:2px;background:rgba(255,255,255,.4);"></div>
      <div style="width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.9);"></div>
      <div style="width:100px;height:2px;background:rgba(255,255,255,.4);"></div>
    </div>
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// CAMISETA  1200×1200 (área de estampa)
// ════════════════════════════════════════════════════════════════════════════
function camisetaBasico(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal);
  return `<div style="width:1200px;height:1200px;background:#fff;position:relative;display:flex;align-items:center;justify-content:center;">
  <div style="text-align:center;padding:40px;">
    ${logo?`<div class="logo-area" style="margin-bottom:32px;"><img src="${logo}" style="max-height:280px;max-width:600px;object-fit:contain;display:inline-block;"></div>`:''}
    ${!logo?`<div style="width:80px;height:4px;background:linear-gradient(90deg,${cp},${cs});margin:0 auto 32px;border-radius:2px;"></div>`:''}
    <div style="font-size:${logo?'72px':'96px'};font-weight:900;color:#111;letter-spacing:${logo?'4px':'6px'};text-transform:uppercase;line-height:1.0;">${emp}</div>
    ${tp?`<div style="margin-top:16px;font-size:32px;color:#555;letter-spacing:4px;text-transform:uppercase;">${tp}</div>`:''}
    ${!logo?`<div style="margin-top:24px;display:flex;align-items:center;justify-content:center;gap:12px;"><div style="width:60px;height:2px;background:${cp};"></div><div style="width:8px;height:8px;border-radius:50%;background:${cp};"></div><div style="width:60px;height:2px;background:${cp};"></div></div>`:''}
  </div>
</div>`;
}

function camisetaBold(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  return `<div style="width:1200px;height:1200px;background:#0d0d0d;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
  <div style="position:absolute;font-size:900px;font-weight:900;color:rgba(255,255,255,.03);line-height:1;top:50%;left:50%;transform:translate(-50%,-50%);">${letra}</div>
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cs},${cp});"></div>
  <div style="text-align:center;position:relative;padding:40px;">
    ${logo?`<div class="logo-area" style="margin-bottom:30px;"><img src="${logo}" style="max-height:220px;max-width:500px;filter:brightness(0) invert(1);object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'68px':'90px'};font-weight:900;color:#fff;letter-spacing:${logo?'4px':'8px'};text-transform:uppercase;line-height:1.0;text-shadow:0 4px 30px rgba(0,0,0,.5);">${emp}</div>
    ${tp?`<div style="margin-top:14px;font-size:28px;color:${cp};letter-spacing:4px;text-transform:uppercase;">${tp}</div>`:''}
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ENVELOPE A4  1240×877
// ════════════════════════════════════════════════════════════════════════════
function envelopeFormal(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const ico=icons(cp);
  return `<div style="width:1240px;height:877px;background:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${cs},${cp});"></div>
  <div style="position:absolute;left:0;top:0;width:5px;height:100%;background:linear-gradient(180deg,${cp},${cs});"></div>
  <div style="display:flex;align-items:flex-start;padding:50px 60px;gap:60px;">
    <div style="min-width:280px;">
      ${logo?`<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:80px;max-width:220px;object-fit:contain;display:block;"></div>`:''}
      ${!logo?`<div style="font-size:20px;font-weight:800;color:${cp};letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">${emp}</div>`:''}
      ${logo?`<div style="font-size:14px;font-weight:700;color:#333;margin-bottom:12px;">${emp}</div>`:''}
      ${d.nome?`<div style="font-size:13px;color:#555;margin-bottom:4px;">${esc(d.nome)}${d.cargo?`, ${esc(d.cargo)}`:''}</div>`:''}
      ${d.telefone?`<div style="display:flex;align-items:center;gap:8px;margin-top:10px;">${ico.tel}<span style="font-size:13px;color:#555;">${esc(d.telefone)}</span></div>`:''}
      ${d.email?`<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">${ico.mail}<span style="font-size:13px;color:#555;">${esc(d.email)}</span></div>`:''}
      ${d.site?`<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">${ico.web}<span style="font-size:13px;color:${cp};">${esc(d.site)}</span></div>`:''}
    </div>
    <div style="flex:1;border-left:1px solid #e8e8e8;padding-left:60px;margin-top:6px;">
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-bottom:14px;">Destinatário</div>
      <div style="width:320px;height:1px;background:#e0e0e0;margin-bottom:36px;"></div>
      <div style="width:280px;height:1px;background:#e8e8e8;margin-bottom:24px;"></div>
      <div style="width:260px;height:1px;background:#e8e8e8;margin-bottom:24px;"></div>
      <div style="width:220px;height:1px;background:#e8e8e8;"></div>
    </div>
  </div>
  <div style="position:absolute;bottom:60px;right:60px;text-align:right;">
    <div style="width:80px;height:80px;border:1px solid #e0e0e0;display:flex;align-items:center;justify-content:center;margin-left:auto;">
      <div style="font-size:9px;color:#ccc;letter-spacing:1px;text-align:center;">SELO</div>
    </div>
  </div>
</div>`;
}

function envelopeModerno(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const ico=icons('#fff');
  return `<div style="width:1240px;height:877px;background:#fff;position:relative;overflow:hidden;">
  <div style="width:340px;height:877px;background:linear-gradient(180deg,${cp},${cs});position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px;">
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:80px;max-width:220px;filter:brightness(0) invert(1);object-fit:contain;">`:''}
    <div style="font-size:${logo?'12px':'18px'};font-weight:700;color:rgba(255,255,255,.88);letter-spacing:3px;text-transform:uppercase;text-align:center;line-height:1.5;">${emp}</div>
    <div style="width:40px;height:2px;background:rgba(255,255,255,.4);"></div>
    ${d.telefone?`<div style="display:flex;align-items:center;gap:8px;">${ico.tel}<span style="font-size:12px;color:rgba(255,255,255,.8);">${esc(d.telefone)}</span></div>`:''}
    ${d.email?`<div style="display:flex;align-items:center;gap:8px;">${ico.mail}<span style="font-size:12px;color:rgba(255,255,255,.75);">${esc(d.email)}</span></div>`:''}
    ${d.site?`<div style="display:flex;align-items:center;gap:8px;">${ico.web}<span style="font-size:12px;color:rgba(255,255,255,.7);">${esc(d.site)}</span></div>`:''}
  </div>
  <div style="position:absolute;left:340px;top:0;right:0;height:877px;padding:60px;">
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-bottom:20px;">Destinatário</div>
    <div style="width:380px;height:1px;background:#e0e0e0;margin-bottom:40px;"></div>
    <div style="display:flex;flex-direction:column;gap:22px;">
      <div style="width:300px;height:1px;background:#e8e8e8;"></div>
      <div style="width:280px;height:1px;background:#e8e8e8;"></div>
      <div style="width:260px;height:1px;background:#e8e8e8;"></div>
    </div>
    <div style="position:absolute;bottom:40px;right:40px;width:80px;height:80px;border:1px solid #e0e0e0;display:flex;align-items:center;justify-content:center;">
      <div style="font-size:9px;color:#ccc;letter-spacing:1px;text-align:center;">SELO</div>
    </div>
  </div>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// FOLDER A4 DOBRADO  2480×1748  (bi-fold: capa + interior)
// ════════════════════════════════════════════════════════════════════════════
function folderCorporativo(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const ico=icons(cp);
  return `<div style="display:flex;width:2480px;height:1748px;">
<div id="frente" style="width:1240px;height:1748px;background:linear-gradient(160deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:-160px;right:-120px;width:600px;height:600px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
  <div style="position:absolute;bottom:-200px;left:-120px;width:700px;height:700px;border-radius:50%;background:rgba(255,255,255,.06);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:1100px;height:1100px;border-radius:50%;border:1px solid rgba(255,255,255,.10);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-58%);text-align:center;padding:0 100px;">
    ${logo?`<div class="logo-area" style="margin-bottom:36px;"><img src="${logo}" style="max-height:140px;max-width:400px;filter:brightness(0) invert(1);display:inline-block;object-fit:contain;"></div>`:''}
    <div style="font-size:${logo?'48px':'64px'};font-weight:800;color:#fff;letter-spacing:6px;text-transform:uppercase;text-shadow:0 4px 20px rgba(0,0,0,.2);">${emp.toUpperCase()}</div>
    ${tp?`<div style="margin-top:24px;font-size:22px;color:rgba(255,255,255,.75);letter-spacing:1px;">${tp}</div>`:''}
  </div>
  <div style="position:absolute;bottom:60px;left:60px;right:60px;text-align:center;border-top:1px solid rgba(255,255,255,.2);padding-top:28px;">
    ${d.site?`<div style="font-size:15px;color:rgba(255,255,255,.7);">${esc(d.site)}</div>`:''}
  </div>
</div>
<div id="verso" style="width:1240px;height:1748px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;border-left:1px solid #e0e0e0;">
  <div style="width:1240px;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="padding:70px 80px;">
    <div style="font-size:38px;font-weight:700;color:#111;margin-bottom:24px;">${tp||'Sobre nós'}</div>
    <div style="width:44px;height:3px;background:${cp};margin-bottom:32px;"></div>
    ${ts?`<div style="font-size:16px;color:#555;line-height:1.85;">${ts}</div>`:'<div style="font-size:16px;color:#aaa;line-height:1.85;">Somos uma empresa comprometida com qualidade e excelência no atendimento aos nossos clientes.</div>'}
    <div style="margin-top:60px;padding-top:40px;border-top:1px solid #eee;">
      <div style="font-size:16px;font-weight:700;color:${cp};margin-bottom:20px;">${emp}</div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${d.telefone?`<div style="display:flex;align-items:center;gap:12px;">${ico.tel}<span style="font-size:15px;color:#444;">${esc(d.telefone)}</span></div>`:''}
        ${d.email?`<div style="display:flex;align-items:center;gap:12px;">${ico.mail}<span style="font-size:15px;color:#444;">${esc(d.email)}</span></div>`:''}
        ${d.site?`<div style="display:flex;align-items:center;gap:12px;">${ico.web}<span style="font-size:15px;color:${cp};">${esc(d.site)}</span></div>`:''}
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
</div></div>`;
}

function folderCriativo(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa);
  const tp=esc(d.texto_principal), ts=esc(d.texto_secundario);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  const ico=icons('#666');
  return `<div style="display:flex;width:2480px;height:1748px;">
<div id="frente" style="width:1240px;height:1748px;background:#0d0d0d;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:0;right:0;width:700px;height:100%;background:linear-gradient(160deg,${cp},${cs});clip-path:polygon(20% 0%,100% 0%,100% 100%,0% 100%);"></div>
  <div style="position:absolute;bottom:-40px;left:40px;font-size:800px;font-weight:900;color:rgba(255,255,255,.03);line-height:1;">${letra}</div>
  <div style="position:absolute;top:60px;left:60px;display:flex;gap:10px;"><div style="width:12px;height:12px;border-radius:50%;background:${cp};"></div><div style="width:12px;height:12px;border-radius:50%;background:${cs}88;"></div><div style="width:12px;height:12px;border-radius:50%;background:${cp}44;"></div></div>
  ${logo?`<div class="logo-area" style="position:absolute;top:50px;right:60px;"><img src="${logo}" style="max-height:72px;max-width:240px;filter:brightness(0) invert(1);object-fit:contain;"></div>`:''}
  <div style="position:absolute;top:50%;left:60px;transform:translateY(-55%);max-width:900px;">
    <div style="font-size:72px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-2px;">${tp||emp}</div>
    <div style="margin-top:20px;display:flex;align-items:center;gap:16px;"><div style="width:60px;height:4px;background:linear-gradient(90deg,${cp},${cs});border-radius:2px;"></div><div style="font-size:14px;color:${cp};letter-spacing:3px;text-transform:uppercase;">${emp}</div></div>
  </div>
  <div style="position:absolute;bottom:60px;left:60px;right:60px;border-top:1px solid rgba(255,255,255,.1);padding-top:24px;">
    ${d.site?`<span style="font-size:14px;color:rgba(255,255,255,.5);">${esc(d.site)}</span>`:''}
  </div>
</div>
<div id="verso" style="width:1240px;height:1748px;background:linear-gradient(180deg,#fafafa,#f2f2f2);position:relative;overflow:hidden;flex-shrink:0;">
  <div style="width:1240px;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="padding:70px 80px;">
    <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${cp};font-weight:600;margin-bottom:20px;">${emp}</div>
    <div style="font-size:38px;font-weight:700;color:#1a1a1a;margin-bottom:28px;">Sobre nossos serviços</div>
    <div style="width:44px;height:2px;background:${cp};margin-bottom:32px;"></div>
    ${ts?`<div style="font-size:16px;color:#555;line-height:1.85;">${ts}</div>`:'<div style="font-size:16px;color:#aaa;line-height:1.85;">Qualidade e excelência em cada detalhe.</div>'}
    <div style="margin-top:60px;padding-top:40px;border-top:1px solid #ddd;">
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${d.telefone?`<div style="display:flex;align-items:center;gap:12px;">${ico.tel}<span style="font-size:15px;color:#444;">${esc(d.telefone)}</span></div>`:''}
        ${d.email?`<div style="display:flex;align-items:center;gap:12px;">${ico.mail}<span style="font-size:15px;color:#444;">${esc(d.email)}</span></div>`:''}
        ${d.site?`<div style="display:flex;align-items:center;gap:12px;">${ico.web}<span style="font-size:15px;color:${cp};">${esc(d.site)}</span></div>`:''}
      </div>
    </div>
  </div>
</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// OVERLAY SIMPLES — texto centralizado sobre ilustração de fundo
// ════════════════════════════════════════════════════════════════════════════
function posicaoOverlayTexto(obs: string): 'flex-start' | 'center' | 'flex-end' {
  const o = (obs || '').toLowerCase();
  if (o.match(/inferior|baixo|bottom|rodap[eé]|base\s+da/)) return 'flex-end';
  if (o.match(/cent(ro|er|ral)|meio|middle/)) return 'center';
  return 'flex-start'; // padrão: topo — melhor para ilustrações com personagem no centro
}

function tplOverlaySimples(d: ProdutoInput, w: number, h: number): string {
  const cp      = d.cor_primaria;
  const emp     = esc(d.empresa || d.nome || '');
  const tp      = esc(d.texto_principal || '');
  const ts      = esc(d.texto_secundario || '');
  const base    = Math.min(w, h);
  const sh      = '0 2px 24px rgba(0,0,0,.98),0 0 60px rgba(0,0,0,.8)';
  const shSm    = '0 1px 12px rgba(0,0,0,.98)';
  const fsEmp   = Math.round(base * 0.055);
  const fsMain  = Math.round(base * (tp ? 0.085 : 0.07));
  const fsSub   = Math.round(base * 0.036);
  const fsCtx   = Math.round(base * 0.028);
  const sp      = (n: number) => `${Math.round(base * n)}px`;

  // Posicionamento: topo por padrão (personagens ficam no centro livre),
  // ou conforme instrução em observacoes
  const justify = posicaoOverlayTexto(d.observacoes ?? '');
  const padPx   = Math.round(h * 0.05);
  const padStyle = justify === 'flex-start' ? `padding-top:${padPx}px;padding-bottom:0;`
                 : justify === 'flex-end'   ? `padding-bottom:${padPx}px;padding-top:0;`
                 : '';

  const contacts = [
    d.telefone ? `<div style="font-size:${fsCtx}px;color:rgba(255,255,255,.88);text-shadow:${shSm};margin-top:${sp(.012)};">${esc(d.telefone)}</div>` : '',
    d.email    ? `<div style="font-size:${fsCtx}px;color:rgba(255,255,255,.75);text-shadow:${shSm};margin-top:${sp(.007)};">${esc(d.email)}</div>` : '',
    d.site     ? `<div style="font-size:${fsCtx}px;color:${cp};text-shadow:${shSm};margin-top:${sp(.007)};">${esc(d.site)}</div>` : '',
  ].filter(Boolean).join('');

  return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:${justify};text-align:center;padding:0 ${sp(.07)};${padStyle}position:relative;z-index:2;box-sizing:border-box;">
  ${emp && tp  ? `<div style="font-size:${fsEmp}px;font-weight:700;color:rgba(255,255,255,.82);letter-spacing:3px;text-transform:uppercase;text-shadow:${sh};margin-bottom:${sp(.018)};">${emp}</div>` : ''}
  ${emp && !tp ? `<div style="font-size:${fsMain}px;font-weight:900;color:#fff;letter-spacing:4px;text-transform:uppercase;text-shadow:${sh};line-height:1.1;">${emp}</div>` : ''}
  ${tp         ? `<div style="font-size:${fsMain}px;font-weight:900;color:#fff;line-height:1.1;text-shadow:${sh};">${tp}</div>` : ''}
  ${ts         ? `<div style="margin-top:${sp(.025)};font-size:${fsSub}px;font-weight:400;color:rgba(255,255,255,.80);text-shadow:${shSm};line-height:1.45;">${ts}</div>` : ''}
  ${contacts   ? `<div style="margin-top:${sp(.03)};">${contacts}</div>` : ''}
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ROTEADOR PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
interface RenderResult { html: string; w: number; h: number; fullDoc?: boolean; }

function normalizarTipo(t: string): string {
  const m: Record<string,string> = {
    'cartao_visita':'cartao_visita','cartão de visita':'cartao_visita','cartao de visita':'cartao_visita',
    'adesivo_redondo':'adesivo_redondo','adesivo redondo':'adesivo_redondo',
    'adesivo_retangular':'adesivo_retangular','adesivo retangular':'adesivo_retangular',
    'flyer_a5':'flyer_a5','flyer':'flyer_a5','flyer a5':'flyer_a5',
    'banner_vertical':'banner_vertical','banner vertical':'banner_vertical',
    'banner_horizontal':'banner_horizontal','banner horizontal':'banner_horizontal',
    'panfleto':'panfleto','panfleto frente e verso':'panfleto','folheto':'panfleto',
    'caneca':'caneca',
    'camiseta':'camiseta',
    'envelope_a4':'envelope_a4','envelope':'envelope_a4','envelope a4':'envelope_a4',
    'folder_a4':'folder_a4','folder':'folder_a4','folder a4':'folder_a4',
  };
  return m[(t||'').toLowerCase().trim()] ?? 'cartao_visita';
}

function tplCartaoPremium(d: ProdutoInput, logo: string): string {
  const cp = d.cor_primaria || '#0A1628';
  const cs = d.cor_secundaria || '#F87A13';
  const nome = (d.nome || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cargo = (d.cargo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const empresa = (d.empresa || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const telefone = (d.telefone || '').replace(/&/g,'&amp;');
  const email = (d.email || '').replace(/&/g,'&amp;');
  const site = (d.site || '').replace(/&/g,'&amp;');
  const nomeSize = nome.length > 24 ? 44 : nome.length > 18 ? 50 : 56;
  const empresaSize = empresa.length > 20 ? 48 : empresa.length > 12 ? 62 : 76;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #1a1a1a; font-family: Montserrat, Arial, Helvetica, sans-serif; }
#canvas { width: 2100px; height: 600px; position: relative; overflow: hidden; }
</style>
</head>
<body>
<div id="canvas">

  <!-- FRENTE: 0px → 1050px — logo grande centralizado -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;background:#FFFFFF;overflow:hidden;">

    <!-- Faixa diagonal laranja base -->
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:110px;overflow:hidden;">
      <div style="position:absolute;left:-60px;bottom:-55px;width:1200px;height:150px;background:${cs};transform:rotate(-4deg);transform-origin:left bottom;"></div>
    </div>
    <!-- Faixa diagonal azul sobre laranja -->
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:82px;overflow:hidden;">
      <div style="position:absolute;left:-60px;bottom:-45px;width:1200px;height:110px;background:${cp};transform:rotate(-4deg);transform-origin:left bottom;opacity:0.93;"></div>
    </div>

    <!-- SVG Circuitos canto superior direito -->
    <svg style="position:absolute;top:0;right:0;width:280px;height:240px;opacity:0.06;" viewBox="0 0 280 240" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${cp}" stroke-width="1.5" fill="none">
        <path d="M280,0 L280,70 L210,70 L210,30 L150,30 L150,90 L230,90 L230,150"/>
        <path d="M280,110 L240,110 L240,170 L180,170 L180,130 L120,130"/>
        <circle cx="210" cy="70" r="4" fill="${cp}"/>
        <circle cx="150" cy="30" r="4" fill="${cp}"/>
        <circle cx="240" cy="170" r="4" fill="${cp}"/>
        <rect x="198" y="58" width="24" height="24" rx="3" stroke="${cp}" stroke-width="1.5" fill="none"/>
      </g>
    </svg>

    <!-- SVG Circuitos canto inferior esquerdo -->
    <svg style="position:absolute;bottom:0;left:0;width:220px;height:180px;opacity:0.07;" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${cp}" stroke-width="1.5" fill="none">
        <path d="M0,180 L0,110 L50,110 L50,150 L100,150 L100,100 L50,100 L50,60"/>
        <path d="M0,80 L40,80 L40,40 L90,40 L90,80 L140,80"/>
        <circle cx="50" cy="110" r="4" fill="${cp}"/>
        <circle cx="100" cy="150" r="4" fill="${cp}"/>
        <rect x="38" y="98" width="24" height="24" rx="3" stroke="${cp}" stroke-width="1.5" fill="none"/>
      </g>
    </svg>

    <!-- LOGO grande centralizado na frente -->
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-58%);text-align:center;">
      ${logo
        ? `<img src="${logo}" style="max-width:420px;max-height:240px;object-fit:contain;display:block;margin:0 auto;">`
        : `<div style="text-align:center;">
             <div style="font-size:${empresaSize}px;font-weight:900;color:${cp};letter-spacing:-2px;line-height:1;">${empresa}</div>
           </div>`
      }
      ${''}
    </div>

    <!-- Pontos decorativos centralizados -->
    <div style="position:absolute;left:50%;bottom:110px;transform:translateX(-50%);display:flex;gap:10px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${cs};"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:${cp};"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:${cs};opacity:0.4;"></div>
    </div>

  </div>

  <!-- VERSO: 1050px → 2100px — informações completas -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;background:${cp};overflow:hidden;">

    <!-- Gradiente overlay -->
    <div style="position:absolute;left:0;top:0;width:1050px;height:600px;background:linear-gradient(135deg,rgba(0,0,0,0.35) 0%,transparent 55%);"></div>

    <!-- SVG Circuitos verso -->
    <svg style="position:absolute;top:0;left:0;width:1050px;height:600px;opacity:0.08;" viewBox="0 0 1050 600" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#FFFFFF" stroke-width="1.5" fill="none">
        <path d="M0,100 L80,100 L80,40 L160,40 L160,100 L260,100"/>
        <path d="M0,300 L60,300 L60,240 L140,240 L140,300 L200,300"/>
        <path d="M0,480 L100,480 L100,420 L180,420"/>
        <path d="M1050,80 L970,80 L970,140 L890,140"/>
        <path d="M1050,300 L990,300 L990,360 L910,360"/>
        <path d="M1050,480 L970,480 L970,420 L890,420"/>
        <circle cx="80" cy="100" r="5" fill="#FFFFFF"/>
        <circle cx="160" cy="40" r="5" fill="#FFFFFF"/>
        <circle cx="60" cy="300" r="5" fill="#FFFFFF"/>
        <circle cx="970" cy="80" r="5" fill="#FFFFFF"/>
        <rect x="68" y="88" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
        <rect x="148" y="28" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
        <rect x="958" y="68" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
      </g>
    </svg>

    <!-- Hexágono gigante atrás do nome -->
    <svg style="position:absolute;left:-100px;top:50%;transform:translateY(-50%);width:520px;height:520px;opacity:0.04;" viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg">
      <polygon points="260,20 476,142 476,378 260,500 44,378 44,142" fill="#FFFFFF"/>
      <polygon points="260,60 440,162 440,358 260,460 80,358 80,162" fill="none" stroke="#FFFFFF" stroke-width="2"/>
    </svg>

    <!-- Faixa laranja diagonal -->
    <div style="position:absolute;left:310px;top:-20px;width:5px;height:680px;background:${cs};transform:rotate(10deg);transform-origin:top left;opacity:0.50;"></div>
    <div style="position:absolute;left:328px;top:-20px;width:2px;height:680px;background:${cs};transform:rotate(10deg);transform-origin:top left;opacity:0.22;"></div>

    <!-- Círculos decorativos -->
    <div style="position:absolute;right:-90px;top:-90px;width:320px;height:320px;border-radius:50%;border:1px solid rgba(255,255,255,0.07);"></div>
    <div style="position:absolute;right:-50px;top:-50px;width:210px;height:210px;border-radius:50%;border:1px solid rgba(255,255,255,0.05);"></div>

    <!-- Hexágono decorativo canto inferior direito -->
    <svg style="position:absolute;right:44px;bottom:44px;width:110px;height:110px;opacity:0.07;" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
      <polygon points="55,5 100,30 100,80 55,105 10,80 10,30" fill="none" stroke="#FFFFFF" stroke-width="2"/>
    </svg>

    <!-- Nome empresa topo direito sutil -->
    <div style="position:absolute;right:44px;top:28px;">
      <div style="font-size:22px;font-weight:800;color:rgba(255,255,255,0.09);letter-spacing:5px;text-transform:uppercase;">${empresa}</div>
    </div>

    <!-- Nome e cargo do profissional -->
    <div style="position:absolute;left:60px;top:68px;width:660px;">
      <div style="font-size:${nomeSize}px;font-weight:800;color:#FFFFFF;line-height:1.05;letter-spacing:-0.5px;">${nome}</div>
      <div style="font-size:20px;font-weight:600;color:${cs};letter-spacing:3px;text-transform:uppercase;margin-top:10px;">${cargo}</div>
      <div style="width:52px;height:3px;background:${cs};margin-top:12px;border-radius:2px;"></div>
    </div>

    <!-- Contatos -->
    <div style="position:absolute;left:60px;top:290px;">

      ${email ? `
      <div style="position:absolute;top:0;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:rgba(255,255,255,0.88);white-space:nowrap;">${email}</span>
      </div>` : ''}

      ${telefone ? `
      <div style="position:absolute;top:72px;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:rgba(255,255,255,0.88);white-space:nowrap;">${telefone}</span>
      </div>` : ''}

      ${site ? `
      <div style="position:absolute;top:124px;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:${cs};white-space:nowrap;">${site}</span>
      </div>` : ''}

    </div>

  </div>

</div>
</body>
</html>`;
}

function tplCartaoPremiumDark(d: ProdutoInput, logo: string): string {
  const cp = d.cor_primaria || '#0A1628';
  const cs = d.cor_secundaria || '#F87A13';
  const nome = (d.nome || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cargo = (d.cargo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const empresa = (d.empresa || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const telefone = (d.telefone || '').replace(/&/g,'&amp;');
  const email = (d.email || '').replace(/&/g,'&amp;');
  const site = (d.site || '').replace(/&/g,'&amp;');
  const nomeSize = nome.length > 24 ? 44 : nome.length > 18 ? 50 : 56;
  const empresaSize = empresa.length > 20 ? 48 : empresa.length > 12 ? 62 : 76;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0a0a; font-family: Montserrat, Arial, Helvetica, sans-serif; }
#canvas { width: 2100px; height: 600px; position: relative; overflow: hidden; }
</style>
</head>
<body>
<div id="canvas">

  <!-- FRENTE: 0px → 1050px — dark, logo centralizado -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;background:${cp};overflow:hidden;">

    <!-- Faixa diagonal laranja base -->
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:110px;overflow:hidden;">
      <div style="position:absolute;left:-60px;bottom:-55px;width:1200px;height:150px;background:${cs};transform:rotate(-4deg);transform-origin:left bottom;opacity:0.90;"></div>
    </div>
    <!-- Faixa diagonal mais escura sobre laranja -->
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:82px;overflow:hidden;">
      <div style="position:absolute;left:-60px;bottom:-45px;width:1200px;height:110px;background:#000000;transform:rotate(-4deg);transform-origin:left bottom;opacity:0.50;"></div>
    </div>

    <!-- Gradiente escuro no topo -->
    <div style="position:absolute;left:0;top:0;width:1050px;height:300px;background:linear-gradient(180deg,rgba(0,0,0,0.40) 0%,transparent 100%);"></div>

    <!-- SVG Circuitos canto superior direito -->
    <svg style="position:absolute;top:0;right:0;width:280px;height:240px;opacity:0.12;" viewBox="0 0 280 240" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${cs}" stroke-width="1.5" fill="none">
        <path d="M280,0 L280,70 L210,70 L210,30 L150,30 L150,90 L230,90 L230,150"/>
        <path d="M280,110 L240,110 L240,170 L180,170 L180,130 L120,130"/>
        <circle cx="210" cy="70" r="4" fill="${cs}"/>
        <circle cx="150" cy="30" r="4" fill="${cs}"/>
        <circle cx="240" cy="170" r="4" fill="${cs}"/>
        <rect x="198" y="58" width="24" height="24" rx="3" stroke="${cs}" stroke-width="1.5" fill="none"/>
      </g>
    </svg>

    <!-- SVG Circuitos canto inferior esquerdo -->
    <svg style="position:absolute;bottom:0;left:0;width:220px;height:180px;opacity:0.10;" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#FFFFFF" stroke-width="1.5" fill="none">
        <path d="M0,180 L0,110 L50,110 L50,150 L100,150 L100,100 L50,100 L50,60"/>
        <path d="M0,80 L40,80 L40,40 L90,40 L90,80 L140,80"/>
        <circle cx="50" cy="110" r="4" fill="#FFFFFF"/>
        <circle cx="100" cy="150" r="4" fill="#FFFFFF"/>
        <rect x="38" y="98" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>
      </g>
    </svg>

    <!-- LOGO grande centralizado na frente — card branco premium -->
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-58%);text-align:center;">
      ${logo
        ? `<div style="background:#FFFFFF;border:2px solid ${cs};border-radius:16px;padding:28px 36px;box-shadow:0 8px 40px rgba(0,0,0,0.50),0 0 20px rgba(255,255,255,0.06);display:inline-block;">
             <img src="${logo}" style="max-width:340px;max-height:200px;object-fit:contain;display:block;">
           </div>`
        : `<div style="text-align:center;">
             <div style="font-size:${empresaSize}px;font-weight:900;color:#FFFFFF;letter-spacing:-2px;line-height:1;">${empresa}</div>
           </div>`
      }
    </div>

    <!-- Pontos decorativos centralizados -->
    <div style="position:absolute;left:50%;bottom:110px;transform:translateX(-50%);display:flex;gap:10px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${cs};"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:#FFFFFF;opacity:0.5;"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:${cs};opacity:0.4;"></div>
    </div>

  </div>

  <!-- VERSO: 1050px → 2100px — preto com detalhes -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;background:#0d0d0d;overflow:hidden;">

    <!-- Gradiente overlay lateral -->
    <div style="position:absolute;left:0;top:0;width:1050px;height:600px;background:linear-gradient(135deg,rgba(255,255,255,0.03) 0%,transparent 50%);"></div>

    <!-- Borda esquerda colorida -->
    <div style="position:absolute;left:0;top:0;width:4px;height:600px;background:linear-gradient(180deg,${cs},${cp},${cs});"></div>

    <!-- SVG Circuitos verso -->
    <svg style="position:absolute;top:0;left:0;width:1050px;height:600px;opacity:0.06;" viewBox="0 0 1050 600" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#FFFFFF" stroke-width="1.5" fill="none">
        <path d="M0,100 L80,100 L80,40 L160,40 L160,100 L260,100"/>
        <path d="M0,300 L60,300 L60,240 L140,240 L140,300 L200,300"/>
        <path d="M0,480 L100,480 L100,420 L180,420"/>
        <path d="M1050,80 L970,80 L970,140 L890,140"/>
        <path d="M1050,300 L990,300 L990,360 L910,360"/>
        <path d="M1050,480 L970,480 L970,420 L890,420"/>
        <circle cx="80" cy="100" r="5" fill="#FFFFFF"/>
        <circle cx="160" cy="40" r="5" fill="#FFFFFF"/>
        <circle cx="60" cy="300" r="5" fill="#FFFFFF"/>
        <circle cx="970" cy="80" r="5" fill="#FFFFFF"/>
        <rect x="68" y="88" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
        <rect x="148" y="28" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
        <rect x="958" y="68" width="24" height="24" rx="3" stroke="#FFFFFF" stroke-width="1" fill="none"/>
      </g>
    </svg>

    <!-- Hexágono gigante atrás do nome -->
    <svg style="position:absolute;left:-100px;top:50%;transform:translateY(-50%);width:520px;height:520px;opacity:0.05;" viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg">
      <polygon points="260,20 476,142 476,378 260,500 44,378 44,142" fill="${cs}"/>
      <polygon points="260,60 440,162 440,358 260,460 80,358 80,162" fill="none" stroke="${cs}" stroke-width="2"/>
    </svg>

    <!-- Faixa laranja diagonal -->
    <div style="position:absolute;left:310px;top:-20px;width:5px;height:680px;background:${cs};transform:rotate(10deg);transform-origin:top left;opacity:0.40;"></div>
    <div style="position:absolute;left:328px;top:-20px;width:2px;height:680px;background:${cs};transform:rotate(10deg);transform-origin:top left;opacity:0.15;"></div>

    <!-- Hexágono decorativo canto inferior direito -->
    <svg style="position:absolute;right:44px;bottom:44px;width:110px;height:110px;opacity:0.10;" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
      <polygon points="55,5 100,30 100,80 55,105 10,80 10,30" fill="none" stroke="${cs}" stroke-width="2"/>
    </svg>

    <!-- Nome empresa topo direito sutil -->
    <div style="position:absolute;right:44px;top:28px;">
      <div style="font-size:22px;font-weight:800;color:rgba(255,255,255,0.07);letter-spacing:5px;text-transform:uppercase;">${empresa}</div>
    </div>

    <!-- Nome e cargo do profissional -->
    <div style="position:absolute;left:60px;top:68px;width:660px;">
      <div style="font-size:${nomeSize}px;font-weight:800;color:#FFFFFF;line-height:1.05;letter-spacing:-0.5px;">${nome}</div>
      <div style="font-size:20px;font-weight:600;color:${cs};letter-spacing:3px;text-transform:uppercase;margin-top:10px;">${cargo}</div>
      <div style="width:52px;height:3px;background:${cs};margin-top:12px;border-radius:2px;"></div>
    </div>

    <!-- Contatos -->
    <div style="position:absolute;left:60px;top:290px;">

      ${email ? `
      <div style="position:absolute;top:0;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:rgba(255,255,255,0.85);white-space:nowrap;">${email}</span>
      </div>` : ''}

      ${telefone ? `
      <div style="position:absolute;top:72px;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:rgba(255,255,255,0.85);white-space:nowrap;">${telefone}</span>
      </div>` : ''}

      ${site ? `
      <div style="position:absolute;top:124px;left:0;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${cs};position:relative;flex-shrink:0;">
          <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
          </svg>
        </div>
        <span style="font-size:17px;font-weight:400;color:${cs};white-space:nowrap;">${site}</span>
      </div>` : ''}

    </div>

  </div>

</div>
</body>
</html>`;
}

function buildHTML(d: ProdutoInput, logo: string, bgUrl?: string): RenderResult {
  const tipo = normalizarTipo(d.tipo_produto ?? 'cartao_visita');
  const obs  = d.observacoes ?? '';

  // Quando bgUrl presente (ilustração pré-gerada ou via Replicate): overlay de texto
  if (bgUrl) {
    const dims: Record<string, [number, number]> = {
      cartao_visita: [2100, 600], adesivo_redondo: [800, 800], adesivo_retangular: [1050, 400],
      flyer_a5: [750, 1050], banner_vertical: [600, 1800], banner_horizontal: [1800, 600],
      panfleto: [2100, 1500], caneca: [2100, 800], camiseta: [1200, 1200],
      envelope_a4: [1240, 877], folder_a4: [2480, 1748],
    };
    const [pw, ph] = dims[tipo] ?? [1024, 1024];
    const inner = tplOverlaySimples(d, pw, ph);
    return { html: wrapHTML(inner, obs, pw, ph, bgUrl), w: pw, h: ph + 30 };
  }

  if (tipo === 'adesivo_redondo') {
    const inner = pick(2) === 0 ? adRedondoMinimalista(d,logo) : adRedondoColorido(d,logo);
    return { html: wrapHTML(inner, obs, 800, 860, bgUrl), w: 800, h: 890 };
  }
  if (tipo === 'adesivo_retangular') {
    const inner = pick(2) === 0 ? adRetangularClean(d,logo) : adRetangularBold(d,logo);
    return { html: wrapHTML(inner, obs, 1050, 400, bgUrl), w: 1050, h: 430 };
  }
  if (tipo === 'flyer_a5') {
    const inner = pick(2) === 0 ? flyerModerno(d,logo) : flyerElegante(d,logo);
    return { html: wrapHTML(inner, obs, 750, 1050, bgUrl), w: 750, h: 1080 };
  }
  if (tipo === 'banner_vertical') {
    const inner = pick(2) === 0 ? bannerVerticalCorporativo(d,logo) : bannerVerticalVibrante(d,logo);
    return { html: wrapHTML(inner, obs, 600, 1800, bgUrl), w: 600, h: 1830 };
  }
  if (tipo === 'banner_horizontal') {
    const inner = pick(2) === 0 ? bannerHorizontalClean(d,logo) : bannerHorizontalImpactante(d,logo);
    return { html: wrapHTML(inner, obs, 1800, 600, bgUrl), w: 1800, h: 630 };
  }
  if (tipo === 'panfleto') {
    const inner = pick(2) === 0 ? panfletoModerno(d,logo) : panfletoElegante(d,logo);
    return { html: wrapHTML(inner, obs, 2100, 1500, bgUrl), w: 2100, h: 1530 };
  }
  if (tipo === 'caneca') {
    const inner = pick(2) === 0 ? canecaBasico(d,logo) : canecaColorido(d,logo);
    return { html: wrapHTML(inner, obs, 2100, 800, bgUrl), w: 2100, h: 830 };
  }
  if (tipo === 'camiseta') {
    const inner = pick(2) === 0 ? camisetaBasico(d,logo) : camisetaBold(d,logo);
    return { html: wrapHTML(inner, obs, 1200, 1200, bgUrl), w: 1200, h: 1230 };
  }
  if (tipo === 'envelope_a4') {
    const inner = pick(2) === 0 ? envelopeFormal(d,logo) : envelopeModerno(d,logo);
    return { html: wrapHTML(inner, obs, 1240, 877, bgUrl), w: 1240, h: 907 };
  }
  if (tipo === 'folder_a4') {
    const inner = pick(2) === 0 ? folderCorporativo(d,logo) : folderCriativo(d,logo);
    return { html: wrapHTML(inner, obs, 2480, 1748, bgUrl), w: 2480, h: 1778 };
  }
  // cartao_visita — roteado por layout_id (primário) e estilo (fallback)
  const layoutId = (d.layout_id ?? '').toLowerCase();
  const estilo = (d.estilo ?? '').toLowerCase();
  console.log('[gerar-arte] template debug:', JSON.stringify({ tipo_produto: d.tipo_produto, layout_id: d.layout_id, estilo: d.estilo, logo_url: (d.logo_url ?? '').substring(0, 60), temLogo: !!logo, tamanhoLogo: logo?.length || 0 }));
  console.log('[gerar-arte] logo slice(0,80):', logo ? logo.slice(0, 80) : '(vazio)');
  if (layoutId === 'cartao_premium_dark') { return { html: tplCartaoPremiumDark(d, logo), w: 2100, h: 630, fullDoc: true }; }
  if (layoutId === 'cartao_premium') { return { html: tplCartaoPremium(d, logo), w: 2100, h: 630, fullDoc: true }; }
  if (
    estilo.includes('premium-dark') ||
    estilo.includes('premium dark') ||
    estilo.includes('premium_dark') ||
    estilo.includes('dark premium') ||
    estilo.includes('dark')
  ) {
    return { html: tplCartaoPremiumDark(d, logo), w: 2100, h: 630, fullDoc: true };
  }
  if (estilo.includes('premium')) { return { html: tplCartaoPremium(d, logo), w: 2100, h: 630, fullDoc: true }; }
  let inner: string;
  if (estilo.includes('tecnologico-z') || estilo === 'z') {
    return { html: tplTecnologicoZ(d, logo), w: 2100, h: 600, fullDoc: true };
  }
  if (estilo.includes('tecno')) {
    const v = pick(3);
    inner = v === 0 ? tplTecnologico1(d,logo) : v === 1 ? tplTecnologico2(d,logo) : tplTecnologico3(d,logo);
  } else if (estilo.includes('saude') || estilo.includes('saúde')) {
    inner = pick(2) === 0 ? tplSaude1(d,logo) : tplSaude2(d,logo);
  } else {
    const v = pick(5);
    inner = v === 0 ? tplTecnologico1(d,logo)
          : v === 1 ? tplTecnologico2(d,logo)
          : v === 2 ? tplTecnologico3(d,logo)
          : v === 3 ? tplSaude1(d,logo)
          : tplSaude2(d,logo);
  }
  const apenasFrente = obs.toLowerCase().includes('apenas frente');
  return { html: wrapHTML(inner, obs, apenasFrente ? 1050 : 2100, 600, bgUrl), w: apenasFrente ? 1050 : 2100, h: 630 };
}

// ════════════════════════════════════════════════════════════════════════════
// DYNAMIC MOCKUPS — caneca realista
// ════════════════════════════════════════════════════════════════════════════
async function aplicarMockupCaneca(artUrl: string): Promise<string | null> {
  const dmKey = Deno.env.get('DYNAMIC_MOCKUPS_API_KEY') ?? '';
  if (!dmKey) { console.log('[dynamic-mockups] DYNAMIC_MOCKUPS_API_KEY não configurado'); return null; }
  try {
    const res = await fetch('https://app.dynamicmockups.com/api/v1/renders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dmKey}` },
      body: JSON.stringify({
        mockup_uuid: '06a6f80b-d475-4e0f-8a6a-6ccca70834cb',
        smart_objects: [{ uuid: 'c19645fd-5db0-461e-aad3-8131b36501dd', asset: { url: artUrl } }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log('[dynamic-mockups] erro:', res.status, await res.text()); return null; }
    const data = await res.json() as { data?: { export_url?: string } };
    const url = data?.data?.export_url ?? null;
    if (url) console.log('[dynamic-mockups] mockup gerado:', url.substring(0, 80));
    return url;
  } catch (e) { console.log('[dynamic-mockups] exceção:', e); return null; }
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERIZADORES
// ════════════════════════════════════════════════════════════════════════════
async function renderizarHCTI(html: string, w: number, h: number, fullDoc = false): Promise<string | null> {
  const userId = Deno.env.get('HCTI_USER_ID') ?? '';
  const apiKey = Deno.env.get('HCTI_API_KEY') ?? '';
  if (!userId || !apiKey) return null;
  try {
    const hctiBody: Record<string, unknown> = {
      html,
      google_fonts: fullDoc ? 'Montserrat:300,400,500,600,700,800' : 'Poppins:300,400,600,700,800,900',
      viewport_width: w,
      viewport_height: h,
    };
    if (!fullDoc) hctiBody.selector = '#wrapper';
    const res = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${userId}:${apiKey}`)}` },
      body: JSON.stringify(hctiBody),
    });
    if (res.ok) {
      const data = await res.json() as { url: string };
      console.log('[hcti] gerado:', data.url);
      return data.url ?? null;
    }
    console.log('[hcti] erro:', res.status, await res.text());
  } catch (e) { console.log('[hcti] exceção:', e); }
  return null;
}

async function renderizarBrowserless(html: string, w: number, h: number): Promise<string | null> {
  const blKey = Deno.env.get('BROWSERLESS_API_KEY') ?? '';
  const blUrl = Deno.env.get('BROWSERLESS_URL') ?? 'https://chrome.browserless.io';
  if (!blKey) return null;
  try {
    const res = await fetch(`${blUrl}/screenshot?token=${blKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, options: { type: 'png', clip: { x: 0, y: 0, width: w, height: h } }, gotoOptions: { waitUntil: 'networkidle2' } }),
    });
    if (!res.ok) { console.log('[browserless] erro:', res.status); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const supUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const file = `arte-${Date.now()}.png`;
    const up = await fetch(`${supUrl}/storage/v1/object/artes/${file}`, {
      method: 'POST',
      headers: { apikey: supKey, Authorization: `Bearer ${supKey}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: bytes,
    });
    if (up.ok) return `${supUrl}/storage/v1/object/public/artes/${file}`;
    console.log('[browserless] upload erro:', up.status);
  } catch (e) { console.log('[browserless] exceção:', e); }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const d = await req.json() as ProdutoInput;
    d.cor_primaria   = d.cor_primaria   || '#1B3A6B';
    d.cor_secundaria = d.cor_secundaria || '#C9A84C';
    d.tipo_produto   = normalizarTipo(d.tipo_produto ?? 'cartao_visita');
    const modo       = (d.modo ?? 'texto').toLowerCase();

    console.log('[gerar-arte] tipo:', d.tipo_produto, '| modo:', modo, '| empresa:', d.empresa);

    // ── MODO ILUSTRAÇÃO: gera imagem artística via Replicate, sem template HTML ──
    if (modo === 'ilustracao') {
      if (!d.ilustracao_prompt) {
        return new Response(
          JSON.stringify({ error: 'Campo ilustracao_prompt é obrigatório para modo "ilustracao".' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Dimensões padrão por produto para a ilustração
      const dimMap: Record<string, [number, number]> = {
        adesivo_redondo: [800, 800], camiseta: [1200, 1200],
        flyer_a5: [750, 1050], banner_vertical: [600, 1800],
        banner_horizontal: [1800, 600], caneca: [1024, 512],
        panfleto: [1050, 1500], folder_a4: [1240, 874],
        envelope_a4: [1240, 877], adesivo_retangular: [1050, 400],
      };
      const [pw, ph] = dimMap[d.tipo_produto] ?? [1024, 1024];
      const imageUrl = await gerarIlustracaoReplicate(d.ilustracao_prompt, pw, ph);

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'Replicate indisponível. Configure REPLICATE_API_TOKEN.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      let urlFinal = imageUrl;
      if (d.tipo_produto === 'caneca') {
        const mockup = await aplicarMockupCaneca(imageUrl);
        if (mockup) urlFinal = mockup;
      }
      return new Response(
        JSON.stringify({ url: urlFinal, tipo_produto: d.tipo_produto, modo: 'ilustracao' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── MODO COMBINADO: ilustração de fundo + texto por cima ──
    if (modo === 'combinado') {
      if (!d.empresa && !d.nome && !d.texto_principal) {
        return new Response(
          JSON.stringify({ error: 'Informe ao menos empresa, nome ou texto_principal.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Dimensões do produto para o fundo
      const dimMap: Record<string, [number, number]> = {
        adesivo_redondo: [800, 800], camiseta: [1200, 1200],
        flyer_a5: [750, 1050], banner_vertical: [600, 1800],
        banner_horizontal: [1800, 600], caneca: [2100, 800],
        panfleto: [2100, 1500], folder_a4: [2480, 1748],
        envelope_a4: [1240, 877], adesivo_retangular: [1050, 400],
        cartao_visita: [2100, 600],
      };
      const [pw, ph] = dimMap[d.tipo_produto] ?? [1024, 1024];

      // background_url passado diretamente (ilustração já aprovada) → pula Replicate
      let bgUrl: string | undefined = d.background_url || undefined;

      if (!bgUrl && d.ilustracao_prompt) {
        console.log('[gerar-arte] combinado: gerando fundo com Replicate...');
        bgUrl = (await gerarIlustracaoReplicate(d.ilustracao_prompt, pw, ph)) ?? undefined;
        if (!bgUrl) console.log('[gerar-arte] Replicate falhou — renderizando sem fundo');
      }

      if (bgUrl) console.log('[gerar-arte] combinado: fundo =', bgUrl.substring(0, 60));

      const logo = d.logo_url ? await logoParaBase64(d.logo_url) : '';
      const { html, w, h, fullDoc } = buildHTML(d, logo, bgUrl);
      const imageUrl = await renderizarHCTI(html, w, h, fullDoc) ?? await renderizarBrowserless(html, w, h);

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'Renderização indisponível.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      let urlFinalComb = imageUrl;
      if (d.tipo_produto === 'caneca') {
        const mockup = await aplicarMockupCaneca(imageUrl);
        if (mockup) urlFinalComb = mockup;
      }
      return new Response(
        JSON.stringify({ url: urlFinalComb, tipo_produto: d.tipo_produto, modo: 'combinado', background_reutilizado: !!(d.background_url), background_gerado: !!(bgUrl && !d.background_url) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── MODO TEXTO (padrão): template HTML puro ──
    if (!d.empresa && !d.nome && !d.texto_principal) {
      return new Response(
        JSON.stringify({ error: 'Informe ao menos empresa, nome ou texto_principal.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (d.observacoes) console.log('[gerar-arte] observacoes:', d.observacoes);

    const logo = d.logo_url ? await logoParaBase64(d.logo_url) : '';
    const { html, w, h, fullDoc } = buildHTML(d, logo);
    const imageUrl = await renderizarHCTI(html, w, h, fullDoc) ?? await renderizarBrowserless(html, w, h);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Renderização indisponível. Configure HCTI_USER_ID+HCTI_API_KEY ou BROWSERLESS_API_KEY.', html }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let urlFinalTexto = imageUrl;
    if (d.tipo_produto === 'caneca') {
      const mockup = await aplicarMockupCaneca(imageUrl);
      if (mockup) urlFinalTexto = mockup;
    }
    return new Response(
      JSON.stringify({ url: urlFinalTexto, tipo_produto: d.tipo_produto, modo: 'texto', dimensoes: `${w}x${h}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
