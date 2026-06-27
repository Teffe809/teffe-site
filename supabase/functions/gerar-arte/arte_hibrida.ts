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
  estilo_visual?:      string;
  layout_id?:          string;
  layout_texto?:       string;
  edit_type?:          string;
  observacoes?:        string;
  preco?:              string;
  cta?:                string;
  modo_caneca?:        string;
  modo_criacao?:          string;  // 'ia_pura' — IA generates complete card with text included
  instagram?:             string;
  facebook?:              string;
  servicos?:              string;
  faces?:                 string;  // 'frente' (default) | 'frente_verso'
  background_preference?: string;  // 'branco' | 'escuro' | 'colorido' | 'auto'
  segmento?:              string;  // segmento explícito enviado pela Maya (ex: 'assistencia_tecnica_celular')
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
  provider: 'openai' | 'mock';
  mock:     boolean;
}

export interface ResultadoFinal {
  html:       string;
  w:          number;
  h:          number;
  fullDoc:    boolean;
  _provider?: string;
  _baseUrl?:  string;   // URL pública do Supabase Storage da imagem IA — fallback quando HCTI falha
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
 * Provider: OpenAI DALL-E 3 (requer OPENAI_API_KEY no ambiente).
 * Fallback: mock SVG quando a chave não está configurada ou a chamada falha.
 */
export async function gerarBaseIA(
  d: ProdutoInput,
  _env?: Record<string, string>,
): Promise<BaseIA> {
  const cp      = d.cor_primaria   ?? '#1A2744';
  const cs      = d.cor_secundaria ?? '#E8A020';
  const produto = normalizarTipo(d.tipo_produto ?? '');
  const prompt  = _construirPromptVisual(produto, cp, cs, d);

  // ── OpenAI gpt-image-1 ───────────────────────────────────────────────────────
  // _uploadToStorage usa Deno.env.get() diretamente — não precisa de repasse de env
  const openAiKey = _env?.OPENAI_API_KEY;
  console.log('[hibrida] OPENAI_API_KEY presente:', !!openAiKey);
  console.log('[CARTAO][PROMPT_FINAL]', prompt);

  if (openAiKey) {
    const bg = d.modo_caneca === 'personagem_isolado' ? 'transparent' : 'opaque';
    console.log('[hibrida/openai] gerando base visual gpt-image-1 para', produto, '| background:', bg);
    const resultado = await _chamarOpenAI(prompt, openAiKey, produto, bg);
    if (resultado.url) return { url: resultado.url, prompt, provider: 'openai', mock: false };
    console.warn('[hibrida/openai] falhou:', resultado.erro);
    const svg = _gerarMockSVG(produto, cp, cs);
    return {
      url:      `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
      prompt,
      provider: `mock:${resultado.erro ?? 'openai_falhou'}` as 'mock',
      mock:     true,
    };
  }

  console.log('[hibrida] OPENAI_API_KEY ausente — usando mock SVG');
  const svg     = _gerarMockSVG(produto, cp, cs);
  const baseUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  return { url: baseUrl, prompt, provider: 'mock:key_ausente' as 'mock', mock: true };
}

function _construirPromptVisual(
  produto: string,
  cp: string,
  cs: string,
  d: ProdutoInput,
): string {
  const estilo = d.estilo ?? 'moderno';

  if (produto === 'caneca') {
    if (d.modo_caneca === 'personagem_isolado') return _promptPersonagemCaneca(d);
    return _promptCaneca(cp, cs, estilo);
  }

  // IA pura: OpenAI renders the complete card (all text included in the image)
  if (produto === 'cartao_visita' && d.modo_criacao === 'ia_pura') {
    return _promptCartaoIAPura(cp, cs, d);
  }

  // Prompts específicos por variante híbrida de cartão
  if (produto === 'cartao_visita') {
    const lid = (d.layout_id ?? '').toLowerCase();
    if (lid === 'hibrida_cartao_dark')    return _promptCartaoDark(cp, cs, d);
    if (lid === 'hibrida_cartao_light')   return _promptCartaoLight(cp, cs, d);
    if (lid === 'hibrida_cartao_impacto') return _promptCartaoImpacto(cp, cs, d);
  }

  if (produto === 'adesivo_redondo') return _promptAdesivo(cp, cs, d);

  const prompts: Record<string, string> = {
    cartao_visita:      `Luxury business card background, abstract geometric composition, ${estilo} aesthetic. Primary color ${_nomeCor(cp)} (${cp}), accent ${_nomeCor(cs)} (${cs}). Soft gradients, elegant shapes. NO text, NO letters, NO numbers anywhere.`,
    panfleto:           `Premium marketing flyer background, ${estilo} style. Dominant ${_nomeCor(cp)} with ${_nomeCor(cs)} accents. Abstract flowing shapes, dynamic composition. NO text, NO words anywhere.`,
    adesivo_retangular: `Rectangular sticker background, ${estilo} aesthetic. Colors ${_nomeCor(cp)} and ${_nomeCor(cs)}. Clean abstract shapes. NO text anywhere.`,
  };

  return prompts[produto] ?? `Abstract professional background, ${estilo}, colors ${_nomeCor(cp)} and ${_nomeCor(cs)}. NO text of any kind.`;
}

// Prompt especializado para caneca — otimizado para sublimação horizontal.
function _promptCaneca(cp: string, cs: string, estilo: string): string {
  const cpNome = _nomeCor(cp);
  const csNome = _nomeCor(cs);

  return [
    `Professional sublimation mug wrap artwork, wide horizontal panoramic format.`,
    `Background: deep rich ${cpNome} (${cp}) gradient with ${csNome} (${cs}) accent highlights.`,
    `Visual composition: abstract geometric patterns, concentric elliptical arc curves on the far left and right edges (simulating the planified curvature of a mug),`,
    `smooth flowing sinusoidal wave lines traversing the center horizontally,`,
    `a subtle repeating diagonal line texture across the entire surface,`,
    `fine dot-grid pattern filling the lateral zones,`,
    `a soft radial glow spotlight centered in the middle,`,
    `bold solid color bands (${csNome}) at the very top and very bottom margins.`,
    `Overall style: ${estilo}, high-end corporate brand, premium luxury product design.`,
    `Technical requirements: seamless edges for wrap-around printing, vibrant CMYK-ready colors, ultra-sharp details.`,
    `ABSOLUTE RULE: no text, no letters, no numbers, no words, no typography, no glyphs of any kind anywhere in the image.`,
    `Pure abstract geometric visual composition only.`,
  ].join(' ');
}

function _promptPersonagemCaneca(d: ProdutoInput): string {
  const base = d.ilustracao_prompt ?? 'character illustration';
  return [
    `${base}.`,
    `Isolated character on pure white background, no background elements, no scenery, no frames,`,
    `no rectangles, no banners, no text, no letters, no watermarks.`,
    `Character is large, centered, high detail, professional illustration quality.`,
    `Clean cutout look suitable for product sublimation printing.`,
    `ABSOLUTE RULE: solid white background only — no gradients, no textures, nothing behind the character.`,
  ].join(' ');
}

// ── Personalidade visual por segmento — coração da direção de arte ───────────

interface _SegmentoVisual {
  personalidade: string;
  conceito:      string;
  elementos:     string;
  essencia:      string;
}

function _detectarPersonalidade(d: ProdutoInput): _SegmentoVisual {
  const ctx = [d.empresa ?? '', d.cargo ?? '', d.observacoes ?? '', d.texto_principal ?? ''].join(' ').toLowerCase();
  const est = (d.estilo ?? '').toLowerCase();
  const ev  = (d.estilo_visual ?? '').toLowerCase();

  // ── PRIORIDADE 0: segmento explícito enviado pela Maya ───────────────────────
  // Maya conhece a conversa — confiamos nela, não tentamos adivinhar pelo nome da empresa.
  if (d.segmento) {
    const s = d.segmento.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[-_]+/g, ' ');

    if (/assist.*tec|celular|smartphone|reparo.*cel|conserto.*cel|eletron|inform.*tec|manutenc.*tec/i.test(s))
      return { personalidade: 'technical reliability, professional precision, modern efficiency', conceito: 'the trusted hand of technology — organized, capable, and modern', elementos: 'clean circuit-board trace patterns at low opacity, precise geometric grid lines with technical feel, subtle gear or connector node cluster, cool blue-grey atmospheric depth with accent cyan highlights', essencia: 'confiança · tecnologia · eficiência' };

    if (/advoc|advogad|juridic|oab|direito|escritorio.*law|law.*firm/i.test(s))
      return { personalidade: 'institutional authority, sovereign minimalism, the gravitas of silence', conceito: 'the law needs no ornament — one gold line across darkness is enough', elementos: 'vast breathing negative space in deep charcoal atmospheric depth, a single precise horizontal gold ruling line at 30% height — nothing more. Deliberate institutional silence. Ultra-minimal spatial composition where emptiness itself conveys authority. No geometric grids. No column textures. No circuit traces. No tech patterns. Just refined darkness, white space, and one gold accent of absolute precision', essencia: 'autoridade · minimalismo · dignidade' };

    if (/medic|clinica|saude|hospital|dental|odonto|nutri|fisio|psico|farmac|cirurg|ortop|cardio|pediatr|dermat|oftalmo/i.test(s))
      return { personalidade: 'trusted medical care, human warmth, clinical precision', conceito: 'the healing light — where clinical exactitude meets human compassion', elementos: 'soft healing light gradients, gentle organic flowing forms suggesting vitality, microscopic cellular patterns at ultra-low opacity, calming clinical depth with warm care light beams', essencia: 'acolhimento · confiança · bem-estar' };

    if (/barbearia|barbeiro|barber/i.test(s))
      return { personalidade: 'masculine prestige, sharp precision, urban style authority', conceito: 'the ritual of refinement — where craft meets modern masculinity', elementos: 'clean geometric precision lines, bold angular contrast shapes, razor-sharp edge details, dark rich atmospheric depth with chrome silver and matte texture interplay', essencia: 'estilo · precisão · masculinidade' };

    if (/beleza|estetica|salon|salao|hair|cabelei|nail|maquiag|cosmet|\bspa\b|make/i.test(s))
      return { personalidade: 'sensory luxury, refined elegance, aspirational beauty', conceito: 'the ritual of beauty — where elegance becomes identity', elementos: 'flowing silk-like liquid gradients, ultra-delicate botanical silhouette shadows at 8% opacity, rose-gold and champagne light reflections, luxury marbled surface micro-textures', essencia: 'elegância · sensorialidade · luxo' };

    if (/confeit|doceria|doce|bolo|biscoito|chocolat|candy|sweet|sobremesa/i.test(s))
      return { personalidade: 'artisanal sweetness, sensory delight, handcrafted warmth', conceito: 'every creation a love story — handmade with intention, savored with pleasure', elementos: 'warm pastel-to-cream gradient washes, soft bokeh sugar-dusted light spots, delicate lace-pattern micro-texture at low opacity, warm amber radial light pool at center', essencia: 'amor · artesanato · prazer' };

    if (/padaria|panific|cafe.*artesanal|bakery|cafe/i.test(s))
      return { personalidade: 'warm artisanal comfort, homemade heritage, sensory richness', conceito: 'the warmth of craft — where handmade meets heart', elementos: 'warm amber and ochre radial light pool gradients, organic soft-focus wood-grain micro-texture at low opacity, craft paper tactile surface feel, gentle circular warmth bloom at center', essencia: 'acolhimento · artesanato · calor' };

    if (/grafica|impres|serigrafia|plotag|tipograf|offset|comunicac.*visual|banner|panfleto/i.test(s))
      return { personalidade: 'visual precision, creative craftsmanship, print excellence', conceito: 'where craft meets color — the mastery of visual communication', elementos: 'precise geometric registration mark patterns, bold CMYK-inspired color block geometry, halftone dot-grid at ultra-low opacity, clean production-ready compositional structure', essencia: 'precisão · criatividade · impacto' };

    if (/imobi|imobil|corretor.*imov|imov|apartamento|loteament|construtora.*imov|alto.*padrao/i.test(s))
      return { personalidade: 'premium commercial success, architectural elegance, aspirational lifestyle', conceito: 'the architecture of success — modern lines, upscale positioning, effortless credibility', elementos: 'clean architectural perspective lines suggesting modern buildings, deep sophisticated negative space, precise gold or champagne accent lines, marble-effect surface depth at low opacity', essencia: 'sucesso · credibilidade · padrão' };

    if (/\bpet\b|petshop|pet shop|veterinar|canil|banho.*tosa|animal.?dom/i.test(s))
      return { personalidade: 'playful energy, unconditional care, joyful life force', conceito: 'pure joy — the energy of living beings, movement, warmth and affection', elementos: 'dynamic organic flowing curves suggesting movement and vitality, warm energy wave patterns, playful rhythmic arcs, radiant life-affirming light bursts with soft bokeh warmth', essencia: 'energia · alegria · cuidado' };

    if (/restaur|gastronom|chef|food|comida|lanchon|pizzar|hamburgu|delivery|bistr|bar.*rest/i.test(s))
      return { personalidade: 'culinary passion, sensory richness, artisanal craft', conceito: 'the poetry of flavor — where craft tradition meets gastronomic pleasure', elementos: 'rich warm organic textures suggesting aged wood and natural stone, flowing amber light pools, artisanal hand-crafted surface feel, warm earthy tonal depth with saffron and terracotta accents', essencia: 'paixão · sabor · autenticidade' };

    if (/contab|contador|fiscal|audit|tribut|imposto|financ|banco|invest|segur|credit|capital/i.test(s))
      return { personalidade: 'financial security, trusted prosperity, long-term institutional vision', conceito: 'the architecture of wealth — exactitude, continuity, and measured growth', elementos: 'precise ascending structural grid lines suggesting growth charts, deep vault-like architectural spatial depth, gold precision ruling accents, controlled geometric ascension forms', essencia: 'segurança · prosperidade · exatidão' };

    if (/academia|fitness|personal|gym|musculac|esporte|yoga|pilates|natac|crossfit|treino/i.test(s))
      return { personalidade: 'energetic power, athletic precision, transformative vitality', conceito: 'the body as architecture — strength, form, and relentless improvement', elementos: 'bold dynamic diagonal energy lines suggesting motion and power, high-contrast geometric muscle-like angular forms, electric cyan or neon accent light beams cutting through dark depth, kinetic forward-momentum vector composition', essencia: 'força · movimento · transformação' };

    if (/tech|software|startup|\bti\b|\bdev\b|programac|sistema|dados|digital|cloud|nuvem|ia\b|inteligencia.*artif/i.test(s))
      return { personalidade: 'technological innovation, digital intelligence, connected future', conceito: 'the architecture of intelligence — human creativity meeting machine precision', elementos: 'fine circuit-board micro-traces, flowing data-stream light lines, geometric network node clusters, deep-space atmospheric depth with luminous connection points, pulsing electromagnetic wave patterns', essencia: 'inovação · conectividade · inteligência' };

    if (/educa|escola|colegio|universid|curso|professor|coach|treinamento|capacitac/i.test(s))
      return { personalidade: 'intellectual clarity, inspiring growth, structured discovery', conceito: 'the illumination of potential — structured learning as a beacon of transformation', elementos: 'radiating geometric light structures suggesting expanding knowledge, clean architectural ascending grid, dynamic upward-pointing forms, luminous focal point of clarity surrounded by organized complexity', essencia: 'conhecimento · crescimento · clareza' };

    if (/moda|fashion|roupa|boutique|vestuario|estilista|atelie|design.*moda/i.test(s))
      return { personalidade: 'creative expression, contemporary aesthetic, curated visual identity', conceito: 'editorial boldness — where identity becomes a visual statement', elementos: 'editorial high-contrast abstract graphic composition, fashion-forward bold geometric contrast zones, refined texture interplay of matte and gloss surfaces, strong graphic silhouette shadows', essencia: 'expressão · estilo · originalidade' };

    if (/constru|arquitet|engenh|reforma|\bobra\b|incorpor|design.*interio|paviment/i.test(s))
      return { personalidade: 'structural precision, foundational strength, built to last', conceito: 'the beauty of construction — raw material becoming enduring vision', elementos: 'architectural blueprint grid lines at low opacity, structural perspective vanishing-point lines, concrete and brushed-steel surface textures, bold load-bearing geometric forms suggesting permanence', essencia: 'solidez · precisão · visão' };

    if (/logistic|transport|entrega|frete|motoboy|distribui|\bcarga\b|frota|expedi/i.test(s))
      return { personalidade: 'reliable speed, network precision, operational excellence', conceito: 'the flow of connection — movement, route, delivery, trust at scale', elementos: 'dynamic directional flow lines suggesting routes and movement, network node-and-path patterns at low opacity, strong diagonal momentum vectors, atmospheric depth suggesting vast operational reach', essencia: 'velocidade · confiabilidade · alcance' };

    if (/automoiiv|mecanica|automovel|auto.*pec|borracharia|oficina|carro|veiculo|auto.*center/i.test(s))
      return { personalidade: 'mechanical precision, engineered power, garage authority', conceito: 'the machine perfected — technical mastery meeting road-ready confidence', elementos: 'bold metallic gradient surfaces suggesting polished steel, subtle honeycomb pattern at ultra-low opacity, angular geometric precision forms, deep oil-black atmospheric depth with chrome accent reflections', essencia: 'precisão · potência · confiança' };

    if (/mercado|supermercado|varejo|loja|comercio|atacado|distribuidora/i.test(s))
      return { personalidade: 'bold promotional energy, commercial vibrancy, attention-commanding presence', conceito: 'offer meets excitement — every element selling', elementos: 'bold saturated color explosions radiating from center, dynamic starburst and radial energy bursts, high-contrast promotional diagonal motion lines, vibrant neon-accent highlights at key spots', essencia: 'energia · impacto · venda' };

    if (/fotograf|audiovisual|video|produtor.*conteudo|midia|streaming|studio/i.test(s))
      return { personalidade: 'creative expression, visual mastery, cinematic depth', conceito: 'the art of the captured moment — light, composition, and timeless storytelling', elementos: 'dramatic cinematic depth-of-field atmospheric blur, bokeh light orb clusters at varied depths, film-grain micro-texture at low opacity, strong diagonal composition with directional spotlight drama', essencia: 'arte · visão · criatividade' };
  }

  // ── PRIORIDADE 1: estilo_visual explícito enviado pela Maya ─────────────────

  if (ev === 'infantil' || /anivers[aá]rio.{0,20}(criança|infant|kids?|menino|menina|beb[eê])|lembrancinha|festa.?infant|adesivo.?escolar|party.?kid|birthday.?kid/i.test(ctx))
    return {
      personalidade: 'playful innocence, childhood wonder, Pixar-quality friendliness',
      conceito:      'the magic of childhood — where imagination and joy are the only rules',
      elementos:     'rounded friendly character silhouettes with big expressive eyes, confetti dot-spray in cheerful colors, warm radial celebration light burst, floating balloon-like circular forms, soft pastel-to-vibrant color transitions, playful ribbon-curl celebration elements at the border',
      essencia:      'alegria · fantasia · ternura',
    };

  if (ev === 'anime')
    return {
      personalidade: 'anime aesthetic, manga-inspired visual language, Japanese pop culture energy',
      conceito:      'the world of anime — bold lines, dramatic lighting, expressive character power',
      elementos:     'dramatic speed lines radiating from a luminous focal point, bold geometric color blocks with sharp cel-shaded edges, high-contrast sakura or energy particle scatter, manga-style halftone dot pattern at ultra-low opacity in background',
      essencia:      'intensidade · expressão · cultura',
    };

  if (ev === 'artistico' || /aquarela|watercolor|tinta.?(aquarela|óleo)|pintura.?art|pintura.?manual/i.test(ctx))
    return {
      personalidade: 'fine art sensibility, painterly abstraction, creative authenticity',
      conceito:      'art as identity — organic, fluid, beautifully imperfect',
      elementos:     'fluid watercolor wash gradients with organic color-bleeding edges, loose gestural brushstroke textures, natural pigment granulation surface effect, soft color pooling and bloom spots creating depth',
      essencia:      'criatividade · originalidade · sensibilidade',
    };

  if (ev === 'caricatura')
    return {
      personalidade: 'editorial humor, exaggerated character design, bold graphic personality',
      conceito:      'personality amplified — where character becomes caricature',
      elementos:     'bold graphic shapes with exaggerated proportions, high-contrast color fills with clean hard cartoon edges, editorial illustrative patterns, energetic dynamic motion lines',
      essencia:      'humor · personalidade · expressão',
    };

  if (ev === 'realista')
    return {
      personalidade: 'photorealistic precision, authentic detail, cinematic quality',
      conceito:      'reality elevated — crisp, detailed, unmistakably real',
      elementos:     'photographic-quality lighting with realistic shadows and highlights, detailed surface textures, cinematic depth-of-field bokeh atmosphere, natural color grading',
      essencia:      'autenticidade · precisão · qualidade',
    };

  if (ev === 'promocional' || /supermercado|mercadinho|hipermercado|\boferta\b|promoç|desconto|liquida|black.?friday|loja.?de|varejo|atacado/i.test(ctx))
    return {
      personalidade: 'bold promotional energy, commercial vibrancy, attention-commanding presence',
      conceito:      'offer meets excitement — every element selling',
      elementos:     'bold saturated color explosions radiating from center, dynamic starburst and radial energy bursts, high-contrast promotional diagonal motion lines, vibrant neon-accent highlights at key spots',
      essencia:      'energia · impacto · venda',
    };

  if (ev === 'acolhedor' || /padaria|panific|pão.?artesanal|caf[eé].{0,10}(artesanal|gourmet|especial)|confeit|bistr[oô]|caseiro|home.?made|artesanal/i.test(ctx))
    return {
      personalidade: 'warm artisanal comfort, homemade heritage, sensory richness',
      conceito:      'the warmth of craft — where handmade meets heart',
      elementos:     'warm amber and ochre radial light pool gradients, organic soft-focus wood-grain micro-texture at low opacity, craft paper tactile surface feel, gentle circular warmth bloom at center',
      essencia:      'acolhimento · artesanato · calor',
    };

  if (ev === 'tecnologia_profissional' || /assist[eê]ncia.?t[eé]cnica|conserto|reparo|inform[aá]tic|computador|celular.?(reparo|conserto)|eletr[oô]nic|manut[eê]n/i.test(ctx))
    return {
      personalidade: 'technical reliability, professional precision, modern efficiency',
      conceito:      'the trusted hand of technology — organized, capable, and modern',
      elementos:     'clean circuit-board trace patterns at low opacity, precise geometric grid lines with technical feel, subtle gear or connector node cluster, cool blue-grey atmospheric depth with accent cyan highlights',
      essencia:      'confiança · tecnologia · eficiência',
    };

  if (ev === 'premium_comercial' || /corretor.?(im[oó]vel|de im)|imobiliária|imóvel|apartamento|lançamento.?im|alto.?padrão/i.test(ctx))
    return {
      personalidade: 'premium commercial success, architectural elegance, aspirational lifestyle',
      conceito:      'the architecture of success — modern lines, upscale positioning, effortless credibility',
      elementos:     'clean architectural perspective lines suggesting modern buildings, deep sophisticated negative space, precise gold or champagne accent lines, marble-effect surface depth at low opacity',
      essencia:      'sucesso · credibilidade · padrão',
    };

  if (ev === 'corporativo' || /contab|contabilid|contador|financ[ei]|banco|invest|seguro|cr[eé]dit|capital|patrim[oô]n|audit|fiscal|bolsa|corretora/i.test(ctx))
    return {
      personalidade: 'financial security, trusted prosperity, long-term institutional vision',
      conceito:      'the architecture of wealth — exactitude, continuity, and measured growth',
      elementos:     'precise ascending structural grid lines suggesting growth charts, deep vault-like architectural spatial depth, gold precision ruling accents, controlled geometric ascension forms',
      essencia:      'segurança · prosperidade · exatidão',
    };

  // ── PRIORIDADE 2: detecção por contexto de texto ─────────────────────────────

  if (/cl[ií]nic|m[eé]dic|sa[uú]de|doutor|\bdr\b|hospital|dental|odonto|nutri|fisio|psico|farm[aá]c|cirurg|ortop|dermato|oculist|cardio|ped[ií]at|gineco|urolog/i.test(ctx))
    return { personalidade: 'trusted medical care, human warmth, clinical precision', conceito: 'the healing light — where clinical exactitude meets human compassion', elementos: 'soft healing light gradients, gentle organic flowing forms suggesting vitality, microscopic cellular patterns at ultra-low opacity, calming clinical depth with warm care light beams', essencia: 'acolhimento · confiança · bem-estar' };

  if (/tech|software|\bdev\b|digital|\bapp\b|sistema|tecnologia|\bti\b|\bit\b|dados|\bdata\b|\bia\b|\bai\b|startup|program|inform[aá]tic|rede|servidor|cloud|nuvem|computaç/i.test(ctx))
    return { personalidade: 'technological innovation, digital intelligence, connected future', conceito: 'the architecture of intelligence — human creativity meeting machine precision', elementos: 'fine circuit-board micro-traces, flowing data-stream light lines, geometric network node clusters, deep-space atmospheric depth with luminous connection points, pulsing electromagnetic wave patterns', essencia: 'inovação · conectividade · inteligência' };

  if (/advocac|direito|jur[ií]d|advogad|tribunal|\blei\b|legal|not[aá]ri|procurador|promotor/i.test(ctx))
    return { personalidade: 'institutional authority, sovereign minimalism, the gravitas of silence', conceito: 'the law needs no ornament — one gold line across darkness is enough', elementos: 'vast breathing negative space in deep charcoal atmospheric depth, a single precise horizontal gold ruling line at 30% height — nothing more. Deliberate institutional silence. Ultra-minimal spatial composition where emptiness itself conveys authority. No geometric grids. No column textures. No circuit traces. No tech patterns. Just refined darkness, white space, and one gold accent of absolute precision', essencia: 'autoridade · minimalismo · dignidade' };

  if (/imobili|constru[tç]|arquitet|engenh|reforma|\bobra\b|incorpor|concret|paviment/i.test(ctx))
    return { personalidade: 'structural precision, foundational strength, built to last', conceito: 'the beauty of construction — raw material becoming enduring vision', elementos: 'architectural blueprint grid lines at low opacity, structural perspective vanishing-point lines, concrete and brushed-steel surface textures, bold load-bearing geometric forms suggesting permanence', essencia: 'solidez · precisão · visão' };

  if (/\bpet\b|petshop|pet.?shop|veterin|canil|banho.?tosa|tosa|c[aã]o|cachorro|gato|felino|canino|animal.?dom[eé]stico/i.test(ctx))
    return { personalidade: 'playful energy, unconditional care, joyful life force', conceito: 'pure joy — the energy of living beings, movement, warmth and affection', elementos: 'dynamic organic flowing curves suggesting movement and vitality, warm energy wave patterns, playful rhythmic arcs, radiant life-affirming light bursts with soft bokeh warmth', essencia: 'energia · alegria · cuidado' };

  if (/beleza|est[eé]tic|hair|cabelei|sal[aã]o|\bspa\b|\bnail\b|maquiag|cosmet|barbearia|\bmake\b/i.test(ctx))
    return { personalidade: 'sensory luxury, refined elegance, aspirational beauty', conceito: 'the ritual of beauty — where elegance becomes identity', elementos: 'flowing silk-like liquid gradients, ultra-delicate botanical silhouette shadows at 8% opacity, rose-gold and champagne light reflections, luxury marbled surface micro-textures', essencia: 'elegância · sensorialidade · luxo' };

  if (/restaur|chef|gourmet|culin[aá]|\bbar\b|comida|\bcafé\b|\bcafe\b|padari|confeit|bistr[oô]|lanchon|delivery/i.test(ctx))
    return { personalidade: 'culinary passion, sensory richness, artisanal craft', conceito: 'the poetry of flavor — where craft tradition meets gastronomic pleasure', elementos: 'rich warm organic textures suggesting aged wood and natural stone, flowing amber light pools, artisanal hand-crafted surface feel, warm earthy tonal depth with saffron and terracotta accents', essencia: 'paixão · sabor · autenticidade' };

  if (/educa[cç]|escola|ensino|col[eé]gio|universid|curso|professor|coach|treina|capacit/i.test(ctx))
    return { personalidade: 'intellectual clarity, inspiring growth, structured discovery', conceito: 'the illumination of potential — structured learning as a beacon of transformation', elementos: 'radiating geometric light structures suggesting expanding knowledge, clean architectural ascending grid, dynamic upward-pointing forms, luminous focal point of clarity surrounded by organized complexity', essencia: 'conhecimento · crescimento · clareza' };

  if (/moda|fashion|roupa|vestu[aá]rio|boutique|estilista|\bdesign\b|criativ|agência|fotograf/i.test(ctx))
    return { personalidade: 'creative expression, contemporary aesthetic, curated visual identity', conceito: 'editorial boldness — where identity becomes a visual statement', elementos: 'editorial high-contrast abstract graphic composition, fashion-forward bold geometric contrast zones, refined texture interplay of matte and gloss surfaces, strong graphic silhouette shadows', essencia: 'expressão · estilo · originalidade' };

  if (/gr[aá]fic|impres|tipograf|plotag|comunicaç|serigrafia|offset/i.test(ctx))
    return { personalidade: 'visual precision, creative craftsmanship, print excellence', conceito: 'where craft meets color — the mastery of visual communication', elementos: 'precise geometric registration mark patterns, bold CMYK-inspired color block geometry, halftone dot-grid at ultra-low opacity, clean production-ready compositional structure', essencia: 'precisão · criatividade · impacto' };

  if (/log[ií]stic|transport|entrega|frete|motoboy|distribui|\bcarga\b|rastreament|frota|expedi/i.test(ctx))
    return { personalidade: 'reliable speed, network precision, operational excellence', conceito: 'the flow of connection — movement, route, delivery, trust at scale', elementos: 'dynamic directional flow lines suggesting routes and movement, network node-and-path patterns at low opacity, strong diagonal momentum vectors, atmospheric depth suggesting vast operational reach', essencia: 'velocidade · confiabilidade · alcance' };

  // ── PRIORIDADE 3: estilo genérico → premium ──────────────────────────────────
  if (/minimal|clean|simpl/i.test(est))
    return { personalidade: 'refined minimalism, purposeful simplicity, understated luxury', conceito: 'less is more — every element intentional, nothing superfluous', elementos: 'vast breathing negative space, single precise geometric accent line, ultra-subtle grain texture, refined tonal whispers across the canvas', essencia: 'simplicidade · intenção · elegância' };

  if (/luxo|premium|high.?end|exclusiv/i.test(est))
    return { personalidade: 'ultra-premium positioning, aspirational exclusivity, tasteful opulence', conceito: 'the grammar of luxury — materials that whisper rather than shout', elementos: 'liquid gold light caustics, deep velvet atmospheric depth, micro-textured noble material surfaces, refined geometric gilding accent lines', essencia: 'exclusividade · sofisticação · status' };

  return { personalidade: 'confident professional excellence, trusted authority, premium positioning', conceito: 'the mark of excellence — serious, distinctive, unforgettable', elementos: 'layered atmospheric geometric depth, precise structural light gradients, refined architectural line work, controlled tonal sophistication', essencia: 'profissionalismo · confiança · distinção' };
}

// ── Prompts de cartão — dirigidos pela personalidade da marca ─────────────────

function _promptCartaoDark(cp: string, cs: string, d: ProdutoInput): string {
  const seg      = _detectarPersonalidade(d);
  const marca    = d.empresa ? `"${d.empresa}"` : 'a professional brand';
  const cargo    = d.cargo ? `, ${d.cargo}` : '';
  const obs      = d.observacoes ? ` Client visual directive: "${d.observacoes}".` : '';
  const cpN      = _nomeCor(cp);
  const csN      = _nomeCor(cs);
  const hasLogo  = !!d.logo_url;
  const leftZone = hasLogo
    ? `LEFT HALF (logo placement zone — CRITICAL): This zone must be COMPLETELY CLEAN and EMPTY. Render only a flat dark ${cpN} (${cp}) atmospheric base with a single soft radial light bloom at center. NO geometric shapes, NO symbols, NO icons, NO decorative elements, NO patterns whatsoever in this half. The client's real logo will be composited here — any AI-generated visual element will clash and destroy the result. Total visual emptiness is the correct artistic choice here.`
    : `LEFT HALF (logo zone): serene breathing dark space — ${cpN} (${cp}) atmospheric base, single soft ambient light bloom centered, near-empty minimalism. Brand visual language suggested at 8% opacity only, barely there. The logo must float here with full authority.`;
  return [
    `ROLE: You are a pure visual art director. Your only output is abstract visual composition — no text, no words, no letters anywhere. The overlay system handles all typography and logos separately.`,
    `ART DIRECTION for a dark executive business card — brand: ${marca}${cargo}.`,
    `Visual personality: ${seg.personalidade}. Brand essence: ${seg.essencia}.`,
    `Creative concept: ${seg.conceito}.${obs}`,
    `Format: 2:1 wide horizontal landscape.`,
    leftZone,
    `RIGHT HALF (contact zone): full artistic expression — ${seg.elementos}. ${cpN} (${cp}) dominant base, ${csN} (${cs}) precision accent highlights. Rich layered atmospheric depth. Upper two-thirds stay dark for white text legibility.`,
    `Thin luminous separator line in ${csN} (${cs}) at the center vertical midpoint.`,
    `Directive: "What would a top-tier São Paulo creative agency design exclusively for this specific brand?" Execute that exact vision.`,
    `Palette: ${cpN} (${cp}) dominant, ${csN} (${cs}) refined accent. Deeply atmospheric, unmistakably unique to this brand.`,
    `ABSOLUTE RULES — ZERO EXCEPTIONS: NO WORDS. NO LETTERS. NO NUMBERS. NO BRAND NAMES. NO READABLE TEXT OF ANY KIND. NO TYPOGRAPHY. NO SLOGANS. NO CAPTIONS. NO LOGOS. NO WRITTEN CONTENT WHATSOEVER. Pure VISUAL LANGUAGE only: atmosphere · composition · lighting · abstract forms · depth · visual narrative. All text, names, and logos are applied separately by the overlay system.`,
  ].join(' ');
}

function _promptCartaoLight(cp: string, cs: string, d: ProdutoInput): string {
  const seg      = _detectarPersonalidade(d);
  const marca    = d.empresa ? `"${d.empresa}"` : 'a professional brand';
  const cargo    = d.cargo ? `, ${d.cargo}` : '';
  const obs      = d.observacoes ? ` Client visual directive: "${d.observacoes}".` : '';
  const cpN      = _nomeCor(cp);
  const csN      = _nomeCor(cs);
  const hasLogo  = !!d.logo_url;
  const leftZone = hasLogo
    ? `LEFT HALF (logo placement zone — CRITICAL): This zone must be COMPLETELY CLEAN and EMPTY. Render only a flat white-to-pearl soft gradient with zero other elements. NO shapes, NO symbols, NO icons, NO decorative lines, NO patterns whatsoever in this half. The client's real logo will be composited here — any AI-generated visual element will clash and destroy the result. Total visual emptiness is the correct artistic choice here.`
    : `LEFT HALF (logo zone): bright breathable space — white-to-pearl soft gradient, gentle ${cpN} (${cp}) micro-lines at 4% opacity. Brand visual language hinted at 6% opacity only, barely whispered. Logo commands clear attention in this airy luminous zone.`;
  return [
    `ROLE: You are a pure visual art director. Your only output is abstract visual composition — no text, no words, no letters anywhere. The overlay system handles all typography and logos separately.`,
    `ART DIRECTION for a clean luminous business card — brand: ${marca}${cargo}.`,
    `Visual personality: ${seg.personalidade}. Brand essence: ${seg.essencia}.`,
    `Creative concept: ${seg.conceito}.${obs}`,
    `Format: 2:1 wide horizontal landscape.`,
    leftZone,
    `RIGHT HALF (contact zone): refined light composition with artistic personality — ${seg.elementos} interpreted in light tones. ${cpN} (${cp}) structural hairlines, ${csN} (${cs}) warm highlight accents. Subtle tonal shifts from white to very light pearl-grey. Upper zone stays bright for dark text legibility.`,
    `Directive: "What would a top-tier São Paulo creative agency design exclusively for this specific brand in light?" Execute that exact vision.`,
    `Palette: white and pearl dominant, ${cpN} (${cp}) structural depth accent, ${csN} (${cs}) warm refined highlight.`,
    `ABSOLUTE RULES — ZERO EXCEPTIONS: NO WORDS. NO LETTERS. NO NUMBERS. NO BRAND NAMES. NO READABLE TEXT OF ANY KIND. NO TYPOGRAPHY. NO SLOGANS. NO CAPTIONS. NO LOGOS. NO WRITTEN CONTENT WHATSOEVER. Pure VISUAL LANGUAGE only: atmosphere · composition · lighting · abstract forms · depth · visual narrative. All text, names, and logos are applied separately by the overlay system.`,
  ].join(' ');
}

function _promptCartaoImpacto(cp: string, cs: string, d: ProdutoInput): string {
  const seg      = _detectarPersonalidade(d);
  const marca    = d.empresa ? `"${d.empresa}"` : 'a professional brand';
  const cargo    = d.cargo ? `, ${d.cargo}` : '';
  const obs      = d.observacoes ? ` Client visual directive: "${d.observacoes}".` : '';
  const cpN      = _nomeCor(cp);
  const csN      = _nomeCor(cs);
  const hasLogo  = !!d.logo_url;
  const leftZone = hasLogo
    ? `LEFT HALF (logo placement zone — CRITICAL): This zone must be COMPLETELY CLEAN and EMPTY. Render only a flat ${cpN} (${cp}) solid base with perhaps a single subtle radial glow. NO geometric shapes, NO symbols, NO icons, NO decorative elements, NO patterns whatsoever in this half. The client's real logo will be composited here — any AI-generated visual element will clash and destroy the result. Total visual emptiness is the correct artistic choice here. All creative intensity goes to the RIGHT HALF only.`
    : `LEFT HALF (logo zone — dramatic anchor): bold high-tension visual composition — ${seg.elementos} at full intensity. ${cpN} (${cp}) powerful base, ${csN} (${cs}) striking accent slashes and geometric highlights. Maximum dynamic energy. Center area of this half provides a clean breathing space for logo placement.`;
  return [
    `ROLE: You are a pure visual art director. Your only output is abstract visual composition — no text, no words, no letters anywhere. The overlay system handles all typography and logos separately.`,
    `ART DIRECTION for a maximum-impact business card — brand: ${marca}${cargo}.`,
    `Visual personality: ${seg.personalidade}. Brand essence: ${seg.essencia}.`,
    `Creative concept: ${seg.conceito}.${obs}`,
    `Format: 2:1 wide horizontal landscape.`,
    leftZone,
    `RIGHT HALF (contact zone — power contrast): strong directional light from the left energizes this zone. ${seg.elementos} at full intensity. ${cpN} (${cp}) powerful base, ${csN} (${cs}) striking accent slashes and geometric highlights. Top third: dark enough for large white bold name. Lower section: controlled contrast for contact details.`,
    `Composition: dramatically unified, brand-specific. Not a template — an unmistakable statement.`,
    `Directive: "What would a top-tier São Paulo creative agency design for this brand at maximum visual impact?" Execute fearlessly.`,
    `Palette: ${cpN} (${cp}) and ${csN} (${cs}) at maximum contrast. Bold, powerful, memorable.`,
    `ABSOLUTE RULES — ZERO EXCEPTIONS: NO WORDS. NO LETTERS. NO NUMBERS. NO BRAND NAMES. NO READABLE TEXT OF ANY KIND. NO TYPOGRAPHY. NO SLOGANS. NO CAPTIONS. NO LOGOS. NO WRITTEN CONTENT WHATSOEVER. Pure VISUAL LANGUAGE only: atmosphere · composition · lighting · abstract forms · depth · visual narrative. All text, names, and logos are applied separately by the overlay system.`,
  ].join(' ');
}

// Traduz o segmento para descrição em inglês usada no prompt OpenAI.
function _segmentoDescricaoEN(segmento: string): string {
  const s = segmento.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_]+/g, ' ');

  if (/assist.*tec|celular|smartphone|reparo.*cel|conserto.*cel|eletron|inform.*tec|manutenc.*tec/i.test(s))
    return `BUSINESS SEGMENT: Mobile phone and electronics repair service (smartphone repair, screen replacement, battery replacement, technical support for Apple and Samsung devices).\n\nVISUAL DIRECTION: Modern technology aesthetic. Apple and Samsung inspired clean precision. Subtle circuit-board trace details. Smartphone repair expertise. Electric blue or cyan accent energy. Technical grid precision. Fast professional service. Trusted device care. Innovation and reliability.`;

  if (/advoc|advogad|juridic|oab|direito|escritorio.*law/i.test(s))
    return `BUSINESS SEGMENT: Law firm / legal services / attorney.\n\nVISUAL DIRECTION: Institutional authority and legal prestige. Classic gravitas and sovereign minimalism. Deep navy or charcoal dominance. Gold accent restraint. Architectural negative space. The weight of the law — serious, distinguished, unimpeachable.`;

  if (/medic|clinica|saude|hospital|dental|odonto|nutri|fisio|psico|farmac|cirurg|cardio|pediatr|dermat|oftalmo/i.test(s))
    return `BUSINESS SEGMENT: Healthcare / medical clinic / health professional.\n\nVISUAL DIRECTION: Clinical purity and human warmth. Trust and care. Soft blue and white precision. Calming expertise. Healing atmosphere. Approachable professionalism. Patient-centered confidence.`;

  if (/barbearia|barbeiro|barber/i.test(s))
    return `BUSINESS SEGMENT: Barbershop / men's grooming.\n\nVISUAL DIRECTION: Masculine prestige and urban style authority. Sharp geometric precision. Dark rich tones with chrome silver accents. Modern barbershop culture. Classic craft meets contemporary edge. Confidence and style.`;

  if (/beleza|estetica|salon|salao|hair|cabelei|nail|maquiag|cosmet|\bspa\b|make/i.test(s))
    return `BUSINESS SEGMENT: Beauty salon / aesthetics / spa / nail studio.\n\nVISUAL DIRECTION: Sensory luxury and aspirational beauty. Rose gold and champagne elegance. Silk-like soft gradients. Refined feminine aesthetic. Premium self-care. Glamour and sophistication.`;

  if (/confeit|doceria|doce|bolo|biscoito|chocolat|candy|sweet|sobremesa/i.test(s))
    return `BUSINESS SEGMENT: Confectionery / bakery / desserts / sweets.\n\nVISUAL DIRECTION: Artisanal sweetness and handcrafted warmth. Soft pastel-to-cream palette. Sugar-dusted bokeh light. Delicate lace texture details. Homemade love. Sweet indulgence. Warm and inviting.`;

  if (/padaria|panific|cafe.*artesanal|bakery/i.test(s))
    return `BUSINESS SEGMENT: Bakery / artisanal café / bread and coffee.\n\nVISUAL DIRECTION: Artisanal warmth and homemade heritage. Amber and ochre radial warmth. Wood-grain texture depth. Craft paper sensibility. Comforting, authentic, welcoming.`;

  if (/grafica|impres|serigrafia|plotag|tipograf|offset|comunicac.*visual/i.test(s))
    return `BUSINESS SEGMENT: Print shop / graphic arts / visual communication.\n\nVISUAL DIRECTION: Visual precision and print craft mastery. Bold CMYK-inspired color blocks. Registration mark precision geometry. Halftone dot textures. Color as craft. Professional production quality.`;

  if (/imobi|imobil|corretor.*imov|imov|apartamento|loteament|alto.*padrao/i.test(s))
    return `BUSINESS SEGMENT: Real estate / property broker / developer.\n\nVISUAL DIRECTION: Architectural elegance and premium lifestyle. Clean perspective lines suggesting modern buildings. Gold or champagne accent restraint. Marble-effect depth. Aspirational and credible.`;

  if (/\bpet\b|petshop|pet shop|veterinar|canil|banho.*tosa|animal.?dom/i.test(s))
    return `BUSINESS SEGMENT: Pet shop / veterinary clinic / animal grooming.\n\nVISUAL DIRECTION: Playful energy and unconditional care. Dynamic organic flowing curves. Warm joyful color energy. Life-affirming light bursts. Movement, warmth, and affection.`;

  if (/restaur|gastronom|chef|food|comida|lanchon|pizzar|hamburgu|delivery|bistr|bar.*rest/i.test(s))
    return `BUSINESS SEGMENT: Restaurant / gastronomy / food service.\n\nVISUAL DIRECTION: Culinary passion and sensory richness. Aged wood and natural stone textures. Amber warmth pools. Artisanal craft depth. Terracotta and saffron accent tones. Flavor as visual poetry.`;

  if (/contab|contador|fiscal|audit|tribut|imposto|financ|banco|invest|segur|credit|capital/i.test(s))
    return `BUSINESS SEGMENT: Accounting / finance / insurance / investments.\n\nVISUAL DIRECTION: Financial security and trusted prosperity. Ascending structural grid lines. Deep vault-like depth. Gold precision ruling accents. Institutional gravitas. Exactitude and measured growth.`;

  if (/academia|fitness|personal|gym|musculac|esporte|yoga|pilates|natac|crossfit|treino/i.test(s))
    return `BUSINESS SEGMENT: Gym / fitness / personal trainer / sports.\n\nVISUAL DIRECTION: Energetic power and athletic precision. Bold diagonal energy lines. Angular high-contrast forms. Electric cyan or neon accent beams. Kinetic forward-momentum composition. Strength and transformation.`;

  if (/tech|software|startup|\bti\b|\bdev\b|programac|sistema|dados|digital|cloud|nuvem|ia\b|inteligencia.*artif/i.test(s))
    return `BUSINESS SEGMENT: Technology / software / IT services / startup.\n\nVISUAL DIRECTION: Digital intelligence and connected innovation. Circuit-board micro-traces. Data-stream light lines. Network node clusters. Deep-space atmospheric depth. Luminous connection points. Human creativity meeting machine precision.`;

  if (/educa|escola|colegio|universid|curso|professor|coach|treinamento|capacitac/i.test(s))
    return `BUSINESS SEGMENT: Education / school / courses / coaching.\n\nVISUAL DIRECTION: Intellectual clarity and inspiring growth. Radiating geometric knowledge structures. Clean ascending architectural grid. Upward-pointing dynamic forms. Luminous focal clarity. Structured discovery.`;

  if (/moda|fashion|roupa|boutique|vestuario|estilista|atelie/i.test(s))
    return `BUSINESS SEGMENT: Fashion / clothing / boutique / designer.\n\nVISUAL DIRECTION: Editorial boldness and contemporary aesthetic. High-contrast geometric zones. Matte and gloss texture interplay. Strong graphic silhouette shadows. Identity as visual statement.`;

  if (/constru|arquitet|engenh|reforma|\bobra\b|incorpor|design.*interio/i.test(s))
    return `BUSINESS SEGMENT: Construction / architecture / engineering / interior design.\n\nVISUAL DIRECTION: Structural precision and foundational strength. Architectural blueprint grid lines. Structural perspective vanishing-point lines. Concrete and brushed-steel textures. Built to last.`;

  if (/logistic|transport|entrega|frete|motoboy|distribui|\bcarga\b|frota/i.test(s))
    return `BUSINESS SEGMENT: Logistics / transportation / delivery.\n\nVISUAL DIRECTION: Reliable speed and network precision. Directional flow lines suggesting routes. Node-and-path motion patterns. Diagonal momentum vectors. Vast operational reach.`;

  if (/automotiv|mecanica|automovel|auto.*pec|borracharia|oficina|carro|veiculo/i.test(s))
    return `BUSINESS SEGMENT: Automotive / car repair / auto parts.\n\nVISUAL DIRECTION: Mechanical precision and engineered power. Polished steel metallic gradients. Honeycomb pattern depth. Angular geometric precision. Oil-black depth with chrome accents. Road-ready confidence.`;

  if (/mercado|supermercado|varejo|loja|comercio|atacado|distribuidora/i.test(s))
    return `BUSINESS SEGMENT: Retail / supermarket / commerce.\n\nVISUAL DIRECTION: Bold promotional energy and commercial vibrancy. Saturated color bursts. Dynamic starburst energy. High-contrast promotional geometry. Vibrant and attention-commanding.`;

  if (/fotograf|audiovisual|video|produtor.*conteudo|midia|streaming|studio/i.test(s))
    return `BUSINESS SEGMENT: Photography / videography / media production.\n\nVISUAL DIRECTION: Cinematic depth and visual mastery. Dramatic bokeh light clusters. Film-grain texture depth. Diagonal spotlight drama. The art of the captured moment.`;

  // segmento presente mas sem mapeamento específico — usa o valor bruto
  return `BUSINESS SEGMENT: ${segmento}.\n\nVISUAL DIRECTION: Professional, premium, distinctive. Design that immediately communicates the brand's core identity.`;
}

// Direção criativa por segmento — o que um art director de agência top enviaria à OpenAI.
// Sempre retorna um brief rico, mesmo sem segmento definido (usa default genérico premium).
function _buildArtDirectorBrief(segmento: string): string {
  const s = (segmento || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_]+/g, ' ');

