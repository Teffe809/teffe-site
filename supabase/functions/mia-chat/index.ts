const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

const EVOLUTION_URL = 'https://evolution-api-production-baf4.up.railway.app';

type Msg = { role: string; content: string };

// ── Prompts do site (sem mudança) ──────────────────────────────────────────
const BASE = 'Você é a Mia, assistente inteligente da Teffe Tecnologia. Personalidade humana, calorosa, natural e elegante — nunca pareça um robô. Respostas curtas e naturais, como uma conversa humana. Nunca mencione valores ou preços. Nunca use Sr./Sra./Srta. — apenas o nome. O cliente está sempre no comando, nunca pressione.';
const PROMPT_SUPORTE = 'Você é a Mia, assistente de suporte da Teffe. O cliente já está logado na área dele. NUNCA ofereça produtos ou serviços — ele já é cliente. Sua função é ajudar com qualquer dúvida relacionada à conta dele: contratos, boletos, chamados, suprimentos e equipamentos. Seja cordial, natural e humanizada — responda como um atendente de suporte experiente, não como um robô. Use o nome do cliente quando possível. Nunca tente vender nada.';
const PROMPT_ABERTURA = BASE + `\n\nSua missão agora: descobrir o nome do visitante e, em seguida, perguntar o que a empresa mais precisa nesse momento.\nApós saber o nome, use-o em todas as mensagens seguintes.`;
const CAMINHO_1 = BASE + `\n\nO visitante tem interesse em outsourcing de impressão. Use o nome do visitante.\n\nPergunte se tem impressoras próprias ou contrato de locação/manutenção.\n- Se tiver próprias: reconheça que está buscando solução para os problemas que impressoras sem suporte apresentam; pergunte quantas impressoras e volume de impressão (diga que se não souber o volume não tem problema).\n- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é sem sombra de dúvida a melhor opção; peça para descrever como é o contrato atual e o que está incluso.\n- Se quiser entender melhor: explique que com o outsourcing da Teffe não há investimento inicial, equipamentos novos instalados, todo suporte de instalação, manutenção, insumos e peças inclusos.\n\nQuando tiver situação atual e quantidade/volume: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;
const CAMINHO_2 = BASE + `\n\nO visitante tem interesse em locação de notebooks. Use o nome do visitante.\n\nPergunte se tem notebooks próprios ou já tem contrato de locação/manutenção.\n- Se tiver próprios: reconheça que está buscando solução para os desafios que equipamentos sem suporte apresentam; pergunte quantos notebooks utiliza e como está sendo a experiência.\n- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é a melhor opção; peça para descrever o contrato atual.\n- Se quiser entender melhor: explique que com a locação da Teffe não há investimento inicial, equipamentos novos, manutenção e suporte inclusos, sem surpresa no orçamento.\n\nQuando tiver situação atual e quantidade: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;
const CAMINHO_3 = BASE + `\n\nO visitante tem interesse em locação de desktops. Use o nome do visitante.\n\nPergunte se tem desktops próprios ou já tem contrato de locação/manutenção.\n- Se tiver próprios: reconheça que está buscando solução para os desafios que equipamentos sem suporte apresentam; pergunte quantos desktops utiliza e como está sendo a experiência.\n- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é a melhor opção; peça para descrever o contrato atual.\n- Se quiser entender melhor: explique que com a locação da Teffe não há investimento inicial, equipamentos novos com performance e estabilidade, manutenção e suporte inclusos, sem surpresa no orçamento.\n\nQuando tiver situação atual e quantidade: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;
const CAMINHO_4 = BASE + `\n\nO visitante tem interesse em IA para atendimento (Teffe IA). Use o nome do visitante.\n\nPergunte como funciona o atendimento ao cliente da empresa hoje.\nMencione que você mesma é um exemplo do que o Teffe IA pode fazer.\nExplique que o Teffe IA atende no WhatsApp, Instagram e site ao mesmo tempo, 24h por dia, de forma natural e humanizada.\n\nQuando o visitante demonstrar interesse: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;
const CAMINHO_5 = BASE + `\n\nO visitante ainda não revelou a necessidade. Use o nome do visitante.\n\nPergunte qual é o maior desafio do dia a dia da empresa e direcione naturalmente:\n- Mencionar impressoras/impressão → outsourcing de impressão\n- Mencionar computadores/notebooks/desktops → locação de equipamentos\n- Mencionar atendimento/automação/IA → Teffe IA\n\nQuando identificar a necessidade e coletar as informações: diga "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade." e pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"`;
const PROMPT_ENCAMINHAMENTO = BASE + `\n\nVocê já coletou as informações do visitante. Siga exatamente esta sequência:\n1. Se ainda não perguntou a forma de contato: pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"\n2. Quando o visitante informar a forma: peça imediatamente o dado — número do WhatsApp, endereço de e-mail ou telefone.\n3. Após receber o dado de contato: inicie sua resposta OBRIGATORIAMENTE com o marcador exato [LEAD_PRONTO] (invisível para o visitante) e diga "Anotado! Pode deixar que nossa equipe comercial vai entrar em contato. Existe algo mais que possa te ajudar neste momento?"\n4. Se não houver mais nada: despeça com "Foi um prazer falar com você, [Nome]! Tenha um excelente [período]!" usando o período correto do dia.\nNunca use "em breve".`;

