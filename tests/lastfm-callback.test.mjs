import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const fakeCookies = url('export const cookies = async () => globalThis.callbackFixture.jar;');
const fakeServer = url('export const admin = () => ({ db: globalThis.callbackFixture.db });');
const fakeLastfm = url('export const lastfm = (...args) => globalThis.callbackFixture.exchange(...args);');
let callback = transpile('../src/app/api/lastfm/callback/route.ts');
for (const [specifier, replacement] of Object.entries({
  'next/headers': fakeCookies,
  '@/lib/server': fakeServer,
  '@/lib/lastfm': fakeLastfm,
  '@/lib/lastfm-auth': url(transpile('../src/lib/lastfm-auth.ts')),
})) callback = callback.replaceAll('"' + specifier + '"', '"' + replacement + '"');
const { GET } = await import(url(callback));

test('URL-safe token connects atomically on the original host without waiting for listening history', async () => {
  const previousUrl = process.env.APP_URL, previousMode = process.env.NODE_ENV;
  process.env.APP_URL = 'http://127.0.0.1:3000'; process.env.NODE_ENV = 'development';
  const state = 'a'.repeat(64), writes = [], cookieWrites = [], calls = [];
  let committed = false;
  globalThis.callbackFixture = {
    jar: { get: () => ({ value: state }), set: (...args) => cookieWrites.push(args) },
    db: {
      doc: path => ({ path }),
      runTransaction: async fn => fn({
        get: async () => ({ data: () => ({ uid: 'test-user', origin: 'http://localhost:3000', expiresAt: Date.now() + 60000 }) }),
        delete: () => {},
      }),
      batch: () => ({ set: (ref, data) => writes.push({ path: ref.path, data }), commit: async () => { committed = true; } }),
    },
    exchange: async (...args) => { calls.push(args); return { session: { name: 'new-listener', key: 'never-save-this-key' } }; },
  };
  try {
    const response = await GET(new Request('http://localhost:3000/api/lastfm/callback?' + new URLSearchParams({ state, token: 'Valid_Test-Token_1234567890' })));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'http://localhost:3000/?lastfm=connected');
    assert.equal(committed, true); assert.equal(writes.length, 2);
    assert.equal(writes[1].data.lastfm.snapshot, null);
    assert.equal(calls.length, 1); assert.equal(calls[0][0], 'auth.getSession');
    assert.equal(JSON.stringify(writes).includes('never-save-this-key'), false);
    assert.equal(cookieWrites[0][2].maxAge, 0);
  } finally {
    delete globalThis.callbackFixture;
    if (previousUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = previousUrl;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
  }
});
