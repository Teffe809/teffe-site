/* ═══════════════════════════════════════════════
   MIA — Assistente Virtual Teffe
   Integração Claude API — claude-sonnet-4-20250514
═══════════════════════════════════════════════ */

var _MIA_KEY = 'COLE_SUA_CHAVE_ANTHROPIC_AQUI'; // sk-ant-...

/* ── System prompt ── */
var _MIA_SYSTEM = [
  'Você é a Mia, assistente inteligente da Teffe Tecnologia. Sua personalidade é humana, calorosa, natural e elegante — nunca pareça um robô ou formulário. Sempre use o nome do visitante durante a conversa.',
  '',
  'Siga este fluxo:',
  'Quando o visitante informar o nome, agradeça e pergunte: "O que sua empresa mais precisa nesse momento?"',
  'Com base na resposta, direcione para um dos caminhos abaixo:',
  '',
  'CAMINHO 1 — OUTSOURCING DE IMPRESSÃO:',
  'Pergunte se tem impressoras próprias ou contrato de locação/manutenção.',
  '- Se tiver próprias: reconheça que está buscando solução para os problemas que impressoras sem suporte apresentam; pergunte quantas impressoras e volume de impressão (diga que se não souber o volume não tem problema).',
  '- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é sem sombra de dúvida a melhor opção; peça para descrever como é o contrato atual e o que está incluso.',
  '- Se quiser entender melhor: explique que com o outsourcing da Teffe não há investimento inicial, equipamentos novos instalados, todo suporte de instalação, manutenção, insumos e peças inclusos — e pergunte se gostaria que a Teffe monte uma solução para sua necessidade.',
  '',
  'CAMINHO 2 — LOCAÇÃO DE NOTEBOOK:',
  'Pergunte se tem notebooks próprios ou já tem contrato de locação/manutenção.',
  '- Se tiver próprios: reconheça que está buscando solução para os desafios que equipamentos sem suporte apresentam; pergunte quantos notebooks utiliza e como está sendo a experiência.',
  '- Se já tiver contrato: diga que acredita que está buscando uma nova alternativa e que a Teffe é a melhor opção; peça para descrever o contrato atual.',
  '- Se quiser entender melhor: explique que com a locação da Teffe não há investimento inicial, equipamentos novos, manutenção e suporte inclusos, sem surpresa no orçamento — e pergunte se gostaria que a Teffe monte uma solução.',
  '',
  'CAMINHO 3 — LOCAÇÃO DE DESKTOP:',
  'Mesmo fluxo do notebook, adaptado para desktop. Destaque performance e estabilidade para operação do dia a dia.',
  '',
  'CAMINHO 4 — TEFFE IA:',
  'Pergunte como funciona o atendimento ao cliente da empresa hoje. Mencione que você mesma é um exemplo do que o Teffe IA pode fazer. Explique que o Teffe IA atende no WhatsApp, Instagram e site ao mesmo tempo, 24h por dia, de forma natural e humanizada. Pergunte se gostaria que a Teffe apresente uma solução para o atendimento.',
  '',
  'CAMINHO 5 — NÃO SABE:',
  'Pergunte qual é o maior desafio do dia a dia da empresa e direcione para o caminho certo com base na resposta.',
  '',
  'REGRAS IMPORTANTES:',
  '- Sempre ouça primeiro, nunca presuma a necessidade.',
  '- Use o nome do visitante durante a conversa.',
  '- Nunca use Sr./Sra./Srta. — apenas o nome.',
  '- Respostas curtas e naturais — como uma conversa humana.',
  '- Nunca mencione valores ou preços.',
  '- Quando tiver os dados necessários, diga: "Agora que já tenho o que preciso, estarei encaminhando para nossa equipe comercial — eles vão montar uma proposta personalizada de acordo com a sua necessidade."',
  '- Em seguida pergunte: "Você prefere contato pelo WhatsApp, e-mail ou ligação?"',
  '- Após o visitante escolher, diga: "Anotado! Pode deixar que nossa equipe comercial vai entrar em contato. Existe algo mais que possa te ajudar neste momento?"',
  '- Se não houver mais nada, despeça com: "Foi um prazer falar com você, [Nome]! Tenha um excelente [período]!" usando o período correto do dia.',
  '- Nunca use "em breve" — passe confiança e firmeza.',
  '- O cliente está sempre no comando — nunca pressione.'
].join('\n');

/* ── Estado ── */
var _miaAberto    = false;
var _miaIniciado  = false;
var _miaEtapa     = 'inicio';  // inicio | aguardando-nome | conversa
var _miaNome      = '';
var _miaHistorico = []; // [{role, content}] enviado à Claude API

/* ── Toggle abrir/fechar ── */
function miaToggle() {
  var chat = document.getElementById('mia-chat');
  var btn  = document.getElementById('mia-btn');
  _miaAberto = !_miaAberto;

  if (_miaAberto) {
    chat.classList.add('open');
    btn.classList.remove('mia-btn-pulse');
    if (!_miaIniciado) {
      _miaIniciado = true;
      _miaBoasVindas();
    }
    setTimeout(function() {
      var inp = document.getElementById('mia-input');
      if (inp && !inp.disabled) inp.focus();
    }, 350);
  } else {
    chat.classList.remove('open');
  }
}

