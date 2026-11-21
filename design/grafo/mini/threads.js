// Per-edge playback for the local prototype. The graph and inspector share this clock.
const DemoThreads = (() => {
  const runs=new Map(), duration=12;
  const key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join('-');
  function time(id,reduced=false) {
    if(reduced) return duration;
    const run=runs.get(id);
    if(!run) return 0;
    return Math.min(duration,run.at+(run.paused?0:(performance.now()-run.stamp)/1000));
  }
  function set(id,at,paused=false) {
    runs.set(id,{at:Math.min(duration,Math.max(0,at)),stamp:performance.now(),paused});
  }
  function start(id,fraction=0) {
    if(!runs.has(id)) set(id,Math.min(1,fraction/.8)*duration);
  }
  function fraction(id,ambient,reduced) {
    return !runs.has(id) ? ambient : .8*time(id,reduced)/duration;
  }
  function tokenCount(event,t) {
    const fraction=writingFraction(event,t);
    return Math.ceil(fraction*event.tokens.length);
  }
  return {key,time,set,start,fraction,duration,tokenCount,paused:id=>runs.get(id)?.paused};
})();

function writingFraction(event,t) {
  const start=event.at+(event.type==='human' ? .15 : .7);
  return Math.max(0,Math.min(1,(t-start)/(event.end-start)));
}

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

