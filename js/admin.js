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

// Ponto de entrada da rota #admin — DESCONTINUADO. Este painel (login,
// dashboard, gestão de chamados/técnicos/clientes e o fluxo legado de peças
// admFaturarPecas/admDespacharPecas/admConfirmarEntregaPecas, que lia
// chamados.pecas_status) não é mais usado: o ERP real em erp.teffe.com.br
// (repositório teffe-erp) assumiu tudo isso, incluindo o fluxo de peças
// correto (tabela chamado_pecas_pendentes, já consumida pelo portal do
// técnico — ver _tecEnriquecerPecasPendentes em js/supabase.js).
//
// Ninguém no site linka para #admin (confirmado: nenhuma ocorrência em
// index.html fora deste próprio arquivo) e nenhuma outra parte ativa do site
// depende de código deste arquivo rodando — todas as chamadas cruzadas
// (js/admin.js → outros arquivos) são guardadas com `typeof x==='function'`,
// e a única chamada no sentido inverso (confirmarAlterarSenha() em
// js/supabase.js, branch `portal==='adm'`) só é alcançada a partir daqui
// mesmo. Por isso é seguro remover o resto deste arquivo e o bloco
// #admin-panel/#adm-login-bg de index.html num cleanup futuro; por ora só a
// rota foi desligada (login antigo trocado por um aviso com link pro ERP),
// para não deixar a URL simplesmente quebrada.
function admInit(){
  document.getElementById('adm-descontinuado-bg').classList.add('open');
  history.replaceState(null,'','#admin');
}
function admFecharDescontinuado(){
  document.getElementById('adm-descontinuado-bg').classList.remove('open');
  history.replaceState(null,'',location.pathname);
}

// ── NAVEGAÇÃO ──
function admMostrarView(id){
  document.querySelectorAll('.adm-view').forEach(v=>v.classList.remove('adm-active'));
  document.getElementById('adm-view-'+id).classList.add('adm-active');
  document.querySelectorAll('.adm-nav-item').forEach(i=>i.classList.remove('adm-nav-active'));
  const nav=document.querySelector('[data-adm-view="'+id+'"]');
  if(nav) nav.classList.add('adm-nav-active');
  if(id==='dash'){admCarregarDashboard();admMostrarAvisoDescontinuacao();}
  else if(id==='tecnicos') admCarregarTecnicos();
  else if(id==='clientes') admCarregarClientes();
  else if(id==='chamados'){admAtualizarFiltroTec();admCarregarChamados();}
}

