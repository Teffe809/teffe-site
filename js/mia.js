/* ═══════════════════════════════════════════════
   MIA — Assistente Virtual Teffe
   Proxy via Supabase Edge Function mia-chat
═══════════════════════════════════════════════ */

var _MIA_EDGE      = 'https://hlfjcpgrxiktgctozilk.supabase.co/functions/v1/mia-chat';
var _MIA_PRIVACY   = 'https://teffe.com.br/politica-de-privacidade.html';
var _MIA_CONVERSATION_KEY = 'teffe_mia_site_conversation_v2';

/* ── Estado ── */
var _miaAberto    = false;
var _miaIniciado  = false;
var _miaEtapa     = 'inicio';  // inicio | aguardando-nome | conversa
var _miaNome      = '';
var _miaHistorico = []; // [{role, content}] enviado à Claude API
var _miaLeadSalvo = false;
var _miaLeadState = null;
var _miaConversationId = _miaGetConversationId();
var _MIA_MODO     = 'vendas'; // 'vendas' | 'suporte'
// Espelha #mia-input a cada tecla digitada (evento 'input'). O site (fora deste widget) aplica
// reformatação global a campos <input> via atribuição direta de `.value` — o que NÃO dispara um
// novo evento 'input' — então este rastreador sempre guarda o texto exatamente como o visitante
// digitou, mesmo que o próprio <input> seja alterado depois por um script externo antes do envio.
var _miaTextoDigitado = '';

function _miaUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Sempre gera um conversation_id novo a cada carregamento de página. Antes, um id salvo em
// localStorage era reaproveitado por até 24h -- mas nada na UI restaura a conversa anterior
// nesse caso (_miaHistorico, _miaLeadState e _miaNome sempre começam vazios/nulos a cada
// carregamento; só o conversation_id era reaproveitado silenciosamente). Esse descompasso
// (a MIA pede o nome de novo, como se fosse uma conversa nova, mas o backend reconhecia o MESMO
// conversation_id e recuperava todo o estado comercial da conversa anterior) foi a causa raiz de
// um vazamento real de contexto entre visitantes/sessões distintas. Gerar sempre um id novo
// elimina esse vazamento na origem, sem tocar em nenhuma regra de captura/estado dentro de uma
// mesma conversa (que continua sendo identificada pelo mesmo conversation_id do início ao fim).
function _miaGetConversationId() {
  var id = _miaUuid();
  try {
    localStorage.setItem(_MIA_CONVERSATION_KEY, JSON.stringify({ id: id, updated_at: Date.now() }));
  } catch (_) {
    // localStorage indisponível (ex.: navegação privada restrita): segue com o id gerado em
    // memória, sem persistência entre recarregamentos -- nunca um problema de isolamento.
  }
  return id;
}

/* ── Verifica se Mia deve operar neste contexto ── */
function _miaContextoValido() {
  var h = location.hash;
  return h !== '#portaltecnico' && h !== '#admin' && h !== '#paineladmin';
}

/* ── Fecha o chat (chamado ao abrir portais internos) ── */
function miaFecharChat() {
  _miaAberto = false;
  var chat = document.getElementById('mia-chat');
  if (chat) chat.classList.remove('open');
}

