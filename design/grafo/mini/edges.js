// Position parameters are in the host graph's viewBox. Only the public kind
// and participants reach the object. Its SVG never receives private values.
(() => {
  const kinds = {
    chat: "Chat", calendars: "Agendas", health: "Salud privada", permission: "Permiso", help: "Ayuda",
  };
  function demo(ids) {
    const [a,b,c,d,e] = ids;
    return [
      {kind:"chat", from:a, to:b}, {kind:"calendars", from:b, to:c},
      {kind:"health", from:e, to:d}, {kind:"permission", from:e, to:a},
      {kind:"help", from:d, to:c},
    ];
  }
  function link(activity, prefix, index) {
    const label = kinds[activity.kind];
    if (!Object.hasOwn(kinds, activity.kind)) throw new Error("Unknown activity kind");
    const anchor = document.createElement("a");
    anchor.className = "rd-mini-link";
    anchor.href = prefix + activity.kind + ".html";
    anchor.title = label + " · Ver escena";
    anchor.setAttribute("aria-label", "Ver escena de " + label.toLowerCase());
    const object = document.createElement("ronda-mini");
    object.className = "rd-mini";
    object.setAttribute("kind", activity.kind);
    object.style.setProperty("--mini-delay", (-index * .93) + "s");
    object.style.setProperty("--mini-cycle", window.RondaMotion.periods[activity.kind] + "s");
    const caption = document.createElement("span");
    caption.className = "rd-mini-caption";
    caption.textContent = label;
    anchor.append(object, caption);
    return anchor;
  }
  function quadratic(p, q, control, t) {
    const s = 1 - t;
    return {x:s*s*p.x + 2*s*t*control.x + t*t*q.x,
            y:s*s*p.y + 2*s*t*control.y + t*t*q.y};
  }
  window.RondaGraphMinis = {demo, link, quadratic};
})();
