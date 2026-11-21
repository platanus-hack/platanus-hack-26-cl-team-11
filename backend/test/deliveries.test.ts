import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

interface SourceView {
  id: string;
  sync: { last: string; total: number } | null;
  delivery: { at: string; ok: boolean; message: string } | null;
}

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const DAYS = { steps_by_day: '2026-11-20|8421\n2026-11-21|10233' };

function setup() {
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null });
  const app = createApp(ctx);
  const person = ctx.store.addPerson('Rob');
  const send = (body: unknown) => app.request(`/api/ingest/health/${person.token}`, json(body));
  const health = async () => {
    const page = (await (await app.request(`/api/people/${person.token}`)).json()) as { sources: SourceView[] };
    return page.sources.find((source) => source.id === 'apple_health') as SourceView;
  };
  return { send, health };
}

test('the person page says what the last health delivery brought, also when the same days are sent again', async () => {
  const { send, health } = setup();
  assert.equal((await health()).delivery, null);

  assert.equal((await send(DAYS)).status, 201);
  const first = await health();
  assert.deepEqual({ ok: first.delivery?.ok, message: first.delivery?.message }, { ok: true, message: 'Listo. Llegaron 2 días de datos, del 20-11 al 21-11.' });

  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await send(DAYS)).status, 201);
  const again = await health();
  assert.equal(again.sync?.total, 2);
  assert.equal(again.sync?.last, first.sync?.last);
  assert.ok((again.delivery?.at ?? '') > (first.delivery?.at ?? ''));
});

test('a delivery that brings nothing readable is kept as a failed delivery with its reason', async () => {
  const { send, health } = setup();
  assert.equal((await send({ steps_by_day: '21 nov 2026|8421' })).status, 400);
  const failed = await health();
  assert.deepEqual({ ok: failed.delivery?.ok, message: failed.delivery?.message }, { ok: false, message: 'No pudimos leer ningún dato de salud en el envío.' });
  assert.equal(failed.sync, null);
});
