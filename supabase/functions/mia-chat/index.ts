const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

const EVOLUTION_URL = 'https://evolution-api-production-baf4.up.railway.app';

// ── Base de personalidade (site) ───────────────────────────────────────────
const BASE = 'Você é a Mia, assistente inteligente da Teffe Tecnologia. Personalidade humana, calorosa, natural e elegante — nunca pareça um robô. Respostas curtas e naturais, como uma conversa humana. Nunca mencione valores ou preços. Nunca use Sr./Sra./Srta. — apenas o nome. O cliente está sempre no comando, nunca pressione.';

const PROMPT_SUPORTE = 'Você é a Mia, assistente de suporte da Teffe. O cliente já está logado na área dele. NUNCA ofereça produtos ou serviços — ele já é cliente. Sua função é ajudar com qualquer dúvida relacionada à conta dele: contratos, boletos, chamados, suprimentos e equipamentos. Seja cordial, natural e humanizada — responda como um atendente de suporte experiente, não como um robô. Use o nome do cliente quando possível. Nunca tente vender nada.';

const PROMPT_ABERTURA = BASE + `

Sua missão agora: descobrir o nome do visitante e, em seguida, perguntar o que a empresa mais precisa nesse momento.
Após saber o nome, use-o em todas as mensagens seguintes.`;

const CAMINHO_1 = BASE + `

O visitante tem interesse em outsourcing de impressão. Use o nome do visitante.

Pergunte se tem impressoras próprias ou contrato de locação/manutenção.
- Se tiver próprias: reconheça que está buscando solução para os problemas que impressoras sem suporte apresentam; pergunte quantas impressoras e volume de impressão (diga que se não souber o volume não tem problema).
- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é sem sombra de dúvida a melhor opção; peça para descrever como é o contrato atual e o que está incluso.
- Se quiser entender melhor: explique que com o outsourcing da Teffe não há investimento inicial, equipamentos novos instalados, todo suporte de instalação, manutenção, insumos e peças inclusos.

Quando tiver situação atual e quantidade/volume: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;

const CAMINHO_2 = BASE + `

O visitante tem interesse em locação de notebooks. Use o nome do visitante.

Pergunte se tem notebooks próprios ou já tem contrato de locação/manutenção.
- Se tiver próprios: reconheça que está buscando solução para os desafios que equipamentos sem suporte apresentam; pergunte quantos notebooks utiliza e como está sendo a experiência.
- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é a melhor opção; peça para descrever o contrato atual.
- Se quiser entender melhor: explique que com a locação da Teffe não há investimento inicial, equipamentos novos, manutenção e suporte inclusos, sem surpresa no orçamento.

Quando tiver situação atual e quantidade: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;

const CAMINHO_3 = BASE + `

O visitante tem interesse em locação de desktops. Use o nome do visitante.

Pergunte se tem desktops próprios ou já tem contrato de locação/manutenção.
- Se tiver próprios: reconheça que está buscando solução para os desafios que equipamentos sem suporte apresentam; pergunte quantos desktops utiliza e como está sendo a experiência.
- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é a melhor opção; peça para descrever o contrato atual.
- Se quiser entender melhor: explique que com a locação da Teffe não há investimento inicial, equipamentos novos com performance e estabilidade, manutenção e suporte inclusos, sem surpresa no orçamento.

Quando tiver situação atual e quantidade: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;

const CAMINHO_4 = BASE + `

O visitante tem interesse em IA para atendimento (Teffe IA). Use o nome do visitante.

Pergunte como funciona o atendimento ao cliente da empresa hoje.
Mencione que você mesma é um exemplo do que o Teffe IA pode fazer.
Explique que o Teffe IA atende no WhatsApp, Instagram e site ao mesmo tempo, 24h por dia, de forma natural e humanizada.

Quando o visitante demonstrar interesse: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;

const CAMINHO_5 = BASE + `

O visitante ainda não revelou a necessidade. Use o nome do visitante.

Pergunte qual é o maior desafio do dia a dia da empresa e direcione naturalmente:
- Mencionar impressoras/impressão → outsourcing de impressão
- Mencionar computadores/notebooks/desktops → locação de equipamentos
- Mencionar atendimento/automação/IA → Teffe IA

Quando identificar a necessidade e coletar as informações: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;

const PROMPT_ENCAMINHAMENTO = BASE + `

