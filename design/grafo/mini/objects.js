// One drawing source for the globe and the portable Stageshow preview.
(() => {
  if (customElements.get('ronda-mini')) return;
  let contactPhotos;
  class RondaMini extends HTMLElement {
    static observedAttributes=['kind','paused','poster'];
    constructor() {
      super();
      this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:inline-block;width:var(--mini-size,72px);aspect-ratio:1}canvas{display:block;width:100%;height:100%}</style><canvas width="240" height="240" aria-hidden="true"></canvas>';
      this.ctx=this.shadowRoot.querySelector('canvas').getContext('2d');
      this.motion=matchMedia('(prefers-reduced-motion: reduce)');
      this.elapsed=0;
      this.update=this.update.bind(this);
      this.frame=this.frame.bind(this);
    }
    connectedCallback() {
      if(!contactPhotos) contactPhotos=['andres','lian'].map(name=>{
        const img=new Image();img.src=window.rondaFaces[name];img.onload=()=>document.querySelectorAll('ronda-mini[kind=help]').forEach(el=>el.draw());return img;
      });
      const style=getComputedStyle(this);
      this.duration=parseFloat(style.getPropertyValue('--mini-cycle'));
      this.delay=parseFloat(style.getPropertyValue('--mini-delay')) || 0;
      this.motion.addEventListener('change',this.update);
      document.addEventListener('visibilitychange',this.update);
      this.update();
    }
    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.motion.removeEventListener('change',this.update);
      document.removeEventListener('visibilitychange',this.update);
    }
    attributeChangedCallback(){if(this.isConnected && this.delay!==undefined) this.update();}
    update(){
      cancelAnimationFrame(this.raf);
      this.last=performance.now();this.draw();
      if(!this.hasAttribute('paused') && !this.hasAttribute('poster') && !this.motion.matches && !document.hidden)
        this.raf=requestAnimationFrame(this.frame);
    }
    frame(now){
      this.elapsed+=(now-this.last)/1000;this.last=now;this.draw();this.raf=requestAnimationFrame(this.frame);
    }
    draw(){
      const ctx=this.ctx,kind=this.getAttribute('kind'),period=this.duration || window.RondaMotion.periods[kind];
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,240,240);
      if(!period)return;
      const t=this.hasAttribute('poster') || this.motion.matches ? .74 : ((this.elapsed-this.delay)%period+period)%period/period;
      ctx.setTransform(3.35,0,0,3.35,13,46);
      window.RondaMotion.paint(ctx,kind,t,contactPhotos);
    }
  }
  customElements.define('ronda-mini',RondaMini);
})();
