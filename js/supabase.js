const SURL='https://hlfjcpgrxiktgctozilk.supabase.co';
const SKEY='sb_publishable_-Iu8PbqhLeZAXSBcczr2mQ_lzlGr4_g';
function capitalizarNome(nome) {
  if (!nome) return '';
  return nome.toLowerCase().split(' ').map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
}

let _tok=null,_uid=null,_cid=null,_email=null,_atEquipId=null,_spEquipId=null,_spUltimoContador=null,_spTipoImpressao='monocromatico',_chamadosCache={};
let _spItens=[]; // carrinho da solicitação de suprimento: [{insumo_id, label, quantidade}]
let _equipsAC=[];
let _tecHistData=[],_tecHistPage=0,_tecHistEquip=null;
const TEC_HIST_PG=10;

// ── TIMER DE INATIVIDADE (5 min) ──
const INATIVIDADE_MS=5*60*1000;
let _timerInatividade=null;
const _EVENTOS_ATIVIDADE=['mousemove','click','keydown','touchstart','scroll'];

function _resetarInatividade(){
  clearTimeout(_timerInatividade);
  _timerInatividade=setTimeout(_logoutPorInatividade,INATIVIDADE_MS);
}
function _iniciarInatividade(){
  _EVENTOS_ATIVIDADE.forEach(ev=>document.addEventListener(ev,_resetarInatividade,{passive:true}));
  _resetarInatividade();
}
function _pararInatividade(){
  clearTimeout(_timerInatividade);
  _timerInatividade=null;
  _EVENTOS_ATIVIDADE.forEach(ev=>document.removeEventListener(ev,_resetarInatividade));
}
function _logoutPorInatividade(){
  fazerLogout(true);
}

async function sf(path,opts){
  const h={'apikey':SKEY,'Content-Type':'application/json'};
  if(_tok) h['Authorization']='Bearer '+_tok;
  const r=await fetch(SURL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok,status:r.status};
}

// Extrai o array de uma resposta de sf()/sfTec(); se a query falhar (coluna/
// tabela inexistente, RLS etc.) o PostgREST devolve um objeto de erro (truthy)
// em vez de array — "res.data || []" não protege contra isso, e um
// .map()/.forEach()/.filter() nesse objeto quebra silenciosamente.
function _arrOuVazio(res){
  return (res && res.ok && Array.isArray(res.data)) ? res.data : [];
}

// ── LOGIN / LOGOUT ──
async function fazerLogin(){
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const erro=document.getElementById('login-erro');
  const btn=document.getElementById('btn-entrar');
  if(!email||!senha){erro.style.display='block';erro.textContent='Preencha e-mail e senha.';return;}
  btn.textContent='Entrando...';btn.disabled=true;erro.style.display='none';
  const r=await fetch(SURL+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{'apikey':SKEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password:senha})
  });
  const d=await r.json();
  if(!r.ok){erro.style.display='block';erro.textContent='E-mail ou senha incorretos.';btn.textContent='Entrar →';btn.disabled=false;return;}
  _tok=d.access_token;_uid=d.user.id;_email=d.user.email||null;
  localStorage.setItem('tt',_tok);localStorage.setItem('tu',_uid);if(_email)localStorage.setItem('te',_email);
  _resetarModalLogin();
  document.getElementById('modal').classList.remove('open');
  document.getElementById('login-inatividade').style.display='none';
  carregarArea();
}

function _resetarModalLogin(){
  document.getElementById('login-email').value='';
  document.getElementById('login-senha').value='';
  document.getElementById('login-erro').style.display='none';
  const btn=document.getElementById('btn-entrar');
  btn.textContent='Entrar →';
  btn.disabled=false;
}

async function fazerLogout(inatividade=false){
  _pararInatividade();
  document.documentElement.classList.remove('no-scroll');
  // Invalida o token no servidor (fire-and-forget)
  if(_tok){
    fetch(SURL+'/auth/v1/logout',{
      method:'POST',
      headers:{'apikey':SKEY,'Authorization':'Bearer '+_tok,'Content-Type':'application/json'}
    }).catch(()=>{});
  }
  _tok=null;_uid=null;_cid=null;_email=null;
  localStorage.clear();
  sessionStorage.clear();
  window.location.href='https://teffe.com.br';
}

