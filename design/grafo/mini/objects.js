// Ronda's graph activity objects. Each instance owns a small inline vector scene.
// Use <ronda-mini kind="chat" class="rd-mini"> inside an edge's accessible link.
(() => {
  if (customElements.get("ronda-mini")) return;
  const ink = "var(--rd-mini-ink)";
  const color = tone => "var(--rd-mini-" + tone + ")";
  const path = (d, fill, width = 2.5) =>
    '<path d="' + d + '" fill="' + fill + '" stroke="' + (width ? ink : "none") + '" stroke-width="' + width + '"/>';
  const line = (d, tone, width = 2.3) =>
    '<path d="' + d + '" fill="none" stroke="' + color(tone) + '" stroke-width="' + width + '"/>';
  const dot = (x, y, r, tone) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + color(tone) + '"/>';
  const group = (name, inside) => '<g class="' + name + '">' + inside + '</g>';
  const at = (transform, inside) => '<g transform="' + transform + '">' + inside + '</g>';
  const shadow = (x, y, rx) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="6" fill="var(--rd-mini-shadow)"/>';
  function relief(d, face, edge, depth = 5) {
    // Project the silhouette towards the lower right. The outline belongs to
    // the two outer faces; filling the steps between them gives one solid rim.
    let sides = "";
    for (let i = depth; i >= 0; i--) {
      sides += at("translate(" + i * .55 + " " + i + ")", path(d, color(edge), i === depth ? 2.5 : 0));
    }
    return sides + path(d, color(face));
  }

  function chat() {
    const near = "M14 43Q14 36 22 36H63Q70 36 70 43V65Q70 72 63 72H40L26 82L28 72H22Q14 72 14 65Z";
    const far = "M51 21Q51 15 58 15H94Q101 15 101 22V42Q101 48 94 48H89L91 57L76 48H58Q51 48 51 42Z";
    const answer = relief(far, "yellow", "ochre") + line("M57 23Q57 20 62 20H89", "paper", 2)
      + group("reply-ink", line("M63 33H87M64 39H77", "ink", 3.2));
    const question = relief(near, "mint", "teal", 6) + line("M19 45Q19 41 24 41H47", "paper", 2)
      + [29, 41, 53].map((x, i) => group("dot d" + i, dot(x, 55, 3.4, "ink"))).join("");
    return shadow(58, 88, 44) + at("rotate(6 77 36)", group("chat-reply", answer))
      + at("rotate(-8 40 58)", group("chat-ask", question));
  }

  function pad(cover, rim) {
    const sheet = "M23 19H69Q73 19 73 24V70Q73 74 69 74H23Q19 74 19 70V24Q19 19 23 19Z";
    const binding = [30, 45, 60].map(x => line("M" + x + " 23v-9q0-4 4-4", "ink", 4.5)).join("");
    return relief(sheet, "paper", "paper-side", 6)
      + path("M23 19H69Q73 19 73 24V34H19V24Q19 19 23 19Z", color(cover), 2)
      + line("M22 26H69", rim, 2) + binding
      + line("M27 42h8m10 0h12M28 64h12m8 0h9", "paper-side", 3.2)
      + group("cal-match", path("M22 46H70V58H22Z", color("mint"), 1.5) + line("m40 52 4 3 9-7", "ink", 2));
  }
  function calendars() {
    return shadow(61, 88, 43)
      + at("translate(38 0) rotate(9 43 53) scale(.9)", group("cal-back", pad("blue", "denim")))
      + at("translate(-2 12) rotate(-8 45 55) scale(.91)", group("cal-front", pad("orange", "rust")));
  }

  function health() {
    const caseShape = "M22 24Q22 17 30 17H88Q96 17 96 25V66Q96 74 87 74H29Q22 74 22 65Z";
    const lock = line("M78 64v-6q0-11 9-11t9 10v7", "ink", 6)
      + line("M78 62v-4q0-9 8-9t8 9v5", "paper", 2.4)
      + relief("M75 62H98Q101 62 101 66V81Q101 84 98 84H75Q72 84 72 81V66Q72 62 75 62Z", "yellow", "ochre", 3)
      + dot(86, 72, 2.5, "ink") + line("M86 73v4", "ink", 2.5);
    return shadow(60, 89, 43)
      + path("M45 72l-2 9-11 3v3h50v-4l-13-3-2-10Z", color("teal"))
      + at("rotate(-5 60 47)", relief(caseShape, "mint", "teal", 6)
        + line("M28 28q0-5 5-5h38", "paper", 2)
        + path("M34 30Q34 27 38 27H80Q86 27 86 32V55Q86 60 80 60H39Q33 60 33 55Z", color("screen"))
        + line("M39 36l7-4m-5 10 14-9", "teal", 1.4)
        + group("signal", line("M39 46h10l4-7 5 14 5-21 5 15h12", "phosphor", 2.8))
        + dot(35, 66, 2.2, "phosphor") + line("M42 66h13m3 0h4", "ink", 2.2))
      + group("lock", lock);
  }

  function permission() {
    const page = "M16 61 70 51 101 70 47 84Z";
    const stamp = relief("M33 46 68 39 85 49 49 57Z", "blue", "denim", 5)
      + path("M46 44q6-5 4-11l-3-10 14-3 1 10q-1 9 5 13l-12 5Z", color("rust"))
      + relief("M43 19q1-6 11-8 13-3 19 4 3 6-5 10-10 5-20 3-8-1-5-9Z", "orange", "rust", 4)
      + line("M48 18q6-4 14-4", "paper", 2.4);
    return shadow(60, 90, 44)
      + group("paper", relief(page, "paper", "paper-side", 4)
        + line("m24 63 19-4m-13 7 13-3", "paper-side", 2)
        + group("inkmark", line("m52 68 6 3 11-10", "teal", 4)))
      + group("stamp", stamp);
  }

  function help() {
    const left = "M14 34H49V44C56 40 64 44 64 51S56 62 49 57V71H16Q12 71 12 67V38Q12 34 14 34Z";
    const right = "M50 34H88Q92 34 92 38V67Q92 71 88 71H50V57C57 62 65 58 65 51S57 40 50 44Z";
    function accepted(x, name) {
      return group(name, dot(x, 55, 7, "paper") + line("m" + (x-3.5) + " 55 2.5 2.5 4.8-5.3", "ink", 2.1));
    }
    return shadow(58, 85, 44) + at("translate(5 -3) rotate(-10 54 55)",
      group("puzzle-r", relief(right, "blue", "denim", 6) + line("M55 39H84", "paper", 2) + accepted(77, "yes-r"))
      + group("puzzle-l", relief(left, "yellow", "ochre", 6) + line("M17 43v-4h26", "paper", 2) + accepted(29, "yes-l")));
  }

  const drawings = {chat, calendars, health, permission, help};
  const styles = `
    :host { display:inline-block; width:var(--mini-size,72px); aspect-ratio:1; }
    svg { display:block; width:100%; height:100%; overflow:visible; }
    .chat-ask,.chat-reply,.dot,.cal-back,.cal-front,.cal-match,.signal,.lock,.stamp,.paper,.inkmark,.puzzle-l,.puzzle-r,.yes-l,.yes-r {
      animation-duration:var(--mini-cycle,5s); animation-iteration-count:infinite;
      animation-timing-function:cubic-bezier(.36,.05,.22,1); animation-delay:var(--mini-delay,0s);
      transform-box:fill-box; transform-origin:center;
    }
    .chat-ask {animation-name:ask} .chat-reply {animation-name:reply}
    .d0 {animation-name:dot-a} .d1 {animation-name:dot-b} .d2 {animation-name:dot-c}
    .cal-back {animation-name:back} .cal-front {animation-name:front} .cal-match,.inkmark {animation-name:print}
    .signal path {stroke-dasharray:85; animation:trace var(--mini-cycle,5s) linear var(--mini-delay,0s) infinite}
    .lock {animation-name:latch} .stamp {animation-name:press} .paper {animation-name:send}
    .puzzle-l {animation-name:join-left} .puzzle-r {animation-name:join-right}
    .yes-l {animation-name:agree-left} .yes-r {animation-name:agree-right}
    @keyframes ask {0%,45%,100%{transform:none} 17%,26%{transform:translate(2px,-7px) rotate(-3deg)}}
    @keyframes reply {0%,34%,83%,100%{transform:none} 54%,64%{transform:translate(-2px,-9px) rotate(4deg)}}
    @keyframes dot-a {12%,29%{transform:none} 19%{transform:translateY(-4px)}}
    @keyframes dot-b {15%,32%{transform:none} 22%{transform:translateY(-4px)}}
    @keyframes dot-c {18%,35%{transform:none} 25%{transform:translateY(-4px)}}
    @keyframes back {0%,12%,92%,100%{transform:translate(4px,-5px) rotate(5deg)} 42%,72%{transform:none}}
    @keyframes front {0%,12%,92%,100%{transform:translate(-4px,2px) rotate(-6deg)} 42%,72%{transform:none}}
    @keyframes print {0%,28%,96%,100%{opacity:0} 37%,88%{opacity:1}}
    @keyframes trace {0%,10%{stroke-dashoffset:85} 49%,88%{stroke-dashoffset:0} 99%,100%{stroke-dashoffset:-85}}
    @keyframes latch {0%,33%,95%,100%{transform:translate(5px,-6px) rotate(9deg)} 53%,79%{transform:none}}
    @keyframes press {0%,15%,87%,100%{transform:translate(0,-4px) rotate(-5deg)} 36%,43%{transform:translate(0,12px)} 57%,77%{transform:translate(-1px,-7px) rotate(-5deg)}}
    @keyframes send {0%,49%,100%{transform:none} 74%,84%{transform:translate(10px,-2px)}}
    @keyframes join-left {0%,31%,94%,100%{transform:translate(-7px,1px)} 51%,76%{transform:none}}
    @keyframes join-right {0%,31%,94%,100%{transform:translate(11px,-2px)} 51%,76%{transform:none}}
    @keyframes agree-left {0%,8%,96%,100%{opacity:0} 17%,83%{opacity:1}}
    @keyframes agree-right {0%,22%,96%,100%{opacity:0} 30%,83%{opacity:1}}
    :host([paused]) * {animation-play-state:paused}
    :host([poster]) *, :host([poster]) .signal path {animation:none}
    @media(prefers-reduced-motion:reduce){:host svg *{animation:none!important}}
  `;
  class RondaMini extends HTMLElement {
    static observedAttributes = ["kind"];
    constructor() { super(); this.attachShadow({mode:"open"}); }
    connectedCallback() { this.draw(); }
    attributeChangedCallback() { if (this.isConnected) this.draw(); }
    draw() {
      const render = drawings[this.getAttribute("kind")];
      if (!Object.hasOwn(drawings, this.getAttribute("kind"))) { this.shadowRoot.replaceChildren(); return; }
      this.shadowRoot.innerHTML = '<style>' + styles + '</style><svg aria-hidden="true" viewBox="0 0 116 104" stroke-linejoin="round" stroke-linecap="round">' + render() + '</svg>';
    }
  }
  customElements.define("ronda-mini", RondaMini);
})();
