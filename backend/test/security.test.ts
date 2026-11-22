import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { designAssets } from '../src/designAssets.js';
import { callerOf, rateLimit } from '../src/rateLimit.js';

const appOf = () => createApp(createContext({ location: ':memory:' }));
const json = (body: unknown, headers: Record<string, string> = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const headerReader = (headers: Record<string, string>) => (name: string) => headers[name];

test('toda respuesta lleva las cabeceras que protegen la página', async () => {
  const app = appOf();
  for (const path of ['/api/health', '/api/people/no-existe']) {
    const headers = (await app.request(path)).headers;
    assert.equal(headers.get('referrer-policy'), 'same-origin');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(headers.get('content-security-policy') ?? '', /frame-ancestors 'self'/);
    assert.match(headers.get('content-security-policy') ?? '', /object-src 'none'/);
    assert.match(headers.get('strict-transport-security') ?? '', /max-age=\d+/);
    assert.match(headers.get('permissions-policy') ?? '', /camera=\(\)/);
  }
});

test('quien llama se identifica por la dirección que pone el borde, no por una que puede inventar', () => {
  assert.equal(callerOf(headerReader({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.1, 203.0.113.7' })), '203.0.113.7');
  assert.equal(callerOf(headerReader({ 'true-client-ip': '203.0.113.8', 'x-forwarded-for': '10.0.0.1' })), '203.0.113.8');
  assert.equal(callerOf(headerReader({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' })), '198.51.100.4');
  assert.equal(callerOf(headerReader({})), 'local');
});

test('inventar otra dirección de origen no esquiva el límite de pedidos', async () => {
  const app = new Hono().get('/', rateLimit(3), (c) => c.text('ok'));
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await app.request('/', { headers: { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': `10.0.0.${attempt}` } });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
});

test('crear personas y enviar datos de salud tienen un límite por minuto', async () => {
  const app = appOf();
  const fromOneCaller = { 'cf-connecting-ip': '203.0.113.9' };
  const created: number[] = [];
  for (let attempt = 0; attempt < 22; attempt++) created.push((await app.request('/api/people', json({ name: `Persona ${attempt}` }, fromOneCaller))).status);
  assert.equal(created.filter((status) => status === 201).length, 20);
  assert.equal(created.at(-1), 429);
  const person = (await (await app.request('/api/people', json({ name: 'Otra' }, { 'cf-connecting-ip': '203.0.113.10' }))).json()) as { token: string };
  const deliveries: number[] = [];
  for (let attempt = 0; attempt < 32; attempt++) deliveries.push((await app.request(`/api/ingest/health/${person.token}`, json({ date: '2026-11-21', steps: attempt }, fromOneCaller))).status);
  assert.equal(deliveries.filter((status) => status === 429).length, 2);
});

test('una ruta de diseño con caracteres codificados o que sube de carpeta no se entrega', async () => {
  const app = designAssets();
  assert.equal((await app.request('/design/logo/montu-mark.svg')).status, 200);
  for (const path of ['/design/grafo/%2e%2e/%2e%2e/package.json', '/design/grafo/%252e%252e/%252e%252e/package.json', '/design/grafo/..%2f..%2fpackage.json', '/design/logo/..\\..\\package.json']) {
    assert.equal((await app.request(path)).status, 404);
  }
});
