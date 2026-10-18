// node --test tools/test/banks.test.mjs
// Modelo de bancos del Soundpad (js/lib/banks.js): estructura, teclas sin conflictos y guardado tolerante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(ROOT + 'js/lib/banks.js', 'utf8'), ctx);
  return ctx.window.H.Banks;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('vaciar un banco: sin sonidos, con sus teclas, y el secuenciador sin filas', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(ROOT + 'js/lib/patterns.js', 'utf8'), ctx);
  vm.runInContext(readFileSync(ROOT + 'js/lib/banks.js', 'utf8'), ctx);
  const { Banks: B, Patterns: P } = ctx.window.H, st = B.defaultState(), b = B.current(st);
  b.pads[0].src = { type: 'harmony', sampleId: 'harmony-01/hc-kick-gabber' }; b.pads[0].name = 'Kick';
  b.pads[3].src = { type: 'harmony', sampleId: 'harmony-01/clap-room' }; b.pads[3].pitch = 4;
  P.fill(b.seq, 0, 0, 'negras'); P.fill(b.seq, 1, 3, 'dosycuatro'); b.seq.bpm = 190;
  assert.equal(B.clearBank(b), 2);
  assert.ok(b.pads.every((p) => p.src === null && p.name === '' && p.pitch === 0));
  assert.equal(b.pads.map((p) => p.key).join(''), '1234qwerasdfzxcv', 'las teclas se quedan');
  assert.ok(b.seq.patterns.every((pt) => Object.keys(pt.rows).length === 0), 'sin filas en ningún patrón');
  assert.equal(b.seq.bpm, 190, 'el tempo se queda');
  assert.equal(B.clearBank(b), 0);
});

test('estado inicial: un banco de 16 pads vacíos con las teclas 1–4, Q–R, A–F, Z–V', () => {
  const B = load(), s = B.defaultState(), b = B.current(s);
  assert.equal(s.banks.length, 1);
  assert.equal(b.pads.length, 16);
  assert.deepEqual(b.pads.map((p) => p.key).join(''), '1234qwerasdfzxcv');
  assert.ok(b.pads.every((p) => p.src === null && p.mode === 'shot'));
});

test('teclas: una tecla, un pad; las reservadas no se aceptan', () => {
  const B = load(), b = B.current(B.defaultState());
  const r = B.setKey(b, 0, 'Q');
  assert.equal(r.ok, true);
  assert.equal(r.from, 4, 'la Q era del pad 5');
  assert.equal(b.pads[0].key, 'q');
  assert.equal(b.pads[4].key, null);
  assert.equal(B.padByKey(b, 'q'), 0);
  assert.equal(B.padByKey(b, 'Q'), 0, 'mayúsculas = minúsculas');
  for (const k of [' ', 'Escape', 'Tab', 'Enter', '/', '?', 'ArrowUp', 'Backspace', 'F1', 'Shift']) assert.equal(B.setKey(b, 1, k).ok, false, k);
  assert.equal(B.setKey(b, 1, null).ok, true);
  assert.equal(b.pads[1].key, null);
  assert.equal(B.padByKey(b, '2'), -1);
  assert.equal(B.setKey(b, 1, 'ñ').ok, true, 'cualquier tecla imprimible');
});

