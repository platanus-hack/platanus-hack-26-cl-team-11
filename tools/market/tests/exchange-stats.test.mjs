import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { touchPresence, attendance } from '../web/lib/exchange-stats.mjs';
import { isOwner } from '../web/lib/exchange-owner.mjs';

test('counts active visitors and unique trading wallets without exposing identities', () => {
  const now=Date.UTC(2026,10,21,15);
  const actor='player:a', visitor='a'.repeat(32);
  const ledger={engine:{wallets:{'$player:a':{},'$desk:any':{}},orders:{},fills:[
    {at:now-1,buyer:actor,seller:'desk:binary'}, {at:now-2,buyer:'player:b',seller:actor},
    {at:now-18*60*1000,buyer:'player:c',seller:'desk:call'}
  ]}};
  assert(touchPresence(ledger,{visitor},now));
  assert(touchPresence(ledger,{visitor,actor,channel:'wallet'},now));
  assert(touchPresence(ledger,{actor,channel:'agent'},now));
  assert(!touchPresence(ledger,{visitor},now+5000));
  const stats=attendance(ledger,now+5001);
  assert.equal(stats.connected5m,1);assert.equal(stats.agentWallets5m,1);
  assert.equal(stats.traders15m,2);assert.equal(stats.traders24h,3);assert.equal(stats.fills24h,3);
  assert.equal(stats.playerWallets,1);
  assert.equal(attendance(ledger,now+301000).connected5m,0);
  assert(!JSON.stringify(stats).includes(actor));
  assert(!JSON.stringify(ledger.attendance).includes(visitor));
});
test('organizer authentication fails closed and distinguishes the three credential types',()=>{
  const key='org_'+'a'.repeat(43);
  const hash=createHash('sha256').update(key).digest('hex');
  assert(isOwner('Bearer '+key,hash));
  for(const header of [undefined,'Bearer '+ 'f'.repeat(64),'Bearer mxs_' + 'f'.repeat(64),'Bearer org_'+'b'.repeat(43)])
    assert(!isOwner(header,hash));
  assert(!isOwner('Bearer '+key,undefined));
});
