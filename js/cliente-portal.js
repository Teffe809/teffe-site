// ═══════════════════════════════════════════════════
//  PORTAL DO CLIENTE — Sidebar + views: Financeiro,
//  Contratos, Histórico
// ═══════════════════════════════════════════════════

// Sobrescreve acMostrarView (supabase.js) para passar pelo cpNavegar
window.acMostrarView = function(id){ cpNavegar(id); };

var _cpBoletosData = [];

// ── INICIALIZAÇÃO (chamado ao fim de carregarArea) ──
function cpOnAreaLoad(){
  var nome = (document.getElementById('ac-nome') || {}).textContent || '';
  var empresa = (document.getElementById('ac-empresa') || {}).textContent || '';
  var sn = document.getElementById('cp-sidebar-nome');
  var se = document.getElementById('cp-sidebar-empresa');
  if(sn) sn.textContent = nome;
  if(se) se.textContent = empresa;

  // Injeta botão X de fechar dentro da sidebar (visível só no mobile via CSS)
  var sidebarInfo = document.querySelector('.cp-sidebar-info');
  if(sidebarInfo && !sidebarInfo.querySelector('.cp-sidebar-close')){
    var closeBtn = document.createElement('button');
    closeBtn.className = 'cp-sidebar-close';
    closeBtn.setAttribute('aria-label', 'Fechar menu');
    closeBtn.innerHTML = '<i class="ti ti-x"></i>';
    closeBtn.onclick = cpFecharSidebar;
    sidebarInfo.appendChild(closeBtn);
  }

  // Injeta botão Sair no rodapé da sidebar (visível só no mobile via CSS)
  var cpNav = document.querySelector('.cp-sidebar .cp-nav');
  if(cpNav && !document.querySelector('.cp-sidebar-sair')){
    var sairSidebar = document.createElement('button');
    sairSidebar.className = 'cp-sidebar-sair';
    sairSidebar.innerHTML = '<i class="ti ti-logout"></i> Sair';
    sairSidebar.onclick = fazerLogout;
    cpNav.insertAdjacentElement('afterend', sairSidebar);
  }

  // Injeta botão Sair no header mobile (ao lado direito do hamburguer)
  var navbar = document.querySelector('.ac-navbar');
  if(navbar && !navbar.querySelector('.cp-navbar-sair')){
    var sairNavbar = document.createElement('button');
    sairNavbar.className = 'cp-navbar-sair';
    sairNavbar.innerHTML = '<i class="ti ti-logout"></i> Sair';
    sairNavbar.onclick = fazerLogout;
    navbar.appendChild(sairNavbar);
  }

  // Injeta cards de acesso rápido no dashboard (visível só no mobile via CSS)
  var acoes = document.querySelector('#ac-view-dash .cp-acoes-rapidas');
  if(acoes && !document.querySelector('.cp-acesso-rapido')){
    var atalhos = [
      {icon:'ti-file-description', label:'Contratos', view:'contratos'},
      {icon:'ti-receipt-2',        label:'Financeiro', view:'financeiro'},
      {icon:'ti-history',          label:'Histórico',  view:'historico'}
    ];
    var grid = document.createElement('div');
    grid.className = 'cp-acesso-rapido';
    grid.innerHTML = atalhos.map(function(a){
      return '<button class="cp-acesso-card" onclick="cpNavegar(\''+a.view+'\')">' +
        '<i class="ti '+a.icon+'"></i><span>'+a.label+'</span></button>';
    }).join('');
    acoes.insertAdjacentElement('afterend', grid);
  }

  cpSetNavAtivo('dash');
  cpCarregarBoletosResumo();
}

// ── NAVEGAÇÃO ──
function cpNavegar(id){
  cpSetNavAtivo(id);
  document.querySelectorAll('.ac-view').forEach(function(v){ v.classList.remove('ac-view-active'); });
  var view = document.getElementById('ac-view-' + id);
  if(view) view.classList.add('ac-view-active');
  var main = document.getElementById('cp-main');
  if(main) main.scrollTop = 0;
  var hashes = {
    dash:'cliente', assist:'cliente/assistencia', suprim:'cliente/suprimentos',
    contratos:'cliente/contratos', financeiro:'cliente/financeiro', historico:'cliente/historico'
  };
  history.replaceState(null, '', '#' + (hashes[id] || 'cliente'));
  cpFecharSidebar();
  if(id === 'financeiro') cpCarregarFinanceiro();
  else if(id === 'contratos') cpCarregarContratosView();
  else if(id === 'historico') cpCarregarHistorico();
}

