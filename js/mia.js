/* ═══════════════════════════════════════════════
   MIA — Assistente Virtual Teffe
   Fase 1: estrutura visual + fluxo de abertura
   Fase 2: integração Claude API (system prompt)
═══════════════════════════════════════════════ */

var _miaAberto   = false;
var _miaIniciado = false;
var _miaEtapa    = 'inicio';  // inicio | aguardando-nome | conversa
var _miaNome     = '';

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

/* ── Sequência de boas-vindas ── */
function _miaBoasVindas() {
  _miaEtapa = 'inicio';
  _miaInputEnabled(false);

  _miaShowTyping();
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', 'Olá! Eu sou a <strong>Mia</strong>, assistente inteligente da Teffe. Vamos descobrir juntos o que podemos fazer para sua empresa crescer mais? 😊');

    setTimeout(function() {
      _miaShowTyping();
      setTimeout(function() {
        _miaRemoveTyping();
        _miaAddMsg('bot', 'Antes de começar, como posso te chamar?');
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

/* ── Resposta da IA — placeholder substituído na Fase 2 ── */
function _miaResponder(msg) {
  _miaInputEnabled(false);
  _miaShowTyping();
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', 'Entendido! Em breve a integração com a IA estará ativa. 😊');
    _miaInputEnabled(true);
  }, 1200);
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
