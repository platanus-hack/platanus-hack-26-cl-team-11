// A small schedule control, drawn in the same projection as the active edge.
function drawCalendarEdge(ctx, from, to, control, faces, zoom, seconds, still) {
  const width = (innerWidth < 750 ? 52 : 64) / zoom;
  const scale = width / 64;
  let anchor, best = -Infinity;
  for (const u of [.5, .45, .55, .4, .6]) {
    const v = 1-u;
    const x = v*v*from.x + 2*v*u*control.x + u*u*to.x;
    const y = v*v*from.y + 2*v*u*control.y + u*u*to.y;
    const room = Math.min(...faces.map(p => Math.hypot(p.x-x,p.y-y) - (p.r || 0)));
    if (room > best) { best = room; anchor = {x,y}; }
    if (room > width*.62) break;
  }
  // At a tight viewing angle the faces take precedence over the miniature.
  if (best < width*.42) return;
  const phase = still ? .66 : (seconds % 4.6) / 4.6;
  function rise(a,b) {
    const t = Math.max(0,Math.min(1,(phase-a)/(b-a)));
    return t*t*(3-2*t);
  }
  const first = rise(.08,.32)-rise(.86,.98);
  const second = rise(.22,.47)-rise(.82,.95);
  const match = rise(.45,.57)-rise(.78,.88);
  function box(x,y,w,h,r,fill) {
    ctx.fillStyle=fill; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
  }
  function enamel(top,bottom,y,h) {
    const gradient=ctx.createLinearGradient(0,y,0,y+h);
    gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
    return gradient;
  }
  ctx.save();
  ctx.translate(anchor.x,anchor.y);ctx.scale(scale,scale);
  ctx.translate(-32,-22);
  ctx.shadowColor='rgba(30,64,72,.25)';ctx.shadowBlur=6*scale;ctx.shadowOffsetY=3*scale;
  box(0,1,64,42,10,'#b3c2c7');
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.shadowColor='transparent';
  box(0,0,64,40,10,'#bfcfd2');
  box(1,1,62,38,9,enamel('#ffffff','#e8eff0',1,38));
  // Two miniature keyways share a single half-hour detent.
  box(6,20,52,16,5,'#ffffff');
  box(6,19,52,16,5,enamel('#cedadd','#ebf0f1',19,16));
  for (const y of [21,28]) {
    for (const x of [9,24,39]) box(x,y,16,4.5,2,'rgba(71,102,109,.14)');
  }
  const keys = [[9+15*first,21,'#6593a2'],[39-15*second,28,'#8791a9']];
  for (const [x,y,shade] of keys) {
    box(x,y+.8,16,4.8,2,shade);
    box(x,y,16,3.8,1.8,enamel('#dce9e9',shade,y,4));
    ctx.globalAlpha=match;
    box(x,y,16,4.2,1.8,enamel('#42adac','#016075',y,4));
    ctx.globalAlpha=1;
  }
  // Roll the time inside a fixed aperture once both keys meet.
  ctx.save();ctx.beginPath();ctx.rect(4,2,56,16);ctx.clip();
  ctx.font='600 13px -apple-system, system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#415963';ctx.fillText('10:00',32,11-17*match);
  ctx.fillStyle='#014e60';ctx.fillText('10:30',32,28-17*match);
  ctx.restore();ctx.restore();
}
