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
    return Math.max(0,Math.min(event.tokens.length,1+Math.floor((t-event.at)/(event.end-event.at)*event.tokens.length)));
  }
  return {key,time,set,start,fraction,duration,tokenCount,paused:id=>runs.get(id)?.paused};
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

function mountThreadInspector(graph,initialKind) {
  const dialog=document.querySelector('#thread-view');
  const find=selector=>dialog.querySelector(selector);
  const feed=find('.thread-feed'), heading=find('h2'), status=find('.thread-status');
  const timeline=find('.thread-position'), clock=find('.thread-time'), toggle=find('.thread-toggle');
  const mark=find('.thread-mark').getContext('2d');
  const picker=document.querySelector('#thread-picker');
  const launch=document.querySelector('#open-calendar-thread');
  picker.hidden=false;
  const select=picker.querySelector('select');
  for(const motion of globeMotions) select.add(new Option(threadStories[motion.kind].label,motion.kind));
  select.value=initialKind && threadStories[initialKind] ? initialKind : 'calendars';
  let selected,events=[],rows=[],frame=0,previous=-1;
  const transcripts=new Map();
  function node(tag,cls,value) {
    const el=document.createElement(tag);if(cls) el.className=cls;
    if(value!==undefined) el.textContent=value;return el;
  }
  function face(author) {
    const el=node('span','thread-face');
    Object.assign(el.style,graph.faceStyle(author));
    el.style.width='24px';el.style.height='24px';el.setAttribute('aria-hidden','true');
    return el;
  }
  function row(event) {
    const el=node('article','thread-event');
    const label=node('header'),name=node('strong','',graph.people[event.author].name);
    const stamp=node('time','','+'+event.at.toFixed(1)+' s');
    label.append(face(event.author),name,stamp);el.append(label);
    let content,receipt,payload;
    if(event.type==='call') {
      content=node('details','thread-tool');
      const summary=node('summary'),glyph=node('span','tool-glyph','{ }');
      const description=node('span','tool-copy'),title=node('b','',event.label);
      receipt=node('small');description.append(title,receipt);
      const caret=node('span','tool-caret','⌄');caret.setAttribute('aria-hidden','true');
      summary.append(glyph,description,caret);content.append(summary);
      content.append(node('code','tool-name',event.name));
      for(const [tag,value] of [['Entrada',event.input],['Resultado',event.output]]) {
        payload=node('details','thread-payload');
        payload.append(node('summary','',tag),node('pre','',JSON.stringify(value,null,2)));content.append(payload);
      }
    } else {
      content=node('p','thread-bubble');
      if(event.author===graph.threadSelection.b) el.classList.add('reply');
    }
    el.append(content);
    if(event.withheld) {
      const seal=node('div','thread-redaction');
      const stripes=node('i');stripes.setAttribute('aria-hidden','true');
      seal.append(stripes,node('small','','Dato privado'));el.append(seal);
    }
    feed.append(el);return {content,receipt,payload,count:0,word:null};
  }
  function appendTokens(row,event,count,animate) {
    while(row.count<count){
      const token=event.tokens[row.count++];
      if(!row.word){row.word=node('span','thread-word');row.content.append(row.word);}
      const fragment=node('span',animate?'thread-token arriving':'thread-token',token.trimEnd());
      row.word.append(fragment);
      if(/\s$/u.test(token)){row.content.append(' ');row.word=null;}
    }
  }
  function reset() {feed.replaceChildren();rows=[];}
  function render(){
    cancelAnimationFrame(frame);
    if(!dialog.open) return;
    const selection=graph.threadSelection;
    const t=DemoThreads.time(selected,graph.reduced);
    if(t<previous-.01) reset();
    previous=t;
    const follow=!feed.querySelector('details[open]') && feed.scrollHeight-feed.clientHeight-feed.scrollTop<32;
    let current='En curso',changed=false;
    events.forEach((event,i)=>{
      if(t<event.at) return;
      if(!rows[i]) {rows[i]=row(event);changed=true;}
      const {content,receipt,payload}=rows[i];
      if(event.type==='message'){
        const count=DemoThreads.tokenCount(event,t);
        if(rows[i].count<count){
          appendTokens(rows[i],event,count,!graph.reduced && !DemoThreads.paused(selected) && t<event.end && count-rows[i].count<=2);
          changed=true;
        }
        content.classList.toggle('streaming',t<event.end && !DemoThreads.paused(selected));
        current=t<event.end?'Transmitiendo':'En curso';
      } else {
        const done=t>=event.end;
        const value=done?event.receipt:(event.pending || 'Ejecutando…');
        if(receipt.textContent!==value){receipt.textContent=value;changed=true;}
        content.dataset.done=String(done);payload.hidden=!done;
        current=done?'En curso':event.pending || 'Usando herramienta';
      }
    });
    const end=t>=DemoThreads.duration,paused=DemoThreads.paused(selected);
    if(end) current='Finalizado';else if(paused) current='En pausa';
    dialog.dataset.playing=String(!end&&!paused&&!graph.reduced);
    if(status.textContent!==current) status.textContent=current;
    timeline.value=String(t);timeline.disabled=graph.reduced;timeline.setAttribute('aria-valuetext',t.toFixed(1)+' de 12 segundos');
    timeline.style.setProperty('--progress',(100*t/DemoThreads.duration)+'%');
    clock.textContent=t.toFixed(1)+' / 12 s';
    toggle.hidden=graph.reduced;toggle.disabled=end;toggle.textContent=paused?'Continuar':'Pausar';
    find('.thread-replay').hidden=graph.reduced;
    mark.setTransform(1,0,0,1,0,0);mark.clearRect(0,0,160,112);mark.setTransform(2.2,0,0,2.2,10,7);
    window.RondaMotion.paint(mark,selection.kind==='exchange'?'chat':selection.kind,t/12*.8,[graph.team[selection.a],graph.team[selection.b]]);
    if(follow && changed) feed.scrollTop=feed.scrollHeight;
    if(!end && !paused) frame=requestAnimationFrame(render);
  }
  function open(a,b,topic) {
    selected=DemoThreads.key(a,b);
    const motion=globeMotions.find(m=>DemoThreads.key(m.a,m.b)===selected);
    if(motion){a=motion.a;b=motion.b;select.value=motion.kind;}
    const kind=motion?.kind || 'exchange';
    if(!transcripts.has(selected)) transcripts.set(selected,{id:selected,a,b,kind,events:threadScript(kind,a,b,graph.people)});
    graph.threadSelection=transcripts.get(selected);events=graph.threadSelection.events;
    const spot=graph.motionSpots?.find(m=>m.kind===kind);
    DemoThreads.start(selected,spot?.fraction || 0);
    dialog.style.setProperty('--thread-accent',threadStories[kind].tint);
    heading.textContent=kind==='exchange' && topic ? topic : threadStories[kind].title;
    find('.thread-pair').textContent=graph.people[a].name+' ↔ '+graph.people[b].name;
    reset();previous=-1;if(!dialog.open) dialog.showModal();render();
  }
  launch.onclick=()=>{const m=globeMotions.find(m=>m.kind===select.value);open(m.a,m.b);};
  toggle.onclick=()=>{DemoThreads.set(selected,DemoThreads.time(selected),!DemoThreads.paused(selected));render();};
  timeline.oninput=()=>{DemoThreads.set(selected,Number(timeline.value),true);render();};
  find('.thread-close').onclick=()=>dialog.close();
  find('.thread-replay').onclick=()=>{DemoThreads.set(selected,0);reset();render();};
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);graph.threadSelection=null;launch.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog && !dialog.querySelector('.thread-panel').contains(e.target))dialog.close();});
  graph.refreshThread=()=>{if(dialog.open){reset();render();}};
  return open;
}

function pickProjectedThread(view,m,tolerance,activeOnly=false) {
  for(const spot of view.spots){
    if(Math.abs(spot.x-m.x)<spot.width*.52 && Math.abs(spot.y-m.y)<spot.width*.38)
      return {a:spot.a,b:spot.b};
  }
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
  const from=view.points[selection.a], to=view.points[selection.b];
  if(!from || !to) return;
  const c=view.ctrl(selection.a,selection.b);
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
