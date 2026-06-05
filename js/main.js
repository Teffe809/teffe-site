


// ── EMAIL VIA EDGE FUNCTION ──
const _EDGE_EMAIL_URL = 'https://hlfjcpgrxiktgctozilk.supabase.co/functions/v1/enviar-email';

function _htmlTabela(titulo, linhas) {
  const rows = linhas.map(function([k, v]){
    return '<tr>' +
      '<td style="background:#f0f4fa;padding:8px 12px;font-weight:700;color:#1A3F80;width:170px;vertical-align:top;border-bottom:1px solid #EEF1F7">' + k + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #EEF1F7">' + v + '</td>' +
    '</tr>';
  }).join('');
  return '<div style="font-family:Arial,sans-serif;color:#222;max-width:640px">' +
    '<p style="font-size:15px;font-weight:700;color:#1A3F80;margin-bottom:12px">' + titulo + '</p>' +
    '<table style="border-collapse:collapse;width:100%;border:1px solid #EEF1F7;border-radius:8px;overflow:hidden">' + rows + '</table>' +
  '</div>';
}

async function _enviarEmail(to, subject, html) {
  const r = await fetch(_EDGE_EMAIL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: to, subject: subject, html: html })
  });
  if (!r.ok) {
    const err = await r.json().catch(function(){ return {}; });
    throw new Error('HTTP ' + r.status + ': ' + JSON.stringify(err));
  }
}

// ── PÁGINAS INSTITUCIONAIS ──
function openInstPage(e, id){
  if(e) e.preventDefault();
  closeAllPages();
  var pg = document.getElementById('page-' + id);
  if(pg){ pg.classList.add('open'); pg.scrollTop = 0; }
}
function closeInstPage(id){
  var pg = document.getElementById('page-' + id);
  if(pg) pg.classList.remove('open');
}

// ── UPLOAD CURRÍCULO ──
function tcDragOver(e){ e.preventDefault(); document.getElementById('tc-dropzone').style.borderColor='var(--azul2)'; }
function tcDrop(e){
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if(file) tcShowFile(file);
}
function tcFileSelected(input){
  if(input.files[0]) tcShowFile(input.files[0]);
}
function tcShowFile(file){
  const allowed = ['pdf','doc','docx','jpg','jpeg'];
  const ext = file.name.split('.').pop().toLowerCase();
  if(!allowed.includes(ext)){ alert('Formato não permitido. Use PDF, Word ou JPG.'); return; }
  if(file.size > 5*1024*1024){ alert('Arquivo muito grande. Máximo 5MB.'); return; }
  document.getElementById('tc-file-label').innerHTML = '<i class="ti ti-circle-check"></i> <strong>' + file.name + '</strong> selecionado';
  document.getElementById('tc-dropzone').style.borderColor = 'var(--azul2)';
  document.getElementById('tc-dropzone').style.background = 'rgba(37,99,196,.05)';
  window._tcFile = file;
}

