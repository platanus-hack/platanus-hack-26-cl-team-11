import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capitulos, comienzos, duraciones, reloj } from './tiempos2.mjs';

const cuadrosEn = (...instantes) => instantes.map((instante) => ({ instante }));
const cerca = (reales, esperados) => {
  assert.equal(reales.length, esperados.length);
  reales.forEach((real, posicion) => assert.ok(Math.abs(real - esperados[posicion]) < 1e-9, `cuadro ${posicion}: ${real} en vez de ${esperados[posicion]}`));
};

test('sin tramos, cada cuadro dura hasta el siguiente y el último dura lo que se pide', () => {
  cerca(duraciones(cuadrosEn(10, 10.5, 12, 12.2), []), [0.5, 1.5, 0.2, 1.5]);
  cerca(duraciones(cuadrosEn(10, 10.5), [], { ultimo: 3 }), [0.5, 3]);
  cerca(duraciones(cuadrosEn(7), []), [1.5]);
  assert.deepEqual(duraciones([], []), []);
});

test('dos cuadros con el mismo instante duran el mínimo, nunca cero', () => {
  cerca(duraciones(cuadrosEn(5, 5, 6), []), [0.01, 1, 1.5]);
});

test('«acelera» divide la duración solo dentro del tramo', () => {
  const tramos = [{ desde: 1, hasta: 3, tipo: 'acelera', valor: 6 }];
  cerca(duraciones(cuadrosEn(0, 6, 12, 18, 24), tramos), [6, 1, 1, 6, 1.5]);
});

test('«tope» corta lo que pasa del valor y deja igual lo más corto', () => {
  const tramos = [{ desde: 0, hasta: 3, tipo: 'tope', valor: 1.2 }];
  cerca(duraciones(cuadrosEn(0, 4, 4.5, 9, 14), tramos), [1.2, 0.5, 1.2, 5, 1.5]);
});

test('«omite» deja el cuadro en cero y el resto no cambia', () => {
  const tramos = [{ desde: 1, hasta: 3, tipo: 'omite' }];
  const resultado = duraciones(cuadrosEn(0, 1, 2, 3, 4), tramos);
  cerca(resultado, [1, 0, 0, 1, 1.5]);
  assert.equal(resultado.filter((duracion) => duracion === 0).length, 2);
});

test('el tramo llega hasta el cuadro «hasta» sin incluirlo, y un tramo vacío no cambia nada', () => {
  cerca(duraciones(cuadrosEn(0, 2, 4, 6), [{ desde: 0, hasta: 1, tipo: 'acelera', valor: 2 }]), [1, 2, 2, 1.5]);
  cerca(duraciones(cuadrosEn(0, 2, 4, 6), [{ desde: 2, hasta: 2, tipo: 'omite' }]), [2, 2, 2, 1.5]);
});

test('si dos tramos se pisan, manda el último de la lista', () => {
  const cuadros = cuadrosEn(0, 6, 12, 18, 24);
  const aceleraYTope = [
    { desde: 0, hasta: 4, tipo: 'acelera', valor: 6 },
    { desde: 2, hasta: 3, tipo: 'tope', valor: 1.2 },
  ];
  cerca(duraciones(cuadros, aceleraYTope), [1, 1, 1.2, 1, 1.5]);
  const topeYAcelera = [aceleraYTope[1], aceleraYTope[0]];
  cerca(duraciones(cuadros, topeYAcelera), [1, 1, 1, 1, 1.5]);
  const conOmision = [...aceleraYTope, { desde: 1, hasta: 3, tipo: 'omite' }];
  cerca(duraciones(cuadros, conOmision), [1, 0, 0, 1, 1.5]);
});

test('el último cuadro también sigue al tramo que lo cubre', () => {
  const cuadros = cuadrosEn(0, 1, 2);
  cerca(duraciones(cuadros, [{ desde: 2, hasta: 3, tipo: 'acelera', valor: 3 }]), [1, 1, 0.5]);
  cerca(duraciones(cuadros, [{ desde: 2, hasta: 3, tipo: 'tope', valor: 1.2 }], { ultimo: 4 }), [1, 1, 1.2]);
  cerca(duraciones(cuadros, [{ desde: 2, hasta: 3, tipo: 'omite' }]), [1, 1, 0]);
  cerca(duraciones(cuadros, [{ desde: 0, hasta: 2, tipo: 'omite' }], { ultimo: 2.5 }), [0, 0, 2.5]);
});

test('un tramo mal escrito se rechaza', () => {
  const cuadros = cuadrosEn(0, 1);
  assert.throws(() => duraciones(cuadros, [{ desde: 0, hasta: 1, tipo: 'pausa' }]), /desconocido/);
  assert.throws(() => duraciones(cuadros, [{ desde: 0, hasta: 1, tipo: 'acelera', valor: 0 }]), /mayor que cero/);
  assert.throws(() => duraciones(cuadros, [{ desde: 0, hasta: 1, tipo: 'tope' }]), /segundos/);
  assert.throws(() => duraciones(cuadros, [{ desde: 0.5, hasta: 1, tipo: 'omite' }]), /enteros/);
});

test('los comienzos suman las duraciones anteriores', () => {
  cerca(comienzos([1, 0, 0, 2.5, 1.5]), [0, 1, 1, 1, 3.5]);
  assert.deepEqual(comienzos([]), []);
});

test('los capítulos dan el segundo de cada paso en el video ya editado', () => {
  const pasos = [
    { numero: '1', texto: 'Uno', cuadro: 0 },
    { numero: '2', texto: 'Dos', cuadro: 2 },
    { numero: '3', texto: 'Tres', cuadro: 3 },
    { numero: '4', texto: 'Cuatro', cuadro: 9 },
  ];
  const porCuadro = duraciones(cuadrosEn(0, 1.04, 5, 6, 7), [{ desde: 1, hasta: 3, tipo: 'omite' }]);
  assert.deepEqual(capitulos(pasos, porCuadro), [
    { numero: '1', texto: 'Uno', segundo: 0 },
    { numero: '2', texto: 'Dos', segundo: 1 },
    { numero: '3', texto: 'Tres', segundo: 1 },
    { numero: '4', texto: 'Cuatro', segundo: 3.5 },
  ]);
});

test('el reloj muestra minutos y segundos reales, sin décimas', () => {
  assert.equal(reloj(0), 'Tiempo real 0:00');
  assert.equal(reloj(47.3), 'Tiempo real 0:47');
  assert.equal(reloj(59), 'Tiempo real 0:59');
  assert.equal(reloj(59.9), 'Tiempo real 0:59');
  assert.equal(reloj(75), 'Tiempo real 1:15');
  assert.equal(reloj(600), 'Tiempo real 10:00');
  assert.equal(reloj(-3), 'Tiempo real 0:00');
  assert.equal(reloj(Number.NaN), 'Tiempo real 0:00');
});
