// Demo events are the visible messages exchanged by the agents and their public tool receipts.
const threadStories = {
  chat: {title:'Coordinar una conversación',label:'Chat',tint:'var(--rd-mini-denim)'},
  calendars: {title:'Encontrar media hora',label:'Calendario',tint:'var(--rd-mini-teal)'},
  health: {title:'Responder con privacidad',label:'Salud privada',tint:'var(--rd-mini-rust)'},
  permission: {title:'Dar permiso una vez',label:'Permiso',tint:'var(--rd-mini-ochre)'},
  help: {title:'Hacer una presentación',label:'Ayuda',tint:'var(--rd-mini-denim)'},
  checkin: {title:'Compartir disponibilidad',label:'Check-in',tint:'var(--rd-mini-ochre)'},
  pulse: {title:'Leer el pulso del equipo',label:'Pulso de equipo',tint:'var(--rd-mini-teal)'},
  guideline: {title:'Proponer una regla',label:'Propuesta',tint:'var(--rd-mini-denim)'},
  exchange: {title:'Coordinar el próximo paso',label:'Coordinación',tint:'var(--rd-muted)'}
};

function threadScript(kind,a,b,people) {
  const A=people[a].name, B=people[b].name;
  const msg=(at,end,author,text)=>({type:'message',at,end,author,tokens:text.match(/\S{1,6}\s*/gu)});
  const tool=(at,end,author,name,label,input,output,receipt)=>({type:'call',at,end,author,name,label,input,output,receipt});
  switch(kind) {
    case 'chat': return [
      msg(0,2.2,a,'¿Hoy puedes revisar la demo conmigo?'),
      tool(2.4,4.4,b,'equipo.consultar','Consultar disponibilidad',{para:B},{disponible:'hoy'},'Disponible hoy'),
      msg(4.6,7.2,b,'Sí. Hoy tengo tiempo para revisarla.'),
      msg(8,10.5,a,'Perfecto. Te comparto la demo.')
    ];
    case 'calendars': return [
      msg(0,1.7,a,'¿Tienes media hora para revisar la demo?'),
      tool(1.8,3.5,a,'agenda.disponibilidad','Leer la primera agenda',{agente:A,minutos:30},{libre:['10:00','10:30']},'Dos franjas libres'),
      tool(3.6,5.7,b,'agenda.disponibilidad','Leer la segunda agenda',{agente:B,minutos:30},{libre:['10:30','11:00']},'Dos franjas libres'),
      msg(5.8,7,b,'A las 10:00 estoy ocupado.'),
      tool(7.1,8.8,a,'agenda.cruzar','Cruzar las franjas',{duracion_min:30},{desde:'10:30',hasta:'11:00'},'Coincidencia a las 10:30'),
      msg(9,11.8,b,'Los dos estamos libres de 10:30 a 11:00. Te propongo esa media hora.')
    ];
    case 'health': return [
      msg(0,2,a,'¿Puedes compartir el registro de descanso?'),
      tool(2.4,5.1,b,'politica.consultar','Comprobar permiso',{senal:'descanso',destinatario:A},{compartir:false},'La lectura es privada'),
      tool(5.4,7.8,b,'respuesta.limitar','Preparar la respuesta permitida',{campo:'descanso'},{mensaje:'Ese dato es privado.'},'Sin datos personales'),
      {...msg(8.1,11.2,b,'Ese dato es privado. Puedo ayudarte a buscar otra hora.'),withheld:true}
    ];
    case 'permission': return [
      msg(0,2,a,'¿Puedo pasarle tu oferta de cobertura a mi dueño?'),
      {...tool(2.2,5.6,b,'permiso.solicitar','Pedir permiso a la persona',{frase:'Puedo cubrir a las 11.',destinatario:A},{autorizado:true,usos:1},'Un envío autorizado'),pending:'Esperando al dueño'},
      tool(5.8,8.6,b,'permiso.usar','Entregar la frase aprobada',{destinatario:A,usos:1},{mensaje:'Puedo cubrir a las 11.',usos_restantes:0},'Pase utilizado'),
      msg(9,11.4,a,'Recibido. Solo pasaré esa frase.')
    ];
    case 'help': return [
      msg(0,1.5,a,'Necesitamos a alguien que conozca el despliegue. ¿Hacemos la presentación?'),
      tool(1.7,3.6,a,'presentacion.aceptar','Confirmar con quien pide ayuda',{persona:A},{acepta:true},'Primera aceptación'),
      tool(3.8,6.8,b,'presentacion.aceptar','Confirmar con quien ofrece ayuda',{persona:B},{acepta:true},'Segunda aceptación'),
      tool(7,9.1,a,'presentacion.crear','Abrir la presentación',{aceptaciones:2},{estado:'presentados'},'Presentación creada'),
      msg(9.2,11.8,b,'Ya estamos en contacto. Podemos revisar juntos el despliegue.')
    ];
    case 'checkin': return [
      msg(0,2,a,'¿Tu dueño puede ayudar en la revisión de hoy?'),
      tool(2.1,5,b,'checkin.consultar','Consultar la señal compartible',{consulta:'disponibilidad'},{disponibilidad:'sí'},'Disponible para ayudar'),
      tool(5.2,7.7,b,'politica.aplicar','Limitar el alcance',{campo:'disponibilidad'},{compartir:['disponibilidad']},'Solo disponibilidad'),
      msg(8,11.4,b,'Sí, puede ayudar hoy. Su check-in personal queda privado.')
    ];
    case 'pulse': return [
      msg(0,1.8,a,'¿Hay suficientes aportes para publicar el pulso?'),
      tool(2,5.4,b,'pulso.umbral','Comprobar el mínimo',{minimo:3},{aportes:3,minimo_cumplido:true},'Tres aportes'),
      tool(5.7,8,b,'pulso.agregar','Calcular el nivel del equipo',{operacion:'mediana'},{nivel:'medio'},'Nivel mediano disponible'),
      msg(8.3,11.7,b,'El pulso del equipo es medio. El tablero muestra únicamente el nivel agregado.')
    ];
    case 'guideline': return [
      msg(0,2,a,'En dos reuniones pedimos empezar la revisión más temprano. ¿Lo proponemos?'),
      tool(2.2,5.3,b,'propuesta.redactar','Redactar el borrador',{tema:'revisión'},{texto:'Probar una revisión antes de las 11.'},'Borrador preparado'),
      tool(5.6,8.4,a,'tablero.proponer','Fijar la propuesta',{tipo:'regla de equipo'},{estado:'pendiente de revisión'},'Pendiente del equipo'),
      msg(8.7,11.6,a,'La propuesta ya está en el tablero. El equipo puede aceptarla, ajustarla o descartarla.')
    ];
    default: return [
      msg(0,2,a,'¿Revisamos el próximo paso?'),
      tool(2.3,6,b,'equipo.consultar','Consultar el estado',{asunto:'coordinación'},{estado:'listo'},'Listo para revisar'),
      msg(6.4,10,b,'Sí, tengo lo que necesitamos para revisarlo contigo.')
    ];
  }
}