function mountThreadInspector(graph,initialKind) {
  const dialog=document.querySelector('#thread-view');
  const find=selector=>dialog.querySelector(selector);
  const feed=find('.thread-feed'), heading=find('h2'), state=find('.thread-state');
  const timeline=find('.thread-position'), clock=find('.thread-time'), toggle=find('.thread-toggle');
  const replay=find('.thread-replay'), status=find('.thread-status');
  const picker=document.querySelector('#thread-picker'), select=picker.querySelector('select');
  const launch=document.querySelector('#open-calendar-thread');
  picker.hidden=false;
  for(const motion of globeMotions) select.add(new Option(threadStories[motion.kind].label,motion.kind));
  select.value=initialKind && threadStories[initialKind] ? initialKind : 'calendars';
  const transcripts=new Map();
  let thread, rows=[], frame=0, previous=-1;
  function node(tag,cls,value) {
    const el=document.createElement(tag);
    if(cls) el.className=cls;
    if(value!==undefined) el.textContent=value;
    return el;
  }
  function face(author) {
    const el=node('span','thread-face');
    const {backgroundImage,backgroundSize,backgroundPosition}=graph.faceStyle(author);
    Object.assign(el.style,{backgroundImage,backgroundSize,backgroundPosition:backgroundPosition||'center'});
    el.setAttribute('aria-hidden','true');
    return el;
  }
  function agent(author) {
    return author===0?'Tu agente':'Agente de '+graph.people[author].name;
  }
  const viewport=node('div','thread-viewport'), stack=node('div','thread-stack');
  viewport.append(stack);feed.append(viewport);
  let glide;
  feed.onscroll=()=>feed.classList.toggle('scrolled',feed.scrollTop>12);
  function reset() {
    glide?.cancel();stack.replaceChildren();rows=[];previous=-1;
  }
  function decide(phrase) {
    thread.choice=phrase;
    thread.events=threadScript(thread.kind,thread.a,thread.b,graph.people,phrase);
    DemoThreads.set(thread.id,thread.ask.end);
    render();
    toggle.focus({preventScroll:true});
  }
  function decision(event,el) {
    const card=node('div','thread-decision rd-decision'), body=node('div','rd-decision__body');
    body.append(node('small','rd-decision__label rd-gradient-text','Tu decisión'),node('strong','',event.question));
    const phrase=node('p','thread-phrase','«'+(thread.choice || event.options[0])+'»');
    const hint=node('small','','Solo tú ves esta solicitud.'), actions=node('div','thread-actions');
    const accept=node('button','rd-button','Aceptar'), adjust=node('button','rd-button rd-button--quiet','Ajustar');
    const choices=node('select','thread-choice');
    choices.setAttribute('aria-label','Frase que podrá compartir tu agente');
    for(const option of event.options) choices.add(new Option(option,option));
    choices.hidden=true;
    choices.onchange=()=>{phrase.textContent='«'+choices.value+'»';};
    adjust.onclick=()=>{choices.hidden=false;adjust.hidden=true;choices.focus();};
    accept.onclick=()=>decide(choices.value);
    actions.append(accept,adjust);
    const receipt=node('small','ask-receipt');
    body.append(phrase,hint,choices,actions,receipt);card.append(body);el.append(card);
    return {update(t){
      const done=t>=event.end;
      hint.hidden=done;actions.hidden=done;receipt.hidden=!done;
      if(done){choices.hidden=true;receipt.textContent=thread.choice?'✓ Aceptado por ti':'✓ Permiso de ejemplo';}
    }};
  }
  function tool(event,el) {
    const participants=[graph.people[thread.a].name,graph.people[thread.b].name];
    const card=RondaTools.create({...event,participants});
    el.append(card.el);
    return {update(t){card.update(t);}};
  }
  function message(event,el) {
    const mine=event.author===0;
    el.classList.toggle('mine',mine);el.classList.toggle('human',event.type==='human');
    const column=node('div','thread-message'), header=node('header');
    header.append(node('strong','',event.type==='human'?'Tú, en persona':agent(event.author)));
    const bubble=node('p','thread-bubble'), dots=node('span','thread-dots');
    dots.setAttribute('aria-label','Escribiendo');dots.append(node('i'),node('i'),node('i'));
    const stream=RondaStream.create(event.tokens.join(''));
    bubble.append(dots,stream.el);column.append(header,bubble);el.append(face(event.author),column);
    return {update(t,animate){
      const fraction=writingFraction(event,t);
      dots.hidden=fraction>0;
      bubble.classList.toggle('quiet',!animate);
      stream.update(fraction,!animate || fraction>=1);
    }};
  }
  function row(event,animate) {
    const el=node('article','thread-event');
    if(animate) el.classList.add('entering');
    const item=event.type==='ask'?decision(event,el):event.type==='call'?tool(event,el):message(event,el);
    stack.append(el);
    return item;
  }
  function render() {
    cancelAnimationFrame(frame);
    if(!dialog.open) return;
    const ask=thread.ask;
    let t=DemoThreads.time(thread.id,graph.reduced);
    // Stop at the owner's turn even when opening an edge halfway through its ambient loop.
    const waiting=ask && !graph.reduced && !thread.choice && t>=ask.at;
    if(waiting){t=ask.at;DemoThreads.set(thread.id,t,true);}
    if(t<previous) reset();
    const playing=!graph.reduced && !DemoThreads.paused(thread.id) && t<DemoThreads.duration;
    const animate=playing && previous>=0 && t-previous<.2;
    const boundary=thread.events.some(e=>(previous<e.at && e.at<=t) || (previous<e.end && e.end<=t));
    const follow=!feed.querySelector('details[open]') && feed.scrollHeight-feed.clientHeight-feed.scrollTop<36;
    const moving=boundary && follow && previous>=0 && t-previous<.2 && !graph.reduced && stack.childElementCount;
    const oldTop=moving ? stack.getBoundingClientRect().top : null;
    previous=t;
    let current='En curso',changed=false;
    thread.events.forEach((event,i)=>{
      if(t<event.at) return;
      if(!rows[i]){rows[i]=row(event,animate);changed=true;}
      if(rows[i].update(t,animate)) changed=true;
      if(t<event.end) current=event.type==='call'?'Usando herramienta':event.type==='ask'?'Esperando tu permiso':'Transmitiendo';
    });
    const ended=t>=DemoThreads.duration;
    if(waiting) current='Esperando tu permiso';
    else if(ended) current='Finalizado';
    else if(!playing) current='En pausa';
    const phase=ended?'done':waiting?'wait':playing?'live':'paused';
    if(state.dataset.phase!==phase){
      state.dataset.phase=phase;
      state.textContent=ended?(thread.kind==='guideline'?'Propuesta':thread.kind==='health'?'Privado':'Acuerdo'):waiting?'Te espera':playing?'Negociando':'En pausa';
    }
    if(status.textContent!==current) status.textContent=current;
    dialog.dataset.playing=String(playing);
    timeline.value=String(t);timeline.disabled=graph.reduced;
    timeline.setAttribute('aria-valuetext',t.toFixed(1)+' de 12 segundos');
    clock.textContent=t.toFixed(1)+' / 12 s';
    toggle.hidden=graph.reduced;toggle.disabled=ended || Boolean(waiting);
    toggle.textContent=playing?'Ⅱ':'▶';toggle.setAttribute('aria-label',playing?'Pausar':'Continuar');
    replay.hidden=graph.reduced;
    if(follow && (changed || boundary)) feed.scrollTop=feed.scrollHeight;
    if(oldTop!==null){
      // Continue from the visible position if another event arrives mid-glide.
      glide?.cancel();
      const shift=oldTop-stack.getBoundingClientRect().top;
      if(Math.abs(shift)>.25){
        glide=stack.animate([{transform:'translateY('+shift+'px)'},{transform:'none'}],
          {duration:550,easing:'cubic-bezier(.25,1,.5,1)'});
      }
    }
    if(playing) frame=requestAnimationFrame(render);
  }
  function open(a,b,topic) {
    const id=DemoThreads.key(a,b);
    const motion=globeMotions.find(m=>DemoThreads.key(m.a,m.b)===id);
    if(motion){a=motion.a;b=motion.b;select.value=motion.kind;}
    const kind=motion?.kind || 'exchange';
    if(!transcripts.has(id)){
      const events=threadScript(kind,a,b,graph.people);
      transcripts.set(id,{id,a,b,kind,events,ask:events.find(e=>e.type==='ask')});
    }
    thread=transcripts.get(id);graph.threadSelection=thread;
    const spot=graph.motionSpots?.find(m=>m.kind===kind);
    DemoThreads.start(id,spot?.fraction || 0);
    if(thread.resume){DemoThreads.set(id,DemoThreads.time(id));thread.resume=false;}
    heading.textContent=kind==='exchange' && topic ? topic : threadStories[kind].title;
    find('.thread-faces').replaceChildren(face(a),face(b));
    find('.thread-pair').textContent=a===0 || b===0?'Tu agente y el de '+graph.people[a===0?b:a].name:'Agentes de '+graph.people[a].name+' y '+graph.people[b].name;
    delete state.dataset.phase;reset();if(!dialog.open) dialog.show();render();
  }
  // El hilo es un panel, no un modal: el globo sigue vivo y se puede arrastrar detrás. Escape lo cierra.
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && dialog.open) dialog.close();});
  launch.onclick=()=>{const m=globeMotions.find(m=>m.kind===select.value);open(m.a,m.b);};
  toggle.onclick=()=>{DemoThreads.set(thread.id,DemoThreads.time(thread.id),!DemoThreads.paused(thread.id));render();};
  timeline.oninput=()=>{DemoThreads.set(thread.id,Number(timeline.value),true);render();};
  find('.thread-close').onclick=()=>dialog.close();
  replay.onclick=()=>{
    thread.choice=null;
    thread.events=threadScript(thread.kind,thread.a,thread.b,graph.people);
    DemoThreads.set(thread.id,0);reset();render();
  };
  dialog.addEventListener('close',()=>{
    cancelAnimationFrame(frame);
    thread.resume=!DemoThreads.paused(thread.id);
    DemoThreads.set(thread.id,DemoThreads.time(thread.id),true);
    graph.threadSelection=null;
    launch.focus({preventScroll:true});
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog) dialog.close();});
  graph.refreshThread=()=>{if(dialog.open){reset();render();}};
  return open;
}

