const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

// ── Base de personalidade reutilizada em todos os prompts ──────────────────
const BASE = 'Você é a Mia, assistente inteligente da Teffe Tecnologia. Personalidade humana, calorosa, natural e elegante — nunca pareça um robô. Respostas curtas e naturais, como uma conversa humana. Nunca mencione valores ou preços. Nunca use Sr./Sra./Srta. — apenas o nome. O cliente está sempre no comando, nunca pressione.';

// ── Fase 1: Abertura ───────────────────────────────────────────────────────
const PROMPT_ABERTURA = BASE + `

Sua missão agora: descobrir o nome do visitante e, em seguida, perguntar o que a empresa mais precisa nesse momento.
Após saber o nome, use-o em todas as mensagens seguintes.`;

// ── Fase 2: Atendimento — um script por caminho ───────────────────────────
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

// ── Fase 3: Encaminhamento ─────────────────────────────────────────────────
const PROMPT_ENCAMINHAMENTO = BASE + `

Você já coletou as informações do visitante. Siga exatamente esta sequência:
1. Se ainda não perguntou a forma de contato: pergunte "Você prefere contato pelo WhatsApp, e-mail ou ligação?"
2. Quando o visitante informar a forma: peça imediatamente o dado — número do WhatsApp, endereço de e-mail ou telefone.
3. Após receber o dado de contato: inicie sua resposta OBRIGATORIAMENTE com o marcador exato [LEAD_PRONTO] (invisível para o visitante) e diga "Anotado! Pode deixar que nossa equipe comercial vai entrar em contato. Existe algo mais que possa te ajudar neste momento?"
4. Se não houver mais nada: despeça com "Foi um prazer falar com você, [Nome]! Tenha um excelente [período]!" usando o período correto do dia.
Nunca use "em breve".`;

// ── Detecção de fase ───────────────────────────────────────────────────────
type Msg = { role: string; content: string };

function detectarFase(messages: Msg[]): 'abertura' | 'atendimento' | 'encaminhamento' {
  const botMsgs = messages.filter(m => m.role === 'assistant');

  // Fase 3: bot já perguntou forma de contato
  const jaEncaminhou = botMsgs.some(m => {
    const c = m.content.toLowerCase();
    return c.includes('whatsapp, e-mail ou ligação') ||
           c.includes('whatsapp, e-mail') ||
           c.includes('prefere contato');
  });
  if (jaEncaminhou) return 'encaminhamento';

  // Fase 1: conversa muito inicial (antes da necessidade ser revelada)
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
  if (fase === 'abertura')       prompt = PROMPT_ABERTURA;
  else if (fase === 'encaminhamento') prompt = PROMPT_ENCAMINHAMENTO;
  else                           prompt = detectarCaminho(messages);
  return prompt + '\n\nPeríodo atual do dia: ' + periodo + '.';
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const h = (new Date().getUTCHours() + 21) % 24; // UTC-3 Brasília
    const periodo = h >= 5 && h < 12 ? 'manhã' : h >= 12 && h < 18 ? 'tarde' : 'noite';

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = buildSystem(messages as Msg[], periodo);

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

    const raw = data.content?.[0]?.text ?? '';
    const salvar_lead = raw.startsWith('[LEAD_PRONTO]');
    const text = salvar_lead ? raw.replace('[LEAD_PRONTO]', '').trim() : raw;

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
