/**
 * ARTE_HIBRIDA_V1
 *
 * Motor duplo de renderização:
 *   Motor IA    → gera o fundo/composição visual (cores, formas, atmosfera)
 *                 NUNCA escreve telefone, email, site ou textos pequenos
 *   Motor HTML  → aplica logo, nome, contatos, CTA, QR — sempre com precisão
 *
 * Fluxo: decidirMotorArte → gerarBaseIA → aplicarOverlayHTML → renderizarFinal
 *
 * Ativar no index.ts (handler principal, ANTES de buildHTML):
 *   import { decidirMotorArte, renderizarFinal } from './arte_hibrida.ts';
 *   if (layoutId.startsWith('hibrida_')) {
 *     const r = await renderizarFinal(d, logo, Deno.env.toObject());
 *     return new Response(JSON.stringify(r), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 *   }
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ProdutoInput {
  tipo_produto:        string;
  modo?:               string;
  ilustracao_prompt?:  string;
  background_url?:     string;
  nome?:               string;
  cargo?:              string;
  empresa?:            string;
  telefone?:           string;
  email?:              string;
  site?:               string;
  logo_url?:           string;
  cor_primaria:        string;
  cor_secundaria:      string;
  texto_principal?:    string;
  texto_secundario?:   string;
  estilo?:             string;
  layout_id?:          string;
  observacoes?:        string;
  preco?:              string;
  cta?:                string;
}

export interface MotorDecision {
  motor:     'hibrida' | 'html_puro';
  produto:   string;
  dimensoes: { w: number; h: number };
  razao:     string;
}

export interface BaseIA {
  url:      string;
  prompt:   string;
  provider: 'replicate' | 'mock';
  mock:     boolean;
}

export interface ResultadoFinal {
  html:    string;
  w:       number;
  h:       number;
  fullDoc: boolean;
}

// ── Dimensões por produto ─────────────────────────────────────────────────────

const DIMENSOES: Record<string, { w: number; h: number }> = {
  cartao_visita:       { w: 2100, h: 600  },
  panfleto:            { w: 1240, h: 1754 },
  caneca:              { w: 1800, h: 700  },
  adesivo_redondo:     { w: 800,  h: 800  },
  adesivo_retangular:  { w: 1050, h: 400  },
};

// ── Utilitário local ──────────────────────────────────────────────────────────

function normalizarTipo(raw: string): string {
  const map: Record<string, string> = {
    'cartao':            'cartao_visita',
    'cartão':            'cartao_visita',
    'cartao_visita':     'cartao_visita',
    'cartão_visita':     'cartao_visita',
    'panfleto':          'panfleto',
    'flyer':             'panfleto',
    'caneca':            'caneca',
    'adesivo':           'adesivo_redondo',
    'adesivo_redondo':   'adesivo_redondo',
    'adesivo_redond':    'adesivo_redondo',
    'adesivo_retangular':'adesivo_retangular',
  };
  return map[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

function e(s: string | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 1. decidirMotorArte ───────────────────────────────────────────────────────

/**
 * Decide qual motor usar com base no layout_id.
 * layout_id iniciado com 'hibrida_' → motor duplo (IA + HTML).
 * Qualquer outro → html_puro (templates existentes, sem alteração).
 */
export function decidirMotorArte(d: ProdutoInput): MotorDecision {
  const layoutId = (d.layout_id ?? '').toLowerCase();
  const produto  = normalizarTipo(d.tipo_produto ?? '');
  const dims     = DIMENSOES[produto] ?? { w: 1200, h: 800 };

  const produtosSuportados = Object.keys(DIMENSOES);

  if (layoutId.startsWith('hibrida_') && produtosSuportados.includes(produto)) {
    return {
      motor:     'hibrida',
      produto,
      dimensoes: dims,
      razao:     `layout_id=${layoutId} → motor IA ativado para ${produto}`,
    };
  }

  return {
    motor:     'html_puro',
    produto,
    dimensoes: dims,
    razao:     'layout_id não inicia com hibrida_ → mantém motor HTML puro',
  };
}

// ── 2. gerarBaseIA ────────────────────────────────────────────────────────────

