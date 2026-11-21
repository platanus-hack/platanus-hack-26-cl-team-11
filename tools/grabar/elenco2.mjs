// Elenco fijo de la demo «Diez personas, sus fuentes y sus agentes». Diez personas inventadas: qué conecta cada una,
// qué responde por ella el proveedor simulado y qué tiene que decir el producto después. Nada de esto es real:
// las cuentas son <id>@ronda.example y los repos viven en ronda-demo. Toda fecha sale una sola vez de la hora de arranque.

export const SALA = 'Equipo Quillay';
export const ZONA = 'America/Santiago';

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const HORAS_SIN_AVANCE = 96;
const ORGANIZACION = 'ronda-demo';
const UMBRAL_FIJO = 'umbral fijo por poco historial';
const ESTADO_NEUTRO = 'Sin notas de estado esta semana.';
const SIN_ENERGIA = { level: 'sin_datos', statement: 'Sin datos de energía', basis: [] };
const SIN_CARGA = { level: 'sin_datos', statement: 'Sin datos de carga', basis: [] };
const DIAS_EN_INGLES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MESES_EN_INGLES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoReloj = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const dos = (numero) => String(numero).padStart(2, '0');
const diaDe = (instante) => formatoDia.format(instante);

const relojEn = (instante) => {
  const partes = Object.fromEntries(formatoReloj.formatToParts(instante).map(({ type, value }) => [type, Number(value)]));
  return { anio: partes.year, mes: partes.month, dia: partes.day, hora: partes.hour, minuto: partes.minute, segundo: partes.second };
};

const desfaseMin = (instante) => {
  const { anio, mes, dia, hora, minuto, segundo } = relojEn(instante);
  return Math.round((Date.UTC(anio, mes - 1, dia, hora, minuto, segundo) - instante.getTime()) / MINUTO_MS);
};

const instanteEn = (dia, hora) => {
  const [anio, mes, numero] = dia.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const pared = Date.UTC(anio, mes - 1, numero, horas, minutos);
  const tanteo = pared - desfaseMin(new Date(pared)) * MINUTO_MS;
  return new Date(pared - desfaseMin(new Date(tanteo)) * MINUTO_MS);
};

const diaMas = (dia, cuantos) => {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, numero + cuantos)).toISOString().slice(0, 10);
};

const conDesfase = (instante) => {
  const { anio, mes, dia, hora, minuto, segundo } = relojEn(instante);
  const desfase = desfaseMin(instante);
  const largo = Math.abs(desfase);
  return `${anio}-${dos(mes)}-${dos(dia)}T${dos(hora)}:${dos(minuto)}:${dos(segundo)}${desfase < 0 ? '-' : '+'}${dos(Math.floor(largo / 60))}:${dos(largo % 60)}`;
};

