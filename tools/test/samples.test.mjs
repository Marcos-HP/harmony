// node --test tools/test/samples.test.mjs
// Biblioteca de samples originales: catálogo completo, archivos que existen y cuadran con el catálogo,
// reglas de calidad (pico real, sin recortes, final sin clic) y que la receta sigue dando el mismo audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import * as D from '../samples/dsp.mjs';
import { build, validate, loadPacks } from '../samples/build.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
function catalog() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/data/samples.js'), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.H.data.samples));
}
const CATS = ['kick', 'bajo', 'perc', 'voz', 'fx', 'loop', 'tema', 'otro'];

test('catálogo: cada sample con sus metadatos, ids estables y únicos, licencia en su pack', () => {
  const c = catalog();
  assert.ok(c.packs.length >= 1);
  const ids = new Set();
  for (const p of c.packs) {
    for (const k of ['id', 'name', 'title', 'version', 'license', 'licenseName', 'licenseUrl', 'origin']) assert.ok(p[k], `${p.id}: falta ${k}`);
    assert.equal(p.count, p.samples.length);
    assert.ok(p.samples.length >= 30 && p.samples.length <= 50, 'pack piloto de 30–50 sonidos');
    for (const s of p.samples) {
      assert.ok(!ids.has(s.id), 'id repetido ' + s.id); ids.add(s.id);
      assert.match(s.id, /^[a-z0-9-]+\/[a-z0-9-]+$/);
      for (const k of ['name', 'style', 'type', 'cat', 'file', 'notes']) assert.ok(s[k], `${s.id}: falta ${k}`);
      assert.ok(CATS.includes(s.cat), `${s.id}: categoría ${s.cat}`);
      assert.ok(Array.isArray(s.tags) && s.tags.length >= 2, `${s.id}: etiquetas`);
      assert.ok(s.duration > 0.03 && s.duration < 8, `${s.id}: duración`);
      assert.equal(s.file, `samples/${p.id}/${s.slug}.wav`);
    }
  }
  const styles = new Set(c.packs.flatMap((p) => p.samples.map((s) => s.style)));
  for (const st of ['hardcore', 'newstyle', 'uptempo']) assert.ok(styles.has(st), 'falta el estilo ' + st);
  const kicks = (st) => c.packs.flatMap((p) => p.samples).filter((s) => s.style === st && s.type === 'kick').length;
  assert.ok(kicks('hardcore') >= 4 && kicks('newstyle') >= 3 && kicks('uptempo') >= 4, 'kicks de los tres estilos');
});

test('archivos: existen, son WAV de 16 bits a 44,1 kHz, cuadran con el catálogo y pasan las reglas de calidad', () => {
  const c = catalog();
  const listed = new Set();
  for (const p of c.packs) for (const s of p.samples) {
    const abs = join(ROOT, s.file);
    assert.ok(existsSync(abs), 'falta ' + s.file);
    listed.add(s.file);
    const buf = readFileSync(abs), w = D.readWav(buf);
    assert.equal(w.rate, 44100); assert.equal(w.bits, 16);
    assert.equal(w.channels, s.channels, s.id + ' canales');
    assert.equal(buf.length, s.bytes, s.id + ' tamaño');
    assert.ok(Math.abs(w.duration - s.duration) < 0.002, s.id + ' duración');
    const a = D.analyze(w.channels === 2 ? D.stereo(w.chans[0], w.chans[1]) : w.chans[0]);
    const v = validate(s, a);
    assert.deepEqual(v.err, [], s.id + ': ' + v.err.join('; '));
  }
  // nada suelto en samples/ que no esté en el catálogo
  for (const p of c.packs) for (const f of readdirSync(join(ROOT, 'samples', p.id))) assert.ok(listed.has(`samples/${p.id}/${f}`), 'archivo sin catalogar: ' + f);
});

test('la web conoce el estilo y el tipo de cada sonido', () => {
  const ctx = { window: { H: { U: { norm: (x) => x } } } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/lib/library.js'), 'utf8'), ctx);
  const { STYLES, TYPES } = ctx.window.H.Lib;
  for (const p of catalog().packs) for (const s of p.samples) {
    assert.ok(STYLES[s.style], `${s.id}: estilo ${s.style} sin nombre en H.Lib`);
    assert.ok(TYPES[s.type], `${s.id}: tipo ${s.type} sin nombre en H.Lib`);
  }
});

test('tomas de voz: una por cada entrada de sources.mjs, ninguna suelta, y el manifiesto al día', async () => {
  const { SOURCES } = await import('../samples/voices/sources.mjs');
  const dir = join(ROOT, 'tools/samples/voices/src');
  const files = new Set(readdirSync(dir).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)));
  for (const s of SOURCES) {
    assert.ok(files.has(s.id), 'falta la toma ' + s.id);
    const w = D.readWav(readFileSync(join(dir, s.id + '.wav')));
    assert.equal(w.channels, 1); assert.ok(w.duration > 0.1, s.id + ' vacía');
  }
  assert.equal(files.size, SOURCES.length, 'tomas sin entrada en sources.mjs');
  const man = JSON.parse(readFileSync(join(ROOT, 'tools/samples/voices/manifest.json'), 'utf8'));
  assert.deepEqual(man.sources, JSON.parse(JSON.stringify(SOURCES)));
  assert.match(man.engine, /^eSpeak NG \d/);
});