/**
 * Motor visual IA.
 *
 * REGRA CRÍTICA: o prompt enviado à IA NUNCA deve conter telefone, email,
 * site, nomes de pessoas ou qualquer texto que deva aparecer no produto final.
 * A IA produz APENAS: fundo, composição, formas, texturas, atmosfera visual.
 *
 * Fase atual: MOCK — retorna SVG gradiente como placeholder.
 * Para ativar Replicate: descomente chamarReplicate() e passe REPLICATE_API_KEY.
 */
export async function gerarBaseIA(
  d: ProdutoInput,
  _env?: Record<string, string>,
): Promise<BaseIA> {
  const cp      = d.cor_primaria   ?? '#1A2744';
  const cs      = d.cor_secundaria ?? '#E8A020';
  const produto = normalizarTipo(d.tipo_produto ?? '');
  const prompt  = _construirPromptVisual(produto, cp, cs, d);

  // ── Integração futura com Replicate ────────────────────────────────────────
  // const apiKey = _env?.REPLICATE_API_KEY;
  // if (apiKey) {
  //   const url = await _chamarReplicate(prompt, apiKey, DIMENSOES[produto]);
  //   return { url, prompt, provider: 'replicate', mock: false };
  // }

  const svg     = _gerarMockSVG(produto, cp, cs);
  const baseUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

  return { url: baseUrl, prompt, provider: 'mock', mock: true };
}

function _construirPromptVisual(
  produto: string,
  cp: string,
  cs: string,
  d: ProdutoInput,
): string {
  const estilo = d.estilo ?? 'moderno';

  const prompts: Record<string, string> = {
    cartao_visita: `Luxury business card background, abstract geometric composition, ${estilo} aesthetic. Primary color ${cp}, accent ${cs}. Soft gradients, elegant shapes — no text, no words, no numbers, no names.`,
    panfleto:      `Premium marketing flyer background, vibrant visual composition, ${estilo} style. Dominant ${cp} with ${cs} accents. Abstract flowing shapes, dynamic layout — no text, no words.`,
    caneca:        `Mug sublimation art, seamless horizontal design, ${estilo} aesthetic. Colors ${cp} and ${cs}. Abstract patterns, decorative elements — no text, no words, wraps around mug.`,
    adesivo_redondo:    `Circular sticker background, bold graphic ${estilo} style. Colors ${cp} and ${cs}. Decorative borders, abstract fill — no text, high contrast.`,
    adesivo_retangular: `Rectangular sticker background, ${estilo} aesthetic. Colors ${cp} and ${cs}. Clean abstract shapes — no text.`,
  };

  return prompts[produto] ?? `Abstract professional background, ${estilo}, colors ${cp} and ${cs} — no text.`;
}