function detectarFase(messages: Msg[]): 'abertura' | 'atendimento' | 'encaminhamento' {
  const botMsgs = messages.filter(m => m.role === 'assistant');
  const jaEncaminhou = botMsgs.some(m => {
    const c = m.content.toLowerCase();
    return c.includes('whatsapp, e-mail ou ligação') || c.includes('prefere contato');
  });
  if (jaEncaminhou) return 'encaminhamento';
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length <= 1) return 'abertura';
  return 'atendimento';
}

function detectarCaminho(messages: Msg[]): string {
  const texto = messages.map(m => m.content).join(' ').toLowerCase();
  if (/impressora|impressão|imprimir|outsourcing/.test(texto)) return CAMINHO_1;
  if (/\bnotebook|\bnote\b/.test(texto)) return CAMINHO_2;
  if (/\bdesktop|\bcomputador|\bpc\b/.test(texto)) return CAMINHO_3;
  if (/\bia\b|inteligência artificial|automação|\bchatbot|\bbot\b|atendimento automático/.test(texto)) return CAMINHO_4;
  return CAMINHO_5;
}

function buildSystem(messages: Msg[], periodo: string): string {
  const fase = detectarFase(messages);
  let prompt: string;
  if (fase === 'abertura') prompt = PROMPT_ABERTURA;
  else if (fase === 'encaminhamento') prompt = PROMPT_ENCAMINHAMENTO;
  else prompt = detectarCaminho(messages);
  return prompt + '\n\nPeríodo atual do dia: ' + periodo + '.';
}

function buildSystemFromBase(basePrompt: string, periodo: string, nome: string, primeiraMsg: boolean, saudacao: string): string {
  let prompt = basePrompt;
  if (primeiraMsg && saudacao) {
    prompt += `\n\nEsta é a PRIMEIRA mensagem desta conversa. OBRIGATORIAMENTE inicie sua resposta com "${saudacao}" — independente do que o cliente escreveu. Seja calorosa e natural. Depois pergunte em que pode ajudar.`;
  }
  if (nome) prompt += `\n\nO cliente se chama ${nome}. Use o nome nas respostas.`;
  prompt += '\n\nPeríodo atual do dia: ' + periodo + '.';
  return prompt;
}

