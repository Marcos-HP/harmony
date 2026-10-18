// node --test tools/test/flx4.test.mjs
// Pioneer DDJ-FLX4 (js/lib/flx4.js): cada mensaje de la tabla se traduce a la acción que toca en Harmony.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(ROOT + 'js/lib/flx4.js', 'utf8'), ctx);
  return ctx.window.H.FLX4;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('reconoce la tabla por su nombre', () => {
  const F = load();
  assert.ok(F.is('DDJ-FLX4')); assert.ok(F.is('DDJ-FLX4 MIDI 1')); assert.ok(F.is('Pioneer DDJ-FLX4'));
  assert.ok(!F.is('DDJ-400')); assert.ok(!F.is(''));
});

test('botones de los decks: play, cue, shift, sync, soltar', () => {
  const F = load(), st = F.state();
  assert.deepEqual(plain(F.decode([0x90, 0x0B, 0x7F], st)), [{ t: 'play', ch: 'A' }]);
  assert.deepEqual(plain(F.decode([0x91, 0x0B, 0x7F], st)), [{ t: 'play', ch: 'B' }]);
  assert.deepEqual(plain(F.decode([0x90, 0x0B, 0x00], st)), [{ t: 'play:up', ch: 'A' }], 'nota con velocidad 0 = soltar');
  assert.deepEqual(plain(F.decode([0x80, 0x0C, 0x40], st)), [{ t: 'cue:up', ch: 'A' }]);
  assert.deepEqual(plain(F.decode([0x91, 0x0C, 0x7F], st)), [{ t: 'cue', ch: 'B' }]);
  assert.deepEqual(plain(F.decode([0x90, 0x3F, 0x7F], st)), [{ t: 'shift', ch: 'A', on: true }]);
  assert.equal(st.shift.A, true);
  assert.deepEqual(plain(F.decode([0x91, 0x58, 0x7F], st)), [{ t: 'sync', ch: 'B' }]);
  assert.deepEqual(plain(F.decode([0x90, 0x36, 0x7F], st)), [{ t: 'jog-touch', ch: 'A', on: true }]);
});

test('pads: deck, número, SHIFT y modo (la nota es la base del modo + el pad)', () => {
  const F = load(), st = F.state();
  assert.deepEqual(plain(F.decode([0x97, 0x30, 0x7F], st)), [{ t: 'pad', ch: 'A', i: 0, shift: false, on: true, mode: 0x30 }]);
  assert.deepEqual(plain(F.decode([0x99, 0x07, 0x7F], st)), [{ t: 'pad', ch: 'B', i: 7, shift: false, on: true, mode: 0x00 }], 'pad 8 del deck 2 en hot cue');
  assert.deepEqual(plain(F.decode([0x98, 0x63, 0x7F], st)), [{ t: 'pad', ch: 'A', i: 3, shift: true, on: true, mode: 0x60 }]);
  assert.equal(F.decode([0x9A, 0x75, 0x00], st)[0].on, false);
  assert.equal(st.mode.B, 0x70, 'el modo se aprende de lo que mandan los pads');
  assert.deepEqual(plain(F.decode([0x90, 0x1B, 0x7F], st)), [{ t: 'pad-mode', ch: 'A', mode: 0x00 }], 'botón HOT CUE');
  assert.deepEqual(plain(F.decode([0x91, 0x22, 0x7F], st)), [{ t: 'pad-mode', ch: 'B', mode: 0x30 }], 'botón SAMPLER');
  assert.equal(st.mode.B, 0x30);
});

test('faders y potes de 14 bits: el byte alto da el valor y el bajo lo afina', () => {
  const F = load(), st = F.state();
  // fader de canal del deck 1: 0x13 (alto) y 0x33 (bajo)
  assert.deepEqual(plain(F.decode([0xB0, 0x13, 0x7F], st)), [{ t: 'fader', ch: 'A', v: (0x7F << 7) / 16383 }]);
  assert.deepEqual(plain(F.decode([0xB0, 0x33, 0x7F], st)), [{ t: 'fader', ch: 'A', v: 1 }]);
  // EQ medios del deck 2 en el centro
  F.decode([0xB1, 0x0B, 0x40], st);
  assert.deepEqual(plain(F.decode([0xB1, 0x2B, 0x00], st)), [{ t: 'eq', ch: 'B', band: 'mid', v: 0 }]);
  // tempo del deck 1 a tope en un extremo y en el otro
  F.decode([0xB0, 0x00, 0x00], st); assert.equal(F.decode([0xB0, 0x20, 0x00], st)[0].v, -1);
  F.decode([0xB0, 0x00, 0x7F], st); assert.equal(F.decode([0xB0, 0x20, 0x7F], st)[0].v, 1);
  // crossfader y filtros (canal 7)
  F.decode([0xB6, 0x1F, 0x00], st); assert.deepEqual(plain(F.decode([0xB6, 0x3F, 0x00], st)), [{ t: 'xf', v: -1 }]);
  F.decode([0xB6, 0x18, 0x7F], st); assert.deepEqual(plain(F.decode([0xB6, 0x38, 0x7F], st)), [{ t: 'filter', ch: 'B', v: 1 }]);
  // un byte bajo sin su alto no se inventa nada
  assert.deepEqual(plain(F.decode([0xB1, 0x33, 0x10], F.state())), []);
});

test('jogs y navegador: relativos', () => {
  const F = load(), st = F.state();
  assert.deepEqual(plain(F.decode([0xB0, 0x21, 0x41], st)), [{ t: 'jog', ch: 'A', d: 1, how: 'bend' }], 'borde: +1');
  assert.deepEqual(plain(F.decode([0xB1, 0x22, 0x3C], st)), [{ t: 'jog', ch: 'B', d: -4, how: 'scratch' }], 'plato tocado: −4');
  assert.deepEqual(plain(F.decode([0xB0, 0x29, 0x46], st)), [{ t: 'jog', ch: 'A', d: 6, how: 'search' }]);
  assert.deepEqual(plain(F.decode([0xB6, 0x40, 0x01], st)), [{ t: 'browse', d: 1 }]);
  assert.deepEqual(plain(F.decode([0xB6, 0x40, 0x7F], st)), [{ t: 'browse', d: -1 }]);
  assert.deepEqual(plain(F.decode([0x96, 0x46, 0x7F], st)), [{ t: 'load', ch: 'A' }]);
  assert.deepEqual(plain(F.decode([0x96, 0x47, 0x7F], st)), [{ t: 'load', ch: 'B' }]);
  assert.deepEqual(plain(F.decode([0x96, 0x41, 0x7F], st)), [{ t: 'browse-press' }]);
});

test('luces y lo que no tiene función', () => {
  const F = load(), st = F.state();
  assert.deepEqual(plain(F.led.play('B', true)), [0x91, 0x0B, 0x7F]);
  assert.deepEqual(plain(F.led.pad('A', 0x30, 2, true)), [0x97, 0x32, 0x7F]);
  assert.deepEqual(plain(F.led.pad('B', 0x00, 7, false, true)), [0x9A, 0x07, 0]);
  assert.deepEqual(plain(F.led.vu('A', 0.5)), [0xB0, 0x02, 64]);
  assert.equal(F.decode([0x94, 0x47, 0x7F], st)[0].t, 'other', 'Beat FX: sin función todavía');
  assert.match(F.describe({ t: 'pad', ch: 'A', i: 0, shift: false, on: true, mode: 0x30 }), /Pad 1 A \(Sampler\) pulsado/);
});