function _gerarMockSVG(produto: string, cp: string, cs: string): string {
  if (produto === 'caneca') return _mockCanecaSVG(cp, cs);
  const { w, h } = DIMENSOES[produto] ?? { w: 1200, h: 800 };

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${cp}"/>
      <stop offset="60%"  stop-color="${cp}CC"/>
      <stop offset="100%" stop-color="${cs}33"/>
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="30%" r="55%">
      <stop offset="0%"   stop-color="${cs}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${cp}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <ellipse cx="${w * 0.10}" cy="${h * 0.50}" rx="${w * 0.24}" ry="${h * 0.50}" fill="${cs}" opacity="0.07"/>
  <polygon points="${w},0 ${w},${h} ${w * 0.62},${h} ${w * 0.78},0" fill="${cs}" opacity="0.05"/>
  <line x1="0" y1="${h * 0.5}" x2="${w}" y2="${h * 0.5}" stroke="${cs}" stroke-width="1" opacity="0.10"/>
</svg>`;
}

// SVG de sublimação para caneca — rica em detalhes, sem texto.
// Estrutura: faixas topo/rodapé, arcos de borda de caneca, ondas, grid de pontos, spotlight.
function _mockCanecaSVG(cp: string, cs: string): string {
  return `<svg width="1800" height="700" viewBox="0 0 1800 700" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgH" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${cp}"/>
      <stop offset="45%"  stop-color="${cp}EE"/>
      <stop offset="100%" stop-color="${cp}CC"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="50%" r="42%">
      <stop offset="0%"   stop-color="${cs}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${cp}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gL" cx="18%" cy="50%" r="26%">
      <stop offset="0%"   stop-color="${cs}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${cp}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gR" cx="82%" cy="50%" r="26%">
      <stop offset="0%"   stop-color="${cs}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${cp}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="diagLines" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
      <line x1="0" y1="36" x2="36" y2="0" stroke="${cs}" stroke-width="0.5" opacity="0.14"/>
    </pattern>
    <pattern id="dotGrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="14" cy="14" r="1.6" fill="${cs}" opacity="0.22"/>
    </pattern>
  </defs>

  <!-- Fundo base -->
  <rect width="1800" height="700" fill="url(#bgH)"/>
  <!-- Textura diagonal global -->
  <rect width="1800" height="700" fill="url(#diagLines)"/>
  <!-- Spotlights -->
  <rect width="1800" height="700" fill="url(#spot)"/>
  <rect width="1800" height="700" fill="url(#gL)"/>
  <rect width="1800" height="700" fill="url(#gR)"/>

  <!-- Faixa superior (cs) -->
  <rect x="0" y="0" width="1800" height="56" fill="${cs}"/>
  <line x1="0" y1="52" x2="1800" y2="52" stroke="#FFFFFF" stroke-width="1.2" opacity="0.18"/>

  <!-- Faixa inferior (cs) -->
  <rect x="0" y="644" width="1800" height="56" fill="${cs}"/>
  <line x1="0" y1="648" x2="1800" y2="648" stroke="#FFFFFF" stroke-width="1.2" opacity="0.18"/>

  <!-- Arcos concêntricos esquerda (borda planificada de caneca) -->
  <ellipse cx="-10" cy="350" rx="170" ry="275" fill="none" stroke="${cs}" stroke-width="2"   opacity="0.32"/>
  <ellipse cx="-10" cy="350" rx="215" ry="305" fill="none" stroke="${cs}" stroke-width="1.2" opacity="0.20"/>
  <ellipse cx="-10" cy="350" rx="260" ry="330" fill="none" stroke="${cs}" stroke-width="0.8" opacity="0.13"/>
  <ellipse cx="-10" cy="350" rx="305" ry="350" fill="none" stroke="${cs}" stroke-width="0.5" opacity="0.08"/>
  <!-- Grid de pontos zona esquerda -->
  <rect x="0" y="56" width="340" height="588" fill="url(#dotGrid)"/>

  <!-- Arcos concêntricos direita -->
  <ellipse cx="1810" cy="350" rx="170" ry="275" fill="none" stroke="${cs}" stroke-width="2"   opacity="0.32"/>
  <ellipse cx="1810" cy="350" rx="215" ry="305" fill="none" stroke="${cs}" stroke-width="1.2" opacity="0.20"/>
  <ellipse cx="1810" cy="350" rx="260" ry="330" fill="none" stroke="${cs}" stroke-width="0.8" opacity="0.13"/>
  <ellipse cx="1810" cy="350" rx="305" ry="350" fill="none" stroke="${cs}" stroke-width="0.5" opacity="0.08"/>
  <!-- Grid de pontos zona direita -->
  <rect x="1460" y="56" width="340" height="588" fill="url(#dotGrid)"/>

  <!-- Ondas horizontais suaves cruzando o canvas -->
  <path d="M 0,240 C 300,170 600,340 900,270 C 1200,200 1500,320 1800,252"
        fill="none" stroke="${cs}" stroke-width="1.8" opacity="0.22"/>
  <path d="M 0,460 C 300,390 600,530 900,460 C 1200,390 1500,510 1800,440"
        fill="none" stroke="${cs}" stroke-width="1.2" opacity="0.15"/>
  <!-- Linha central -->
  <line x1="0" y1="350" x2="1800" y2="350" stroke="${cs}" stroke-width="0.8" opacity="0.09"/>

  <!-- Separadores verticais (demarcam zona central do logo) -->
  <line x1="390" y1="56" x2="390" y2="644" stroke="${cs}" stroke-width="1.5" opacity="0.24"/>
  <line x1="393" y1="56" x2="393" y2="644" stroke="#FFFFFF"  stroke-width="0.5" opacity="0.08"/>
  <line x1="1410" y1="56" x2="1410" y2="644" stroke="${cs}" stroke-width="1.5" opacity="0.24"/>
  <line x1="1407" y1="56" x2="1407" y2="644" stroke="#FFFFFF"  stroke-width="0.5" opacity="0.08"/>

</svg>`;
}

// ── 3. aplicarOverlayHTML ─────────────────────────────────────────────────────

/**
 * Motor HTML/SVG de overlay.
 * ÚNICO responsável por todo texto visível no produto final:
 * logo, nome, cargo, empresa, telefone, email, site, CTA, preço.
 * Regras obrigatórias: position:absolute apenas, sem flexbox, sem grid, sem Google Fonts.
 */
export function aplicarOverlayHTML(
  d: ProdutoInput,
  logo: string,
  baseUrl: string,
): string {
  const produto = normalizarTipo(d.tipo_produto ?? '');

  const overlays: Record<string, (d: ProdutoInput, logo: string, url: string) => string> = {
    cartao_visita:   _overlayCartao,
    panfleto:        _overlayPanfleto,
    caneca:          _overlayCaneca,
    adesivo_redondo: _overlayAdesivo,
  };

  const fn = overlays[produto] ?? _overlayGenerico;
  return fn(d, logo, baseUrl);
}

// ── Overlay: cartão de visita (2100×600) ──────────────────────────────────────

function _overlayCartao(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp       = d.cor_primaria   ?? '#1A2744';
  const cs       = d.cor_secundaria ?? '#E8A020';
  const nome     = e(d.nome);
  const cargo    = e(d.cargo);
  const empresa  = e(d.empresa);
  const telefone = e(d.telefone);
  const email    = e(d.email);
  const site     = e(d.site);
  const nomeSize = nome.length > 24 ? 40 : nome.length > 18 ? 50 : 58;
  const inicial  = empresa.charAt(0).toUpperCase() || 'T';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,Helvetica,sans-serif; }
#canvas { width:2100px; height:600px; position:relative; overflow:hidden; }</style>
</head><body>
<div id="canvas">

  <!-- FRENTE 0–1050: base IA + logo -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;overflow:hidden;">
    <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:1050px;height:600px;object-fit:cover;">
    <!-- Logo card -->
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);">
      ${logo
        ? `<div style="position:relative;background:#FFFFFF;border:2px solid ${cs};border-radius:14px;padding:22px 36px;box-shadow:0 8px 40px rgba(0,0,0,0.30);">
             <img src="${logo}" style="max-width:360px;max-height:210px;object-fit:contain;display:block;">
           </div>`
        : `<svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
             <circle cx="75" cy="75" r="71" fill="${cs}"/>
             <text x="75" y="103" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="66" fill="#FFF">${inicial}</text>
           </svg>`}
    </div>
    <!-- Faixa colorida rodapé -->
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:6px;background:linear-gradient(90deg,${cs},${cp});"></div>
  </div>

  <!-- VERSO 1050–2100: base IA + textos -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;overflow:hidden;">
    <img src="${baseUrl}" style="position:absolute;left:-1050px;top:0;width:2100px;height:600px;object-fit:cover;">
    <!-- Véu de escurecimento para legibilidade -->
    <div style="position:absolute;left:0;top:0;width:1050px;height:600px;background:rgba(0,0,0,0.42);"></div>
    <!-- Barra lateral colorida -->
    <div style="position:absolute;left:0;top:0;width:5px;height:600px;background:linear-gradient(180deg,${cs},${cp},${cs});"></div>

    <!-- Nome e cargo -->
    <div style="position:absolute;left:56px;top:68px;right:44px;">
      <div style="font-size:${nomeSize}px;font-weight:900;color:#FFFFFF;line-height:1.06;text-shadow:0 2px 10px rgba(0,0,0,0.5);">${nome}</div>
      <div style="font-size:15px;letter-spacing:3.5px;color:${cs};text-transform:uppercase;margin-top:9px;">${cargo}</div>
      <div style="width:44px;height:2px;background:${cs};margin-top:10px;"></div>
    </div>

    <!-- Contatos (position:absolute puro, sem flexbox) -->
    <div style="position:absolute;left:56px;top:280px;width:720px;">

      ${email ? `<div style="position:absolute;top:0;left:0;width:720px;height:26px;">
        <svg style="position:absolute;left:0;top:5px;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
        <span style="position:absolute;left:30px;top:0;line-height:26px;font-size:16px;color:rgba(255,255,255,0.86);text-shadow:0 1px 5px rgba(0,0,0,0.5);">${email}</span>
      </div>` : ''}

      ${telefone ? `<div style="position:absolute;top:44px;left:0;width:720px;height:26px;">
        <svg style="position:absolute;left:0;top:5px;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <span style="position:absolute;left:30px;top:0;line-height:26px;font-size:16px;color:rgba(255,255,255,0.86);text-shadow:0 1px 5px rgba(0,0,0,0.5);">${telefone}</span>
      </div>` : ''}

      ${site ? `<div style="position:absolute;top:88px;left:0;width:720px;height:26px;">
        <svg style="position:absolute;left:0;top:5px;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        <span style="position:absolute;left:30px;top:0;line-height:26px;font-size:16px;color:${cs};text-shadow:0 1px 5px rgba(0,0,0,0.4);">${site}</span>
      </div>` : ''}

    </div>

    <!-- Empresa rodapé -->
    <div style="position:absolute;right:40px;bottom:24px;font-size:10px;letter-spacing:4px;color:rgba(255,255,255,0.22);text-transform:uppercase;">${empresa}</div>
    <div style="position:absolute;left:0;bottom:0;width:1050px;height:5px;background:linear-gradient(90deg,${cs},${cp});"></div>
  </div>

</div></body></html>`;
}

