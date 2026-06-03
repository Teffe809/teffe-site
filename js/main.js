


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
  // Simula envio (Formspree não suporta file upload no plano gratuito)
  // Para envio real com arquivo, será necessário EmailJS ou backend
  document.querySelector('#page-trabalhe .ep-body > div:last-of-type').style.display='none';
  document.getElementById('tc-success').style.display='block';
  document.getElementById('tc-success').scrollIntoView({behavior:'smooth'});
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
function openModal(e){e&&e.preventDefault();document.getElementById('modal').classList.add('open');}
function closeModal(){document.getElementById('modal').classList.remove('open');}
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

  const corpo = `
Novo contato pelo site da Teffe

Nome: ${nome} ${sobre}
Empresa: ${empresa}
CNPJ: ${cnpj}
Telefone: ${tel}
E-mail: ${email}
Solução de interesse: ${solucao}
Quantidade de equipamentos: ${qtd}
Volume de impressão: ${volume}
Departamento: ${depto}
Cargo: ${cargo}
Mensagem: ${msg}
  `.trim();

  try {
    const res = await fetch('https://formspree.io/f/xyzknqvp', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({
        _replyto: email,
        _subject: 'Novo contato Teffe – ' + solucao,
        message: corpo,
        nome, empresa, email, tel, solucao
      })
    });
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
function enviar(){alert('<i class="ti ti-circle-check"></i> Solicitação enviada!\nEntraremos em contato em até 1 dia útil.');}
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
