/**
 * atualizar_system_prompt.mjs
 * Lê, faz backup, altera cirurgicamente e grava o system_prompt de teffe-press.
 *
 * Uso:
 *   node scripts/atualizar_system_prompt.mjs SUA_SERVICE_ROLE_KEY
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://hlfjcpgrxiktgctozilk.supabase.co';
const SERVICE_KEY  = process.argv[2];
const INSTANCIA    = 'teffe-press';

if (!SERVICE_KEY) {
  console.error('Uso: node scripts/atualizar_system_prompt.mjs SUA_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

// ── 1. LER ──────────────────────────────────────────────────────────────────
console.log('\n[1/5] Lendo system_prompt atual...');

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/mia_instancias?instancia=eq.${INSTANCIA}&select=system_prompt`,
  { headers }
);

if (!res.ok) {
  console.error('Erro ao ler:', res.status, await res.text());
  process.exit(1);
}

const [row] = await res.json();
if (!row) {
  console.error(`Instância "${INSTANCIA}" não encontrada.`);
  process.exit(1);
}

const original = row.system_prompt;
console.log(`   OK — ${original.length} caracteres lidos.`);

// Normaliza CRLF → LF (banco tem \r\n, buscas usam \n)
let prompt = original.replace(/\r\n/g, '\n');

// ── 2. BACKUP ───────────────────────────────────────────────────────────────
const backupPath = join(__dir, `../backups/system_prompt_teffe_press_${Date.now()}.txt`);
try { mkdirSync(join(__dir, '../backups'), { recursive: true }); } catch {}
writeFileSync(backupPath, original, 'utf8');
console.log(`\n[2/5] Backup salvo em:\n   ${backupPath}`);

// ── 3. ALTERAÇÕES CIRÚRGICAS ────────────────────────────────────────────────
console.log('\n[3/5] Aplicando alterações...');

let totalAlteracoes = 0;

function substituir(descricao, antigo, novo) {
  if (!prompt.includes(antigo)) {
    console.log(`   [SKIP] "${descricao}" — trecho não encontrado no banco.`);
    return;
  }
  prompt = prompt.split(antigo).join(novo);
  totalAlteracoes++;
  console.log(`   [OK]   "${descricao}"`);
}

function removerBloco(marcadorInicio) {
  const idx = prompt.indexOf(marcadorInicio);
  if (idx === -1) {
    console.log(`   [SKIP] Bloco "${marcadorInicio.trim()}" não encontrado.`);
    return;
  }
  // Corta do marcador até o próximo bloco (\n\n[LETRA MAIÚSCULA]) ou fim
  const resto = prompt.slice(idx + marcadorInicio.length);
  const proximoBloco = resto.search(/\n\n[A-ZÁÉÍÓÚÀÃÕÂÊÔÇ]/);
  const fim = proximoBloco === -1
    ? prompt.length
    : idx + marcadorInicio.length + proximoBloco;
  prompt = prompt.slice(0, idx) + prompt.slice(fim);
  totalAlteracoes++;
  console.log(`   [OK]   Bloco "${marcadorInicio.trim()}" removido.`);
}

// 3a. Remover bloco TECNOLOGICO Z
removerBloco('\n\nESTILO CARTAO TECNOLOGICO Z:');

// 3b. Remover bloco ESTILO CARTAO PREMIUM (qualquer variante do marcador)
removerBloco('\n\nESTILO CARTAO PREMIUM:');
removerBloco('\n\nESTILO CARTÃO PREMIUM:');

// 3c. Trocar menção de estilos no FLUXO OBRIGATÓRIO (variante sem acento — como está no banco)
substituir(
  'FLUXO passo 3 — troca estilos antigos',
  'pergunte o estilo preferido — tecnológico, saúde ou elegante.',
  'pergunte qual layout o cliente prefere:\n- Premium Dark\n- Premium Light\n- Impacto'
);

// 3d. Trocar menção de estilos na intro do cartão (v14)
substituir(
  'Intro cartão — troca estilos antigos',
  'prefere um estilo **tecnológico** (visual moderno, linhas de circuito, tons escuros e laranja), **saúde** (clean, verde esmeralda ou teal, toque dourado, com linha de batimento cardíaco) ou **elegante** (qualquer estilo à vontade)?"',
  'qual layout prefere? **Premium Dark** (fundo escuro, elegante, detalhes dourados), **Premium Light** (fundo claro, limpo, corporativo) ou **Impacto** (visual forte, tipografia marcante)?"'
);

// 3e. Trocar hint do JSON da ARTE_PRONTA
substituir(
  'JSON ARTE_PRONTA — troca campo estilo',
  '"estilo": "<tecnologico|saude|elegante conforme escolha do cliente>"',
  '"layout_id": "<cartao_premium_dark|cartao_premium_light|cartao_impacto conforme escolha do cliente>"'
);

// 3f. Adicionar bloco LAYOUTS OFICIAIS (apenas se ainda não existir)
const BLOCO_NOVO = `\n\nLAYOUTS OFICIAIS DO CARTÃO DE VISITA:
Apresente SOMENTE estes três layouts ao cliente:
1. Premium Dark — fundo escuro, elegante, detalhes dourados, visual sofisticado
2. Premium Light — fundo claro, limpo, moderno e corporativo
3. Impacto — visual forte, moderno, tipografia marcante e alto destaque

REGRAS:
- NUNCA citar Tecnológico, Tecnológico Z, Elegante, Saúde ou Premium genérico.
- Se o cliente não tiver logo: continuar normalmente. Monograma com a inicial da empresa será gerado. NUNCA bloquear a criação.
- No JSON usar: "layout_id": "cartao_premium_dark" | "cartao_premium_light" | "cartao_impacto"`;

if (prompt.includes('LAYOUTS OFICIAIS DO CARTÃO DE VISITA')) {
  console.log('   [SKIP] Bloco "LAYOUTS OFICIAIS" já existe — não duplicando.');
} else {
  prompt = prompt + BLOCO_NOVO;
  totalAlteracoes++;
  console.log('   [OK]   Bloco "LAYOUTS OFICIAIS DO CARTÃO DE VISITA" adicionado.');
}

if (totalAlteracoes === 0) {
  console.log('\n   Nenhuma alteração necessária. Banco já está atualizado.');
  process.exit(0);
}

// ── 4. GRAVAR NO BANCO ──────────────────────────────────────────────────────
console.log(`\n[4/5] Gravando no banco (${totalAlteracoes} alterações)...`);

const upd = await fetch(
  `${SUPABASE_URL}/rest/v1/mia_instancias?instancia=eq.${INSTANCIA}`,
  {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ system_prompt: prompt }),
  }
);

if (!upd.ok) {
  console.error('Erro ao gravar:', upd.status, await upd.text());
  console.log('\n   Backup preservado. Nenhuma alteração foi salva no banco.');
  process.exit(1);
}

console.log('   OK — gravado com sucesso.');

// ── 5. MOSTRAR TRECHO FINAL ─────────────────────────────────────────────────
console.log('\n[5/5] Trecho final salvo no banco:\n');
console.log('═'.repeat(60));

// Mostra apenas o bloco novo + os 500 chars anteriores para contexto
const idxFinal = prompt.indexOf('LAYOUTS OFICIAIS DO CARTÃO DE VISITA');
const inicio   = Math.max(0, idxFinal - 300);
console.log(prompt.slice(inicio));

console.log('\n' + '═'.repeat(60));
console.log(`\nConcluído. ${totalAlteracoes} alteração(ões) aplicada(s).`);
console.log(`Backup: ${backupPath}`);