// ── Overlay: panfleto (1240×1754) ─────────────────────────────────────────────

function _overlayPanfleto(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp       = d.cor_primaria   ?? '#1A2744';
  const cs       = d.cor_secundaria ?? '#E8A020';
  const empresa  = e(d.empresa);
  const titulo   = e(d.texto_principal  || d.empresa);
  const subtitulo= e(d.texto_secundario ?? '');
  const telefone = e(d.telefone ?? '');
  const site     = e(d.site     ?? '');
  const cta      = e(d.cta      ?? 'Entre em contato');
  const tSize    = titulo.length > 44 ? 52 : titulo.length > 28 ? 64 : 78;
  const inicial  = empresa.charAt(0).toUpperCase() || 'T';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,Helvetica,sans-serif; }
#canvas { width:1240px; height:1754px; position:relative; overflow:hidden; }</style>
</head><body>
<div id="canvas">

  <!-- Base IA -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:1240px;height:1754px;object-fit:cover;">
  <!-- Véu gradiente legibilidade -->
  <div style="position:absolute;left:0;top:0;width:1240px;height:1754px;background:linear-gradient(180deg,rgba(0,0,0,0.48) 0%,rgba(0,0,0,0.14) 38%,rgba(0,0,0,0.10) 62%,rgba(0,0,0,0.60) 100%);"></div>

  <!-- Logo / monograma topo -->
  <div style="position:absolute;left:50%;top:56px;transform:translateX(-50%);">
    ${logo
      ? `<img src="${logo}" style="max-width:260px;max-height:110px;object-fit:contain;display:block;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.50));">`
      : `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
           <circle cx="48" cy="48" r="46" fill="${cs}"/>
           <text x="48" y="65" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="42" fill="#FFF">${inicial}</text>
         </svg>`}
  </div>

  <!-- Empresa nome -->
  <div style="position:absolute;left:50%;top:188px;transform:translateX(-50%);white-space:nowrap;">
    <span style="font-size:12px;letter-spacing:9px;color:rgba(255,255,255,0.68);text-transform:uppercase;">${empresa}</span>
  </div>

  <!-- Título hero -->
  <div style="position:absolute;left:56px;top:340px;right:56px;">
    <div style="font-size:${tSize}px;font-weight:900;color:#FFFFFF;line-height:1.06;letter-spacing:-1px;text-transform:uppercase;text-shadow:0 4px 22px rgba(0,0,0,0.60);">${titulo}</div>
    <div style="width:68px;height:5px;background:${cs};border-radius:3px;margin-top:18px;"></div>
  </div>

  <!-- Subtítulo -->
  ${subtitulo ? `<div style="position:absolute;left:56px;top:${340 + tSize * 2 + 56}px;right:56px;">
    <div style="font-size:22px;color:rgba(255,255,255,0.88);line-height:1.56;text-shadow:0 2px 9px rgba(0,0,0,0.48);">${subtitulo}</div>
  </div>` : ''}

  <!-- Rodapé: contatos + CTA -->
  <div style="position:absolute;left:0;bottom:0;width:1240px;height:200px;">
    <!-- Gradiente rodapé -->
    <div style="position:absolute;left:0;top:0;width:1240px;height:200px;background:linear-gradient(0deg,rgba(0,0,0,0.88) 0%,transparent 100%);"></div>

    ${telefone ? `<div style="position:absolute;left:56px;bottom:100px;width:700px;height:28px;">
      <svg style="position:absolute;left:0;top:4px;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
      <span style="position:absolute;left:34px;top:0;line-height:28px;font-size:22px;font-weight:700;color:#FFFFFF;">${telefone}</span>
    </div>` : ''}

    ${site ? `<div style="position:absolute;left:56px;bottom:56px;width:700px;height:28px;">
      <svg style="position:absolute;left:0;top:4px;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
      <span style="position:absolute;left:34px;top:0;line-height:28px;font-size:18px;color:rgba(255,255,255,0.80);">${site}</span>
    </div>` : ''}

    <!-- CTA botão -->
    <div style="position:absolute;right:56px;bottom:48px;background:${cs};border-radius:8px;padding:0 36px;height:56px;">
      <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:16px;font-weight:800;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;">${cta}</span>
    </div>
  </div>

