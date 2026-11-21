// Cuentas de tiempo de la segunda grabación: cuánto dura cada cuadro del video después de las ediciones
// declaradas (un tramo acelerado, esperas con tope y cuadros que no se muestran), y en qué segundo parte cada paso.

const MINIMO_S = 0.01;
const TIPOS = ['acelera', 'tope', 'omite'];

function revisar(tramo) {
  if (!TIPOS.includes(tramo.tipo)) throw new Error(`Tramo de tipo desconocido: ${tramo.tipo}`);
  if (!Number.isInteger(tramo.desde) || !Number.isInteger(tramo.hasta) || tramo.desde < 0) throw new Error('Un tramo va de un cuadro a otro, con números enteros.');
  if (tramo.tipo === 'acelera' && !(tramo.valor > 0)) throw new Error('Un tramo «acelera» necesita un valor mayor que cero.');
  if (tramo.tipo === 'tope' && !(tramo.valor >= 0)) throw new Error('Un tramo «tope» necesita un valor en segundos.');
}

function editar(duracion, tramo) {
  if (!tramo) return duracion;
  if (tramo.tipo === 'omite') return 0;
  return tramo.tipo === 'acelera' ? duracion / tramo.valor : Math.min(duracion, tramo.valor);
}

export function duraciones(cuadros, tramos = [], { ultimo = 1.5 } = {}) {
  tramos.forEach(revisar);
  return cuadros.map((cuadro, posicion) => {
    const siguiente = cuadros[posicion + 1];
    const real = siguiente ? Math.max(MINIMO_S, siguiente.instante - cuadro.instante) : ultimo;
    return editar(real, tramos.findLast((tramo) => posicion >= tramo.desde && posicion < tramo.hasta));
  });
}

export function comienzos(duracionesPorCuadro) {
  let largo = 0;
  return duracionesPorCuadro.map((duracion) => {
    const comienzo = largo;
    largo += duracion;
    return comienzo;
  });
}

export function capitulos(pasos, duracionesPorCuadro) {
  const partidas = comienzos(duracionesPorCuadro);
  const largo = duracionesPorCuadro.reduce((suma, duracion) => suma + duracion, 0);
  return pasos.map(({ numero, texto, cuadro }) => ({ numero, texto, segundo: Math.round((partidas[cuadro] ?? largo) * 10) / 10 }));
}

export function reloj(segundos) {
  const enteros = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `Tiempo real ${Math.floor(enteros / 60)}:${String(enteros % 60).padStart(2, '0')}`;
}
