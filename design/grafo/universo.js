// Montu · Universo: 100 personas, grupos complejos de 3 a 5 que conversan sobre cientos de temas.
//
// ┌──────────────────────────────────────────────────────────────────────────────────────────┐
// │ PANEL DEMO OMNIPOTENTE. Esta demo (universo.html) muestra TODO lo que existe en el grafo: │
// │ cada herramienta de RondaTools, cada miniatura de RondaMotion, el streaming, permisos,    │
// │ datos privados, mensajes humanos y grupos complejos. Regla (AGENTS.md, regla 6): cada vez │
// │ que se agrega algo nuevo (una herramienta, una miniatura, un estado, un tipo de mensaje), │
// │ se agrega también aquí, en CATALOG o en el generador de guiones, y debe verse en toda su  │
// │ gloria dentro de una vuelta completa. El catálogo inferior marca qué ya apareció.         │
// └──────────────────────────────────────────────────────────────────────────────────────────┘
//
// Depende de: hilo/stream.js, hilo/tools.js, hilo/edge.js, mini/calendar-edge.js, mini/motion-paint.js.
window.RondaUniverse = (() => {
  const N = 100;
  const TEAM = [['Tú', 'mati'], ['Ian', 'ian'], ['Lian', 'lian'], ['Andrés', 'andres'], ['Roberto', 'roberto']];
  const NAMES = ['Camila', 'Benjamín', 'Sofía', 'Matías', 'Valentina', 'Tomás', 'Isidora', 'Vicente', 'Florencia', 'Agustín', 'Josefa', 'Martín', 'Antonia', 'Joaquín', 'Catalina', 'Lucas', 'Fernanda', 'Diego', 'Trinidad', 'Maximiliano', 'Javiera', 'Cristóbal', 'Emilia', 'Felipe', 'Constanza', 'Ignacio', 'Amanda', 'Nicolás', 'Paz', 'Sebastián', 'Renata', 'Gaspar', 'Elisa', 'Bruno', 'Julieta', 'Simón', 'Rocío', 'Pedro', 'Martina', 'León'];

  // Temas: verbos × asuntos = cientos de conversaciones posibles.
  // Cada tema cabe en 26 letras: va entero en el panel, en las filas y en el calendario, sin puntos suspensivos.
  const VERBS = ['Mover', 'Cubrir', 'Revisar', 'Preparar', 'Coordinar', 'Cerrar', 'Probar', 'Ordenar', 'Agendar', 'Presentar', 'Repartir', 'Confirmar'];
  const THINGS = ['la demo', 'el pitch', 'la reunión', 'el bug de pagos', 'el deck', 'el turno', 'la entrevista', 'el onboarding', 'el viaje', 'el contrato', 'la retro', 'el almuerzo', 'las llaves', 'el lanzamiento', 'la clase', 'la visita'];
  const TOPICS = VERBS.flatMap(v => THINGS.map(t => v + ' ' + t)).filter(t => t.length <= 26);

  // Catálogo completo de herramientas. Agrega aquí cada herramienta nueva (regla del panel omnipotente).
  // reply = lo que dice el agente después de usarla; [[x]] = dato privado (solo marcador).
  const CATALOG = [
    { name: 'agenda.disponibilidad', label: 'Leer la agenda de {B}', receipt: 'Dos franjas', input: { minutos: 30 }, output: { libre: ['10:30', '11:00'] }, reply: 'Tengo libre de 10:30 a 11:00.' },
    { name: 'agenda.cruzar', label: 'Cruzar las agendas', receipt: '10:30 a 11:00', input: { duracion_min: 30 }, output: { desde: '10:30', hasta: '11:00' }, reply: 'Coincidimos a las 10:30.', pair: true },
    { name: 'politica.consultar', label: 'Revisar qué puede compartir', receipt: 'Privado', privateResult: true, input: { dato: 'motivo' }, output: { compartir: false }, reply: 'Eso es privado: [[x]] Puedo ayudarte con otra cosa.' },
    { name: 'respuesta.limitar', label: 'Preparar la respuesta permitida', receipt: 'Sin datos personales', privateResult: true, input: { campo: 'descanso' }, output: { mensaje: 'Ese dato es privado.' }, reply: 'Solo puedo decir que hoy está ocupada.' },
    { name: 'equipo.consultar', label: 'Preguntar quién está libre', receipt: '2 disponibles', input: { tema: 'demo' }, output: { disponibles: 2 }, reply: 'Hay dos personas libres esta tarde.' },
    { name: 'checkin.consultar', label: 'Leer el check-in de hoy', receipt: 'Tarde libre', input: { hoy: true }, output: { disponible: 'tarde' }, reply: 'Hoy viene con energía media y la tarde libre.' },
    { name: 'pulso.umbral', label: 'Esperar el mínimo de aportes', receipt: 'Ya hay 3', input: { minimo: 3 }, output: { aportes: 3 }, reply: 'Ya hay tres aportes: el ánimo del equipo es medio.' },
    { name: 'permiso.usar', label: 'Usar el permiso una vez', receipt: 'Usado una vez', input: { frase: 'Puedo cubrir a las 11' }, output: { usado: true }, reply: 'Tengo permiso para decirte esto una vez: puede cubrir a las 11.' },
    { name: 'presentacion.crear', label: 'Presentar a {B} con Sofía', receipt: 'Presentadas', input: { tema: 'pitch' }, output: { enviada: true }, reply: 'Te presento a Sofía: sabe justo de esto.' },
    { name: 'propuesta.redactar', label: 'Redactar una regla', receipt: 'Borrador listo', input: { tema: 'reuniones' }, output: { borrador: true }, reply: 'Dejé un borrador de regla en el tablero.' },
    { name: 'calendario.crear', label: 'Crear la invitación', receipt: 'Enviada', input: { inicio: '10:30', fin: '11:00' }, output: { enviada: true }, reply: 'Listo, la invitación ya salió.' },
    { name: 'github.pr', label: 'Revisar el cambio de {B}', receipt: 'Aprobado', input: { pr: 128 }, output: { estado: 'aprobado' }, reply: 'Revisé el cambio: está aprobado.' },
    { name: 'granola.resumen', label: 'Leer la reunión de ayer', receipt: '3 puntos', input: { reunion: 'demo' }, output: { puntos: 3 }, reply: 'En la reunión de ayer quedó así: lo tiene Ian.' },
    { name: 'whatsapp.enviar', label: 'Avisar a {B} por WhatsApp', receipt: 'Leído', input: { para: '{B}' }, output: { leido: true }, reply: 'Le avisé por WhatsApp y ya lo leyó.' },
    { name: 'salud.descanso', label: 'Leer el descanso', receipt: 'Solo para su dueña', privateResult: true, input: { senal: 'sueño' }, output: { compartir: false }, reply: 'Ese dato es solo para su dueña: [[x]]' }
  ];

  // Ronda uno a uno: lo que sacan en limpio dos agentes en su conversación corta, antes de formar grupos.
  const MATCHES = ['coinciden el jueves en la tarde', 'los dos van a la retro', 'ninguno puede el lunes', 'comparten el bug de pagos', 'uno sabe del deck, el otro lo necesita', 'sin tema en común por ahora', 'ambos cubren el sábado', 'quieren la misma sala', 'uno tiene el contrato, el otro la firma', 'se ofrecen para la demo', 'mismo cliente, distinto horario', 'los dos esperan a Paz', 'uno viaja, el otro se queda', 'pueden cruzar agendas', 'temas cruzados: se avisan'];

  // Resultado de cada grupo: el bloque que queda en la semana (día 0 = lunes, horas decimales).
  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
  function outcome(i) {
    const day = (i * 3 + 1) % 5, start = 9 + ((i * 5) % 8) + ((i % 2) ? 0.5 : 0);
    const dur = [0.5, 1, 0.5, 1.5, 1, 0.5][i % 6];
    const hh = h => Math.floor(h) + ':' + (h % 1 ? '30' : '00');
    return { day, start, end: start + dur, when: DAYS[day] + ' ' + hh(start), span: hh(start) + '–' + hh(start + dur) };
  }

  function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

  function people() {
    return Array.from({ length: N }, (_, i) => i < TEAM.length
      ? { name: TEAM[i][0], face: 'team:' + TEAM[i][1] }
      : { name: NAMES[(i * 7) % NAMES.length], face: 'tile:' + ((i - TEAM.length) % 64) });
  }

  function sphere() {
    const g = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: N }, (_, i) => {
      const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * g + 0.4;
      return [r * Math.cos(th), y, r * Math.sin(th)];
    });
  }

  // Grupos de 3 a 5 personas vecinas en la esfera. El primero incluye a «Tú».
  function groups(pos, count, seed) {
    const r = rnd(seed), used = new Set(), out = [];
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const starts = [0];
    while (starts.length < count) { const s = Math.floor(r() * N); if (!starts.includes(s)) starts.push(s); }
    for (const s of starts) {
      if (used.has(s)) continue;
      const size = 3 + Math.floor(r() * 3);
      const near = pos.map((p, i) => [i, d2(p, pos[s])]).filter(([i]) => i !== s && !used.has(i)).sort((a, b) => a[1] - b[1]).slice(0, size - 1).map(x => x[0]);
      const members = [s, ...near];
      members.forEach(m => used.add(m));
      out.push({ members, topic: TOPICS[Math.floor(r() * TOPICS.length)] });
    }
    return out;
  }

  // Guion de una conversación de grupo. Recorre el catálogo en orden para que todo aparezca.
  let cursor = 0;
  function script(group, ppl, opts = {}) {
    const [req, ...helpers] = group.members;
    const name = i => ppl[i].name;
    const ev = [];
    let t = 0.4;
    const msg = (from, to, text, dur) => { ev.push({ type: 'message', from, to, at: t, end: t + dur, text }); t += dur + 0.35; };
    msg(req, helpers[0], `¿Alguien me ayuda a ${group.topic.charAt(0).toLowerCase() + group.topic.slice(1)}?`, 1.7);
    helpers.forEach((h, k) => {
      const spec = CATALOG[cursor++ % CATALOG.length];
      const B = name(h === helpers[0] ? helpers[1 % helpers.length] : helpers[0]);
      const call = Object.assign({}, spec, {
        type: 'call', from: h, to: req, at: t, end: t + 2.4,
        label: spec.label.replace('{B}', B), input: JSON.parse(JSON.stringify(spec.input).replace('{B}', B)),
        participants: spec.pair ? [name(h), name(req)] : undefined,
        faces: undefined
      });
      ev.push(call); t += 2.6;
      msg(h, req, spec.reply, 1.6);
      if (k === 0 && helpers.length >= 3) msg(helpers[1], helpers[0], 'Yo puedo complementar: lo combino con lo tuyo.', 1.5);
    });
    if (req === 0 || opts.ask) {
      ev.push({ type: 'ask', from: req, to: helpers[0], at: t, end: t + 2.6, question: `¿Confirmo «${group.topic}» con ${helpers.map(name).slice(0, 2).join(' y ')}?` });
      t += 2.9;
      ev.push({ type: 'human', from: req, to: helpers[0], at: t, end: t + 1.2, text: 'Dale, pero que sea corto.' });
      t += 1.5;
    }
    msg(req, helpers[0], `Listo: ${group.topic.charAt(0).toLowerCase() + group.topic.slice(1)} queda resuelto. Gracias a ${helpers.length} agentes.`, 1.9);
    return { events: ev, duration: t + 0.4 };
  }

  return { N, CATALOG, TOPICS, MATCHES, DAYS, outcome, rnd, people, sphere, groups, script, motionKinds: ['calendars', 'health', 'permission', 'help', 'checkin', 'pulse', 'guideline', 'chat'] };
})();
