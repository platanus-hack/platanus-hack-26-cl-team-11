const el = id => document.getElementById(id);
const stamp = ms => new Date(ms).toLocaleString('es-CL',{timeZone:'America/Santiago'});
const rows = [
  ['connected5m','Conectados en los últimos 5 min'],
  ['agentWallets5m','Billeteras conectadas por agentes · 5 min'],
  ['traders15m','Billeteras que operaron · 15 min'],
  ['connected24h','Visitantes distintos · 24 h'],
  ['traders24h','Billeteras que operaron · 24 h'],
  ['fills24h','Cruces con jugadores · 24 h'],
  ['workingPlayerOrders','Órdenes abiertas de jugadores'],
  ['playerWallets','Billeteras de jugadores creadas'],
  ['tradersSinceOpen','Billeteras con algún cruce desde la apertura'],
];
let credential='', lastQuestions='', timer, generation=0;
const make=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
function logout() {
  clearInterval(timer);generation++;credential='';lastQuestions='';
  el('panel').hidden=true;el('login').hidden=false;
  el('stats').replaceChildren();el('questions').replaceChildren();el('message').textContent='';
}
async function load(body){
  const current=generation;
  const response=await fetch('/api/owner',{method:body?'POST':'GET',cache:'no-store',
    headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(current!==generation)return;
  if(response.status===401){logout();throw Error('La clave de organizador no es válida.');}
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'No se pudo consultar el panel.');
  el('panel').hidden=false;el('login').hidden=true;
  el('stats').replaceChildren(...rows.flatMap(([key,label])=>[make('dt',label),make('dd',data.stats[key])]));
  el('updated').textContent='Actualizado el '+stamp(data.stats.at)+' · Santiago.';
  const signature=JSON.stringify(data.questions.map(q=>[q.id,q.status,q.evidence]));
  if(signature!==lastQuestions){lastQuestions=signature;renderQuestions(data.questions);}
  return data;
}
function renderQuestions(questions){
  const items=[...questions].reverse().map(q=>{
    const a=make('article',''),link=make('a',q.question||q.title);
    link.href='/bolsa?marketId='+encodeURIComponent(q.id);
    a.append(link,make('p',q.rule),make('p','Cierre '+stamp(q.expiry)+' · Santiago'));
    if(q.status==='open'){a.append(make('p','Abierta para apuestas.'));return a;}
    if(q.status!=='pending'){
      a.append(make('p',q.payout===null?'Anulada':q.payout===100?'Resultado: Sí':'Resultado: No'),make('p',q.evidence?.reason||''));return a;
    }
    const form=make('form','');
    const sel=make('select','');sel.setAttribute('aria-label','Resultado');
    for(const [value,text] of [['','Elegir resultado'],['yes','Sí'],['no','No'],['void','Anular y devolver aportes']]){
      const option=make('option',text);option.value=value;sel.append(option);
    }
    sel.required=true;
    const reason=make('textarea','');reason.placeholder='Motivo público y fuente';reason.setAttribute('aria-label','Motivo público');reason.required=true;reason.maxLength=700;
    const send=make('button','Publicar decisión definitiva');
    form.append(sel,reason,send);form.addEventListener('submit',async e=>{
      e.preventDefault();
      const outcome=sel.selectedOptions[0].textContent;
      if(!confirm('Se publicará «'+outcome+'» y se liquidarán las apuestas de «'+q.question+'». ¿Confirmar?'))return;
      send.disabled=true;
      try{
        const data=await load({action:'resolve',decision:{marketId:q.id,outcome:sel.value,reason:reason.value.trim()}});
        if(data)el('message').textContent=data.receipt.automatic?'Venció el plazo. Se devolvieron los aportes.':'Decisión publicada.';
      }
      catch(err){el('message').textContent=err.message;}finally{send.disabled=false;}
    });
    a.append(form);return a;
  });
  el('questions').replaceChildren(...(items.length?items:[make('p','Aún no has publicado una pregunta.')]));
}
el('login').addEventListener('submit',async e=>{
  e.preventDefault();clearInterval(timer);generation++;credential=el('key').value.trim();el('key').value='';
  try{await load();el('message').textContent='';
    timer=setInterval(()=>{if(!document.hidden)load().catch(err=>el('message').textContent=err.message);},20000);
  }catch(err){el('message').textContent=err.message;}
});
el('logout').addEventListener('click',logout);
window.addEventListener('pagehide',logout);
el('create').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget, button=form.querySelector('button');button.disabled=true;
  try{
    const data=await load({action:'create',spec:{question:el('question').value.trim(),rule:el('rule').value.trim(),expiry:new Date(el('expiry').value).getTime()}});
    if(!data)return;
    form.reset();
    el('message').textContent=data.receipt.seededQty > 0 ? 'Pregunta publicada con ofertas iniciales de Sí y No.'
      : 'Pregunta publicada. Los jugadores pueden colocar las primeras ofertas desde el mercado avanzado.';
  }catch(err){el('message').textContent=err.message;}finally{button.disabled=false;}
});
