'use strict';
const ADMIN_URL='https://hlfjcpgrxiktgctozilk.supabase.co';
const ADMIN_ANON='sb_publishable_-Iu8PbqhLeZAXSBcczr2mQ_lzlGr4_g';
// ADMIN_SRK é carregado de js/admin-keys.js (arquivo no .gitignore, nunca commitar)
// Se typeof ADMIN_SRK === 'undefined', o painel funcionará sem criar logins no Auth.

let _admTok=null,_admNome='',_admTecs=[];

// ── HTTP ──
async function admHttp(path,opts){
  const srk=typeof ADMIN_SRK!=='undefined'&&ADMIN_SRK&&ADMIN_SRK!=='COLE_SUA_SERVICE_ROLE_KEY_AQUI';
  const key=srk?ADMIN_SRK:ADMIN_ANON;
  const token=srk?ADMIN_SRK:(_admTok||ADMIN_ANON);
  const h={'apikey':key,'Content-Type':'application/json','Authorization':'Bearer '+token};
  const r=await fetch(ADMIN_URL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok};
}
async function admAuthCheck(uid,token){
  const r=await fetch(ADMIN_URL+'/rest/v1/admins?user_id=eq.'+uid+'&limit=1&select=nome',{
    headers:{'apikey':ADMIN_ANON,'Authorization':'Bearer '+token}
  });
  return r.json().catch(()=>[]);
}

// ── LOGIN / LOGOUT ──
async function admFazerLogin(){
  const email=document.getElementById('adm-email').value.trim();
  const senha=document.getElementById('adm-senha').value;
  const erroEl=document.getElementById('adm-login-erro');
  const btn=document.getElementById('adm-btn-entrar');
  if(!email||!senha){erroEl.style.display='block';erroEl.textContent='Preencha e-mail e senha.';return;}
  btn.textContent='Entrando...';btn.disabled=true;erroEl.style.display='none';
  const r=await fetch(ADMIN_URL+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{'apikey':ADMIN_ANON,'Content-Type':'application/json'},
    body:JSON.stringify({email,password:senha})
  });
  const d=await r.json();
  if(!r.ok){erroEl.style.display='block';erroEl.textContent='Credenciais inválidas.';btn.textContent='Entrar →';btn.disabled=false;return;}
  const adm=await admAuthCheck(d.user.id,d.access_token);
  if(!adm||!adm.length){
    erroEl.style.display='block';erroEl.textContent='Acesso negado. Usuário sem permissão de administrador.';
    btn.textContent='Entrar →';btn.disabled=false;return;
  }
  _admTok=d.access_token;_admNome=adm[0].nome||email;
  document.getElementById('adm-login-bg').classList.remove('open');
  document.getElementById('adm-nome-display').textContent=_admNome;
  document.getElementById('adm-email').value='';document.getElementById('adm-senha').value='';
  btn.textContent='Entrar →';btn.disabled=false;
  await admCarregarTecnicos();
  admMostrarView('dash');
}

function admFazerLogout(){
  _admTok=null;_admNome='';_admTecs=[];
  document.getElementById('admin-panel').style.display='none';
  history.replaceState(null,'',location.pathname);
}

function admFecharLogin(){
  document.getElementById('adm-login-bg').classList.remove('open');
  document.getElementById('admin-panel').style.display='none';
  history.replaceState(null,'',location.pathname);
}

function admInit(){
  document.getElementById('admin-panel').style.display='block';
  history.replaceState(null,'','#admin');
  if(_admTok){
    admCarregarTecnicos().then(()=>admMostrarView('dash'));
  } else {
    document.getElementById('adm-login-bg').classList.add('open');
  }
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
  const srkOk=typeof ADMIN_SRK!=='undefined'&&ADMIN_SRK&&ADMIN_SRK!=='COLE_SUA_SERVICE_ROLE_KEY_AQUI';
  if(srkOk){
    const r=await fetch(ADMIN_URL+'/auth/v1/admin/users',{
      method:'POST',
      headers:{'apikey':ADMIN_SRK,'Authorization':'Bearer '+ADMIN_SRK,'Content-Type':'application/json'},
      body:JSON.stringify({email,password:senha,email_confirm:true,user_metadata:{role:'tecnico',nome}})
    });
    const authUser=await r.json().catch(()=>null);
    if(!r.ok){
      erroEl.style.display='block';
      erroEl.textContent='Erro ao criar login: '+(authUser&&authUser.message?authUser.message:'verifique a service role key.');
      btn.disabled=false;btn.textContent='Criar Técnico';return;
    }
    if(authUser&&authUser.id) userId=authUser.id;
  }
  const {ok,data:errD}=await admHttp('/rest/v1/tecnicos',{
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