/* ── Sequência de boas-vindas (gerida localmente, sem chamar a API) ── */
function _miaBoasVindas() {
  _miaEtapa = 'inicio';
  _miaInputEnabled(false);

  var msg1 = 'Olá! Eu sou a Mia, assistente inteligente da Teffe. Vamos descobrir juntos o que podemos fazer para sua empresa crescer mais? 😊';
  var msg2 = 'Antes de começar, como posso te chamar?';

  _miaShowTyping();
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', msg1.replace('Mia', '<strong>Mia</strong>'));

    setTimeout(function() {
      _miaShowTyping();
      setTimeout(function() {
        _miaRemoveTyping();
        _miaAddMsg('bot', msg2);
        _miaEtapa = 'aguardando-nome';
        _miaInputEnabled(true);
        var inp = document.getElementById('mia-input');
        if (inp) { inp.placeholder = 'Digite seu nome...'; inp.focus(); }
      }, 1000);
    }, 700);
  }, 1300);
}

/* ── Enviar mensagem ── */
function miaSend() {
  var input = document.getElementById('mia-input');
  if (!input || input.disabled) return;
  var texto = input.value.trim();
  if (!texto) return;
  input.value = '';

  _miaAddMsg('user', _miaEsc(texto));

  if (_miaEtapa === 'aguardando-nome') {
    _miaNome  = texto.split(' ')[0];
    _miaEtapa = 'conversa';
    _miaInputEnabled(false);
    var inp = document.getElementById('mia-input');
    if (inp) inp.placeholder = 'Digite sua mensagem...';

    var respostaNome = 'Prazer, ' + _miaNome + '! O que sua empresa mais precisa nesse momento?';

    // Semeia o histórico com a troca de nomes para a API ter contexto
    _miaHistorico = [
      { role: 'assistant', content: 'Olá! Eu sou a Mia, assistente inteligente da Teffe. Vamos descobrir juntos o que podemos fazer para sua empresa crescer mais?' },
      { role: 'user',      content: texto },
      { role: 'assistant', content: respostaNome }
    ];

    _miaShowTyping();
    setTimeout(function() {
      _miaRemoveTyping();
      _miaAddMsg('bot', 'Prazer, <strong>' + _miaEsc(_miaNome) + '</strong>! O que sua empresa mais precisa nesse momento?');
      _miaInputEnabled(true);
      var inp2 = document.getElementById('mia-input');
      if (inp2) inp2.focus();
    }, 1000);
    return;
  }

  if (_miaEtapa === 'conversa') {
    _miaResponder(texto);
  }
}

/* ── Chamada à Claude API ── */
async function _miaResponder(msg) {
  _miaHistorico.push({ role: 'user', content: msg });
  _miaInputEnabled(false);
  _miaShowTyping();

  // Injeta período do dia no system prompt
  var system = _MIA_SYSTEM + '\n\nPeríodo atual do dia: ' + _miaPeriodo() + '.';

  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _MIA_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: system,
        messages: _miaHistorico
      })
    });

    var data = await res.json();
    _miaRemoveTyping();

    if (!res.ok) {
      console.error('[Mia] API error:', data);
      _miaAddMsg('bot', 'Desculpe, tive um problema técnico. Pode tentar novamente? 🙏');
      _miaHistorico.pop(); // remove a mensagem do user que não foi respondida
      _miaInputEnabled(true);
      return;
    }

    var resposta = data.content && data.content[0] && data.content[0].text || '';
    _miaHistorico.push({ role: 'assistant', content: resposta });
    _miaAddMsg('bot', _miaFormatMsg(resposta));
    _miaInputEnabled(true);

  } catch(e) {
    console.error('[Mia] fetch error:', e);
    _miaRemoveTyping();
    _miaAddMsg('bot', 'Parece que tive um problema de conexão. Pode tentar novamente? 🙏');
    _miaHistorico.pop();
    _miaInputEnabled(true);
  }
}

/* ── Formata texto da API para HTML ── */
function _miaFormatMsg(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/* ── Retorna período do dia ── */
function _miaPeriodo() {
  var h = new Date().getHours();
  if (h >= 5  && h < 12) return 'manhã';
  if (h >= 12 && h < 18) return 'tarde';
  return 'noite';
}

/* ── Helpers de UI ── */
function _miaAddMsg(quem, html) {
  var wrap = document.getElementById('mia-messages');
  if (!wrap) return;
  var row  = document.createElement('div');
  row.className = 'mia-msg mia-msg-' + quem;

  if (quem === 'bot') {
    var av = document.createElement('div');
    av.className = 'mia-msg-avatar';
    av.textContent = 'M';
    row.appendChild(av);
  }

  var bubble = document.createElement('div');
  bubble.className = 'mia-msg-bubble';
  bubble.innerHTML = html;
  row.appendChild(bubble);

  wrap.appendChild(row);
  wrap.scrollTop = wrap.scrollHeight;
}

function _miaShowTyping() {
  var wrap = document.getElementById('mia-messages');
  if (!wrap) return;
  var row  = document.createElement('div');
  row.className = 'mia-msg mia-msg-bot mia-typing';
  row.id = 'mia-typing';

  var av = document.createElement('div');
  av.className = 'mia-msg-avatar';
  av.textContent = 'M';

  var bubble = document.createElement('div');
  bubble.className = 'mia-msg-bubble';
  bubble.innerHTML = '<span class="mia-dot"></span><span class="mia-dot"></span><span class="mia-dot"></span>';

  row.appendChild(av);
  row.appendChild(bubble);
  wrap.appendChild(row);
  wrap.scrollTop = wrap.scrollHeight;
}

function _miaRemoveTyping() {
  var el = document.getElementById('mia-typing');
  if (el) el.remove();
}

function _miaInputEnabled(on) {
  var inp = document.getElementById('mia-input');
  var btn = document.getElementById('mia-send-btn');
  if (inp) inp.disabled = !on;
  if (btn) btn.disabled = !on;
}

function _miaEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── Pulso no botão após 5s se chat não foi aberto ── */
setTimeout(function() {
  if (!_miaIniciado) {
    var btn = document.getElementById('mia-btn');
    if (btn) btn.classList.add('mia-btn-pulse');
  }
}, 5000);