  if (/assist.*tec|celular|smartphone|reparo.*cel|conserto.*cel|eletron|inform.*tec|manutenc.*tec/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that feels designed by a professional technology branding agency.

The visual impact must be immediate and commanding. The aesthetic must evoke premium technology brands — think Apple Store expertise meets high-end electronics boutique.

DESIGN DIRECTION:
Deep technological atmosphere. Navy or electric blue as the dominant spatial depth. Subtle circuit-board aesthetics used as refined texture, not literal decoration. Clean geometric precision with razor-sharp edges. Electric cyan or blue-white accent light suggesting innovation and electricity. Strong typographic presence — the brand name dominates with authority.

Composition: asymmetric with intentional negative space. The card should feel three-dimensional, as if the design has depth and atmosphere. Dramatic lighting from one corner creating depth and sophistication.

The customer should immediately feel: "This is a professional, modern company I can trust with my device."

Avoid generic blue-to-grey gradient. Avoid flat boxy centered layout. Avoid literal tech clipart (circuit boards, smartphone outlines). Avoid anything resembling a Word document or invoice.

The result must feel like a premium technology brand — memorable, modern, and desirable.`;

  if (/advoc|advogad|juridic|oab|direito|escritorio.*law/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card worthy of the most prestigious law firm in the city.

The aesthetic must embody institutional authority through restraint. Inspired by top-tier São Paulo law firms, Swiss private banking cards, and luxury corporate identity — where less is more, and every element carries weight.

DESIGN DIRECTION:
Commanding negative space — vast, breathing, deliberate emptiness. Deep charcoal or navy atmosphere of absolute authority. A single gold ruling line or refined geometric accent placed with mathematical precision. Typography that suggests engraved letterpress quality. The brand name presented as an institution, not a business.

The card should feel like a handshake from someone who wins every case.

Composition: asymmetric tension through controlled minimalism. Power communicated precisely BECAUSE the design shows almost nothing.

Avoid busy patterns. Avoid warm or friendly colors. Avoid multiple competing visual elements. Avoid gradient-heavy backgrounds.

The result must feel like authority distilled into a rectangle — serious, distinguished, unforgettable.`;

  if (/medic|clinica|saude|hospital|dental|odonto|nutri|fisio|psico|farmac|cirurg|cardio|pediatr|dermat|oftalmo/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that inspires immediate trust and conveys expert care.

The aesthetic must balance clinical precision with human warmth. Inspired by premium private healthcare clinics and international hospital brand identities — where expertise meets compassion.

DESIGN DIRECTION:
Clean light atmosphere — white, pearl, or soft blue as the dominant spatial environment. Gentle flowing organic forms suggesting vitality and life. Soft gradient depth with a warm center glow suggesting care and healing. The visual language must feel both precise and reassuring. Subtle geometric precision balanced with organic softness.

The patient should immediately feel: "I am in safe, expert hands."

Composition: calm, centered authority. Breathable space. The brand name presented with quiet confidence.

Avoid clinical cold sterility. Avoid heavy dark backgrounds. Avoid busy patterns or aggressive geometry. Avoid anything commercial or promotional.

The result must feel like premium healthcare — trustworthy, caring, and expert.`;

  if (/barbearia|barbeiro|barber/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that captures the culture of premium men's grooming.

The aesthetic must evoke the modern barbershop — where old-world craft meets contemporary urban style. Inspired by high-end barbershop brands and luxury men's grooming culture.

DESIGN DIRECTION:
Masculine richness — deep dark tones as the dominant atmosphere. Matte black or deep charcoal with metallic silver or sharp white accents. Razor-precise geometric lines suggesting craftsmanship. Think barber pole geometry deconstructed into premium brand language. Strong typography that commands respect. Chrome-like accent reflections.

The client should immediately feel: "This is a serious craft establishment."

Composition: strong diagonal or geometric energy. High contrast. Bold visual tension. The brand name positioned as a badge of quality.

Avoid soft or pastel tones. Avoid overly traditional barbershop clichés. Avoid generic corporate appearance. Avoid weak or low-contrast composition.

The result must feel like premium men's style — confident, precise, and distinctly masculine.`;

  if (/beleza|estetica|salon|salao|hair|cabelei|nail|maquiag|cosmet|\bspa\b|make/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that embodies feminine luxury and aspirational beauty.

The aesthetic must feel like a premium beauty brand. Inspired by Sephora's editorial direction, luxury spa branding, and high-fashion beauty campaigns.

DESIGN DIRECTION:
Sensory luxury atmosphere — rose gold, champagne, soft blush, or pearl as the dominant palette experience. Silk-like gradient depth that feels tactile. Ultra-delicate botanical shadow elements at barely-visible opacity. Light reflections suggesting glossy polished surfaces. The visual language should feel aspirational, desirable, and feminine.

The client should immediately feel: "This is a premium beauty experience worth choosing."

Composition: elegant, flowing, with refined asymmetric balance. The card should feel like it was printed on textured premium paper. White space used as luxury.

Avoid flat pink without depth or texture. Avoid overly literal beauty icons. Avoid busy or crowded composition. Avoid colors that feel cheap or mass-market.

The result must feel like a luxury beauty brand — elegant, desirable, and aspirationally premium.`;

  if (/confeit|doceria|doce|bolo|biscoito|chocolat|candy|sweet|sobremesa/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that makes the viewer immediately crave the product.

The aesthetic must evoke artisanal craftsmanship and sweet indulgence. Inspired by Parisian patisserie branding, premium chocolate houses, and high-end dessert boutiques.

DESIGN DIRECTION:
Warm, inviting atmosphere. Soft cream, blush, or warm pastel tones as the spatial base. Delicate lace-work or fine floral pattern as a barely-visible surface texture. Warm amber or gold accent light suggesting warmth and craftsmanship. The visual language should feel handcrafted, precious, and artisanal — as if the card itself were a beautiful gift box.

The client should immediately feel: "These products are crafted with love and expertise."

Composition: soft and flowing, with elegant feminine grace. Generous white space that frames the content like a ribbon on a gift.

Avoid commercial or supermarket aesthetic. Avoid heavy dark backgrounds. Avoid anything that feels mass-produced.

The result must feel like an artisanal luxury confectionery brand — warm, beautiful, and unforgettable.`;

  if (/padaria|panific|cafe.*artesanal|bakery/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that communicates the warmth of artisanal craft.

The aesthetic must evoke an authentic premium bakery — where tradition meets contemporary food culture. Inspired by artisanal coffee shop branding, organic bakery identity, and craft food boutiques.

DESIGN DIRECTION:
Warm amber and ochre atmospheric depth. Subtle wood-grain or craft paper surface texture at low opacity. Warm radial light bloom at center suggesting an oven's warmth. The visual language should feel honest, artisanal, and inviting — as if handmade with care. Natural, organic color palette.

The client should immediately feel: "This place creates something genuine and worth visiting."

Composition: organic and warm, with earthy balance. Strong typographic presence that feels artisanal rather than corporate.

Avoid cold, clinical, or corporate appearance. Avoid bright neon or technological aesthetics. Avoid generic food clipart. Avoid overly modern or minimal — this should feel warm and human.

The result must feel like a premium artisanal bakery or café — authentic, warm, and full of character.`;

  if (/grafica|impres|serigrafia|plotag|tipograf|offset|comunicac.*visual/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that demonstrates visual expertise through its own design.

The aesthetic must be self-referential — a graphic design business card that IS a demonstration of design mastery. Inspired by award-winning branding agencies, Pentagram's identity work, and premium print production houses.

DESIGN DIRECTION:
Bold typographic dominance — the brand name treated as a graphic art object. Precise CMYK-inspired color geometry used as a visual language. Halftone dot textures at ultra-subtle opacity suggesting print mastery. Registration mark elements that reference the craft of printing. The card itself should feel like a piece of print production art.

The client should immediately feel: "This company UNDERSTANDS design at the highest level."

Composition: strong, confident, and deliberately unexpected. Asymmetric, bold, and visually distinctive. The card becomes a portfolio piece in itself.

Avoid safe conventional layouts. Avoid weak typographic hierarchy. Avoid generic technology aesthetics.

The result must feel like it was designed by a master of visual communication — bold, precise, and impressive.`;

  if (/imobi|imobil|corretor.*imov|imov|apartamento|loteament|alto.*padrao/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that communicates real estate success and premium lifestyle.

The aesthetic must evoke the aspirational world of premium real estate — luxury residential towers, upscale lifestyle, and architectural ambition. Inspired by high-end real estate developer branding and luxury condominium identity.

DESIGN DIRECTION:
Architectural sophistication — clean perspective lines suggesting premium buildings. Deep sophisticated dark atmosphere with gold or champagne accent precision. Marble-effect surface micro-texture at low opacity. The visual language should feel expensive, aspirational, and confidence-inspiring. Deep navy or charcoal as the base of authority, with precise gold ruling lines.

The client should immediately feel: "I can trust this professional with my most valuable asset."

Composition: structured, elegant, and premium. Strong vertical or diagonal architectural lines. The brand name positioned with authority.

Avoid budget real estate aesthetics. Avoid literal house or building icons. Avoid overly warm or friendly tones.

The result must feel like luxury real estate branding — aspirational, trustworthy, and distinctly premium.`;

  if (/\bpet\b|petshop|pet shop|veterinar|canil|banho.*tosa|animal.?dom/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card full of joy and genuine care energy.

The aesthetic must capture the emotional connection between people and their pets. Inspired by premium pet care brands, modern veterinary clinic identity, and contemporary pet lifestyle brands.

DESIGN DIRECTION:
Warm, joyful visual energy — flowing dynamic organic curves suggesting movement and life. Warm accent colors that radiate affection and vitality. Radiant light burst patterns suggesting joy. The visual language should feel energetic, caring, and full of life — not clinical or sterile.

The client should immediately feel: "These people truly love animals and will care for mine."

Composition: dynamic and flowing, with playful energy controlled by professional structure.

Avoid clinical veterinary coldness. Avoid literal paw print clichés. Avoid flat static composition. Avoid boring corporate standard.

The result must feel like premium pet care — loving, professional, and full of genuine warmth.`;

  if (/restaur|gastronom|chef|food|comida|lanchon|pizzar|hamburgu|delivery|bistr|bar.*rest/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that makes the viewer immediately hungry.

The aesthetic must evoke gastronomic passion and culinary mastery. Inspired by Michelin-starred restaurant branding, premium food delivery apps, and artisanal restaurant identity design.

DESIGN DIRECTION:
Sensory richness — warm amber light pools, aged wood and natural stone textural depth, rich earthy palette with terracotta and saffron accents. The visual language should evoke taste, warmth, and culinary craft. Deep atmospheric warmth that suggests a kitchen with soul.

The client should immediately feel: "This is a place with genuine culinary passion."

Composition: warm, bold, and atmospheric. Rich texture depth. Strong brand name presence.

Avoid fast food or delivery app aesthetic. Avoid clinical or cold visual environment. Avoid generic food clipart. Avoid flat colors without atmosphere.

The result must feel like a premium food brand — passionate, warm, and absolutely memorable.`;

  if (/contab|contador|fiscal|audit|tribut|imposto|financ|banco|invest|segur|credit|capital/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that radiates financial trustworthiness and institutional solidity.

The aesthetic must communicate the security and precision of top-tier financial services. Inspired by premium private banking identity, top accounting firm branding, and investment management visual communication.

DESIGN DIRECTION:
Structural precision — ascending grid lines suggesting growth and order. Deep vault-like atmospheric spatial depth. Gold precision ruling accents used with extreme restraint. Deep navy or charcoal as the dominant atmosphere of authority.

The client should immediately feel: "I can entrust my financial future to this professional."

Composition: structured, balanced, and authoritative. Strong geometric precision. The brand name presented as an institution.

Avoid anything casual, warm, or approachable. Avoid bright colors. Avoid promotional energy. Avoid generic corporate look without distinction.

The result must feel like premium financial services — trustworthy, precise, and institutionally solid.`;

  if (/academia|fitness|personal|gym|musculac|esporte|yoga|pilates|natac|crossfit|treino/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that radiates athletic power and transformative energy.

The aesthetic must evoke premium fitness culture — where performance meets lifestyle. Inspired by Nike's brand direction, premium gym identities, and high-performance sports branding.

DESIGN DIRECTION:
Dynamic power — bold diagonal energy lines suggesting motion and forward momentum. High-contrast light beams cutting through dark atmospheric depth. Electric accent color — cyan, neon green, or electric blue — as a single explosive line of energy. Strong angular geometric forms suggesting the body in motion.

The client should immediately feel: "This training will transform me."

Composition: aggressive diagonal energy with controlled structure. The brand name positioned as a battle cry. Maximum visual impact.

Avoid soft, gentle, or rounded aesthetics. Avoid generic gym equipment icons. Avoid safe corporate blue and grey. Avoid static or flat composition.

The result must feel like premium fitness culture — powerful, dynamic, and aspirationally motivating.`;

  if (/tech|software|startup|\bti\b|\bdev\b|programac|sistema|dados|digital|cloud|nuvem|ia\b|inteligencia.*artif/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card worthy of a frontier technology company.

The aesthetic must communicate digital intelligence and innovation leadership. Inspired by leading tech company visual identity, cybersecurity firms, and data science brand language.

DESIGN DIRECTION:
Deep space-like atmospheric darkness — deep navy or near-black as the immersive environment. Fine luminous data-stream lines flowing in one directional vector, suggesting the movement of information. Geometric network node clusters at low opacity. Luminous connection points of electric blue or cyan. The visual language should feel intelligent, precise, and forward-looking.

The client should immediately feel: "This company is at the frontier of technology."

Composition: deep, three-dimensional, atmospheric. The brand name should glow with quiet authority against the dark depth.

Avoid generic blue tech without depth. Avoid literal code or binary visual clichés. Avoid overly complex patterns. Avoid anything dated.

The result must feel like a frontier technology company — intelligent, modern, and distinctly innovative.`;

  if (/educa|escola|colegio|universid|curso|professor|coach|treinamento|capacitac/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that inspires intellectual growth and confident expertise.

The aesthetic must communicate the power of knowledge and transformative learning. Inspired by premium education brand identities, TED Talks visual language, and prestigious university communications.

DESIGN DIRECTION:
Radiating light structures — geometric beams from a luminous focal point suggesting expanding knowledge. Clean ascending grid suggesting structured growth. Dynamic upward-pointing forms communicating progress and advancement. A palette balancing intellectual authority with warmth.

The client should immediately feel: "This person or institution will genuinely advance my growth."

Avoid overly academic coldness. Avoid childish aesthetics. Avoid generic corporate blue. Avoid static layouts with no direction or growth.

The result must feel like premium education — inspiring, authoritative, and genuinely transformative.`;

  if (/moda|fashion|roupa|boutique|vestuario|estilista|atelie/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that IS a fashion editorial statement.

The aesthetic must push boundaries and communicate creative authorship. Inspired by high fashion magazine art direction, luxury fashion house visual identity, and contemporary designer branding.

DESIGN DIRECTION:
Editorial boldness — high-contrast geometric zones creating visual tension. Strong graphic silhouette shadows. Refined texture interplay between matte and gloss surface qualities. The visual language should feel contemporary, unexpected, and distinctly authored. The card should feel like it could appear in a fashion publication.

The client should immediately feel: "This is a genuine creative vision, not just a service."

Composition: deliberately asymmetric, visually daring, and confidently imperfect. The brand name as a typographic art object.

Avoid safe, predictable, or conventional layouts. Avoid generic fashion clichés. Avoid overly commercial aesthetic. Avoid anything that doesn't take visual risks.

The result must feel like premium fashion identity — bold, editorial, and distinctly personal.`;

  if (/constru|arquitet|engenh|reforma|\bobra\b|incorpor|design.*interio/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card as solid and precise as the structures the client builds.

The aesthetic must evoke architectural excellence and engineering mastery. Inspired by top architecture firm branding, premium construction company identity, and luxury real estate development visual language.

DESIGN DIRECTION:
Structural precision — architectural blueprint grid lines at refined opacity. Perspective vanishing-point lines suggesting depth and built space. Brushed-steel and concrete textural depth. Bold geometric forms that feel permanent and authoritative. The visual language should feel like it was designed by an architect — precise, considered, and built to last.

The client should immediately feel: "This is a company I can trust to build something that will endure."

Composition: architectural rigor — straight lines, measured spacing, structural hierarchy. The brand name as a cornerstone.

Avoid decorative or ornamental elements. Avoid warm or cozy aesthetics. Avoid generic contractor look. Avoid weak or soft composition.

The result must feel like premium construction and architecture — precise, authoritative, and built to impress.`;

  if (/logistic|transport|entrega|frete|motoboy|distribui|\bcarga\b|frota/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card that communicates speed, reliability, and operational scale.

The aesthetic must evoke a world-class logistics operation. Inspired by DHL's brand precision and premium courier service visual identity.

DESIGN DIRECTION:
Dynamic directional energy — bold diagonal flow lines suggesting routes and movement at high speed. Network node-and-path patterns at refined opacity suggesting operational reach. Strong momentum vectors. Deep atmospheric depth suggesting vast operational scale.

The client should immediately feel: "This company will get it there, on time, every time."

Composition: forward momentum, diagonal energy, strong directional flow. The brand name positioned as a guarantee.

Avoid static or slow composition. Avoid literal truck or vehicle clipart. Avoid corporate blue without personality.

The result must feel like premium logistics — fast, reliable, and professionally scaled.`;

  if (/automotiv|mecanica|automovel|auto.*pec|borracharia|oficina|carro|veiculo/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card as precise as the engines the client services.

The aesthetic must evoke automotive mastery and mechanical excellence. Inspired by premium auto dealer branding, Formula 1 team identity, and high-performance automotive parts brands.

DESIGN DIRECTION:
Mechanical sophistication — polished steel metallic gradient surfaces suggesting machined precision. Subtle honeycomb or carbon fiber pattern at ultra-low opacity. Angular geometric precision forms with razor-sharp edges. Deep oil-black atmospheric depth with chrome accent reflections.

The client should immediately feel: "This workshop delivers precision workmanship and can be trusted with my vehicle."

Composition: powerful, angular, and precisely engineered. The brand name positioned with authority.

Avoid generic grease-and-garage aesthetic. Avoid literal car or wrench clipart. Avoid flat or uninspired corporate look.

The result must feel like premium automotive services — powerful, precise, and trustworthy.`;

  if (/mercado|supermercado|varejo|loja|comercio|atacado|distribuidora/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card with bold commercial energy and instant visual appeal.

The aesthetic must communicate vibrant commercial confidence. Inspired by premium retail branding and successful commercial identity design.

DESIGN DIRECTION:
Bold promotional energy — saturated color with visual impact. Dynamic radiating energy bursts. High-contrast geometry. Vibrant, attention-commanding palette. The card should feel like it immediately sells the business.

The client should immediately feel: "This is a confident, successful commercial operation."

Composition: bold, energetic, direct. The brand name presented with commercial confidence.

Avoid bland corporate neutrality. Avoid low-contrast or timid design. Avoid anything forgettable.

The result must feel like a bold, successful commercial brand — vibrant, memorable, and immediately appealing.`;

  if (/fotograf|audiovisual|video|produtor.*conteudo|midia|streaming|studio/i.test(s))
    return `ART DIRECTOR BRIEF

Create a business card with cinematic depth and visual mastery.

The aesthetic must evoke the art of visual storytelling. Inspired by award-winning photography studios, film production house identity, and premium creative agency brand language.

DESIGN DIRECTION:
Dramatic cinematic atmosphere — deep depth-of-field spatial layering. Bokeh light orb clusters at varied depths. Film-grain micro-texture at low opacity. Strong diagonal composition with directional spotlight drama. The visual language should feel like a frame from a beautiful film.

The client should immediately feel: "This person sees the world differently — and captures it perfectly."

Composition: dramatic, cinematic, atmospheric. The brand name with quiet artistic authority.

Avoid generic photography backdrop clichés. Avoid literal camera icons. Avoid flat or boxy composition.

The result must feel like a premium creative visual brand — artistic, cinematic, and memorably distinctive.`;

  // Default — premium generic brief when no specific segment
  return `ART DIRECTOR BRIEF

Create a business card that demonstrates professional excellence and genuine brand distinction.

This is not a template fill-in. This is a unique branded artifact — designed specifically for this business as if commissioned from a top São Paulo creative agency.

DESIGN DIRECTION:
Sophisticated atmospheric composition with intentional depth and spatial layering. Strong typographic hierarchy — the brand name commands immediate attention. Professional use of negative space — what is absent matters as much as what is present. Refined color palette applied with restraint and intention. Lighting and depth that create a three-dimensional feel.

The viewer should immediately feel: "This is a professional I want to do business with."

Composition: asymmetric balance with visual tension. The card must feel like it was designed for this specific business, not generated from a template library.

Avoid generic corporate layouts that could apply to any company. Avoid flat document-like appearance with no atmosphere. Avoid literal or clipart-style visual elements. Avoid overly centered, symmetric, or boxy composition. Avoid anything that looks auto-generated or software-produced.

The result must feel professionally crafted — memorable, distinctive, and visually impressive.`;
}

function _promptCartaoIAPura(cp: string, cs: string, d: ProdutoInput): string {
  const seg  = _detectarPersonalidade(d);
  const cpN  = _nomeCor(cp);
  const csN  = _nomeCor(cs);
  const obs  = d.observacoes ? `\n\nSPECIAL CLIENT DIRECTIVE (must be honored): "${d.observacoes}"` : '';
  const faces = (d.faces ?? 'frente').toLowerCase();
  const bgPref = (d.background_preference ?? 'auto').toLowerCase();

  // ── RESTRIÇÃO DE FACES ────────────────────────────────────────────────────
  const facesConstraint = faces === 'frente_verso'
    ? [
        `LAYOUT: Show BOTH sides of the business card as a wide panoramic image.`,
        `Left half = FRONT (company name, logo area, brand identity).`,
        `Right half = BACK (all contact details).`,
      ].join(' ')
    : [
        `LAYOUT CONSTRAINT — FRONT SIDE ONLY:`,
        `Generate ONLY the front face of a single business card.`,
        `DO NOT show the back side.`,
        `DO NOT show two cards side by side.`,
        `DO NOT create a front-and-back mockup.`,
        `DO NOT split the image into two halves for front/back.`,
        `The entire image frame is ONE single card front face.`,
        `ALL information (company name + contact details) must appear on this single front face.`,
      ].join(' ');

  // ── RESTRIÇÃO DE BACKGROUND ──────────────────────────────────────────────
  const bgConstraint = (() => {
    if (bgPref === 'branco') return [
      `BACKGROUND CONSTRAINT — WHITE/LIGHT MANDATORY:`,
      `The card background MUST be white, off-white, cream, pearl, or very light grey.`,
      `DO NOT use dark backgrounds. DO NOT use black, navy, dark blue, or any dark solid color as the card background.`,
      `Use dark-colored typography (dark grey, navy ${cp}, or charcoal) for strong contrast against the light background.`,
      `Accent color ${csN} (${cs}) can be used for highlights, borders, and accent elements only.`,
    ].join(' ');
    if (bgPref === 'escuro') return [
      `BACKGROUND: Rich dark background — deep ${cpN} (${cp}) or charcoal.`,
      `White or light typography for contrast. ${csN} (${cs}) accent elements.`,
    ].join(' ');
    if (bgPref === 'colorido') return [
      `BACKGROUND: Vibrant, colorful background using brand color energy.`,
      `${cpN} (${cp}) dominant with ${csN} (${cs}) bold accents.`,
    ].join(' ');
    // auto: use segment-based personality
    return [
      `BACKGROUND: ${seg.elementos}.`,
      `Color palette: ${cpN} (${cp}) dominant, ${csN} (${cs}) accent. Visual personality: ${seg.personalidade}.`,
    ].join(' ');
  })();

  // ── TEXTO A RENDERIZAR ────────────────────────────────────────────────────
  const textoLines = [
    d.empresa   && `COMPANY NAME (largest element, hero typography): "${d.empresa}"`,
    d.nome      && `PERSON NAME (large, prominent): "${d.nome}"`,
    d.cargo     && `JOB TITLE (accent color, below name): "${d.cargo}"`,
    d.telefone  && `PHONE (with phone icon ☎): ${d.telefone}`,
    d.email     && `EMAIL (with envelope icon ✉): ${d.email}`,
    d.site      && `WEBSITE (with globe icon ⊕): ${d.site}`,
    d.instagram && `INSTAGRAM (with IG icon): ${d.instagram}`,
    d.facebook  && `FACEBOOK (with FB icon): ${d.facebook}`,
    d.servicos  && `SERVICES (smaller, subtle): ${d.servicos}`,
  ].filter(Boolean).join('\n');

  // ── BLOCOS CRIATIVOS ─────────────────────────────────────────────────────────
  // 1. Direção criativa
  const artDirectorBrief = _buildArtDirectorBrief(d.segmento ?? '');
  // 2. Segmento (descrição EN + visual direction keywords)
  const segmentoBlock = d.segmento ? _segmentoDescricaoEN(d.segmento) : '';

  return [
    // Role
    `You are a senior graphic designer at a top São Paulo creative agency. Your task: create a complete, print-ready business card as a single finished image. All typography, layout, colors, and contact details are rendered directly in the image — no overlays, no post-processing.`,

    // Layout constraint (technical — faces)
    facesConstraint,

    // 1. DIREÇÃO CRIATIVA — estabelece o nível de qualidade esperado
    artDirectorBrief,

    // 2. SEGMENTO — contexto de negócio + palavras-chave visuais
    ...(segmentoBlock ? [segmentoBlock] : []),

    // 3. IDENTIDADE VISUAL — personalidade detectada + background
    bgConstraint,
    `BRAND PERSONALITY: ${seg.personalidade}. Creative concept: "${seg.conceito}". Brand essence: ${seg.essencia}.${obs}`,

    // 4. DADOS DO CARTÃO — o que renderizar
    `TEXT TO RENDER IN THE IMAGE — copy EXACTLY, zero spelling errors, zero omissions:\n${textoLines}`,

    // Regras de tipografia e qualidade
    `TYPOGRAPHY: Modern geometric sans-serif (Inter, Montserrat, or Raleway quality). Sharp, perfectly legible. Company name is the largest element. All text at a size where it can be read comfortably. Perfect kerning and alignment.`,

    `QUALITY STANDARD: This is a premium print piece. Every pixel matters. Professional creative director level. No placeholder text. No lorem ipsum. Render exactly what was specified above.`,
  ].join('\n\n');
}

function _promptAdesivo(cp: string, cs: string, d: ProdutoInput): string {
  const seg   = _detectarPersonalidade(d);
  const marca = d.empresa ? `"${d.empresa}"` : 'a brand';
  const obs   = d.observacoes ? ` Context: "${d.observacoes}".` : '';
  const cpN   = _nomeCor(cp);
  const csN   = _nomeCor(cs);
  const ev    = (d.estilo_visual ?? '').toLowerCase();

  // ── Infantil: Pixar/Disney quality illustration ───────────────────────────
  if (ev === 'infantil' || seg.essencia.includes('ternura')) {
    return [
      `ROLE: You are creating a circular sticker illustration for a children's birthday celebration. Pure visual output only — ZERO text anywhere in the image.`,
      `Style: Pixar/Disney 3D animated illustration quality. Warm, joyful, child-friendly. Big expressive eyes on characters, rounded friendly shapes, exaggerated cute proportions, cheerful happy expressions. Vibrant saturated colors. Premium children's book illustration quality.`,
      obs,
      `Colors: ${cpN} (${cp}) and ${csN} (${cs}) adapted into a warm, bright, celebratory palette. High saturation, cheerful highlights, soft glowing warmth.`,
      `Composition: circular format. Friendly illustrated character(s) or celebration scene filling 60% of the circle with joyful energy. Confetti dot-spray and balloon elements radiating outward. Soft warm radial light bloom at center. Clean breathable space at the very center for overlaid text.`,
      `The outer ring border area should have subtle celebration decorative energy (confetti, stars, streamers) without overcrowding.`,
      `ABSOLUTE RULES — ZERO EXCEPTIONS: NO WORDS. NO LETTERS. NO NUMBERS. NO TEXT. NO TYPOGRAPHY. NO WATERMARKS. NO NAME TAGS. Pure illustrated visual composition only.`,
    ].filter(Boolean).join(' ');
  }

  // ── Anime: manga aesthetic ────────────────────────────────────────────────
  if (ev === 'anime') {
    return [
      `ROLE: Creating a circular sticker with anime/manga aesthetic. Visual only — NO text anywhere.`,
      `Style: high-quality anime illustration. Bold outlines, dramatic cel-shading, expressive character energy, speed lines. Magazine-quality anime art.${obs}`,
      `Colors: ${cpN} (${cp}) and ${csN} (${cs}) in vibrant anime style with dramatic gradient backgrounds and glowing accent effects.`,
      `Composition: centered anime character or dramatic scene with speed lines radiating outward from center. Bold, eye-catching, circular composition.`,
      `ABSOLUTE RULES: NO WORDS. NO LETTERS. NO NUMBERS. NO TEXT. NO WATERMARKS. Pure anime visual only.`,
    ].join(' ');
  }

  // ── Artístico: watercolor/painterly ──────────────────────────────────────
  if (ev === 'artistico') {
    return [
      `ROLE: Creating a circular sticker with fine art watercolor aesthetic. Visual only — NO text.`,
      `Style: premium watercolor painting. Fluid, organic, painterly. Soft color bleeding edges, natural pigment granulation, visible brushwork character.${obs}`,
      `Colors: ${cpN} (${cp}) and ${csN} (${cs}) as the dominant watercolor wash palette, bleeding into each other naturally.`,
      `Composition: circular organic composition, colors flowing from center outward like a watercolor bloom. Artistic, handmade quality, beautiful imperfections.`,
      `ABSOLUTE RULES: NO WORDS. NO LETTERS. NO NUMBERS. NO TEXT. Pure painterly visual only.`,
    ].join(' ');
  }

  // ── Default: brand/commercial sticker ────────────────────────────────────
  return [
    `ROLE: You are a pure visual art director creating a circular sticker background for ${marca}. NO text, no words, no letters anywhere.`,
    `Industry visual personality: ${seg.personalidade}. Brand essence: ${seg.essencia}.`,
    `Creative concept: ${seg.conceito}.${obs}`,
    `Format: 1:1 perfect square, circular composition — all visual energy centered and radial.`,
    `Composition: ${seg.elementos}. ${cpN} (${cp}) dominant base, ${csN} (${cs}) accent highlights. Rich colors, high saturation, visual impact.`,
    `Center must be clean and visually breathable — logo or text will float there. Outer ring has decorative energy fading inward.`,
    `Style: professional product sticker — bold, eye-catching, memorable. Custom-designed, not generic.`,
    `ABSOLUTE RULES — ZERO EXCEPTIONS: NO WORDS. NO LETTERS. NO NUMBERS. NO BRAND NAMES. NO READABLE TEXT. NO TYPOGRAPHY. NO LOGOS. Pure visual composition only.`,
  ].join(' ');
}

// Converte hex para nome de cor legível em inglês (para o prompt da IA).
function _nomeCor(hex: string): string {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (r * 299 + g * 587 + b * 114) / 1000;

  if (lum < 30)  return 'near-black';
  if (lum > 230) return 'bright white';

  if (b > r * 1.6 && b > g * 1.6) return lum < 90  ? 'deep navy blue' : 'rich cobalt blue';
  if (r > 180 && g > 140 && b < 70) return r > 220 && g > 170 ? 'warm golden amber' : 'rich gold';
  if (r > g * 1.8 && r > b * 2.5) return lum < 110 ? 'deep crimson red' : 'vibrant red';
  if (r > 200 && g > 100 && b < 60) return 'warm orange';
  if (g > r * 1.4 && g > b * 1.4) return lum < 100 ? 'deep forest green' : 'rich emerald green';
  if (r > 130 && b > 150 && g < 100) return 'royal purple';
  if (r > 60 && g > 80 && b > 110 && b > r) return 'steel blue';

  return lum < 100 ? 'dark neutral' : 'medium tone';
}

// Faz upload de bytes PNG para o bucket 'artes' do Supabase Storage.
// Lê SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY diretamente do env do Deno — não depende de parâmetros.
async function _uploadToStorage(pngBytes: Uint8Array): Promise<string | null> {
  const supUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supUrl || !supKey) {
    console.warn('[hibrida/storage] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes');
    return null;
  }
  const file = `hibrida-ia-${Date.now()}.png`;
  try {
    const up = await fetch(`${supUrl}/storage/v1/object/artes/${file}`, {
      method: 'POST',
      headers: {
        apikey:          supKey,
        Authorization:   `Bearer ${supKey}`,
        'Content-Type':  'image/png',
        'x-upsert':      'true',
      },
      body: pngBytes,
      signal: AbortSignal.timeout(20_000),
    });
    if (up.ok) {
      const url = `${supUrl}/storage/v1/object/public/artes/${file}`;
      console.log('[hibrida/storage] upload OK:', url);
      return url;
    }
    const errBody = await up.text();
    console.error('[hibrida/storage] upload falhou:', up.status, errBody.slice(0, 200));
    return null;
  } catch (err) {
    console.error('[hibrida/storage] exceção upload:', String(err).slice(0, 100));
    return null;
  }
}

// Chama OpenAI Images (gpt-image-1) e retorna URL pública do Supabase Storage.
// Ao receber b64_json faz upload imediato — evita embutir ~2MB de base64 no HTML do overlay.
async function _chamarOpenAI(
  prompt: string,
  apiKey: string,
  produto: string,
  background: 'transparent' | 'opaque' = 'opaque',
): Promise<{ url: string | null; erro?: string }> {
  // Cartão ia_pura: texto baked-in → high quality + landscape para melhor legibilidade de tipografia
  // Demais produtos: 1024x1024 low (mais rápido, só fundo visual)
  const isCartao = produto === 'cartao_visita';
  const size     = isCartao ? '1536x1024' : '1024x1024';
  const quality  = isCartao ? 'high'      : 'low';
  console.log('[hibrida/openai] configuracao | produto:', produto, '| size:', size, '| quality:', quality);

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:         'gpt-image-1',
        prompt,
        n:             1,
        size,
        quality,
        background,
        output_format: 'png',
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[hibrida/openai] erro HTTP ${res.status}:`, errText);
      return { url: null, erro: `HTTP_${res.status}:${errText.slice(0, 200)}` };
    }

    const data    = await res.json() as { data: Array<{ url?: string; b64_json?: string }> };
    const imgItem = data.data?.[0];
    if (!imgItem) return { url: null, erro: 'resposta_vazia' };

    // Extrair bytes PNG da resposta
    let pngBytes: Uint8Array | null = null;

    if (imgItem.b64_json) {
      console.log('[hibrida/openai] OK (b64_json), chars:', imgItem.b64_json.length);
      const binStr = atob(imgItem.b64_json);
      pngBytes = Uint8Array.from({ length: binStr.length }, (_, i) => binStr.charCodeAt(i));
    } else if (imgItem.url) {
      console.log('[hibrida/openai] OK (url), buscando bytes...');
      const imgRes = await fetch(imgItem.url, { signal: AbortSignal.timeout(30_000) });
      if (!imgRes.ok) return { url: null, erro: `fetch_url_${imgRes.status}` };
      pngBytes = new Uint8Array(await imgRes.arrayBuffer());
    }

    if (!pngBytes) return { url: null, erro: 'sem_url_nem_b64' };

    console.log('[hibrida/openai] bytes PNG:', pngBytes.byteLength);

    // Upload para Supabase Storage → HTML usa URL pública (pequena), não base64 inline
    const storageUrl = await _uploadToStorage(pngBytes);
    if (storageUrl) return { url: storageUrl };

    console.warn('[hibrida/openai] storage falhou, caindo em data URL inline');
    // Fallback: data URL inline (pode causar HTML grande → timeout no HCTI)
    const b64 = btoa(pngBytes.reduce((s, b) => s + String.fromCharCode(b), ''));
    return { url: `data:image/png;base64,${b64}` };

  } catch (err) {
    console.error('[hibrida/openai] exceção:', err);
    return { url: null, erro: `excecao:${String(err).slice(0, 100)}` };
  }
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

  if (produto === 'caneca' && d.modo_caneca === 'personagem_isolado') {
    return _overlayPersonagemCaneca(d, logo, baseUrl);
  }

  // ia_pura: IA already rendered all text — only composite the real logo on top (if provided)
  if (produto === 'cartao_visita' && d.modo_criacao === 'ia_pura') {
    return _overlayLogoOnly(d, logo, baseUrl);
  }

  const overlays: Record<string, (d: ProdutoInput, logo: string, url: string) => string> = {
    cartao_visita:          _overlayCartao,
    panfleto:               _overlayPanfleto,
    caneca:                 _overlayCaneca,
    adesivo_redondo:        _overlayAdesivo,
    hibrida_cartao_dark:    _overlayHibridaCartaoDark,
    hibrida_cartao_light:   _overlayHibridaCartaoLight,
    hibrida_cartao_impacto: _overlayHibridaCartaoImpacto,
    hibrida_cartao:         _overlayHibridaCartaoDark,
  };

  const fn = overlays[d.layout_id ?? ''] ?? overlays[produto] ?? _overlayGenerico;
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

// ── Overlay: caneca personagem isolado (2100×800) ────────────────────────────

function _overlayPersonagemCaneca(d: ProdutoInput, _logo: string, baseUrl: string): string {
  const cp    = d.cor_primaria   ?? '#1A2744';
  const cs    = d.cor_secundaria ?? '#E8A020';
  const nome  = e(d.nome || d.empresa || '');
  const frase = e(d.texto_principal || '');
  const main  = frase || nome;
  const sub   = frase ? nome : e(d.texto_secundario || '');
  const mLen  = main.length;
  const mainFs = mLen > 40 ? 72 : mLen > 28 ? 90 : mLen > 18 ? 116 : mLen > 12 ? 144 : 170;
  const subFs  = Math.round(mainFs * 0.46);
  const textTop = 610;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;font-family:Arial,Helvetica,sans-serif;}</style>
</head><body>
<div style="width:2100px;height:800px;position:relative;">

  <!-- Personagem: ocupa toda a zona superior, objeto-fit contain para preservar proporção -->
  <div style="position:absolute;top:0;left:0;width:2100px;height:600px;text-align:center;line-height:600px;">
    <img src="${baseUrl}" style="max-height:590px;max-width:1960px;object-fit:contain;vertical-align:middle;">
  </div>

  <!-- Nome/texto principal abaixo do personagem -->
  <div style="position:absolute;top:${textTop}px;left:40px;width:2020px;text-align:center;">
    <span style="font-size:${mainFs}px;font-weight:900;color:${cp};letter-spacing:-1px;text-shadow:0 1px 6px rgba(255,255,255,0.9),0 2px 10px rgba(0,0,0,0.18);">${main}</span>
  </div>

  ${sub ? `<div style="position:absolute;top:${textTop + mainFs + 8}px;left:40px;width:2020px;text-align:center;">
    <span style="font-size:${subFs}px;font-weight:700;color:${cs};text-shadow:0 1px 4px rgba(255,255,255,0.8),0 2px 6px rgba(0,0,0,0.14);">${sub}</span>
  </div>` : ''}

</div></body></html>`;
}

// ── Overlay: adesivo redondo (800×800) ────────────────────────────────────────

function _overlayAdesivo(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp     = d.cor_primaria   ?? '#1A2744';
  const cs     = d.cor_secundaria ?? '#E8A020';
  const titulo = e(d.texto_principal || d.nome || '');
  const emp    = e(d.empresa || '');
  const tel    = e(d.telefone || '');
  const layout = (d.layout_texto ?? 'central_inferior').toLowerCase();
  const shadow = '0 3px 18px rgba(0,0,0,0.90),0 0 8px rgba(0,0,0,1)';
  const ctaTel = /telefone.*destaque|whatsapp.*destaque|destaque.*telefone|destaque.*whatsapp/i.test(d.observacoes || '');
  const temSecundario = emp && emp !== titulo;
  const isArc  = layout === 'arco_superior' || layout === 'arco_inferior';
  // Fonte menor para arco (curvatura comprime espaço horizontal disponível)
  const tSize  = isArc
    ? (titulo.length > 20 ? 36 : titulo.length > 13 ? 46 : titulo.length > 8 ? 58 : 66)
    : (titulo.length > 22 ? 44 : titulo.length > 14 ? 56 : titulo.length > 8 ? 66 : 76);
  const bottomTitulo = ctaTel && tel ? 162 : temSecundario ? 140 : 116;

  // SVG inline dentro do SVG de borda — textPath para arcos
  let arcDefs = '';
  let arcText = '';
  if (titulo && layout === 'arco_superior') {
    arcDefs = `<defs>
      <path id="arcTop" d="M 60,400 A 340,340 0 0 1 740,400"/>
      <filter id="adTsh"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.95)"/></filter>
    </defs>`;
    arcText = `<text font-size="${tSize}" font-weight="900" fill="white" font-family="Inter,Arial,sans-serif" filter="url(#adTsh)">
      <textPath href="#arcTop" startOffset="50%" text-anchor="middle">${titulo}</textPath>
    </text>`;
  } else if (titulo && layout === 'arco_inferior') {
    arcDefs = `<defs>
      <path id="arcBot" d="M 60,400 A 340,340 0 1 1 740,400"/>
      <filter id="adTsh"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.95)"/></filter>
    </defs>`;
    arcText = `<text font-size="${tSize}" font-weight="900" fill="white" font-family="Inter,Arial,sans-serif" filter="url(#adTsh)">
      <textPath href="#arcBot" startOffset="50%" text-anchor="middle">${titulo}</textPath>
    </text>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',system-ui,-apple-system,Arial,sans-serif;}
#canvas{width:800px;height:800px;position:relative;overflow:hidden;border-radius:50%;}</style>
</head><body>
<div id="canvas">

  <!-- Arte IA de fundo -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:800px;height:800px;object-fit:cover;">

  <!-- Vinheta radial para legibilidade -->
  <div style="position:absolute;left:0;top:0;width:800px;height:800px;background:radial-gradient(ellipse at center,transparent 28%,rgba(0,0,0,0.55) 82%);"></div>

  <!-- Borda decorativa + texto em arco (quando aplicável) -->
  <svg style="position:absolute;left:0;top:0;width:800px;height:800px;pointer-events:none;" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
    ${arcDefs}
    <circle cx="400" cy="400" r="390" fill="none" stroke="${cs}" stroke-width="8" opacity="0.82"/>
    <circle cx="400" cy="400" r="375" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.32"/>
    ${arcText}
  </svg>

  ${logo ? `
  <!-- Logo real do cliente -->
  <div style="position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);">
    <img src="${logo}" style="max-width:340px;max-height:260px;object-fit:contain;display:block;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.55));">
  </div>` : ''}

  ${titulo && layout === 'faixa_inferior' ? `
  <!-- Texto em faixa com fundo semi-transparente -->
  <div style="position:absolute;left:80px;right:80px;bottom:${bottomTitulo}px;text-align:center;background:rgba(0,0,0,0.52);border-radius:40px;padding:14px 20px;">
    <span style="font-size:${tSize}px;font-weight:900;color:#FFFFFF;letter-spacing:1px;">${titulo}</span>
  </div>` : ''}

  ${titulo && !isArc && layout !== 'faixa_inferior' ? `
  <!-- Texto principal (central_inferior) -->
  <div style="position:absolute;left:50%;bottom:${bottomTitulo}px;transform:translateX(-50%);white-space:nowrap;text-align:center;">
    <span style="font-size:${tSize}px;font-weight:900;color:#FFFFFF;letter-spacing:1px;text-shadow:${shadow};">${titulo}</span>
  </div>` : ''}

  ${temSecundario && !isArc ? `
  <!-- Nome da empresa (secundário) -->
  <div style="position:absolute;left:50%;bottom:100px;transform:translateX(-50%);white-space:nowrap;text-align:center;">
    <span style="font-size:26px;font-weight:700;color:${cs};letter-spacing:5px;text-transform:uppercase;text-shadow:${shadow};">${emp}</span>
  </div>` : ''}

  ${ctaTel && tel && !isArc ? `
  <!-- Telefone em destaque -->
  <div style="position:absolute;left:50%;bottom:96px;transform:translateX(-50%);white-space:nowrap;text-align:center;">
    <span style="font-size:34px;font-weight:800;color:#FFFFFF;letter-spacing:1px;text-shadow:${shadow};">${tel}</span>
  </div>` : ''}

</div></body></html>`;
}

// ── Overlay: cartão híbrido DARK (2100×600) ───────────────────────────────────

function _overlayHibridaCartaoDark(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp   = d.cor_primaria   ?? '#1A2744';
  const cs   = d.cor_secundaria ?? '#C9A84C';
  const nome = e(d.nome || '');
  const carg = e(d.cargo || '');
  const emp  = e(d.empresa || '');
  const tel  = e(d.telefone || '');
  const mail = e(d.email || '');
  const web  = e(d.site || '');
  const nFs  = nome.length > 22 ? 48 : nome.length > 16 ? 60 : 70;
  const shadowText = '0 2px 22px rgba(0,0,0,0.95),0 0 6px rgba(0,0,0,1),0 4px 8px rgba(0,0,0,0.80)';
  const shadowSub  = '0 1px 12px rgba(0,0,0,0.90),0 0 3px rgba(0,0,0,0.70)';
  const ctaTel = /telefone.*destaque|whatsapp.*destaque|destaque.*telefone|destaque.*whatsapp|fone.*grande|tel.*grande|cta.*tel/i.test(d.observacoes || '');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;}</style>
</head><body>
<div style="width:2100px;height:600px;position:relative;overflow:hidden;">

  <!-- Arte IA — ocupa todo o cartão -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:2100px;height:600px;object-fit:cover;">

  <!-- FRENTE (0–1050): logo flutuando sobre a arte -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;">
    ${logo ? `<img src="${logo}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);max-width:400px;max-height:220px;object-fit:contain;filter:drop-shadow(0 6px 24px rgba(0,0,0,0.80)) drop-shadow(0 0 3px rgba(0,0,0,1));">` : ''}
    <div style="position:absolute;bottom:26px;left:0;width:1050px;text-align:center;">
      <span style="font-size:11px;letter-spacing:6px;color:rgba(255,255,255,0.65);text-transform:uppercase;text-shadow:${shadowSub};">${emp}</span>
    </div>
  </div>

  <!-- Divisor sutil entre frente e verso -->
  <div style="position:absolute;left:1049px;top:60px;width:1px;height:480px;background:linear-gradient(180deg,transparent,${cs}88,${cs}88,transparent);"></div>

  <!-- VERSO (1050–2100): dados escritos diretamente sobre a arte -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;">
    <!-- Nome -->
    <div style="position:absolute;left:60px;top:58px;right:40px;">
      <div style="font-size:${nFs}px;font-weight:900;color:#FFFFFF;line-height:1.0;letter-spacing:-0.5px;text-shadow:${shadowText};">${nome}</div>
      ${carg ? `<div style="font-size:13px;letter-spacing:8px;color:${cs};text-transform:uppercase;margin-top:16px;font-weight:300;text-shadow:${shadowSub};">${carg}</div>` : ''}
      <div style="width:72px;height:1.5px;background:${cs};margin-top:18px;opacity:0.85;"></div>
    </div>
    <!-- Contatos -->
    <div style="position:absolute;left:60px;top:295px;">
      ${mail ? `<div style="position:absolute;top:0;left:0;width:740px;height:40px;">
        <svg style="position:absolute;left:0;top:9px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:40px;font-size:21px;font-weight:500;color:rgba(255,255,255,0.97);text-shadow:${shadowSub};">${mail}</span>
      </div>` : ''}
      ${tel ? `<div style="position:absolute;top:62px;left:0;width:740px;height:${ctaTel ? 50 : 40}px;">
        <svg style="position:absolute;left:0;top:${ctaTel ? 12 : 9}px;" width="${ctaTel ? 22 : 18}" height="${ctaTel ? 22 : 18}" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="${ctaTel ? 2.5 : 2}"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <span style="position:absolute;left:${ctaTel ? 36 : 32}px;top:0;line-height:${ctaTel ? 50 : 40}px;font-size:${ctaTel ? 27 : 21}px;color:${ctaTel ? cs : 'rgba(255,255,255,0.97)'};font-weight:${ctaTel ? 800 : 500};text-shadow:${shadowSub};">${tel}</span>
      </div>` : ''}
      ${web ? `<div style="position:absolute;top:${ctaTel ? 134 : 124}px;left:0;width:740px;height:40px;">
        <svg style="position:absolute;left:0;top:9px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:40px;font-size:21px;font-weight:600;color:${cs};text-shadow:${shadowSub};">${web}</span>
      </div>` : ''}
    </div>
    <div style="position:absolute;right:44px;bottom:26px;">
      <span style="font-size:10px;letter-spacing:4px;color:rgba(255,255,255,0.28);text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.80);">${emp}</span>
    </div>
  </div>

</div></body></html>`;
}

function _overlayHibridaCartaoLight(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp   = d.cor_primaria   ?? '#1A2744';
  const cs   = d.cor_secundaria ?? '#C9A84C';
  const nome = e(d.nome || '');
  const carg = e(d.cargo || '');
  const emp  = e(d.empresa || '');
  const tel  = e(d.telefone || '');
  const mail = e(d.email || '');
  const web  = e(d.site || '');
  const nFs  = nome.length > 22 ? 48 : nome.length > 16 ? 60 : 70;
  const ctaTel = /telefone.*destaque|whatsapp.*destaque|destaque.*telefone|destaque.*whatsapp|fone.*grande|tel.*grande|cta.*tel/i.test(d.observacoes || '');
  const shadowDark  = '0 1px 4px rgba(0,0,0,0.22),0 0 2px rgba(0,0,0,0.12)';
  const shadowLight = '0 1px 3px rgba(0,0,0,0.15)';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;}</style>
</head><body>
<div style="width:2100px;height:600px;position:relative;overflow:hidden;">

  <!-- Arte IA — ocupa todo o cartão -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:2100px;height:600px;object-fit:cover;">

  <!-- FRENTE (0–1050): logo sobre arte clara -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;">
    ${logo ? `<img src="${logo}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);max-width:420px;max-height:240px;object-fit:contain;filter:drop-shadow(0 4px 18px rgba(0,0,0,0.28)) drop-shadow(0 0 2px rgba(0,0,0,0.40));">` : ''}
    <div style="position:absolute;bottom:28px;left:0;width:1050px;text-align:center;">
      <span style="font-size:11px;letter-spacing:6px;color:${cp};opacity:0.55;text-transform:uppercase;text-shadow:${shadowLight};">${emp}</span>
    </div>
  </div>

  <!-- Divisor sutil -->
  <div style="position:absolute;left:1049px;top:60px;width:1px;height:480px;background:linear-gradient(180deg,transparent,${cp}55,${cs}66,${cp}55,transparent);"></div>

  <!-- VERSO (1050–2100): dados escritos diretamente sobre a arte clara -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;">
    <!-- Nome -->
    <div style="position:absolute;left:60px;top:58px;right:40px;">
      <div style="font-size:${nFs}px;font-weight:900;color:${cp};line-height:1.0;letter-spacing:-0.5px;text-shadow:${shadowDark};">${nome}</div>
      ${carg ? `<div style="font-size:13px;letter-spacing:8px;color:${cs};text-transform:uppercase;margin-top:16px;font-weight:300;text-shadow:${shadowLight};">${carg}</div>` : ''}
      <div style="width:72px;height:1.5px;background:${cp};margin-top:18px;opacity:0.40;"></div>
    </div>
    <!-- Painel de legibilidade — garante contraste dos contatos em qualquer fundo claro -->
    <div style="position:absolute;left:44px;top:278px;width:700px;height:188px;background:rgba(255,255,255,0.72);border-radius:8px;"></div>
    <!-- Contatos -->
    <div style="position:absolute;left:60px;top:295px;">
      ${mail ? `<div style="position:absolute;top:0;left:0;width:660px;height:40px;">
        <svg style="position:absolute;left:0;top:9px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${cp}" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:40px;font-size:21px;font-weight:600;color:${cp};text-shadow:${shadowLight};">${mail}</span>
      </div>` : ''}
      ${tel ? `<div style="position:absolute;top:62px;left:0;width:660px;height:${ctaTel ? 50 : 40}px;">
        <svg style="position:absolute;left:0;top:${ctaTel ? 12 : 9}px;" width="${ctaTel ? 22 : 18}" height="${ctaTel ? 22 : 18}" viewBox="0 0 24 24" fill="none" stroke="${ctaTel ? cs : cp}" stroke-width="${ctaTel ? 2.5 : 2}"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <span style="position:absolute;left:${ctaTel ? 36 : 32}px;top:0;line-height:${ctaTel ? 50 : 40}px;font-size:${ctaTel ? 27 : 21}px;color:${ctaTel ? cs : cp};font-weight:${ctaTel ? 800 : 600};text-shadow:${shadowLight};">${tel}</span>
      </div>` : ''}
      ${web ? `<div style="position:absolute;top:${ctaTel ? 134 : 124}px;left:0;width:660px;height:40px;">
        <svg style="position:absolute;left:0;top:9px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:40px;font-size:21px;font-weight:600;color:${cs};text-shadow:${shadowLight};">${web}</span>
      </div>` : ''}
    </div>
    <div style="position:absolute;right:44px;bottom:26px;">
      <span style="font-size:10px;letter-spacing:4px;color:${cp};opacity:0.35;text-transform:uppercase;">${emp}</span>
    </div>
  </div>

</div></body></html>`;
}

// ── Overlay: cartão híbrido IMPACTO (2100×600) ────────────────────────────────

function _overlayHibridaCartaoImpacto(d: ProdutoInput, logo: string, baseUrl: string): string {
  const cp   = d.cor_primaria   ?? '#1A2744';
  const cs   = d.cor_secundaria ?? '#C9A84C';
  const nome = e(d.nome || '');
  const carg = e(d.cargo || '');
  const emp  = e(d.empresa || '');
  const tel  = e(d.telefone || '');
  const mail = e(d.email || '');
  const web  = e(d.site || '');
  const nFs  = nome.length > 22 ? 51 : nome.length > 16 ? 63 : 75;
  const shadowHard = '0 3px 24px rgba(0,0,0,1),0 0 8px rgba(0,0,0,1),0 2px 6px rgba(0,0,0,1)';
  const shadowMed  = '0 2px 14px rgba(0,0,0,0.95),0 0 4px rgba(0,0,0,1)';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;}</style>
</head><body>
<div style="width:2100px;height:600px;position:relative;overflow:hidden;">

  <!-- Arte IA — ocupa todo o cartão -->
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:2100px;height:600px;object-fit:cover;">

  <!-- FRENTE (0–1050): logo com máximo impacto visual -->
  <div style="position:absolute;left:0;top:0;width:1050px;height:600px;">
    ${logo ? `<img src="${logo}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);max-width:420px;max-height:240px;object-fit:contain;filter:drop-shadow(0 8px 30px rgba(0,0,0,0.90)) drop-shadow(0 0 6px rgba(0,0,0,1));">` : ''}
    <!-- Linha accent na base da frente -->
    <div style="position:absolute;bottom:26px;left:0;width:1050px;text-align:center;">
      <span style="font-size:11px;letter-spacing:6px;color:${cs};text-transform:uppercase;text-shadow:${shadowMed};font-weight:700;">${emp}</span>
    </div>
    <!-- Acento de cor na borda inferior -->
    <div style="position:absolute;bottom:0;left:0;width:1050px;height:3px;background:${cs};opacity:0.90;"></div>
  </div>

  <!-- VERSO (1050–2100): nome em destaque máximo, dados direto na arte -->
  <div style="position:absolute;left:1050px;top:0;width:1050px;height:600px;">
    <!-- Nome — tipografia máxima, sombra total -->
    <div style="position:absolute;left:58px;top:50px;right:36px;">
      <div style="font-size:${nFs}px;font-weight:900;color:#FFFFFF;line-height:1.0;letter-spacing:-1px;text-shadow:${shadowHard};">${nome}</div>
      ${carg ? `<div style="font-size:13px;letter-spacing:8px;color:${cs};text-transform:uppercase;margin-top:16px;font-weight:300;text-shadow:${shadowMed};">${carg}</div>` : ''}
    </div>
    <!-- Linha de separação em destaque -->
    <div style="position:absolute;left:58px;top:${50 + nFs + (carg ? 66 : 24)}px;width:300px;height:2.5px;background:${cs};opacity:0.90;"></div>
    <!-- Contatos -->
    <div style="position:absolute;left:58px;top:${50 + nFs + (carg ? 96 : 54)}px;">
      ${mail ? `<div style="position:absolute;top:0;left:0;width:740px;height:42px;">
        <svg style="position:absolute;left:0;top:10px;" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:42px;font-size:22px;font-weight:600;color:rgba(255,255,255,0.97);text-shadow:${shadowMed};">${mail}</span>
      </div>` : ''}
      ${tel ? `<div style="position:absolute;top:64px;left:0;width:740px;height:42px;">
        <svg style="position:absolute;left:0;top:10px;" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.4 1.14 2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:42px;font-size:22px;font-weight:600;color:rgba(255,255,255,0.97);text-shadow:${shadowMed};">${tel}</span>
      </div>` : ''}
      ${web ? `<div style="position:absolute;top:128px;left:0;width:740px;height:42px;">
        <svg style="position:absolute;left:0;top:10px;" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cs}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/></svg>
        <span style="position:absolute;left:32px;top:0;line-height:42px;font-size:22px;font-weight:700;color:${cs};text-shadow:${shadowMed};">${web}</span>
      </div>` : ''}
    </div>
    <div style="position:absolute;right:44px;bottom:26px;">
      <span style="font-size:10px;letter-spacing:5px;color:rgba(255,255,255,0.25);text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.90);">${emp}</span>
    </div>
    <!-- Acento de cor na borda inferior -->
    <div style="position:absolute;bottom:0;left:0;width:1050px;height:3px;background:${cs};opacity:0.90;"></div>
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

// ── Overlay: cartão IA pura — logo real sobre imagem completa gerada pela IA ──
// Usado quando modo_criacao='ia_pura': IA já renderizou todo o texto; só composite logo.
function _overlayLogoOnly(d: ProdutoInput, logo: string, baseUrl: string): string {
  const { w, h } = DIMENSOES['cartao_visita'] ?? { w: 2100, h: 600 };
  if (!logo) {
    // sem logo: retorna overlay mínimo só com a imagem de base
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;}body{}</style></head><body>
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;object-fit:cover;">
</div></body></html>`;
  }
  const logoW = Math.round(w * 0.18);
  const logoH = Math.round(h * 0.52);
  const logoX = Math.round(w * 0.09);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;}body{}</style></head><body>
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${baseUrl}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;object-fit:cover;">
  <img src="${logo}" style="position:absolute;left:${logoX}px;top:50%;transform:translateY(-50%);max-width:${logoW}px;max-height:${logoH}px;object-fit:contain;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.45));">
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
  console.log(`[hibrida] base: provider=${base.provider} mock=${base.mock} url_len=${base.url.length}`);

  const html = aplicarOverlayHTML(d, logo, base.url);

  // _baseUrl: URL pública do storage quando IA gerou via OpenAI — usada como fallback
  // se o renderizador HTML (HCTI/Browserless) falhar
  const isStorageUrl = base.url.startsWith('http') && !base.url.startsWith('data:');

  return {
    html,
    w:         decisao.dimensoes.w,
    h:         decisao.dimensoes.h,
    fullDoc:   true,
    _provider: base.provider,
    _baseUrl:  isStorageUrl ? base.url : undefined,
  };
}
