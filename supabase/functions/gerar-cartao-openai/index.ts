/**
 * gerar-cartao-openai
 *
 * Gera cartão de visita completo via OpenAI gpt-image-1.
 * A IA renderiza o card inteiro: layout, tipografia e texto na mesma imagem.
 *
 * Regras absolutas:
 *   - NUNCA chama HCTI / Browserless / html2png
 *   - NUNCA usa template HTML/CSS
 *   - NUNCA transforma imagem anterior em logo
 *   - OpenAI gpt-image-1 é a única fonte da imagem final
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CartaoInput {
  empresa?:        string;
  nome?:           string;
  cargo?:          string;
  segmento?:       string;
  telefone?:       string;
  email?:          string;
  site?:           string;
  instagram?:      string;
  facebook?:       string;
  servicos?:       string;
  estilo?:         string;
  cor_primaria?:   string;
  cor_secundaria?: string;
  observacoes?:    string;
}

// ── Personalidade visual por segmento ─────────────────────────────────────────

function _personalidadePorSegmento(segmento: string, empresa: string, cargo: string): {
  tom:      string;
  conceito: string;
  detalhes: string;
} {
  const ctx = `${segmento} ${empresa} ${cargo}`.toLowerCase();

  if (/advogad|jur[ií]d|oab|direito|advocacia/i.test(ctx))
    return { tom: 'refined authority, classic prestige, understated power', conceito: 'the grammar of law — precise, serious, unimpeachable', detalhes: 'deep navy or charcoal base, gold accent lines, clean negative space, architectural precision' };

  if (/médic|clínic|hospital|saúde|dentist|odont|psicolog|nutricion|fisioter/i.test(ctx))
    return { tom: 'trust, care, clinical purity', conceito: 'health as serenity — clean, approachable, certain', detalhes: 'white and soft blue tones, gentle curves, clean modern sans-serif, calm atmosphere' };

  if (/contador|contabil|financ|audit|fiscal|bank|banco/i.test(ctx))
    return { tom: 'structured reliability, professional precision', conceito: 'numbers that build trust — organized, solid, credible', detalhes: 'corporate blue or dark grey, structured geometric elements, strong typography hierarchy' };

  if (/imobiliár|corretor|imóvel|apartamento|alto padrão|lançamento/i.test(ctx))
    return { tom: 'premium lifestyle, architectural ambition, aspirational success', conceito: 'spaces that define — premium, confident, aspirational', detalhes: 'gold and dark tones, thin elegant lines, architectural motifs, luxury atmosphere' };

  if (/tech|software|startup|ti\b|dados|digital|sistema|programad/i.test(ctx))
    return { tom: 'innovation, precision, forward-thinking', conceito: 'technology as clarity — smart, fast, reliable', detalhes: 'dark background with blue or cyan accents, clean grid geometry, modern sans-serif, minimal noise' };

  if (/restaurante|gastronomia|chef|padaria|bar|delivery|café|bistrô/i.test(ctx))
    return { tom: 'bold appetite, vibrant energy, authentic character', conceito: 'flavor made visible — energetic, warm, inviting', detalhes: 'warm rich colors, dynamic diagonal composition, bold typography, appetite-stimulating palette' };

  if (/salon|salão|beauty|beleza|estética|spa|nail|barbearia|cosmétic/i.test(ctx))
    return { tom: 'glamour, elegance, self-confidence', conceito: 'beauty as identity — refined, chic, aspirational', detalhes: 'rose gold or blush tones, soft gradients, elegant script accents, feminine or editorial aesthetic' };

  if (/constru|engenheir|arquitet|infraestrut|logística|transporte/i.test(ctx))
    return { tom: 'strength, reliability, built to last', conceito: 'foundations that endure — solid, professional, trustworthy', detalhes: 'steel greys and deep blues, bold structural lines, strong geometric composition' };

  if (/criat|agência|design|foto|marketing|publicidad|moda/i.test(ctx))
    return { tom: 'bold creativity, distinctive vision, cultural edge', conceito: 'the mark of originality — unexpected, memorable, confident', detalhes: 'high contrast, unexpected color combinations, expressive typography, dynamic asymmetric layout' };

  // default
  return { tom: 'confident professional excellence, trusted authority', conceito: 'the mark of expertise — serious, distinctive, premium', detalhes: 'layered atmospheric depth, precise structural gradients, sophisticated color palette' };
}

// ── Mapeia estilo → instrução visual ──────────────────────────────────────────

function _estiloParaDiretriz(estilo: string, cp: string, cs: string): string {
  const s = estilo.toLowerCase();
  if (/dark|escuro|exec|premium|luxo|sofisticad/i.test(s))
    return `Dark executive: ${cp} as the dominant dark base, ${cs} as precision gold/amber accent. Deep atmospheric depth. White typography. Velvet-like surface quality.`;
  if (/light|claro|clean|minim|suave|acolh/i.test(s))
    return `Clean luminous: white or very light ${cp}-tinted background. ${cs} as warm accent on key elements. Subtle tonal shifts. Dark ${cp} typography for maximum contrast.`;
  if (/impacto|bold|arrojado|energétic|forte|vibrante/i.test(s))
    return `Maximum impact: ${cp} bold base, ${cs} electric accent slashes and highlights. High contrast geometry. Strong diagonal energy. Powerful visual statement.`;
  // generic / unknown
  return `Professional: ${cp} dominant, ${cs} accent highlights. Modern atmospheric composition. Clean, premium feel.`;
}

// ── Constrói o prompt para o cartão completo ──────────────────────────────────

function construirPrompt(d: CartaoInput): string {
  const empresa   = (d.empresa   ?? '').trim();
  const nome      = (d.nome      ?? '').trim();
  const cargo     = (d.cargo     ?? '').trim();
  const telefone  = (d.telefone  ?? '').trim();
  const email     = (d.email     ?? '').trim();
  const site      = (d.site      ?? '').trim();
  const instagram = (d.instagram ?? '').trim();
  const facebook  = (d.facebook  ?? '').trim();
  const servicos  = (d.servicos  ?? '').trim();
  const cp        = (d.cor_primaria   ?? '#1A2744').trim();
  const cs        = (d.cor_secundaria ?? '#C9A84C').trim();
  const obs       = (d.observacoes    ?? '').trim();

  const pers = _personalidadePorSegmento(d.segmento ?? '', empresa, cargo);
  const estiloDir = _estiloParaDiretriz(d.estilo ?? '', cp, cs);

  // Bloco de texto a ser renderizado no verso
  const contatos = [
    nome      && `• PERSON NAME (large, prominent): "${nome}"`,
    cargo     && `• JOB TITLE (accent color, below name): "${cargo}"`,
    telefone  && `• PHONE (with phone icon): ${telefone}`,
    email     && `• EMAIL (with envelope icon): ${email}`,
    site      && `• WEBSITE (with globe icon): ${site}`,
    instagram && `• INSTAGRAM (with IG icon): ${instagram}`,
    facebook  && `• FACEBOOK (with FB icon): ${facebook}`,
    servicos  && `• SERVICES (small, subtle): ${servicos}`,
  ].filter(Boolean).join('\n');

  const obsLine = obs ? `\nSPECIAL CLIENT DIRECTIVE: "${obs}"` : '';

  return [
    // ── Role ──
    `You are a senior graphic designer at a top São Paulo creative agency. Your task is to produce a complete, print-ready business card as a single finished image — all typography, layout, colors, and contact details are rendered directly in the image.`,

    // ── Format ──
    `IMAGE FORMAT: Wide horizontal (landscape 3:2). The image shows BOTH SIDES of the business card laid out side by side. Left half = FRONT SIDE. Right half = BACK SIDE. Do not add any border, frame, shadow, or background around the card — the image IS the card.`,

    // ── Visual personality ──
    `BRAND PERSONALITY: ${pers.tom}. Creative concept: "${pers.conceito}". Visual language: ${pers.detalhes}.`,

    // ── Style directive ──
    `COLOR AND STYLE DIRECTIVE: ${estiloDir}${obsLine}`,

    // ── Left half: front ──
    `LEFT HALF — FRONT SIDE:`,
    `Background: rich atmospheric composition in dominant color ${cp} with subtle ${cs} accents. Use ${pers.detalhes} as visual elements.`,
    empresa ? `Company name "${empresa}" in large, bold, premium sans-serif typography — this is the hero element of the front side.` : `Clean abstract brand composition.`,
    `The front must feel prestigious, immediately memorable, and unmistakably professional. No contact info on the front — brand identity only.`,

    // ── Right half: back ──
    `RIGHT HALF — BACK SIDE:`,
    `Complementary background that harmonizes with the front. Enough contrast for all text to be perfectly readable.`,
    `Render ALL of the following text with precision — correct spelling, correct spacing, clean typography:`,
    contatos,
    `Each contact line should have a small professional icon (◎ for phone, ✉ for email, ⊕ for web, ⓘ for social).`,

    // ── Typography rules ──
    `TYPOGRAPHY REQUIREMENTS:`,
    `- Font style: modern geometric sans-serif (Inter, Montserrat, or Raleway quality)`,
    `- Hierarchy: company > person name > title > contacts (decreasing size)`,
    `- Person's name must be clearly the largest element on the back side`,
    `- ALL text must be PIXEL-SHARP and perfectly legible`,
    `- Copy every piece of text EXACTLY as written above — zero spelling errors`,
    `- No placeholder text, no lorem ipsum, no invented content`,

    // ── Quality bar ──
    `QUALITY STANDARD: This is a premium print piece. Treat it as a final deliverable, not a concept. Every pixel matters. The result must look like it was designed by a human creative director with 15 years of experience.`,
  ].join('\n\n');
}

// ── Upload para Supabase Storage ──────────────────────────────────────────────

async function uploadParaStorage(pngBytes: Uint8Array): Promise<string | null> {
  const supUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supUrl || !supKey) {
    console.warn('[cartao-openai/storage] credenciais ausentes');
    return null;
  }
  const file = `cartao-ia-${Date.now()}.png`;
  try {
    const up = await fetch(`${supUrl}/storage/v1/object/artes/${file}`, {
      method: 'POST',
      headers: {
        apikey:         supKey,
        Authorization:  `Bearer ${supKey}`,
        'Content-Type': 'image/png',
        'x-upsert':     'true',
      },
      body: pngBytes,
      signal: AbortSignal.timeout(20_000),
    });
    if (up.ok) {
      const url = `${supUrl}/storage/v1/object/public/artes/${file}`;
      console.log('[cartao-openai/storage] upload OK:', url);
      return url;
    }
    console.error('[cartao-openai/storage] upload falhou:', up.status, (await up.text()).slice(0, 200));
    return null;
  } catch (err) {
    console.error('[cartao-openai/storage] exceção:', String(err).slice(0, 100));
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();

  try {
    const d: CartaoInput = await req.json();

    const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    if (!openAiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada no ambiente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prompt = construirPrompt(d);
    console.log('[cartao-openai] empresa:', d.empresa, '| segmento:', d.segmento, '| estilo:', d.estilo);
    console.log('[cartao-openai] prompt_len:', prompt.length);

    // ── Chama OpenAI gpt-image-1 ──────────────────────────────────────────────
    console.log('[cartao-openai] openai_inicio | elapsed:', Date.now() - t0, 'ms');
    const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model:         'gpt-image-1',
        prompt,
        n:             1,
        size:          '1536x1024',
        quality:       'high',
        output_format: 'png',
      }),
      signal: AbortSignal.timeout(90_000),
    });

    console.log('[cartao-openai] openai_status:', openAiRes.status, '| elapsed:', Date.now() - t0, 'ms');

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error('[cartao-openai] openai erro:', errText.slice(0, 400));
      return new Response(
        JSON.stringify({ error: 'Falha na geração com OpenAI', detail: errText.slice(0, 400) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openAiData = await openAiRes.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = openAiData.data?.[0]?.b64_json;

    if (!b64) {
      console.error('[cartao-openai] b64_json ausente na resposta');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da OpenAI: b64_json ausente' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Converte e faz upload ─────────────────────────────────────────────────
    const pngBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    console.log('[cartao-openai] imagem_gerada | bytes:', pngBytes.length, '| elapsed:', Date.now() - t0, 'ms');

    const storageUrl = await uploadParaStorage(pngBytes);
    const url = storageUrl ?? `data:image/png;base64,${b64}`;

    console.log('[cartao-openai] concluído | storage:', !!storageUrl, '| total:', Date.now() - t0, 'ms');

    return new Response(
      JSON.stringify({
        url,
        tipo_produto: 'cartao_visita',
        modo:         'ia_pura',
        _via:         'gpt-image-1',
        _storage:     !!storageUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[cartao-openai] exceção:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
