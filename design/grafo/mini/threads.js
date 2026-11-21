// All events are local fixtures. Times are seconds from the start of a thread.
const DemoThreads = (() => {
  const runs = new Map();
  const origin = performance.now();
  const duration = 12;
  const key = (a,b) => [Math.min(a,b),Math.max(a,b)].join('-');
  function message(at,end,author,text) {
    const tokens = text.match(/\S{1,6}\s*/gu);
    return {type:'message',at,end,author,tokens};
  }
  function call(at,end,author,name,input,output) {
    return {type:'call',at,end,author,name,input,output};
  }
  function fixture(a,b,people,topic) {
    if (key(a,b)==='1-2') return [
      message(0,1.6,1,'¿Tienes media hora para revisar la demo?'),
      call(1.7,3.4,1,'agenda.disponibilidad',{agente:'Ian',minutos:30},{libre:['10:00','10:30']}),
      call(3.5,5.3,2,'agenda.disponibilidad',{agente:'Lian',minutos:30},{libre:['10:30','11:00']}),
      message(5.4,6.7,2,'A las 10:00 estoy ocupado.'),
      call(6.8,8.4,1,'agenda.cruzar',{agentes:['Ian','Lian'],minutos:30},{desde:'10:30',hasta:'11:00'}),
      message(8.5,11.4,2,'Coincidimos a las 10:30. Te propongo ese horario.')
    ];
    const coverage=key(a,b)==='0-1', plan=key(a,b)==='3-4';
    const subject=coverage?'Cobertura de las 11':plan?'Plan B para el cliente':topic||'Coordinación';
    return [
      message(0,2,a,coverage?'¿Quién puede cubrir la reunión de las 11?':plan?'¿Tenemos una alternativa para el cliente?':'¿Revisamos juntos el próximo paso?'),
      call(2.2,5,b,'equipo.consultar',{agente:people[b].name,asunto:subject},{respuesta:coverage?'Ian disponible':plan?'Alternativa disponible':'Listo para revisar'}),
      message(5.2,8,b,coverage?'Puedo cubrirla. Te paso la cifra antes de entrar.':plan?'Sí. Tengo el plan alternativo listo para compartir.':'Sí, tengo la información para revisarlo contigo.'),
      message(8.5,10.9,a,coverage?'Perfecto, cuento contigo.':plan?'Envíamelo y lo revisamos.':'Perfecto, lo revisamos juntos.')
    ];
  }
  function time(id,reduced=false) {
    const start=runs.get(id);
    if (reduced) return duration;
    const elapsed=(performance.now()-(start??origin))/1000;
    return start===undefined ? elapsed%duration : Math.min(elapsed,duration);
  }
  function tokenCount(e,t) {
    return Math.max(0,Math.min(e.tokens.length,1+Math.floor((t-e.at)/(e.end-e.at)*e.tokens.length)));
  }
  const restart=id=>runs.set(id,performance.now());
  function start(id) {
    if(runs.has(id)) return;
    // Opening the running calendar attaches to the moment visible on the arc.
    const elapsed=id==='1-2' ? time(id) : 0;
    runs.set(id,performance.now()-elapsed*1000);
  }
  return {key,fixture,time,tokenCount,restart,start};
})();

function threadHit(point, from,to,control,extent,tolerance) {
  // Reject the control hull before sampling the rendered portion of the arc.
  if(point.x<Math.min(from.x,control.x,to.x)-tolerance || point.x>Math.max(from.x,control.x,to.x)+tolerance ||
     point.y<Math.min(from.y,control.y,to.y)-tolerance || point.y>Math.max(from.y,control.y,to.y)+tolerance) return Infinity;
  let last=from, best=Infinity;
  for(let i=1;i<=16;i++) {
    const u=extent*i/16,v=1-u;
    const x=v*v*from.x+2*v*u*control.x+u*u*to.x, y=v*v*from.y+2*v*u*control.y+u*u*to.y;
    const dx=x-last.x,dy=y-last.y;
    const s=Math.min(1,Math.max(0,((point.x-last.x)*dx+(point.y-last.y)*dy)/(dx*dx+dy*dy||1)));
    best=Math.min(best,Math.hypot(point.x-last.x-dx*s,point.y-last.y-dy*s));
    last={x,y};
  }
  return best;
}

