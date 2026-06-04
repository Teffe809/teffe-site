'use strict';
// ADMIN_URL e ADMIN_ANON são carregados de js/admin-keys.js

let _admUid=null,_admNome='',_admTecs=[];

// Cliente Supabase com anon key — gerencia a sessão do admin logado
const _supabase=supabase.createClient(ADMIN_URL,ADMIN_ANON);

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
  if(!token) return {data:null,ok:false};
  const h={'apikey':ADMIN_ANON,'Content-Type':'application/json','Authorization':'Bearer '+token};
  const r=await fetch(ADMIN_URL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok};
}

// ── VERIFICAÇÃO DE ROLE ──
async function admVerificarRole(uid,token){
  const r=await fetch(ADMIN_URL+'/rest/v1/profiles?id=eq.'+uid+'&select=role,nome&limit=1',{
    headers:{'apikey':ADMIN_ANON,'Content-Type':'application/json','Authorization':'Bearer '+token}
  });
  const data=await r.json().catch(()=>[]);
  return Array.isArray(data)&&data.length?data[0]:null;
}

// Verifica sessão ativa via getSession() — nunca mostra o painel antes disso
async function admVerificarEAbrir(){
  const {data:{session}}=await _supabase.auth.getSession();
  if(!session){admMostrarLogin();return;}
  const uid=session.user.id;
  const token=session.access_token;
  _admUid=uid;
  const perfil=await admVerificarRole(uid,token);
  if(!perfil||perfil.role!=='admin'){admAcessoNegado();return;}
  _admNome=perfil.nome||'Admin';
  document.getElementById('admin-panel').style.display='block';
  document.getElementById('adm-nome-display').textContent=_admNome;
  history.replaceState(null,'','#admin');
  await admCarregarTecnicos();
  admMostrarView('dash');
}

function admMostrarLogin(){
  document.getElementById('admin-panel').style.display='block';
  document.getElementById('adm-login-bg').classList.add('open');
  history.replaceState(null,'','#admin');
}

function admAcessoNegado(){
  _admUid=null;_admNome='';_admTecs=[];
  _supabase.auth.signOut();
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
  localStorage.clear();
  window.location.href='https://teffe.com.br';
}

function admFecharLogin(){
  document.getElementById('adm-login-bg').classList.remove('open');
  document.getElementById('admin-panel').style.display='none';
  history.replaceState(null,'',location.pathname);
}

// Ponto de entrada: getSession() decide se mostra login ou painel
function admInit(){
  admVerificarEAbrir();
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

  // Cria login do técnico via signUp (anon key — sem service role key)
  const {data:signUpData,error:signUpError}=await _supabase.auth.signUp({
    email,password:senha,
    options:{data:{role:'tecnico',nome}}
  });
  if(signUpError){
    erroEl.style.display='block';
    erroEl.textContent='Erro ao criar login: '+signUpError.message;
    btn.disabled=false;btn.textContent='Criar Técnico';return;
  }
  if(signUpData.user) userId=signUpData.user.id;

  // INSERT na tabela tecnicos com JWT do admin logado (RLS reconhece auth.uid())
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
  el.innerHTML='<table class="ac-table"><thead><tr><th>Empresa</th><th>Contato</th><th>Técnico responsável</th></tr></thead><tbody>'+
    data.map(c=>`<tr>
      <td><b>${c.empresa||'–'}</b></td>
      <td>${c.nome||'–'}</td>
      <td>
        <select class="adm-sel-inline" onchange="admAtribuirTecnico('${c.id}',this.value)">
          <option value="">Sem técnico</option>
          ${_admTecs.map(t=>`<option value="${t.id}"${t.id===c.tecnico_id?' selected':''}>${t.nome}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('')+'</tbody></table>';
}

async function admAtribuirTecnico(clienteId,tecnicoId){
  const {ok}=await admHttp('/rest/v1/clientes?id=eq.'+clienteId,{
    method:'PATCH',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({tecnico_id:tecnicoId||null})
  });
  if(!ok) alert('Erro ao salvar vínculo.');
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
    data.map(r=>`<tr>
      <td><b>#${r.numero||r.id.slice(0,6)}</b></td>
      <td>${r.clientes?r.clientes.empresa||r.clientes.nome:'–'}</td>
      <td class="adm-td-trunc" title="${(r.descricao||'').replace(/"/g,'&quot;')}">${r.descricao||r.titulo||'–'}</td>
      <td>${r.solicitante_nome||'–'}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td>
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

// ── HASH ──
window.addEventListener('hashchange',()=>{if(location.hash==='#admin') admInit();});
window.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#admin') admInit();});
