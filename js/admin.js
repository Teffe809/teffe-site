Object.keys(localStorage).forEach(k=>{if(k.startsWith('sb-')) localStorage.removeItem(k);});

'use strict';
// ADMIN_URL e ADMIN_ANON são carregados de js/admin-keys.js

let _admUid=null,_admNome='',_admTecs=[];

// Cliente Supabase com anon key — gerencia a sessão do admin logado
const _supabase=supabase.createClient(ADMIN_URL,ADMIN_ANON,{
  auth:{storage:sessionStorage,persistSession:false}
});

// ── HTTP ──
// Operações de dados com anon key — leitura de chamados, clientes etc.
async function admHttp(path,opts){
  const h={'apikey':ADMIN_ANON,'Content-Type':'application/json','Authorization':'Bearer '+ADMIN_ANON};
  const r=await fetch(ADMIN_URL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok};
}
// JWT obtido via getSession() — para que RLS reconheça auth.uid()
async function admHttpUser(path,opts){
  const {data:{session}}=await _supabase.auth.getSession();
  const token=session?.access_token;
  if(!token) return {data:null,ok:false,status:0};
  const h={'apikey':ADMIN_ANON,'Content-Type':'application/json','Authorization':'Bearer '+token};
  const r=await fetch(ADMIN_URL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok,status:r.status};
}

// ── VERIFICAÇÃO DE ROLE ──
async function admVerificarRole(uid,token){
  const r=await fetch(ADMIN_URL+'/rest/v1/profiles?id=eq.'+uid+'&select=role,nome&limit=1',{
    headers:{'apikey':ADMIN_ANON,'Content-Type':'application/json','Authorization':'Bearer '+token}
  });
  const data=await r.json().catch(()=>[]);
  return Array.isArray(data)&&data.length?data[0]:null;
}


function admMostrarLogin(){
  console.log('ADMIN: mostrando login');
  document.documentElement.classList.add('no-scroll','mia-oculta');
  if(typeof miaFecharChat==='function') miaFecharChat();
  document.getElementById('admin-panel').style.display='block';
  document.getElementById('adm-login-bg').classList.add('open');
  history.replaceState(null,'','#admin');
}

function admAcessoNegado(){
  _admUid=null;_admNome='';_admTecs=[];
  _supabase.auth.signOut();
  document.documentElement.classList.remove('no-scroll','mia-oculta');
  document.getElementById('admin-panel').style.display='none';
  document.getElementById('adm-login-bg').classList.remove('open');
  history.replaceState(null,'','#cliente');
  // Exibe mensagem no modal de login do cliente e abre o modal
  const msg=document.getElementById('login-acesso-negado');
  if(msg) msg.style.display='flex';
  if(typeof openModal==='function') openModal(null);
}

// ── LOGIN / LOGOUT ──
async function admFazerLogin(){
  const email=document.getElementById('adm-email').value.trim();
  const senha=document.getElementById('adm-senha').value;
  const erroEl=document.getElementById('adm-login-erro');
  const btn=document.getElementById('adm-btn-entrar');
  if(!email||!senha){erroEl.style.display='block';erroEl.textContent='Preencha e-mail e senha.';return;}
  btn.textContent='Verificando...';btn.disabled=true;erroEl.style.display='none';

  // 1. Autenticar via cliente Supabase (anon key) — sessão válida gerenciada pelo cliente
  const {data,error}=await _supabase.auth.signInWithPassword({email,password:senha});
  if(error||!data.session){
    erroEl.style.display='block';erroEl.textContent='Credenciais inválidas.';
    btn.textContent='Entrar →';btn.disabled=false;return;
  }
  const uid=data.user.id;
  const token=data.session.access_token;

  // 2. Verificar role 'admin' na tabela profiles com o JWT da sessão
  const perfil=await admVerificarRole(uid,token);
  if(!perfil||perfil.role!=='admin'){
    await _supabase.auth.signOut();
    btn.textContent='Entrar →';btn.disabled=false;
    document.getElementById('adm-login-bg').classList.remove('open');
    document.getElementById('admin-panel').style.display='none';
    history.replaceState(null,'','#cliente');
    const msg=document.getElementById('login-acesso-negado');
    if(msg) msg.style.display='flex';
    if(typeof openModal==='function') openModal(null);
    return;
  }

  // 3. Acesso autorizado
  console.log('ADMIN: logado como',email);
  _admUid=uid;_admNome=perfil.nome||email;
  document.getElementById('adm-login-bg').classList.remove('open');
  document.getElementById('adm-nome-display').textContent=_admNome;
  document.getElementById('adm-email').value='';document.getElementById('adm-senha').value='';
  btn.textContent='Entrar →';btn.disabled=false;
  history.replaceState(null,'','#admin');
  await admCarregarTecnicos();
  admMostrarView('dash');
}