test('bancos: añadir, duplicar, renombrar, cambiar y eliminar (siempre queda uno)', () => {
  const B = load(), s = B.defaultState();
  const a = B.current(s);
  a.pads[0].src = { type: 'file', fileId: 'f1', fileName: 'kick.wav' };
  a.pads[0].name = 'Kick';
  const b = B.add(s);
  assert.equal(b.name, 'Banco B');
  assert.equal(s.current, b.id);
  const c = B.duplicate(s, a.id);
  assert.equal(c.name, 'Banco A (copia)');
  assert.notEqual(c.id, a.id);
  assert.deepEqual(plain(c.pads[0].src), plain(a.pads[0].src));
  c.pads[0].name = 'Otro';
  assert.equal(a.pads[0].name, 'Kick', 'la copia es independiente');
  assert.equal(B.duplicate(s, a.id).name, 'Banco A (copia) 2');
  B.rename(s, b.id, '  Sesión del sábado  ');
  assert.equal(b.name, 'Sesión del sábado');
  B.rename(s, b.id, '   ');
  assert.equal(b.name, 'Sesión del sábado', 'un nombre vacío no se acepta');
  B.select(s, a.id);
  assert.equal(B.current(s).id, a.id);
  assert.ok(B.remove(s, a.id));
  assert.notEqual(s.current, a.id, 'al borrar el actual se pasa a otro');
  while (s.banks.length > 1) B.remove(s, s.banks[0].id);
  assert.equal(B.remove(s, s.banks[0].id), false);
  assert.equal(s.banks.length, 1);
});

test('archivos en uso y vaciar un pad (conserva su tecla)', () => {
  const B = load(), s = B.defaultState(), b = B.current(s);
  b.pads[2].src = { type: 'file', fileId: 'f2', fileName: 'a.wav' };
  b.pads[3].src = { type: 'catalog', trackId: 'poing' };
  const d = B.duplicate(s, b.id);
  d.pads[5].src = { type: 'file', fileId: 'f9', fileName: 'b.wav' };
  assert.deepEqual([...B.fileIds(s)].sort(), ['f2', 'f9']);
  assert.equal(B.srcKey(b.pads[2].src), 'file:f2');
  assert.equal(B.srcKey(b.pads[3].src), 'dz:poing');
  B.clearPad(b, 2);
  assert.equal(b.pads[2].src, null);
  assert.equal(b.pads[2].key, '3');
});

test('guardado tolerante: lo roto se corrige, lo válido se conserva', () => {
  const B = load();
  assert.equal(B.normalize(null).banks.length, 1);
  assert.equal(B.normalize({ banks: 'x' }).banks.length, 1);
  const s = B.normalize({
    current: 'zz', master: 7,
    banks: [
      { id: 'a', name: 'Uno', pads: [{ name: 'Kick', cat: 'kick', volume: 3, mode: 'raro', key: 'Q', src: { type: 'file', fileId: 'f1', fileName: 'k.wav' } }, { key: 'q' }, { src: { type: 'zip' } }] },
      { id: 'a', name: 'Duplicado' },
      42
    ]
  });
  assert.equal(s.banks.length, 2);
  assert.notEqual(s.banks[0].id, s.banks[1].id, 'ids repetidos se rehacen');
  assert.equal(s.current, 'a', 'actual inexistente → el primero');
  assert.equal(s.master, 1);
  const p = s.banks[0].pads;
  assert.equal(p.length, 16);
  assert.deepEqual(plain(p[0]), { id: 'p0', name: 'Kick', cat: 'kick', volume: 1, mode: 'shot', key: 'q', src: { type: 'file', fileId: 'f1', fileName: 'k.wav' }, pitch: 0, start: 0, end: 1, reverse: false, choke: 0, drive: 0, shape: 'soft', filter: 'off', cutoff: 1200, res: 20, bits: 0, echo: 0, echoDiv: 0.75, echoFb: 35 });
  assert.equal(p[1].key, null, 'tecla repetida: se queda con el primero');
  assert.equal(p[2].src, null, 'fuente desconocida → vacío');
});