const fechaDeCorreo = (instante) => {
  const { anio, mes, dia, hora, minuto, segundo } = relojEn(instante);
  const desfase = desfaseMin(instante);
  const largo = Math.abs(desfase);
  const semana = DIAS_EN_INGLES[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
  return `${semana}, ${dos(dia)} ${MESES_EN_INGLES[mes - 1]} ${anio} ${dos(hora)}:${dos(minuto)}:${dos(segundo)} ${desfase < 0 ? '-' : '+'}${dos(Math.floor(largo / 60))}${dos(largo % 60)}`;
};

const sinMilesimas = (instante) => instante.toISOString().replace('.000Z', 'Z');

const congelar = (valor) => {
  const pendiente = valor && typeof valor === 'object' && valor instanceof Date === false && Object.isFrozen(valor) === false;
  if (pendiente) {
    Object.freeze(valor);
    for (const interno of Object.values(valor)) congelar(interno);
  }
  return valor;
};

export const idDe = (nombre) => String(nombre).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

const cuentaDe = (id) => `${id}@ronda.example`;
const colega = (nombre, host = 'ronda.example') => ({ name: nombre, email: `${idDe(nombre).replace(/\s+/g, '.')}@${host}` });
const remitente = (nombre, host) => {
  const { name, email } = colega(nombre, host);
  return `${name} <${email}>`;
};

const archivosDe = ({ nombre, rol, trabaja, sabe }) => [
  { path: 'README.md', share: 'siempre', content: `# ${nombre}\n\n${rol}. ${trabaja}` },
  { path: 'ahora.md', share: 'siempre', content: `- ${trabaja}` },
  { path: 'sabe.md', share: 'siempre', content: sabe.map((tema) => `- ${tema}`).join('\n') },
  { path: 'estado.md', share: 'preguntar', content: ESTADO_NEUTRO },
];

const porLink = (tipo, etiqueta, datos) => ({ asistente: { tipo, puerta: 'link', etiqueta, comparte: true }, repo: { archivos: archivosDe(datos) } });
const pegando = (tipo, etiqueta, comparte, frases) => ({ asistente: { tipo, puerta: 'pegado', etiqueta, comparte }, repo: { pegado: frases.map((frase, posicion) => `${posicion + 1}. ${frase}`).join('\n') } });

const fixtureVacio = (id) => ({ correo: cuentaDe(id), github: `${id}-demo`, reuniones: [], correos: [], actividad: [], tareas: [], notas: [] });

export function construirElenco(arranque = new Date()) {
  const ARRANQUE = new Date(arranque.getTime());
  const HOY = diaDe(ARRANQUE);
  const el = (dias, hora) => instanteEn(diaMas(HOY, dias), hora);
  const antesDeArrancar = (instante, minutos) => new Date(Math.min(instante.getTime(), ARRANQUE.getTime() - minutos * MINUTO_MS));

  const reunion = (id, titulo, dias, desde, hasta, asistentes) => ({
    id,
    status: 'confirmed',
    summary: titulo,
    start: { dateTime: conDesfase(el(dias, desde)) },
    end: { dateTime: conDesfase(el(dias, hasta)) },
    attendees: asistentes.map((email, posicion) => (posicion === 0 ? { email, self: true, responseStatus: 'accepted' } : { email, responseStatus: 'accepted' })),
  });

  const correo = (id, asunto, de, instante) => ({
    id,
    threadId: `hilo-${id}`,
    labelIds: ['INBOX'],
    internalDate: String(instante.getTime()),
    payload: { headers: [{ name: 'Subject', value: asunto }, { name: 'From', value: de }, { name: 'Date', value: fechaDeCorreo(instante) }] },
  });

  const empuje = (id, repo, commits, instante) => ({ id, type: 'PushEvent', created_at: sinMilesimas(instante), repo: { name: `${ORGANIZACION}/${repo}` }, payload: { size: commits } });

  const pull = (id, repo, numero, titulo, mergeado, instante) => ({
    id,
    type: 'PullRequestEvent',
    created_at: sinMilesimas(instante),
    repo: { name: `${ORGANIZACION}/${repo}` },
    payload: { action: mergeado ? 'closed' : 'opened', pull_request: { title: titulo, html_url: `https://git.example/${ORGANIZACION}/${repo}/pull/${numero}`, merged: mergeado } },
  });

  const tarea = (identifier, titulo, estado, tipo, actualizada, creada, vence = null) => ({
    id: `tarea-${identifier.toLowerCase()}`,
    identifier,
    title: titulo,
    url: `https://tareas.example/${ORGANIZACION}/issue/${identifier}`,
    updatedAt: actualizada.toISOString(),
    createdAt: creada.toISOString(),
    dueDate: vence,
    priority: 2,
    state: { name: estado, type: tipo },
  });

  const nota = (id, titulo, duenio, dias, desde, hasta, asistentes, resumen) => ({
    id,
    title: titulo,
    owner: duenio,
    created_at: el(dias, desde).toISOString(),
    web_url: `https://notas.example/${id}`,
    attendees: [duenio, ...asistentes],
    summary_text: resumen,
    calendar_event: { scheduled_start_time: el(dias, desde).toISOString(), scheduled_end_time: el(dias, hasta).toISOString() },
  });

  const elisa = colega('Elisa Carrasco');
  const matias = colega('Matías Lagos');
  const rodrigo = colega('Rodrigo Pinto');
  const paula = colega('Paula Riquelme');
  const tomas = colega('Tomás Aravena');

  const fixtures = new Map(['antonia', 'ignacio', 'javiera', 'catalina', 'cristobal', 'felipe', 'fernanda', 'nicolas', 'martina', 'sebastian'].map((id) => [id, fixtureVacio(id)]));

  const duenia = { name: 'Antonia', email: cuentaDe('antonia') };
  Object.assign(fixtures.get('antonia'), {
    reuniones: [
      reunion('reu-antonia-1', 'Planificación del lanzamiento', 0, '09:30', '10:30', [cuentaDe('antonia'), elisa.email, matias.email]),
      reunion('reu-antonia-2', 'Revisión de prioridades con diseño', 0, '11:30', '12:30', [cuentaDe('antonia'), elisa.email]),
      reunion('reu-antonia-3', 'Comité de producto', 0, '15:00', '16:30', [cuentaDe('antonia'), elisa.email, matias.email, rodrigo.email]),
      reunion('reu-antonia-4', 'Retro del sprint', -1, '10:00', '10:45', [cuentaDe('antonia'), matias.email, rodrigo.email]),
      reunion('reu-antonia-5', 'Uno a uno con ingeniería', 1, '12:00', '12:30', [cuentaDe('antonia'), matias.email]),
    ],
    correos: [
      correo('m-antonia-1', 'Agenda del comité de producto', remitente('Elisa Carrasco'), antesDeArrancar(el(0, '08:15'), 20)),
      correo('m-antonia-2', 'Invitación: ensayo general', remitente('Matías Lagos'), el(-1, '18:05')),
      correo('m-antonia-3', 'Acta de la retro del sprint', remitente('Elisa Carrasco'), el(-1, '12:20')),
      correo('m-antonia-4', 'Fechas del lanzamiento', remitente('Matías Lagos'), el(-2, '15:30')),
      correo('m-antonia-5', 'Presupuesto de la campaña', remitente('Rodrigo Pinto'), el(-2, '09:40')),
    ],
    notas: [
      nota('not_antonia_1', 'Ensayo del pitch con ventas', duenia, 0, '17:00', '17:45', [rodrigo, elisa], 'Se revisó el orden del pitch. Falta cerrar el guion.'),
      nota('not_antonia_2', 'Entrevista con una usuaria', duenia, -1, '16:00', '16:30', [colega('Marcela Ibáñez', 'clientes.example')], 'La usuaria contó cómo coordina a su equipo cada semana.'),
    ],
  });

  Object.assign(fixtures.get('ignacio'), {
    actividad: [
      empuje('48211001', 'pagos-api', 6, el(-1, '17:40')),
      pull('48211002', 'pagos-api', 41, 'Webhook de pagos con reintentos', false, el(-2, '11:10')),
      empuje('48211003', 'pagos-api', 3, el(-3, '16:25')),
      pull('48211004', 'alertas', 12, 'Alertas del webhook', true, el(-5, '18:30')),
      empuje('48211005', 'alertas', 2, el(-5, '15:05')),
    ],
    tareas: [
      tarea('RON-212', 'Conciliación de cobros con el banco', 'En progreso', 'started', new Date(ARRANQUE.getTime() - HORAS_SIN_AVANCE * HORA_MS), el(-12, '10:00')),
      tarea('RON-230', 'Webhook de reembolsos', 'Por hacer', 'unstarted', el(-1, '11:30'), el(-3, '09:15')),
    ],
  });

  const contadora = { name: 'Catalina', email: cuentaDe('catalina') };
  Object.assign(fixtures.get('catalina'), {
    reuniones: [
      reunion('reu-catalina-1', 'Cierre contable de octubre', 0, '09:00', '10:00', [cuentaDe('catalina'), paula.email, tomas.email]),
      reunion('reu-catalina-2', 'Revisión de cobros rechazados', 0, '10:30', '11:30', [cuentaDe('catalina'), tomas.email]),
      reunion('reu-catalina-3', 'Pagos a proveedores', 0, '12:00', '13:00', [cuentaDe('catalina'), paula.email]),
      reunion('reu-catalina-4', 'Preparación de la auditoría', 0, '15:00', '16:00', [cuentaDe('catalina'), paula.email, tomas.email, rodrigo.email]),
      reunion('reu-catalina-5', 'Presupuesto 2027', 0, '16:30', '17:30', [cuentaDe('catalina'), rodrigo.email, paula.email]),
    ],
    correos: [
      correo('m-catalina-1', 'Auditoría: lista de documentos', remitente('Gabriela Soto', 'auditora.example'), antesDeArrancar(el(0, '08:05'), 25)),
      correo('m-catalina-2', 'Presupuesto 2027, versión 2', remitente('Rodrigo Pinto'), el(-1, '17:45')),
      correo('m-catalina-3', 'Cobros rechazados de la semana', remitente('Pasarela de pagos', 'pagos.example'), el(-1, '09:10')),
      correo('m-catalina-4', 'Recordatorio: cierre contable', remitente('Tomás Aravena'), el(-2, '16:20')),
      correo('m-catalina-5', 'Facturas pendientes de aprobación', remitente('Paula Riquelme'), el(-2, '10:35')),
      correo('m-catalina-6', 'Cartola del banco de octubre', remitente('Banca Empresas', 'banco.example'), el(-3, '08:50')),
    ],
    tareas: [
      tarea('FIN-88', 'Conciliación de cobros de octubre', 'Listo', 'completed', el(-6, '17:00'), el(-20, '09:30')),
      tarea('FIN-93', 'Conciliación de cobros con tarjetas', 'Por hacer', 'unstarted', el(-1, '12:15'), el(-4, '10:00'), diaMas(HOY, 3)),
      tarea('FIN-95', 'Reporte de cobros rechazados', 'Por hacer', 'unstarted', el(-2, '15:40'), el(-5, '11:20'), diaMas(HOY, 5)),
    ],
    notas: [
      nota('not_catalina_1', 'Reunión con el banco', contadora, 0, '14:00', '14:45', [colega('Verónica Sáez', 'banco.example')], 'Se revisaron los cobros de octubre con la ejecutiva del banco.'),
      nota('not_catalina_2', 'Revisión de facturas', contadora, -2, '11:00', '11:30', [tomas], 'Quedaron aprobadas las facturas de octubre.'),
    ],
  });

  Object.assign(fixtures.get('cristobal'), {
    actividad: [
      empuje('48212001', 'globo-canvas', 5, el(-1, '18:10')),
      pull('48212002', 'globo-canvas', 27, 'Animación de arcos en canvas', false, el(-1, '12:45')),
      empuje('48212003', 'globo-canvas', 2, el(-2, '16:50')),
      pull('48212004', 'globo-canvas', 23, 'Canvas: sombras de los arcos', true, el(-4, '17:15')),
    ],
  });

  Object.assign(fixtures.get('nicolas'), {
    reuniones: [reunion('reu-nicolas-1', 'Llamada con un cliente nuevo', 0, '11:00', '11:30', [cuentaDe('nicolas'), colega('Daniela Fuentes', 'clientes.example').email])],
    correos: [
      correo('m-nicolas-1', 'Seguimiento de la reunión', remitente('Daniela Fuentes', 'clientes.example'), antesDeArrancar(el(0, '08:40'), 30)),
      correo('m-nicolas-2', 'Contrato: observaciones', remitente('Ricardo Meza', 'clientes.example'), el(-1, '16:10')),
      correo('m-nicolas-3', 'Demostración del jueves', remitente('Carolina Vidal'), el(-2, '11:55')),
      correo('m-nicolas-4', 'Propuesta comercial enviada', remitente('Carolina Vidal'), el(-3, '10:20')),
    ],
  });

  const nochesDeCatalina = [
    ...[-10, -9, -8, -7, -6, -5, -4, -3].map((dias) => ({ date: diaMas(HOY, dias), sleep_hours: 7.5 })),
    { date: diaMas(HOY, -2), sleep_hours: 4.9 },
    { date: diaMas(HOY, -1), sleep_hours: 4.8 },
    { date: HOY, sleep_hours: 5 },
  ];

  const personas = [
    {
      nombre: 'Antonia',
      rol: 'Líder de producto',
      variable: 'Conecta sus fuentes de tres formas y su agente pregunta antes de contar un bloqueo.',
      ...porLink('claude-code', 'Claude Code en el MacBook', {
        nombre: 'Antonia',
        rol: 'Líder de producto',
        trabaja: 'Prepara el lanzamiento de noviembre y ordena prioridades con diseño e ingeniería.',
        sabe: ['Priorización', 'Lanzamientos', 'Investigación con usuarios'],
      }),
      salud: [{ sleep_hours: '23040,5' }],
      oauth: ['google'],
      granola: true,
      checkin: { mood: 'normal', blocker: 'guion y ensayo del pitch' },
      enRegistro: 'Antonia entra · Claude Code por link · Apple Health, Google, Granola y check-in',
      espera: {
        energy: { level: 'media', statement: 'Energía media hoy', basis: ['apple_health', 'checkin', UMBRAL_FIJO] },
        load: { level: 'alta', statement: 'Carga alta hoy', basis: ['google_calendar', 'granola'] },
        bloqueos: [{ statement: 'Bloqueo en «guion y ensayo del pitch» desde hoy', source: 'checkin', visibility: 'preguntar' }],
        temas: [],
        conexiones: { google_calendar: 5, gmail: 5, granola: 2 },
      },
    },
    {
      nombre: 'Ignacio',
      rol: 'Ingeniero backend',
      variable: 'Una tarea de Linear sin avances hace cuatro días se vuelve un pedido que nadie escribió.',
      ...porLink('codex', 'Codex', {
        nombre: 'Ignacio',
        rol: 'Ingeniero backend',
        trabaja: 'Mantiene la API de pagos: reintentos del webhook y alertas.',
        sabe: ['APIs', 'Webhooks', 'SQLite'],
      }),
      salud: [],
      oauth: ['github', 'linear'],
      granola: false,
      checkin: null,
      enRegistro: 'Ignacio entra · Codex por link · GitHub y Linear',
      espera: {
        energy: SIN_ENERGIA,
        load: { level: 'baja', statement: 'Carga baja hoy', basis: ['linear'] },
        bloqueos: [{ statement: 'Sin avances en «Conciliación de cobros con el banco» desde hace 4 días', source: 'linear', visibility: 'siempre' }],
        temas: ['pagos-api', 'alertas', 'webhook'],
        conexiones: { github: 5, linear: 2 },
      },
    },
    {
      nombre: 'Javiera',
      rol: 'Diseñadora de producto',
      variable: 'Una app de chat sin herramientas igual hace llegar su pedido a la ronda.',
      ...pegando('chatgpt', 'ChatGPT', true, [
        'Javiera es diseñadora de producto.',
        'Esta semana arma el prototipo del mapa de la sala.',
        'Necesita a alguien que sepa de animación en canvas para que los arcos del mapa se muevan sin trabarse.',
        'Sabe de diseño de interfaces y prototipos.',
      ]),
      salud: [],
      oauth: [],
      granola: false,
      checkin: null,
      enRegistro: 'Javiera entra · ChatGPT pegado y compartido · sin fuentes',
      espera: { energy: SIN_ENERGIA, load: SIN_CARGA, bloqueos: [], temas: [], conexiones: {} },
    },
    {
      nombre: 'Catalina',
      rol: 'Encargada de finanzas',
      variable: 'Tiene poca disponibilidad según cuatro fuentes: su agente no la compromete y no dice por qué.',
      ...porLink('cursor', 'Cursor', {
        nombre: 'Catalina',
        rol: 'Encargada de finanzas',
        trabaja: 'Lleva el cierre contable y la conciliación de pagos del mes.',
        sabe: ['Conciliación de pagos', 'Planillas', 'Facturación'],
      }),
      salud: nochesDeCatalina,
      oauth: ['google', 'linear'],
      granola: true,
      checkin: null,
      enRegistro: 'Catalina entra · Cursor por link · Apple Health, Google, Granola y Linear',
      espera: {
        energy: { level: 'baja', statement: 'Energía baja esta semana', basis: ['apple_health'] },
        load: { level: 'alta', statement: 'Carga alta hoy', basis: ['google_calendar', 'granola', 'linear'] },
        bloqueos: [],
        temas: ['cobros', 'conciliación'],
        conexiones: { google_calendar: 5, gmail: 6, granola: 2, linear: 3 },
      },
    },
    {
      nombre: 'Cristóbal',
      rol: 'Ingeniero frontend',
      variable: 'Tiene disponibilidad alta: mismo tema que Felipe, respuesta opuesta.',
      ...porLink('claude-code', 'Claude Code', {
        nombre: 'Cristóbal',
        rol: 'Ingeniero frontend',
        trabaja: 'Dibuja el globo de la sala en canvas.',
        sabe: ['Animación en canvas', 'React', 'Rendimiento web'],
      }),
      salud: [{ date: HOY, sleep_hours: 8 }],
      oauth: ['github'],
      granola: false,
      checkin: null,
      enRegistro: 'Cristóbal entra · Claude Code por link · Apple Health y GitHub',
      espera: {
        energy: { level: 'alta', statement: 'Energía alta hoy', basis: ['apple_health', UMBRAL_FIJO] },
        load: SIN_CARGA,
        bloqueos: [],
        temas: ['globo-canvas', 'arcos', 'canvas'],
        conexiones: { github: 4 },
      },
    },
    {
      nombre: 'Felipe',
      rol: 'Ingeniero de gráficos',
      variable: 'Tiene poca disponibilidad solo por su check-in.',
      ...porLink('openclaw', 'OpenClaw', {
        nombre: 'Felipe',
        rol: 'Ingeniero de gráficos',
        trabaja: 'Optimiza los gráficos del panel.',
        sabe: ['Animación en canvas', 'WebGL', 'Three.js'],
      }),
      salud: [],
      oauth: [],
      granola: false,
      checkin: { mood: 'cansada' },
      enRegistro: 'Felipe entra · OpenClaw por link · check-in',
      espera: { energy: { level: 'baja', statement: 'Energía baja hoy', basis: ['checkin'] }, load: SIN_CARGA, bloqueos: [], temas: [], conexiones: {} },
    },
    {
      nombre: 'Fernanda',
      rol: 'Encargada de marketing',
      variable: 'Puede ayudar a Antonia con el guion del pitch.',
      ...pegando('grok', 'Grok', true, [
        'Fernanda es encargada de marketing.',
        'Esta semana prepara la campaña de noviembre.',
        'No tiene nada trabado.',
        'Sabe de guiones y pitch, redacción y campañas.',
      ]),
      salud: [],
      oauth: [],
      granola: false,
      checkin: { mood: 'bien' },
      enRegistro: 'Fernanda entra · Grok pegado y compartido · check-in',
      espera: { energy: { level: 'alta', statement: 'Energía alta hoy', basis: ['checkin'] }, load: SIN_CARGA, bloqueos: [], temas: [], conexiones: {} },
    },
    {
      nombre: 'Nicolás',
      rol: 'Ejecutivo de ventas',
      variable: 'Tiene la agenda libre y también puede ayudar a Antonia.',
      ...pegando('claude', 'Claude', true, [
        'Nicolás es ejecutivo de ventas.',
        'Esta semana cierra dos contratos.',
        'No tiene nada trabado.',
        'Sabe de presentaciones y pitch, demostraciones a clientes y negociación.',
      ]),
      salud: [],
      oauth: ['google'],
      granola: false,
      checkin: null,
      enRegistro: 'Nicolás entra · Claude pegado y compartido · Google',
      espera: {
        energy: SIN_ENERGIA,
        load: { level: 'baja', statement: 'Carga baja hoy', basis: ['google_calendar'] },
        bloqueos: [],
        temas: [],
        conexiones: { google_calendar: 1, gmail: 4 },
      },
    },
    {
      nombre: 'Martina',
      rol: 'Analista de datos',
      variable: 'No comparte nada: su agente no cuenta nada y no gasta ninguna llamada al modelo.',
      ...pegando('gemini', 'Gemini', false, [
        'Martina es analista de datos.',
        'Mantiene los tableros de métricas.',
        'No tiene nada trabado.',
        'Sabe de SQL y tableros.',
      ]),
      salud: [],
      oauth: [],
      granola: false,
      checkin: null,
      enRegistro: 'Martina entra · Gemini pegado, sin compartir · sin fuentes',
      espera: { energy: SIN_ENERGIA, load: SIN_CARGA, bloqueos: [], temas: [], conexiones: {} },
    },
    {
      nombre: 'Sebastián',
      rol: 'Encargado de soporte',
      variable: 'Una persona puede estar en la sala sin asistente.',
      asistente: null,
      repo: null,
      salud: [],
      oauth: [],
      granola: false,
      checkin: { mood: 'normal' },
      enRegistro: 'Sebastián entra · sin agente todavía · check-in',
      espera: { energy: { level: 'media', statement: 'Energía media hoy', basis: ['checkin'] }, load: SIN_CARGA, bloqueos: [], temas: [], conexiones: {} },
    },
  ];

  const ELENCO = congelar(personas.map((persona) => ({ id: idDe(persona.nombre), ...persona })));
  for (const fixture of fixtures.values()) congelar(fixture);
  const porId = (id) => ELENCO.find((persona) => persona.id === id);
  return { ARRANQUE, HOY, ELENCO, porId, PERSONAS_DEMO: fixtures };
}

const elencoDeArranque = construirElenco();

export const ARRANQUE = elencoDeArranque.ARRANQUE;
export const HOY = elencoDeArranque.HOY;
export const ELENCO = elencoDeArranque.ELENCO;
export const porId = elencoDeArranque.porId;
export const PERSONAS_DEMO = elencoDeArranque.PERSONAS_DEMO;
