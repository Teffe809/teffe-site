/**
 * adicionar_fluxo_caneca.mjs
 * Adiciona cirurgicamente o bloco FLUXO DA CANECA E CAMISETA no system_prompt
 * de teffe-press, para que Maya inclua tipo_produto correto no ARTE_PRONTA JSON.
 *
 * Uso:
 *   node scripts/adicionar_fluxo_caneca.mjs SUA_SERVICE_ROLE_KEY
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://hlfjcpgrxiktgctozilk.supabase.co';
const SERVICE_KEY  = process.argv[2];
const INSTANCIA    = 'teffe-press';

if (!SERVICE_KEY) {
  console.error('Uso: node scripts/adicionar_fluxo_caneca.mjs SUA_SERVICE_ROLE_KEY');
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
if (!res.ok) { console.error('Erro ao ler:', res.status, await res.text()); process.exit(1); }
const [row] = await res.json();
if (!row) { console.error(`Instância "${INSTANCIA}" não encontrada.`); process.exit(1); }
const original = row.system_prompt;
console.log(`   OK — ${original.length} caracteres lidos.`);

// ── 2. BACKUP ───────────────────────────────────────────────────────────────
const backupPath = join(__dir, `../backups/system_prompt_teffe_press_${Date.now()}.txt`);
try { mkdirSync(join(__dir, '../backups'), { recursive: true }); } catch {}
writeFileSync(backupPath, original, 'utf8');
console.log(`\n[2/5] Backup salvo em:\n   ${backupPath}`);

let prompt = original.replace(/\r\n/g, '\n');

// ── 3. ALTERAÇÃO CIRÚRGICA ───────────────────────────────────────────────────
console.log('\n[3/5] Aplicando alteração...');

const MARCADOR = 'FLUXO DA CANECA E CAMISETA';

if (prompt.includes(MARCADOR)) {
  console.log(`   [SKIP] Bloco "${MARCADOR}" já existe — não duplicando.`);
  process.exit(0);
}

const BLOCO = `

FLUXO DA CANECA E CAMISETA — ARTE_PRONTA:
Ao gerar arte para caneca ou camiseta, use OBRIGATORIAMENTE no JSON da [ARTE_PRONTA]:
- "tipo_produto": "caneca" para caneca | "camiseta" para camiseta
- "modo": "texto"
- Não inclua layout_id para caneca/camiseta — esses produtos não têm seleção de layout
- Campos essenciais: nome/empresa, texto_principal (frase para estampar), cor_primaria, cor_secundaria
NUNCA use tipo_produto "cartao_visita" para caneca ou camiseta.`;

prompt = prompt + BLOCO;
console.log(`   [OK]   Bloco "${MARCADOR}" adicionado (${BLOCO.length} caracteres).`);

// ── 4. GRAVAR NO BANCO ──────────────────────────────────────────────────────
console.log(`\n[4/5] Gravando no banco...`);
const upd = await fetch(
  `${SUPABASE_URL}/rest/v1/mia_instancias?instancia=eq.${INSTANCIA}`,
  { method: 'PATCH', headers, body: JSON.stringify({ system_prompt: prompt }) }
);
if (!upd.ok) {
  console.error('Erro ao gravar:', upd.status, await upd.text());
  console.log('\n   Backup preservado. Nenhuma alteração foi salva no banco.');
  process.exit(1);
}
console.log('   OK — gravado com sucesso.');

// ── 5. TRECHO FINAL ──────────────────────────────────────────────────────────
console.log('\n[5/5] Bloco adicionado:\n');
console.log('═'.repeat(60));
const idx = prompt.indexOf(MARCADOR);
console.log(prompt.slice(Math.max(0, idx - 100)));
console.log('\n' + '═'.repeat(60));
console.log(`\nConcluído. Backup: ${backupPath}`);
