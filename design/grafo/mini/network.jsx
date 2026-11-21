import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {Stage} from "../../../.agents/skills/stageshow/kit/stage";
import "./objects";
import "./edges";

// A single Stageshow stage contains every exchange: the independent CSS loops
// use the same pause switch. The compact composition moves nodes, not time.
const mini = window.RondaGraphMinis;
const people = Object.keys(window.rondaFaces);
const names = ["Mati", "Ian", "Lian", "Andrés", "Roberto"];
const activities = mini.demo(people);
const wide = [[458,72],[802,202],[680,421],[237,421],[113,202]];
const phone = [[177,48],[310,169],[276,361],[76,361],[46,169]];
const bends = [-.13, -.13, .09, -.13, .14];
const anchors = [.50,.51,.50,.50,.50];
const initial = {beat:0};
async function choreography(a) {
  for (const [index, name] of ["pregunta","coincidencia","lectura","sello","encaje"].entries()) {
    a.mark(name);
    a.put({beat:index});
    await a.wait(960);
  }
}
function edge(p,q,bend) {
  const c = {x:(p.x+q.x)/2-(q.y-p.y)*bend, y:(p.y+q.y)/2+(q.x-p.x)*bend};
  return {d:"M"+p.x+" "+p.y+" Q"+c.x+" "+c.y+" "+q.x+" "+q.y, c};
}
function Activity({activity, spot, index, paused, poster}) {
  const slot = useRef(null);
  useLayoutEffect(()=>{
    const a = mini.link(activity,"",index);
    const target=names[people.indexOf(activity.to)];
    a.id="mini-"+activity.kind;
    a.setAttribute("aria-label", a.getAttribute("aria-label")+" entre "+names[people.indexOf(activity.from)]+(target==="Ian"?" e ":" y ")+target);
    slot.current.replaceChildren(a);
    if (location.hash === "#"+a.id) a.focus({preventScroll:true});
  },[activity,index]);
  useLayoutEffect(()=>{
    const obj=slot.current.querySelector("ronda-mini");
    obj.toggleAttribute("paused",paused);
    obj.toggleAttribute("poster",poster);
  },[paused,poster]);
  return <div className="activity" style={{left:spot.x,top:spot.y}} ref={slot}/>;
}
function Network({layout,paused,poster}) {
  const small=layout==="compact";
  const w=small?358:920,h=small?456:542;
  const xy=(small?phone:wide).map(([x,y])=>({x,y}));
  const exchanges=activities.map((item,i)=>{
    const p=xy[people.indexOf(item.from)],q=xy[people.indexOf(item.to)];
    const {d,c}=edge(p,q,bends[i]);
    return {item,d,spot:mini.quadratic(p,q,c,anchors[i])};
  });
  const quiet=[];
  for(let i=0;i<xy.length;i++) for(let j=i+1;j<xy.length;j++) {
    if(!activities.some(a=>[a.from,a.to].includes(people[i])&&[a.from,a.to].includes(people[j]))) {
      quiet.push(edge(xy[i],xy[j],.045).d);
    }
  }
  return <div className="network" data-paused={paused||poster}>
    <svg viewBox={'0 0 '+w+' '+h} className="routes" aria-hidden="true">
      <defs><linearGradient id="live"><stop stopColor="var(--rd-g1)"/><stop offset=".54" stopColor="var(--rd-g3)"/><stop offset="1" stopColor="var(--rd-g5)"/></linearGradient></defs>
      {quiet.map(d=><path className="quiet-line" key={d} d={d}/>)}
      {exchanges.map(({item,d},i)=><g key={item.kind}><path className="active-line" d={d}/>
        <path className="routing-light" pathLength="100" d={d} style={{animationDelay:(-i*.93)+"s"}}/></g>)}
    </svg>
    {people.map((person,i)=><div key={person} className="agent" style={{left:xy[i].x,top:xy[i].y}}>
      <img className="rd-face" alt="" src={window.rondaFaces[person]}/><span className="rd-person__name">{names[i]}</span>
    </div>)}
    {exchanges.map(({item,spot},i)=><Activity key={item.kind} activity={item} spot={spot} index={i} paused={paused} poster={poster}/>)}
  </div>;
}
function App(){
  const [paused,setPaused]=useState(false);
  const [hidden,setHidden]=useState(document.hidden);
  const [visible,setVisible]=useState(true);
  const [reduced,setReduced]=useState(()=>matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{
    const button=document.querySelector("#toggle");
    const click=()=>setPaused(p=>!p);
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const change=()=>setReduced(media.matches);
    const visibility=()=>setHidden(document.hidden);
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
    observer.observe(document.querySelector("#example"));
    button.addEventListener("click",click);
    media.addEventListener("change",change);
    document.addEventListener("visibilitychange",visibility);
    return ()=>{button.removeEventListener("click",click);media.removeEventListener("change",change);document.removeEventListener("visibilitychange",visibility);observer.disconnect();};
  },[]);
  useLayoutEffect(()=>{
    const button=document.querySelector("#toggle");
    button.hidden=reduced;
    button.dataset.paused=String(paused);
    button.querySelector("span").textContent=paused?"Reanudar":"Pausar";
    document.querySelector("#still").hidden=!reduced;
  },[paused,reduced]);
  return <Stage width={920} height={542} compact={{below:620,width:358,height:456}}
    initial={initial} poster={initial} script={choreography} play="once" className="mini-stage">
    {(_,rect,layout)=><Network layout={layout} paused={paused||hidden||!visible} poster={reduced}/>}
  </Stage>;
}
createRoot(document.querySelector("#example")).render(<App/>);
