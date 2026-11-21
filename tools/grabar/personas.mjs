// Personas inventadas para grabar el camino feliz. Cada necesidad la puede resolver otra persona de la lista.
// «ayuda» nombra a quien sabe del tema, para que esa persona también entre a la sala.

export const SALAS = ['Equipo Cóndor', 'Taller Araucaria', 'Estudio Aurora', 'Laboratorio Pudú', 'Equipo Quillay', 'Casa Lenga', 'Estudio Copihue', 'Equipo Tamarugo'];

export const ENLAZA = ['codex', 'openclaw', 'cursor'];
export const PEGA = ['chatgpt', 'grok', 'gemini', 'claude'];

export const NOMBRE_DE = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  openclaw: 'OpenClaw',
  cursor: 'Cursor',
  chatgpt: 'ChatGPT',
  grok: 'Grok',
  gemini: 'Gemini',
  claude: 'Claude',
};

export const PERSONAS = [
  {
    nombre: 'Camila',
    rol: 'Diseñadora de producto',
    trabaja: 'Diseña la pantalla de la sala y el globo para la demo del domingo.',
    necesita: { tema: 'Animación en canvas', frase: 'Necesita a alguien que sepa de animación en canvas para que los arcos del globo no salten al aparecer.' },
    ayuda: 'Benjamín',
    sabe: ['Diseño de interfaces', 'Guion y pitch', 'Investigación con usuarios'],
    estado: 'Semana intensa por el cierre del domingo. Prefiere reuniones cortas.',
  },
  {
    nombre: 'Benjamín',
    rol: 'Ingeniero frontend',
    trabaja: 'Arma la pestaña Agente y la conexión por link.',
    necesita: { tema: 'OAuth de Google', frase: 'Necesita a alguien que conozca el OAuth de Google para revisar los permisos del calendario.' },
    ayuda: 'Sofía',
    sabe: ['Animación en canvas', 'React', 'WebGL'],
    estado: 'Con buena energía esta semana.',
  },
  {
    nombre: 'Sofía',
    rol: 'Ingeniera backend',
    trabaja: 'Mantiene las integraciones de Google, GitHub y Linear.',
    necesita: { tema: 'Despliegue en Render', frase: 'Necesita ayuda con el despliegue en Render: el disco no se monta en la versión nueva.' },
    ayuda: 'Matías',
    sabe: ['OAuth de Google', 'APIs', 'SQLite'],
    estado: 'Carga alta: cuatro integraciones abiertas.',
  },
  {
    nombre: 'Matías',
    rol: 'Ingeniero de infraestructura',
    trabaja: 'Deja el despliegue automático en cada commit.',
    necesita: { tema: 'Conciliación de pagos', frase: 'Necesita a alguien que entienda la conciliación de pagos para cuadrar los cobros de octubre.' },
    ayuda: 'Valentina',
    sabe: ['Despliegue en Render', 'Integración continua', 'Docker'],
    estado: 'Durmió poco esta semana.',
  },
  {
    nombre: 'Valentina',
    rol: 'Encargada de operaciones',
    trabaja: 'Cierra las cuentas del mes y los pagos a proveedores.',
    necesita: { tema: 'Guion del pitch', frase: 'Necesita ayuda con el guion del pitch de tres minutos: no sabe con qué abrir.' },
    ayuda: 'Camila',
    sabe: ['Conciliación de pagos', 'Planillas', 'Facturación'],
    estado: 'Semana normal.',
  },
  {
    nombre: 'Joaquín',
    rol: 'Ejecutivo de ventas',
    trabaja: 'Prepara la reunión con dos clientes nuevos.',
    necesita: null,
    ayuda: null,
    sabe: ['Negociación', 'Demostraciones a clientes'],
    estado: 'Con disponibilidad en las tardes.',
  },
  {
    nombre: 'Isidora',
    rol: 'Analista de datos',
    trabaja: 'Arma el tablero de uso semanal.',
    necesita: null,
    ayuda: null,
    sabe: ['SQL', 'Métricas de uso', 'Gráficos'],
    estado: 'Semana tranquila.',
  },
  {
    nombre: 'Vicente',
    rol: 'Encargado de soporte',
    trabaja: 'Ordena los pedidos repetidos de los clientes.',
    necesita: { tema: 'Métricas de uso', frase: 'Necesita a alguien que sepa de métricas de uso para saber qué función piden más.' },
    ayuda: 'Isidora',
    sabe: ['Atención a clientes', 'Guías de ayuda'],
    estado: 'Carga media.',
  },
  {
    nombre: 'Florencia',
    rol: 'Abogada',
    trabaja: 'Revisa los términos de la pasarela de pago.',
    necesita: null,
    ayuda: null,
    sabe: ['Contratos', 'Protección de datos'],
    estado: 'Disponible desde el jueves.',
  },
  {
    nombre: 'Agustín',
    rol: 'Encargado de marketing',
    trabaja: 'Escribe la campaña de lanzamiento.',
    necesita: { tema: 'Revisión de contrato', frase: 'Necesita a alguien que sepa de contratos para revisar el acuerdo con una agencia.' },
    ayuda: 'Florencia',
    sabe: ['Redacción', 'Campañas', 'Redes sociales'],
    estado: 'Con plazo el viernes.',
  },
];

export const archivosDe = (persona) => [
  { path: 'README.md', share: 'siempre', content: `# ${persona.nombre}\n\n${persona.rol}. ${persona.trabaja}` },
  {
    path: 'ahora.md',
    share: 'siempre',
    content: [`- ${persona.trabaja}`, ...(persona.necesita ? [`- ${persona.necesita.frase}`] : [])].join('\n'),
  },
  { path: 'sabe.md', share: 'siempre', content: persona.sabe.map((tema) => `- ${tema}`).join('\n') },
  { path: 'estado.md', share: 'preguntar', content: persona.estado },
];

export const respuestaDe = (persona) =>
  [
    `1. ${persona.nombre} es ${persona.rol.toLowerCase()}.`,
    `2. Esta semana: ${persona.trabaja}`,
    `3. ${persona.necesita ? persona.necesita.frase : 'No tiene nada trabado.'}`,
    `4. Sabe de ${persona.sabe.join(', ').toLowerCase()} y puede ayudar con eso.`,
  ].join('\n');