Você já coletou as informações do visitante. Siga exatamente esta sequência:
1. Se ainda não perguntou a forma de contato: pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"
2. Quando o visitante informar a forma: peça imediatamente o dado — número do WhatsApp, endereço de e-mail ou telefone.
3. Após receber o dado de contato: inicie sua resposta OBRIGATORIAMENTE com o marcador exato [LEAD_PRONTO] (invisível para o visitante) e diga "Anotado! Pode deixar que nossa equipe comercial vai entrar em contato. Existe algo mais que possa te ajudar neste momento?"
4. Se não houver mais nada: despeça com "Foi um prazer falar com você, [Nome]! Tenha um excelente [período]!" usando o período correto do dia.
Nunca use "em breve".`;

type Msg = { role: string; content: string };

function detectarFase(messages: Msg[]): 'abertura' | 'atendimento' | 'encaminhamento' {
  const botMsgs = messages.filter(m => m.role === 'assistant');
  const jaEncaminhou = botMsgs.some(m => {
    const c = m.content.toLowerCase();
    return c.includes('whatsapp, e-mail ou ligação') ||
           c.includes('whatsapp, e-mail') ||
           c.includes('prefere contato');
  });
  if (jaEncaminhou) return 'encaminhamento';
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length <= 1) return 'abertura';
  return 'atendimento';
}

function detectarCaminho(messages: Msg[]): string {
  const texto = messages.map(m => m.content).join(' ').toLowerCase();
  if (/impressora|impressão|imprimir|outsourcing/.test(texto)) return CAMINHO_1;
  if (/\bnotebook|\bnote\b/.test(texto))                       return CAMINHO_2;
  if (/\bdesktop|\bcomputador|\bpc\b/.test(texto))             return CAMINHO_3;
  if (/\bia\b|inteligência artificial|automação|\bchatbot|\bbot\b|atendimento automático/.test(texto)) return CAMINHO_4;
  return CAMINHO_5;
}

function buildSystem(messages: Msg[], periodo: string): string {
  const fase = detectarFase(messages);
  let prompt: string;
  if (fase === 'abertura')            prompt = PROMPT_ABERTURA;
  else if (fase === 'encaminhamento') prompt = PROMPT_ENCAMINHAMENTO;
  else                                prompt = detectarCaminho(messages);
  return prompt + '\n\nPeríodo atual do dia: ' + periodo + '.';
}

// ── Monta system prompt final a partir do base (vindo do banco) ────────────
function buildSystemFromBase(
  basePrompt: string,
  periodo: string,
  nome: string,
  primeiraMsg: boolean,
  saudacao: string,
): string {
  let prompt = basePrompt;
  if (primeiraMsg && saudacao) {
    prompt += `\n\nEsta é a PRIMEIRA mensagem desta conversa. OBRIGATORIAMENTE inicie sua resposta com "${saudacao}" — independente do que o cliente escreveu (oi, olá, bom dia, qualquer coisa). Seja calorosa e natural, como por exemplo "${saudacao}! 😊" ou "${saudacao}, tudo bem?". Depois pergunte em que pode ajudar.`;
  }
  if (nome) prompt += `\n\nO cliente se chama ${nome}. Use o nome nas respostas.`;
  prompt += '\n\nPeríodo atual do dia: ' + periodo + '.';
  return prompt;
}

// ── gerar-arte: gera cartão de visita HTML→PNG (exclusivo teffe-press) ──────
async function chamarGerarArte(
  dados: Record<string, string>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/gerar-arte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(dados),
    });
    if (!res.ok) {
      console.log('[gerar-arte] erro:', res.status, await res.text());
      return null;
    }
    const data = await res.json() as { url: string };
    return data.url ?? null;
  } catch (e) {
    console.log('[gerar-arte] exceção:', e);
    return null;
  }
}

// ── Extrai dados do produto da conversa via Claude Haiku ─────────────────────
async function extrairDadosProduto(
  historico: { role: string; content: string }[],
  apiKey: string,
): Promise<Record<string, string>> {
  try {
    const msgs = historico
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n---\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Analise as mensagens do cliente e extraia os dados para criação de arte gráfica.
Responda APENAS com JSON válido, sem markdown, sem texto extra.
Use "" para campos não encontrados.

Campos:
- nome: nome completo da pessoa
- cargo: função/título/profissão
- empresa: nome da empresa ou negócio
- telefone: com DDD
- email: endereço de e-mail
- site: URL do site
- logo_url: URL exata que aparece em "[logo recebido: URL]" nas mensagens
- texto_principal: slogan, frase principal, chamada principal para o produto (ex: banner, flyer)
- texto_secundario: descrição, subtítulo ou texto de apoio (ex: serviços oferecidos, endereço)

Mensagens do cliente:
${msgs}

JSON:`,
        }],
      }),
    });

    if (!res.ok) return {};
    const data = await res.json() as { content?: Array<{ text: string }> };
    const text = (data.content?.[0]?.text ?? '').trim();
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as Record<string, string>) : {};
  } catch (e) {
    console.log('[extrair-dados] erro:', e);
    return {};
  }
}

