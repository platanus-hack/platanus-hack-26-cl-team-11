// The movements are drawn in a 64 × 44 coordinate space in both viewers.
window.RondaMotion = (() => {
  const periods = {chat:5.8, calendars:9.8, health:6.7, permission:7.1, help:7.8, checkin:6.3, pulse:8.1, guideline:7.4};
  function ease(t,a,b) {
    const x=Math.min(1,Math.max(0,(t-a)/(b-a)));
    return x*x*(3-2*x);
  }
  function box(c,x,y,w,h,r,fill) {
    if(w<=0 || h<=0) return;
    c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
  }
  function gradient(c,y,h,top,bottom) {
    const fill=c.createLinearGradient(0,y,0,y+h);
    fill.addColorStop(0,top);fill.addColorStop(1,bottom);return fill;
  }
  function shell(c,x,y,w,h,r,top,bottom,edge) {
    c.save();
    c.shadowColor='rgba(27,48,61,.26)';c.shadowBlur=3;c.shadowOffsetY=1.8;
    box(c,x,y+2,w,h,r,edge);c.restore();
    box(c,x,y,w,h,r,edge);
    box(c,x+.65,y+.55,w-1.3,h-1.35,r-.6,gradient(c,y,h,top,bottom));
    box(c,x+r*.8,y+1,w-r*1.6,1,.5,'#ffffff99');
  }
  function line(c,d,color,width=1.8) {
    c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke(new Path2D(d));
  }
  function text(c,word,x,y,size,color) {
    c.font='600 '+size+'px -apple-system,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(word,x,y);
  }
  function disk(c,x,y,r,color) {
    c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  function tick(c,x,y,size,color) {
    c.save();c.translate(x,y);c.scale(size,size);line(c,'M-3 0l2 2 4-4.5',color,1.45);c.restore();
  }

  function chat(c,t) {
    const reply=ease(t,.33,.52)-ease(t,.89,1);
    const outgoing=ease(t,.04,.18)-ease(t,.86,.98);
    // One outgoing key and one incoming key. Each tail points to its author.
    c.save();c.translate(2*outgoing,-1.4*outgoing);
    c.fillStyle='#9385b7';c.fill(new Path2D('M5 14L2 23l12-4Z'));
    shell(c,3,2,43,18,7,'#fffaff','#ded4f1','#a69bbd');
    const typed=Math.max(1,Math.ceil(5*outgoing));
    text(c,'¿Hoy?'.slice(0,typed),24,11,12,'#4b395f');c.restore();
    const replyWidth=28+11*reply;
    c.save();c.translate(5*(1-reply),2*(1-reply));
    const left=60-replyWidth;
    c.fillStyle='#2b7778';c.fill(new Path2D('M56 30l6 12-13-4Z'));
    shell(c,left,20,replyWidth,19,7,'#84d9cd','#218d89','#216766');
    c.save();c.beginPath();c.roundRect(left+2,22,replyWidth-4,15,5);c.clip();
    c.globalAlpha=1-reply;
    for(let i=0;i<3;i++) disk(c,left+7+7*i,29.5-15*reply-1.5*Math.sin(Math.PI*2*(t*2.5-i*.18)),1.7,'#eafffa');
    c.globalAlpha=reply;const answerY=29.5+15*(1-reply);
    text(c,'Sí',35,answerY,12,'#fff');
    c.globalAlpha*=ease(t,.49,.57);tick(c,50,answerY,1.05,'#d2fff5');c.restore();c.restore();
  }

  function health(c,t) {
    const scan=ease(t,.04,.42)-ease(t,.87,1), shut=ease(t,.43,.62)-ease(t,.86,1);
    shell(c,1,5,62,33,12,'#fff2f1','#e4c8cc','#ac8894');
    // The heart stays visible on the bezel when the private readout is covered.
    c.save();c.translate(11,21);const beat=1+.12*Math.sin(12*Math.PI*t)*(1-shut);
    c.scale(beat,beat);c.fillStyle=gradient(c,-5,12,'#d77982','#a94a64');
    c.fill(new Path2D('M0 5C-2 3-7 0-6-4c1-4 5-4 6-1 2-3 6-3 7 1 0 3-4 7-7 9Z'));
    line(c,'M-4-3q1-2 3-1','#ffd7d4',1);c.restore();
    box(c,19,8,40,26,7,'#aa919b');
    box(c,20,9,38,23,6,gradient(c,9,23,'#493547','#2d2937'));
    c.save();c.beginPath();c.roundRect(21,10,36,21,5);c.clip();
    for(let x=23;x<59;x+=6) box(c,x,10,.6,21,0,'#ffffff21');
    for(let y=14;y<32;y+=5) box(c,21,y,36,.55,0,'#ffffff21');
    c.save();c.beginPath();c.rect(21,9,4+32*scan,24);c.clip();
    line(c,'M21 22h5l3-3 2 4 4-11 4 17 3-9 3 2h12','#ffc1cd',2);c.restore();
    if(scan>0 && scan<1){
      const traceX=21+4+32*scan;
      box(c,traceX-1.3,11,1.4,18,.6,'#ffe6eb77');
    }
    c.translate(0,23*(1-shut));
    box(c,20,9,38,23,5,gradient(c,9,23,'#e4d6df','#beabb9'));
    for(let x=23;x<57;x+=3.5) box(c,x,11,.65,17,.3,'#fff7');
    box(c,29,12,20,16,5,'#ae97a8');
    box(c,29,11.5,20,15,5,gradient(c,12,15,'#fffbfc','#e6d6e0'));
    line(c,'M36 18v-2a3 3 0 0 1 6 0v2','#60435a',1.7);
    box(c,34.8,17.5,8.4,6,1.8,'#695164');c.restore();
    box(c,34,35,9,1.3,.6,'#fff9');
  }

  function permission(c,t) {
    const move=ease(t,.19,.49)-ease(t,.86,.99);
    const reveal=ease(t,.50,.68)-ease(t,.82,.95);
    // The one-use permit advances only after the mechanical switch lands.
    shell(c,6,8,52,31,9,'#fff7e4','#e9d5b5','#b19a75');
    c.save();c.beginPath();c.rect(12,-2,40,16);c.clip();c.translate(0,14*(1-reveal));
    box(c,15,1,34,19,3,'#b6ab90');box(c,15.7,0,32.6,19,3,'#fffbea');
    text(c,'1×',24,6.8,9.5,'#74684e');tick(c,41,6.5,1.18,'#297c69');c.restore();
    box(c,11,13,42,3.5,2,'#9d8767');
    box(c,10,18,44,17,8.5,'#fff7e5');
    box(c,10,17,44,16.5,8.2,gradient(c,17,16,'#b98849','#e1b975'));
    c.save();c.globalAlpha=move;box(c,10,17,44,16.5,8.2,gradient(c,17,16,'#276c61','#52a78d'));c.restore();
    c.save();c.globalAlpha=1-move;line(c,'M36 22l3 3-3 3m5-6 3 3-3 3','#fff4d9',1.5);c.restore();
    c.save();c.globalAlpha=move;tick(c,22,25,1.4,'#e2fff1');c.restore();
    const press=ease(t,.12,.19)-ease(t,.49,.59);
    const x=11+24*move;
    c.save();c.translate(0,1.25*press);
    shell(c,x,17.5,18,14.5,6,'#fffdf6','#e6dbcb','#a99e8e');
    for(let i=0;i<3;i++) box(c,x+6+i*2.6,21,1,6,.5,'#bcae99');
    c.restore();
  }

  function portrait(c,x,y,img,checked,color) {
    disk(c,x,y+1.6,9.7,'#8c9dab');disk(c,x,y,9.7,'#fff');
    c.save();c.beginPath();c.arc(x,y,8.4,0,Math.PI*2);c.clip();
    if(img && img.complete && img.naturalWidth) c.drawImage(img,x-8.7,y-8.7,17.4,17.4);
    else {disk(c,x,y,9,color);disk(c,x,y-2,3.2,'#fff');disk(c,x,y+8,5,'#fff');}
    c.restore();
    if(checked>0){c.save();c.globalAlpha=checked;disk(c,x+6.5,y+6.5,4.4,'#fff');disk(c,x+6.5,y+6.5,3.75,'#2b866d');tick(c,x+6.5,y+6.5,.8,'white');c.restore();}
  }
  function help(c,t,faces) {
    const yesA=ease(t,.08,.21)-ease(t,.89,1);
    const yesB=ease(t,.34,.48)-ease(t,.86,.98);
    const join=ease(t,.5,.68)-ease(t,.84,.96);
    shell(c,1,6,62,32,10,'#f6faff','#d9e5f1','#99acbe');
    box(c,5,9,54,25,8,gradient(c,9,25,'#b6c8d8','#e9f0f6'));
    box(c,15,19,34,5,2.5,'#a8bac9');
    box(c,16,20,16*join,2.6,1.3,'#458779');
    box(c,48-16*join,20,16*join,2.6,1.3,'#458779');
    portrait(c,13+4*join,21,faces[0],yesA*(1-join),'#aa94bd');
    portrait(c,51-4*join,21,faces[1],yesB*(1-join),'#b69983');
    if(join>0){c.save();c.globalAlpha=join;c.translate(32,21);c.scale(.7+.3*join,.7+.3*join);
      disk(c,0,1.3,6.4,'#21665e');disk(c,0,0,6.4,gradient(c,-6,12,'#73c9ad','#328d77'));
      line(c,'M-3.2 0l2.2 2.2 4.3-4.4','#fff',1.7);c.restore();}
  }
  function checkin(c,t) {
    // A three-position mood wheel settles into the chosen detent.
    const turn=ease(t,.1,.52)-ease(t,.86,.99);
    const press=ease(t,.53,.59)-ease(t,.63,.72);
    shell(c,3,6,58,32,12,'#ffefc9','#eac88c','#b38d57');
    box(c,7,10,50,23,8,gradient(c,10,23,'#a68551','#f8e8c6'));
    c.save();c.beginPath();c.roundRect(8,11,48,20,7);c.clip();
    for(let i=-1;i<=3;i++){
      const x=32+21*i-16*turn, y=21.3+press;
      const active=i===1;
      disk(c,x,y+1.4,9.1,'#ae8755');
      disk(c,x,y,8.6,gradient(c,y-9,18,active?'#fff4a4':'#fff2d7',active?'#f1b645':'#e7d1a6'));
      disk(c,x-2.8,y-1.4,1,'#6b492e');disk(c,x+2.8,y-1.4,1,'#6b492e');
      c.save();c.translate(x,y);line(c,active?'M-3 2q3 4 6 0':i===0?'M-2.7 2.8h5.4':'M-3 4q3-3 6 0','#765136',1.15);c.restore();
    }
    c.restore();
    const pos=32+5*turn;
    line(c,'M'+(pos-2.5)+' 34l2.5-2.4 2.5 2.4','#936d41',1.3);
    if(turn>.8){c.save();c.globalAlpha=ease(t,.60,.72)-ease(t,.86,.97);disk(c,54,8.5,6,'#fff7d9');tick(c,54,8.5,1.15,'#9b6929');c.restore();}
  }

  function pulse(c,t) {
    const reset=ease(t,.87,1);
    shell(c,2,3,60,37,9,'#d5ece3','#9abdaf','#678d82');
    box(c,7,7,50,22,5,'#73958a');
    box(c,8,8,48,20,4,gradient(c,8,20,'#f7f0d6','#fffbe9'));
    const cx=32,cy=28;
    c.save();c.beginPath();c.rect(9,8,46,20);c.clip();
    c.strokeStyle='#cdc6ae';c.lineWidth=.9;c.beginPath();c.arc(cx,cy,17,3.6,5.82);c.stroke();
    for(let i=0;i<7;i++){
      const angle=3.60+.37*i;
      c.strokeStyle=i>4?'#ad6b55':'#879685';c.lineWidth=i%3===0?1.6:1;
      c.beginPath();c.moveTo(cx+14.2*Math.cos(angle),cy+14.2*Math.sin(angle));
      c.lineTo(cx+17.5*Math.cos(angle),cy+17.5*Math.sin(angle));c.stroke();
    }
    const sweep=ease(t,.46,.65)-reset+.06*(ease(t,.56,.63)-ease(t,.65,.74));
    const angle=3.62+1.41*sweep;
    c.strokeStyle='#b45842';c.lineWidth=1.7;c.lineCap='round';
    c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+16.4*Math.cos(angle),cy+16.4*Math.sin(angle));c.stroke();
    disk(c,cx,cy,3.3,'#506e63');disk(c,cx,cy-1,1.7,'#92ac99');c.restore();
    for(let i=0;i<3;i++){
      const lit=ease(t,.06+.16*i,.13+.16*i)-reset;
      box(c,16+i*12,32,8,3.8,1.8,'#749789');
      c.save();c.globalAlpha=lit;box(c,16+i*12,32,8,3.2,1.6,'#d9fff0');c.restore();
    }
  }

  function guideline(c,t) {
    const write=ease(t,.08,.49), pin=ease(t,.51,.68)-ease(t,.86,.98);
    const ink=write*(1-ease(t,.89,1));
    c.save();c.translate(32,21);c.rotate(-.065);c.translate(-32,-21);
    shell(c,8,5,47,33,5,'#f0eafa','#cbbce5','#9b88b5');
    box(c,11,7,41,28,3,'#d2bfcc');box(c,11,6,41,27,3,gradient(c,6,27,'#fffdf0','#f1e7cf'));
    box(c,13,8,2,22,1,'#dccba4');
    c.save();c.beginPath();c.rect(17,10,29*ink,18);c.clip();
    line(c,'M18 14h19m-19 5h24m-24 5h13','#8e818a',1.6);c.restore();
    c.save();c.globalAlpha=1-pin;c.translate(18+23*ink,22+Math.sin(write*10)*1.8);
    c.rotate(.56);box(c,-1.9,-16,4,15,1,gradient(c,-16,15,'#c6815e','#e5ab70'));
    c.fillStyle='#84644b';c.fill(new Path2D('M-1.9-1L0 3l2-4Z'));c.restore();
    c.save();c.globalAlpha=pin;const y=7-5*(1-pin);
    line(c,'M45 '+(y+2)+'l-2 5','#80657d',1.4);
    disk(c,46,y+.9,4.5,'#91718e');disk(c,46,y,4.2,gradient(c,y-4,8,'#db9fbd','#a76693'));disk(c,44.8,y-1.2,1.1,'#f7d6e2');
    c.restore();c.restore();
  }

  function paint(c,kind,fraction,faces=[]) {
    c.save();
    if(kind==='calendars') window.paintRondaCalendar(c,12*(ease(fraction,0,.87)-ease(fraction,.91,1)));
    else if(kind==='chat') chat(c,fraction);
    else if(kind==='health') health(c,fraction);
    else if(kind==='permission') permission(c,fraction);
    else if(kind==='help') help(c,fraction,faces);
    else if(kind==='checkin') checkin(c,fraction);
    else if(kind==='pulse') pulse(c,fraction);
    else if(kind==='guideline') guideline(c,fraction);
    c.restore();
  }
  return {paint,periods};
})();
