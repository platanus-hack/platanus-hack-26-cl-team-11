import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designAssets } from '../src/designAssets.js';

test('the globe, the context pages and their styles are served, and the rest of the design folder is not', async () => {
  const app = designAssets();
  const tokens = await app.request('/design/tokens.css');
  assert.equal(tokens.status, 200);
  assert.match(await tokens.text(), /--rd-ink/);
  assert.equal((await app.request('/design/grafo/globo.html')).status, 200);
  assert.equal((await app.request('/design/grafo/sala.js')).status, 200);
  assert.equal((await app.request('/design/grafo/embed.js')).status, 200);
  assert.equal((await app.request('/design/contexto/resumen.html')).status, 200);
  assert.equal((await app.request('/design/contexto/contexto.css')).status, 200);
  assert.equal((await app.request('/design/faces/caras.js')).status, 200);
  assert.equal((await app.request('/design/caras/sabores.html')).status, 404);
  assert.equal((await app.request('/design/luz/luz.js')).status, 200);
  assert.equal((await app.request('/design/DESIGN.md')).status, 404);
  assert.equal((await app.request('/design/archive/index.html')).status, 404);
  assert.equal((await app.request('/design/grafo/../../.env.example')).status, 404);
});

test('the book lives apart from the deck: /libro opens it and its files are served', async () => {
  const app = designAssets();
  const short = await app.request('/libro');
  assert.equal(short.status, 302);
  assert.equal(short.headers.get('location'), '/design/libro/index.html');
  const book = await app.request('/design/libro/index.html');
  assert.equal(book.status, 200);
  assert.match(await book.text(), /Platanus Hack/);
  assert.equal((await app.request('/design/libro/libro.css')).status, 200);
});