async function enviarCurriculo(){
  const nome  = document.getElementById('tc-nome').value.trim();
  const email = document.getElementById('tc-email').value.trim();
  const tel   = document.getElementById('tc-tel').value.trim();
  const area  = document.getElementById('tc-area').value;
  const msg   = document.getElementById('tc-msg').value.trim();
  if(!nome||!email||!tel||!area){ alert('Preencha todos os campos obrigatórios (*)'); return; }
  if(!window._tcFile){ alert('Por favor anexe seu currículo.'); return; }

  const btn = document.querySelector('#page-trabalhe .btn-enviar');
  if(btn){ btn.textContent='Enviando...'; btn.disabled=true; }

  try {
    const file = window._tcFile;
    const safeNome = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = 'curriculos/' + Date.now() + '_' + safeNome;
    const uploadRes = await fetch(SURL + '/storage/v1/object/chamados/' + path, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SKEY, 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    const curriculoUrl = uploadRes.ok ? SURL + '/storage/v1/object/public/chamados/' + path : '';

    const areaEl = document.getElementById('tc-area');
    const areaLabel = areaEl.options[areaEl.selectedIndex]?.text || area;
    const linhas = [
      ['Nome', nome], ['E-mail', email], ['Telefone', tel], ['Área de interesse', areaLabel],
      ...(msg ? [['Mensagem', msg.replace(/\n/g,'<br>')]] : []),
      ...(curriculoUrl ? [['Currículo', `<a href="${curriculoUrl}" style="color:#1A3F80">Baixar currículo</a>`]] : [['Currículo', 'Falha no upload do arquivo']])
    ];
    await _enviarEmail(
      'contato@teffe.com.br',
      'Teffe — Currículo — ' + nome,
      _htmlTabela('Candidatura — Trabalhe Conosco', linhas)
    );

    if(btn){ btn.textContent='Enviar candidatura →'; btn.disabled=false; }
    window._tcFile=null;
    document.getElementById('tc-file-label').innerHTML='Clique para selecionar ou arraste o arquivo aqui';
    document.querySelectorAll('#page-trabalhe input,#page-trabalhe select,#page-trabalhe textarea').forEach(function(el){el.value='';});
    document.getElementById('tcSuccessModal').classList.add('open');
  } catch(err) {
    if(btn){ btn.textContent='Enviar candidatura →'; btn.disabled=false; }
    alert('Erro ao enviar. Por favor tente novamente ou entre em contato pelo WhatsApp.');
  }
}

// ── PÁGINAS DE SEGMENTO ──
function openSegPage(e, id){
  if(e) e.preventDefault();
  closeAllPages();
  var pg = document.getElementById('page-' + id);
  if(pg){ pg.classList.add('open'); pg.scrollTop = 0; }
}
function closeSegPage(id){
  var pg = document.getElementById('page-' + id);
  if(pg) pg.classList.remove('open');
}

// ── PÁGINAS DE EQUIPAMENTOS ──

function closeAllPages(){
  document.querySelectorAll('.equip-page').forEach(function(p){ p.classList.remove('open'); });
}
function openEquipPage(e, id){
  if(e) e.preventDefault();
  closeAllPages();
  var pg = document.getElementById('page-' + id);
  if(pg){ pg.classList.add('open'); pg.scrollTop = 0; }
}
function closeEquipPage(id){
  var pg = document.getElementById('page-' + id);
  if(pg) pg.classList.remove('open');
}


// ── MENU MOBILE ──
function toggleMobileMenu(){
  var menu = document.getElementById('mobileMenu');
  var btn = document.getElementById('hamburguer');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}
function closeMobileMenu(){
  document.getElementById('mobileMenu').classList.remove('open');
  document.getElementById('hamburguer').classList.remove('open');
}
function toggleMobileItem(el){
  var item = el.parentElement;
  var isOpen = item.classList.contains('expanded');
  document.querySelectorAll('.mobile-menu-item').forEach(function(i){ i.classList.remove('expanded'); });
  if(!isOpen) item.classList.add('expanded');
}
function toggleMobileSubSub(el){
  var item = el.parentElement;
  item.classList.toggle('expanded');
}
function closeMobileAndOpen(e, type, id){
  e && e.preventDefault();
  closeMobileMenu();
  closeAllPages();
  setTimeout(function(){
    if(type === 'equip') openEquipPage(null, id);
    else if(type === 'seg') openSegPage(null, id);
    else if(type === 'inst') openInstPage(null, id);
  }, 150);
}

// ── DROPDOWN COM DELAY ──
(function(){
  let closeTimers = [];
  
  document.querySelectorAll('.nav-item').forEach(function(item){
    let timer;
    
    item.addEventListener('mouseenter', function(){
      clearTimeout(timer);
      // Fechar outros dropdowns
      document.querySelectorAll('.nav-item .dropdown').forEach(d => d.classList.remove('show'));
      this.querySelector('.dropdown') && this.querySelector('.dropdown').classList.add('show');
    });
    
    item.addEventListener('mouseleave', function(){
      const self = this;
      timer = setTimeout(function(){
        self.querySelector('.dropdown') && self.querySelector('.dropdown').classList.remove('show');
        // Fechar subdrops também
        self.querySelectorAll('.sub-dropdown').forEach(s => s.classList.remove('show'));
      }, 200);
    });
  });

  // Submenu cascata com delay
  document.querySelectorAll('.has-sub').forEach(function(item){
    let subTimer;
    
    item.addEventListener('mouseenter', function(){
      clearTimeout(subTimer);
      // Fechar outros submenus
      document.querySelectorAll('.sub-dropdown').forEach(s => s.classList.remove('show'));
      this.querySelector('.sub-dropdown') && this.querySelector('.sub-dropdown').classList.add('show');
    });
    
    item.addEventListener('mouseleave', function(){
      const self = this;
      subTimer = setTimeout(function(){
        self.querySelector('.sub-dropdown') && self.querySelector('.sub-dropdown').classList.remove('show');
      }, 250);
    });
  });
})();

// ── MODAL LOGIN ──
function openModal(e){
  e&&e.preventDefault();
  const t=localStorage.getItem('tt'),u=localStorage.getItem('tu');
  if(t&&u&&typeof carregarArea==='function'){
    carregarArea(); // Já logado: vai direto para a área do cliente
  } else {
    document.getElementById('modal').classList.add('open');
  }
}
function closeModal(){
  document.getElementById('modal').classList.remove('open');
  document.getElementById('login-inatividade').style.display='none';
  document.getElementById('login-acesso-negado').style.display='none';
}
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ── MODAL ORÇAMENTO ──
function openOrca(e, solucao){
  e && e.preventDefault();
  const modal = document.getElementById('orcaModal');
  modal.classList.add('open');
  document.getElementById('orcaForm').style.display='block';
  document.getElementById('orcaSuccess').style.display='none';
  if(solucao){
    const sel = document.getElementById('of-solucao');
    for(let i=0;i<sel.options.length;i++){
      if(sel.options[i].value === solucao){ sel.selectedIndex=i; break; }
    }
    const tag = document.getElementById('orcaTag');
    tag.innerHTML = '<i class="ti ti-message-circle"></i> ' + solucao;
  }
}
function closeOrca(){document.getElementById('orcaModal').classList.remove('open');}
document.getElementById('orcaModal').addEventListener('click',function(e){if(e.target===this)closeOrca();});

// ── MODAL CONTATO ──
function openContatoModal(e){
  e && e.preventDefault();
  document.getElementById('contatoModal').classList.add('open');
}
function closeContatoModal(){document.getElementById('contatoModal').classList.remove('open');}
document.getElementById('contatoModal').addEventListener('click',function(e){if(e.target===this)closeContatoModal();});

async function enviarContato(){
  const nome  = document.getElementById('mc-nome').value.trim();
  const email = document.getElementById('mc-email').value.trim();
  const tel   = document.getElementById('mc-tel').value.trim();
  const msg   = document.getElementById('mc-msg').value.trim();
  if(!nome||!email||!tel||!msg){alert('Por favor preencha todos os campos obrigatórios (*)');return;}
  try {
    await _enviarEmail(
      'contato@teffe.com.br',
      'Teffe — Contato — ' + nome,
      _htmlTabela('Formulário de Contato', [
        ['Nome', nome], ['E-mail', email], ['Telefone', tel],
        ['Mensagem', msg.replace(/\n/g,'<br>')]
      ])
    );
    document.querySelectorAll('#contatoModal input,#contatoModal textarea').forEach(function(el){el.value='';});
    closeContatoModal();
    document.getElementById('ctaSuccessModal').classList.add('open');
  } catch(err){
    alert('Erro ao enviar. Por favor tente novamente ou entre em contato pelo WhatsApp.');
  }
}

async function enviarOrca(){
  const nome     = document.getElementById('of-nome').value.trim();
  const sobre    = document.getElementById('of-sobrenome').value.trim();
  const empresa  = document.getElementById('of-empresa').value.trim();
  const cnpj     = document.getElementById('of-cnpj').value.trim();
  const tel      = document.getElementById('of-tel').value.trim();
  const email    = document.getElementById('of-email').value.trim();
  const solucao  = document.getElementById('of-solucao').value;
  const qtd      = document.getElementById('of-qtd').value;
  const volume   = document.getElementById('of-volume').value;
  const depto    = document.getElementById('of-depto').value;
  const cargo    = document.getElementById('of-cargo').value;
  const msg      = document.getElementById('of-msg').value.trim();

  if(!nome||!empresa||!tel||!email||!solucao||!qtd){
    alert('Por favor preencha todos os campos obrigatórios (*)');
    return;
  }

  try {
    const solucaoEl = document.getElementById('of-solucao');
    const solucaoLabel = solucaoEl.options[solucaoEl.selectedIndex]?.text || solucao;
    const linhas = [
      ['Nome', nome + (sobre ? ' ' + sobre : '')],
      ['Empresa', empresa],
      ...(cnpj ? [['CNPJ', cnpj]] : []),
      ['Telefone', tel],
      ['E-mail', email],
      ['Solução de interesse', solucaoLabel],
      ['Qtd. equipamentos', qtd],
      ...(volume ? [['Volume de impressão', volume]] : []),
      ...(depto  ? [['Departamento', depto]] : []),
      ...(cargo  ? [['Cargo', cargo]] : []),
      ...(msg    ? [['Mensagem', msg.replace(/\n/g,'<br>')]] : [])
    ];
    await _enviarEmail(
      'contato@teffe.com.br',
      'Teffe — Orçamento — ' + nome + ' (' + solucaoLabel + ')',
      _htmlTabela('Solicitação de Orçamento', linhas)
    );
    document.querySelectorAll('#orcaForm input, #orcaForm select, #orcaForm textarea').forEach(function(el){ el.value=''; });
    document.getElementById('orcaForm').style.display='none';
    document.getElementById('orcaSuccess').style.display='block';
  } catch(err){
    alert('Erro ao enviar. Por favor tente novamente ou entre em contato pelo WhatsApp.');
  }
}
function setTab(btn,id){
  document.querySelectorAll('.equip-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.equip-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
}
function enviar(){
  document.querySelectorAll('.cta-form input, .cta-form select, .cta-form textarea').forEach(function(el){ el.value=''; });
  document.getElementById('ctaSuccessModal').classList.add('open');
}
function closeCTASuccess(){
  document.getElementById('ctaSuccessModal').classList.remove('open');
}
window.addEventListener('scroll',()=>{
  document.querySelector('.navbar').style.boxShadow=window.scrollY>10?'0 4px 20px rgba(26,63,128,.12)':'0 2px 12px rgba(26,63,128,.07)';
});
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.style.opacity='1';e.target.style.transform='translateY(0)';}});
},{threshold:0.1});
document.querySelectorAll('.seg-card,.equip-card,.sol-item').forEach(el=>{
  el.style.opacity='0';el.style.transform='translateY(18px)';
  el.style.transition='opacity .5s ease, transform .5s ease';
  obs.observe(el);
});

