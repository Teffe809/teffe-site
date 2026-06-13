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
// branco clean: fundo branco puro, única faixa gradiente de 5px na lateral esquerda
function tplCartaoBrancoLinha(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, ico=icons('#888');
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const contatos=[
    d.telefone?`<div style="display:flex;align-items:center;gap:9px;">${ico.tel}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:9px;">${ico.mail}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:9px;">${ico.web}<span class="contact-text" style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;left:0;top:0;width:5px;height:100%;background:linear-gradient(180deg,${cp},${cs});"></div>
  <div style="position:absolute;bottom:92px;left:40px;right:40px;height:1px;background:#ebebeb;"></div>
  <div class="logo-area" style="position:absolute;top:44px;left:44px;">${logo?`<img src="${logo}" style="max-height:40px;max-width:130px;object-fit:contain;">`:`<span style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:3.5px;text-transform:uppercase;">${emp}</span>`}</div>
  <div style="position:absolute;top:44px;right:44px;width:7px;height:7px;border-radius:50%;background:${cp};"></div>
  <div style="position:absolute;top:50%;left:44px;transform:translateY(-60%);max-width:600px;">
    <div class="nome-text" style="font-size:48px;font-weight:800;color:#0a0a0a;line-height:1.0;letter-spacing:-.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;"><div style="width:28px;height:2px;background:${cp};border-radius:1px;"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:5px;font-size:11px;color:#bbb;letter-spacing:.5px;">${emp}</div>
  </div>
  <div style="position:absolute;bottom:26px;left:44px;display:flex;flex-direction:column;gap:8px;">${contatos}</div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#f7f8fa;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cs},${cp});opacity:.45;"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
    ${logo?`<div class="logo-area" style="margin-bottom:22px;"><img src="${logo}" style="max-height:100px;max-width:310px;object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'26px':'40px'};font-weight:800;color:#111;letter-spacing:5px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.cargo?`<div style="margin-top:8px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">${car}</div>`:''}
    ${d.site?`<div style="margin-top:18px;display:inline-flex;align-items:center;border:1px solid ${cp}44;padding:8px 22px;border-radius:30px;"><span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:''}
  </div>
</div></div>`;
}

// logo em destaque: painel esquerdo com fundo levemente tintado exibe o logo em tamanho grande; informações à direita em branco
function tplCartaoLogoDest(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, ico=icons('#777');
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const inicial=(d.empresa||'G').charAt(0).toUpperCase();
  const contatos=[
    d.telefone?`<div style="display:flex;align-items:center;gap:9px;">${ico.tel}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:9px;">${ico.mail}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:9px;">${ico.web}<span class="contact-text" style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;display:flex;">
  <div style="width:340px;height:600px;background:${cp}0d;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;position:relative;flex-shrink:0;">
    <div style="position:absolute;right:0;top:0;width:1px;height:100%;background:${cp}22;"></div>
    ${logo?`<div class="logo-area"><img src="${logo}" style="max-height:170px;max-width:255px;object-fit:contain;display:block;"></div>`
         :`<div style="width:110px;height:110px;border-radius:50%;background:${cp};display:flex;align-items:center;justify-content:center;"><span style="font-size:52px;font-weight:900;color:#fff;">${inicial}</span></div>`}
  </div>
  <div style="flex:1;padding:0 44px;display:flex;flex-direction:column;justify-content:center;position:relative;">
    <div style="position:absolute;bottom:60px;left:0;right:44px;height:1px;background:#f0f0f0;"></div>
    <div class="nome-text" style="font-size:38px;font-weight:800;color:#0a0a0a;line-height:1.05;letter-spacing:-.3px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><div style="width:26px;height:2px;background:${cp};"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:4px;font-size:11px;color:#c0c0c0;letter-spacing:.5px;">${emp}</div>
    <div style="position:absolute;bottom:18px;left:0;display:flex;flex-direction:column;gap:7px;">${contatos}</div>
  </div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:860px;">
    ${logo?`<div class="logo-area" style="margin-bottom:24px;"><img src="${logo}" style="max-height:140px;max-width:400px;object-fit:contain;display:inline-block;"></div>`
         :`<div style="width:100px;height:100px;border-radius:50%;background:${cp};display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;"><span style="font-size:48px;font-weight:900;color:#fff;">${inicial}</span></div>`}
    <div style="font-size:${logo?'28px':'36px'};font-weight:800;color:#111;letter-spacing:5px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.site?`<div style="margin-top:18px;display:inline-flex;align-items:center;background:${cp}11;padding:9px 24px;border-radius:30px;"><span style="font-size:12px;color:${cp};font-weight:600;">${esc(d.site)}</span></div>`:''}
  </div>
</div></div>`;
}

// minimalista tipografia: nome como elemento central em tamanho enorme, decoração quase zero
function tplCartaoMinimal(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria;
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  const contatosInline=[
    d.telefone?`<span style="font-size:11px;color:#888;">${esc(d.telefone)}</span>`:'',
    d.email?`<span style="font-size:11px;color:#888;">${esc(d.email)}</span>`:'',
    d.site?`<span style="font-size:11px;color:${cp};font-weight:500;">${esc(d.site)}</span>`:'',
  ].filter(Boolean).join('<span style="color:#ddd;margin:0 10px;">·</span>');
  return `<div style="display:flex;width:2100px;height:600px;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div class="logo-area" style="position:absolute;top:40px;left:44px;">${logo?`<img src="${logo}" style="max-height:30px;max-width:100px;object-fit:contain;">`:`<span style="font-size:9px;font-weight:700;color:#c0c0c0;letter-spacing:3.5px;text-transform:uppercase;">${emp}</span>`}</div>
  <div style="position:absolute;top:50%;left:44px;right:44px;transform:translateY(-58%);">
    <div class="nome-text" style="font-size:64px;font-weight:900;color:#0a0a0a;line-height:.95;letter-spacing:-2.5px;">${nom}</div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:16px;">
      <div style="width:18px;height:3px;background:${cp};border-radius:2px;"></div>
      <div class="cargo-text" style="font-size:11px;font-weight:400;color:#999;letter-spacing:2px;text-transform:uppercase;">${car}</div>
    </div>
  </div>
  ${contatosInline?`<div style="position:absolute;bottom:22px;left:44px;display:flex;align-items:center;">${contatosInline}</div>`:''}
</div>
<div id="verso" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;left:-50px;top:50%;transform:translateY(-50%);font-size:760px;font-weight:900;color:#0a0a0a;opacity:.028;line-height:1;pointer-events:none;">${letra}</div>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${cs},${cp});opacity:.4;"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
    ${logo?`<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:80px;max-width:250px;object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'24px':'44px'};font-weight:900;color:#0a0a0a;letter-spacing:7px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.site?`<div style="margin-top:16px;font-size:12px;color:${cp};letter-spacing:2px;">${esc(d.site)}</div>`:''}
  </div>
</div></div>`;
}

function tplCartaoExecutivo(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, ico=icons('#777');
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const contatos=[
    d.telefone?`<div style="display:flex;align-items:center;gap:9px;">${ico.tel}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:9px;">${ico.mail}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:9px;">${ico.web}<span class="contact-text" style="font-size:12px;color:#555;">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;">
<div id="frente" style="width:1050px;height:600px;background:#fff;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;left:0;top:0;width:290px;height:100%;background:linear-gradient(180deg,${cp},${cs});"></div>
  <div style="position:absolute;left:0;top:0;width:290px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 22px;text-align:center;">
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:64px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);">`:''}
    <div style="font-size:${logo?'10px':'14px'};font-weight:700;color:rgba(255,255,255,.88);letter-spacing:3px;text-transform:uppercase;line-height:1.5;">${emp}</div>
  </div>
  <div style="position:absolute;left:290px;top:18%;width:1px;height:64%;background:linear-gradient(180deg,transparent,${cp}33,transparent);"></div>
  <div style="position:absolute;left:326px;top:50%;transform:translateY(-60%);right:44px;">
    <div class="nome-text" style="font-size:38px;font-weight:800;color:#111;line-height:1.05;letter-spacing:-.5px;">${nom}</div>
    <div style="margin-top:10px;display:flex;align-items:center;gap:12px;"><div style="width:32px;height:2px;background:${cp};"></div><div class="cargo-text" style="font-size:11px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:5px;font-size:11px;color:#bbb;">${emp}</div>
  </div>
  <div style="position:absolute;bottom:36px;left:326px;right:44px;display:flex;flex-direction:column;gap:8px;">${contatos}</div>
</div>
<div id="verso" style="width:1050px;height:600px;background:#f5f5f5;position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${cp},${cs});"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${cp},${cs});opacity:.4;"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:800px;">
    ${logo?`<div class="logo-area" style="margin-bottom:22px;"><img src="${logo}" style="max-height:90px;max-width:280px;object-fit:contain;display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'28px':'42px'};font-weight:800;color:#111;letter-spacing:6px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.cargo?`<div style="margin-top:8px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">${car}</div>`:''}
    ${d.site?`<div style="margin-top:20px;display:inline-flex;align-items:center;border:1.5px solid ${cp}55;padding:9px 24px;border-radius:40px;"><span style="font-size:12px;color:${cp};font-weight:500;">${esc(d.site)}</span></div>`:''}
  </div>
</div></div>`;
}

function tplCartaoBold(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, ico=icons(cp);
  const emp=esc(d.empresa), nom=esc(d.nome), car=esc(d.cargo);
  const letra=(d.empresa||'G').charAt(0).toUpperCase();
  const contatos=[
    d.telefone?`<div style="display:flex;align-items:center;gap:10px;">${ico.tel}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${esc(d.telefone)}</span></div>`:'',
    d.email?`<div style="display:flex;align-items:center;gap:10px;">${ico.mail}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${esc(d.email)}</span></div>`:'',
    d.site?`<div style="display:flex;align-items:center;gap:10px;">${ico.web}<span class="contact-text" style="font-size:13px;font-weight:300;color:rgba(255,255,255,.80);">${esc(d.site)}</span></div>`:'',
  ].filter(Boolean).join('');
  return `<div style="display:flex;width:2100px;height:600px;">
<div id="frente" style="width:1050px;height:600px;background:#0d0d0d;position:relative;overflow:hidden;flex-shrink:0;">
  <div class="decos" style="position:absolute;top:0;right:0;width:500px;height:100%;background:linear-gradient(160deg,${cp},${cs});clip-path:polygon(22% 0%,100% 0%,100% 100%,0% 100%);"></div>
  <div style="position:absolute;bottom:-24px;right:155px;font-size:360px;font-weight:900;color:rgba(255,255,255,.04);line-height:1;pointer-events:none;">${letra}</div>
  <div style="position:absolute;top:32px;left:44px;display:flex;gap:7px;"><div style="width:9px;height:9px;border-radius:50%;background:${cp};"></div><div style="width:9px;height:9px;border-radius:50%;background:${cs}88;"></div><div style="width:9px;height:9px;border-radius:50%;background:${cp}44;"></div></div>
  ${logo?`<div class="logo-area" style="position:absolute;top:32px;right:44px;"><img src="${logo}" style="max-height:50px;max-width:150px;object-fit:contain;filter:brightness(0) invert(1);"></div>`:''}
  <div style="position:absolute;top:50%;left:44px;transform:translateY(-55%);max-width:520px;">
    <div class="nome-text" style="font-size:44px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-1px;">${nom}</div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px;"><div style="width:44px;height:3px;background:linear-gradient(90deg,${cp},${cs});border-radius:2px;"></div><div class="cargo-text" style="font-size:12px;font-weight:600;color:${cp};letter-spacing:2.5px;text-transform:uppercase;">${car}</div></div>
    <div style="margin-top:6px;font-size:11.5px;color:rgba(255,255,255,.4);">${emp}</div>
  </div>
  <div style="position:absolute;bottom:36px;left:44px;display:flex;flex-direction:column;gap:9px;">${contatos}</div>
</div>
<div id="verso" style="width:1050px;height:600px;background:linear-gradient(135deg,${cp},${cs});position:relative;overflow:hidden;flex-shrink:0;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:620px;height:620px;border:2px solid rgba(255,255,255,.10);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:460px;height:460px;border:1px solid rgba(255,255,255,.07);"></div>
  <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:rgba(255,255,255,.25);"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);text-align:center;">
    ${logo?`<div class="logo-area" style="margin-bottom:20px;"><img src="${logo}" style="max-height:80px;max-width:240px;object-fit:contain;filter:brightness(0) invert(1);display:inline-block;"></div>`:''}
    <div style="font-size:${logo?'26px':'42px'};font-weight:900;color:#fff;letter-spacing:6px;text-transform:uppercase;">${emp.toUpperCase()}</div>
    ${d.cargo?`<div style="margin-top:10px;font-size:11px;color:rgba(255,255,255,.65);letter-spacing:2.5px;text-transform:uppercase;">${car}</div>`:''}
    ${d.site?`<div style="margin-top:18px;display:inline-flex;align-items:center;background:rgba(255,255,255,.15);padding:9px 22px;border-radius:40px;"><span style="font-size:12px;color:rgba(255,255,255,.9);letter-spacing:1.5px;">${esc(d.site)}</span></div>`:''}
  </div>
</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ADESIVO REDONDO  800×800
// ════════════════════════════════════════════════════════════════════════════
function adRedondoMinimalista(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  return `<div style="width:800px;height:800px;background:#e8e8e8;position:relative;display:flex;align-items:center;justify-content:center;">
  <div style="width:760px;height:760px;border-radius:50%;background:${cp};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px;">
    <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:700px;height:700px;border-radius:50%;border:1px solid rgba(255,255,255,.15);"></div>
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:160px;max-width:320px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:20px;position:relative;">`:''}
    <div style="font-size:${logo?'38px':'48px'};font-weight:800;color:#fff;letter-spacing:4px;text-transform:uppercase;position:relative;">${emp}</div>
    ${arcTextSVG(tp)}
  </div>
</div>`;
}

function adRedondoColorido(d: ProdutoInput, logo: string): string {
  const cp=d.cor_primaria, cs=d.cor_secundaria, emp=esc(d.empresa), tp=esc(d.texto_principal);
  return `<div style="width:800px;height:800px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;position:relative;">
  <div style="width:760px;height:760px;border-radius:50%;background:linear-gradient(135deg,${cp} 0%,${cs} 100%);position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px;">
    <div style="position:absolute;width:680px;height:680px;border-radius:50%;border:2px solid rgba(255,255,255,.18);top:40px;left:40px;"></div>
    <div style="position:absolute;width:540px;height:540px;border-radius:50%;border:1px solid rgba(255,255,255,.10);top:110px;left:110px;"></div>
    <div style="position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.07);"></div>
    ${logo?`<img src="${logo}" class="logo-area" style="max-height:130px;max-width:280px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:16px;position:relative;">`:''}
    <div style="font-size:${logo?'34px':'46px'};font-weight:900;color:#fff;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 16px rgba(0,0,0,.2);position:relative;">${emp}</div>
    ${d.site?`<div style="margin-top:18px;padding:6px 20px;background:rgba(255,255,255,.2);border-radius:30px;font-size:13px;color:rgba(255,255,255,.9);position:relative;">${esc(d.site)}</div>`:''}
    ${arcTextSVG(tp)}
  </div>
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
interface RenderResult { html: string; w: number; h: number; }

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
    return { html: wrapHTML(inner, obs, 800, 800, bgUrl), w: 800, h: 830 };
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
  // cartao_visita (default) — 5 templates disponíveis
  const v = pick(5);
  const inner = v === 0 ? tplCartaoExecutivo(d,logo)
              : v === 1 ? tplCartaoBold(d,logo)
              : v === 2 ? tplCartaoBrancoLinha(d,logo)
              : v === 3 ? tplCartaoLogoDest(d,logo)
              : tplCartaoMinimal(d,logo);
  return { html: wrapHTML(inner, obs, 2100, 600, bgUrl), w: 2100, h: 630 };
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERIZADORES
// ════════════════════════════════════════════════════════════════════════════
async function renderizarHCTI(html: string, w: number, h: number): Promise<string | null> {
  const userId = Deno.env.get('HCTI_USER_ID') ?? '';
  const apiKey = Deno.env.get('HCTI_API_KEY') ?? '';
  if (!userId || !apiKey) return null;
  try {
    const res = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${userId}:${apiKey}`)}` },
      body: JSON.stringify({ html, google_fonts: 'Poppins:300,400,600,700,800,900', viewport_width: w, viewport_height: h, selector: '#wrapper' }),
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
      return new Response(
        JSON.stringify({ url: imageUrl, tipo_produto: d.tipo_produto, modo: 'ilustracao' }),
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
      const { html, w, h } = buildHTML(d, logo, bgUrl);
      const imageUrl = await renderizarHCTI(html, w, h) ?? await renderizarBrowserless(html, w, h);

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'Renderização indisponível.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ url: imageUrl, tipo_produto: d.tipo_produto, modo: 'combinado', background_reutilizado: !!(d.background_url), background_gerado: !!(bgUrl && !d.background_url) }),
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
    const { html, w, h } = buildHTML(d, logo);
    const imageUrl = await renderizarHCTI(html, w, h) ?? await renderizarBrowserless(html, w, h);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Renderização indisponível. Configure HCTI_USER_ID+HCTI_API_KEY ou BROWSERLESS_API_KEY.', html }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ url: imageUrl, tipo_produto: d.tipo_produto, modo: 'texto', dimensoes: `${w}x${h}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
