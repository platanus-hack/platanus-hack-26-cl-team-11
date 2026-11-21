import { createHash } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import { createGame, type Tape } from './game.js';

const source='https://hack.platan.us/api/market/state?event=26-cl';
const schema=z.object({
  serverTs:z.number().int(), market:z.object({status:z.string(),id:z.literal('dc7d3432-3ee8-4631-9c2a-ef8ed5eede67')}),
  projects:z.array(z.object({teamSlug:z.string(),name:z.string(),price:z.number().positive().max(1)})).min(2),
});
function identity(c:Context) {
  const token=c.req.header('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  return token ? createHash('sha256').update(token).digest('hex') : '';
}
export function duelRoutes(ctx:AppContext) {
  const routes=new Hono();
  const game=createGame(ctx.db);
  let last:Tape|null=null, inflight:Promise<void>|undefined, attempted=0;
  async function readTape() {
    if (!inflight && Date.now()-attempted>=8000) {
      attempted=Date.now();
      inflight=(async()=>{
        const res=await ctx.fetch(source,{headers:{accept:'application/json','user-agent':'Ronda-Duelos/1.0'},signal:AbortSignal.timeout(5000)});
        if (!res.ok) throw new Error('feed unavailable');
        const data=schema.parse(await res.json());
        if (Math.abs(data.serverTs-Date.now())>15_000) throw new Error('stale feed');
        last={ts:data.serverTs,open:data.market.status==='open',teams:data.projects.map(p=>({id:p.teamSlug,name:p.name,price:p.price}))};
      })().catch(()=>{}).finally(()=>{inflight=undefined;});
    }
    await inflight;
    return last && Math.abs(last.ts-Date.now())<=15_000 ? last : null;
  }
  const tick=setInterval(async()=>{
    try { if (game.active()) game.settle(await readTape(),Date.now()); }
    catch (e) { console.error('duels settlement',e instanceof Error ? e.message : 'failed'); }
  },8000);
  tick.unref();
  routes.use('*',async(c,next)=>{ c.header('Cache-Control','no-store'); await next(); });
  routes.onError((e,c)=>e instanceof HTTPException ? c.json({error:e.message},e.status) : c.json({error:'No se pudo completar el duelo.'},500));
  routes.get('/',async c=>{
    const tape=await readTape();
    game.settle(tape,Date.now());
    return c.json({...game.board(identity(c)),feed:{ts:last?.ts??null,available:!!tape?.open,teams:last?.teams??[]}});
  });
  const limit=rateLimit(80);
  routes.post('/:action',limit,async c=>{
    const id=identity(c);
    if (!id) return c.json({error:'Abre tu monedero en este navegador.'},401);
    const body=await c.req.json().catch(()=>null);
    const action=c.req.param('action');
    if (action==='join') {
      const input=z.object({name:z.string().trim().min(1).max(24)}).safeParse(body);
      if (!input.success) return c.json({error:'Escribe un alias de hasta 24 caracteres.'},400);
      return c.json(game.register(id,input.data.name));
    }
    if (!game.wallet(id)) return c.json({error:'Primero crea tu monedero.'},401);
    if (action==='cancel' && typeof body?.id==='string') {game.cancel(id,body.id);return c.json({ok:true});}
    const tape=await readTape();
    if (!tape?.open) return c.json({error:'El mercado necesita una cotización vigente.'},503);
    game.settle(tape,Date.now());
    if (action==='place') {
      const input=z.object({nonce:z.uuid(),a:z.string(),b:z.string()}).safeParse(body);
      if (!input.success) return c.json({error:'Revisa los equipos de la oferta.'},400);
      const {nonce,a,b}=input.data;
      return c.json({id:game.place(id,nonce,a,b,tape,Date.now())});
    }
    if (action==='accept' && typeof body?.id==='string') {game.accept(id,body.id,tape,Date.now());return c.json({ok:true});}
    return c.json({error:'Orden desconocida.'},400);
  });
  return routes;
}