function mountThreadInspector(graph) {
  const dialog=document.querySelector('#thread-view'), feed=dialog.querySelector('.thread-feed');
  const heading=dialog.querySelector('h2'), status=dialog.querySelector('.thread-status');
  const launch=document.querySelector('#open-calendar-thread');
  launch.hidden=false;
  const transcripts=new Map();
  let selected, events=[], rows=[], frame=0;
  function reset() {
    feed.replaceChildren(); rows=[];
  }
  function row(event) {
    const el=document.createElement('article');
    el.className='thread-event';
    const label=document.createElement('header'), name=document.createElement('strong');
    name.textContent=graph.people[event.author].name;
    const face=document.createElement('span');
    face.className='thread-face';face.setAttribute('aria-hidden','true');
    if(event.author<5) face.style.backgroundImage='url('+graph.TEAM_SRC[event.author]+')';
    else {
      face.style.backgroundImage='url('+graph.ATLAS+')';
      const tile=graph.people[event.author].tile;
      face.style.backgroundPosition=(tile%8*100/7)+'% '+(Math.floor(tile/8)*100/7)+'%';
      face.style.backgroundSize='800% 800%';
    }
    const stamp=document.createElement('time');stamp.textContent='+'+event.at.toFixed(1)+' s';
    label.append(face,name,stamp);el.append(label);
    const content=document.createElement(event.type==='call'?'details':'p');
    if(event.type==='call') {
      const summary=document.createElement('summary'), badge=document.createElement('small');
      const code=document.createElement('code');code.textContent=event.name;
      summary.append(code,badge);content.append(summary);
      for(const [title,value] of [['Entrada',event.input],['Resultado',event.output]]) {
        const block=document.createElement('div');block.className='thread-payload';
        const tag=document.createElement('b'),pre=document.createElement('pre');
        tag.textContent=title;pre.textContent=JSON.stringify(value,null,2);
        block.append(tag,pre);content.append(block);
      }
    }
    el.append(content);feed.append(el);return content;
  }
  function render() {
    if(!dialog.open) return;
    dialog.querySelector('.thread-replay').hidden=graph.reduced;
    const t=DemoThreads.time(selected,graph.reduced);
    const follow=!feed.querySelector('details[open]') && feed.scrollHeight-feed.clientHeight-feed.scrollTop<28;
    let current='En curso';
    events.forEach((event,i)=>{
      if(t<event.at) return;
      const content=rows[i]??(rows[i]=row(event));
      if(event.type==='message'){
        const count=DemoThreads.tokenCount(event,t);
        const text=event.tokens.slice(0,count).join('');
        if(content.textContent!==text) content.textContent=text;
        content.classList.toggle('streaming',t<event.end);
        current=t<event.end?'Transmitiendo':'En curso';
      } else {
        const done=t>=event.end;
        const badge=content.querySelector('small');
        const value=done?'Completada':'Ejecutando';
        if(badge.textContent!==value) badge.textContent=value;
        content.lastElementChild.hidden=!done;
        current=done?'En curso':'Usando herramienta';
      }
    });
    if(t>=events.at(-1).end) current='Finalizado';
    if(status.textContent!==current) status.textContent=current;
    if(follow) feed.scrollTop=feed.scrollHeight;
    if(current!=='Finalizado') frame=requestAnimationFrame(render);
  }
  function open(a,b,topic) {
    selected=DemoThreads.key(a,b);
    if(!transcripts.has(selected)) transcripts.set(selected,{id:selected,a,b,events:DemoThreads.fixture(a,b,graph.people,topic)});
    graph.threadSelection=transcripts.get(selected);
    ({a,b,events}=graph.threadSelection);
    DemoThreads.start(selected);
    heading.textContent=graph.people[a].name+' ↔ '+graph.people[b].name;
    reset();cancelAnimationFrame(frame);
    if(!dialog.open) dialog.showModal();
    render();
  }
  launch.onclick=()=>open(1,2);
  dialog.querySelector('.thread-close').onclick=()=>dialog.close();
  dialog.querySelector('.thread-replay').onclick=()=>{DemoThreads.restart(selected);reset();cancelAnimationFrame(frame);render();};
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);graph.threadSelection=null;launch.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog && !dialog.querySelector('.thread-panel').contains(e.target))dialog.close();});
  graph.refreshThread=()=>{if(dialog.open){reset();cancelAnimationFrame(frame);render();}};
  return open;
}

function pickProjectedThread(view,m,tolerance,activeOnly=false) {
  const box=view.calendarBox;
  if(box && Math.abs(box.x-m.x)<box.halfWidth+2 && Math.abs(box.y-m.y)<box.halfHeight+2) return {a:1,b:2};
  let best=tolerance, picked=null;
  function test(a,b,c,extent,topic) {
    const dist=threadHit(m,view.points[a],view.points[b],c,extent,best);
    if(dist<best){best=dist;picked={a,b,topic};}
  }
  for(const edge of view.active) test(edge.a,edge.b,edge.c,edge.extent,edge.topic);
  if(picked || activeOnly) return picked;
  for(let a=0;a<view.count;a++){
    if(view.vis[a]<.5) continue;
    for(let b=a+1;b<view.count;b++){
      if(view.vis[b]<.5 || view.reserved[DemoThreads.key(a,b)]) continue;
      test(a,b,view.ctrl(a,b),1);
    }
  }
  return picked;
}

function drawThreadToken(ctx,view,selection,zoom) {
  const time=DemoThreads.time(selection.id);
  const msg=selection.events.find(e=>e.type==='message' && time>=e.at && time<e.end);
  if(!msg) return;
  const from=view.points[selection.a], to=view.points[selection.b], c=view.ctrl(selection.a,selection.b);
  const progress=(time-msg.at)/(msg.end-msg.at);
  const u=.23+.54*(msg.author===selection.a?progress:1-progress), v=1-u;
  const x=v*v*from.x+2*v*u*c.x+u*u*to.x, y=v*v*from.y+2*v*u*c.y+u*u*to.y;
  const dx=(v*(c.x-from.x)+u*(to.x-c.x)),dy=(v*(c.y-from.y)+u*(to.y-c.y));
  const length=Math.hypot(dx,dy)||1;
  const token=msg.tokens[DemoThreads.tokenCount(msg,time)-1].trim();
  ctx.save();ctx.translate(x-dy/length*35/zoom,y+dx/length*35/zoom);ctx.scale(1/zoom,1/zoom);
  ctx.font='600 11px -apple-system,system-ui,sans-serif';
  const width=ctx.measureText(token).width+12;
  ctx.globalAlpha=Math.min(1,progress*10,(1-progress)*10);ctx.beginPath();ctx.roundRect(-width/2,-9,width,18,7);
  ctx.fillStyle='#e4f4f2';ctx.fill();ctx.strokeStyle='#8dbcbf';ctx.lineWidth=.8;ctx.stroke();
  ctx.fillStyle='#115865';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(token,0,0);ctx.restore();
}
