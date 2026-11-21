export interface MockItem {
  summary: string;
  topics: string[];
}

export interface HubSource {
  id: string;
  label: string;
  category: string;
  how: string;
  account: (name: string) => string;
  pool: MockItem[];
  onlyWhenConnected?: boolean;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const handle = (name: string) =>
  firstName(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'persona';

export const TOPICS: Record<string, string> = {
  energia: 'Energía',
  carga: 'Carga',
  demo: 'Demo del domingo',
  pitch: 'Pitch',
  grafo: 'El globo',
  deploy: 'Despliegue',
  plazo: 'Cierre 16:00',
  codigo: 'Código',
};

export const HUB_SOURCES: HubSource[] = [
  {
    id: 'apple-health',
    label: 'Apple Health',
    category: 'Salud',
    how: 'Sueño, pulso y pasos desde tu iPhone.',
    account: (name) => `iPhone de ${firstName(name)}`,
    pool: [
      { summary: 'Dormiste 5 h 40 min, una hora menos que tu promedio', topics: ['energia'] },
      { summary: 'Pulso en reposo 61 lpm, 4 sobre tu promedio', topics: ['energia'] },
      { summary: '8.412 pasos hasta las 18:00', topics: ['energia'] },
      { summary: 'Variabilidad cardíaca baja desde el jueves', topics: ['energia', 'carga'] },
      { summary: 'Dormiste 7 h 10 min', topics: ['energia'] },
    ],
  },
  {
    id: 'granola',
    label: 'Granola',
    category: 'Reuniones',
    how: 'El resumen de cada reunión, nunca la transcripción.',
    account: () => 'Notas de Granola',
    pool: [
      { summary: 'Reunión con Ian: definir el globo de la demo', topics: ['grafo', 'demo'] },
      { summary: 'Daily de la hack: cierre el domingo a las 16:00', topics: ['demo', 'plazo'] },
      { summary: 'Mentoría Platanus: enfocar el pitch en «tú vives en O(1)»', topics: ['pitch'] },
      { summary: 'Revisión con Lian del despliegue en Render', topics: ['deploy'] },
      { summary: 'Ensayo corto del pitch con Andrés', topics: ['pitch', 'demo'] },
    ],
  },
  {
    id: 'gmail',
    label: 'Correo',
    category: 'Correo',
    how: 'Asunto y remitente. Nunca el cuerpo.',
    account: (name) => `${handle(name)}@ejemplo.cl`,
    pool: [
      { summary: 'Platanus: el pitch dura 3 minutos', topics: ['pitch', 'plazo'] },
      { summary: 'Render: despliegue listo en main', topics: ['deploy'] },
      { summary: 'Ian: ¿miramos el globo a las 11:00?', topics: ['grafo'] },
      { summary: 'Lian: te mandé el borrador del guion', topics: ['demo', 'pitch'] },
      { summary: '[Hack26] Hilo del equipo: quién graba la demo', topics: ['demo'] },
    ],
  },
  {
    id: 'claude',
    label: 'Claude',
    category: 'Asistente',
    how: 'Lo que tu asistente hizo por ti, en una línea.',
    account: () => 'Claude Code en este computador',
    pool: [
      { summary: 'Armó el servidor de contexto y sus pruebas', topics: ['codigo', 'demo'] },
      { summary: 'Revisó el globo contra la guía de diseño', topics: ['grafo'] },
      { summary: 'Redactó el guion de 3 minutos', topics: ['pitch'] },
      { summary: 'Encontró por qué fallaba el despliegue', topics: ['deploy', 'codigo'] },
      { summary: 'Te sugirió cortar el día a las 22:00', topics: ['energia', 'carga'] },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    category: 'Asistente',
    how: 'Las tareas que tu asistente de código terminó.',
    account: () => 'Codex en este computador',
    pool: [
      { summary: 'Agregó pruebas al tablero del equipo', topics: ['codigo'] },
      { summary: 'Subió las miniaturas del globo', topics: ['grafo', 'codigo'] },
      { summary: 'Corrigió el Atajo de Apple Health', topics: ['codigo', 'energia'] },
      { summary: 'Dejó el despliegue en cada commit', topics: ['deploy'] },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendario',
    category: 'Agenda',
    how: 'Tus bloques ocupados y libres.',
    account: () => 'Calendario personal',
    pool: [
      { summary: 'Hoy 11:00: el globo con Ian', topics: ['grafo'] },
      { summary: 'Mañana 10:30: ensayo de la demo', topics: ['demo'] },
      { summary: 'Domingo 16:00: cierre de la hack', topics: ['plazo'] },
      { summary: 'Bloque sin reuniones de 15:00 a 18:00', topics: ['carga'] },
      { summary: '6 reuniones hoy, 2 más que tu promedio', topics: ['carga'] },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    category: 'Mensajes',
    how: 'De qué se habló en tus grupos, sin los mensajes.',
    account: () => 'Grupo Vita y 3 más',
    pool: [
      { summary: 'Grupo Vita: Robert confirma la grabación', topics: ['demo'] },
      { summary: 'Andrés: el plan B del pitch está listo', topics: ['pitch'] },
      { summary: 'Ian: subí el globo nuevo', topics: ['grafo'] },
      { summary: 'Lian: Render quedó verde', topics: ['deploy'] },
    ],
  },
  {
    id: 'github',
    label: 'Código',
    category: 'Funciones',
    how: 'Lo que se subió y lo que se desplegó.',
    account: () => 'platanus-hack-26',
    pool: [
      { summary: 'main: hilo de vidrio interactivo', topics: ['grafo', 'codigo'] },
      { summary: 'Render desplegó la última versión de main', topics: ['deploy'] },
      { summary: 'main: tablero con votos', topics: ['codigo'] },
      { summary: 'main: servidor de contexto', topics: ['codigo', 'demo'] },
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    category: 'Asistente',
    how: 'Lo que tu asistente sabe de tu trabajo, resumido.',
    account: () => 'ChatGPT',
    pool: [{ summary: 'Resumió en qué estás trabajando esta semana', topics: ['demo'] }],
    onlyWhenConnected: true,
  },
  {
    id: 'grok',
    label: 'Grok',
    category: 'Asistente',
    how: 'Lo que tu asistente sabe de tu trabajo, resumido.',
    account: () => 'Grok',
    pool: [{ summary: 'Resumió en qué estás trabajando esta semana', topics: ['demo'] }],
    onlyWhenConnected: true,
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    category: 'Asistente',
    how: 'Lo que tu agente personal hizo por ti, en una línea.',
    account: () => 'OpenClaw',
    pool: [{ summary: 'Ordenó tus pendientes de la semana', topics: ['carga'] }],
    onlyWhenConnected: true,
  },
  {
    id: 'instinct',
    label: 'Instinct',
    category: 'Asistente',
    how: 'Lo que tu agente personal hizo por ti, en una línea.',
    account: () => 'Instinct',
    pool: [{ summary: 'Leyó tu correo y separó lo urgente', topics: ['carga'] }],
    onlyWhenConnected: true,
  },
  {
    id: 'asistente',
    label: 'Otro asistente',
    category: 'Asistente',
    how: 'Lo que tu asistente sabe de tu trabajo, resumido.',
    account: () => 'Asistente conectado',
    pool: [{ summary: 'Resumió en qué estás trabajando esta semana', topics: ['demo'] }],
    onlyWhenConnected: true,
  },
];

export const findHubSource = (id: string) => HUB_SOURCES.find((source) => source.id === id);
