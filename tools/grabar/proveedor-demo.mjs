// Proveedor simulado de la demo: responde, dentro del mismo proceso, las llamadas que el backend le haría a Google,
// GitHub, Linear y Granola. Nunca sale a la red. El acceso «demo-<id>» y la llave «grn_demo_<id>» son una persona inventada.

const UN_ANIO_S = 31_536_000;
const GRANOLA = 'public-api.granola.ai';
const CON_ACCESO = ['www.googleapis.com', 'gmail.googleapis.com', 'api.github.com', 'api.linear.app', GRANOLA];

const CANJES = {
  'POST oauth2.googleapis.com/token': (codigo) => ({ access_token: codigo, expires_in: UN_ANIO_S }),
  'POST github.com/login/oauth/access_token': (codigo) => ({ access_token: codigo }),
  'POST api.linear.app/oauth/token': (codigo) => ({ access_token: codigo }),
};

const UN_CORREO = /^GET gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/([^/]+)$/;
const ACTIVIDAD = /^GET api\.github\.com\/users\/([^/]+)\/events$/;
const UNA_NOTA = /^GET public-api\.granola\.ai\/v1\/notes\/([^/]+)$/;

const json = (cuerpo, estado = 200) => Response.json(cuerpo, { status: estado });
const textoDe = (cuerpo) => (typeof cuerpo === 'string' ? cuerpo : cuerpo instanceof URLSearchParams ? cuerpo.toString() : '');

const direccionDe = (entrada) => {
  try {
    return new URL(String(entrada));
  } catch {
    return null;
  }
};

const tramoDe = (hallazgo) => {
  try {
    return decodeURIComponent(hallazgo[1]);
  } catch {
    return '';
  }
};

const pedidoDe = (cuerpo) => {
  try {
    const { query } = JSON.parse(textoDe(cuerpo));
    return typeof query === 'string' ? query : '';
  } catch {
    return '';
  }
};

export function createDemoFetch(personas, { alLlamar } = {}) {
  const idDelCodigo = (cuerpo) => /^demo-(.+)$/.exec(new URLSearchParams(textoDe(cuerpo)).get('code') ?? '')?.[1] ?? '';

  const personaDe = (anfitrion, cabeceras) => {
    const portador = /^Bearer\s+(\S+)$/i.exec(new Headers(cabeceras).get('authorization') ?? '')?.[1] ?? '';
    const id = (anfitrion === GRANOLA ? /^grn_demo_(.+)$/ : /^demo-(.+)$/).exec(portador)?.[1] ?? '';
    return personas.get(id);
  };

  const responder = (ruta, persona, cuerpo) => {
    if (ruta === 'GET www.googleapis.com/oauth2/v3/userinfo') return json({ email: persona.correo });
    if (ruta === 'GET www.googleapis.com/calendar/v3/calendars/primary/events') return json({ items: persona.reuniones });
    if (ruta === 'GET gmail.googleapis.com/gmail/v1/users/me/messages') return json({ messages: persona.correos.map(({ id }) => ({ id })) });
    if (ruta === 'GET api.github.com/user') return json({ login: persona.github });
    if (ruta === 'POST api.linear.app/graphql') {
      return pedidoDe(cuerpo).includes('assignedIssues') ? json({ data: { viewer: { assignedIssues: { nodes: persona.tareas } } } }) : json({ data: { viewer: { email: persona.correo } } });
    }
    if (ruta === `GET ${GRANOLA}/v1/notes`) {
      return json({ notes: persona.notas.map(({ id, title, owner, created_at }) => ({ id, title, owner, created_at })), hasMore: false, cursor: null });
    }

    const correo = UN_CORREO.exec(ruta);
    if (correo) {
      const mensaje = persona.correos.find(({ id }) => id === tramoDe(correo));
      return mensaje ? json(mensaje) : json({}, 404);
    }
    const actividad = ACTIVIDAD.exec(ruta);
    if (actividad) return tramoDe(actividad) === persona.github ? json(persona.actividad) : json({}, 404);
    const nota = UNA_NOTA.exec(ruta);
    if (nota) {
      const guardada = persona.notas.find(({ id }) => id === tramoDe(nota));
      return guardada ? json(guardada) : json({}, 404);
    }
    return json({}, 404);
  };

  return async (entrada, init) => {
    const url = direccionDe(entrada);
    const ruta = `${String(init?.method ?? 'GET').toUpperCase()} ${url ? `${url.host}${url.pathname}` : 'sin-direccion'}`;
    alLlamar?.(ruta);
    if (!url) return json({}, 404);

    if (Object.hasOwn(CANJES, ruta)) {
      const id = idDelCodigo(init?.body);
      return personas.has(id) ? json(CANJES[ruta](`demo-${id}`)) : json({ error: 'invalid_grant' }, 400);
    }
    if (!CON_ACCESO.includes(url.host)) return json({}, 404);
    const persona = personaDe(url.host, init?.headers);
    return persona ? responder(ruta, persona, init?.body) : json({}, 401);
  };
}