</div></body></html>`;
}

// ── Overlay: caneca (1800×700) ────────────────────────────────────────────────

function _overlayCaneca(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp      = d.cor_primaria   ?? '#1A2744';
  const cs      = d.cor_secundaria ?? '#E8A020';
  const empresa = e(d.empresa);
  const titulo  = e(d.texto_principal  || d.empresa);
  const subtit  = e(d.texto_secundario ?? d.site ?? '');
  const tSize   = titulo.length > 30 ? 44 : titulo.length > 18 ? 56 : 68;
  const inicial = empresa.charAt(0).toUpperCase() || 'T';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,Helvetica,sans-serif; }
#canvas { width:1800px; height:700px; position:relative; overflow:hidden; }</style>
</head><body>
<div id="canvas">

  <!-- Base IA -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:1800px;height:700px;object-fit:cover;">
  <!-- Véu central para logo legível -->
  <div style="position:absolute;left:400px;top:0;width:1000px;height:700px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.38) 0%,transparent 72%);"></div>

  <!-- Logo / monograma centralizado -->
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-62%);">
    ${logo
      ? `<div style="position:relative;background:#FFFFFF;border-radius:14px;padding:18px 34px;box-shadow:0 8px 44px rgba(0,0,0,0.34);">
           <img src="${logo}" style="max-width:300px;max-height:170px;object-fit:contain;display:block;">
         </div>`
      : `<svg width="130" height="130" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
           <circle cx="65" cy="65" r="61" fill="${cs}"/>
           <text x="65" y="90" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="58" fill="#FFF">${inicial}</text>
         </svg>`}
  </div>

  <!-- Título -->
  <div style="position:absolute;left:50%;top:472px;transform:translateX(-50%);width:1400px;text-align:center;">
    <span style="font-size:${tSize}px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;text-shadow:0 3px 14px rgba(0,0,0,0.55);">${titulo}</span>
  </div>

  <!-- Subtítulo -->
  ${subtit ? `<div style="position:absolute;left:50%;top:${472 + tSize + 12}px;transform:translateX(-50%);width:1200px;text-align:center;">
    <span style="font-size:22px;color:rgba(255,255,255,0.75);text-shadow:0 2px 8px rgba(0,0,0,0.45);">${subtit}</span>
  </div>` : ''}

  <!-- Faixas coloridas topo/rodapé -->
  <div style="position:absolute;left:0;top:0;width:1800px;height:8px;background:linear-gradient(90deg,${cp},${cs},${cp});"></div>
  <div style="position:absolute;left:0;bottom:0;width:1800px;height:8px;background:linear-gradient(90deg,${cp},${cs},${cp});"></div>

</div></body></html>`;
}