function admFazerLogout(){
  _admUid=null;_admNome='';_admTecs=[];
  _supabase.auth.signOut();
  document.documentElement.classList.remove('no-scroll','mia-oculta');
  localStorage.clear();
  window.location.href='https://teffe.com.br';
}

// ── ALTERAR SENHA (ADMIN) ──
function admAbrirAlterarSenha(){
  if(typeof abrirAlterarSenha==='function') abrirAlterarSenha('adm');
}
async function admConfirmarAlterarSenha(nova,msgEl,btnEl){
  if(btnEl){btnEl.textContent='Salvando...';btnEl.disabled=true;}
  const {error}=await _supabase.auth.updateUser({password:nova});
  if(btnEl){btnEl.textContent='Salvar senha →';btnEl.disabled=false;}
  if(error){
    if(msgEl){msgEl.className='rec-msg rec-msg-erro';msgEl.textContent=error.message||'Erro ao alterar a senha.';}
  } else {
    if(msgEl){msgEl.className='rec-msg rec-msg-ok';msgEl.textContent='Senha alterada com sucesso!';}
    setTimeout(function(){if(typeof fecharAlterarSenha==='function')fecharAlterarSenha();},2000);
  }
}

function admFecharLogin(){
  document.getElementById('adm-login-bg').classList.remove('open');
  document.getElementById('admin-panel').style.display='none';
  history.replaceState(null,'',location.pathname);
}

// Ponto de entrada: sempre faz signOut e limpa estado antes de mostrar login
async function admInit(){
  await _supabase.auth.signOut();
  _admUid=null;_admNome='';_admTecs=[];
  admMostrarLogin();
}

// ── NAVEGAÇÃO ──
function admMostrarView(id){
  document.querySelectorAll('.adm-view').forEach(v=>v.classList.remove('adm-active'));
  document.getElementById('adm-view-'+id).classList.add('adm-active');
  document.querySelectorAll('.adm-nav-item').forEach(i=>i.classList.remove('adm-nav-active'));
  const nav=document.querySelector('[data-adm-view="'+id+'"]');
  if(nav) nav.classList.add('adm-nav-active');
  if(id==='dash') admCarregarDashboard();
  else if(id==='tecnicos') admCarregarTecnicos();
  else if(id==='clientes') admCarregarClientes();
  else if(id==='chamados'){admAtualizarFiltroTec();admCarregarChamados();}
}

// ── DASHBOARD ──
async function admCarregarDashboard(){
  document.getElementById('adm-n-tecs').textContent=_admTecs.length;
  const [{data:cli},{data:cham}]=await Promise.all([
    admHttp('/rest/v1/clientes?select=id'),
    admHttp('/rest/v1/chamados?tipo_chamado=eq.assistencia&status=eq.aberto&select=id')
  ]);
  document.getElementById('adm-n-cli').textContent=cli?cli.length:0;
  document.getElementById('adm-n-cham').textContent=cham?cham.length:0;
}

