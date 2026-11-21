/* Ronda · contexto: catálogo de apps y superficie de conexión. Todo es de prueba: nada se conecta. */
(function () {
  const LIGHT = '#c6c6d2';
  const GOOGLE = 'Google';

  const APPS = [
    { id: 'health', name: 'Apple Health', cat: 'Salud', bg: '#f1f1f4', deep: LIGHT, tint: '#ff3b6b', method: 'atajo',
      how: 'Sueño, pulso y pasos.', reads: ['Horas de sueño', 'Pulso en reposo', 'Pasos y entrenamientos'], never: ['Tu historial médico'],
      first: '7 noches de sueño y tu pulso de hoy', last: 'Dormiste 5 h 40 min, una hora menos que tu promedio', ago: 360 },
    { id: 'strava', name: 'Strava', cat: 'Salud', bg: '#fc4c02', deep: '#a83200', tint: '#f0500a', method: 'cuenta', provider: 'Strava',
      how: 'Tus entrenamientos.', reads: ['Tipo, duración y distancia de cada entrenamiento'], never: ['Tu ruta ni tu ubicación'],
      first: '4 entrenamientos de esta semana', last: 'Trote de 6,2 km en 34 min', ago: 1500 },
    { id: 'oura', name: 'Oura', cat: 'Salud', bg: '#19191c', deep: '#000000', tint: '#55556a', method: 'cuenta', provider: 'Oura',
      how: 'Sueño y recuperación.', reads: ['Sueño y recuperación de cada noche', 'Pulso en reposo'], never: ['Tus notas'],
      first: '7 noches de sueño', last: 'Recuperación media, 6 h 20 min de sueño', ago: 400 },
    { id: 'whoop', name: 'WHOOP', cat: 'Salud', bg: '#000000', deep: '#000000', tint: '#4b4b58', method: 'cuenta', provider: 'WHOOP',
      how: 'Esfuerzo y recuperación.', reads: ['Esfuerzo y recuperación del día', 'Horas de sueño'], never: ['Tu diario'],
      first: 'Tu recuperación de hoy', last: 'Recuperación de hoy: 61 %', ago: 380 },
    { id: 'garmin', name: 'Garmin Connect', cat: 'Salud', bg: '#494848', deep: '#262626', tint: '#3d8fe0', method: 'cuenta', provider: 'Garmin',
      how: 'Entrenamientos y pulso.', reads: ['Entrenamientos y pasos', 'Pulso en reposo'], never: ['Tu ubicación'],
      first: '3 entrenamientos de esta semana', last: 'Bicicleta, 42 min', ago: 2200 },

    { id: 'granola', name: 'Granola', cat: 'Reuniones', bg: '#b5c44a', deep: '#7b892b', tint: '#8a9a26', method: 'llave',
      how: 'El resumen de cada reunión.', reads: ['El resumen de cada reunión', 'Quiénes participaron'], never: ['La transcripción ni el audio'],
      first: '11 reuniones de esta semana', last: 'Mentoría Platanus: enfocar el pitch en una sola idea', ago: 95 },
    { id: 'meet', name: 'Google Meet', cat: 'Reuniones', bg: '#ffffff', deep: LIGHT, tint: '#f2b600', method: 'cuenta', provider: GOOGLE,
      how: 'Cuánto te reúnes.', reads: ['Fecha y duración de tus reuniones'], never: ['Grabaciones ni chat'],
      first: '9 reuniones de esta semana', last: 'Reunión de 45 min con 4 personas', ago: 200 },
    { id: 'zoom', name: 'Zoom', cat: 'Reuniones', bg: '#0b5cff', deep: '#0036a8', tint: '#0b5cff', method: 'cuenta', provider: 'Zoom',
      how: 'Cuánto te reúnes.', reads: ['Fecha y duración de tus reuniones'], never: ['Grabaciones ni chat'],
      first: '5 reuniones de esta semana', last: 'Reunión de 30 min', ago: 1300 },

    { id: 'gmail', name: 'Gmail', cat: 'Correo y agenda', bg: '#ffffff', deep: LIGHT, tint: '#ea4335', method: 'cuenta', provider: GOOGLE,
      how: 'Asunto y remitente.', reads: ['Asunto y remitente de cada correo', 'Si lo respondiste o no'], never: ['El cuerpo del correo ni los adjuntos'],
      first: '42 correos de esta semana', last: 'Ian: ¿miramos el globo a las 11:00?', ago: 12 },
    { id: 'gcal', name: 'Google Calendar', cat: 'Correo y agenda', bg: '#ffffff', deep: LIGHT, tint: '#3f7fe8', method: 'cuenta', provider: GOOGLE,
      how: 'Tus bloques ocupados y libres.', reads: ['Tus bloques ocupados y libres', 'El título de cada reunión'], never: ['La descripción ni los invitados'],
      first: '14 reuniones de esta semana', last: 'Hoy 11:00: el globo con Ian', ago: 25 },
    { id: 'outlook', name: 'Outlook', cat: 'Correo y agenda', bg: '#ffffff', deep: LIGHT, tint: '#1f8fe5', method: 'cuenta', provider: 'Microsoft',
      how: 'Correo y agenda.', reads: ['Asunto y remitente de cada correo', 'Tus bloques ocupados'], never: ['El cuerpo del correo'],
      first: '18 correos de esta semana', last: 'Factura de noviembre', ago: 600 },

    { id: 'whatsapp', name: 'WhatsApp', cat: 'Mensajes', bg: '#00dc42', deep: '#0b9836', tint: '#17b548', method: 'qr',
      how: 'De qué se habló, sin los mensajes.', reads: ['De qué se habló en tus grupos', 'Cuánto tardas en responder'], never: ['El texto de tus mensajes', 'Tus chats privados'],
      first: '6 grupos y 86 respuestas de esta semana', last: 'Grupo del equipo: Robert confirma la grabación', ago: 8 },
    { id: 'slack', name: 'Slack', cat: 'Mensajes', bg: '#f1f1f4', deep: LIGHT, tint: '#611f69', method: 'cuenta', provider: 'Slack',
      how: 'Menciones y tiempos de respuesta.', reads: ['Canales donde te mencionan', 'Cuánto tardas en responder'], never: ['Tus mensajes directos'],
      first: '23 menciones de esta semana', last: 'Te mencionaron en #producto', ago: 70 },
    { id: 'telegram', name: 'Telegram', cat: 'Mensajes', bg: '#f1f1f4', deep: LIGHT, tint: '#27a6e5', method: 'qr',
      how: 'De qué se habló en tus grupos.', reads: ['De qué se habló en tus grupos'], never: ['El texto de tus mensajes'],
      first: '2 grupos de esta semana', last: 'Grupo de la hack: horario del domingo', ago: 300 },

    { id: 'github', name: 'GitHub', cat: 'Código y trabajo', bg: '#f1f1f4', deep: LIGHT, tint: '#4a4a55', method: 'cuenta', provider: 'GitHub',
      how: 'Commits, líneas y despliegues.', reads: ['Commits y líneas cambiadas', 'Pull requests y despliegues'], never: ['El contenido de tu código'],
      first: '23 commits de esta semana', last: 'main: mapa de contexto', ago: 16 },
    { id: 'linear', name: 'Linear', cat: 'Código y trabajo', bg: '#0f0f0f', deep: '#000000', tint: '#5e6ad2', method: 'cuenta', provider: 'Linear',
      how: 'Tus tareas y su estado.', reads: ['Tareas asignadas y su estado'], never: ['Comentarios'],
      first: '9 tareas abiertas', last: 'Cerraste «Atajo de Apple Health»', ago: 240 },
    { id: 'notion', name: 'Notion', cat: 'Código y trabajo', bg: '#ffffff', deep: LIGHT, tint: '#55555c', method: 'cuenta', provider: 'Notion',
      how: 'En qué documentos trabajas.', reads: ['Títulos de las páginas que editas'], never: ['El contenido de las páginas'],
      first: '6 páginas editadas esta semana', last: 'Editaste «Guion de la demo»', ago: 180 },
    { id: 'drive', name: 'Google Drive', cat: 'Código y trabajo', bg: '#ffffff', deep: LIGHT, tint: '#1fa463', method: 'cuenta', provider: GOOGLE,
      how: 'En qué archivos trabajas.', reads: ['Nombres de los archivos que editas'], never: ['El contenido de los archivos'],
      first: '4 archivos editados esta semana', last: 'Editaste «Pitch final»', ago: 500 },

    { id: 'claude', name: 'Claude', cat: 'Asistentes', bg: '#db6844', deep: '#a44a2b', tint: '#d9683f', method: 'asistente',
      how: 'Lo que hizo por ti, en una línea.', reads: ['Una línea por cada tarea que termina'], never: ['Tus conversaciones'],
      first: '12 tareas de esta semana', last: 'Armó el servidor de contexto y sus pruebas', ago: 4 },
    { id: 'codex', name: 'Codex', cat: 'Asistentes', bg: '#222222', deep: '#000000', tint: '#5b5cf0', method: 'asistente',
      how: 'Las tareas de código que terminó.', reads: ['Una línea por cada tarea que termina'], never: ['Tus conversaciones'],
      first: '9 tareas de esta semana', last: 'Agregó pruebas al tablero del equipo', ago: 30 },
    { id: 'chatgpt', name: 'ChatGPT', cat: 'Asistentes', bg: '#f1f1f4', deep: LIGHT, tint: '#4a4a55', method: 'asistente',
      how: 'Lo que hizo por ti, en una línea.', reads: ['Una línea por cada tarea que termina'], never: ['Tus conversaciones'],
      first: '3 tareas de esta semana', last: 'Resumió el reglamento de la hack', ago: 900 },
  ];

  const CONNECTED = ['health', 'granola', 'gmail', 'gcal', 'github', 'claude'];
  const CATS = ['Salud', 'Reuniones', 'Correo y agenda', 'Mensajes', 'Código y trabajo', 'Asistentes'];

  const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const find = (id) => APPS.find((app) => app.id === id);

  function ago(minutes) {
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return 'Hace ' + Math.floor(minutes) + ' min';
    if (minutes < 1440) return 'Hace ' + Math.floor(minutes / 60) + ' h';
    return 'Ayer';
  }

  function tile(app, extra) {
    return '<span class="cx-tile ' + (extra || '') + '" style="--bg:' + app.bg + ';--deep:' + app.deep + '"><img src="../sources/apps/' + app.id + '.png" alt=""></span>';
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    no: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v11H9zM5 15V4h10"/></svg>',
  };

  function pair(app, state) {
    const middle = state === 'lista'
      ? '<span class="cx-pair__ok">' + ICON.check + '</span>'
      : '<span class="cx-pair__link" aria-hidden="true"><i></i><i></i><i></i></span>';
    return '<div class="cx-pair' + (state === 'conectando' ? ' cx-pair--busy' : '') + '">' + tile(app) + middle +
      '<span class="cx-tile cx-pair__mark"><img src="../logo/ronda-mark.svg" alt=""></span></div>';
  }

  function reads(app) {
    const yes = app.reads.map((line) => '<div class="cx-reads__row"><span class="cx-reads__ico cx-reads__ico--yes">' + ICON.check + '</span><span>' + esc(line) + '</span></div>');
    const no = app.never.map((line) => '<div class="cx-reads__row cx-reads__row--no"><span class="cx-reads__ico cx-reads__ico--no">' + ICON.no + '</span><span>Nunca: ' + esc(line.charAt(0).toLowerCase() + line.slice(1)) + '</span></div>');
    return '<div class="cx-reads">' + yes.concat(no).join('') + '</div>';
  }

  function qr(seed) {
    let state = 0;
    for (const letter of seed) state = (state * 31 + letter.charCodeAt(0)) % 2147483647;
    const next = () => (state = (state * 48271 + 11) % 2147483647) / 2147483647;
    const finder = (r, c) => {
      const inBox = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
      for (const [r0, c0] of [[0, 0], [0, 14], [14, 0]]) {
        if (inBox(r0, c0)) {
          const dr = r - r0, dc = c - c0;
          const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          return ring || core ? 'on' : 'off';
        }
      }
      return null;
    };
    let cells = '';
    for (let r = 0; r < 21; r += 1) {
      for (let c = 0; c < 21; c += 1) {
        const fixed = finder(r, c);
        const on = fixed ? fixed === 'on' : next() > 0.52;
        cells += '<i' + (on ? ' class="on"' : '') + '></i>';
      }
    }
    return '<div class="cx-qr__code" role="img" aria-label="Código QR de prueba">' + cells + '</div>';
  }

  function methodBlock(app) {
    if (app.method === 'cuenta') {
      return '<button type="button" class="cx-btn cx-btn--primary cx-btn--wide" data-go="conectando">Continuar con ' + esc(app.provider) + '</button>' +
        '<p class="cx-sheet__foot">' + ICON.lock + '<span>Se abre ' + esc(app.provider) + ' para que apruebes el acceso. Lo quitas cuando quieras.</span></p>';
    }
    if (app.method === 'llave') {
      return '<div class="cx-field"><label for="cx-key">Tu llave de ' + esc(app.name) + '</label><input class="cx-input" id="cx-key" placeholder="grn_…" autocomplete="off"></div>' +
        '<button type="button" class="cx-btn cx-btn--primary cx-btn--wide" data-go="conectando">Conectar</button>' +
        '<p class="cx-sheet__foot">' + ICON.lock + '<span>La encuentras en ' + esc(app.name) + ' › Ajustes › API. Se guarda cifrada.</span></p>';
    }
    if (app.method === 'atajo') {
      return '<ol class="cx-steps">' +
        '<li><span class="cx-steps__n">1</span><span>Instala el Atajo «Ronda» en tu iPhone.</span></li>' +
        '<li><span class="cx-steps__n">2</span><span>Ábrelo una vez y permite leer Salud.</span></li>' +
        '<li><span class="cx-steps__n">3</span><span>Desde ahí se envía solo, cada mañana.</span></li></ol>' +
        '<div class="cx-code"><pre>/api/ingest/apple-health/[TU LLAVE]</pre><button type="button" class="cx-btn cx-btn--small" data-copy>' + ICON.copy + 'Copiar</button></div>' +
        '<div class="cx-sheet__actions"><button type="button" class="cx-btn">Obtener el Atajo</button><button type="button" class="cx-btn cx-btn--primary" data-go="conectando">Ya lo instalé</button></div>' +
        '<p class="cx-sheet__foot">' + ICON.lock + '<span>Esa dirección es personal. No la compartas.</span></p>';
    }
    if (app.method === 'asistente') {
      return '<div class="cx-field"><label>Pega esto en las instrucciones de ' + esc(app.name) + '</label>' +
        '<div class="cx-code"><pre>Al terminar una tarea, deja una línea en Ronda:\nPOST /api/context/[TU LLAVE]/push\n{ "source": "' + app.id + '", "summary": "qué hiciste" }</pre>' +
        '<button type="button" class="cx-btn cx-btn--small" data-copy>' + ICON.copy + 'Copiar</button></div></div>' +
        '<button type="button" class="cx-btn cx-btn--primary cx-btn--wide" data-go="conectando">Ya lo pegué</button>' +
        '<p class="cx-sheet__foot">' + ICON.lock + '<span>Esa dirección es personal. No la compartas.</span></p>';
    }
    return '<div class="cx-qr">' + qr(app.id) + '<ol class="cx-steps">' +
      '<li><span class="cx-steps__n">1</span><span>Abre ' + esc(app.name) + ' en tu teléfono.</span></li>' +
      '<li><span class="cx-steps__n">2</span><span>Ve a Dispositivos vinculados.</span></li>' +
      '<li><span class="cx-steps__n">3</span><span>Escanea este código.</span></li></ol></div>' +
      '<button type="button" class="cx-btn cx-btn--primary cx-btn--wide" data-go="conectando">Ya lo escaneé</button>' +
      '<p class="cx-sheet__foot">' + ICON.lock + '<span>El código es de prueba. No vincula nada.</span></p>';
  }

  const METHOD_NAME = { cuenta: 'Con tu cuenta', llave: 'Con una llave', atajo: 'Con un Atajo', asistente: 'Desde tu asistente', qr: 'Con un código QR' };

  function sheet(app, state) {
    const close = '<button type="button" class="cx-sheet__close" data-close aria-label="Cerrar">' + ICON.close + '</button>';
    if (state === 'conectando') {
      return close + pair(app, state) +
        '<div><h2 class="cx-sheet__title">Conectando ' + esc(app.name) + '</h2><p class="cx-sheet__lead">Trayendo tus primeros datos.</p></div>' +
        '<div class="cx-progress"><i></i></div>';
    }
    if (state === 'lista') {
      return close + pair(app, state) +
        '<div><h2 class="cx-sheet__title">' + esc(app.name) + ' conectada</h2><p class="cx-sheet__lead">Llegó: ' + esc(app.first) + '.</p></div>' +
        '<div class="cx-first">' + tile(app) + '<div class="cx-first__text">' + esc(app.last) + '<span>Ahora</span></div></div>' +
        '<div class="cx-sheet__actions"><a class="cx-btn" href="mapa.html">Ver en el mapa</a><button type="button" class="cx-btn cx-btn--primary" data-close>Listo</button></div>';
    }
    if (state === 'administrar') {
      return close + pair(app, 'lista') +
        '<div><h2 class="cx-sheet__title">' + esc(app.name) + '</h2><p class="cx-sheet__lead">Conectada. Último dato ' + ago(app.ago).toLowerCase() + '.</p></div>' +
        '<div class="cx-first">' + tile(app) + '<div class="cx-first__text">' + esc(app.last) + '<span>' + ago(app.ago) + '</span></div></div>' +
        reads(app) +
        '<div class="cx-sheet__actions"><button type="button" class="cx-btn" data-disconnect>Desconectar</button><button type="button" class="cx-btn cx-btn--primary" data-close>Listo</button></div>';
    }
    return close + pair(app, state) +
      '<div><h2 class="cx-sheet__title">Conectar ' + esc(app.name) + '</h2><p class="cx-sheet__lead">' + esc(app.how) + '</p></div>' +
      reads(app) + methodBlock(app);
  }

  window.RONDA = { APPS, CATS, CONNECTED, METHOD_NAME, find, ago, tile, sheet, esc, ICON };
})();