// ── Overlay: adesivo redondo (800×800) ────────────────────────────────────────

function _overlayAdesivo(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp      = d.cor_primaria   ?? '#1A2744';
  const cs      = d.cor_secundaria ?? '#E8A020';
  const empresa = e(d.empresa);
  const titulo  = e(d.texto_principal || d.empresa);
  const tSize   = titulo.length > 20 ? 46 : titulo.length > 12 ? 58 : 70;
  const inicial = empresa.charAt(0).toUpperCase() || 'T';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,Helvetica,sans-serif; }
#canvas { width:800px; height:800px; position:relative; overflow:hidden; border-radius:50%; }</style>
</head><body>
<div id="canvas">

  <!-- Base IA -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:800px;height:800px;object-fit:cover;">
  <div style="position:absolute;left:0;top:0;width:800px;height:800px;background:radial-gradient(ellipse at center,rgba(0,0,0,0.34) 0%,transparent 66%);"></div>

  <!-- Borda decorativa circular -->
  <svg style="position:absolute;left:0;top:0;width:800px;height:800px;" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
    <circle cx="400" cy="400" r="390" fill="none" stroke="${cs}" stroke-width="7" opacity="0.72"/>
    <circle cx="400" cy="400" r="376" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.28"/>
  </svg>

  <!-- Logo / monograma centralizado -->
  <div style="position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);">
    ${logo
      ? `<img src="${logo}" style="max-width:320px;max-height:240px;object-fit:contain;display:block;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.42));">`
      : `<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
           <circle cx="80" cy="80" r="76" fill="${cs}"/>
           <text x="80" y="108" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="70" fill="#FFF">${inicial}</text>
         </svg>`}
  </div>

  <!-- Título inferior -->
  <div style="position:absolute;left:50%;bottom:114px;transform:translateX(-50%);white-space:nowrap;">
    <span style="font-size:${tSize}px;font-weight:900;color:#FFFFFF;letter-spacing:2px;text-shadow:0 3px 14px rgba(0,0,0,0.62);">${titulo}</span>
  </div>