test('bucles: compases exactos a su tempo, con tonalidad; los kits de un mismo tempo duran lo mismo por compás', () => {
  const loops = catalog().packs.flatMap((p) => p.samples).filter((s) => s.loop);
  assert.ok(loops.length >= 20, 'bucles melódicos');
  for (const s of loops) {
    assert.ok(s.bars && s.bpm && s.bpm[0] === s.bpm[1], s.id + ': compases y un tempo fijo');
    assert.ok(Math.abs(s.duration - (s.bars * 16 * 15) / s.bpm[0]) < 0.0015, `${s.id}: ${s.duration} s no son ${s.bars} compases a ${s.bpm[0]} BPM`);
    assert.ok(s.tonality, s.id + ': tonalidad');
  }
});

/* altura que domina en un tramo: energía por nota (Goertzel entre 98 Hz y 2 kHz) sumada por clase de nota */
function chroma(x, a, b) {
  const N = Math.min(b - a, 16384), c = new Array(12).fill(0);
  for (let m = 43; m <= 95; m++) {
    const w = 2 * Math.PI * D.hz(m) / D.SR, k = 2 * Math.cos(w); let s1 = 0, s2 = 0;
    for (let i = 0; i < N; i++) { const s0 = x[a + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))) + k * s1 - s2; s2 = s1; s1 = s0; }
    c[m % 12] += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - k * s1 * s2));
  }
  return c.indexOf(Math.max(...c));
}
test('melodías de Harmony 04: cada nota suena a la altura escrita (al menos el 80 %; lo demás, su quinta, cuarta u octava)', async () => {
  const { SCORES } = await import('../samples/packs/harmony-04.mjs');
  const S = await import('../samples/synth.mjs');
  for (const [id, [bpm, notes]] of Object.entries(SCORES)) {
    const w = D.readWav(readFileSync(join(ROOT, 'samples/harmony-04', id + '.wav')));
    const x = D.mix([w.chans[0], 0.5], [w.chans[1] || w.chans[0], 0.5]), sd = 60 / bpm / 4;
    let ok = 0;
    for (const [s, l, p] of notes) {
      const want = S.midi(p) % 12, got = chroma(x, Math.round((s * sd + 0.02) * D.SR), Math.round(((s + l) * sd - 0.01) * D.SR));
      if (got === want) ok++;
      else assert.ok([7, 5, 0].includes((got - want + 12) % 12), `${id}: paso ${s} ${p} suena a otra nota`);
    }
    assert.ok(ok / notes.length >= 0.8, `${id}: ${ok}/${notes.length} notas a su altura`);
  }
});

test('las recetas siguen dando el mismo audio (reproducible)', async () => {
  const packs = await loadPacks();
  const want = {
    'harmony-01': ['hc-kick-gabber', 'ut-kick-screech', 'clap-room', 'riser-noise'],
    'harmony-02': ['mc-hardcore', 'shout-hey', 'fx-robot', 'choir-chop-ah'],
    'harmony-03': ['ut-screech-lead', 'tk-acid', 'note-bell', 'retro-boom'],
    'harmony-04': ['mk2-bass', 'ut2-raw']
  };
  const pick = packs.flatMap((p) => (want[p.pack.id] || []).map((id) => p.pack.id + '/' + id));
  assert.equal(pick.length, 14);
  const r = await build({ only: pick, check: true, log: () => {} });
  assert.equal(r.errors, 0);
  assert.equal(r.mismatches, 0);
});

test('dsp: WAV de ida y vuelta, pico real y caída final', () => {
  const x = D.osc(0.2, 440, { amp: D.expEnv(0.05) });
  const w = D.readWav(D.wav(D.stereo(x, D.gain(x, 0.5))));
  assert.equal(w.channels, 2);
  assert.ok(Math.abs(w.chans[0][1000] - x[1000]) < 2 / 32768);
  // una sinusoide a fs/4 con fase de 45° tiene picos entre muestras: el pico real supera al de las muestras
  const s = new Float64Array(4096).map((_, i) => Math.sin(Math.PI / 2 * i + Math.PI / 4));
  assert.ok(D.truePeak(s) > 0.99 && Math.max(...s.map(Math.abs)) < 0.72);
  const f = D.fadeEnd(new Float64Array(1000).fill(1), 0.01);
  assert.equal(f[0], 1); assert.ok(f[999] < 0.001); assert.ok(f[600] > f[900]);
});
