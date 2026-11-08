// Sem rede: exercita o handler real com Supabase simulado.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/admin-criar-usuario/index.ts', 'utf8').replace(/^import .*\n/, ''), { mode: 'transform' });
const payload = { tipo: 'funcionario', nome: 'Teste', email: 'teste@example.com', senha_inicial: 'Senha123!', acesso_total: false, permissoes: {} };
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
async function run(settings = {}, body = payload, token = 'Bearer user.jwt.valid', requestOrigin = 'https://erp.teffe.com.br') {
  let handler, rpcCount = 0;
  const calls = [], created = [], deleted = [];
  function client(key, options) {
    const privileged = key === 'service';
    return {
      rpc(name) {
        assert.equal(name, 'sou_funcionario'); assert.equal(privileged, false);
        assert.equal(options.global.headers.Authorization, token);
        rpcCount++;
        return Promise.resolve({ data: settings.denied ? false : !(settings.revoke && rpcCount >= 3), error: settings.rpcError ? {} : null });
      },
      auth: {
        getUser(jwt) { assert.equal(jwt, token.slice(7)); return Promise.resolve({ data: { user: { id: 'caller' } }, error: settings.badJwt ? {} : null }); },
        admin: {
          createUser(p) { assert.ok(privileged); created.push(p); return Promise.resolve({ data: { user: { id: 'new-user' } }, error: settings.createError ? { code: 'email_exists' } : null }); },
          deleteUser(uid) { assert.equal(uid, 'new-user'); deleted.push(uid); return Promise.resolve({ error: settings.deleteError ? {} : null }); },
          updateUserById() { calls.push({ action: 'ban' }); return Promise.resolve({ error: null }); },
        },
      },
      from(table) {
        assert.ok(privileged);
        const op = { table, action: 'select', filters: [] };
        const query = {
          select() { return query; },
          insert(data) { op.action = 'insert'; op.data = data; return query; },
          upsert(data) { op.action = 'upsert'; op.data = data; return query; },
          update(data) { op.action = 'update'; op.data = data; return query; },
          delete() { op.action = 'delete'; return query; },
          eq(k, v) { op.filters.push([k, v]); return query; },
          is(k, v) { op.filters.push([k, v]); return query; },
          single() { return query; }, maybeSingle() { return query; },
          then(resolve, reject) {
            calls.push(op);
            let data = { id, user_id: settings.linked ? 'existing-user' : null, acesso_total: !settings.notMaster };
            if (op.action === 'update') data = [{ id }];
            const fail = settings.fail === `${table}:${op.action}`;
            return Promise.resolve({ data, error: fail ? {} : null }).then(resolve, reject);
          },
        };
        return query;
      },
    };
  }
  vm.runInNewContext(source, {
    createClient: (_url, key, options) => client(key, options),
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[key] }, serve: fn => { handler = fn; } },
    Response, console: { error() {} },
  });
  const headers = new Headers({ Origin: requestOrigin });
  if (token) headers.set('Authorization', token);
  const response = await handler(new Request('https://test.invalid', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { status: response.status, result: await response.json(), calls, created, deleted };
}

for (const [settings, body, token, status] of [
  [{}, payload, '', 401], [{ badJwt: true }, payload, undefined, 401],
  [{ denied: true }, payload, undefined, 403], [{ rpcError: true }, payload, undefined, 503],
  [{ notMaster: true }, payload, undefined, 403],
  [{}, { ...payload, tipo: 'admin' }, undefined, 400],
  [{}, { ...payload, senha_inicial: '123' }, undefined, 400],
  [{}, { ...payload, email: 'invalid' }, undefined, 400],
  [{}, { ...payload, permissoes: { arbitrary: true } }, undefined, 400],
]) {
  const r = await run(settings, body, token);
  assert.equal(r.status, status); assert.equal(r.created.length, 0);
}
assert.equal((await run({}, payload, undefined, 'https://evil.invalid')).status, 403);
for (const [tipo, role] of [['funcionario', 'admin'], ['tecnico', 'tecnico'], ['adicional_cliente', 'cliente']]) {
  const r = await run({}, { ...payload, tipo, cliente_id: id });
  assert.equal(r.status, 201);
  assert.equal(r.created[0].app_metadata.role, role);
  assert.equal(r.created[0].user_metadata.role, undefined);
  assert.equal(r.created[0].email_confirm, true);
  assert.equal(r.deleted.length, 0);
  const profile = r.calls.find(c => c.table === 'profiles' && c.action === 'upsert');
  assert.equal(profile.data.role, role);
  if (tipo !== 'funcionario') assert.equal(r.calls.find(c => c.action === 'insert').data.user_id, 'new-user');
}
for (const fail of ['profiles:upsert', 'tecnicos:insert', 'cliente_usuarios:insert']) {
  const tipo = fail.startsWith('tecnicos') ? 'tecnico' : fail.startsWith('cliente_usuarios') ? 'adicional_cliente' : 'funcionario';
  const r = await run({ fail }, { ...payload, tipo, cliente_id: id });
  assert.equal(r.status, 500); assert.equal(r.deleted.length, 1);
}
const revoked = await run({ revoke: true }, { ...payload, tipo: 'tecnico', tecnico_id: id });
assert.equal(revoked.status, 403); assert.equal(revoked.deleted.length, 1);
assert.ok(revoked.calls.some(c => c.table === 'tecnicos' && c.action === 'update' && c.data.user_id === null));
assert.ok(!revoked.calls.some(c => c.table === 'tecnicos' && c.action === 'delete'));
const lostUpdate = await run({ fail: 'tecnicos:update' }, { ...payload, tipo: 'tecnico', tecnico_id: id });
assert.equal(lostUpdate.deleted.length, 1);
assert.ok(!lostUpdate.calls.some(c => c.table === 'tecnicos' && c.action === 'delete'));
const existing = await run({ linked: true }, { ...payload, tipo: 'tecnico', tecnico_id: id });
assert.equal(existing.status, 409); assert.equal(existing.created.length, 0);
const duplicate = await run({ createError: true });
assert.equal(duplicate.status, 409); assert.equal(duplicate.deleted.length, 0);
const cleanup = await run({ revoke: true, deleteError: true });
assert.equal(cleanup.status, 500); assert.equal(cleanup.deleted.length, 3);
assert.ok(cleanup.calls.some(c => c.action === 'ban'));
assert.ok(cleanup.result.error.includes('reconciliação'));
console.log('OK: autenticação, autorização RPC, CORS, validação, três tipos, compensação, concorrência e falha de limpeza.');
