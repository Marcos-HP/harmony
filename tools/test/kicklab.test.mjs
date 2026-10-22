// node --test tools/test/kicklab.test.mjs
// Laboratorio de kicks: el worker, montado como lo monta el build (dsp.js y hard.js copiados de tools/samples), da un kick
// afinado en la nota pedida, sin valores raros y a −1 dBTP, tanto duro como de frenchcore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = { type: 'hard', note: 'D2', len: 300, semis: 34, drop: 130, saw: 0.3, refl: 0.35, mids: 11, res: 4, drive1: 11, drive2: 5, low: 0.45, scoop: -2, move: 'down', tok: 0.8, tick: 0.5, ott: 0.45, seed: 11, bpm: 200, at: 70, per: 3, decay: 0.6 };

async function worker() {
  const dir = mkdtempSync(join(tmpdir(), 'kick-'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(join(dir, 'dsp.js'), readFileSync(join(ROOT, 'tools/samples/dsp.mjs'), 'utf8'));
  writeFileSync(join(dir, 'hard.js'), readFileSync(join(ROOT, 'tools/samples/hard.mjs'), 'utf8').replace("from './dsp.mjs'", "from './dsp.js'"));
  writeFileSync(join(dir, 'worker.js'), readFileSync(join(ROOT, 'workers/kick/worker.js'), 'utf8'));
  const out = [];
  globalThis.self = { postMessage: (m) => out.push(m) };
  await import(join(dir, 'worker.js'));
  const run = (p) => { out.length = 0; globalThis.self.onmessage({ data: { id: 1, p } }); return out[0]; };
  return run;
}

test('kick duro, de frenchcore y en otra nota: afinados, sin NaN y a −1 dBTP', async () => {
  const run = await worker();
  for (const [p, want] of [[BASE, 'D2'], [{ ...BASE, type: 'french' }, 'D2'], [{ ...BASE, note: 'F2', move: 'up' }, 'F2'], [{ ...BASE, move: 'wobble', note: 'C2' }, 'C2']]) {
    const m = run(p);
    assert.ok(!m.error, m.error);
    assert.ok(m.L.length > 4000 && m.L.every(Number.isFinite) && m.R.every(Number.isFinite));
    const semis = Math.abs(12 * Math.log2(m.hz / (want === 'D2' ? 73.42 : want === 'F2' ? 87.31 : 65.41)));
    assert.ok(semis <= 1.05, `${p.type}/${p.note}/${p.move}: cola en ${m.note} (${m.hz.toFixed(1)} Hz), pedida en ${want}`);
    assert.ok(m.peakDb <= -0.9 && m.peakDb >= -1.2, 'pico real a −1 dBTP');
  }
  delete globalThis.self;
});

function kicksData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/data/kicks.js'), 'utf8'), ctx);
  return ctx.window.H.data.kicks;
}
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiOf = (n) => { const m = /^([A-G]#?)(-?\d)$/.exec(n); return 12 * (+m[2] + 1) + NN.indexOf(m[1]); };

test('puntos de partida de hardcore: el worker los calcula afinados (±1 semitono), sin NaN y a −1 dBTP', async () => {
  const run = await worker(), K = kicksData();
  const hc = Object.keys(K.PRESETS).filter((k) => K.PRESETS[k].group === 'hc');
  assert.ok(hc.length >= 6);
  for (const k of hc) {
    const p = K.params(k), m = run(JSON.parse(JSON.stringify(p)));
    assert.ok(!m.error, m.error);
    assert.ok(m.L.every(Number.isFinite) && m.R.every(Number.isFinite), k);
    const d = Math.abs(12 * Math.log2(m.hz / (440 * Math.pow(2, (midiOf(p.note) - 69) / 12))));
    assert.ok(d <= 1.05, `${k}: cola en ${m.note}, pedida en ${p.note}`);
    assert.ok(m.peakDb <= -0.9 && m.peakDb >= -1.2, k);
  }
  delete globalThis.self;
});

test('kicks de la biblioteca hechos con el laboratorio: el catálogo guarda sus ajustes exactos y su nota', () => {
  const K = kicksData(), ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/data/samples.js'), 'utf8'), ctx);
  const byId = new Map();
  ctx.window.H.data.samples.packs.forEach((p) => p.samples.forEach((s) => byId.set(s.id, s)));
  const ids = Object.keys(K.LIB);
  assert.ok(ids.length >= 20);
  for (const id of ids) {
    const s = byId.get(id), p = K.lib(id);
    assert.ok(s, 'no está en el catálogo: ' + id);
    assert.equal(JSON.stringify(s.lab), JSON.stringify(p), `${id}: los ajustes del catálogo no son los de js/data/kicks.js (vuelve a construir los samples)`);
    assert.equal(p.type, 'hc');
    if (s.key) assert.equal(p.note, s.key, `${id}: receta en ${p.note} y sonido anunciado en ${s.key}`);
  }
});
