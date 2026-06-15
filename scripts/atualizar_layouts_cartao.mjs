/**
 * atualizar_layouts_cartao.mjs
 * Substitui cirurgicamente os layout_ids legados do cartão no system_prompt
 * de teffe-press pelos novos IDs do fluxo híbrido.
 *
 * Uso:
 *   node scripts/atualizar_layouts_cartao.mjs SUA_SERVICE_ROLE_KEY
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://hlfjcpgrxiktgctozilk.supabase.co';
const SERVICE_KEY  = process.argv[2];
const INSTANCIA    = 'teffe-press';

if (!SERVICE_KEY) {
  console.error('Uso: node scripts/atualizar_layouts_cartao.mjs SUA_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
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

// ── 3. ALTERAÇÕES CIRÚRGICAS ─────────────────────────────────────────────────
console.log('\n[3/5] Aplicando substituições...');

const substituicoes = [
  // Layout IDs no JSON de instrução
  ['"cartao_premium_dark"',  '"hibrida_cartao_dark"'],
  ['"cartao_premium_light"', '"hibrida_cartao_light"'],
  ['"cartao_impacto"',       '"hibrida_cartao_impacto"'],
];

let alteracoes = 0;
for (const [de, para] of substituicoes) {
  const antes = prompt;
  prompt = prompt.replaceAll(de, para);
  const count = (antes.match(new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count > 0) {
    console.log(`   [OK] "${de}" → "${para}" (${count} ocorrência${count > 1 ? 's' : ''})`);
    alteracoes += count;
  } else {
    console.log(`   [--] "${de}" — não encontrado, pulando`);
  }
}

if (alteracoes === 0) {
  console.log('\n   Nenhuma alteração necessária — layout_ids já estão atualizados.');
  process.exit(0);
}

// ── 4. GRAVAR NO BANCO ──────────────────────────────────────────────────────
console.log(`\n[4/5] Gravando no banco (${alteracoes} substituição${alteracoes > 1 ? 'ões' : ''})...`);
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

// ── 5. VERIFICAÇÃO ──────────────────────────────────────────────────────────
console.log('\n[5/5] Verificando resultado...');
const linhas = prompt.split('\n').filter(l => /hibrida_cartao|cartao_premium_dark|cartao_premium_light|cartao_impacto/.test(l));
if (linhas.length) {
  console.log('\nLinhas com layout_id após alteração:');
  linhas.forEach(l => console.log('  >', l.trim()));
} else {
  console.log('   Nenhuma linha com layout_id encontrada (verifique manualmente).');
}

console.log(`\nConcluído. Backup: ${backupPath}`);
