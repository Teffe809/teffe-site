const SURL='https://hlfjcpgrxiktgctozilk.supabase.co';
const SKEY='sb_publishable_-Iu8PbqhLeZAXSBcczr2mQ_lzlGr4_g';
let _tok=null,_uid=null;
async function sf(path,opts){
  const h={'apikey':SKEY,'Content-Type':'application/json'};
  if(_tok) h['Authorization']='Bearer '+_tok;
  const r=await fetch(SURL+path,{...opts,headers:{...h,...(opts&&opts.headers||{})}});
  return {data:await r.json().catch(()=>null),ok:r.ok};
}
async function fazerLogin(){
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const erro=document.getElementById('login-erro');
  const btn=document.getElementById('btn-entrar');
  if(!email||!senha){erro.style.display='block';erro.textContent='Preencha e-mail e senha.';return;}
  btn.textContent='Entrando...';btn.disabled=true;erro.style.display='none';
  const r=await fetch(SURL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SKEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:senha})});
  const d=await r.json();
  if(!r.ok){erro.style.display='block';erro.textContent='E-mail ou senha incorretos.';btn.textContent='Entrar →';btn.disabled=false;return;}
  _tok=d.access_token;_uid=d.user.id;
  localStorage.setItem('tt',_tok);localStorage.setItem('tu',_uid);
  document.getElementById('modal').classList.remove('open');
  carregarArea();
}
async function fazerLogout(){
  _tok=null;_uid=null;localStorage.removeItem('tt');localStorage.removeItem('tu');
  document.getElementById('area-cliente').style.display='none';
}
async function carregarArea(){
  document.getElementById('area-cliente').style.display='block';
  const {data:cl}=await sf('/rest/v1/clientes?user_id=eq.'+_uid+'&limit=1&select=*');
  const c=cl&&cl[0];
  document.getElementById('ac-nome').textContent=c?c.nome.split(' ')[0]:'Cliente';
  document.getElementById('ac-empresa').textContent=c?c.empresa:'Minha Área';
  const cid=c?c.id:null;
  carregarChamados(cid);carregarEquips(cid);carregarContratos(cid);
}
async function carregarChamados(cid){
  const el=document.getElementById('lista-cham');
  if(!cid){el.innerHTML='<div class="ac-empty">Nenhum chamado.</div>';document.getElementById('n-cham').textContent='0';return;}
  const {data:rows}=await sf('/rest/v1/chamados?cliente_id=eq.'+cid+'&order=created_at.desc&select=*');
  document.getElementById('n-cham').textContent=rows?rows.filter(r=>r.status==='aberto').length:0;
  if(!rows||!rows.length){el.innerHTML='<div class="ac-empty">Nenhum chamado. Tudo certo! ✅</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>#</th><th>Título</th><th>Status</th><th>Prioridade</th><th>Data</th></tr></thead><tbody>'+rows.map(r=>`<tr><td><b>#${r.numero||r.id.slice(0,6)}</b></td><td>${r.titulo}</td><td><span class="badge badge-${r.status}">${r.status}</span></td><td><span class="badge badge-${r.prioridade}">${r.prioridade}</span></td><td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td></tr>`).join('')+'</tbody></table>';
}
async function carregarEquips(cid){
  const el=document.getElementById('lista-equip');
  if(!cid){el.innerHTML='<div class="ac-empty">Nenhum equipamento.</div>';document.getElementById('n-equip').textContent='0';return;}
  const {data:rows}=await sf('/rest/v1/equipamentos?cliente_id=eq.'+cid+'&select=*');
  document.getElementById('n-equip').textContent=rows?rows.length:0;
  if(!rows||!rows.length){el.innerHTML='<div class="ac-empty">Nenhum equipamento.</div>';return;}
  document.getElementById('nc-equip').innerHTML='<option value="">Selecione</option>'+rows.map(e=>`<option value="${e.id}">${e.marca} ${e.modelo}</option>`).join('');
  el.innerHTML='<table class="ac-table"><thead><tr><th>Modelo</th><th>Marca</th><th>Série</th><th>Local</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>`<tr><td><b>${r.modelo}</b></td><td>${r.marca||'–'}</td><td>${r.serial||'–'}</td><td>${r.localizacao||'–'}</td><td><span class="badge badge-ativo-c">${r.status}</span></td></tr>`).join('')+'</tbody></table>';
}
async function carregarContratos(cid){
  const el=document.getElementById('lista-cont');
  if(!cid){el.innerHTML='<div class="ac-empty">Nenhum contrato.</div>';document.getElementById('n-cont').textContent='0';return;}
  const {data:rows}=await sf('/rest/v1/contratos?cliente_id=eq.'+cid+'&select=*');
  document.getElementById('n-cont').textContent=rows?rows.filter(r=>r.status==='ativo').length:0;
  if(!rows||!rows.length){el.innerHTML='<div class="ac-empty">Nenhum contrato.</div>';return;}
  el.innerHTML='<table class="ac-table"><thead><tr><th>Nº</th><th>Descrição</th><th>Vigência</th><th>Valor</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>`<tr><td><b>${r.numero}</b></td><td>${r.descricao||'–'}</td><td>${r.data_inicio?new Date(r.data_inicio).toLocaleDateString('pt-BR'):'–'} → ${r.data_fim?new Date(r.data_fim).toLocaleDateString('pt-BR'):'–'}</td><td>${r.valor_mensal?'R$ '+Number(r.valor_mensal).toLocaleString('pt-BR',{minimumFractionDigits:2}):'–'}</td><td><span class="badge badge-ativo-c">${r.status}</span></td></tr>`).join('')+'</tbody></table>';
}
async function enviarChamado(){
  const titulo=document.getElementById('nc-titulo').value.trim();
  if(!titulo){alert('Informe o título.');return;}
  const {data:cl}=await sf('/rest/v1/clientes?user_id=eq.'+_uid+'&limit=1&select=id');
  if(!cl||!cl[0]){alert('Erro ao identificar cliente.');return;}
  await sf('/rest/v1/chamados',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify({cliente_id:cl[0].id,titulo,descricao:document.getElementById('nc-desc').value,prioridade:document.getElementById('nc-prior').value,status:'aberto'})});
  document.getElementById('ncModal').classList.remove('open');
  document.getElementById('nc-titulo').value='';document.getElementById('nc-desc').value='';
  const {data:novoChamado} = await sf('/rest/v1/chamados?cliente_id=eq.'+cl[0].id+'&order=created_at.desc&limit=1&select=numero');
  const num = novoChamado && novoChamado[0] ? novoChamado[0].numero : '';
  alert('✅ Chamado #' + num + ' aberto com sucesso!\nNossa equipe entrará em contato em breve.');
  carregarChamados(cl[0].id);
}
window.addEventListener('DOMContentLoaded',()=>{
  const t=localStorage.getItem('tt'),u=localStorage.getItem('tu');
  if(t&&u){_tok=t;_uid=u;carregarArea();}
});