function cpSetNavAtivo(id){
  document.querySelectorAll('.cp-nav-item').forEach(function(b){ b.classList.remove('cp-nav-active'); });
  var btn = document.querySelector('.cp-nav-item[data-view="' + id + '"]');
  if(btn) btn.classList.add('cp-nav-active');
}

// ── SIDEBAR MOBILE ──
function cpToggleSidebar(){
  var sb = document.getElementById('cp-sidebar');
  var ov = document.getElementById('cp-sidebar-overlay');
  if(!sb) return;
  var open = sb.classList.toggle('cp-sidebar-open');
  if(ov) ov.classList.toggle('cp-visible', open);
}

function cpFecharSidebar(){
  var sb = document.getElementById('cp-sidebar');
  var ov = document.getElementById('cp-sidebar-overlay');
  if(sb) sb.classList.remove('cp-sidebar-open');
  if(ov) ov.classList.remove('cp-visible');
}

// ── DASHBOARD: RESUMO DE BOLETOS ──
async function cpCarregarBoletosResumo(){
  if(!_cid) return;
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var res = await sf('/rest/v1/boletos?cliente_id=eq.' + _cid + '&order=vencimento.asc&select=*');
  _cpBoletosData = res.data || [];

  var aVencer = _cpBoletosData.filter(function(b){
    return b.status !== 'pago' && new Date(b.vencimento) >= hoje;
  });

  var nCard = document.getElementById('cp-n-boletos');
  if(nCard) nCard.textContent = aVencer.length;

  var proxCard = document.getElementById('cp-prox-venc');
  if(proxCard){
    if(aVencer.length){
      var d = new Date(aVencer[0].vencimento + 'T12:00:00');
      proxCard.textContent = d.toLocaleDateString('pt-BR');
    } else {
      proxCard.textContent = '–';
    }
  }
}

// ── VIEW FINANCEIRO ──
async function cpCarregarFinanceiro(){
  var el = document.getElementById('cp-lista-boletos');
  if(!el) return;
  el.innerHTML = '<div class="ac-empty">Carregando...</div>';
  if(!_cid){ el.innerHTML = '<div class="ac-empty">Nenhum boleto encontrado.</div>'; return; }

  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var res = await sf('/rest/v1/boletos?cliente_id=eq.' + _cid + '&order=vencimento.desc&select=*');

  if(!res.ok || !res.data || !res.data.length){
    el.innerHTML = '<div class="ac-empty">Nenhum boleto encontrado.</div>';
    return;
  }

  _cpBoletosData = res.data;
  var total = res.data.length;
  var aVencer = res.data.filter(function(b){ return cpStatusBoleto(b, hoje) === 'avencer'; }).length;
  var vencidos = res.data.filter(function(b){ return cpStatusBoleto(b, hoje) === 'vencido'; }).length;
  var pagos = res.data.filter(function(b){ return cpStatusBoleto(b, hoje) === 'pago'; }).length;

  el.innerHTML =
    '<div class="cp-boletos-filtros">' +
      '<button class="cp-filtro-btn cp-filtro-ativo" onclick="cpFiltrarBoletos(\'todos\',this)">Todos (' + total + ')</button>' +
      '<button class="cp-filtro-btn" onclick="cpFiltrarBoletos(\'avencer\',this)">A vencer (' + aVencer + ')</button>' +
      '<button class="cp-filtro-btn" onclick="cpFiltrarBoletos(\'vencidos\',this)">Vencidos (' + vencidos + ')</button>' +
      '<button class="cp-filtro-btn" onclick="cpFiltrarBoletos(\'pagos\',this)">Pagos (' + pagos + ')</button>' +
    '</div>' +
    '<div id="cp-boletos-tabela"></div>';

  cpRenderizarBoletos(_cpBoletosData, hoje);
}

function cpStatusBoleto(b, hoje){
  if(b.status === 'pago') return 'pago';
  var venc = new Date(b.vencimento + 'T12:00:00'); venc.setHours(0,0,0,0);
  return venc < hoje ? 'vencido' : 'avencer';
}

