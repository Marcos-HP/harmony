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
  assert.deepEqual(plain(p[0]), { id: 'p0', name: 'Kick', cat: 'kick', volume: 1, mode: 'shot', key: 'q', src: { type: 'file', fileId: 'f1', fileName: 'k.wav' } });
  assert.equal(p[1].key, null, 'tecla repetida: se queda con el primero');
  assert.equal(p[2].src, null, 'fuente desconocida → vacío');
});