// ── AVISO DE DESCONTINUAÇÃO ──
function admMostrarAvisoDescontinuacao(){
  var aviso=document.getElementById('adm-aviso-descontinuacao');
  if(aviso) return; // já existe
  var el=document.createElement('div');
  el.id='adm-aviso-descontinuacao';
  el.style.cssText='background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px;color:#92400E;';
  el.innerHTML='<i class="ti ti-alert-triangle" style="font-size:18px;flex-shrink:0"></i>' +
    '<span><strong>Este painel será descontinuado.</strong> ' +
    'Todas as funcionalidades estão disponíveis no novo ERP: ' +
    '<a href="https://erp.teffe.com.br" target="_blank" style="color:#1D4ED8;font-weight:700;text-decoration:underline">erp.teffe.com.br</a></span>';
  var dashView=document.getElementById('adm-view-dash');
  if(dashView) dashView.insertBefore(el,dashView.firstChild);
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
  const {data,ok}=await admHttp('/rest/v1/clientes?select=*&order=razao_social.asc');
  console.log('[admCarregarClientes] ok:', ok, '| rows:', data&&data.length);
  const el=document.getElementById('adm-lista-clientes');
  if(!ok||!data||!data.length){el.innerHTML='<div class="ac-empty">Nenhum cliente cadastrado.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Código</th><th>Empresa</th><th>CNPJ</th><th>Técnico responsável</th><th></th></tr></thead><tbody>'+
    data.map(c=>`<tr>
      <td><code>${c.codigo||'–'}</code></td>
      <td><b>${c.razao_social||c.fantasia||'–'}</b><br><small style="color:#6B7280">${c.fantasia&&c.razao_social?c.fantasia:''}</small></td>
      <td>${c.cnpj||'–'}</td>
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
var _admChamData=[]; // cache da última listagem carregada, pra abrir detalhe por id

async function admCarregarChamados(){
  if(!_admTecs.length) await admCarregarTecnicos();
  const filtroStatus=document.getElementById('adm-filtro-status').value;
  const filtroTec=document.getElementById('adm-filtro-tec').value;
  let q='/rest/v1/chamados?select=*&order=created_at.desc';
  if(filtroStatus&&filtroStatus!=='todos') q+='&status=eq.'+filtroStatus;
  if(filtroTec==='is_null') q+='&tecnico_id=is.null';
  else if(filtroTec&&filtroTec!=='todos') q+='&tecnico_id=eq.'+filtroTec;
  const {data,ok,status:httpSt}=await admHttp(q);
  console.log('[admCarregarChamados] ok:', ok, '| status:', httpSt, '| rows:', data&&data.length);
  const el=document.getElementById('adm-lista-chamados');
  if(!ok||!data){el.innerHTML='<div class="ac-empty">Erro ao carregar chamados (HTTP '+httpSt+'). Verifique o console.</div>';return;}
  if(!data.length){_admChamData=[];el.innerHTML='<div class="ac-empty">Nenhum chamado encontrado com os filtros selecionados.</div>';return;}
  _admChamData=data;

  // Carrega nomes de clientes em uma única query
  var clienteMap={};
  try{
    var cliIds=[...new Set(data.map(r=>r.cliente_id).filter(Boolean))];
    if(cliIds.length){
      var cr=await admHttp('/rest/v1/clientes?id=in.('+cliIds.join(',')+')'+'&select=id,razao_social,fantasia,codigo');
      _arrOuVazio(cr).forEach(c=>{clienteMap[c.id]=c;});
    }
  }catch(e){console.warn('[admCarregarChamados] erro ao carregar clientes:', e);}

  const psLabel={solicitado:'⚠️ Solicitado',faturado:'Faturado',despachado:'Despachado',entregue:'✅ Entregue'};
  el.innerHTML='<table class="ac-table"><thead><tr><th>#</th><th>Cliente</th><th>Descrição</th><th>Solicitante</th><th>Status</th><th>Peças</th><th>Técnico</th><th>Data</th></tr></thead><tbody>'+
    data.map(r=>{
      const cli=clienteMap[r.cliente_id];
      const cliNome=cli?(cli.razao_social||cli.fantasia||'–'):'–';
      const ps=r.pecas_status;
      const pecasBadge=ps?`<span class="tec-pecas-badge tec-pecas-${ps}">${psLabel[ps]||ps}</span>`:'–';
      const pecasBtn=ps==='solicitado'?`<button class="adm-btn adm-btn-sm" style="margin-top:4px;font-size:11px;" onclick="event.stopPropagation();admFaturarPecas('${r.id}')">Faturar</button>`:
        ps==='faturado'?`<button class="adm-btn adm-btn-sm" style="margin-top:4px;font-size:11px;" onclick="event.stopPropagation();admDespacharPecas('${r.id}')">Despachar</button>`:
        ps==='despachado'?`<button class="adm-btn adm-btn-sm" style="margin-top:4px;font-size:11px;" onclick="event.stopPropagation();admConfirmarEntregaPecas('${r.id}','${r.tecnico_id||''}','${r.numero||r.id.slice(0,6)}')">Confirmar Entrega</button>`:'';
      return `<tr style="cursor:pointer;" onclick="admAbrirDetalhe('${r.id}')">
        <td><b>O.S. ${r.numero||r.id.slice(0,6)}</b></td>
        <td>${cliNome}</td>
        <td class="adm-td-trunc" title="${(r.descricao||'').replace(/"/g,'&quot;')}">${r.descricao||r.titulo||'–'}</td>
        <td>${r.solicitante_nome||'–'}</td>
        <td><span class="badge badge-${r.status}">${r.status}</span></td>
        <td onclick="event.stopPropagation()" style="white-space:nowrap;">${pecasBadge}${pecasBtn?`<br>${pecasBtn}`:''}</td>
        <td onclick="event.stopPropagation()">
          <select class="adm-sel-inline" onchange="admRedistribuir('${r.id}',this.value)">
            <option value="">Sem técnico</option>
            ${_admTecs.map(t=>`<option value="${t.id}"${t.id===r.tecnico_id?' selected':''}>${t.nome}</option>`).join('')}
          </select>
        </td>
        <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
      </tr>`;
    }).join('')+'</tbody></table>';
}

async function admRedistribuir(chamadoId,tecnicoId){
  const {ok}=await admHttp('/rest/v1/chamados?id=eq.'+chamadoId,{
    method:'PATCH',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({tecnico_id:tecnicoId||null})
  });
  if(!ok) alert('Erro ao redistribuir chamado. Verifique permissões no Supabase.');
}

// ── FLUXO DE PEÇAS ──
async function admFaturarPecas(id){
  const {ok}=await admHttpUser('/rest/v1/chamados?id=eq.'+id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({pecas_status:'faturado'})});
  if(!ok){alert('Erro ao atualizar status de peças.');return;}
  admCarregarChamados();
}

async function admDespacharPecas(id){
  const {ok}=await admHttpUser('/rest/v1/chamados?id=eq.'+id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({pecas_status:'despachado'})});
  if(!ok){alert('Erro ao atualizar status de peças.');return;}
  admCarregarChamados();
}

async function admConfirmarEntregaPecas(id,tecnicoId,numChamado){
  const {ok}=await admHttpUser('/rest/v1/chamados?id=eq.'+id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({pecas_status:'entregue'})});
  if(!ok){alert('Erro ao confirmar entrega.');return;}
  if(tecnicoId){
    const tec=_admTecs.find(t=>t.id===tecnicoId);
    if(tec&&tec.email){
      const {data:{session}}=await _supabase.auth.getSession();
      if(session){
        const html=`<p>Olá <strong>${tec.nome||'Técnico'}</strong>,</p><p>As peças solicitadas para o chamado <strong>O.S. ${numChamado}</strong> foram entregues e estão disponíveis. Por favor, acesse o portal e inicie o atendimento.</p><p>Atenciosamente,<br><strong>Teffe Tecnologia</strong></p>`;
        fetch(ADMIN_URL+'/functions/v1/enviar-email',{method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
          body:JSON.stringify({to:tec.email,subject:`Peças Disponíveis — Chamado O.S. ${numChamado} — Teffe Tecnologia`,html})
        }).catch(()=>{});
      }
    }
  }
  admCarregarChamados();
}

// ── MODAL DETALHE CHAMADO ──
// Recebe o ID (não o objeto inteiro) e busca no cache _admChamData — passar
// o registro completo via JSON.stringify(JSON.stringify(...)) dentro de um
// onclick="..." quebrava sempre que descricao/solicitante_nome tinha aspas
// (o JSON escapado colide com o delimitador do próprio atributo HTML).
async function admAbrirDetalhe(id){
  const c=_admChamData.find(r=>r.id===id);
  if(!c) return;
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
      <div class="adm-det-row"><span class="adm-det-label">Número</span><span class="adm-det-val">O.S. ${c.numero||c.id.slice(0,6)}</span></div>
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
    ${c.data_encerramento?`<div class="adm-det-row" style="margin-top:12px;"><span class="adm-det-label">Data de encerramento</span><span class="adm-det-val">${fmt(c.data_encerramento)}</span></div>`:''}
  `;
  document.getElementById('adm-detalhe-btn-os').onclick=()=>admImprimirOS(c);
  document.getElementById('adm-detalhe-bg').classList.add('open');
}