// ── Salva logo no Supabase Storage — URL permanente ────────────────────────
async function salvarLogoStorage(url: string, telefone: string, supabaseUrl: string, serviceKey: string, evolutionApiKey: string): Promise<string> {
  if (!url || url === 'processado' || url.includes('/storage/v1/object/public/')) return url;
  try {
    const headers: Record<string, string> = {};
    if (url.includes('evolution-api') || url.includes('mmg.whatsapp.net') || url.includes('mmg-fna') || url.includes('whatsapp')) {
      headers['apikey'] = evolutionApiKey;
    }
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) {
      console.log('[salvarLogoStorage] fetch falhou:', resp.status, url.substring(0, 80));
      return url;
    }
    const buffer = await resp.arrayBuffer();
    const ct = resp.headers.get('content-type') ?? 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : ct.includes('webp') ? 'webp' : 'jpg';
    const nome = `${telefone.replace(/\D/g, '')}_${Date.now()}.${ext}`;
    const uploadResp = await fetch(`${supabaseUrl}/storage/v1/object/logos-cartao/${nome}`, {
      method: 'POST',
      headers: {
        'Content-Type': ct,
        'Authorization': `Bearer ${serviceKey}`,
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!uploadResp.ok) {
      console.log('[salvarLogoStorage] upload falhou:', uploadResp.status, await uploadResp.text());
      return url;
    }
    const urlPublica = `${supabaseUrl}/storage/v1/object/public/logos-cartao/${nome}`;
    console.log('[salvarLogoStorage] salvo:', urlPublica);
    return urlPublica;
  } catch (e) {
    console.log('[salvarLogoStorage] exceção:', e);
    return url;
  }
}

// ── Salva logo_url na tabela mia_conversas_whatsapp ────────────────────────
async function salvarLogoUrl(instancia: string, telefone: string, logoUrl: string, supabaseUrl: string, serviceKey: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ instancia, telefone, logo_url: logoUrl, updated_at: new Date().toISOString() }),
    });
    console.log('[salvarLogoUrl] logo_url salvo na tabela:', logoUrl.substring(0, 80));
  } catch (e) {
    console.log('[salvarLogoUrl] erro:', e);
  }
}

// ── Busca logo_url permanente da tabela ────────────────────────────────────
async function buscarLogoUrl(instancia: string, telefone: string, supabaseUrl: string, serviceKey: string): Promise<string> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=logo_url`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (res.ok) {
      const rows = await res.json() as Array<{ logo_url: string }>;
      return rows[0]?.logo_url ?? '';
    }
  } catch (e) {
    console.log('[buscarLogoUrl] erro:', e);
  }
  return '';
}

// ── Analisa cores do logo via Claude Vision ────────────────────────────────
async function analisarLogo(url: string, anthropicApiKey: string): Promise<{ cor_primaria: string; cor_secundaria: string; descricao: string } | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) { console.log('[analisar-logo] fetch falhou:', imgRes.status); return null; }
    const buf = await imgRes.arrayBuffer();
    const b64 = btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''));
    const rawCt = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(rawCt.split(';')[0])
      ? rawCt.split(';')[0] : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'Analise este logo e responda APENAS com JSON válido, sem markdown.\nCampos:\n- cor_primaria: hex\n- cor_secundaria: hex\n- descricao: até 12 palavras em português\nJSON:' },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const d = await res.json() as { content?: Array<{ text: string }> };
    const txt = (d.content?.[0]?.text ?? '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as { cor_primaria: string; cor_secundaria: string; descricao: string };
  } catch (e) { console.log('[analisar-logo] erro:', e); return null; }
}

// ── Chama gerar-arte ────────────────────────────────────────────────────────
async function chamarGerarArte(dados: Record<string, string>, supabaseUrl: string, serviceKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/gerar-arte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(dados),
    });
    if (!res.ok) { console.log('[gerar-arte] erro:', res.status, await res.text()); return null; }
    const data = await res.json() as { url: string };
    return data.url ?? null;
  } catch (e) { console.log('[gerar-arte] exceção:', e); return null; }
}

// ── Extrai dados do produto via Claude Haiku ───────────────────────────────
async function extrairDadosProduto(historico: Msg[], apiKey: string): Promise<Record<string, string>> {
  try {
    const msgs = historico.filter(m => m.role === 'user').map(m => m.content).join('\n---\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Analise as mensagens do cliente e extraia os dados para criação de arte gráfica.
Responda APENAS com JSON válido, sem markdown. Use "" para campos não encontrados.
Campos: nome, cargo, empresa, telefone, email, site, texto_principal, texto_secundario

Mensagens:
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
  } catch (e) { console.log('[extrair-dados] erro:', e); return {}; }
}

// ── Enriquece prompt de ilustração ─────────────────────────────────────────
async function enriquecerPromptIlustracao(promptOriginal: string, apiKey: string): Promise<string> {
  if (!promptOriginal) return promptOriginal;
  if (promptOriginal.trim().split(/\s+/).length >= 80) return promptOriginal;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: `Expand this brief description into a detailed image generation prompt. Requirements:
- English only
- Colorful cute cartoon style, vibrant 2D art
- Minimum 80 words
- Always end with: "cartoon style, colorful, cute, vibrant colors, clean lineart, professional illustration, high quality"
- Output ONLY the prompt text

Brief: "${promptOriginal}"

Expanded prompt:`,
        }],
      }),
    });
    if (!res.ok) return promptOriginal;
    const data = await res.json() as { content?: Array<{ text: string }> };
    return (data.content?.[0]?.text ?? '').trim() || promptOriginal;
  } catch (e) { console.log('[enriquecer-prompt] erro:', e); return promptOriginal; }
}

// ── Gera PDF de ordem de produção ──────────────────────────────────────────
async function gerarOrdemProducaoPDF(dados: { cliente: string; telefone: string; resumo: string; arteUrl: string }): Promise<string | null> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('npm:pdf-lib');
    const doc = await PDFDocument.create();
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
    const bytes = await doc.save();
    return btoa(bytes.reduce((acc: string, b: number) => acc + String.fromCharCode(b), ''));
  } catch (e) { console.log('[pdf] erro:', e); return null; }
}

// ── Handler WhatsApp ────────────────────────────────────────────────────────
async function handleWhatsApp(body: Record<string, unknown>): Promise<Response> {
  console.log('[mia-chat] payload recebido:', JSON.stringify(body).substring(0, 200));

  const evt = String(body.event ?? '').toUpperCase().replace(/[.\s-]/g, '_');
  const isUpsert = evt === 'MESSAGES_UPSERT';
  const isSendMessage = evt === 'SEND_MESSAGE';
  if (!isUpsert && !isSendMessage) {
    console.log('[mia-chat] evento ignorado:', body.event);
    return new Response('OK', { status: 200 });
  }

  const instancia = String(body.instance ?? '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY') ?? '';
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  console.log('[debug] instancia:', instancia, '| supabaseUrl:', supabaseUrl.substring(0, 40), '| serviceKey ok:', !!serviceKey);

  // Busca configuração da instância
  let systemPromptBase = '';
  try {
    const instRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_instancias?instancia=eq.${encodeURIComponent(instancia)}&select=system_prompt,ativo`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (instRes.ok) {
      const rows = await instRes.json() as Array<{ system_prompt: string; ativo: boolean }>;
      if (rows.length === 0 || !rows[0].ativo) return new Response('OK', { status: 200 });
      systemPromptBase = rows[0].system_prompt;
    } else return new Response('OK', { status: 200 });
  } catch (e) { console.log('[mia-chat] erro instância:', e); return new Response('OK', { status: 200 }); }

  const rawData = body.data;
  const data = (Array.isArray(rawData) ? rawData[0] : rawData ?? {}) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;
  const fromMe = isSendMessage ? true : Boolean(key.fromMe);
  const remoteJid = String(key.remoteJid ?? '');

  if (remoteJid.endsWith('@g.us')) return new Response('OK', { status: 200 });
  const telefone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  if (!telefone) return new Response('OK', { status: 200 });

  // Whitelist
  try {
    const wlRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_whitelist?instancia=eq.${encodeURIComponent(instancia)}&select=telefone,ativo&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (wlRes.ok) {
      const wlRows = await wlRes.json() as Array<{ telefone: string; ativo: boolean }>;
      if (wlRows.length > 0) {
        const authRes = await fetch(
          `${supabaseUrl}/rest/v1/mia_whitelist?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&ativo=eq.true&select=telefone`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        if (authRes.ok) {
          const authRows = await authRes.json() as Array<{ telefone: string }>;
          if (authRows.length === 0) return new Response('OK', { status: 200 });
        }
      }
    }
  } catch (e) { console.log('[mia-chat] erro whitelist:', e); }

  // Modo híbrido (# do dono)
  if (fromMe) {
    const msgObj = (data.message ?? {}) as Record<string, unknown>;
    const texto = String(msgObj.conversation ?? ((msgObj.extendedTextMessage as Record<string, unknown>)?.text) ?? '').trim();
    if (!texto.startsWith('#')) return new Response('OK', { status: 200 });
    let pausadoAtual = false;
    let historicoAtual: Msg[] = [];
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=historico,pausado`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (res.ok) {
        const rows = await res.json() as Array<{ historico: Msg[]; pausado: boolean }>;
        if (rows.length > 0) { pausadoAtual = rows[0].pausado ?? false; historicoAtual = rows[0].historico ?? []; }
      }
    } catch (_) {}
    await fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ instancia, telefone, historico: historicoAtual, pausado: !pausadoAtual, updated_at: new Date().toISOString() }),
    }).catch(console.error);
    return new Response('OK', { status: 200 });
  }

  // Mensagem do cliente
  const msgObj = (data.message ?? {}) as Record<string, unknown>;
  const texto = String(
    msgObj.conversation ||
    ((msgObj.extendedTextMessage as Record<string, unknown>)?.text) ||
    ((msgObj.imageMessage as Record<string, unknown>)?.caption) ||
    ''
  ).trim();

  const nome = String(data.pushName ?? '');
  const h = (new Date().getUTCHours() + 21) % 24;
  const periodo = h >= 5 && h < 12 ? 'manhã' : h >= 12 && h < 18 ? 'tarde' : 'noite';
  const saudacao = h >= 6 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : h >= 18 && h < 23 ? 'Boa noite' : 'Olá';

  // ── FLUXO DE IMAGEM (logo) ─────────────────────────────────────────────
  if (instancia === 'teffe-press' && (msgObj.imageMessage || msgObj.documentMessage)) {
    const dataMediaUrl = String((data as Record<string, unknown>).mediaUrl ?? '');
    const imgObj = (msgObj.imageMessage ?? msgObj.documentMessage) as Record<string, unknown>;
    const urlBruta = dataMediaUrl || String(imgObj.url ?? imgObj.mediaUrl ?? '');

    console.log('[mia-chat] mídia recebida:', urlBruta.substring(0, 100));

    if (urlBruta) {
      // 1. Salva no Storage — URL permanente
      const urlPermanente = await salvarLogoStorage(urlBruta, telefone, supabaseUrl, serviceKey, evolutionKey);

      // 2. Analisa cores do logo
      const analise = await analisarLogo(urlPermanente, apiKey);
      console.log('[mia-chat] logo analise:', JSON.stringify(analise));

      // 3. Salva URL permanente na coluna logo_url da tabela
      await salvarLogoUrl(instancia, telefone, urlPermanente, supabaseUrl, serviceKey);

      // 4. Carrega histórico atual
      let historico: Msg[] = [];
      let pausado = false;
      try {
        const histRes = await fetch(
          `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=historico,pausado`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        if (histRes.ok) {
          const rows = await histRes.json() as Array<{ historico: Msg[]; pausado: boolean }>;
          if (rows.length > 0) { historico = rows[0].historico ?? []; pausado = rows[0].pausado ?? false; }
        }
      } catch (_) {}

      if (pausado) return new Response('OK', { status: 200 });

      // 5. Monta mensagem para o histórico com logo + cores
      const coresTag = analise ? ` [cores_logo: ${JSON.stringify(analise)}]` : '';
      const textoLogo = texto
        ? `${texto} [logo recebido: ${urlPermanente}]${coresTag}`
        : `[logo recebido: ${urlPermanente}]${coresTag}`;

      const primeiraMsg = historico.length === 0;
      historico.push({ role: 'user', content: textoLogo });

      // 6. Chama Claude para responder ao logo
      const system = buildSystemFromBase(systemPromptBase, periodo, nome, primeiraMsg, saudacao);
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, system, messages: historico }),
      });
      const claudeData = await claudeRes.json() as { content?: Array<{ text: string }> };
      const resposta = claudeData.content?.[0]?.text ?? '';

      historico.push({ role: 'assistant', content: resposta });
      if (historico.length > 40) historico = historico.slice(-40);

      // 7. Salva histórico
      fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ instancia, telefone, historico, logo_url: urlPermanente, updated_at: new Date().toISOString() }),
      }).catch(console.error);

      // 8. Envia resposta
      if (resposta) {
        fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: telefone, text: resposta }),
        }).catch(console.error);
      }
    }

    return new Response('OK', { status: 200 });
  }

  // ── FLUXO TEXTO NORMAL ─────────────────────────────────────────────────
  const textoFinal = texto;
  if (!textoFinal) return new Response('OK', { status: 200 });

  // Carrega histórico
  let historico: Msg[] = [];
  let pausado = false;
  try {
    const histRes = await fetch(
      `${supabaseUrl}/rest/v1/mia_conversas_whatsapp?instancia=eq.${encodeURIComponent(instancia)}&telefone=eq.${encodeURIComponent(telefone)}&select=historico,pausado`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (histRes.ok) {
      const rows = await histRes.json() as Array<{ historico: Msg[]; pausado: boolean }>;
      if (rows.length > 0) { historico = rows[0].historico ?? []; pausado = rows[0].pausado ?? false; }
    }
  } catch (_) {}

  if (pausado) return new Response('OK', { status: 200 });

  const primeiraMsg = historico.length === 0;
  historico.push({ role: 'user', content: textoFinal });

  // Chama Claude
  const system = buildSystemFromBase(systemPromptBase, periodo, nome, primeiraMsg, saudacao);
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, system, messages: historico }),
  });
  const claudeData = await claudeRes.json() as { content?: Array<{ text: string }> };
  const raw = claudeData.content?.[0]?.text ?? '';
  const isLead = raw.startsWith('[LEAD_PRONTO]');
  const isArte = instancia === 'teffe-press' && raw.includes('[ARTE_PRONTA]');
  const isAprovada = instancia === 'teffe-press' && raw.includes('[ARTE_APROVADA]');
  const resposta = isLead ? raw.replace('[LEAD_PRONTO]', '').trim() : raw;

  if (!resposta) return new Response('OK', { status: 200 });

  // ── ARTE_APROVADA ──────────────────────────────────────────────────────
  if (isAprovada) {
    const aprovMatch = raw.match(/\[ARTE_APROVADA\]\s*([\s\S]+)/);
    const resumoPedido = aprovMatch?.[1]?.trim() ?? '';
    const msgConfirm = raw.replace(/\[ARTE_APROVADA\][\s\S]*/, '').trim() || 'Ótimo! Pedido confirmado! Gerando a ordem de produção agora 📄';
    const arteEntry = [...historico].reverse().find(m => m.content.includes('[Arte gerada e enviada:'));
    const arteUrlMatch = arteEntry?.content.match(/\[Arte gerada e enviada:\s*([^\]]+)\]/);
    const arteUrl = arteUrlMatch?.[1]?.trim() ?? '';
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
        body: JSON.stringify({ number: telefone, mediatype: 'document', mimetype: 'application/pdf', caption: '📋 Ordem de produção gerada!', media: `data:application/pdf;base64,${pdfBase64}`, fileName: 'ordem-producao.pdf' }),
      }).catch(console.error);
    }
    fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
    }).catch(console.error);
    return new Response('OK', { status: 200 });
  }

  // ── ARTE_PRONTA ────────────────────────────────────────────────────────
  if (isArte) {
    const arteMatch = raw.match(/\[ARTE_PRONTA\]\s*([\s\S]+)/);
    const arteJson = arteMatch?.[1]?.trim() ?? '';
    const msgEspera = raw.replace(/\[ARTE_PRONTA\][\s\S]*/, '').trim() || 'Deixa eu preparar sua arte! Já te mando 🎨';

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
      let dadosJson: Record<string, string> = {};
      try { dadosJson = JSON.parse(arteJson); } catch { /* continua */ }

      // Busca URL de ilustração prévia no histórico (para modo combinado)
      const ilustEntry = [...historico].reverse().find(m => m.content.includes('[ilustracao_gerada:'));
      const ilustMatch = ilustEntry?.content.match(/\[ilustracao_gerada:\s*([^\]]+)\]/);
      const ilustUrlHist = ilustMatch?.[1]?.trim() ?? '';

      // Extração via Haiku
      const extraido = await extrairDadosProduto(historico, apiKey);

      const modoDados = dadosJson.modo || 'texto';
      const bgUrlResolvido = dadosJson.background_url || (modoDados === 'combinado' && !dadosJson.ilustracao_prompt ? ilustUrlHist : '');

      // ── LOGO: busca da coluna logo_url (URL permanente do Storage) ──
      const logoUrlTabela = await buscarLogoUrl(instancia, telefone, supabaseUrl, serviceKey);
      const logoUrlFinal = logoUrlTabela || dadosJson.logo_url || '';
      console.log('[mia-chat] logo_url para arte:', logoUrlFinal.substring(0, 80));

      const dadosArte: Record<string, string> = {
        tipo_produto: dadosJson.tipo_produto || 'cartao_visita',
        modo: modoDados,
        ilustracao_prompt: dadosJson.ilustracao_prompt || '',
        background_url: bgUrlResolvido,
        nome: extraido.nome || dadosJson.nome || '',
        cargo: extraido.cargo || dadosJson.cargo || '',
        empresa: extraido.empresa || dadosJson.empresa || '',
        telefone: extraido.telefone || dadosJson.telefone || '',
        email: extraido.email || dadosJson.email || '',
        site: extraido.site || dadosJson.site || '',
        logo_url: logoUrlFinal,
        texto_principal: extraido.texto_principal || dadosJson.texto_principal || '',
        texto_secundario: extraido.texto_secundario || dadosJson.texto_secundario || '',
        cor_primaria: dadosJson.cor_primaria || '#1B3A6B',
        cor_secundaria: dadosJson.cor_secundaria || '#C9A84C',
        estilo: dadosJson.estilo || 'moderno',
        observacoes: dadosJson.observacoes || '',
      };

      if (dadosArte.ilustracao_prompt) {
        dadosArte.ilustracao_prompt = await enriquecerPromptIlustracao(dadosArte.ilustracao_prompt, apiKey);
      }

      console.log('[mia-chat] dados arte:', JSON.stringify(dadosArte));
      const imageUrl = await chamarGerarArte(dadosArte, supabaseUrl, serviceKey);

      if (imageUrl) {
        const isIlustracao = dadosArte.modo === 'ilustracao';
        const tipoProd = dadosArte.tipo_produto.replace(/_/g, ' ');
        const msgArte = isIlustracao
          ? 'Aqui está sua ilustração! 😊 O que acha? Se quiser posso adicionar seu nome, empresa ou contato por cima!'
          : `Aqui está a prévia do seu ${tipoProd}! 😊 O que acha? Precisa de algum ajuste?`;
        fetch(`${EVOLUTION_URL}/message/sendMedia/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: telefone, mediatype: 'image', mimetype: 'image/png', caption: msgArte, media: imageUrl, fileName: 'arte.png' }),
        }).catch(console.error);
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

  // ── RESPOSTA NORMAL ────────────────────────────────────────────────────
  historico.push({ role: 'assistant', content: resposta });
  if (historico.length > 40) historico = historico.slice(-40);

  fetch(`${supabaseUrl}/rest/v1/mia_conversas_whatsapp?on_conflict=instancia,telefone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ instancia, telefone, historico, updated_at: new Date().toISOString() }),
  }).catch(console.error);

  fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
    body: JSON.stringify({ number: telefone, text: resposta }),
  }).catch(console.error);

  if (isLead) {
    fetch(`${supabaseUrl}/functions/v1/mia-salvar-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ nome, historico, canal: 'whatsapp', telefone, instancia }),
    }).catch(console.error);
  }

  return new Response('OK', { status: 200 });
}

// ── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    if (body.event && body.instance) return await handleWhatsApp(body as Record<string, unknown>);

    const { messages, modo, cliente_nome } = body;
    const h = (new Date().getUTCHours() + 21) % 24;
    const periodo = h >= 5 && h < 12 ? 'manhã' : h >= 12 && h < 18 ? 'tarde' : 'noite';
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system, messages }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });

    const raw = data.content?.[0]?.text ?? '';
    const salvar_lead = modo !== 'suporte' && raw.startsWith('[LEAD_PRONTO]');
    const text = salvar_lead ? raw.replace('[LEAD_PRONTO]', '').trim() : raw;
    return new Response(JSON.stringify({ text, salvar_lead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