/* ── Toggle abrir/fechar ── */
function miaToggle() {
  if (!_miaContextoValido()) return;
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

/* ── Inicializa Mia no Modo Suporte (chamada por supabase.js após login do cliente) ── */
function miaIniciarSupporte(nomeCliente) {
  if (!_miaContextoValido()) return;
  _MIA_MODO    = 'suporte';
  _miaNome     = nomeCliente || 'cliente';
  _miaIniciado = false;
  _miaEtapa    = 'inicio';
  _miaHistorico = [];
  _miaLeadSalvo = false;
  _miaLeadState = null;
  var wrap = document.getElementById('mia-messages');
  if (wrap) wrap.innerHTML = '';
  // Não abre o chat automaticamente — Mia fica só como o ícone/bolha; a
  // saudação (_miaBoasVindas, via miaToggle) só dispara quando o cliente
  // clica nela por conta própria. _miaIniciado continua false aqui, então
  // esse clique manual ainda vai mostrar a saudação normalmente.
}

/* ── Sequência de boas-vindas ── */
function _miaBoasVindas() {
  _miaEtapa = 'inicio';
  if (_MIA_MODO === 'suporte') {
    _miaBoasVindasSupporte();
  } else {
    _miaBoasVindasVendas();
  }
}

function _miaBoasVindasVendas() {
  _miaInputEnabled(false);
  var msg1 = 'Olá! Eu sou a Mia, assistente inteligente da Teffe. É muito bom ter você aqui! 😊';
  var msg2 = 'Vamos descobrir juntos o que podemos fazer para sua empresa crescer mais?';
  var msg3 = 'Antes de começarmos, como posso te chamar?';

  _miaShowTyping();
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', msg1.replace('Mia', '<strong>Mia</strong>'));
    setTimeout(function() {
      _miaShowTyping();
      setTimeout(function() {
        _miaRemoveTyping();
        _miaAddMsg('bot', msg2);
        setTimeout(function() {
          _miaShowTyping();
          setTimeout(function() {
            _miaRemoveTyping();
            _miaAddMsg('bot', msg3);
            _miaHistorico = [
              { role: 'assistant', content: [msg1.replace(/<[^>]+>/g, ''), msg2, msg3].join('\n\n') }
            ];
            _miaEtapa = 'aguardando-nome';
            _miaInputEnabled(true);
            var inp = document.getElementById('mia-input');
            if (inp) { inp.placeholder = 'Digite seu nome...'; inp.focus(); }
          }, 850);
        }, 500);
      }, 850);
    }, 500);
  }, 1300);
}

function _miaBoasVindasSupporte() {
  _miaInputEnabled(false);
  var saudacao = 'Olá, <strong>' + _miaEsc(_miaNome) + '</strong>! Em que posso te ajudar hoje? 😊';

  _miaShowTyping();
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', saudacao);
    // Semeia histórico para a API ter contexto da saudação
    _miaHistorico = [
      { role: 'assistant', content: 'Olá, ' + _miaNome + '! Em que posso te ajudar hoje?' }
    ];
    _miaEtapa = 'conversa';
    _miaInputEnabled(true);
    var inp = document.getElementById('mia-input');
    if (inp) { inp.placeholder = 'Como posso te ajudar?'; inp.focus(); }
  }, 900);
}

function _miaEhSomenteNome(texto) {
  var valor = String(texto || '').trim();
  if (valor.length < 2 || valor.length > 80 || /[,;:!?@\d]/u.test(valor)) return false;
  if (!/^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,3}$/u.test(valor)) return false;
  var normalizado = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !/\b(?:bom|boa|dia|tarde|noite|oi|ola|sou|meu|minha|nome|preciso|quero|gostaria|empresa|trabalho|notebook|desktop|computador|impressora|multifuncional|locacao|alugar|whatsapp|telefone|email|ia|suporte|ti)\b/u.test(normalizado);
}

function _miaUltimaMensagemPediuNome() {
  var ultima = _miaHistorico[_miaHistorico.length - 1];
  return Boolean(ultima && ultima.role === 'assistant' && /(?:como posso te chamar|qual (?:e|é) (?:o )?seu nome|como voce (?:se chama|gostaria de ser chamado))/iu.test(ultima.content || ''));
}

function _miaPodeUsarFastPathNome(texto) {
  return _MIA_MODO === 'vendas' && _miaEtapa === 'aguardando-nome' && _miaUltimaMensagemPediuNome() && _miaEhSomenteNome(texto);
}