test('efectos: tono, recorte, reverso y grupos de corte, siempre dentro de rango', () => {
  const B = load();
  const s = B.normalize({ banks: [{ pads: [{ pitch: 40, start: 0.5, end: 0.2, reverse: 'sí', choke: 9 }, { pitch: -3.6, start: 0.1, end: 0.6, reverse: true, choke: 2 }, { choke: 2 }, { choke: 1 }] }] });
  const [a, b, c, d] = s.banks[0].pads;
  assert.deepEqual([a.pitch, a.start, a.end, a.reverse, a.choke], [12, 0, 1, false, 4], 'recorte imposible → entero');
  assert.deepEqual([b.pitch, b.start, b.end, b.reverse, b.choke], [-4, 0.1, 0.6, true, 2]);
  assert.ok(B.hasFx(b) && !B.hasFx(s.banks[0].pads[5]));
  assert.deepEqual(plain(B.chokeMates(s.banks[0], 1)), [2], 'mismo grupo, sin él mismo');
  assert.deepEqual(plain(B.chokeMates(s.banks[0], 4)), [], 'sin grupo, no corta a nadie');
  B.setTrim(c, 0.3, 0.305);
  assert.deepEqual([c.start, c.end], [0, 1], 'menos de un 1 % no vale');
  B.setTrim(c, 0.25, 0.75);
  assert.deepEqual([c.start, c.end], [0.25, 0.75]);
  B.resetFx(b);
  assert.equal(B.hasFx(b), false);
  assert.equal(d.choke, 1);
});

test('importar bancos: ids y nombres nuevos, archivos traducidos y lo que falta, vacío', () => {
  const B = load(), s = B.defaultState();
  const ext = [{ id: s.banks[0].id, name: 'Banco A', pads: [{ name: 'K', src: { type: 'file', fileId: 'x1', fileName: 'k.wav' } }, { name: 'Perdido', src: { type: 'file', fileId: 'x2', fileName: 'p.wav' } }, { src: { type: 'catalog', trackId: 'poing' } }] }, 'basura'];
  const got = B.adopt(s, ext, { x1: 'fNEW' });
  assert.equal(got.length, 1);
  assert.equal(s.banks.length, 2);
  assert.notEqual(got[0].id, s.banks[0].id);
  assert.equal(got[0].name, 'Banco A 2');
  assert.equal(s.current, got[0].id);
  assert.deepEqual(plain(got[0].pads[0].src), { type: 'file', fileId: 'fNEW', fileName: 'k.wav' });
  assert.equal(got[0].pads[1].src, null);
  assert.equal(got[0].pads[2].src.trackId, 'poing');
});

test('efectos de sonido por pad: valores por defecto, límites y quitar', () => {
  const B = load(), st = B.defaultState(), p = B.current(st).pads[0];
  assert.equal(p.drive, 0); assert.equal(p.filter, 'off'); assert.equal(p.bits, 0); assert.equal(p.echo, 0);
  assert.equal(B.hasSoundFx(p), false);
  B.setFx(p, 'drive', 250); assert.equal(p.drive, 100);
  B.setFx(p, 'shape', 'raro'); assert.equal(p.shape, 'soft');
  B.setFx(p, 'filter', 'lp'); B.setFx(p, 'cutoff', 5); assert.equal(p.cutoff, 20);
  B.setFx(p, 'bits', 1); assert.equal(p.bits, 0, 'menos de 2 bits = sin efecto');
  B.setFx(p, 'bits', 30); assert.equal(p.bits, 12);
  B.setFx(p, 'echoDiv', 0.3); assert.equal(p.echoDiv, 0.75);
  B.setFx(p, 'echo', 40);
  assert.ok(B.hasSoundFx(p) && B.hasFx(p));
  // se guardan y vuelven igual
  const back = B.normalize(plain(st));
  assert.equal(back.banks[0].pads[0].drive, 100); assert.equal(back.banks[0].pads[0].filter, 'lp'); assert.equal(back.banks[0].pads[0].echo, 40);
  // los guardados de antes (sin estos campos) cargan sin efectos
  const old = B.normalize({ banks: [{ name: 'Viejo', pads: [{ name: 'Kick', src: { type: 'harmony', sampleId: 'x/y' }, pitch: 2 }] }] });
  assert.equal(old.banks[0].pads[0].drive, 0); assert.equal(old.banks[0].pads[0].pitch, 2);
  B.resetSoundFx(p); assert.equal(B.hasSoundFx(p), false);
});