</div></body></html>`;
}

// ── Overlay genérico (fallback) ───────────────────────────────────────────────

function _overlayGenerico(d: ProdutoInput, logo: string, baseUrl: string): string {
  const empresa = e(d.empresa);
  const inicial = empresa.charAt(0).toUpperCase() || 'T';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; }
#canvas { width:1200px; height:800px; position:relative; overflow:hidden; }</style>
</head><body>
<div id="canvas">
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:1200px;height:800px;object-fit:cover;">
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);">
    ${logo
      ? `<img src="${logo}" style="max-width:400px;max-height:300px;object-fit:contain;display:block;">`
      : `<span style="font-size:80px;font-weight:900;color:#FFFFFF;">${inicial}</span>`}
  </div>
</div></body></html>`;
}

// ── 4. renderizarFinal ────────────────────────────────────────────────────────

/**
 * Orquestra o fluxo ARTE_HIBRIDA_V1:
 *   1. gerarBaseIA      — IA produz base visual (mock ou Replicate)
 *   2. aplicarOverlayHTML — HTML/SVG aplica todos os textos e logo
 *   3. Retorna ResultadoFinal pronto para o handler Puppeteer
 */
export async function renderizarFinal(
  d: ProdutoInput,
  logo: string,
  env?: Record<string, string>,
): Promise<ResultadoFinal> {
  const decisao = decidirMotorArte(d);
  console.log('[hibrida] decisao:', JSON.stringify(decisao));

  const base = await gerarBaseIA(d, env);
  console.log(`[hibrida] base: provider=${base.provider} mock=${base.mock} prompt="${base.prompt.slice(0, 72)}…"`);

  const html = aplicarOverlayHTML(d, logo, base.url);

  return {
    html,
    w:       decisao.dimensoes.w,
    h:       decisao.dimensoes.h,
    fullDoc: true,
  };
}