function admFecharDetalhe(){
  document.getElementById('adm-detalhe-bg').classList.remove('open');
}

// ── NOVO CHAMADO (admin) ──
async function admAbrirNovoChamado(){
  try {
    if(!_admTecs.length) await admCarregarTecnicos();

    // Clientes — select=* evita 400 por colunas inexistentes
    const {data:clis}=await admHttp('/rest/v1/clientes?select=*&order=razao_social.asc');
    const selCli=document.getElementById('adm-nc-cliente');
    selCli.innerHTML='<option value="">Selecione o cliente...</option>';
    (Array.isArray(clis)?clis:[]).forEach(c=>{
      const o=document.createElement('option');
      o.value=c.id;
      o.textContent=c.razao_social||c.empresa||c.fantasia||c.nome||c.id;
      selCli.appendChild(o);
    });

    // Técnicos
    const selTec=document.getElementById('adm-nc-tec');
    selTec.innerHTML='<option value="">Sem técnico atribuído</option>';
    (Array.isArray(_admTecs)?_admTecs:[]).forEach(t=>{
      const o=document.createElement('option');
      o.value=t.id; o.textContent=t.nome;
      selTec.appendChild(o);
    });

    // Reset campos
    document.getElementById('adm-nc-equip').innerHTML='<option value="">Selecione o cliente primeiro...</option>';
    document.getElementById('adm-nc-tipo').value='instalacao';
    document.getElementById('adm-nc-prio').value='normal';
    document.getElementById('adm-nc-desc').value='';
    document.getElementById('adm-nc-data').value=new Date().toISOString().slice(0,10);
    const erroEl=document.getElementById('adm-novo-cham-erro');
    erroEl.style.display='none'; erroEl.textContent='';
    const btn=document.getElementById('adm-nc-btn-salvar');
    btn.disabled=false; btn.innerHTML='<i class="ti ti-check"></i> Criar Chamado';

    document.getElementById('adm-novo-cham-bg').classList.add('open');
  } catch(e) {
    console.error('[admAbrirNovoChamado]', e);
    alert('Erro ao abrir formulário: '+e.message);
  }
}

