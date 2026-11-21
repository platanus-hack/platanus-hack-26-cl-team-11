// Host units are the globe's original 1440 × 900 drawing coordinates. The
// adapter owns five foreground objects, independent of the number of edges.
function mountGlobeMinis(canvas, scenePrefix, frozen) {
  const layer = document.createElement("div");
  layer.className = "globe-minis";
  layer.style.cssText = "position:absolute;left:0;top:0;width:1440px;height:900px;pointer-events:none;transform-origin:0 0";
  canvas.after(layer);
  const styles = document.createElement("style");
  styles.textContent = `
    .globe-object { position:absolute;left:0;top:0;width:0;height:0; }
    .globe-object[hidden]{display:none}
    .mini-leader {position:absolute;left:0;top:0;height:1.5px;background:var(--rd-mini-ink);opacity:.42;transform-origin:left center;pointer-events:none}
    .globe-object .rd-mini-link { pointer-events:auto;position:absolute;display:grid;place-items:center;left:0;top:0;transform:translate(-50%,-50%);text-decoration:none;color:inherit; }
    .globe-object .rd-mini { width:var(--mini-size,76px);aspect-ratio:1;display:block; }
    .globe-object .rd-mini-caption { margin-top:-5px;font:600 var(--mini-label-size,12px)/1.25 var(--rd-font,system-ui);white-space:nowrap;border-radius:99px;padding:2px 7px;background:var(--rd-glass-solid,#fff);color:var(--rd-ink,#222); }
    .globe-object .rd-mini-link:focus-visible {outline:2px solid var(--rd-mini-ink);outline-offset:1px;border-radius:8px}
    .globe-object .rd-mini-link:is(:hover,:focus-visible) .rd-mini-caption { background:var(--rd-mini-ink);color:var(--rd-mini-paper) }
  `;
  layer.append(styles);
  const demo = window.RondaGraphMinis.demo([0,1,2,3,4]);
  const notes = ["¿Quién cubre las 11?", "Review antes de las 10:30", "Consulta privada de salud", "Permiso de un solo uso", "Presentación aceptada"];
  const elements = demo.map((activity,i)=>{
    const holder = document.createElement("div");
    holder.className = "globe-object";
    holder.hidden = true;
    const link = window.RondaGraphMinis.link(activity, scenePrefix, i);
    link.title = notes[i];
    if (!scenePrefix) link.removeAttribute("href"); // Canvas design preview has no sibling HTML files.
    link.querySelector("ronda-mini").toggleAttribute("poster", new URLSearchParams(location.search).has("still"));
    const leader = document.createElement("i");
    leader.className = "mini-leader";
    leader.setAttribute("aria-hidden","true");
    holder.append(leader,link);
    layer.append(holder);
    return holder;
  });
  const rows = demo.map((a,i)=>[a.from,a.to,notes[i]]);
  const denseRows = rows.slice(0,2);
  const candidates = [.5,.38,.62,.29,.71];
  let used = [];
  let occupied = [];
  const lastT = demo.map(()=>.5);
  const offsets = demo.map(()=>({x:0,y:0}));
  let radius=40;
  let dimensionsKey = "";
  let userPaused = false;
  function pauseObjects() {
    for (const holder of elements) holder.querySelector("ronda-mini").toggleAttribute("paused", userPaused || document.hidden);
  }
  document.addEventListener("visibilitychange",pauseObjects);
  function begin(count, points, faceSize) {
    // A media layout can project the whole canvas; keep the DOM and canvas
    // layers on the very same transform and keep the glyph readable on phones.
    const box = canvas.getBoundingClientRect();
    const scale = box.width / 1440 || 1;
    const key = [count,scale,canvas.style.left,canvas.style.top].join(",");
    if (key !== dimensionsKey) {
      dimensionsKey = key;
      layer.style.transform = canvas.style.transform;
      layer.style.left = canvas.style.left;
      layer.style.top = canvas.style.top;
      const small = scale < .7;
      const size=Math.min(140, (small?51:count===5?76:62)/scale);
      radius=size*.48;
      layer.style.setProperty("--mini-size", size+"px");
      layer.style.setProperty("--mini-label-size", Math.min(28,(small?10:12)/scale)+"px");
    }
    occupied = points.slice(0,count===5?5:3).map((p,i)=>({x:p.x,y:p.y,r:faceSize*(count>5&&i>0?.62:i>=3?.8:1)*p.f}));
    used = [];
    for(let i=0;i<elements.length;i++) elements[i].hidden = i >= (count===5?5:2);
  }
  function place(index,p,q,control) {
    function room(xy) {
      let space=Math.min(xy.x,1440-xy.x,xy.y,900-xy.y);
      for (const n of occupied) space=Math.min(space,Math.hypot(xy.x-n.x,xy.y-n.y)-n.r);
      for (const n of used) space=Math.min(space,Math.hypot(xy.x-n.x,xy.y-n.y)-radius);
      return space;
    }
    let bestT=.5, score=-Infinity;
    for (const t of candidates) {
      const distance=room(window.RondaGraphMinis.quadratic(p,q,control,t));
      if (distance>score) {score=distance;bestT=t;}
      if (distance>=radius+8) break;
    }
    const ease=frozen?1:.18;
    lastT[index]+=(bestT-lastT[index])*ease;
    const anchor=window.RondaGraphMinis.quadratic(p,q,control,lastT[index]);
    let delta={x:0,y:0};
    // After a turn, two projected arcs may coincide. Move the object just
    // off its arc and draw a leader back to the exact attachment point.
    if (room(anchor)<radius+4) {
      let quality=-Infinity;
      for (const step of [radius,1.55*radius,2.1*radius]) {
        for (let j=0;j<8;j++) {
          const angle=j*Math.PI/4;
          const x=step*Math.cos(angle),y=step*Math.sin(angle);
          const available=room({x:anchor.x+x,y:anchor.y+y});
          const value=Math.min(available,radius+8)-step*.13-Math.hypot(x-offsets[index].x,y-offsets[index].y)*.08;
          if(value>quality){quality=value;delta={x,y};}
        }
      }
    }
    const offset=offsets[index];
    offset.x+=(delta.x-offset.x)*ease;offset.y+=(delta.y-offset.y)*ease;
    const spot={x:anchor.x+offset.x,y:anchor.y+offset.y};
    used.push(spot);
    const holder=elements[index],leader=holder.firstElementChild;
    const length=Math.hypot(offset.x,offset.y);
    leader.hidden=length<radius;
    if (!leader.hidden) {
      leader.style.width=length.toFixed(1)+"px";
      leader.style.transform="rotate("+Math.atan2(-offset.y,-offset.x)+"rad)";
    }
    holder.style.transform="translate("+spot.x.toFixed(1)+"px,"+spot.y.toFixed(1)+"px)";
  }
  return {rows:n=>n===5?rows:denseRows,begin,place,
    pause(value) { userPaused=value; pauseObjects(); },
    destroy() { document.removeEventListener("visibilitychange",pauseObjects); layer.remove(); }};
}