// ── RECUPERAÇÃO / TROCA DE SENHA ──
function esqueciMinhaSenha(p){
  document.getElementById(p+'-login-panel').style.display='none';
  document.getElementById(p+'-rec-panel').style.display='block';
  const m=document.getElementById(p+'-rec-msg');
  m.className='rec-msg';m.textContent='';
  const e=document.getElementById(p+'-rec-email');
  if(e)e.value='';
}
function voltarAoLogin(p){
  document.getElementById(p+'-rec-panel').style.display='none';
  document.getElementById(p+'-login-panel').style.display='block';
}
async function enviarLinkRecuperacao(p){
  const emailEl=document.getElementById(p+'-rec-email');
  const msgEl=document.getElementById(p+'-rec-msg');
  const btnEl=document.getElementById(p+'-rec-btn');
  const email=(emailEl&&emailEl.value||'').trim();
  if(!email){msgEl.className='rec-msg rec-msg-erro';msgEl.textContent='Informe seu e-mail.';return;}
  const portalMap={cli:'cliente',tec:'tecnico',adm:'admin'};
  const redirectTo='https://teffe.com.br/redefinir-senha.html?portal='+(portalMap[p]||'cliente');
  btnEl.textContent='Enviando...';btnEl.disabled=true;
  const r=await fetch(SURL+'/auth/v1/recover',{
    method:'POST',
    headers:{'apikey':SKEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,redirectTo})
  });
  btnEl.textContent='Enviar link →';btnEl.disabled=false;
  msgEl.className='rec-msg '+(r.ok?'rec-msg-ok':'rec-msg-erro');
  msgEl.textContent=r.ok
    ?'Link enviado! Verifique sua caixa de entrada.'
    :'Não foi possível enviar. Verifique o e-mail informado.';
}
function abrirAlterarSenha(portal){
  const m=document.getElementById('modal-alterar-senha');
  m.dataset.portal=portal;
  document.getElementById('alterar-nova-senha').value='';
  document.getElementById('alterar-confirmar-senha').value='';
  const msg=document.getElementById('alterar-msg');
  msg.className='rec-msg';msg.textContent='';
  m.classList.add('open');
}
function fecharAlterarSenha(){
  document.getElementById('modal-alterar-senha').classList.remove('open');
}
async function confirmarAlterarSenha(){
  const nova=document.getElementById('alterar-nova-senha').value;
  const conf=document.getElementById('alterar-confirmar-senha').value;
  const msg=document.getElementById('alterar-msg');
  const btn=document.getElementById('alterar-btn');
  msg.className='rec-msg';msg.textContent='';
  if(nova.length<6){msg.className='rec-msg rec-msg-erro';msg.textContent='A senha deve ter pelo menos 6 caracteres.';return;}
  if(nova!==conf){msg.className='rec-msg rec-msg-erro';msg.textContent='As senhas não coincidem.';return;}
  const portal=document.getElementById('modal-alterar-senha').dataset.portal;
  if(portal==='adm'){
    if(typeof admConfirmarAlterarSenha==='function') return admConfirmarAlterarSenha(nova,msg,btn);
    return;
  }
  const token=portal==='tec'?_tecTok:_tok;
  if(!token){msg.className='rec-msg rec-msg-erro';msg.textContent='Sessão expirada. Faça login novamente.';return;}
  btn.textContent='Salvando...';btn.disabled=true;
  const r=await fetch(SURL+'/auth/v1/user',{
    method:'PUT',
    headers:{'apikey':SKEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({password:nova})
  });
  btn.textContent='Salvar senha →';btn.disabled=false;
  if(r.ok){
    msg.className='rec-msg rec-msg-ok';msg.textContent='Senha alterada com sucesso!';
    setTimeout(fecharAlterarSenha,2000);
  } else {
    const d=await r.json().catch(()=>({}));
    msg.className='rec-msg rec-msg-erro';
    msg.textContent=d.msg||'Erro ao alterar a senha. Tente novamente.';
  }
}

// ── CARREGAR ÁREA ──
async function carregarArea(){
  // Valida sessão antes de mostrar qualquer dado
  if(!_tok||!_uid){
    document.getElementById('modal').classList.add('open');
    return;
  }
  const _sessCheck=await fetch(SURL+'/auth/v1/user',{
    headers:{'apikey':SKEY,'Authorization':'Bearer '+_tok}
  }).catch(()=>null);
  if(!_sessCheck||!_sessCheck.ok){
    _tok=null;_uid=null;_cid=null;_email=null;
    localStorage.clear();sessionStorage.clear();
    document.getElementById('modal').classList.add('open');
    return;
  }
  document.documentElement.classList.add('no-scroll');
  document.getElementById('area-cliente').style.display='flex';
  history.pushState(null,'','#cliente');
  _iniciarInatividade();
  const {data:cl}=await sf('/rest/v1/clientes?user_id=eq.'+_uid+'&limit=1&select=*');
  const c=cl&&cl[0];
  _cid=c?c.id:null;
  let primeiroNome=c?capitalizarNome(c.nome).split(' ')[0]:'cliente';
  if(_email){
    const {data:cu}=await sf('/rest/v1/cliente_usuarios?email=eq.'+encodeURIComponent(_email)+'&limit=1&select=nome,cliente_id');
    if(cu&&cu[0]){
      if(cu[0].nome) primeiroNome=capitalizarNome(cu[0].nome).split(' ')[0];
      if(!_cid&&cu[0].cliente_id) _cid=cu[0].cliente_id;
    }
  }
  window.clienteLogado={nome:primeiroNome,clienteId:_cid};
  document.getElementById('ac-nome').textContent=primeiroNome;
  document.getElementById('ac-empresa').textContent=c?c.empresa:'Minha Área';
  if(typeof miaIniciarSupporte==='function') setTimeout(function(){miaIniciarSupporte(primeiroNome);},1500);
  acMostrarView('dash');
  carregarChamados();
  carregarEquips();
  carregarContratos();
  if(typeof cpOnAreaLoad==='function') cpOnAreaLoad();
}

// ── NAVEGAÇÃO ENTRE VIEWS ──
function acMostrarView(id){
  document.querySelectorAll('.ac-view').forEach(v=>v.classList.remove('ac-view-active'));
  document.getElementById('ac-view-'+id).classList.add('ac-view-active');
  document.getElementById('area-cliente').scrollTop=0;
  const hashes={dash:'cliente',assist:'cliente/assistencia',suprim:'cliente/suprimentos'};
  history.replaceState(null,'','#'+(hashes[id]||'cliente'));
}

// ── CHAMADOS (assistência + suprimentos) ──
async function carregarChamados(){
  const el=document.getElementById('lista-cham');
  if(!_cid){
    el.innerHTML='<div class="ac-empty">Nenhum chamado.</div>';
    document.getElementById('n-cham').textContent='0';
    return;
  }
  const [rCh,rSp]=await Promise.all([
    sf('/rest/v1/chamados?cliente_id=eq.'+_cid+'&order=created_at.desc&select=*'),
    // Sem embed de insumos aqui: não existe FK entre solicitacoes_suprimento e
    // insumos no schema (PostgREST não consegue montar o join) — os nomes são
    // buscados à parte logo abaixo.
    sf('/rest/v1/solicitacoes_suprimento?cliente_id=eq.'+_cid+'&order=created_at.desc&select=*')
  ]);
  const chamados=_arrOuVazio(rCh).map(r=>({...r,_tipo:'assistencia'}));

  // Agrupa as linhas de suprimento pelo mesmo "numero" — um pedido com vários
  // insumos vira várias linhas com o mesmo número (ver enviarSuprimento()).
  const suprimentosRaw=_arrOuVazio(rSp);
  const gruposMap=new Map();
  suprimentosRaw.forEach(r=>{
    const chave=r.numero!=null?('n'+r.numero):('r'+r.id);
    if(!gruposMap.has(chave)) gruposMap.set(chave,{...r,_tipo:'suprimento',id:'sup-'+chave,_itens:[]});
    gruposMap.get(chave)._itens.push({insumo_id:r.insumo_id,quantidade:r.quantidade});
  });
  const suprimentos=Array.from(gruposMap.values());

  const insumoIds=[...new Set(suprimentos.flatMap(s=>s._itens.map(it=>it.insumo_id)).filter(Boolean))];
  if(insumoIds.length){
    const insumosRes=await sf('/rest/v1/insumos?id=in.('+insumoIds.join(',')+')&select=id,nome,codigo');
    const insumoMap={};
    _arrOuVazio(insumosRes).forEach(i=>{insumoMap[i.id]=i;});
    suprimentos.forEach(s=>{ s._itens.forEach(it=>{ it._insumo=insumoMap[it.insumo_id]||null; }); });
  }

  const todos=[...chamados,...suprimentos].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  _chamadosCache={};
  todos.forEach(r=>{_chamadosCache[r.id]=r;});
  document.getElementById('n-cham').textContent=todos.filter(r=>r.status==='aberto').length;
  document.getElementById('n-encerrado').textContent=todos.filter(r=>r.status==='encerrado').length;
  if(!todos.length){el.innerHTML='<div class="ac-empty">Nenhum chamado ainda.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>O.S.</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Data</th></tr></thead><tbody>'+
    todos.map(r=>{
      const descricaoCol=r._tipo==='suprimento'
        ?('Solicitação de Suprimentos'+(r._itens.length>1?' — '+r._itens.length+' itens':''))
        :(r.descricao||r.titulo||'–');
      return `<tr class="ac-row-click" onclick="abrirDetalhesChamado('${r.id}')">
      <td><b>O.S. ${r.numero||r.id.slice(0,6)}</b></td>
      <td><span class="badge ${r._tipo==='suprimento'?'badge-suprim':'badge-assist'}">${r._tipo==='suprimento'?'Suprimentos':'Assistência'}</span></td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${descricaoCol}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
    </tr>`;
    }).join('')+
    '</tbody></table>';
}

async function abrirDetalhesChamado(id){
  const c=_chamadosCache[id];
  if(!c) return;
  const isAssistencia=c._tipo!=='suprimento';
  const tipo=isAssistencia?'Assistência Técnica':'Suprimentos';
  const badgeTipo=`<span class="badge ${isAssistencia?'badge-assist':'badge-suprim'}">${tipo}</span>`;
  const statusLabels={aberto:'Aberto',andamento:'Em andamento',encerrado:'Encerrado',concluido:'Concluído',resolvido:'Resolvido'};
  const prioLabels={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const badgeStatus=`<span class="badge badge-${c.status}">${statusLabels[c.status]||c.status}</span>`;
  const data=new Date(c.created_at).toLocaleString('pt-BR');
  const encerrado=['encerrado','concluido','resolvido'].includes(c.status);
  const fmtD=v=>v?new Date(v).toLocaleDateString('pt-BR'):'';

  // Itens da solicitação de suprimento (pode ser mais de um insumo por pedido)
  const itensSuprimentoHtml=(!isAssistencia&&c._itens&&c._itens.length)?`
    <div class="ac-det-item ac-det-full">
      <span class="ac-det-lbl">Itens Solicitados</span>
      <table class="ac-table" style="margin-top:6px;">
        <thead><tr><th>Insumo</th><th>Qtd.</th></tr></thead>
        <tbody>${c._itens.map(it=>{
          const nome=it._insumo?(it._insumo.codigo?'['+it._insumo.codigo+'] '+it._insumo.nome:it._insumo.nome):'–';
          return `<tr><td>${nome}</td><td>${it.quantidade}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`:'';

  // Peças utilizadas (apenas assistência técnica)
  c._pecas=[];
  let pecasModalHtml='';
  if(isAssistencia){
    const {data:pRows}=await sf('/rest/v1/chamado_pecas?chamado_id=eq.'+c.id+'&select=*,pecas(codigo,descricao,unidade)');
    c._pecas=pRows||[];
    if(c._pecas.length){
      pecasModalHtml=`<div class="ac-det-item ac-det-full" style="margin-top:4px;">
        <span class="ac-det-lbl">Peças Utilizadas</span>
        <table class="ac-table" style="margin-top:6px;">
          <thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th></tr></thead>
          <tbody>${c._pecas.map(p=>`<tr>
            <td>${(p.pecas&&p.pecas.codigo)||'–'}</td>
            <td>${(p.pecas&&p.pecas.descricao)||'–'}</td>
            <td>${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  }

  document.getElementById('ac-detalhe-conteudo').innerHTML=`
    <div class="ac-det-title">Chamado O.S. ${c.numero||c.id.slice(0,6)}</div>
    <div class="ac-det-grid">
      <div class="ac-det-item"><span class="ac-det-lbl">Número</span><span class="ac-det-val">O.S. ${c.numero||c.id.slice(0,6)}</span></div>
      <div class="ac-det-item"><span class="ac-det-lbl">Data de abertura</span><span class="ac-det-val">${data}</span></div>
      <div class="ac-det-item"><span class="ac-det-lbl">Status</span><span>${badgeStatus}</span></div>
      <div class="ac-det-item"><span class="ac-det-lbl">Tipo</span><span>${badgeTipo}</span></div>
      ${c.solicitante_nome?`<div class="ac-det-item"><span class="ac-det-lbl">Solicitante</span><span class="ac-det-val">${c.solicitante_nome}</span></div>`:''}
      ${c.solicitante_telefone?`<div class="ac-det-item"><span class="ac-det-lbl">Telefone</span><span class="ac-det-val">${c.solicitante_telefone}</span></div>`:''}
      ${c.solicitante_email?`<div class="ac-det-item"><span class="ac-det-lbl">E-mail</span><span class="ac-det-val">${c.solicitante_email}</span></div>`:''}
      ${isAssistencia&&c.prioridade?`<div class="ac-det-item"><span class="ac-det-lbl">Prioridade</span><span class="ac-det-val">${prioLabels[c.prioridade]||c.prioridade}</span></div>`:''}
      ${isAssistencia&&c.tecnico?`<div class="ac-det-item"><span class="ac-det-lbl">Técnico</span><span class="ac-det-val">${c.tecnico}</span></div>`:''}
      ${itensSuprimentoHtml}
      ${!isAssistencia&&c.contador_atual!=null?`<div class="ac-det-item"><span class="ac-det-lbl">Contador PB</span><span class="ac-det-val">${c.contador_atual}</span></div>`:''}
      ${!isAssistencia&&c.contador_color_atual!=null?`<div class="ac-det-item"><span class="ac-det-lbl">Contador Colorido</span><span class="ac-det-val">${c.contador_color_atual}</span></div>`:''}
      ${isAssistencia&&(c.descricao||c.titulo)?`<div class="ac-det-item ac-det-full"><span class="ac-det-lbl">Descrição</span><span class="ac-det-val">${(c.descricao||c.titulo).replace(/\n/g,'<br>')}</span></div>`:''}
      ${isAssistencia&&encerrado&&c.resolucao?`<div class="ac-det-item ac-det-full ac-det-resolucao"><span class="ac-det-lbl">Resolução do Técnico</span><span class="ac-det-val">${c.resolucao.replace(/\n/g,'<br>')}</span></div>`:''}
      ${pecasModalHtml}
      ${c.data_fechamento?`<div class="ac-det-item"><span class="ac-det-lbl">Data de fechamento</span><span class="ac-det-val">${fmtD(c.data_fechamento)}</span></div>`:''}
    </div>`;
  document.getElementById('ac-detalhe-btn-os').onclick=()=>imprimirOS(c);
  document.getElementById('ac-detalhe-modal').classList.add('open');
}

function acFecharDetalhe(){
  document.getElementById('ac-detalhe-modal').classList.remove('open');
}

function imprimirOS(c){
  const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'–';
  const fmtD=v=>v?new Date(v).toLocaleDateString('pt-BR'):'–';
  const statusLabels={aberto:'Aberto',andamento:'Em andamento',encerrado:'Encerrado',concluido:'Concluído',resolvido:'Resolvido'};
  const prioLabels={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const isAssistencia=c._tipo!=='suprimento';
  const tipoLabel=isAssistencia?'Assistência Técnica':'Suprimentos';
  const encerrado=['encerrado','concluido','resolvido'].includes(c.status);
  const num=c.numero||c.id.slice(0,6);

  const rows=[
    ['Número',`O.S. ${num}`],
    ['Data/Hora de Abertura',fmt(c.created_at)],
    ['Status',statusLabels[c.status]||c.status],
    ['Tipo de Chamado',tipoLabel],
    c.solicitante_nome&&['Solicitante',c.solicitante_nome],
    c.solicitante_telefone&&['Telefone do Solicitante',c.solicitante_telefone],
    c.solicitante_email&&['E-mail do Solicitante',c.solicitante_email],
    isAssistencia&&c.prioridade&&['Prioridade',prioLabels[c.prioridade]||c.prioridade],
    isAssistencia&&c.tecnico&&['Técnico Responsável',c.tecnico],
    !isAssistencia&&c.contador_atual!=null&&['Contador PB',String(c.contador_atual)],
    !isAssistencia&&c.contador_color_atual!=null&&['Contador Colorido',String(c.contador_color_atual)],
    c.data_fechamento&&['Data de Fechamento',fmtD(c.data_fechamento)],
  ].filter(Boolean);

  const rowsHTML=rows.map(([l,v])=>`<tr><th>${l}</th><td>${v}</td></tr>`).join('');
  const resolucaoEscapada=(c.resolucao||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const descEscapada=((c.descricao||c.titulo)||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>O.S. ${num} — Teffe Tecnologia</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;font-size:13px;color:#222;background:#fff;padding:32px;}
  .os-header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #E07820;padding-bottom:16px;margin-bottom:20px;}
  .os-header img{height:50px;display:block;}
  .os-header-text{margin-left:4px;}
  .os-header-text h1{font-size:18px;font-weight:900;color:#1A3F80;}
  .os-header-text p{font-size:12px;color:#555;margin-top:2px;}
  table.os-table{width:100%;border-collapse:collapse;margin-bottom:18px;}
  table.os-table th{width:210px;text-align:left;background:#f0f4fa;padding:7px 10px;font-weight:700;border:1px solid #dde3ee;color:#1A3F80;vertical-align:top;}
  table.os-table td{padding:7px 10px;border:1px solid #dde3ee;}
  .os-section{margin-bottom:16px;}
  .os-section-title{font-size:11px;font-weight:700;color:#E07820;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;border-bottom:1px solid #f0d0a0;padding-bottom:4px;}
  .os-text-block{border:1px solid #dde3ee;border-radius:4px;padding:10px 12px;min-height:60px;line-height:1.6;background:#fafbfd;white-space:pre-wrap;}
  .os-resolucao{width:100%;min-height:100px;border:1px solid #bbb;border-radius:4px;padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;resize:vertical;background:#fafbfd;color:#222;}
  .os-assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;}
  .os-assinatura{border-top:1px solid #888;padding-top:8px;text-align:center;font-size:12px;color:#555;}
  .os-footer{text-align:center;font-size:11px;color:#888;border-top:1px solid #dde3ee;padding-top:12px;margin-top:32px;}
  .os-btns{display:flex;gap:12px;justify-content:flex-end;margin-bottom:20px;}
  .os-btn{padding:8px 20px;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;}
  .os-btn-print{background:#1A3F80;color:#fff;}
  .os-btn-close{background:#eee;color:#333;}
  @media print{
    .os-btns{display:none!important;}
    body{padding:16px;}
    .os-resolucao{border:1px solid #888;background:#fff;resize:none;}
    @page{size:A4;margin:18mm 16mm;}
  }
</style>
</head>
<body>
<div class="os-btns">
  <button class="os-btn os-btn-close" onclick="window.close()">Fechar</button>
  <button class="os-btn os-btn-print" onclick="window.print()">Imprimir</button>
</div>
<div class="os-header">
  <img src="https://teffe.com.br/assets/images/logo-teffe.png" alt="Teffe Tecnologia"/>
  <div class="os-header-text">
    <h1>O.S. ${num}</h1>
    <p>Teffe Tecnologia — Suporte e Assistência Técnica</p>
  </div>
</div>
<div class="os-section">
  <div class="os-section-title">Dados do Chamado</div>
  <table class="os-table">${rowsHTML}</table>
</div>
${isAssistencia&&descEscapada?`<div class="os-section">
  <div class="os-section-title">Descrição do Problema</div>
  <div class="os-text-block">${descEscapada}</div>
</div>`:''}
${isAssistencia&&c._pecas&&c._pecas.length?`<div class="os-section">
  <div class="os-section-title">Peças Utilizadas</div>
  <table class="os-table os-table-pecas">
    <thead><tr><th style="width:120px">Código</th><th>Descrição</th><th style="width:70px;text-align:center">Qtd.</th></tr></thead>
    <tbody>${c._pecas.map(p=>`<tr><td>${(p.pecas&&p.pecas.codigo)||'–'}</td><td>${(p.pecas&&p.pecas.descricao)||'–'}</td><td style="text-align:center">${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td></tr>`).join('')}</tbody>
  </table>
</div>`:''}
${!isAssistencia&&c._itens&&c._itens.length?`<div class="os-section">
  <div class="os-section-title">Itens Solicitados</div>
  <table class="os-table os-table-pecas">
    <thead><tr><th>Insumo</th><th style="width:70px;text-align:center">Qtd.</th></tr></thead>
    <tbody>${c._itens.map(it=>{
      const nome=it._insumo?(it._insumo.codigo?'['+it._insumo.codigo+'] '+it._insumo.nome:it._insumo.nome):'–';
      return `<tr><td>${nome}</td><td style="text-align:center">${it.quantidade}</td></tr>`;
    }).join('')}</tbody>
  </table>
</div>`:''}
${isAssistencia?`<div class="os-section">
  <div class="os-section-title">Solução / Resolução do Técnico</div>
  <textarea class="os-resolucao" placeholder="Descreva a solução aplicada...">${resolucaoEscapada}</textarea>
</div>`:''}
<div class="os-assinaturas">
  <div class="os-assinatura">Assinatura do Técnico</div>
  <div class="os-assinatura">Assinatura do Cliente</div>
</div>
<div class="os-footer">Teffe Tecnologia — teffe.com.br — (14) 99828-9248</div>
</body>
<script>window.onload=function(){window.print();}<\/script>
</html>`;

  const w=window.open('','_blank','width=860,height=760');
  if(w){w.document.open();w.document.write(html);w.document.close();}
}

// ── EQUIPAMENTOS ──
async function carregarEquips(){
  const el=document.getElementById('lista-equip');
  if(!_cid){el.innerHTML='<div class="ac-empty">Nenhum equipamento.</div>';document.getElementById('n-equip').textContent='0';_equipsAC=[];return;}
  // Equipamentos agora são vinculados via contrato_equipamentos
  const {data:contratos}=await sf('/rest/v1/contratos?cliente_id=eq.'+_cid+'&status=eq.ativo&select=id');
  if(!contratos||!contratos.length){
    el.innerHTML='<div class="ac-empty">Nenhum contrato ativo.</div>';
    document.getElementById('n-equip').textContent='0';
    _equipsAC=[];
    return;
  }
  const contratoIds=contratos.map(function(c){return c.id;}).join(',');
  const {data:vinculos}=await sf('/rest/v1/contrato_equipamentos?contrato_id=in.('+contratoIds+')&select=*,equipamentos(*)');
  const rows=(vinculos||[]).map(function(v){return v.equipamentos;}).filter(Boolean);
  _equipsAC=rows;
  document.getElementById('n-equip').textContent=rows.length;
  if(!rows.length){el.innerHTML='<div class="ac-empty">Nenhum equipamento vinculado.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Modelo</th><th>Marca</th><th>Série</th><th>Código Teffe</th><th>Local</th><th>Status</th></tr></thead><tbody>'+
    rows.map(r=>`<tr>
      <td><b>${r.modelo||'–'}</b></td>
      <td>${r.marca||'–'}</td>
      <td>${r.serial||'–'}</td>
      <td>${r.codigo_teffe||'–'}</td>
      <td>${r.localizacao||'–'}</td>
      <td><span class="badge badge-ativo-c">${r.status||'disponivel'}</span></td>
    </tr>`).join('')+
    '</tbody></table>';
}

// ── CONTRATOS ──
async function carregarContratos(){
  const el=document.getElementById('lista-cont');
  if(!_cid){el.innerHTML='<div class="ac-empty">Nenhum contrato.</div>';document.getElementById('n-cont').textContent='0';return;}
  const {data:rows}=await sf('/rest/v1/contratos?cliente_id=eq.'+_cid+'&select=*');
  document.getElementById('n-cont').textContent=rows?rows.filter(r=>r.status==='ativo').length:0;
  if(!rows||!rows.length){el.innerHTML='<div class="ac-empty">Nenhum contrato.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Nº</th><th>Descrição</th><th>Vigência</th><th>Valor</th><th>Status</th></tr></thead><tbody>'+
    rows.map(r=>`<tr>
      <td><b>${r.numero||'–'}</b></td>
      <td>${r.descricao||'–'}</td>
      <td>${r.data_inicio?new Date(r.data_inicio).toLocaleDateString('pt-BR'):'–'} → ${r.data_fim?new Date(r.data_fim).toLocaleDateString('pt-BR'):'–'}</td>
      <td>${r.valor_mensal?'R$ '+Number(r.valor_mensal).toLocaleString('pt-BR',{minimumFractionDigits:2}):'–'}</td>
      <td><span class="badge badge-ativo-c">${r.status||'–'}</span></td>
    </tr>`).join('')+
    '</tbody></table>';
}

// ── BUSCAR EQUIPAMENTO POR SERIAL / CÓDIGO (fallback quando não encontrado no autocomplete) ──
async function buscarEquipAC(prefix){
  const raw=document.getElementById(prefix+'-serial').value.trim().toUpperCase();
  const infoEl=document.getElementById(prefix+'-equip-info');
  if(!raw){alert('Informe o serial ou código do equipamento.');return;}
  // Busca primeiro no cache _equipsAC (equipamentos já carregados do contrato)
  const codigoRaw=raw.startsWith('TEFFE-')?raw.slice(6):raw;
  let eq=_equipsAC.find(function(e){
    return (e.serial||'').toUpperCase()===raw||
           (e.codigo_teffe||'').toUpperCase()===codigoRaw||
           (e.codigo_teffe||'').toUpperCase()===raw;
  });
  if(!eq){
    infoEl.style.display='block';
    infoEl.className='ac-equip-info ac-equip-not-found';
    infoEl.innerHTML='<i class="ti ti-alert-circle"></i> Equipamento não encontrado no contrato. Verifique o serial ou código Teffe.';
    if(prefix==='at') _atEquipId=null;
    else{_spEquipId=null;document.getElementById('sp-insumo').innerHTML='<option value="">Equipamento não encontrado</option>';_spItens=[];spRenderItens();}
    return;
  }
  if(prefix==='at') _atEquipId=eq.id;
  else{_spEquipId=eq.id;_spTipoImpressao=eq.tipo_impressao||'monocromatico';carregarInsumos(eq.modelo);spAtualizarContadores();_spItens=[];spRenderItens();}
  infoEl.style.display='block';
  infoEl.className='ac-equip-info ac-equip-found';
  infoEl.innerHTML=`<div class="ac-equip-found-grid">
    <div><span class="ac-equip-lbl">Modelo</span><span class="ac-equip-val">${eq.modelo||'–'}</span></div>
    <div><span class="ac-equip-lbl">Marca</span><span class="ac-equip-val">${eq.marca||'–'}</span></div>
    <div><span class="ac-equip-lbl">Série</span><span class="ac-equip-val">${eq.serial||'–'}</span></div>
    <div><span class="ac-equip-lbl">Teffe</span><span class="ac-equip-val">${eq.codigo_teffe||'–'}</span></div>
  </div>`;
}

function spAtualizarContadores(){
  const colorEl=document.getElementById('sp-campo-color');
  if(colorEl) colorEl.style.display=_spTipoImpressao==='colorido'?'block':'none';
}

// ── CARREGAR INSUMOS VINCULADOS AO MODELO DO EQUIPAMENTO ──
// Vínculo é por MODELO (texto), não por equipamento_id individual, para que
// uma única associação cubra todas as unidades do mesmo modelo.
async function carregarInsumos(modelo){
  const sel=document.getElementById('sp-insumo');
  sel.innerHTML='<option value="">Carregando...</option>';
  if(!modelo){sel.innerHTML='<option value="">Selecione o equipamento primeiro</option>';return;}

  const {data:links}=await sf('/rest/v1/equipamento_insumos?modelo=eq.'+encodeURIComponent(modelo)+'&select=id,insumo_id,cor');
  if(!links||!links.length){
    sel.innerHTML='<option value="">Nenhum insumo cadastrado para este modelo — contate o suporte</option>';
    return;
  }

  const insumoIds=links.map(l=>l.insumo_id).filter(Boolean);
  const {data:insumos}=await sf('/rest/v1/insumos?id=in.('+insumoIds.join(',')+')'+'&select=id,nome,codigo,tipo');
  if(!insumos||!insumos.length){
    sel.innerHTML='<option value="">Nenhum insumo cadastrado para este modelo — contate o suporte</option>';
    return;
  }

  const insumoMap={};
  insumos.forEach(i=>{insumoMap[i.id]=i;});

  sel.innerHTML='<option value="">Selecione o insumo</option>'+
    links.map(l=>{
      const i=insumoMap[l.insumo_id]||{};
      const label=(i.codigo?'['+i.codigo+'] ':'')+i.nome+(l.cor?' — '+l.cor:'');
      return`<option value="${l.insumo_id}">${label}</option>`;
    }).join('');
}

// ── CARRINHO DE ITENS DA SOLICITAÇÃO DE SUPRIMENTO ──
// Suporta pedir vários insumos (ex.: toner black+magenta+cyan+yellow) numa
// única solicitação. Cada item vira uma linha em solicitacoes_suprimento,
// todas com o mesmo "numero" — ver enviarSuprimento().
function spAdicionarItem(){
  const selEl=document.getElementById('sp-insumo');
  const insumoId=selEl.value;
  const qtd=parseInt(document.getElementById('sp-qtd').value);
  if(!insumoId){alert('Selecione o insumo.');return;}
  if(!qtd||qtd<1){alert('Informe a quantidade.');return;}

  const opt=selEl.options[selEl.selectedIndex];
  const label=opt?opt.textContent:insumoId;

  const existente=_spItens.find(it=>it.insumo_id===insumoId);
  if(existente) existente.quantidade+=qtd;
  else _spItens.push({insumo_id:insumoId,label:label,quantidade:qtd});

  document.getElementById('sp-qtd').value='1';
  spRenderItens();
}

function spRemoverItem(insumoId){
  _spItens=_spItens.filter(it=>it.insumo_id!==insumoId);
  spRenderItens();
}

function spRenderItens(){
  const wrap=document.getElementById('sp-itens-wrap');
  const lista=document.getElementById('sp-itens-lista');
  const btnEnviar=document.getElementById('sp-btn-enviar');
  if(!_spItens.length){
    wrap.style.display='none';
    lista.innerHTML='';
    if(btnEnviar) btnEnviar.disabled=true;
    return;
  }
  wrap.style.display='block';
  if(btnEnviar) btnEnviar.disabled=false;
  lista.innerHTML=_spItens.map(it=>
    `<li class="sp-item-row"><span>${it.label} — Qtd: ${it.quantidade}</span><button type="button" class="sp-item-remove" onclick="spRemoverItem('${it.insumo_id}')">✕</button></li>`
  ).join('');
}

// ── VALIDAR CONTADOR ──
async function validarContador(){
  if(!_spEquipId) return;
  const val=parseInt(document.getElementById('sp-contador-pb').value);
  const erroEl=document.getElementById('sp-contador-erro');
  const inputEl=document.getElementById('sp-contador-pb');
  if(isNaN(val)){erroEl.style.display='none';inputEl.style.borderColor='';return;}
  const {data}=await sf('/rest/v1/solicitacoes_suprimento?equipamento_id=eq.'+_spEquipId+'&order=created_at.desc&limit=1&select=contador_atual');
  const ultimo=data&&data[0]?data[0].contador_atual:null;
  _spUltimoContador=ultimo;
  if(ultimo!==null&&val<ultimo){
    erroEl.style.display='block';
    erroEl.textContent='Contador inválido: o valor informado ('+val+') é menor que o último registrado ('+ultimo+').';
    inputEl.style.borderColor='#e53e3e';
  } else {
    erroEl.style.display='none';
    inputEl.style.borderColor='';
  }
}

// ── ENVIAR ASSISTÊNCIA TÉCNICA ──
async function enviarAssistencia(){
  if(!_cid){alert('Sessão inválida.');return;}
  if(!_atEquipId){alert('Busque e selecione um equipamento antes de abrir o chamado.');return;}
  const nome=document.getElementById('at-nome').value.trim();
  const tel=document.getElementById('at-tel').value.trim();
  const email=document.getElementById('at-email').value.trim();
  const desc=document.getElementById('at-desc').value.trim();
  const obsCliente=document.getElementById('at-obs-cliente').value.trim();
  if(!nome){alert('Informe o nome do solicitante.');return;}
  if(!desc){alert('Descreva o defeito.');return;}

  let imgUrl=null;
  const imgFile=document.getElementById('at-img').files[0];
  if(imgFile){
    const ext=imgFile.name.split('.').pop();
    const fname=Date.now()+'.'+ext;
    const upRes=await fetch(SURL+'/storage/v1/object/chamados/'+fname,{
      method:'POST',
      headers:{'apikey':SKEY,'Authorization':'Bearer '+_tok,'Content-Type':imgFile.type,'x-upsert':'true'},
      body:imgFile
    }).catch(()=>null);
    if(upRes&&upRes.ok) imgUrl=SURL+'/storage/v1/object/public/chamados/'+fname;
  }

  const {ok,data:errData}=await sf('/rest/v1/chamados',{
    method:'POST',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({
      cliente_id:_cid,
      equipamento_id:_atEquipId,
      titulo:'Assistência – '+desc.slice(0,60),
      descricao:desc,
      observacoes_cliente:obsCliente||null,
      tipo_chamado:'assistencia',
      solicitante_nome:nome,
      solicitante_telefone:tel,
      solicitante_email:email,
      imagem_url:imgUrl,
      status:'aberto',
      prioridade:'normal'
    })
  });
  if(!ok){
    const msg=errData&&errData.message?errData.message:JSON.stringify(errData);
    alert('Erro ao abrir chamado:\n'+msg);
    return;
  }

  ['at-nome','at-tel','at-email','at-desc','at-obs-cliente','at-serial'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('at-img').value='';
  document.getElementById('at-file-text').textContent='Clique para selecionar uma imagem';
  document.getElementById('at-equip-info').style.display='none';
  _atEquipId=null;
  carregarChamados();
  acMostrarView('dash');
  document.getElementById('ac-chamado-ok').classList.add('open');
}

// ── ENVIAR SUPRIMENTO ──
async function enviarSuprimento(){
  if(!_cid){alert('Sessão inválida.');return;}
  if(!_spEquipId){alert('Busque e selecione um equipamento antes de abrir o chamado.');return;}
  if(!_spItens.length){alert('Adicione ao menos um insumo à lista.');return;}
  const nome=document.getElementById('sp-nome').value.trim();
  const tel=document.getElementById('sp-tel').value.trim();
  const email=document.getElementById('sp-email').value.trim();
  const contadorPb=parseInt(document.getElementById('sp-contador-pb').value);
  const contadorColor=_spTipoImpressao==='colorido'?parseInt(document.getElementById('sp-contador-color').value):null;
  if(!nome){alert('Informe o nome do solicitante.');return;}
  if(isNaN(contadorPb)){alert('Informe o contador PB.');return;}
  if(_spTipoImpressao==='colorido'&&(contadorColor==null||isNaN(contadorColor))){alert('Informe o contador Colorido.');return;}
  if(_spUltimoContador!==null&&contadorPb<_spUltimoContador){
    alert('Contador PB inválido: o valor informado é menor que o último registrado ('+_spUltimoContador+').');
    return;
  }

  const btn=document.getElementById('sp-btn-enviar');
  if(btn){btn.disabled=true;btn.textContent='Enviando...';}

  const base={
    cliente_id:_cid,
    equipamento_id:_spEquipId,
    contador_atual:contadorPb,
    solicitante_nome:nome,
    solicitante_telefone:tel,
    solicitante_email:email,
    status:'aberto'
  };
  if(contadorColor!=null) base.contador_color_atual=contadorColor;

  // Cada item do carrinho vira uma linha própria em solicitacoes_suprimento,
  // todas com o mesmo "numero" — o número é gerado pelo banco na primeira
  // linha e reaproveitado explicitamente nas demais (por isso os inserts são
  // sequenciais, não em paralelo: a 2ª linha em diante precisa saber o
  // número que a 1ª recebeu).
  let numeroCompartilhado=null;
  let erroMsg=null;
  for(const item of _spItens){
    const payload=Object.assign({},base,{insumo_id:item.insumo_id,quantidade:item.quantidade});
    if(numeroCompartilhado!=null) payload.numero=numeroCompartilhado;

    const r=await sf('/rest/v1/solicitacoes_suprimento',{
      method:'POST',
      headers:{'Prefer':'return=representation'},
      body:JSON.stringify(payload)
    });
    if(!r.ok){
      erroMsg=(r.data&&r.data.message)?r.data.message:JSON.stringify(r.data);
      break;
    }
    if(numeroCompartilhado==null && Array.isArray(r.data) && r.data[0]) numeroCompartilhado=r.data[0].numero;
  }

  if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-send"></i> Enviar Solicitação';}

  if(erroMsg){
    alert('Erro ao abrir solicitação:\n'+erroMsg);
    return;
  }

  ['sp-nome','sp-tel','sp-email','sp-serial'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('sp-qtd').value='1';
  document.getElementById('sp-contador-pb').value='';
  document.getElementById('sp-contador-pb').style.borderColor='';
  document.getElementById('sp-contador-erro').style.display='none';
  const ccEl=document.getElementById('sp-contador-color');
  if(ccEl) ccEl.value='';
  const sfEl=document.getElementById('sp-campo-color');
  if(sfEl) sfEl.style.display='none';
  document.getElementById('sp-equip-info').style.display='none';
  document.getElementById('sp-insumo').innerHTML='<option value="">Busque o equipamento primeiro</option>';
  _spEquipId=null;_spUltimoContador=null;_spTipoImpressao='monocromatico';
  _spItens=[];spRenderItens();
  carregarChamados();
  acMostrarView('dash');
  document.getElementById('ac-chamado-ok').classList.add('open');
}

// ── MODAL SUCESSO ──
function acFecharSucesso(){
  document.getElementById('ac-chamado-ok').classList.remove('open');
}

// ── ARQUIVO SELECIONADO ──
function acMostrarArquivo(textId,input){
  if(input.files&&input.files[0]) document.getElementById(textId).textContent=input.files[0].name;
}

// ── ÍCONE DE OLHO EM CAMPOS DE SENHA ──
function initPasswordToggles(){
  document.querySelectorAll('input[type="password"]').forEach(function(inp){
    if(inp.dataset.pwdInit) return;
    inp.dataset.pwdInit='1';
    const wrap=document.createElement('div');
    wrap.className='pwd-wrap';
    inp.parentNode.insertBefore(wrap,inp);
    wrap.appendChild(inp);
    inp.style.paddingRight='42px';
    const btn=document.createElement('button');
    btn.type='button';btn.className='pwd-eye';btn.tabIndex=-1;
    btn.setAttribute('aria-label','Mostrar/ocultar senha');
    btn.innerHTML='<i class="ti ti-eye"></i>';
    btn.addEventListener('click',function(){
      const show=inp.type==='password';
      inp.type=show?'text':'password';
      btn.innerHTML=show?'<i class="ti ti-eye-off"></i>':'<i class="ti ti-eye"></i>';
    });
    wrap.appendChild(btn);
  });
}

// ── AUTOCOMPLETE DE EQUIPAMENTOS ──
function equipAcRenderList(p,equips){
  const list=document.getElementById(p+'-ac-list');
  if(!list) return;
  if(!equips||!equips.length){
    list.innerHTML='<div class="ac-equip-ac-empty">Nenhum equipamento encontrado.</div>';
    return;
  }
  list.innerHTML=equips.map(function(e){
    const nome=[e.marca,e.modelo].filter(Boolean).join(' ')||'Equipamento';
    const sub=[e.codigo_teffe&&'Teffe: '+e.codigo_teffe,e.serial&&'Série: '+e.serial].filter(Boolean).join(' · ');
    return '<div class="ac-equip-ac-item" data-id="'+e.id+'" data-p="'+p+'">'+
      '<span class="ac-equip-ac-nome">'+nome+'</span>'+
      (sub?'<span class="ac-equip-ac-sub">'+sub+'</span>':'')+
      '</div>';
  }).join('');
  list.querySelectorAll('.ac-equip-ac-item').forEach(function(item){
    item.addEventListener('mousedown',function(e){
      e.preventDefault();
      const eq=_equipsAC.find(function(x){return x.id===item.dataset.id;});
      if(eq) equipAcSelecionar(item.dataset.p,eq);
    });
  });
}
function equipAcAbrir(p){
  const list=document.getElementById(p+'-ac-list');
  if(!list) return;
  const q=document.getElementById(p+'-serial').value.trim().toLowerCase();
  const filtrados=q?_equipsAC.filter(function(e){
    return (e.serial&&e.serial.toLowerCase().includes(q))||
           (e.codigo_teffe&&e.codigo_teffe.toLowerCase().includes(q))||
           (e.modelo&&e.modelo.toLowerCase().includes(q))||
           (e.marca&&e.marca.toLowerCase().includes(q));
  }):_equipsAC;
  equipAcRenderList(p,filtrados);
  list.style.display='block';
  const arrow=document.getElementById(p+'-ac-arrow');
  if(arrow) arrow.className='ti ti-chevron-up';
}
function equipAcFiltrar(p){
  // Limpa seleção anterior se o usuário voltou a digitar
  if(p==='at'){_atEquipId=null;}else{_spEquipId=null;}
  const infoEl=document.getElementById(p+'-equip-info');
  if(infoEl) infoEl.style.display='none';
  equipAcAbrir(p);
}
function equipAcToggle(p){
  const list=document.getElementById(p+'-ac-list');
  if(!list) return;
  if(list.style.display==='block'){
    list.style.display='none';
    const arrow=document.getElementById(p+'-ac-arrow');
    if(arrow) arrow.className='ti ti-chevron-down';
  } else {
    document.getElementById(p+'-serial').focus();
    equipAcAbrir(p);
  }
}
function equipAcBlur(p){
  setTimeout(function(){
    const list=document.getElementById(p+'-ac-list');
    if(list) list.style.display='none';
    const arrow=document.getElementById(p+'-ac-arrow');
    if(arrow) arrow.className='ti ti-chevron-down';
    // Fallback: se digitou algo manualmente sem selecionar do dropdown, tenta buscar
    const val=(document.getElementById(p+'-serial').value||'').trim();
    const jaEncontrado=p==='at'?!!_atEquipId:!!_spEquipId;
    if(val&&!jaEncontrado) buscarEquipAC(p);
  },160);
}
function equipAcSelecionar(p,eq){
  const label=[eq.marca,eq.modelo].filter(Boolean).join(' ')||eq.serial||eq.codigo||'Equipamento';
  document.getElementById(p+'-serial').value=eq.serial||eq.codigo||label;
  const list=document.getElementById(p+'-ac-list');
  if(list) list.style.display='none';
  const arrow=document.getElementById(p+'-ac-arrow');
  if(arrow) arrow.className='ti ti-chevron-down';
  if(p==='at') _atEquipId=eq.id;
  else{_spEquipId=eq.id;_spTipoImpressao=eq.tipo_impressao||'monocromatico';carregarInsumos(eq.modelo);spAtualizarContadores();_spItens=[];spRenderItens();}
  const infoEl=document.getElementById(p+'-equip-info');
  if(infoEl){
    infoEl.style.display='block';
    infoEl.className='ac-equip-info ac-equip-found';
    infoEl.innerHTML='<div class="ac-equip-found-grid">'+
      '<div><span class="ac-equip-lbl">Modelo</span><span class="ac-equip-val">'+(eq.modelo||'–')+'</span></div>'+
      '<div><span class="ac-equip-lbl">Marca</span><span class="ac-equip-val">'+(eq.marca||'–')+'</span></div>'+
      '<div><span class="ac-equip-lbl">Série</span><span class="ac-equip-val">'+(eq.serial||'–')+'</span></div>'+
      '<div><span class="ac-equip-lbl">Teffe</span><span class="ac-equip-val">'+(eq.codigo_teffe||'–')+'</span></div>'+
      '</div>';
  }
}

window.addEventListener('DOMContentLoaded',function(){
  const t=localStorage.getItem('tt'),u=localStorage.getItem('tu');
  if(t&&u){_tok=t;_uid=u;_email=localStorage.getItem('te')||null;} // Restaura tokens mas NÃO abre área do cliente automaticamente
  initPasswordToggles();
});

// ═══════════════════════════════════════════════════
//  PORTAL DO TÉCNICO
// ═══════════════════════════════════════════════════

let _tecTok=null,_tecUid=null,_tecId=null,_tecNome='';
let _tecChamadoAtual=null,_tecChamadosData={},_tecPecasCatalogo=null;
const TEC_SLA_MAP={corretiva:480,assistencia:480,instalacao:480,desinstalacao:480,troca_pecas:480,troca_de_pecas:480,manutencao:1440,manutencao_preventiva:1440,vistoria:1440,visita_tecnica:1440};

async function sfTec(path,opts){
  const h={'apikey':SKEY,'Content-Type':'application/json'};
  if(_tecTok) h['Authorization']='Bearer '+_tecTok;
  const r=await fetch(SURL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  let data=null;try{data=await r.json();}catch(e){}
  return {data,ok:r.ok,status:r.status};
}

// ── INIT / LOGIN / LOGOUT ──
async function tecInit(){
  const tok=localStorage.getItem('tec_tok'),uid=localStorage.getItem('tec_uid');
  const id=localStorage.getItem('tec_id'),nome=localStorage.getItem('tec_nome');
  if(tok&&uid&&id&&nome){
    _tecTok=tok;_tecUid=uid;_tecId=id;_tecNome=nome;
    document.getElementById('tec-nome-display').textContent=_tecNome;
    document.documentElement.classList.add('no-scroll','mia-oculta');
    if(typeof miaFecharChat==='function') miaFecharChat();
    document.getElementById('portal-tecnico').style.display='block';
    history.replaceState(null,'','#portaltecnico');
    await tecCarregarChamados();
  } else {
    document.getElementById('tec-login-bg').classList.add('open');
    history.replaceState(null,'','#portaltecnico');
  }
}

async function tecFazerLogin(){
  const email=document.getElementById('tec-email').value.trim();
  const senha=document.getElementById('tec-senha').value;
  const erroEl=document.getElementById('tec-login-erro');
  const btn=document.getElementById('tec-btn-entrar');
  if(!email||!senha){erroEl.style.display='block';erroEl.textContent='Preencha e-mail e senha.';return;}
  btn.textContent='Verificando...';btn.disabled=true;erroEl.style.display='none';
  const r=await fetch(SURL+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{'apikey':SKEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password:senha})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    erroEl.style.display='block';erroEl.textContent='E-mail ou senha incorretos.';
    btn.textContent='Entrar →';btn.disabled=false;return;
  }
  _tecTok=d.access_token;_tecUid=d.user.id;
  const {data:prof}=await sfTec('/rest/v1/profiles?id=eq.'+_tecUid+'&select=role&limit=1');
  if(!prof||!prof[0]||prof[0].role!=='tecnico'){
    _tecTok=null;_tecUid=null;
    erroEl.style.display='block';erroEl.textContent='Acesso negado. Este perfil não é técnico.';
    btn.textContent='Entrar →';btn.disabled=false;return;
  }
  const {data:tecs}=await sfTec('/rest/v1/tecnicos?user_id=eq.'+_tecUid+'&select=id,nome&limit=1');
  if(!tecs||!tecs[0]){
    _tecTok=null;_tecUid=null;
    erroEl.style.display='block';erroEl.textContent='Técnico não encontrado no sistema.';
    btn.textContent='Entrar →';btn.disabled=false;return;
  }
  _tecId=tecs[0].id;_tecNome=tecs[0].nome;
  localStorage.setItem('tec_tok',_tecTok);localStorage.setItem('tec_uid',_tecUid);
  localStorage.setItem('tec_id',_tecId);localStorage.setItem('tec_nome',_tecNome);
  btn.textContent='Entrar →';btn.disabled=false;
  document.getElementById('tec-login-bg').classList.remove('open');
  document.getElementById('tec-nome-display').textContent=_tecNome;
  document.getElementById('tec-email').value='';document.getElementById('tec-senha').value='';
  document.documentElement.classList.add('no-scroll','mia-oculta');
  if(typeof miaFecharChat==='function') miaFecharChat();
  document.getElementById('portal-tecnico').style.display='block';
  history.replaceState(null,'','#portaltecnico');
  await tecCarregarChamados();
}

function tecFecharLogin(){
  document.getElementById('tec-login-bg').classList.remove('open');
  history.replaceState(null,'',location.pathname);
}

function tecFazerLogout(){
  _tecTok=null;_tecUid=null;_tecId=null;_tecNome='';_tecChamadoAtual=null;_tecChamadosData={};
  ['tec_tok','tec_uid','tec_id','tec_nome'].forEach(k=>localStorage.removeItem(k));
  document.documentElement.classList.remove('no-scroll','mia-oculta');
  document.getElementById('portal-tecnico').style.display='none';
  window.location.href='https://teffe.com.br';
}

// ── HELPER: enriquece array de chamados com dados do cliente ──
async function _tecEnriquecerClientes(chamados){
  if(!chamados||!chamados.length) return;
  try{
    const ids=[...new Set(chamados.map(c=>c.cliente_id).filter(Boolean))];
    if(!ids.length) return;
    const {data:clis,ok}=await sfTec('/rest/v1/clientes?id=in.('+ids.join(',')+')'+'&select=id,razao_social,fantasia,cidade,endereco,numero,complemento,bairro,estado,cep,codigo');
    if(!ok||!Array.isArray(clis)) return;
    const map={};
    clis.forEach(cli=>{
      map[cli.id]={
        empresa:cli.razao_social||cli.fantasia||null,nome:cli.razao_social||null,cidade:cli.cidade||null,codigo:cli.codigo||null,
        endereco:cli.endereco||null,numero:cli.numero||null,complemento:cli.complemento||null,bairro:cli.bairro||null,estado:cli.estado||null,cep:cli.cep||null
      };
    });
    chamados.forEach(c=>{c.clientes=map[c.cliente_id]||null;});
  }catch(e){console.warn('[_tecEnriquecerClientes]',e);}
}

// Monta o endereço completo do cliente numa única linha (usada nos modais de
// detalhe do chamado, portal do técnico).
function _tecEnderecoCompleto(cli){
  if(!cli) return null;
  const partes=[];
  if(cli.endereco) partes.push(cli.endereco+(cli.numero?', '+cli.numero:''));
  if(cli.complemento) partes.push(cli.complemento);
  if(cli.bairro) partes.push(cli.bairro);
  if(cli.cidade) partes.push(cli.cidade+(cli.estado?'/'+cli.estado:''));
  if(cli.cep) partes.push('CEP '+cli.cep);
  return partes.length?partes.join(' — '):null;
}

async function _tecEnriquecerEquipamentos(chamados){
  if(!chamados||!chamados.length) return;
  try{
    const ids=[...new Set(chamados.map(c=>c.equipamento_id).filter(Boolean))];
    if(!ids.length) return;
    const {data:equips}=await sfTec('/rest/v1/equipamentos?id=in.('+ids.join(',')+')'+'&select=id,serial,codigo_teffe,marca,modelo');
    const map={};
    (equips||[]).forEach(e=>{map[e.id]=e;});
    chamados.forEach(c=>{c.equipamento=map[c.equipamento_id]||null;});
  }catch(e){console.warn('[_tecEnriquecerEquipamentos]',e);}
}

// ── CHAMADOS ──
async function tecCarregarChamados(){
  if(!_tecId) return;
  const el=document.getElementById('tec-lista-chamados');
  el.innerHTML='<div class="tec-loading">Carregando chamados...</div>';
  const {data,ok,status:httpSt}=await sfTec('/rest/v1/chamados?tecnico_id=eq.'+_tecId+'&status=neq.encerrado&order=created_at.asc&select=*');
  if(!ok){el.innerHTML='<div class="tec-empty">Erro ao carregar chamados ('+httpSt+'). Verifique o console.</div>';return;}
  await Promise.all([_tecEnriquecerClientes(data||[]),_tecEnriquecerEquipamentos(data||[])]);
  _tecChamadosData={};
  (data||[]).forEach(c=>{_tecChamadosData[c.id]=c;});
  if(!data||!data.length){el.innerHTML='<div class="tec-empty">Nenhum chamado atribuído a você.</div>';}
  else el.innerHTML=data.map((c,i)=>tecRenderCard(c,i)).join('');
}

async function tecCarregarPecas(){
  if(!_tecId) return;
  const el=document.getElementById('tec-lista-pecas');
  if(!el) return;
  const {data,ok}=await sfTec('/rest/v1/chamados?tecnico_id=eq.'+_tecId+'&status_tecnico=eq.aguardando_peca&order=created_at.desc&select=*');
  const count=(ok&&data)?data.length:0;
  const tab=document.getElementById('tec-tab-pecas');
  if(tab) tab.textContent='Peças'+(count?' ('+count+')':'');
  if(!ok){el.innerHTML='<div class="tec-empty">Erro ao carregar.</div>';return;}
  if(!count){el.innerHTML='<div class="tec-empty">Nenhum chamado aguardando peças.</div>';return;}
  await _tecEnriquecerClientes(data);
  data.forEach(c=>{_tecChamadosData[c.id]=c;});
  const pecasLabel={solicitado:'Solicitado',faturado:'Faturado',despachado:'Despachado',entregue:'Itens Entregues'};
  el.innerHTML=data.map(c=>{
    const ps=c.pecas_status||'solicitado';
    const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||'–'):'–';
    const entregue=ps==='entregue';
    return `<div class="tec-card tec-card-aguardando_peca">
      <div class="tec-card-header">
        <span class="tec-card-num">O.S. ${c.numero||c.id.slice(0,6).toUpperCase()}</span>
        <span class="tec-pecas-badge tec-pecas-${ps}">${entregue?'✅ '+pecasLabel[ps]:pecasLabel[ps]||ps}</span>
      </div>
      <div class="tec-card-cliente">${cliente}</div>
      ${c.pecas_solicitadas?`<div class="tec-card-local" style="margin-top:4px;font-size:12px;color:#6B7280;">${c.pecas_solicitadas}</div>`:''}
      ${entregue?`<button class="tec-btn tec-btn-verde" style="margin-top:10px;width:100%;" onclick="tecReceberPecas('${c.id}')"><i class="ti ti-play"></i> Iniciar Atendimento</button>`:''}
    </div>`;
  }).join('');
}

// ── VIEWS DO TÉCNICO ──
function tecMostrarView(v){
  ['chamados','historico'].forEach(n=>{
    const view=document.getElementById('tec-view-'+n);
    const tab=document.getElementById('tec-tab-'+n);
    if(view) view.style.display=v===n?'':'none';
    if(tab) tab.classList.toggle('active',v===n);
  });
}

// ── HISTÓRICO DE EQUIPAMENTO ──
function tecHistLimpar(){
  document.getElementById('tec-hist-equip-info').style.display='none';
  document.getElementById('tec-hist-resultado').innerHTML='';
  document.getElementById('tec-hist-paginacao').style.display='none';
  _tecHistData=[];_tecHistPage=0;_tecHistEquip=null;
}

async function tecHistBuscar(){
  const raw=document.getElementById('tec-hist-serial').value.trim();
  if(!raw){alert('Digite o serial ou código Teffe do equipamento.');return;}
  tecHistLimpar();
  const resEl=document.getElementById('tec-hist-resultado');
  resEl.innerHTML='<div class="tec-loading">Buscando equipamento...</div>';
  const q=encodeURIComponent(raw);
  const {data:equips,ok}=await sfTec('/rest/v1/equipamentos?or=(serial.ilike.*'+q+'*,codigo_teffe.ilike.*'+q+'*)&select=id,serial,codigo_teffe,marca,modelo,localizacao,cliente_id&limit=1');
  if(!ok||!equips||!equips.length){
    resEl.innerHTML='<div class="tec-hist-empty">Equipamento não encontrado. Verifique o serial ou código Teffe digitado.</div>';
    return;
  }
  _tecHistEquip=equips[0];
  // Busca cliente separado (sem JOIN para evitar erro PostgREST)
  if(_tecHistEquip.cliente_id){
    const {data:cliD,ok:cliOk}=await sfTec('/rest/v1/clientes?id=eq.'+_tecHistEquip.cliente_id+'&select=razao_social,fantasia,cidade,endereco,numero,complemento,bairro,estado,cep,codigo&limit=1');
    _tecHistEquip._cliente=(cliOk&&cliD&&cliD[0])||null;
  }
  const cl=_tecHistEquip._cliente||{};
  const clienteNome=cl.razao_social||cl.fantasia||'–';
  const infoEl=document.getElementById('tec-hist-equip-info');
  infoEl.innerHTML=`<div class="he-title">Equipamento encontrado</div>
    <div class="he-grid">
      <div class="he-field"><b>Marca</b>${_tecHistEquip.marca||'–'}</div>
      <div class="he-field"><b>Modelo</b>${_tecHistEquip.modelo||'–'}</div>
      <div class="he-field"><b>Serial</b>${_tecHistEquip.serial||'–'}</div>
      <div class="he-field"><b>Código Teffe</b>${_tecHistEquip.codigo_teffe||'–'}</div>
      <div class="he-field"><b>Cliente atual</b>${clienteNome}${cl.codigo?' ('+cl.codigo+')':''}</div>
      ${cl.cidade?`<div class="he-field"><b>Cidade</b>${cl.cidade}</div>`:''}
      ${_tecEnderecoCompleto(cl)?`<div class="he-field"><b>Endereço</b>${_tecEnderecoCompleto(cl)}</div>`:''}
      ${_tecHistEquip.localizacao?`<div class="he-field"><b>Localização</b>${_tecHistEquip.localizacao}</div>`:''}
    </div>`;
  infoEl.style.display='block';
  resEl.innerHTML='';
  await tecHistCarregarChamados();
}

async function tecHistCarregarChamados(){
  if(!_tecHistEquip) return;
  const resEl=document.getElementById('tec-hist-resultado');
  resEl.innerHTML='<div class="tec-loading">Carregando histórico...</div>';
  const eqId=_tecHistEquip.id;
  const serial=_tecHistEquip.serial||'';
  console.log('[tecHistCarregarChamados] equipamento_id:', eqId, '| serial:', serial);
  // Busca por equipamento_id E por menção ao serial na descrição (OR)
  const orSerial=serial?',descricao.ilike.*'+encodeURIComponent(serial)+'*':'';
  const {data,ok}=await sfTec('/rest/v1/chamados?or=(equipamento_id.eq.'+eqId+orSerial+')&order=created_at.desc&select=*,observacoes_internas');
  console.log('[tecHistCarregarChamados] ok:', ok, '| chamados encontrados:', data&&data.length);
  if(!ok){resEl.innerHTML='<div class="tec-hist-empty">Erro ao carregar histórico.</div>';return;}
  // Deduplica por id (um chamado pode aparecer nas duas condições do OR)
  const seen=new Set();
  const dedup=(data||[]).filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
  console.log('[tecHistCarregarChamados] após deduplicação:', dedup.length);
  await _tecEnriquecerClientes(dedup);
  _tecHistData=dedup;
  _tecHistPage=0;
  tecHistRenderLista();
}

function tecHistRenderLista(){
  const resEl=document.getElementById('tec-hist-resultado');
  const pgEl=document.getElementById('tec-hist-paginacao');
  if(!_tecHistData.length){
    resEl.innerHTML='<div class="tec-hist-empty">Nenhum chamado encontrado para este equipamento.</div>';
    pgEl.style.display='none';return;
  }
  const total=_tecHistData.length;
  const totalPgs=Math.ceil(total/TEC_HIST_PG);
  const start=_tecHistPage*TEC_HIST_PG;
  const slice=_tecHistData.slice(start,start+TEC_HIST_PG);
  resEl.innerHTML='<div class="tec-cards-grid">'+slice.map((c,i)=>tecHistRenderCard(c,start+i)).join('')+'</div>';
  pgEl.style.display='flex';
  if(totalPgs>1){
    pgEl.innerHTML=`<button onclick="tecHistPagina(-1)" ${_tecHistPage===0?'disabled':''}>← Anterior</button>
      <span>Página ${_tecHistPage+1} de ${totalPgs} (${total} chamado${total!==1?'s':''})</span>
      <button onclick="tecHistPagina(1)" ${_tecHistPage>=totalPgs-1?'disabled':''}>Próxima →</button>`;
  }else{
    pgEl.innerHTML=`<span>${total} chamado${total!==1?'s':''} encontrado${total!==1?'s':''}</span>`;
  }
}

function tecHistRenderCard(c,idx){
  const st=c.status_tecnico||c.status||'aberto';
  const tipoRaw=c.tipo_servico||c.tipo_chamado||'';
  const tipo=_TEC_TIPO_MAP[tipoRaw]||tipoRaw||'–';
  const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||'–'):'–';
  const dt=c.created_at?new Date(c.created_at).toLocaleDateString('pt-BR'):'–';
  const brd='tec-tipo-brd-'+(tipoRaw||'assistencia');
  const num=c.numero||c.id.slice(0,6).toUpperCase();
  return `<div class="tec-card ${brd} tec-card-hist" onclick="tecHistAbrirDetalhe(${idx})">
    <div class="tec-card-inner">
      <div class="tec-card-body">
        <div class="tec-card-l1">
          <span class="tec-card-num">O.S. ${num}</span>
          <span class="tec-card-cliente-nome">${cliente}</span>
        </div>
        <div class="tec-card-l4" style="margin-top:4px">
          <span class="tec-tipo-badge tec-tipo-${tipoRaw||'assistencia'}">${tipo}</span>
          <span class="tec-badge-st tec-st-${st}">${tecStatusLabel(st)}</span>
          <span style="font-size:11px;color:#9CA3AF">${dt}</span>
        </div>
      </div>
      <div class="tec-card-r" style="justify-content:center">
        <span style="font-size:11px;color:#CBD5E1;font-weight:700">#${idx+1}</span>
      </div>
    </div>
  </div>`;
}

function tecHistPagina(d){
  const totalPgs=Math.ceil(_tecHistData.length/TEC_HIST_PG);
  _tecHistPage=Math.max(0,Math.min(totalPgs-1,_tecHistPage+d));
  tecHistRenderLista();
  document.getElementById('portal-tecnico').scrollTo({top:0,behavior:'smooth'});
}

async function tecHistAbrirDetalhe(idx){
  const c=_tecHistData[idx];
  if(!c) return;
  const st=c.status_tecnico||c.status||'aberto';
  const tipoMap={assistencia:'Assistência Técnica',instalacao:'Instalação',desinstalacao:'Desinstalação',vistoria:'Vistoria',visita_tecnica:'Visita Técnica'};
  const tipo=tipoMap[c.tipo_servico]||tipoMap[c.tipo_chamado]||c.tipo_servico||c.tipo_chamado||'–';
  const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||'–'):'–';
  const cidade=c.clientes?c.clientes.cidade||'–':'–';
  const enderecoCompleto=_tecEnderecoCompleto(c.clientes);
  const eq=_tecHistEquip; // todos os chamados desta lista são do mesmo equipamento pesquisado
  const equipamentoInfo=eq?[eq.marca,eq.modelo].filter(Boolean).join(' '):null;
  const prioMap={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const fmtDt=s=>s?new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'–';
  const [{data:pRows},{data:fotos}]=await Promise.all([
    sfTec('/rest/v1/chamado_pecas?chamado_id=eq.'+c.id+'&select=*,pecas(codigo,descricao,unidade)'),
    sfTec('/rest/v1/chamado_fotos?chamado_id=eq.'+c.id+'&order=created_at&select=id,url')
  ]);
  const pecas=pRows||[];
  const anexosImgs=[...(c.imagem_url?[{url:c.imagem_url,cliente:true}]:[]),...(fotos||[]).map(f=>({url:f.url,cliente:false}))];
  const anexosHtml=anexosImgs.length?`<div class="tec-fotos-section"><div class="tec-det-lbl-standalone">Anexos</div><div class="tec-fotos-grid">${anexosImgs.map(f=>`<a href="${f.url}" target="_blank" title="${f.cliente?'Foto enviada pelo cliente':'Foto do técnico'}"><img src="${f.url}" class="tec-foto-thumb" loading="lazy"/></a>`).join('')}</div></div>`:'';
  document.getElementById('tec-hist-modal-conteudo').innerHTML=`
    <div class="tec-modal-header">
      <h2>Chamado O.S. ${c.numero||c.id.slice(0,6).toUpperCase()}</h2>
      <span class="tec-badge-st tec-st-${st}">${tecStatusLabel(st)}</span>
    </div>
    <div class="tec-det-grid">
      <div class="tec-det-row"><span class="tec-det-lbl">Tipo</span><span class="tec-det-val">${tipo}</span></div>
      <div class="tec-det-row"><span class="tec-det-lbl">Cliente</span><span class="tec-det-val">${cliente}</span></div>
      <div class="tec-det-row"><span class="tec-det-lbl">Cidade</span><span class="tec-det-val">${cidade}</span></div>
      ${enderecoCompleto?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Endereço</span><span class="tec-det-val">${enderecoCompleto}</span></div>`:''}
      ${equipamentoInfo?`<div class="tec-det-row"><span class="tec-det-lbl">Equipamento</span><span class="tec-det-val">${equipamentoInfo}</span></div>`:''}
      ${eq&&eq.codigo_teffe?`<div class="tec-det-row"><span class="tec-det-lbl">Código Teffe</span><span class="tec-det-val">${eq.codigo_teffe}</span></div>`:''}
      ${eq&&eq.serial?`<div class="tec-det-row"><span class="tec-det-lbl">Número de Série</span><span class="tec-det-val">${eq.serial}</span></div>`:''}
      ${c.tecnico?`<div class="tec-det-row"><span class="tec-det-lbl">Técnico</span><span class="tec-det-val">${c.tecnico}</span></div>`:''}
      ${c.prioridade?`<div class="tec-det-row"><span class="tec-det-lbl">Prioridade</span><span class="tec-det-val">${prioMap[c.prioridade]||c.prioridade}</span></div>`:''}
      ${c.solicitante_nome?`<div class="tec-det-row"><span class="tec-det-lbl">Solicitante</span><span class="tec-det-val">${c.solicitante_nome}</span></div>`:''}
      ${c.created_at?`<div class="tec-det-row"><span class="tec-det-lbl">Aberto em</span><span class="tec-det-val">${fmtDt(c.created_at)}</span></div>`:''}
      ${c.data_encerramento?`<div class="tec-det-row"><span class="tec-det-lbl">Encerrado em</span><span class="tec-det-val">${fmtDt(c.data_encerramento)}</span></div>`:''}
      ${c.descricao?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Descrição</span><span class="tec-det-val">${c.descricao.replace(/\n/g,'<br>')}</span></div>`:''}
      ${c.observacoes_cliente?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Observações do Cliente</span><span class="tec-det-val">${c.observacoes_cliente.replace(/\n/g,'<br>')}</span></div>`:''}
      ${c.descricao_tecnico?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Defeito encontrado</span><span class="tec-det-val">${c.descricao_tecnico.replace(/\n/g,'<br>')}</span></div>`:''}
      ${c.resolucao?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Solução aplicada</span><span class="tec-det-val">${c.resolucao.replace(/\n/g,'<br>')}</span></div>`:''}
    </div>
    ${pecas.length?`<div class="tec-det-section" style="margin-top:16px;"><div class="tec-det-lbl-standalone">Peças utilizadas</div><table class="ac-table" style="margin-top:6px;"><thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${pecas.map(p=>`<tr><td>${(p.pecas&&p.pecas.codigo)||'–'}</td><td>${(p.pecas&&p.pecas.descricao)||'–'}</td><td>${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td></tr>`).join('')}</tbody></table></div>`:''}
    ${anexosHtml}
    ${c.observacoes_internas?`<div class="tec-fotos-section"><div class="tec-det-lbl-standalone" style="color:#92400E">⚠️ Observações Internas (uso interno)</div><div class="tec-obs-interna-box">${c.observacoes_internas.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div></div>`:''}
  `;
  document.getElementById('tec-hist-modal').classList.add('open');
}

function tecHistFecharDetalhe(){document.getElementById('tec-hist-modal').classList.remove('open');}

function tecStatusLabel(s){
  const l={aberto:'Despachado',despachado:'Despachado',em_deslocamento:'Em Deslocamento',em_atendimento:'Em Atendimento',aguardando_peca:'Aguard. Peça',pendente:'Pendente',encerrado:'Encerrado',andamento:'Em Andamento'};
  return l[s]||s||'–';
}

const _TEC_TIPO_MAP={assistencia:'Assistência Técnica',corretiva:'Corretiva',manutencao:'Manutenção',manutencao_preventiva:'Manut. Preventiva',instalacao:'Instalação',desinstalacao:'Desinstalação',vistoria:'Vistoria',visita_tecnica:'Visita Técnica',troca_pecas:'Troca de Peças',troca_de_pecas:'Troca de Peças'};

function _tecSlaDecorrido(c){
  if(!c.created_at) return{hhmm:'–',atrasado:false};
  const tipoRaw=c.tipo_servico||c.tipo_chamado||'';
  const slaMin=TEC_SLA_MAP[tipoRaw]||480;
  let pausado=c.sla_tempo_pausado||0;
  if(c.sla_pausado&&c.sla_pausa_inicio) pausado+=Math.floor((new Date()-new Date(c.sla_pausa_inicio))/60000);
  const dec=calcularSLAUtil(c.created_at,pausado);
  const h=Math.floor(dec/60),m=dec%60;
  return{hhmm:h+':'+String(m).padStart(2,'0'),atrasado:dec>slaMin};
}

function tecRenderCard(c,idx){
  const st=c.status_tecnico||c.status||'aberto';
  const tipoRaw=c.tipo_servico||c.tipo_chamado||'';
  const tipo=_TEC_TIPO_MAP[tipoRaw]||tipoRaw||'–';
  const cli=c.clientes||{};
  const cliente=cli.empresa||cli.nome||'–';
  const cidade=cli.cidade||'';
  const codCli=cli.codigo||'';
  const eq=c.equipamento||null;
  const num=c.numero||c.id.slice(0,6).toUpperCase();
  const sla=_tecSlaDecorrido(c);
  const brd='tec-tipo-brd-'+(tipoRaw||'assistencia');
  const l3parts=eq?[eq.codigo_teffe,eq.serial,[eq.marca,eq.modelo].filter(Boolean).join(' ')].filter(Boolean):[];
  const l3=l3parts.length?`<div class="tec-card-l3">${l3parts.join(' · ')}</div>`:'';
  return `<div class="tec-card ${brd}" onclick="tecAbrirDetalhe('${c.id}')">
    <div class="tec-card-inner">
      <div class="tec-card-body">
        <div class="tec-card-l1">
          <span class="tec-card-num">O.S. ${num}</span>
          <span class="tec-card-cliente-nome">${cliente}</span>
          ${codCli?`<span class="tec-card-cod">(${codCli})</span>`:''}
        </div>
        ${cidade?`<div class="tec-card-l2">📍 ${cidade}</div>`:''}
        ${l3}
        <div class="tec-card-l4">
          <span style="font-size:10px;color:#9CA3AF">O.S. ${num}</span>
          <span class="tec-tipo-badge tec-tipo-${tipoRaw||'assistencia'}">${tipo}</span>
          <span class="tec-badge-st tec-st-${st}">${tecStatusLabel(st)}</span>
        </div>
      </div>
      <div class="tec-card-r">
        <div class="tec-card-sla-val${sla.atrasado?' tec-sla-atrasado':''}">${sla.hhmm}</div>
        <div class="tec-card-sla-unit">${sla.atrasado?'hrs (atraso)':'hrs decorrido'}</div>
        <div class="tec-card-idx">#${(idx||0)+1}</div>
      </div>
    </div>
  </div>`;
}

// ── MODAL DO CHAMADO ──
async function tecAbrirDetalhe(id){
  const c=_tecChamadosData[id];
  if(!c) return;
  _tecChamadoAtual=c;
  const st=c.status_tecnico||c.status||'aberto';
  const tipoMap={assistencia:'Assistência Técnica',instalacao:'Instalação',desinstalacao:'Desinstalação',vistoria:'Vistoria',visita_tecnica:'Visita Técnica'};
  const tipo=tipoMap[c.tipo_servico]||tipoMap[c.tipo_chamado]||c.tipo_servico||c.tipo_chamado||'–';
  const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||'–'):'–';
  const cidade=c.clientes?c.clientes.cidade||'–':'–';
  const enderecoCompleto=_tecEnderecoCompleto(c.clientes);
  const eq=c.equipamento||null;
  const equipamentoInfo=eq?[eq.marca,eq.modelo].filter(Boolean).join(' '):null;
  const sla=tecFormatarSLA(c);
  const prioMap={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const [{data:fotos},{data:pRows}]=await Promise.all([
    sfTec('/rest/v1/chamado_fotos?chamado_id=eq.'+id+'&order=created_at&select=id,url'),
    sfTec('/rest/v1/chamado_pecas?chamado_id=eq.'+id+'&select=*,pecas(codigo,descricao,unidade)')
  ]);
  c._fotos=fotos||[];c._pecas=pRows||[];
  // Anexos: foto que o cliente já anexa ao abrir o chamado (chamados.imagem_url,
  // gravada há tempos mas nunca exibida em lugar nenhum) + fotos que o técnico
  // anexa durante o atendimento (tabela chamado_fotos). Sempre visível, não só
  // durante em_atendimento — o técnico pode precisar ver a foto do cliente antes
  // mesmo de chegar ao local.
  const anexosImgs=[...(c.imagem_url?[{url:c.imagem_url,cliente:true}]:[]),...c._fotos.map(f=>({url:f.url,cliente:false}))];
  const fotosHtml=`<div class="tec-fotos-section">
    <div class="tec-det-lbl-standalone">Anexos</div>
    ${anexosImgs.length?`<div id="tec-fotos-grid" class="tec-fotos-grid">${anexosImgs.map(f=>`<a href="${f.url}" target="_blank" title="${f.cliente?'Foto enviada pelo cliente':'Foto do técnico'}"><img src="${f.url}" class="tec-foto-thumb" loading="lazy"/></a>`).join('')}</div>`:'<div style="font-size:13px;color:#9CA3AF;margin:6px 0;">Nenhum anexo ainda.</div>'}
    <label class="tec-btn-foto">Anexar Foto <input type="file" accept="image/*" style="display:none;" onchange="tecAnexarFoto(this)"/></label>
  </div>`;
  const obsEscaped=(c.observacoes_internas||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  document.getElementById('tec-modal-conteudo').innerHTML=`
    <div class="tec-modal-header">
      <h2>Chamado O.S. ${c.numero||c.id.slice(0,6).toUpperCase()}</h2>
      <span class="tec-badge-st tec-st-${st}">${tecStatusLabel(st)}</span>
    </div>
    <div class="tec-modal-sla${sla.atrasado?' tec-sla-atrasado':''}">${sla.texto}</div>
    <div class="tec-det-grid">
      <div class="tec-det-row"><span class="tec-det-lbl">Tipo</span><span class="tec-det-val">${tipo}</span></div>
      <div class="tec-det-row"><span class="tec-det-lbl">Cliente</span><span class="tec-det-val">${cliente}</span></div>
      <div class="tec-det-row"><span class="tec-det-lbl">Cidade</span><span class="tec-det-val">${cidade}</span></div>
      ${enderecoCompleto?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Endereço</span><span class="tec-det-val">${enderecoCompleto}</span></div>`:''}
      ${equipamentoInfo?`<div class="tec-det-row"><span class="tec-det-lbl">Equipamento</span><span class="tec-det-val">${equipamentoInfo}</span></div>`:''}
      ${eq&&eq.codigo_teffe?`<div class="tec-det-row"><span class="tec-det-lbl">Código Teffe</span><span class="tec-det-val">${eq.codigo_teffe}</span></div>`:''}
      ${eq&&eq.serial?`<div class="tec-det-row"><span class="tec-det-lbl">Número de Série</span><span class="tec-det-val">${eq.serial}</span></div>`:''}
      ${c.solicitante_nome?`<div class="tec-det-row"><span class="tec-det-lbl">Solicitante</span><span class="tec-det-val">${c.solicitante_nome}</span></div>`:''}
      ${c.solicitante_telefone?`<div class="tec-det-row"><span class="tec-det-lbl">Telefone</span><span class="tec-det-val">${c.solicitante_telefone}</span></div>`:''}
      ${c.prioridade?`<div class="tec-det-row"><span class="tec-det-lbl">Prioridade</span><span class="tec-det-val">${prioMap[c.prioridade]||c.prioridade}</span></div>`:''}
      ${c.descricao?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Descrição</span><span class="tec-det-val">${c.descricao.replace(/\n/g,'<br>')}</span></div>`:''}
      ${c.observacoes_cliente?`<div class="tec-det-row tec-det-row-full"><span class="tec-det-lbl">Observações do Cliente</span><span class="tec-det-val">${c.observacoes_cliente.replace(/\n/g,'<br>')}</span></div>`:''}
    </div>
    ${c._pecas.length?`<div class="tec-det-section"><div class="tec-det-lbl-standalone">Peças utilizadas</div><table class="ac-table" style="margin-top:6px;"><thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>${c._pecas.map(p=>`<tr><td>${(p.pecas&&p.pecas.codigo)||'–'}</td><td>${(p.pecas&&p.pecas.descricao)||'–'}</td><td>${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td></tr>`).join('')}</tbody></table></div>`:''}
    ${fotosHtml}
    <div class="tec-fotos-section">
      <div class="tec-det-lbl-standalone" style="color:#92400E">⚠️ Observações Internas (uso interno)</div>
      <textarea id="tec-obs-interna-ta" class="ac-input" rows="3" style="margin-top:6px" placeholder="Anotações internas sobre este chamado — NÃO visível ao cliente...">${obsEscaped}</textarea>
      <button class="tec-btn tec-btn-cinza" id="tec-obs-interna-btn" style="margin-top:8px;font-size:12px;min-height:36px" onclick="tecSalvarObsInterna('${c.id}')"><i class="ti ti-device-floppy"></i> Salvar observação</button>
    </div>
  `;
  tecRenderAcoes(st);
  document.getElementById('tec-chamado-modal').classList.add('open');
}

function tecFecharDetalhe(){document.getElementById('tec-chamado-modal').classList.remove('open');}

async function tecSalvarObsInterna(id){
  const ta=document.getElementById('tec-obs-interna-ta');
  if(!ta) return;
  const val=ta.value.trim();
  const btn=document.getElementById('tec-obs-interna-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader"></i> Salvando...';}
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({observacoes_internas:val||null})});
  if(!ok){alert('Erro ao salvar observação.');if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> Salvar observação';}return;}
  if(_tecChamadosData[id]) _tecChamadosData[id].observacoes_internas=val||null;
  if(btn){btn.innerHTML='<i class="ti ti-check"></i> Salvo';setTimeout(()=>{btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> Salvar observação';},1800);}
}

function tecRenderAcoes(st){
  const el=document.getElementById('tec-modal-acoes');
  const despachadoBtns=`<button class="tec-btn tec-btn-amarelo" onclick="tecEnDeslocamento()"><i class="ti ti-truck"></i> Iniciar Deslocamento</button><button class="tec-btn tec-btn-cinza" onclick="tecAbrirModalPendente()"><i class="ti ti-pause"></i> Colocar Pendente</button>`;
  const btns={
    aberto:despachadoBtns,
    despachado:despachadoBtns,
    em_deslocamento:`<button class="tec-btn tec-btn-laranja" onclick="tecEnAtendimento()"><i class="ti ti-tool"></i> Iniciar Atendimento</button>`,
    em_atendimento:`<button class="tec-btn tec-btn-verde" onclick="tecAbrirEncerrar()"><i class="ti ti-check"></i> Encerrar Chamado</button><button class="tec-btn tec-btn-vermelho" onclick="tecAbrirPecaModal()"><i class="ti ti-package"></i> Solicitar Peças</button><button class="tec-btn tec-btn-cinza" onclick="tecAbrirModalPendente()"><i class="ti ti-pause"></i> Colocar Pendente</button>`,
    pendente:`<button class="tec-btn tec-btn-laranja" onclick="tecRetomar()"><i class="ti ti-play"></i> Retomar</button>`
  };
  el.innerHTML=btns[st]||'';
}

// ── TRANSIÇÕES DE STATUS ──
async function tecEnDeslocamento(){
  const c=_tecChamadoAtual;if(!c) return;
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'em_deslocamento',data_deslocamento:new Date().toISOString()})});
  if(!ok){alert('Erro ao atualizar status.');return;}
  c.status_tecnico='em_deslocamento';
  tecEnviarEmailDeslocamento(c);
  tecFecharDetalhe();await tecCarregarChamados();
}

async function tecEnAtendimento(){
  const c=_tecChamadoAtual;if(!c) return;
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'em_atendimento',data_atendimento_inicio:new Date().toISOString()})});
  if(!ok){alert('Erro ao atualizar status.');return;}
  c.status_tecnico='em_atendimento';
  tecFecharDetalhe();await tecCarregarChamados();
}

function tecAbrirModalPendente(){
  document.getElementById('tec-pend-motivo').value='';
  document.getElementById('tec-pend-erro').style.display='none';
  document.getElementById('tec-pend-modal').classList.add('open');
}
function tecFecharModalPendente(){document.getElementById('tec-pend-modal').classList.remove('open');}

async function tecConfirmarPendente(){
  const c=_tecChamadoAtual;if(!c) return;
  const motivo=document.getElementById('tec-pend-motivo').value.trim();
  const erroEl=document.getElementById('tec-pend-erro');
  if(!motivo){erroEl.style.display='block';erroEl.textContent='Informe o motivo da pendência.';return;}
  erroEl.style.display='none';
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'pendente',sla_pausado:true,sla_pausa_inicio:new Date().toISOString(),motivo_pendente:motivo})});
  if(!ok){erroEl.style.display='block';erroEl.textContent='Erro ao atualizar status.';return;}
  c.status_tecnico='pendente';c.sla_pausado=true;c.sla_pausa_inicio=new Date().toISOString();
  tecFecharModalPendente();tecFecharDetalhe();await tecCarregarChamados();
}

async function tecRetomar(){
  const c=_tecChamadoAtual;if(!c) return;
  let totalPausado=c.sla_tempo_pausado||0;
  if(c.sla_pausa_inicio) totalPausado+=Math.floor((new Date()-new Date(c.sla_pausa_inicio))/60000);
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'despachado',sla_pausado:false,sla_pausa_inicio:null,sla_tempo_pausado:totalPausado})});
  if(!ok){alert('Erro ao retomar.');return;}
  c.status_tecnico='despachado';c.sla_pausado=false;c.sla_pausa_inicio=null;c.sla_tempo_pausado=totalPausado;
  tecFecharDetalhe();await tecCarregarChamados();
}

// ── ENCERRAR CHAMADO ──
function tecAbrirEncerrar(){
  document.getElementById('tec-desc-defeito').value='';
  document.getElementById('tec-solucao').value='';
  document.getElementById('tec-pecas-lista').innerHTML='';
  document.getElementById('tec-encerrar-erro').style.display='none';
  document.getElementById('tec-encerrar-modal').classList.add('open');
}
function tecFecharEncerrar(){document.getElementById('tec-encerrar-modal').classList.remove('open');}

async function tecAdicionarPecaEncerrar(){
  if(!_tecPecasCatalogo){
    const {data}=await sfTec('/rest/v1/pecas?ativo=eq.true&select=id,codigo,descricao,unidade&order=codigo');
    _tecPecasCatalogo=data||[];
  }
  if(!_tecPecasCatalogo.length){alert('Nenhuma peça cadastrada no sistema.');return;}
  const el=document.getElementById('tec-pecas-lista');
  el.insertAdjacentHTML('beforeend',`<div class="tec-peca-row">
    <select class="ac-input tec-peca-sel" style="flex:1;min-width:0;margin:0;">
      <option value="">Selecione a peça</option>
      ${_tecPecasCatalogo.map(p=>`<option value="${p.id}">${p.codigo?'['+p.codigo+'] ':''}${p.descricao}</option>`).join('')}
    </select>
    <input type="number" min="1" value="1" class="ac-input tec-peca-qtd" style="width:72px;flex-shrink:0;margin:0;"/>
    <button type="button" onclick="this.closest('.tec-peca-row').remove()" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:8px 10px;cursor:pointer;font-weight:700;flex-shrink:0;">✕</button>
  </div>`);
}

async function tecConfirmarEncerramento(){
  const c=_tecChamadoAtual;if(!c) return;
  const desc=document.getElementById('tec-desc-defeito').value.trim();
  const sol=document.getElementById('tec-solucao').value.trim();
  const erroEl=document.getElementById('tec-encerrar-erro');
  if(!desc||!sol){erroEl.style.display='block';erroEl.textContent='Preencha o defeito encontrado e a solução aplicada.';return;}
  erroEl.style.display='none';
  const pecas=[];
  document.querySelectorAll('#tec-pecas-lista .tec-peca-row').forEach(row=>{
    const pId=row.querySelector('.tec-peca-sel').value;
    const qtd=parseInt(row.querySelector('.tec-peca-qtd').value)||1;
    if(pId) pecas.push({chamado_id:c.id,peca_id:pId,quantidade:qtd});
  });
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status:'encerrado',status_tecnico:'encerrado',data_encerramento:new Date().toISOString(),descricao_tecnico:desc,resolucao:sol})});
  if(!ok){erroEl.style.display='block';erroEl.textContent='Erro ao encerrar chamado. Tente novamente.';return;}
  for(const p of pecas){
    await sfTec('/rest/v1/chamado_pecas',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify(p)});
  }
  c.status='encerrado';c.status_tecnico='encerrado';c.resolucao=sol;c.descricao_tecnico=desc;
  tecEnviarEmailEncerramento(c);
  tecFecharEncerrar();tecFecharDetalhe();await tecCarregarChamados();
}

// ── SOLICITAR PEÇAS ──
function tecAbrirPecaModal(){
  document.getElementById('tec-peca-desc').value='';
  document.getElementById('tec-peca-erro').style.display='none';
  document.getElementById('tec-peca-modal').classList.add('open');
  tecCarregarPecasDisponiveis();
}
function tecFecharPecaModal(){document.getElementById('tec-peca-modal').classList.remove('open');}

// Lista as peças cadastradas (equipamento_pecas) para o modelo do equipamento
// do chamado atual — o técnico nunca vê insumos aqui, só peças.
async function tecCarregarPecasDisponiveis(){
  const wrap=document.getElementById('tec-peca-lista-disponivel');
  if(!wrap) return;
  wrap.innerHTML='<div class="tec-loading">Carregando peças...</div>';
  const c=_tecChamadoAtual;
  if(!c){wrap.innerHTML='<div class="tec-empty">Chamado não encontrado.</div>';return;}

  let modelo=c.equipamento?c.equipamento.modelo:null;
  if(!modelo&&c.equipamento_id){
    const {data}=await sfTec('/rest/v1/equipamentos?id=eq.'+c.equipamento_id+'&select=modelo&limit=1');
    modelo=data&&data[0]?data[0].modelo:null;
  }
  if(!modelo){wrap.innerHTML='<div class="tec-empty">Chamado sem equipamento/modelo vinculado.</div>';return;}

  const {data:links}=await sfTec('/rest/v1/equipamento_pecas?modelo=eq.'+encodeURIComponent(modelo)+'&select=peca_id');
  if(!links||!links.length){
    wrap.innerHTML='<div class="tec-empty">Nenhuma peça cadastrada para este modelo — contate o suporte</div>';
    return;
  }

  const pecaIds=[...new Set(links.map(l=>l.peca_id).filter(Boolean))];
  const {data:pecas}=await sfTec('/rest/v1/pecas?id=in.('+pecaIds.join(',')+')&select=id,codigo,descricao&order=descricao.asc');
  if(!pecas||!pecas.length){
    wrap.innerHTML='<div class="tec-empty">Nenhuma peça cadastrada para este modelo — contate o suporte</div>';
    return;
  }

  wrap.innerHTML=pecas.map(p=>{
    const label=(p.codigo?'['+p.codigo+'] ':'')+p.descricao;
    const labelAttr=label.replace(/"/g,'&quot;');
    return `<label class="tec-peca-check"><input type="checkbox" data-label="${labelAttr}" onchange="tecTogglePecaDisponivel(this)"/> ${label}</label>`;
  }).join('');
}

// Ao marcar/desmarcar uma peça da lista, adiciona/remove a linha correspondente
// no textarea de descrição (mantém o fluxo de gravação em pecas_solicitadas).
function tecTogglePecaDisponivel(checkbox){
  const ta=document.getElementById('tec-peca-desc');
  if(!ta) return;
  const label=checkbox.getAttribute('data-label');
  const linhas=ta.value.split('\n').filter(l=>l.trim()!=='');
  if(checkbox.checked){
    if(linhas.indexOf(label)===-1) linhas.push(label);
  }else{
    const idx=linhas.indexOf(label);
    if(idx!==-1) linhas.splice(idx,1);
  }
  ta.value=linhas.join('\n');
}

async function tecConfirmarPeca(){
  const c=_tecChamadoAtual;if(!c) return;
  const desc=document.getElementById('tec-peca-desc').value.trim();
  const erroEl=document.getElementById('tec-peca-erro');
  if(!desc){erroEl.style.display='block';erroEl.textContent='Descreva as peças necessárias.';return;}
  erroEl.style.display='none';
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+c.id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'aguardando_peca',pecas_status:'solicitado',pecas_solicitadas:desc,sla_pausado:true,sla_pausa_inicio:new Date().toISOString()})});
  if(!ok){erroEl.style.display='block';erroEl.textContent='Erro ao atualizar status.';return;}
  c.status_tecnico='aguardando_peca';c.pecas_status='solicitado';c.pecas_solicitadas=desc;c.sla_pausado=true;
  tecFecharPecaModal();tecFecharDetalhe();await tecCarregarChamados();
}

async function tecReceberPecas(id){
  const c=_tecChamadosData[id];if(!c) return;
  const totalDecorrido=calcularSLAUtil(c.created_at,0);
  const {ok}=await sfTec('/rest/v1/chamados?id=eq.'+id,{method:'PATCH',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({status_tecnico:'despachado',pecas_status:null,sla_pausado:false,sla_pausa_inicio:null,sla_tempo_pausado:totalDecorrido})});
  if(!ok){alert('Erro ao confirmar recebimento de peças.');return;}
  await tecCarregarChamados();tecMostrarView('chamados');
}

// ── UPLOAD DE FOTOS ──
async function tecAnexarFoto(input){
  const c=_tecChamadoAtual;if(!c||!input.files||!input.files[0]) return;
  const file=input.files[0];
  const safeNome=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=c.id+'/'+Date.now()+'_'+safeNome;
  const upRes=await fetch(SURL+'/storage/v1/object/chamados/'+path,{
    method:'POST',headers:{'apikey':SKEY,'Authorization':'Bearer '+_tecTok,'Content-Type':file.type,'x-upsert':'true'},body:file
  }).catch(()=>null);
  if(!upRes||!upRes.ok){alert('Erro ao fazer upload da foto.');return;}
  const url=SURL+'/storage/v1/object/public/chamados/'+path;
  await sfTec('/rest/v1/chamado_fotos',{method:'POST',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({chamado_id:c.id,url})});
  const grid=document.getElementById('tec-fotos-grid');
  if(grid) grid.insertAdjacentHTML('beforeend',`<a href="${url}" target="_blank"><img src="${url}" class="tec-foto-thumb" loading="lazy"/></a>`);
  input.value='';
}

// ── SLA (horas úteis: seg-sex, 8-12h e 13-18h) ──
function calcularSLAUtil(dataAbertura,minutesPausados){
  const IM=8*60,FM=12*60,IT=13*60,FT=18*60;
  let total=0,cur=new Date(dataAbertura);
  const agora=new Date();
  if(cur>=agora) return 0;
  while(cur<agora){
    const dia=cur.getDay();
    if(dia===0){const n=new Date(cur);n.setDate(n.getDate()+1);n.setHours(8,0,0,0);cur=n;continue;}
    if(dia===6){const n=new Date(cur);n.setDate(n.getDate()+2);n.setHours(8,0,0,0);cur=n;continue;}
    const md=cur.getHours()*60+cur.getMinutes();
    if(md<IM){cur=new Date(cur);cur.setHours(8,0,0,0);continue;}
    if(md>=FM&&md<IT){cur=new Date(cur);cur.setHours(13,0,0,0);continue;}
    if(md>=FT){const n=new Date(cur);n.setDate(n.getDate()+1);n.setHours(8,0,0,0);cur=n;continue;}
    const segEnd=new Date(cur);
    if(md<FM) segEnd.setHours(12,0,0,0); else segEnd.setHours(18,0,0,0);
    const end=segEnd<agora?segEnd:agora;
    total+=(end-cur)/60000;cur=end;
    if(end<segEnd) break;
    if(cur.getHours()===12) cur.setHours(13,0,0,0);
    else{const n=new Date(cur);n.setDate(n.getDate()+1);n.setHours(8,0,0,0);cur=n;}
  }
  return Math.max(0,Math.floor(total)-(minutesPausados||0));
}

function tecFormatarSLA(c){
  const st=c.status_tecnico||c.status;
  if(st==='encerrado') return {texto:'Encerrado',atrasado:false};
  const tipoRaw=c.tipo_servico||c.tipo_chamado||'assistencia';
  const slaMin=TEC_SLA_MAP[tipoRaw]||480;
  let pausado=c.sla_tempo_pausado||0;
  if(c.sla_pausado&&c.sla_pausa_inicio) pausado+=Math.floor((new Date()-new Date(c.sla_pausa_inicio))/60000);
  const decorrido=calcularSLAUtil(c.created_at,pausado);
  const restante=slaMin-decorrido;
  if(restante<=0) return {texto:'ATRASADO',atrasado:true};
  const h=Math.floor(restante/60),m=restante%60;
  return {texto:`SLA: ${h}h ${String(m).padStart(2,'0')}m restantes`,atrasado:false};
}

// ── E-MAILS via Supabase Edge Function ──
async function tecEnviarEmailDeslocamento(c){
  if(!c.solicitante_email) return;
  const num=c.numero||c.id.slice(0,6).toUpperCase();
  const nome=c.solicitante_nome||'Cliente';
  const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||''):'';
  const html=`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FA;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
<tr><td style="background:#1A3F80;padding:28px 36px;">
  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">Teffe Tecnologia</p>
  <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">Notificação de Deslocamento de Atendimento</p>
</td></tr>
<tr><td style="padding:32px 36px;">
  <p style="font-size:15px;color:#374151;margin:0 0 16px;">Olá, <strong>${nome}</strong>!</p>
  <p style="font-size:15px;color:#374151;margin:0 0 24px;">O técnico <strong style="color:#1A3F80;">${_tecNome}</strong> está a caminho do seu local para atender o chamado:</p>
  <div style="background:#EBF4FF;border-left:4px solid #1A3F80;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <p style="margin:0;font-size:13px;color:#6B7280;">Número do Chamado</p>
    <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#1A3F80;">O.S. ${num}</p>
    ${cliente?`<p style="margin:8px 0 0;font-size:13px;color:#374151;"><strong>Cliente:</strong> ${cliente}</p>`:''}
    ${c.descricao?`<p style="margin:6px 0 0;font-size:13px;color:#374151;"><strong>Descrição:</strong> ${c.descricao}</p>`:''}
  </div>
  <p style="font-size:14px;color:#6B7280;margin:0 0 8px;">Em caso de dúvidas, entre em contato:</p>
  <p style="font-size:14px;font-weight:700;color:#1A3F80;margin:0;"><a href="https://wa.me/5514998289248" style="color:#1A3F80;">(14) 99828-9248</a></p>
</td></tr>
<tr><td style="background:#F0F4FA;padding:18px 36px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#9CA3AF;">Teffe Tecnologia · Este é um e-mail automático, não responda.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  try{
    const r=await fetch(SURL+'/functions/v1/enviar-email',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_tecTok},
      body:JSON.stringify({to:c.solicitante_email,subject:`Notificação de Deslocamento de Atendimento — Teffe Tecnologia`,html})});
    if(!r.ok) console.error('[Email desl.] HTTP',r.status);
  }catch(e){console.error('[Email desl.]',e);}
}

async function tecEnviarEmailEncerramento(c){
  if(!c.solicitante_email) return;
  const num=c.numero||c.id.slice(0,6).toUpperCase();
  const nome=c.solicitante_nome||'Cliente';
  const cliente=c.clientes?(c.clientes.empresa||c.clientes.nome||''):'';
  const html=`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FA;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
<tr><td style="background:#16A34A;padding:28px 36px;">
  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">Teffe Tecnologia</p>
  <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Chamado Encerrado com Sucesso</p>
</td></tr>
<tr><td style="padding:32px 36px;">
  <p style="font-size:15px;color:#374151;margin:0 0 16px;">Olá, <strong>${nome}</strong>!</p>
  <p style="font-size:15px;color:#374151;margin:0 0 24px;">O chamado abaixo foi encerrado com sucesso pelo técnico <strong style="color:#1A3F80;">${_tecNome}</strong>:</p>
  <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
    <p style="margin:0;font-size:13px;color:#6B7280;">Número do Chamado</p>
    <p style="margin:4px 0 8px;font-size:22px;font-weight:900;color:#166534;">O.S. ${num}</p>
    ${cliente?`<p style="margin:0 0 6px;font-size:13px;color:#374151;"><strong>Cliente:</strong> ${cliente}</p>`:''}
    ${c.descricao_tecnico?`<p style="margin:0 0 6px;font-size:13px;color:#374151;"><strong>Defeito encontrado:</strong> ${c.descricao_tecnico}</p>`:''}
    ${c.resolucao?`<p style="margin:0;font-size:13px;color:#374151;"><strong>Solução aplicada:</strong> ${c.resolucao}</p>`:''}
  </div>
  <p style="font-size:14px;color:#6B7280;margin:0 0 8px;">Para avaliações ou dúvidas:</p>
  <p style="font-size:14px;font-weight:700;color:#1A3F80;margin:0;"><a href="https://wa.me/5514998289248" style="color:#1A3F80;">(14) 99828-9248</a></p>
</td></tr>
<tr><td style="background:#F0F4FA;padding:18px 36px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#9CA3AF;">Teffe Tecnologia · Este é um e-mail automático, não responda.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  try{
    const r=await fetch(SURL+'/functions/v1/enviar-email',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_tecTok},
      body:JSON.stringify({to:c.solicitante_email,subject:`Chamado O.S. ${num} Encerrado com Sucesso — Teffe Tecnologia`,html})});
    if(!r.ok) console.error('[Email enc.] HTTP',r.status);
  }catch(e){console.error('[Email enc.]',e);}
}

// ── ROTEAMENTO ──
window.addEventListener('hashchange',()=>{if(location.hash==='#portaltecnico') tecInit();});
window.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#portaltecnico') tecInit();});
