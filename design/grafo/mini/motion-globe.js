const globeMotions = [
  {kind:'chat',a:0,b:1}, {kind:'calendars',a:1,b:2}, {kind:'health',a:3,b:4},
  {kind:'permission',a:4,b:0}, {kind:'help',a:3,b:2}
];

const previousAnchors = new Map();

function paintGraphMotions(ctx,points,control,zoom,seconds,poster,photos,selection) {
  const occupied=points.filter(p=>p && p.z>-.1 && p.r>2).map(p=>({x:p.x,y:p.y,r:p.r+3}));
  const width=(innerWidth<750?52:64)/zoom;
  const drawn=[];
  for(const [i,motion] of globeMotions.entries()) {
    if(selection==='all' && points.length>5 && i>=2) continue;
    if(selection!=='all' && motion.kind!==selection) continue;
    const a=points[motion.a],b=points[motion.b];
    if(!a || !b || a.r<2 || b.r<2) continue;
    const c=control(motion.a,motion.b);
    if(c.z<-.15) continue;
    function pointAt(u) {
      const v=1-u;
      return {x:v*v*a.x+2*u*v*c.x+u*u*b.x,y:v*v*a.y+2*u*v*c.y+u*u*b.y};
    }
    let target=.5, best=-Infinity;
    for(const u of [.5,.44,.56,.38,.62]){
      const {x,y}=pointAt(u);
      const clearance=Math.min(...occupied.map(p=>Math.hypot(x-p.x,y-p.y)-p.r));
      if(clearance>best){best=clearance;target=u;}
      if(clearance>width*.62)break;
    }
    // Slide along the arc as faces drift into its path.
    const last=previousAnchors.get(motion.kind);
    const now=performance.now();
    const follow=last && !poster ? 1-Math.exp(-(now-last.time)/100) : 1;
    const u=last ? last.u+(target-last.u)*follow : target;
    const anchor=pointAt(u);
    function room(dx,dy) {
      return Math.min(...occupied.map(p=>Math.hypot(anchor.x+dx-p.x,anchor.y+dy-p.y)-p.r));
    }
    // When foreshortening squeezes an arc, keep the control next to its arc.
    let dx=0,dy=0;
    if(room(0,0)<width*.47){
      let score=-Infinity;
      for(const step of [.32,.62,.92]){
        for(let i=0;i<8;i++){
          const x=Math.cos(i*Math.PI/4)*width*step,y=Math.sin(i*Math.PI/4)*width*step;
          const value=Math.min(width*.58,room(x,y))-.13*Math.hypot(x,y)
            -.06*Math.hypot(x-(last?.dx||0),y-(last?.dy||0));
          if(value>score){score=value;dx=x;dy=y;}
        }
      }
    }
    if(last){dx=last.dx+(dx-last.dx)*follow;dy=last.dy+(dy-last.dy)*follow;}
    previousAnchors.set(motion.kind,{u,time:now,dx,dy});
    const spot={x:anchor.x+dx,y:anchor.y+dy};
    if(Math.hypot(dx,dy)>width*.28){
      ctx.save();ctx.strokeStyle='rgba(82,96,110,.42)';ctx.lineWidth=1/zoom;
      ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(spot.x,spot.y);ctx.stroke();ctx.restore();
    }
    const period=window.RondaMotion.periods[motion.kind];
    const fraction=poster ? .74 : (seconds/period+i*.27)%1;
    ctx.save();ctx.translate(spot.x,spot.y);ctx.scale(width/64,width/64);ctx.translate(-32,-22);
    window.RondaMotion.paint(ctx,motion.kind,fraction,[photos[motion.a],photos[motion.b]]);
    ctx.restore();occupied.push({...spot,r:width*.55});
    drawn.push({kind:motion.kind,...spot,width});
  }
  return drawn;
}