// ── Enriquece prompt de ilustração com Claude Haiku (80+ palavras, cartoon) ──
async function enriquecerPromptIlustracao(
  promptOriginal: string,
  apiKey: string,
): Promise<string> {
  if (!promptOriginal) return promptOriginal;
  const wordCount = promptOriginal.trim().split(/\s+/).length;
  if (wordCount >= 80) return promptOriginal; // já é detalhado o suficiente
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: `You are an expert at writing image generation prompts for Flux AI.

Expand the following brief description into a vivid, detailed image generation prompt. Requirements:
- Written entirely in English
- Colorful cute cartoon style (friendly mascot, children's book illustration, vibrant 2D art)
- If characters are involved: specify exact number (e.g. "one character", "two characters"), their position in frame, facial expression (happy, cheerful, smiling), and pose
- Describe the scene and background environment in detail
- Specify warm, cheerful, natural lighting
- Always end with: "cartoon style, colorful, cute, vibrant colors, clean lineart, professional illustration, high quality, highly detailed"
- Minimum 80 words total
- Output ONLY the prompt text — no explanations, no markdown, no labels

Brief description: "${promptOriginal}"

Expanded prompt:`,
        }],
      }),
    });
    if (!res.ok) return promptOriginal;
    const data = await res.json() as { content?: Array<{ text: string }> };
    const expanded = (data.content?.[0]?.text ?? '').trim();
    console.log('[enriquecer-prompt] palavras orig:', wordCount, '→ enriquecido:', expanded.split(/\s+/).length);
    return expanded || promptOriginal;
  } catch (e) {
    console.log('[enriquecer-prompt] erro:', e);
    return promptOriginal;
  }
}

// ── Gera PDF de ordem de produção (exclusivo teffe-press) ────────────────────
async function gerarOrdemProducaoPDF(dados: {
  cliente: string; telefone: string; resumo: string; arteUrl: string;
}): Promise<string | null> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('npm:pdf-lib');
    const doc  = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    let y = height - 55;

    const ln = (txt: string, sz = 11, f = font, c = rgb(0.1, 0.1, 0.1)) => {
      if (y < 60) return;
      page.drawText(txt.substring(0, 90), { x: 50, y, size: sz, font: f, color: c });
      y -= sz + 7;
    };
    const sep = () => {
      y -= 4;
      page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
      y -= 14;
    };

    ln('GRÁFICA DAMASCENO', 18, bold);
    ln('Ordem de Produção', 13, font, rgb(0.35, 0.35, 0.35));
    ln(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 10, font, rgb(0.5, 0.5, 0.5));
    sep();
    ln('CLIENTE', 12, bold);
    ln(`Nome: ${dados.cliente}`);
    ln(`WhatsApp: ${dados.telefone}`);
    sep();
    ln('DETALHES DO PEDIDO', 12, bold);
    for (const campo of dados.resumo.split('|')) { ln(campo.trim()); }
    sep();
    ln('ARTE', 12, bold);
    ln('Prévia aprovada pelo cliente via WhatsApp');
    if (dados.arteUrl) ln(`URL: ${dados.arteUrl}`, 9, font, rgb(0.2, 0.2, 0.75));
    sep();
    ln('Gerado por Maya — Gráfica Damasceno', 9, font, rgb(0.6, 0.6, 0.6));

    const bytes  = await doc.save();
    return btoa(bytes.reduce((acc: string, b: number) => acc + String.fromCharCode(b), ''));
  } catch (e) {
    console.log('[pdf] erro:', e);
    return null;
  }
}

