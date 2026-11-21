import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { serveFrontend } from '../src/frontendFiles.js';

function appWithBuild() {
  const dist = mkdtempSync(join(tmpdir(), 'montu-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Montu</title>');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'export {};');
  writeFileSync(join(dist, 'sw.js'), 'self.skipWaiting();');
  const app = new Hono();
  assert.equal(serveFrontend(app, dist), true);
  return app;
}

test('un archivo compilado que existe se entrega y se puede guardar para siempre', async () => {
  const response = await appWithBuild().request('/assets/index-abc123.js');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await response.text(), 'export {};');
});

test('un archivo compilado de una versión anterior responde 404 y no la página', async () => {
  const response = await appWithBuild().request('/assets/index-viejo999.js');
  assert.equal(response.status, 404);
  assert.equal((response.headers.get('content-type') ?? '').includes('text/html'), false);
  assert.equal(response.headers.get('cache-control'), null);
});

test('cualquier ruta de la app entrega la página y pide revisarla cada vez', async () => {
  for (const path of ['/', '/conectar/abc', '/sala/XYZ123']) {
    const response = await appWithBuild().request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.match(await response.text(), /<title>Montu<\/title>/);
  }
  assert.equal((await appWithBuild().request('/sw.js')).headers.get('cache-control'), 'no-cache');
});

test('sin compilación no se registra nada', () => {
  assert.equal(serveFrontend(new Hono(), mkdtempSync(join(tmpdir(), 'montu-vacio-'))), false);
});