function cpFiltrarBoletos(filtro, btn){
  document.querySelectorAll('.cp-filtro-btn').forEach(function(b){ b.classList.remove('cp-filtro-ativo'); });
  if(btn) btn.classList.add('cp-filtro-ativo');
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var lista = filtro === 'todos' ? _cpBoletosData : _cpBoletosData.filter(function(b){
    return cpStatusBoleto(b, hoje) === (filtro === 'avencer' ? 'avencer' : filtro === 'vencidos' ? 'vencido' : 'pago');
  });
  cpRenderizarBoletos(lista, hoje);
}

function cpRenderizarBoletos(lista, hoje){
  var el = document.getElementById('cp-boletos-tabela');
  if(!el) return;
  if(!lista.length){ el.innerHTML = '<div class="ac-empty">Nenhum boleto nesta categoria.</div>'; return; }

  var fmtVal = function(v){ return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '–'; };
  var fmtDate = function(v){
    if(!v) return '–';
    var d = new Date(v + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  var stLabels = {pago:'Pago', avencer:'A vencer', vencido:'Vencido'};
  var stClasses = {pago:'cp-st-pago', avencer:'cp-st-avencer', vencido:'cp-st-vencido'};
  var cardClasses = {pago:'cp-boleto-pago', avencer:'cp-boleto-avencer', vencido:'cp-boleto-vencido'};

  el.innerHTML = '<div class="cp-boletos-grid">' + lista.map(function(b){
    var st = cpStatusBoleto(b, hoje);
    var tooltip = st === 'vencido' ? ' title="Pode levar até 5 dias úteis para compensação"' : '';
    var downloadBtn = b.arquivo_url
      ? '<a href="' + b.arquivo_url + '" target="_blank" class="cp-boleto-download"><i class="ti ti-download"></i> Baixar</a>'
      : '<span class="cp-boleto-sem-pdf">PDF indisponível</span>';
    return '<div class="cp-boleto-card ' + (cardClasses[st]||'') + '">' +
      '<div class="cp-boleto-header">' +
        '<span class="cp-boleto-num">Boleto ' + (b.numero_boleto || '#'+b.id.slice(0,6)) + '</span>' +
        '<span class="cp-boleto-badge ' + (stClasses[st]||'') + '"' + tooltip + '>' + (stLabels[st]||st) + '</span>' +
      '</div>' +
      '<div class="cp-boleto-body">' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">NF</span><span class="cp-boleto-val">' + (b.numero_nf||'–') + '</span></div>' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">Valor</span><span class="cp-boleto-val cp-boleto-valor">' + fmtVal(b.valor) + '</span></div>' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">Vencimento</span><span class="cp-boleto-val">' + fmtDate(b.vencimento) + '</span></div>' +
      '</div>' +
      '<div class="cp-boleto-footer">' + downloadBtn + '</div>' +
    '</div>';
  }).join('') + '</div>';
}

// ── VIEW CONTRATOS ──
async function cpCarregarContratosView(){
  var el = document.getElementById('cp-lista-contratos');
  if(!el) return;
  el.innerHTML = '<div class="ac-empty">Carregando...</div>';
  if(!_cid){ el.innerHTML = '<div class="ac-empty">Nenhum contrato encontrado.</div>'; return; }

  var res = await sf('/rest/v1/contratos?cliente_id=eq.' + _cid + '&order=data_inicio.desc&select=*');

  if(!res.ok || !res.data || !res.data.length){
    el.innerHTML = '<div class="ac-empty">Nenhum contrato encontrado.</div>';
    return;
  }

  var fmtDate = function(v){ return v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '–'; };
  var fmtVal = function(v){ return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '–'; };

  function getServicos(c){
    var badges = [];
    if(c.servicos){
      var s = typeof c.servicos === 'string' ? c.servicos.toLowerCase() : JSON.stringify(c.servicos).toLowerCase();
      if(s.includes('impres')) badges.push('Impressão');
      if(s.includes('notebook')) badges.push('Notebook');
      if(s.includes('desktop')) badges.push('Desktop');
      if(s.includes('ia') || s.includes('teffe ia')) badges.push('TEFFE IA');
    }
    if(c.tem_impressao) badges.push('Impressão');
    if(c.tem_notebook)  badges.push('Notebook');
    if(c.tem_desktop)   badges.push('Desktop');
    if(c.tem_ia)        badges.push('TEFFE IA');
    return [...new Set(badges)];
  }

  el.innerHTML = res.data.map(function(c){
    var ativo = (c.status||'').toLowerCase() === 'ativo';
    var servicos = getServicos(c);
    var servicosBadges = servicos.map(function(s){ return '<span class="cp-servico-badge">' + s + '</span>'; }).join('');
    var download = c.arquivo_url
      ? '<a href="' + c.arquivo_url + '" target="_blank" class="cp-contrato-download"><i class="ti ti-download"></i> Baixar contrato</a>'
      : '';
    return '<div class="cp-contrato-card">' +
      '<div class="cp-contrato-header">' +
        '<div><span class="cp-contrato-num">Contrato Nº ' + (c.numero||'–') + '</span>' +
        '<span class="cp-contrato-status ' + (ativo?'cp-cont-ativo':'cp-cont-enc') + '">' + (c.status||'–') + '</span></div>' +
        download +
      '</div>' +
      (c.descricao ? '<div class="cp-contrato-desc">' + c.descricao + '</div>' : '') +
      '<div class="cp-contrato-infos">' +
        '<div class="cp-contrato-info-item"><span class="cp-boleto-lbl">Vigência</span><span class="cp-boleto-val">' + fmtDate(c.data_inicio) + ' → ' + fmtDate(c.data_fim) + '</span></div>' +
        '<div class="cp-contrato-info-item"><span class="cp-boleto-lbl">Valor/mês</span><span class="cp-boleto-val">' + fmtVal(c.valor_mensal) + '</span></div>' +
      '</div>' +
      (servicos.length ? '<div class="cp-servicos-badges">' + servicosBadges + '</div>' : '') +
    '</div>';
  }).join('');
}

// ── VIEW HISTÓRICO ──
async function cpCarregarHistorico(){
  var el = document.getElementById('cp-lista-historico');
  if(!el) return;
  el.innerHTML = '<div class="ac-empty">Carregando...</div>';
  if(!_cid){ el.innerHTML = '<div class="ac-empty">Nenhum chamado encerrado.</div>'; return; }

  var res = await sf(
    '/rest/v1/chamados?cliente_id=eq.' + _cid +
    '&or=(status.eq.encerrado,status.eq.concluido,status.eq.resolvido)' +
    '&order=data_fechamento.desc,created_at.desc&select=*'
  );

  if(!res.ok || !res.data || !res.data.length){
    el.innerHTML = '<div class="ac-empty">Nenhum chamado encerrado encontrado.</div>';
    return;
  }

  var statusLabels = {encerrado:'Encerrado', concluido:'Concluído', resolvido:'Resolvido'};
  var fmtDate = function(v){ return v ? new Date(v).toLocaleDateString('pt-BR') : '–'; };

  el.innerHTML =
    '<table class="ac-table"><thead><tr>' +
    '<th>#</th><th>Descrição</th><th>Técnico</th><th>Status</th><th>Fechamento</th><th></th>' +
    '</tr></thead><tbody>' +
    res.data.map(function(r){
      var desc = (r.descricao || r.titulo || '–').slice(0, 80);
      return '<tr>' +
        '<td><b>#' + (r.numero||r.id.slice(0,6)) + '</b></td>' +
        '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (r.descricao||'').replace(/"/g,'&quot;') + '">' + desc + '</td>' +
        '<td>' + (r.tecnico||'–') + '</td>' +
        '<td><span class="badge badge-' + r.status + '">' + (statusLabels[r.status]||r.status) + '</span></td>' +
        '<td>' + fmtDate(r.data_fechamento) + '</td>' +
        '<td><button class="adm-btn adm-btn-sm" onclick="cpVerHistorico(' + JSON.stringify(JSON.stringify(r)) + ')">Ver</button></td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';
}

function cpVerHistorico(jsonStr){
  var c = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  _chamadosCache[c.id] = Object.assign({}, c, {_tipo:'assistencia'});
  abrirDetalhesChamado(c.id);
}