// ── TÉCNICOS ──
async function admCarregarTecnicos(){
  const {data}=await admHttp('/rest/v1/tecnicos?order=nome&select=*');
  _admTecs=data||[];
  const el=document.getElementById('adm-lista-tecs');
  if(!el) return;
  if(!_admTecs.length){el.innerHTML='<div class="ac-empty">Nenhum técnico cadastrado.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Matrícula</th><th></th></tr></thead><tbody>'+
    _admTecs.map(t=>`<tr>
      <td><b>${t.nome}</b></td><td>${t.email}</td><td>${t.telefone||'–'}</td><td>${t.matricula||'–'}</td>
      <td><button class="adm-btn-sm adm-btn-danger" onclick="admDeletarTecnico('${t.id}')"><i class="ti ti-trash"></i> Remover</button></td>
    </tr>`).join('')+'</tbody></table>';
  admAtualizarFiltroTec();
}

function admAtualizarFiltroTec(){
  const sel=document.getElementById('adm-filtro-tec');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Todos os técnicos</option><option value="is_null">Sem técnico atribuído</option>'+
    _admTecs.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');
  if(cur) sel.value=cur;
}

async function admCriarTecnico(){
  const nome=document.getElementById('adm-tec-nome').value.trim();
  const email=document.getElementById('adm-tec-email').value.trim();
  const tel=document.getElementById('adm-tec-tel').value.trim();
  const mat=document.getElementById('adm-tec-mat').value.trim();
  const senha=document.getElementById('adm-tec-senha').value.trim();
  const erroEl=document.getElementById('adm-tec-erro');
  const btn=document.getElementById('adm-btn-criar-tec');
  if(!nome||!email){erroEl.style.display='block';erroEl.textContent='Nome e e-mail são obrigatórios.';return;}
  if(!senha){erroEl.style.display='block';erroEl.textContent='Defina uma senha temporária para o técnico.';return;}
  btn.disabled=true;btn.textContent='Criando...';erroEl.style.display='none';
  let userId=null;

  // Cliente isolado para o signUp — não interfere na sessão do admin em _supabase
  const _supabaseSignup=supabase.createClient(ADMIN_URL,ADMIN_ANON);
  const {data:signUpData,error:signUpError}=await _supabaseSignup.auth.signUp({
    email,password:senha,
    options:{data:{role:'tecnico',nome}}
  });
  if(signUpError){
    erroEl.style.display='block';
    erroEl.textContent='Erro ao criar login: '+signUpError.message;
    btn.disabled=false;btn.textContent='Criar Técnico';return;
  }
  if(signUpData.user) userId=signUpData.user.id;

  // INSERT com JWT do admin (_supabase intacto — sessão não foi afetada pelo signUp)
  const {ok,data:errD}=await admHttpUser('/rest/v1/tecnicos',{
    method:'POST',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({nome,email,telefone:tel||null,matricula:mat||null,user_id:userId})
  });
  btn.disabled=false;btn.textContent='Criar Técnico';
  if(!ok){erroEl.style.display='block';erroEl.textContent=errD&&errD.message?errD.message:'Erro ao cadastrar técnico.';return;}
  ['adm-tec-nome','adm-tec-email','adm-tec-tel','adm-tec-mat','adm-tec-senha'].forEach(id=>document.getElementById(id).value='');
  admCarregarTecnicos();
}

async function admDeletarTecnico(id){
  if(!confirm('Remover técnico? Os chamados vinculados perderão o técnico atribuído.')) return;
  await admHttp('/rest/v1/tecnicos?id=eq.'+id,{method:'DELETE'});
  admCarregarTecnicos();
}

// ── CLIENTES ──
async function admCarregarClientes(){
  if(!_admTecs.length) await admCarregarTecnicos();
  const {data}=await admHttp('/rest/v1/clientes?order=empresa&select=*');
  const el=document.getElementById('adm-lista-clientes');
  if(!data||!data.length){el.innerHTML='<div class="ac-empty">Nenhum cliente cadastrado.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Empresa</th><th>Contato</th><th>Técnico responsável</th><th></th></tr></thead><tbody>'+
    data.map(c=>`<tr>
      <td><b>${c.empresa||'–'}</b></td>
      <td>${c.nome||'–'}</td>
      <td>
        <select id="sel-cli-${c.id}" class="adm-sel-inline">
          <option value="">Sem técnico</option>
          ${_admTecs.map(t=>`<option value="${t.id}"${t.id===c.tecnico_responsavel_id?' selected':''}>${t.nome}</option>`).join('')}
        </select>
      </td>
      <td style="white-space:nowrap;">
        <button class="adm-btn adm-btn-sm" onclick="admAtribuirTecnico('${c.id}')">Salvar</button>
        <span id="msg-cli-${c.id}" style="display:none;color:#2d8a40;font-size:13px;font-weight:600;margin-left:8px;">Vinculado!</span>
      </td>
    </tr>`).join('')+'</tbody></table>';
}

async function admAtribuirTecnico(clienteId){
  const sel=document.getElementById('sel-cli-'+clienteId);
  const tecnicoId=sel?sel.value:'';
  const resultado=await admHttp('/rest/v1/clientes?id=eq.'+clienteId,{
    method:'PATCH',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({tecnico_responsavel_id:tecnicoId||null})
  });
  if(!resultado.ok){
    console.error('Erro vínculo:',resultado.data);
    alert('Erro ao salvar vínculo.');
    return;
  }
  const msg=document.getElementById('msg-cli-'+clienteId);
  if(msg){
    msg.style.display='inline';
    setTimeout(()=>{msg.style.display='none';},2000);
  }
}

// ── CHAMADOS ──
async function admCarregarChamados(){
  if(!_admTecs.length) await admCarregarTecnicos();
  const filtroStatus=document.getElementById('adm-filtro-status').value;
  const filtroTec=document.getElementById('adm-filtro-tec').value;
  let q='/rest/v1/chamados?tipo_chamado=eq.assistencia&order=created_at.desc&select=*,clientes(nome,empresa)';
  if(filtroStatus) q+='&status=eq.'+filtroStatus;
  if(filtroTec==='is_null') q+='&tecnico_id=is.null';
  else if(filtroTec) q+='&tecnico_id=eq.'+filtroTec;
  const {data}=await admHttp(q);
  const el=document.getElementById('adm-lista-chamados');
  if(!data||!data.length){el.innerHTML='<div class="ac-empty">Nenhum chamado encontrado com os filtros selecionados.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>#</th><th>Cliente</th><th>Descrição</th><th>Solicitante</th><th>Status</th><th>Técnico</th><th>Data</th></tr></thead><tbody>'+
    data.map(r=>`<tr style="cursor:pointer;" onclick="admAbrirDetalhe(${JSON.stringify(JSON.stringify(r))})">
      <td><b>#${r.numero||r.id.slice(0,6)}</b></td>
      <td>${r.clientes?r.clientes.empresa||r.clientes.nome:'–'}</td>
      <td class="adm-td-trunc" title="${(r.descricao||'').replace(/"/g,'&quot;')}">${r.descricao||r.titulo||'–'}</td>
      <td>${r.solicitante_nome||'–'}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td onclick="event.stopPropagation()">
        <select class="adm-sel-inline" onchange="admRedistribuir('${r.id}',this.value)">
          <option value="">Sem técnico</option>
          ${_admTecs.map(t=>`<option value="${t.id}"${t.id===r.tecnico_id?' selected':''}>${t.nome}</option>`).join('')}
        </select>
      </td>
      <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
    </tr>`).join('')+'</tbody></table>';
}

async function admRedistribuir(chamadoId,tecnicoId){
  const {ok}=await admHttp('/rest/v1/chamados?id=eq.'+chamadoId,{
    method:'PATCH',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({tecnico_id:tecnicoId||null})
  });
  if(!ok) alert('Erro ao redistribuir chamado. Verifique permissões no Supabase.');
}

// ── MODAL DETALHE CHAMADO ──
async function admAbrirDetalhe(jsonStr){
  const c=typeof jsonStr==='string'?JSON.parse(jsonStr):jsonStr;
  const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'–';
  const fmtD=v=>v?new Date(v).toLocaleDateString('pt-BR'):'–';
  const statusLabels={aberto:'Aberto',andamento:'Em andamento',encerrado:'Encerrado',concluido:'Concluído',resolvido:'Resolvido'};
  const prioLabels={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const encerrado=['encerrado','concluido','resolvido'].includes(c.status);

  // Peças utilizadas
  const {data:pRows}=await admHttpUser('/rest/v1/chamado_pecas?chamado_id=eq.'+c.id+'&select=*,pecas(codigo,descricao,unidade)');
  c._pecas=pRows||[];
  const pecasModalHtml=c._pecas.length?`<div class="adm-det-section">
    <div class="adm-det-label">Peças Utilizadas</div>
    <table class="ac-table" style="margin-top:6px;">
      <thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th></tr></thead>
      <tbody>${c._pecas.map(p=>`<tr>
        <td>${(p.pecas&&p.pecas.codigo)||'–'}</td>
        <td>${(p.pecas&&p.pecas.descricao)||'–'}</td>
        <td>${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`:'';

  document.getElementById('adm-detalhe-corpo').innerHTML=`
    <div class="adm-det-grid">
      <div class="adm-det-row"><span class="adm-det-label">Número</span><span class="adm-det-val">#${c.numero||c.id.slice(0,6)}</span></div>
      <div class="adm-det-row"><span class="adm-det-label">Abertura</span><span class="adm-det-val">${fmt(c.created_at)}</span></div>
      <div class="adm-det-row"><span class="adm-det-label">Status</span><span class="adm-det-val"><span class="badge badge-${c.status}">${statusLabels[c.status]||c.status}</span></span></div>
      ${c.tipo_chamado?`<div class="adm-det-row"><span class="adm-det-label">Tipo</span><span class="adm-det-val">${c.tipo_chamado}</span></div>`:''}
      ${c.solicitante_nome?`<div class="adm-det-row"><span class="adm-det-label">Solicitante</span><span class="adm-det-val">${c.solicitante_nome}</span></div>`:''}
      ${c.solicitante_telefone?`<div class="adm-det-row"><span class="adm-det-label">Telefone</span><span class="adm-det-val">${c.solicitante_telefone}</span></div>`:''}
      ${c.solicitante_email?`<div class="adm-det-row"><span class="adm-det-label">E-mail</span><span class="adm-det-val">${c.solicitante_email}</span></div>`:''}
      ${c.prioridade?`<div class="adm-det-row"><span class="adm-det-label">Prioridade</span><span class="adm-det-val">${prioLabels[c.prioridade]||c.prioridade}</span></div>`:''}
      ${c.tecnico?`<div class="adm-det-row"><span class="adm-det-label">Técnico</span><span class="adm-det-val">${c.tecnico}</span></div>`:''}
    </div>
    ${c.descricao?`<div class="adm-det-section"><div class="adm-det-label">Descrição</div><div class="adm-det-text">${c.descricao.replace(/\n/g,'<br>')}</div></div>`:''}
    ${encerrado&&c.resolucao?`<div class="adm-det-section"><div class="adm-det-label">Resolução do Técnico</div><div class="adm-det-text adm-det-resolucao">${c.resolucao.replace(/\n/g,'<br>')}</div></div>`:''}
    ${pecasModalHtml}
    ${c.data_fechamento?`<div class="adm-det-row" style="margin-top:12px;"><span class="adm-det-label">Data de fechamento</span><span class="adm-det-val">${fmtD(c.data_fechamento)}</span></div>`:''}
  `;
  document.getElementById('adm-detalhe-btn-os').onclick=()=>admImprimirOS(c);
  document.getElementById('adm-detalhe-bg').classList.add('open');
}

function admFecharDetalhe(){
  document.getElementById('adm-detalhe-bg').classList.remove('open');
}

// ── IMPRIMIR OS (admin) ──
function admImprimirOS(c){
  const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'–';
  const fmtD=v=>v?new Date(v).toLocaleDateString('pt-BR'):'–';
  const statusLabels={aberto:'Aberto',andamento:'Em andamento',encerrado:'Encerrado',concluido:'Concluído',resolvido:'Resolvido'};
  const prioLabels={baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'};
  const encerrado=['encerrado','concluido','resolvido'].includes(c.status);
  const num=c.numero||c.id.slice(0,6);
  const resolucaoEscapada=(c.resolucao||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const descEscapada=(c.descricao||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const rows=[
    ['Número',`#${num}`],
    ['Data/Hora de Abertura',fmt(c.created_at)],
    ['Status',statusLabels[c.status]||c.status],
    ['Tipo de Chamado','Assistência Técnica'],
    c.solicitante_nome&&['Solicitante',c.solicitante_nome],
    c.solicitante_telefone&&['Telefone do Solicitante',c.solicitante_telefone],
    c.solicitante_email&&['E-mail do Solicitante',c.solicitante_email],
    c.prioridade&&['Prioridade',prioLabels[c.prioridade]||c.prioridade],
    c.tecnico&&['Técnico Responsável',c.tecnico],
    c.data_fechamento&&['Data de Fechamento',fmtD(c.data_fechamento)],
  ].filter(Boolean);

  const rowsHTML=rows.map(([l,v])=>`<tr><th>${l}</th><td>${v}</td></tr>`).join('');

  const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>OS #${num} — Teffe Tecnologia</title>
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
    <h1>ORDEM DE SERVIÇO Nº ${num}</h1>
    <p>Teffe Tecnologia — Suporte e Assistência Técnica</p>
  </div>
</div>
<div class="os-section">
  <div class="os-section-title">Dados do Chamado</div>
  <table class="os-table">${rowsHTML}</table>
</div>
${descEscapada?`<div class="os-section">
  <div class="os-section-title">Descrição do Problema</div>
  <div class="os-text-block">${descEscapada}</div>
</div>`:''}
${c._pecas&&c._pecas.length?`<div class="os-section">
  <div class="os-section-title">Peças Utilizadas</div>
  <table class="os-table">
    <thead><tr><th style="width:120px">Código</th><th>Descrição</th><th style="width:70px;text-align:center">Qtd.</th></tr></thead>
    <tbody>${c._pecas.map(p=>`<tr><td>${(p.pecas&&p.pecas.codigo)||'–'}</td><td>${(p.pecas&&p.pecas.descricao)||'–'}</td><td style="text-align:center">${p.quantidade||0} ${(p.pecas&&p.pecas.unidade)||'un'}</td></tr>`).join('')}</tbody>
  </table>
</div>`:''}
<div class="os-section">
  <div class="os-section-title">Solução / Resolução do Técnico</div>
  <textarea class="os-resolucao" placeholder="Descreva a solução aplicada...">${resolucaoEscapada}</textarea>
</div>
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

// ── HASH ──
window.addEventListener('hashchange',()=>{if(location.hash==='#admin') admInit();});
window.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#admin') admInit();});