// ── TEXTO ROTATIVO ──
(function(){
  var words=['Tecnologia','Inovação','Confiança','Eficiência','Resultados'];
  var idx=0;
  var el=document.getElementById('rotatingWord');
  if(!el) return;
  setInterval(function(){
    idx=(idx+1)%words.length;
    el.style.animation='none';
    el.offsetHeight;
    el.textContent=words[idx];
    el.style.animation='';
  },2500);
})();

// ── MÁSCARAS ──
function maskPhone(e){
  let v = e.target.value.replace(/\D/g,'').slice(0,11);
  if(v.length <= 10)
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/,'($1) $2-$3');
  else
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})$/,'($1) $2-$3');
  e.target.value = v.replace(/-$/,'');
}
function maskCNPJ(e){
  let v = e.target.value.replace(/\D/g,'').slice(0,14);
  v = v.replace(/^(\d{2})(\d)/,'$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/,'.$1/$2');
  v = v.replace(/(\d{4})(\d)/,'$1-$2');
  e.target.value = v;
}
['cta-tel','tc-tel','of-tel','mc-tel','at-tel','sp-tel'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('input', maskPhone);
});
var cnpjEl = document.getElementById('of-cnpj');
if(cnpjEl) cnpjEl.addEventListener('input', maskCNPJ);