async function admNcOnClienteChange(){
  const clienteId=document.getElementById('adm-nc-cliente').value;
  const sel=document.getElementById('adm-nc-equip');
  if(!clienteId){sel.innerHTML='<option value="">Selecione o cliente primeiro...</option>';return;}
  sel.innerHTML='<option value="">Carregando equipamentos...</option>';
  try{
    // Busca contratos ativos do cliente
    const {data:contratos}=await admHttp('/rest/v1/contratos?cliente_id=eq.'+clienteId+'&status=eq.ativo&select=id');
    if(!contratos||!contratos.length){
      sel.innerHTML='<option value="">Nenhum contrato ativo para este cliente</option>';
      return;
    }
    const contratoIds=contratos.map(c=>c.id).join(',');
    // Busca equipamentos via vínculo
    const {data:vinculos}=await admHttp('/rest/v1/contrato_equipamentos?contrato_id=in.('+contratoIds+')&select=*,equipamentos(*)');
    const equips=(vinculos||[]).map(v=>v.equipamentos).filter(Boolean);
    sel.innerHTML='<option value="">— Sem equipamento específico —</option>';
    equips.forEach(e=>{
      const o=document.createElement('option');
      o.value=e.id;
      const serial=e.serial||e.codigo_teffe;
      o.textContent=(e.marca?e.marca+' ':'')+(e.modelo||'–')+(serial?' — '+serial:'');
      sel.appendChild(o);
    });
    if(!equips.length) sel.innerHTML='<option value="">Nenhum equipamento vinculado ao contrato</option>';
  }catch(err){
    console.error('[admNcOnClienteChange]',err);
    sel.innerHTML='<option value="">Erro ao carregar equipamentos</option>';
  }
}

async function admSalvarNovoChamado(){
  const clienteId=document.getElementById('adm-nc-cliente').value;
  const desc=document.getElementById('adm-nc-desc').value.trim();
  const erroEl=document.getElementById('adm-novo-cham-erro');
  const btn=document.getElementById('adm-nc-btn-salvar');
  erroEl.style.display='none';
  if(!clienteId){erroEl.style.display='block';erroEl.textContent='Selecione o cliente.';return;}
  if(!desc){erroEl.style.display='block';erroEl.textContent='Informe a descrição do chamado.';return;}
  btn.disabled=true; btn.textContent='Criando...';
  const hoje=new Date().toISOString().slice(0,10);
  const payload={
    tipo_chamado:document.getElementById('adm-nc-tipo').value,
    cliente_id:clienteId,
    equipamento_id:document.getElementById('adm-nc-equip').value||null,
    tecnico_id:document.getElementById('adm-nc-tec').value||null,
    descricao:desc,
    prioridade:document.getElementById('adm-nc-prio').value,
    data_prevista:document.getElementById('adm-nc-data').value||null,
    data_abertura:hoje,
    status:'aberto'
  };
  const {ok,data}=await admHttpUser('/rest/v1/chamados',{
    method:'POST',headers:{'Prefer':'return=minimal'},
    body:JSON.stringify(payload)
  });
  btn.disabled=false; btn.innerHTML='<i class="ti ti-check"></i> Criar Chamado';
  if(!ok){erroEl.style.display='block';erroEl.textContent=data&&data.message?data.message:'Erro ao criar chamado. Verifique permissões RLS no Supabase.';return;}
  admFecharNovoChamado();
  admCarregarChamados();
}

function admFecharNovoChamado(){
  document.getElementById('adm-novo-cham-bg').classList.remove('open');
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
    ['Número',`O.S. ${num}`],
    ['Data/Hora de Abertura',fmt(c.created_at)],
    ['Status',statusLabels[c.status]||c.status],
    ['Tipo de Chamado','Assistência Técnica'],
    c.solicitante_nome&&['Solicitante',c.solicitante_nome],
    c.solicitante_telefone&&['Telefone do Solicitante',c.solicitante_telefone],
    c.solicitante_email&&['E-mail do Solicitante',c.solicitante_email],
    c.prioridade&&['Prioridade',prioLabels[c.prioridade]||c.prioridade],
    c.tecnico&&['Técnico Responsável',c.tecnico],
    c.data_encerramento&&['Data/Hora de Encerramento',fmt(c.data_encerramento)],
  ].filter(Boolean);

  const rowsHTML=rows.map(([l,v])=>`<tr><th>${l}</th><td>${v}</td></tr>`).join('');

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
