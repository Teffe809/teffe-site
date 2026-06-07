/* ═══════════════════════════════════════════════
   MIA — Assistente Virtual Teffe
   Proxy via Supabase Edge Function mia-chat
═══════════════════════════════════════════════ */

var _MIA_EDGE      = 'https://hlfjcpgrxiktgctozilk.supabase.co/functions/v1/mia-chat';
var _MIA_EDGE_LEAD = 'https://hlfjcpgrxiktgctozilk.supabase.co/functions/v1/mia-salvar-lead';

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

/* ── Chamada à Edge Function mia-chat ── */
async function _miaResponder(msg) {
  _miaHistorico.push({ role: 'user', content: msg });
  _miaInputEnabled(false);
  _miaShowTyping();

  try {
    var res = await fetch(_MIA_EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: _miaHistorico })
    });

    var data = await res.json();

    if (!res.ok) {
      _miaRemoveTyping();
      console.error('[Mia] API error:', data);
      _miaAddMsg('bot', 'Desculpe, tive um problema técnico. Pode tentar novamente? 🙏');
      _miaHistorico.pop(); // remove a mensagem do user que não foi respondida
      _miaInputEnabled(true);
      return;
    }

    var resposta = data.text || '';
    _miaHistorico.push({ role: 'assistant', content: resposta });
    _miaExibirBlocos(_miaQuebrarBlocos(resposta));

    if (data.salvar_lead) {
      fetch(_MIA_EDGE_LEAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: _miaNome, historico: _miaHistorico })
      }).catch(function(e) { console.error('[Mia] lead save error:', e); });
    }

  } catch(e) {
    console.error('[Mia] fetch error:', e);
    _miaRemoveTyping();
    _miaAddMsg('bot', 'Parece que tive um problema de conexão. Pode tentar novamente? 🙏');
    _miaHistorico.pop();
    _miaInputEnabled(true);
  }
}

/* ── Divide resposta em blocos para exibição gradual ── */
function _miaQuebrarBlocos(texto) {
  var partes = texto.split(/\n\n+/);
  var blocos = [];

  partes.forEach(function(parte) {
    parte = parte.trim();
    if (!parte) return;

    if (parte.length <= 300) {
      blocos.push(parte);
      return;
    }

    // Parágrafo longo: divide nas fronteiras de frases
    var frases = parte.split(/(?<=[.!?])\s+/);
    var atual = '';
    frases.forEach(function(f) {
      if (atual && (atual + ' ' + f).length > 300) {
        blocos.push(atual.trim());
        atual = f;
      } else {
        atual = atual ? atual + ' ' + f : f;
      }
    });
    if (atual.trim()) blocos.push(atual.trim());
  });

  return blocos.filter(Boolean);
}

/* ── Exibe blocos um a um com pausa de leitura entre eles ── */
function _miaExibirBlocos(blocos) {
  _miaRemoveTyping();

  if (!blocos.length) {
    _miaInputEnabled(true);
    return;
  }

  _miaAddMsg('bot', _miaFormatMsg(blocos[0]));

  if (blocos.length === 1) {
    _miaInputEnabled(true);
    return;
  }

  var i = 1;
  function _proximo() {
    if (i >= blocos.length) {
      _miaInputEnabled(true);
      return;
    }
    var readTime = Math.min(4000, Math.max(1500, blocos[i - 1].length * 50));
    setTimeout(function() {
      _miaShowTyping();
      setTimeout(function() {
        _miaRemoveTyping();
        _miaAddMsg('bot', _miaFormatMsg(blocos[i]));
        i++;
        _proximo();
      }, 800);
    }, readTime);
  }
  _proximo();
}

/* ── Formata texto da API para HTML ── */
function _miaFormatMsg(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
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
