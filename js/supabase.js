const SURL='https://hlfjcpgrxiktgctozilk.supabase.co';
const SKEY='sb_publishable_-Iu8PbqhLeZAXSBcczr2mQ_lzlGr4_g';
let _tok=null,_uid=null,_cid=null,_atEquipId=null,_spEquipId=null,_spUltimoContador=null;

async function sf(path,opts){
  const h={'apikey':SKEY,'Content-Type':'application/json'};
  if(_tok) h['Authorization']='Bearer '+_tok;
  const r=await fetch(SURL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok,status:r.status};
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
  _tok=d.access_token;_uid=d.user.id;
  localStorage.setItem('tt',_tok);localStorage.setItem('tu',_uid);
  document.getElementById('modal').classList.remove('open');
  carregarArea();
}

async function fazerLogout(){
  _tok=null;_uid=null;_cid=null;
  localStorage.removeItem('tt');localStorage.removeItem('tu');
  document.getElementById('area-cliente').style.display='none';
}

// ── CARREGAR ÁREA ──
async function carregarArea(){
  document.getElementById('area-cliente').style.display='block';
  const {data:cl}=await sf('/rest/v1/clientes?user_id=eq.'+_uid+'&limit=1&select=*');
  const c=cl&&cl[0];
  _cid=c?c.id:null;
  document.getElementById('ac-nome').textContent=c?c.nome.split(' ')[0]:'Cliente';
  document.getElementById('ac-empresa').textContent=c?c.empresa:'Minha Área';
  acMostrarView('dash');
  carregarChamados();
  carregarEquips();
  carregarContratos();
}

// ── NAVEGAÇÃO ENTRE VIEWS ──
function acMostrarView(id){
  document.querySelectorAll('.ac-view').forEach(v=>v.classList.remove('ac-view-active'));
  document.getElementById('ac-view-'+id).classList.add('ac-view-active');
  document.getElementById('area-cliente').scrollTop=0;
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
    sf('/rest/v1/solicitacoes_suprimento?cliente_id=eq.'+_cid+'&order=created_at.desc&select=*')
  ]);
  const chamados=(rCh.data||[]).map(r=>({...r,_tipo:'assistencia'}));
  const suprimentos=(rSp.data||[]).map(r=>({...r,titulo:'Suprimento #'+r.numero,_tipo:'suprimento'}));
  const todos=[...chamados,...suprimentos].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  document.getElementById('n-cham').textContent=todos.filter(r=>r.status==='aberto').length;
  if(!todos.length){el.innerHTML='<div class="ac-empty">Nenhum chamado ainda.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>#</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Data</th></tr></thead><tbody>'+
    todos.map(r=>`<tr>
      <td><b>#${r.numero||r.id.slice(0,6)}</b></td>
      <td><span class="badge ${r._tipo==='suprimento'?'badge-suprim':'badge-assist'}">${r._tipo==='suprimento'?'Suprimentos':'Assistência'}</span></td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.titulo||r.descricao||'–'}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
    </tr>`).join('')+
    '</tbody></table>';
}