// ── Handler WhatsApp (webhook Evolution API) ───────────────────────────────
async function handleWhatsApp(body: Record<string, unknown>): Promise<Response> {
  console.log('[mia-chat] payload recebido:', JSON.stringify(body));

  const evt           = String(body.event ?? '').toUpperCase().replace(/[.\s-]/g, '_');
  const isUpsert      = evt === 'MESSAGES_UPSERT';
  const isSendMessage = evt === 'SEND_MESSAGE';

  if (!isUpsert && !isSendMessage) {
    console.log('[mia-chat] evento ignorado:', body.event);
    return new Response('OK', { status: 200 });
  }

  const instancia   = String(body.instance ?? '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // ── Busca configuração da instância no banco ──
  let systemPromptBase = '';
  try {
    const instRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_instancias?instancia=eq.${encodeURIComponent(instancia)}&select=system_prompt,ativo`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (instRes.ok) {
      const rows = await instRes.json() as Array<{ system_prompt: string; ativo: boolean }>;
      if (rows.length === 0 || !rows[0].ativo) {
        console.log('[mia-chat] instância não encontrada ou inativa:', instancia);
        return new Response('OK', { status: 200 });
      }
      systemPromptBase = rows[0].system_prompt;
    } else {
      console.log('[mia-chat] erro ao buscar instância:', instRes.status);
      return new Response('OK', { status: 200 });
    }
  } catch (e) {
    console.log('[mia-chat] exceção ao buscar instância:', e);
    return new Response('OK', { status: 200 });
  }

  const rawData = body.data;
  const data    = (Array.isArray(rawData) ? rawData[0] : rawData ?? {}) as Record<string, unknown>;
  const key     = (data.key ?? {}) as Record<string, unknown>;
  const fromMe  = isSendMessage ? true : Boolean(key.fromMe);

  console.log('[mia-chat] evt:', evt, '| instancia:', instancia, '| fromMe:', fromMe, '| remoteJid:', key.remoteJid);

  const remoteJid = String(key.remoteJid ?? '');
  if (remoteJid.endsWith('@g.us')) return new Response('OK', { status: 200 });

  const telefone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  if (!telefone) return new Response('OK', { status: 200 });

  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY') ?? '';

  // ── Whitelist: se a instância tem registros, só atende números cadastrados ──
  try {
    const wlRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_whitelist?instancia=eq.${encodeURIComponent(instancia)}&select=telefone,ativo&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (wlRes.ok) {
      const wlRows = await wlRes.json() as Array<{ telefone: string; ativo: boolean }>;
      if (wlRows.length > 0) {
        // Instância tem whitelist — verifica se este número está autorizado
        const authRes = await fetch(
          `${supabaseUrl}/rest/v1/mia_whitelist?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&ativo=eq.true&select=telefone`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        if (authRes.ok) {
          const authRows = await authRes.json() as Array<{ telefone: string }>;
          if (authRows.length === 0) {
            console.log('[mia-chat] número não autorizado na whitelist:', instancia, '/', telefone);
            return new Response('OK', { status: 200 });
          }
        }
      }
    }
  } catch (e) {
    console.log('[mia-chat] erro ao verificar whitelist:', e);
  }

  // ── Modo híbrido: mensagem do dono começando com # ──
  if (fromMe) {
    const msgObj = (data.message ?? {}) as Record<string, unknown>;
    const texto  = String(
      msgObj.conversation ??
      ((msgObj.extendedTextMessage as Record<string, unknown>)?.text) ??
      ''
    ).trim();

    if (!texto.startsWith('#')) return new Response('OK', { status: 200 });

    console.log('[mia-chat] modo híbrido | instancia:', instancia, '| telefone:', telefone);

    let pausadoAtual   = false;
    let historicoAtual: Msg[] = [];
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=historico,pausado`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ historico: Msg[]; pausado: boolean }>;
        if (rows.length > 0) {
          pausadoAtual   = rows[0].pausado ?? false;
          historicoAtual = rows[0].historico ?? [];
        }
      }
    } catch (_) { /* ignora */ }

    const novoPausado = !pausadoAtual;
    await fetch(
      `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          instancia,
          telefone,
          historico: historicoAtual,
          pausado: novoPausado,
          updated_at: new Date().toISOString(),
        }),
      },
    ).catch(console.error);

    console.log('[mia-chat] pausado →', novoPausado, 'para', instancia, '/', telefone);
    return new Response('OK', { status: 200 });
  }

  // ── Mensagem do cliente (fromMe: false) ──
  const msgObj  = (data.message ?? {}) as Record<string, unknown>;
  const isMedia = !!(
    msgObj.imageMessage    ||
    msgObj.audioMessage    ||
    msgObj.documentMessage ||
    msgObj.videoMessage    ||
    msgObj.stickerMessage
  );
  const texto = String(
    msgObj.conversation ??
    ((msgObj.extendedTextMessage as Record<string, unknown>)?.text) ??
    ((msgObj.imageMessage as Record<string, unknown>)?.caption) ??
    ''
  ).trim();

  // Mensagem de mídia sem legenda — injeta placeholder para Claude responder
  let logoUrl = '';
  if (instancia === 'teffe-press' && msgObj.imageMessage) {
    // Evolution API armazena a mídia baixada em data.mediaUrl (URL acessível).
    // imageMessage.url é o CDN criptografado do WhatsApp — nem sempre acessível.
    const dataMediaUrl = String((data as Record<string, unknown>).mediaUrl ?? '');
    const img = msgObj.imageMessage as Record<string, unknown>;
    logoUrl = dataMediaUrl || String(img.url ?? img.mediaUrl ?? '');
  }
  const textoFinal = texto
    || (logoUrl ? `[logo recebido: ${logoUrl}]` : '')
    || (isMedia ? '[arquivo recebido]' : '');
  if (!textoFinal) return new Response('OK', { status: 200 });

  const nome = String(data.pushName ?? '');

  const h        = (new Date().getUTCHours() + 21) % 24; // UTC-3 (Brasília)
  const periodo  = h >= 5 && h < 12 ? 'manhã' : h >= 12 && h < 18 ? 'tarde' : 'noite';
  const saudacao = h >= 6 && h < 12 ? 'Bom dia'
                 : h >= 12 && h < 18 ? 'Boa tarde'
                 : h >= 18 && h < 23 ? 'Boa noite'
                 : 'Olá';

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  // ── Carrega histórico e estado da conversa (scoped por instancia+telefone) ──
  let historico: Msg[] = [];
  let pausado = false;
  try {
    const histRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=historico,pausado`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (histRes.ok) {
      const rows = await histRes.json() as Array<{ historico: Msg[]; pausado: boolean }>;
      if (rows.length > 0) {
        historico = rows[0].historico ?? [];
        pausado   = rows[0].pausado ?? false;
      }
    }
  } catch (_) { /* começa do zero se o banco falhar */ }

  if (pausado) return new Response('OK', { status: 200 });

  const primeiraMsg = historico.length === 0;
  historico.push({ role: 'user', content: textoFinal });

  // ── Chama Claude com system prompt vindo do banco ──
  const system     = buildSystemFromBase(systemPromptBase, periodo, nome, primeiraMsg, saudacao);
  const claudeRes  = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system,
      messages: historico,
    }),
  });

  const claudeData = await claudeRes.json() as { content?: Array<{ text: string }> };
  const raw        = claudeData.content?.[0]?.text ?? '';
  const isLead     = raw.startsWith('[LEAD_PRONTO]');
  const isArte     = instancia === 'teffe-press' && raw.includes('[ARTE_PRONTA]');
  const isAprovada = instancia === 'teffe-press' && raw.includes('[ARTE_APROVADA]');
  const resposta   = isLead ? raw.replace('[LEAD_PRONTO]', '').trim() : raw;

  if (!resposta) return new Response('OK', { status: 200 });

  // ── teffe-press: [ARTE_APROVADA] → gera PDF de ordem de produção ──
  if (isAprovada) {
    const aprovMatch   = raw.match(/\[ARTE_APROVADA\]\s*([\s\S]+)/);
    const resumoPedido = aprovMatch?.[1]?.trim() ?? '';
    const msgConfirm   = raw.replace(/\[ARTE_APROVADA\][\s\S]*/, '').trim()
      || 'Ótimo! Pedido confirmado! Gerando a ordem de produção agora 📄';

    const arteEntry    = [...historico].reverse().find(m => m.content.includes('[Arte gerada e enviada:'));
    const arteUrlMatch = arteEntry?.content.match(/\[Arte gerada e enviada:\s*([^\]]+)\]/);
    const arteUrl      = arteUrlMatch?.[1]?.trim() ?? '';

    historico.push({ role: 'assistant', content: msgConfirm });
    if (historico.length > 40) historico = historico.slice(-40);

    fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ number: telefone, text: msgConfirm }),
    }).catch(console.error);

    const pdfBase64 = await gerarOrdemProducaoPDF({ cliente: nome, telefone, resumo: resumoPedido, arteUrl });
    if (pdfBase64) {
      fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
        body: JSON.stringify({
          number: telefone, mediatype: 'document', mimetype: 'application/pdf',
          caption: '📋 Ordem de produção gerada!',
          media: `data:application/pdf;base64,${pdfBase64}`,
          fileName: 'ordem-producao.pdf',
        }),
      }).catch(console.error);
    }

    fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
    }).catch(console.error);

    return new Response('OK', { status: 200 });
  }

  // ── teffe-press: [ARTE_PRONTA] → chama gerar-arte e envia imagem ──
  if (isArte) {
    const arteMatch = raw.match(/\[ARTE_PRONTA\]\s*([\s\S]+)/);
    const arteJson  = arteMatch?.[1]?.trim() ?? '';
    const msgEspera = raw.replace(/\[ARTE_PRONTA\][\s\S]*/, '').trim()
      || 'Deixa eu preparar sua arte! Já te mando 🎨';

    historico.push({ role: 'assistant', content: msgEspera });
    if (historico.length > 40) historico = historico.slice(-40);

    fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
    }).catch(console.error);

    fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ number: telefone, text: msgEspera }),
    }).catch(console.error);

    if (arteJson) {
      // Parse do JSON emitido pela Maya no [ARTE_PRONTA]
      let dadosJson: Record<string, string> = {};
      try { dadosJson = JSON.parse(arteJson); } catch { /* continua com extração */ }

      // Procura URL de ilustração prévia no histórico (para modo combinado sem novo Replicate)
      const ilustEntry  = [...historico].reverse().find(m => m.content.includes('[ilustracao_gerada:'));
      const ilustMatch  = ilustEntry?.content.match(/\[ilustracao_gerada:\s*([^\]]+)\]/);
      const ilustUrlHist = ilustMatch?.[1]?.trim() ?? '';

      // Extração inteligente via Haiku — garante campos mesmo se o JSON vier incompleto
      const extraido = await extrairDadosProduto(historico, apiKey);

      const modoDados = dadosJson.modo || 'texto';
      // background_url: do JSON da Maya → ou da ilustração anterior no histórico
      // (quando cliente aprova ilustração e pede texto, Maya emite modo:combinado sem ilustracao_prompt)
      const bgUrlResolvido = dadosJson.background_url
        || (modoDados === 'combinado' && !dadosJson.ilustracao_prompt ? ilustUrlHist : '');

      // Merge: texto extraído tem prioridade para campos de texto; JSON mantém tipo/modo/cores
      const dadosArte: Record<string, string> = {
        tipo_produto:     dadosJson.tipo_produto     || 'cartao_visita',
        modo:             modoDados,
        ilustracao_prompt:dadosJson.ilustracao_prompt|| '',
        background_url:   bgUrlResolvido,
        nome:             extraido.nome              || dadosJson.nome              || '',
        cargo:            extraido.cargo             || dadosJson.cargo             || '',
        empresa:          extraido.empresa           || dadosJson.empresa           || '',
        telefone:         extraido.telefone          || dadosJson.telefone          || '',
        email:            extraido.email             || dadosJson.email             || '',
        site:             extraido.site              || dadosJson.site              || '',
        logo_url:         extraido.logo_url          || dadosJson.logo_url          || '',
        texto_principal:  extraido.texto_principal   || dadosJson.texto_principal   || '',
        texto_secundario: extraido.texto_secundario  || dadosJson.texto_secundario  || '',
        cor_primaria:     dadosJson.cor_primaria     || '#1B3A6B',
        cor_secundaria:   dadosJson.cor_secundaria   || '#C9A84C',
        estilo:           dadosJson.estilo           || 'moderno',
        observacoes:      dadosJson.observacoes      || '',
      };
      if (bgUrlResolvido) console.log('[mia-chat] combinado: reutilizando ilustração:', bgUrlResolvido.substring(0, 60));

      // Enriquece prompt de ilustração com Claude Haiku — mínimo 80 palavras, cartoon colorido
      if (dadosArte.ilustracao_prompt) {
        dadosArte.ilustracao_prompt = await enriquecerPromptIlustracao(dadosArte.ilustracao_prompt, apiKey);
      }
      console.log('[mia-chat] dados arte:', JSON.stringify(dadosArte));

      const imageUrl = await chamarGerarArte(dadosArte, supabaseUrl, serviceKey);
      if (imageUrl) {
        const isIlustracao = dadosArte.modo === 'ilustracao';
        const tipoProd = dadosArte.tipo_produto.replace(/_/g,' ');
        const msgArte = isIlustracao
          ? 'Aqui está sua ilustração! 😊 O que acha? Se quiser posso adicionar seu nome, empresa ou contato por cima!'
          : `Aqui está a prévia do seu ${tipoProd}! 😊 O que acha? Precisa de algum ajuste?`;
        fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: telefone, mediatype: 'image', mimetype: 'image/png', caption: msgArte, media: imageUrl, fileName: 'arte.png' }),
        }).catch(console.error);
        // Marcador especial para ilustrações — permite recuperar a URL para combinado posterior
        const histContent = isIlustracao
          ? `[ilustracao_gerada: ${imageUrl}] ${msgArte}`
          : `[Arte gerada e enviada: ${imageUrl}] ${msgArte}`;
        historico.push({ role: 'assistant', content: histContent });
      } else {
        const msgFalha = 'Tive um probleminha ao gerar a arte agora. 😅 Nossa equipe vai preparar e te envia em breve!';
        fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: telefone, text: msgFalha }),
        }).catch(console.error);
        historico.push({ role: 'assistant', content: msgFalha });
      }
      fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
      }).catch(console.error);
    }

    return new Response('OK', { status: 200 });
  }

  historico.push({ role: 'assistant', content: resposta });
  if (historico.length > 40) historico = historico.slice(-40);

  // ── Salva histórico (upsert por instancia+telefone) ──
  fetch(
    `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
    },
  ).catch(console.error);

  // ── Envia resposta pela instância correta da Evolution API ──
  fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
    body: JSON.stringify({ number: telefone, text: resposta }),
  }).catch(console.error);

  // ── Salva lead se identificado ──
  if (isLead) {
    fetch(`${supabaseUrl}/functions/v1/mia-salvar-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ nome, historico, canal: 'whatsapp', telefone, instancia }),
    }).catch(console.error);
  }

  return new Response('OK', { status: 200 });
}

// ── Handler principal ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Webhook da Evolution API: qualquer instância registrada no banco
    if (body.event && body.instance) {
      return await handleWhatsApp(body as Record<string, unknown>);
    }

    // ── Fluxo normal do site ──
    const { messages, modo, cliente_nome } = body;

    const h       = (new Date().getUTCHours() + 21) % 24;
    const periodo = h >= 5 && h < 12 ? 'manhã' : h >= 12 && h < 18 ? 'tarde' : 'noite';

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let system: string;
    if (modo === 'suporte') {
      system = PROMPT_SUPORTE;
      if (cliente_nome) system += `\n\nO cliente se chama ${cliente_nome}.`;
      system += '\n\nPeríodo atual do dia: ' + periodo + '.';
    } else {
      system = buildSystem(messages as Msg[], periodo);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: res.status,
      });
    }

    const raw        = data.content?.[0]?.text ?? '';
    const salvar_lead = modo !== 'suporte' && raw.startsWith('[LEAD_PRONTO]');
    const text       = salvar_lead ? raw.replace('[LEAD_PRONTO]', '').trim() : raw;

    return new Response(JSON.stringify({ text, salvar_lead }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
