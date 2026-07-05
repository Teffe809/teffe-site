// ═══════════════════════════════════════════════════
//  PORTAL DO CLIENTE — Sidebar + views: Financeiro,
//  Contratos, Histórico
// ═══════════════════════════════════════════════════

// Sobrescreve acMostrarView (supabase.js) para passar pelo cpNavegar
window.acMostrarView = function(id){ cpNavegar(id); };

var _cpBoletosData = [];
var _cpBoletosList = [];
var _cpHistoricoData = [];
var _cpContratosComFechamento = new Set();

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
    ].filter(function(a){
      var modulo = _CP_VIEW_MODULO_CLIENTE[a.view];
      return !modulo || typeof _cpTemPermissaoCliente !== 'function' || _cpTemPermissaoCliente(modulo);
    });
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
// Módulo exigido por view (gate de permissão, mesmo padrão de
// _ERP_VIEW_MODULO/erpShowView no ERP) — views sem entrada aqui (dash) são
// sempre acessíveis.
var _CP_VIEW_MODULO_CLIENTE = {
  assist:'chamados', suprim:'chamados', historico:'chamados',
  contratos:'financeiro', financeiro:'financeiro'
};

function cpNavegar(id){
  var modulo = _CP_VIEW_MODULO_CLIENTE[id];
  if(modulo && typeof _cpTemPermissaoCliente === 'function' && !_cpTemPermissaoCliente(modulo)){
    alert('Acesso não autorizado.');
    id = 'dash';
  }
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
  else if(id === 'suprim' && typeof spRenderItens === 'function'){ _spItens = []; spRenderItens(); }
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
  _cpBoletosData = _arrOuVazio(res);

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
  console.log('[cpCarregarFinanceiro] _cid:', _cid, '| clienteLogado:', window.clienteLogado);
  var res = await sf('/rest/v1/boletos?cliente_id=eq.' + _cid + '&order=vencimento.desc&select=*');
  console.log('[cpCarregarFinanceiro] boletos res.ok:', res.ok, '| res.status:', res.status, '| registros:', Array.isArray(res.data) ? res.data.length : JSON.stringify(res.data));

  if(!res.ok || !Array.isArray(res.data) || !res.data.length){
    el.innerHTML = '<div class="ac-empty">Nenhum boleto encontrado.</div>';
    return;
  }

  _cpBoletosData = res.data;

  // Pre-fetch quais contratos têm fechamento (para exibir botão extrato só quando existe)
  _cpContratosComFechamento = new Set();
  var contratoIds = [];
  res.data.forEach(function(b) { if (b.contrato_id && contratoIds.indexOf(b.contrato_id) === -1) contratoIds.push(b.contrato_id); });
  if (contratoIds.length) {
    var fr = await sf('/rest/v1/fechamentos_mensais?contrato_id=in.(' + contratoIds.join(',') + ')&select=contrato_id&order=created_at.desc');
    if (Array.isArray(fr.data)) {
      fr.data.forEach(function(f) { _cpContratosComFechamento.add(f.contrato_id); });
    }
  }

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
  _cpBoletosList = lista;

  var fmtVal = function(v){ return v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '–'; };
  var fmtDate = function(v){
    if(!v) return '–';
    var d = new Date(v + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  var stLabels = {pago:'Pago', avencer:'A vencer', vencido:'Vencido'};
  var stClasses = {pago:'cp-st-pago', avencer:'cp-st-avencer', vencido:'cp-st-vencido'};
  var cardClasses = {pago:'cp-boleto-pago', avencer:'cp-boleto-avencer', vencido:'cp-boleto-vencido'};

  el.innerHTML = '<div class="cp-boletos-grid">' + lista.map(function(b, idx){
    var st = cpStatusBoleto(b, hoje);
    var hintVencido = st === 'vencido'
      ? '<small class="cp-boleto-hint">Pode levar até 5 dias úteis para compensação</small>'
      : '';
    var boletoBtn = b.arquivo_url
      ? '<a href="' + b.arquivo_url + '" target="_blank" class="cp-boleto-download"><i class="ti ti-receipt-2"></i> Ver Boleto</a>'
      : '';
    var extratoBtn = b.arquivo_extrato_url
      ? '<a href="' + b.arquivo_extrato_url + '" target="_blank" class="cp-boleto-extrato"><i class="ti ti-file-text"></i> Ver Extrato</a>'
      : (b.contrato_id && _cpContratosComFechamento.has(b.contrato_id))
        ? '<button class="cp-boleto-extrato" onclick="cpVerExtratoFechamento(' + idx + ')"><i class="ti ti-file-text"></i> Ver Extrato</button>'
        : '';
    return '<div class="cp-boleto-card ' + (cardClasses[st]||'') + '">' +
      '<div class="cp-boleto-header">' +
        '<span class="cp-boleto-num">Boleto ' + (b.numero_boleto || '#'+b.id.slice(0,6)) + '</span>' +
        '<div class="cp-boleto-badge-wrap">' +
          '<span class="cp-boleto-badge ' + (stClasses[st]||'') + '">' + (stLabels[st]||st) + '</span>' +
          hintVencido +
        '</div>' +
      '</div>' +
      '<div class="cp-boleto-body">' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">NF</span><span class="cp-boleto-val">' + (b.numero_nf||'–') + '</span></div>' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">Valor</span><span class="cp-boleto-val cp-boleto-valor">' + fmtVal(b.valor) + '</span></div>' +
        '<div class="cp-boleto-info"><span class="cp-boleto-lbl">Vencimento</span><span class="cp-boleto-val">' + fmtDate(b.vencimento) + '</span></div>' +
      '</div>' +
      '<div class="cp-boleto-footer">' + boletoBtn + extratoBtn + '</div>' +
    '</div>';
  }).join('') + '</div>';
}

async function cpVerExtratoFechamento(idx) {
  var b = _cpBoletosList[idx];
  if (!b || !b.contrato_id) return;

  var fechamento = null, contrato = null, equips = [];

  try {
    var fr = await sf('/rest/v1/fechamentos_mensais?contrato_id=eq.' + b.contrato_id + '&select=*&order=created_at.desc&limit=1');
    fechamento = fr.data && fr.data[0] ? fr.data[0] : null;
  } catch(e) {}

  if (!fechamento) { alert('Nenhum fechamento encontrado para este contrato.'); return; }

  try {
    var cr = await sf('/rest/v1/contratos?id=eq.' + b.contrato_id + '&select=*&limit=1');
    contrato = cr.data && cr.data[0] ? cr.data[0] : null;
  } catch(e) {}

  if (!contrato) { alert('Dados do contrato não encontrados.'); return; }

  try {
    var er = await sf('/rest/v1/contrato_equipamentos?contrato_id=eq.' + b.contrato_id + '&select=equipamento_id');
    var eqIds = _arrOuVazio(er).map(function(v){ return v.equipamento_id; }).filter(Boolean);
    if (eqIds.length) {
      var eqRes = await sf('/rest/v1/equipamentos?id=in.(' + eqIds.join(',') + ')&select=id,marca,modelo,serial,codigo_teffe');
      equips = Array.isArray(eqRes.data) ? eqRes.data : [];
    }
  } catch(e) {}

  var clienteNome = '—';
  try {
    var cliRes = await sf('/rest/v1/clientes?id=eq.' + _cid + '&select=razao_social&limit=1');
    if (Array.isArray(cliRes.data) && cliRes.data[0]) clienteNome = cliRes.data[0].razao_social || '—';
  } catch(e) {}
  _cpAbrirExtratoFechamento(fechamento, contrato, clienteNome, equips);
}

var _CP_TEFFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 175" style="height:60px;width:auto;display:block;"><rect width="580" height="175" fill="#ffffff"/><polygon points="95,31 140,57 140,109 95,135 50,109 50,57" fill="none" stroke="#E07820" stroke-width="5" stroke-linejoin="round"/><polygon points="95,37 135,60 135,106 95,129 55,106 55,60" fill="#ffffff"/><polygon points="95,43 130,63 130,103 95,123 60,103 60,63" fill="#1A2E5A"/><rect x="78" y="62" width="34" height="6" rx="2.5" fill="#E07820"/><rect x="91" y="62" width="7" height="30" rx="2.5" fill="#E07820"/><line x1="140" y1="57" x2="163" y2="44" stroke="#E07820" stroke-width="1.8"/><circle cx="166" cy="42" r="3.8" fill="#E07820"/><line x1="140" y1="109" x2="163" y2="122" stroke="#E07820" stroke-width="1.8"/><circle cx="166" cy="124" r="3.8" fill="#E07820"/><line x1="95" y1="135" x2="95" y2="158" stroke="#E07820" stroke-width="1.8"/><circle cx="95" cy="161" r="3.8" fill="#E07820"/><line x1="50" y1="109" x2="27" y2="122" stroke="#E07820" stroke-width="1.8"/><circle cx="24" cy="124" r="3.8" fill="#E07820"/><line x1="50" y1="57" x2="27" y2="44" stroke="#E07820" stroke-width="1.8"/><circle cx="24" cy="42" r="3.8" fill="#E07820"/><text font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="76" x="200" y="103"><tspan fill="#1A2E5A">TE</tspan><tspan fill="#E07820">FFE</tspan></text><rect x="200" y="111" width="310" height="3" rx="1.5" fill="#E07820"/><text x="202" y="139" font-family="Arial,sans-serif" font-weight="700" font-size="15" fill="#E07820" letter-spacing="6">TECNOLOGIA</text></svg>';

function _cpAbrirExtratoFechamento(f, c, clienteNome, equips) {
  var esc = function(v) { return (v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var fmt = function(v) { return Number(v || 0).toFixed(2).replace('.', ','); };

  var mesDate = f.mes_referencia ? new Date(f.mes_referencia + 'T12:00:00') : new Date();
  var mesLabel = mesDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  var mesUpper = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  var diaVenc = c.dia_vencimento || 10;
  var mp = (f.mes_referencia || '').split('-');
  var vencDate = new Date(parseInt(mp[0]), parseInt(mp[1] || 1), diaVenc);
  var vencFmt = vencDate.toLocaleDateString('pt-BR');

  var tipoLabel = { manutencao:'MANUTENÇÃO', locacao:'LOCAÇÃO', avulso:'AVULSO' }[c.tipo_contrato] || (c.tipo_contrato||'').toUpperCase();
  var isManutencao = c.tipo_contrato === 'manutencao';

  var pagPb = (f.contador_pb_atual || 0) - (f.contador_pb_anterior || 0);
  var pagColor = (f.contador_color_atual || 0) - (f.contador_color_anterior || 0);
  var valUnitPb = Number(c.valor_pagina_pb || 0);
  var valUnitColor = Number(c.valor_pagina_color || 0);
  var totalPb = pagPb * valUnitPb;
  var totalColor = pagColor * valUnitColor;
  var valorFixo = Number(f.valor_fixo || 0);
  var valorExcedente = Number(f.valor_excedente || 0);
  var total = Number(f.valor_total || 0);

  var equipHtml = '';
  if (equips.length === 0) {
    equipHtml = '<div style="padding:20px;color:#666;font-size:13px">Nenhum equipamento vinculado.</div>';
  } else {
    equips.forEach(function(eq, i) {
      equipHtml += '<div style="padding:20px;border-bottom:1px solid #eee;">' +
        '<h3 style="color:#0A4B8D;border-bottom:1px solid #F87A13;padding-bottom:5px;margin:0 0 6px;font-size:14px;">EQUIPAMENTO: ' + esc((eq.marca||'') + ' ' + (eq.modelo||'')) + '</h3>' +
        '<p style="color:#666;font-size:12px;margin:0 0 10px">Serial: ' + esc(eq.serial||'—') + ' | Código Teffe: ' + esc(eq.codigo_teffe||'—') + '</p>';
      if (i === 0) {
        equipHtml +=
          '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">' +
          '<thead><tr style="background:#0A4B8D;color:white;">' +
            '<th style="padding:8px;text-align:left;">DESCRIÇÃO</th>' +
            '<th style="padding:8px;text-align:right;">ANTERIOR</th>' +
            '<th style="padding:8px;text-align:right;">ATUAL</th>' +
            '<th style="padding:8px;text-align:right;">PÁGINAS</th>' +
            '<th style="padding:8px;text-align:right;">VALOR UNIT.</th>' +
            '<th style="padding:8px;text-align:right;">TOTAL</th>' +
          '</tr></thead><tbody>' +
          '<tr style="background:#f9f9f9;">' +
            '<td style="padding:8px;border:1px solid #ddd;">Impressão PB</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + (f.contador_pb_anterior||0) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + (f.contador_pb_atual||0) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + pagPb + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">R$ ' + fmt(valUnitPb) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">R$ ' + fmt(totalPb) + '</td>' +
          '</tr><tr>' +
            '<td style="padding:8px;border:1px solid #ddd;">Impressão Colorida</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + (f.contador_color_anterior||0) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + (f.contador_color_atual||0) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">' + pagColor + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">R$ ' + fmt(valUnitColor) + '</td>' +
            '<td style="padding:8px;text-align:right;border:1px solid #ddd;">R$ ' + fmt(totalColor) + '</td>' +
          '</tr></tbody></table>';
      } else {
        equipHtml += '<p style="font-size:12px;color:#888;">Contadores consolidados no equipamento principal.</p>';
      }
      equipHtml += '</div>';
    });
  }

  var finHtml = '<div style="padding:20px;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<tr><td style="padding:8px;border:1px solid #eee;"><strong>Valor Fixo Mensal</strong></td>' +
      '<td style="padding:8px;text-align:right;border:1px solid #eee;">R$ ' + fmt(valorFixo) + '</td></tr>';

  if (isManutencao) {
    finHtml += '<tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #eee;"><strong>Valor Produção PB (' + pagPb + ' págs × R$ ' + fmt(valUnitPb) + ')</strong></td>' +
      '<td style="padding:8px;text-align:right;border:1px solid #eee;">R$ ' + fmt(totalPb) + '</td></tr>' +
      '<tr><td style="padding:8px;border:1px solid #eee;"><strong>Valor Produção Colorida (' + pagColor + ' págs × R$ ' + fmt(valUnitColor) + ')</strong></td>' +
      '<td style="padding:8px;text-align:right;border:1px solid #eee;">R$ ' + fmt(totalColor) + '</td></tr>';
  } else {
    if (f.rollover_credito_usado > 0) {
      finHtml += '<tr style="background:#EDE9FE;"><td style="padding:8px;border:1px solid #eee;"><strong>Rollover abatido</strong></td>' +
        '<td style="padding:8px;text-align:right;border:1px solid #eee;color:#7C3AED;">−' + f.rollover_credito_usado + ' págs</td></tr>';
    }
    if (valorExcedente > 0) {
      finHtml += '<tr style="background:#FEF2F2;"><td style="padding:8px;border:1px solid #eee;"><strong>Excedente</strong></td>' +
        '<td style="padding:8px;text-align:right;border:1px solid #eee;color:#DC2626;">R$ ' + fmt(valorExcedente) + '</td></tr>';
    }
  }

  finHtml +=
    '<tr style="background:#0A4B8D;color:white;">' +
      '<td style="padding:12px;border:1px solid #0A4B8D;"><strong>TOTAL A PAGAR</strong></td>' +
      '<td style="padding:12px;text-align:right;font-size:18px;border:1px solid #0A4B8D;"><strong>R$ ' + fmt(total) + '</strong></td>' +
    '</tr></table>' +
    '<div style="margin-top:20px;padding:15px;background:#E8F0FB;border-left:4px solid #F87A13;border-radius:4px;">' +
      '<p style="margin:0;color:#0A4B8D;"><strong>⚠️ Este extrato é meramente informativo.</strong></p>' +
      '<p style="margin:5px 0 0;color:#666;font-size:12px;">O boleto bancário é enviado separadamente com vencimento em <strong>' + vencFmt + '</strong>.</p>' +
    '</div></div>';

  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>' +
    '<title>Extrato ' + esc(mesUpper) + ' — ' + esc(c.numero||'') + '</title>' +
    '<style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;margin:0;padding:0;}' +
    '@media print{.np{display:none!important;}@page{size:A4;margin:10mm;}}</style></head><body>' +
    '<div class="np" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 20px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">' +
      '<button onclick="window.close()" style="padding:8px 18px;border:1px solid #D1D5DB;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;">Fechar</button>' +
      '<button onclick="window.print()" style="padding:8px 22px;border:none;border-radius:6px;background:#0A4B8D;color:#fff;font-weight:700;cursor:pointer;font-size:13px;">⎙ Imprimir / Salvar PDF</button>' +
    '</div>' +
    '<div style="background:#0A4B8D;padding:24px 30px;display:flex;justify-content:space-between;align-items:center;">' +
      '<div>' +
        '<div style="background:#fff;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:6px;">' + _CP_TEFFE_SVG + '</div>' +
        '<p style="color:#F87A13;margin:2px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">EXTRATO DE FECHAMENTO MENSAL</p>' +
      '</div>' +
      '<div style="color:white;text-align:right;font-size:12px;line-height:1.9;"><p style="margin:0">contato@teffe.com.br</p><p style="margin:0">(14) 99828-9248</p><p style="margin:0">teffe.com.br</p></div>' +
    '</div>' +
    '<div style="padding:20px;border-bottom:2px solid #0A4B8D;">' +
      '<h2 style="color:#0A4B8D;margin:0 0 12px;font-size:18px;">EXTRATO — ' + esc(mesUpper.toUpperCase()) + '</h2>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<tr><td style="padding:5px 10px 5px 0;width:130px;color:#666;font-weight:700;">CLIENTE:</td><td style="padding:5px 0;">' + esc(clienteNome) + '</td></tr>' +
        '<tr><td style="padding:5px 10px 5px 0;color:#666;font-weight:700;">CONTRATO:</td><td style="padding:5px 0;"><strong>' + esc(c.numero||'—') + '</strong> | ' + tipoLabel + '</td></tr>' +
        '<tr><td style="padding:5px 10px 5px 0;color:#666;font-weight:700;">PERÍODO:</td><td style="padding:5px 0;">' + esc(mesUpper) + '</td></tr>' +
        '<tr><td style="padding:5px 10px 5px 0;color:#666;font-weight:700;">VENCIMENTO:</td><td style="padding:5px 0;"><strong>' + vencFmt + '</strong></td></tr>' +
      '</table>' +
    '</div>' +
    equipHtml + finHtml +
    '<div style="background:#0A4B8D;padding:15px;text-align:center;margin-top:30px;">' +
      '<p style="color:white;margin:0;font-size:11px;">Teffe Tecnologia © 2026 | contato@teffe.com.br | (14) 99828-9248 | teffe.com.br</p>' +
    '</div>' +
    '</body></html>';

  var w = window.open('', '_blank', 'width=960,height=860');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
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
// Mesmos status terminais de suprimento já usados no ERP
// (ERP_STATUS_SUPRIMENTO_TERMINAL, js/supabase.js do teffe-erp).
var _CP_HIST_STATUS_SUPRIMENTO_TERMINAL = ['enviado', 'encerrado', 'cancelado'];

async function cpCarregarHistorico(){
  var el = document.getElementById('cp-lista-historico');
  if(!el) return;
  el.innerHTML = '<div class="ac-empty">Carregando...</div>';
  if(!_cid){ el.innerHTML = '<div class="ac-empty">Nenhum item no histórico.</div>'; return; }

  var supOr = _CP_HIST_STATUS_SUPRIMENTO_TERMINAL.map(function(s){ return 'status.eq.' + s; }).join(',');
  var [resCh, resSp] = await Promise.all([
    sf('/rest/v1/chamados?cliente_id=eq.' + _cid +
      '&or=(status.eq.encerrado,status.eq.concluido,status.eq.resolvido)' +
      '&order=data_encerramento.desc,created_at.desc&select=*'),
    sf('/rest/v1/solicitacoes_suprimento?cliente_id=eq.' + _cid +
      '&or=(' + supOr + ')' +
      '&order=data_encerramento.desc,created_at.desc&select=*')
  ]);

  var chamados = _arrOuVazio(resCh).map(function(r){ return Object.assign({}, r, {_tipo:'assistencia'}); });

  // Agrupa as linhas de suprimento pelo mesmo "numero" (um pedido com vários
  // insumos vira várias linhas) — mesmo padrão de carregarChamados() em
  // js/supabase.js.
  var suprimentosRaw = _arrOuVazio(resSp);
  var gruposMap = {};
  var ordemGrupos = [];
  suprimentosRaw.forEach(function(r){
    var chave = r.numero != null ? ('n' + r.numero) : ('r' + r.id);
    if(!gruposMap[chave]){
      gruposMap[chave] = Object.assign({}, r, {_tipo:'suprimento', id:'sup-' + chave, _itens:[]});
      ordemGrupos.push(chave);
    }
    gruposMap[chave]._itens.push({insumo_id:r.insumo_id, quantidade:r.quantidade});
  });
  var suprimentos = ordemGrupos.map(function(k){ return gruposMap[k]; });

  var insumoIds = Array.from(new Set(suprimentos.reduce(function(acc, s){
    return acc.concat(s._itens.map(function(it){ return it.insumo_id; }).filter(Boolean));
  }, [])));
  if(insumoIds.length){
    var insumosRes = await sf('/rest/v1/insumos?id=in.(' + insumoIds.join(',') + ')&select=id,nome,codigo');
    var insumoMap = {};
    _arrOuVazio(insumosRes).forEach(function(i){ insumoMap[i.id] = i; });
    suprimentos.forEach(function(s){ s._itens.forEach(function(it){ it._insumo = insumoMap[it.insumo_id] || null; }); });
  }

  var todos = chamados.concat(suprimentos).sort(function(a, b){
    return new Date(b.data_encerramento || b.created_at) - new Date(a.data_encerramento || a.created_at);
  });

  if(!todos.length){
    el.innerHTML = '<div class="ac-empty">Nenhum item no histórico.</div>';
    return;
  }

  _cpHistoricoData = todos;

  var statusLabels = {encerrado:'Encerrado', concluido:'Concluído', resolvido:'Resolvido', faturado:'Faturado', enviado:'Enviado', cancelado:'Cancelado'};
  var tipoChamadoLabels = {assistencia:'Assistência', instalacao:'Instalação', desinstalacao:'Desinstalação'};
  var fmtDate = function(v){ return v ? new Date(v).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '–'; };

  el.innerHTML =
    '<table class="ac-table"><thead><tr>' +
    '<th>O.S.</th><th>Tipo</th><th>Descrição</th><th>Técnico</th><th>Status</th><th>Encerramento</th><th></th>' +
    '</tr></thead><tbody>' +
    todos.map(function(r, idx){
      var isAssistencia = r._tipo !== 'suprimento';
      var tipoLabel = isAssistencia ? (tipoChamadoLabels[r.tipo_chamado] || 'Assistência') : 'Suprimentos';
      var desc = isAssistencia
        ? (r.descricao || r.titulo || '–').slice(0, 80)
        : ('Solicitação de Suprimentos' + (r._itens.length > 1 ? ' — ' + r._itens.length + ' itens' : ''));
      return '<tr>' +
        '<td><b>O.S. ' + (r.numero||r.id.slice(0,6)) + '</b></td>' +
        '<td><span class="badge ' + (isAssistencia ? 'badge-assist' : 'badge-suprim') + '">' + tipoLabel + '</span></td>' +
        '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (isAssistencia ? (r.descricao||'').replace(/"/g,'&quot;') : '') + '">' + desc + '</td>' +
        '<td>' + (isAssistencia ? (r.tecnico||'–') : '–') + '</td>' +
        '<td><span class="badge badge-' + r.status + '">' + (statusLabels[r.status]||r.status) + '</span></td>' +
        '<td>' + fmtDate(r.data_encerramento) + '</td>' +
        '<td><button class="adm-btn adm-btn-sm" onclick="cpVerHistorico(' + idx + ')">Ver</button></td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';
}

// Recebe o ÍNDICE (não o objeto inteiro) — passar o registro completo via
// JSON.stringify dentro de um onclick="..." quebrava sempre que a descrição
// tinha aspas: o JSON escapado (com \") colide com o delimitador do próprio
// atributo HTML (aspas duplas) e trunca a chamada, fazendo o botão "Ver"
// não fazer nada. Mesmo padrão seguro já usado em tecHistAbrirDetalhe(idx).
function cpVerHistorico(idx){
  var c = _cpHistoricoData[idx];
  if(!c) return;
  _chamadosCache[c.id] = c;
  abrirDetalhesChamado(c.id);
}