function _miaSaudacaoHorario(data) {
  var hora = (data instanceof Date ? data : new Date()).getHours();
  return hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function _miaResponderNomeLocal(nome) {
  _miaNome = nome;
  _miaLeadState = Object.assign({}, _miaLeadState || {}, {
    version: 2,
    conversation_id: _miaConversationId,
    nome: nome,
    saudacao_realizada: true
  });
  _miaHistorico.push({ role: 'user', content: nome });
  _miaInputEnabled(false);
  _miaShowTyping();

  var periodo = _miaSaudacaoHorario();
  var resposta = periodo + ', ' + nome + '! 😊 Qual solução da Teffe você gostaria de conhecer melhor?';
  setTimeout(function() {
    _miaRemoveTyping();
    _miaAddMsg('bot', _miaEsc(resposta));
    _miaHistorico.push({ role: 'assistant', content: resposta });
    _miaInputEnabled(true);
    var input = document.getElementById('mia-input');
    if (input) input.focus();
  }, 1100);
}

/* ── Enviar mensagem ── */
function miaSend() {
  var input = document.getElementById('mia-input');
  if (!input || input.disabled) return;
  var texto = (_miaTextoDigitado || input.value).trim();
  if (!texto) return;
  input.value = '';
  _miaTextoDigitado = '';

  _miaAddMsg('user', _miaEsc(texto));

  if (_miaEtapa === 'aguardando-nome') {
    var usarFastPathNome = _miaPodeUsarFastPathNome(texto);
    _miaEtapa = 'conversa';
    var inp = document.getElementById('mia-input');
    if (inp) inp.placeholder = 'Digite sua mensagem...';
    if (usarFastPathNome) {
      _miaResponderNomeLocal(texto);
      return;
    }
    _miaResponder(texto);
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
    var payload;
    if (_MIA_MODO === 'suporte') {
      payload = { messages: _miaHistorico };
      payload.modo = 'suporte';
      payload.cliente_nome = _miaNome;
    } else {
      payload = {
        conversation_id: _miaConversationId,
        message: msg,
        lead_state: _miaLeadState
      };
    }

    var res = await fetch(_MIA_EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var data = await res.json();

    if (!res.ok) {
      _miaRemoveTyping();
      console.error('[Mia] API error:', data);
      _miaAddMsg('bot', 'Desculpe, tive um problema técnico. Pode tentar novamente? 🙏');
      _miaHistorico.pop();
      _miaInputEnabled(true);
      return;
    }

    var resposta = data.text || '';
    _miaHistorico.push({ role: 'assistant', content: resposta });
    if (_miaHistorico.length > 24) _miaHistorico = _miaHistorico.slice(-24);
    if (_MIA_MODO === 'vendas' && data.lead_state) {
      _miaLeadState = data.lead_state;
      if (data.lead_state.nome) _miaNome = data.lead_state.nome;
      _miaLeadSalvo = Boolean(data.lead_saved || data.lead_status === 'salvo');
      try {
        localStorage.setItem(_MIA_CONVERSATION_KEY, JSON.stringify({ id: _miaConversationId, updated_at: Date.now() }));
      } catch (_) { /* armazenamento local pode estar bloqueado */ }
    }
    _miaExibirBlocos(_miaQuebrarBlocos(resposta));

  } catch(e) {
    console.error('[Mia] fetch error:', e);
    _miaRemoveTyping();
    _miaAddMsg('bot', 'Parece que tive um problema de conexão. Pode tentar novamente? 🙏');
    _miaHistorico.pop();
    _miaInputEnabled(true);
  }
}

/* ── Divide resposta em blocos para exibição gradual ── */
function _miaAdicionarBlocoLegivel(blocos, parte) {
  parte = String(parte || '').trim();
  if (!parte) return;
  if (parte.length <= 300) {
    blocos.push(parte);
    return;
  }

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
}

function _miaExtrairPrivacidadeAtomica(parte) {
  var policyIndex = parte.indexOf(_MIA_PRIVACY);
  if (policyIndex < 0) return null;

  var questionEnd = parte.lastIndexOf('?', policyIndex);
  if (questionEnd < 0) return { prefixo: '', atomico: parte.trim() };

  var beforeQuestion = parte.slice(0, questionEnd);
  var sentenceBoundary = Math.max(
    beforeQuestion.lastIndexOf('. '),
    beforeQuestion.lastIndexOf('! '),
    beforeQuestion.lastIndexOf('? ')
  );
  var start = sentenceBoundary >= 0 ? sentenceBoundary + 2 : 0;
  return {
    prefixo: parte.slice(0, start).trim(),
    atomico: parte.slice(start).trim()
  };
}

function _miaQuebrarBlocos(texto) {
  var partes = texto.split(/\n\n+/);
  var blocos = [];

  partes.forEach(function(parte) {
    parte = parte.trim();
    if (!parte) return;

    var privacidade = _miaExtrairPrivacidadeAtomica(parte);
    if (privacidade) {
      _miaAdicionarBlocoLegivel(blocos, privacidade.prefixo);
      blocos.push(privacidade.atomico);
      return;
    }

    _miaAdicionarBlocoLegivel(blocos, parte);
  });

  return blocos.filter(Boolean);
}

function _miaNormalizarReferenciaPrivacidade(texto) {
  var normalizado = String(texto || '');
  var urlEscapada = _MIA_PRIVACY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var markdown = new RegExp('\\[[^\\]\\n]{1,160}\\]\\s*\\\\?\\(\\s*' + urlEscapada + '\\s*\\\\?\\)', 'gi');
  for (var i = 0; i < 3; i++) normalizado = normalizado.replace(markdown, _MIA_PRIVACY);
  return normalizado.replace(new RegExp('(' + urlEscapada + ')(?:\\s*[),.;:]*\\s*' + urlEscapada + ')+', 'gi'), '$1');
}

/* Ritmo de leitura baseado no texto que realmente aparece no balão. */
function _miaCalcularDelayBalao(texto) {
  var visivel = _miaNormalizarReferenciaPrivacidade(texto)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(_MIA_PRIVACY, 'Política de Privacidade da TEFFE')
    .replace(/\*\*/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Math.round(Math.min(5000, Math.max(1600, 1600 + visivel.length * 12)));
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
    var totalDelay = _miaCalcularDelayBalao(blocos[i - 1]);
    var typingTime = 800;
    var readingTime = Math.max(0, totalDelay - typingTime);
    setTimeout(function() {
      _miaShowTyping();
      setTimeout(function() {
        _miaRemoveTyping();
        _miaAddMsg('bot', _miaFormatMsg(blocos[i]));
        i++;
        _proximo();
      }, typingTime);
    }, readingTime);
  }
  _proximo();
}

/* ── Formata texto da API para HTML ── */
function _miaFormatMsg(text) {
  var ancoraPrivacidade = '<a href="' + _MIA_PRIVACY + '" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>';
  return _miaNormalizarReferenciaPrivacidade(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(_MIA_PRIVACY, ancoraPrivacidade)
    .replace(/\n/g, '<br>');
}

/* ── Helpers de UI ── */
function _miaAddMsg(quem, html) {
  var wrap = document.getElementById('mia-messages');
  if (!wrap) return;
  var row  = document.createElement('div');
  row.className = 'mia-msg mia-msg-' + quem;

  if (quem === 'bot') {
    var av = document.createElement('img');
    av.src = 'assets/images/mia-avatar.png';
    av.alt = 'Mia';
    av.className = 'mia-msg-avatar';
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

  var av = document.createElement('img');
  av.src = 'assets/images/mia-avatar.png';
  av.alt = 'Mia';
  av.className = 'mia-msg-avatar';

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

/* ── Observa a digitação original em #mia-input (ver _miaTextoDigitado acima) ── */
(function _miaObservarDigitacaoOriginal() {
  var inp = document.getElementById('mia-input');
  if (inp) inp.addEventListener('input', function() { _miaTextoDigitado = inp.value; });
})();

/* ── Pulso no botão após 5s (apenas modo vendas, chat não aberto) ── */
setTimeout(function() {
  if (!_miaIniciado && _MIA_MODO === 'vendas') {
    var btn = document.getElementById('mia-btn');
    if (btn) btn.classList.add('mia-btn-pulse');
  }
}, 5000);