// ── EQUIPAMENTOS ──
async function carregarEquips(){
  const el=document.getElementById('lista-equip');
  if(!_cid){el.innerHTML='<div class="ac-empty">Nenhum equipamento.</div>';document.getElementById('n-equip').textContent='0';return;}
  const {data:rows}=await sf('/rest/v1/equipamentos?cliente_id=eq.'+_cid+'&select=*');
  document.getElementById('n-equip').textContent=rows?rows.length:0;
  if(!rows||!rows.length){el.innerHTML='<div class="ac-empty">Nenhum equipamento.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Modelo</th><th>Marca</th><th>Série</th><th>Código</th><th>Local</th><th>Status</th></tr></thead><tbody>'+
    rows.map(r=>`<tr>
      <td><b>${r.modelo||'–'}</b></td>
      <td>${r.marca||'–'}</td>
      <td>${r.serial||'–'}</td>
      <td>${r.codigo||'–'}</td>
      <td>${r.localizacao||'–'}</td>
      <td><span class="badge badge-ativo-c">${r.status||'ativo'}</span></td>
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

// ── BUSCAR EQUIPAMENTO POR SERIAL / CÓDIGO ──
async function buscarEquipAC(prefix){
  const raw=document.getElementById(prefix+'-serial').value.trim().toUpperCase();
  const infoEl=document.getElementById(prefix+'-equip-info');
  if(!raw){alert('Informe o serial ou código do equipamento.');return;}
  if(!_cid){alert('Sessão inválida. Faça login novamente.');return;}
  // Se o cliente digitar "TEFFE-AWI3", extrai só os 4 chars finais para buscar no campo codigo
  const codigo=raw.startsWith('TEFFE-')?raw.slice(6):raw;
  const encSerial=encodeURIComponent(raw);
  const encCodigo=encodeURIComponent(codigo);
  const {data}=await sf('/rest/v1/equipamentos?cliente_id=eq.'+_cid+'&or=(serial.eq.'+encSerial+',codigo.eq.'+encCodigo+')&limit=1&select=*');
  if(!data||!data.length){
    infoEl.style.display='block';
    infoEl.className='ac-equip-info ac-equip-not-found';
    infoEl.innerHTML='<i class="ti ti-alert-circle"></i> Equipamento não encontrado. Verifique o serial ou código.';
    if(prefix==='at') _atEquipId=null;
    else{_spEquipId=null;document.getElementById('sp-insumo').innerHTML='<option value="">Equipamento não encontrado</option>';}
    return;
  }
  const eq=data[0];
  if(prefix==='at') _atEquipId=eq.id;
  else{_spEquipId=eq.id;carregarInsumos(eq.modelo);}
  infoEl.style.display='block';
  infoEl.className='ac-equip-info ac-equip-found';
  infoEl.innerHTML=`<div class="ac-equip-found-grid">
    <div><span class="ac-equip-lbl">Modelo</span><span class="ac-equip-val">${eq.modelo||'–'}</span></div>
    <div><span class="ac-equip-lbl">Marca</span><span class="ac-equip-val">${eq.marca||'–'}</span></div>
    <div><span class="ac-equip-lbl">Série</span><span class="ac-equip-val">${eq.serial||'–'}</span></div>
    <div><span class="ac-equip-lbl">Código</span><span class="ac-equip-val">${eq.codigo||'–'}</span></div>
  </div>`;
}

// ── CARREGAR INSUMOS DO MODELO ──
async function carregarInsumos(modelo){
  const sel=document.getElementById('sp-insumo');
  sel.innerHTML='<option value="">Carregando...</option>';
  const {data}=await sf('/rest/v1/insumos?modelo_equipamento=eq.'+encodeURIComponent(modelo)+'&ativo=eq.true&select=*');
  if(!data||!data.length){sel.innerHTML='<option value="">Nenhum insumo cadastrado para este modelo</option>';return;}
  sel.innerHTML='<option value="">Selecione o insumo</option>'+
    data.map(i=>`<option value="${i.id}">${i.codigo_insumo?'['+i.codigo_insumo+'] ':''}${i.descricao}</option>`).join('');
}

// ── VALIDAR CONTADOR ──
async function validarContador(){
  if(!_spEquipId) return;
  const val=parseInt(document.getElementById('sp-contador').value);
  const erroEl=document.getElementById('sp-contador-erro');
  const inputEl=document.getElementById('sp-contador');
  if(isNaN(val)){erroEl.style.display='none';inputEl.style.borderColor='';return;}
  const {data}=await sf('/rest/v1/solicitacoes_suprimento?equipamento_id=eq.'+_spEquipId+'&order=created_at.desc&limit=1&select=contador_atual');
  const ultimo=data&&data[0]&&data[0].contador_atual!=null?data[0].contador_atual:null;
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

  const {ok}=await sf('/rest/v1/chamados',{
    method:'POST',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({
      cliente_id:_cid,
      equipamento_id:_atEquipId,
      titulo:'Assistência – '+desc.slice(0,60),
      descricao:desc,
      tipo_chamado:'assistencia',
      solicitante_nome:nome,
      solicitante_telefone:tel,
      solicitante_email:email,
      imagem_url:imgUrl,
      status:'aberto',
      prioridade:'normal'
    })
  });
  if(!ok){alert('Erro ao abrir chamado. Tente novamente.');return;}

  ['at-nome','at-tel','at-email','at-desc','at-serial'].forEach(id=>document.getElementById(id).value='');
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
  const nome=document.getElementById('sp-nome').value.trim();
  const tel=document.getElementById('sp-tel').value.trim();
  const email=document.getElementById('sp-email').value.trim();
  const insumoId=document.getElementById('sp-insumo').value;
  const qtd=parseInt(document.getElementById('sp-qtd').value);
  const contador=parseInt(document.getElementById('sp-contador').value);
  if(!nome){alert('Informe o nome do solicitante.');return;}
  if(!insumoId){alert('Selecione o insumo.');return;}
  if(!qtd||qtd<1){alert('Informe a quantidade.');return;}
  if(isNaN(contador)){alert('Informe o contador atual.');return;}
  if(_spUltimoContador!==null&&contador<_spUltimoContador){
    alert('Contador inválido: o valor informado é menor que o último registrado ('+_spUltimoContador+').');
    return;
  }

  const {ok}=await sf('/rest/v1/solicitacoes_suprimento',{
    method:'POST',
    headers:{'Prefer':'return=minimal'},
    body:JSON.stringify({
      cliente_id:_cid,
      equipamento_id:_spEquipId,
      insumo_id:insumoId,
      quantidade:qtd,
      contador_atual:contador,
      solicitante_nome:nome,
      solicitante_telefone:tel,
      solicitante_email:email,
      status:'aberto'
    })
  });
  if(!ok){alert('Erro ao abrir solicitação. Tente novamente.');return;}

  ['sp-nome','sp-tel','sp-email','sp-serial'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('sp-qtd').value='1';
  document.getElementById('sp-contador').value='';
  document.getElementById('sp-contador').style.borderColor='';
  document.getElementById('sp-contador-erro').style.display='none';
  document.getElementById('sp-equip-info').style.display='none';
  document.getElementById('sp-insumo').innerHTML='<option value="">Busque o equipamento primeiro</option>';
  _spEquipId=null;_spUltimoContador=null;
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

window.addEventListener('DOMContentLoaded',()=>{
  const t=localStorage.getItem('tt'),u=localStorage.getItem('tu');
  if(t&&u){_tok=t;_uid=u;carregarArea();}
});