function pickMotionSpot(spots,point) {
  // The last miniature painted is the upper surface if two hit areas overlap.
  return spots.findLast(spot=>Math.abs(spot.x-point.x)<spot.width*.52 && Math.abs(spot.y-point.y)<spot.width*.38);
}

function pickProjectedThread(view,m,tolerance,activeOnly=false) {
  const spot=pickMotionSpot(view.spots,m);
  if(spot) return spot;
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

const threadTheme=getComputedStyle(document.documentElement);
const tokenPaint={
  paper:threadTheme.getPropertyValue('--rd-glass-solid').trim(),
  border:threadTheme.getPropertyValue('--rd-hairline').trim(),
  ink:threadTheme.getPropertyValue('--rd-ink').trim(),
  font:threadTheme.getPropertyValue('--rd-font').trim()
};

function drawThreadToken(ctx,view,selection,zoom) {
  const time=DemoThreads.time(selection.id);
  const msg=selection.events.find(e=>e.type==='message' && time>=e.at && time<e.end);
  if(!msg) return;
  const from=view.points[selection.a], to=view.points[selection.b];
  if(!from || !to) return;
  const c=view.ctrl(selection.a,selection.b);
  const progress=(time-msg.at)/(msg.end-msg.at);
  const u=.23+.54*(msg.author===selection.a?progress:1-progress), v=1-u;
  const x=v*v*from.x+2*v*u*c.x+u*u*to.x, y=v*v*from.y+2*v*u*c.y+u*u*to.y;
  const dx=(v*(c.x-from.x)+u*(to.x-c.x)),dy=(v*(c.y-from.y)+u*(to.y-c.y));
  const length=Math.hypot(dx,dy)||1;
  const token=msg.tokens[DemoThreads.tokenCount(msg,time)-1]?.trim();
  if(!token || token==='[[x]]') return;
  ctx.save();ctx.translate(x-dy/length*35/zoom,y+dx/length*35/zoom);ctx.scale(1/zoom,1/zoom);
  ctx.font='600 11px '+tokenPaint.font;
  const width=ctx.measureText(token).width+12;
  ctx.globalAlpha=Math.min(1,progress*10,(1-progress)*10);ctx.beginPath();ctx.roundRect(-width/2,-9,width,18,7);
  ctx.fillStyle=tokenPaint.paper;ctx.fill();ctx.strokeStyle=tokenPaint.border;ctx.lineWidth=.8;ctx.stroke();
  ctx.fillStyle=tokenPaint.ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(token,0,0);ctx.restore();
}
