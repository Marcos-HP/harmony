// node --test tools/test/sequencer.test.mjs
// Secuenciador del Soundpad: modelo de patrones (js/lib/patterns.js), su sitio en los bancos y el reloj
// (js/audio/sequencer.js) con un reloj de audio falso: cada golpe tiene que caer en su instante exacto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url).pathname;
const plain = (x) => JSON.parse(JSON.stringify(x));
function load(files, extra = {}) {
  const ctx = { window: { H: {} }, ...extra };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(readFileSync(ROOT + f, 'utf8'), ctx);
  return ctx;
}
const PT = () => load(['js/lib/patterns.js']).window.H.Patterns;
const hits = (row, len = 16) => [...row.slice(0, len)].map((c, i) => (c !== '0' ? i : -1)).filter((i) => i >= 0);

test('patrones: lo guardado se corrige sin romperse', () => {
  const P = PT();
  const s = P.normalize({ bpm: 999, swing: -4, pattern: 7, chain: [0, 9, 'x', 2], chainOn: 1, patterns: [{ len: 24, rows: { 0: '1x01', 3: '0000', 40: '1111', a: '1' } }], mute: [2, 2, 99], solo: 'no' });
  assert.equal(s.bpm, 260); assert.equal(s.swing, 0); assert.equal(s.pattern, 3);
  assert.deepEqual(plain(s.chain), [0, 2]); assert.equal(s.chainOn, false, 'solo true activa la cadena');
  assert.equal(s.patterns.length, 4); assert.equal(s.patterns[0].len, 16);
  assert.deepEqual(Object.keys(s.patterns[0].rows), ['0'], 'filas vacías, pads inexistentes y claves raras fuera');
  assert.equal(s.patterns[0].rows[0], '1001' + '0'.repeat(60), 'siempre 64 pasos; lo que no es 0/1/2 es 0');
  assert.equal(P.create().patterns[0].len, 64, 'los patrones nuevos duran 16 tiempos');
  assert.deepEqual(plain(s.mute), [2]); assert.deepEqual(plain(s.solo), []);
  assert.deepEqual(plain(P.normalize(null)), plain(P.create()));
});

test('pasos: golpe, golpe suave y vuelta a nada', () => {
  const P = PT(), s = P.create();
  assert.equal(P.toggle(s, 0, 2, 5), 1); assert.equal(P.get(s, 0, 2, 5), 1);
  assert.equal(P.toggle(s, 0, 2, 5, true), 2, 'un golpe pasa a suave');
  assert.equal(P.toggle(s, 0, 2, 5, true), 0);
  assert.equal(P.toggle(s, 0, 2, 6, true), 2);
  assert.equal(P.toggle(s, 0, 2, 6), 0, 'un clic normal quita también el suave');
  assert.deepEqual(plain(s.patterns[0].rows), {}, 'una fila sin golpes no se guarda');
});

test('rellenos: negras, contratiempo, 2 y 4, galope, mover y en 32 pasos', () => {
  const P = PT(), s = P.create();
  P.fill(s, 0, 0, 'negras'); assert.deepEqual(hits(P.row(s, 0, 0)), [0, 4, 8, 12]);
  P.fill(s, 0, 1, 'contra'); assert.deepEqual(hits(P.row(s, 0, 1)), [2, 6, 10, 14]);
  P.fill(s, 0, 2, 'dosycuatro'); assert.deepEqual(hits(P.row(s, 0, 2)), [4, 12]);
  P.fill(s, 0, 3, 'galope'); assert.deepEqual(hits(P.row(s, 0, 3)).slice(0, 6), [0, 2, 3, 4, 6, 7]);
  P.fill(s, 0, 2, 'right'); assert.deepEqual(hits(P.row(s, 0, 2)), [5, 13]);
  P.fill(s, 0, 2, 'left'); P.fill(s, 0, 2, 'left'); assert.deepEqual(hits(P.row(s, 0, 2)), [3, 11]);
  P.set(s, 0, 0, 4, 2); P.fill(s, 0, 0, 'negras'); assert.equal(P.get(s, 0, 0, 4), 2, 'rellenar respeta los golpes suaves');
  P.fill(s, 0, 0, 'clear'); assert.equal(s.patterns[0].rows[0], undefined);
  s.patterns[1].len = 32; P.fill(s, 1, 0, 'dosycuatro'); assert.deepEqual(hits(P.row(s, 1, 0), 32), [4, 12, 20, 28]);
  P.fill(s, 1, 1, 'right'); assert.equal(s.patterns[1].rows[1], undefined);
});

test('largo: 4 → 8 → 16 tiempos repite los compases; acortar guarda lo de más', () => {
  const P = PT(), s = P.create();
  s.patterns[0].len = 16;
  P.fill(s, 0, 0, 'negras'); P.set(s, 0, 1, 15, 1);
  P.setLen(s, 0, 32); assert.deepEqual(hits(P.row(s, 0, 0), 32), [0, 4, 8, 12, 16, 20, 24, 28]);
  assert.deepEqual(hits(P.row(s, 0, 1), 32), [15, 31]);
  P.set(s, 0, 1, 31, 0);
  P.setLen(s, 0, 64); assert.deepEqual(hits(P.row(s, 0, 1), 64), [15, 47], 'repite los dos compases que había');
  assert.equal(hits(P.row(s, 0, 0), 64).length, 16, '16 negras en 16 tiempos');
  P.set(s, 0, 0, 62, 2); P.setLen(s, 0, 16); assert.equal(s.patterns[0].len, 16);
  P.setLen(s, 0, 64); assert.equal(P.get(s, 0, 0, 62), 2, 'al volver a alargar, lo guardado sigue ahí');
  s.patterns[2].len = 16; P.fill(s, 2, 3, 'dosycuatro'); P.setLen(s, 2, 64);
  assert.deepEqual(hits(P.row(s, 2, 3), 64), [4, 12, 20, 28, 36, 44, 52, 60], 'de un compás a cuatro, de golpe');
  P.fill(s, 2, 4, 'redoble'); assert.ok(hits(P.row(s, 2, 4), 64).every((k) => k >= 56), 'el redoble va al final de los 16 tiempos');
  P.fill(s, 2, 3, 'redoble');
  assert.deepEqual(hits(P.row(s, 2, 3), 64), [4, 12, 20, 28, 36, 44, 52, 56, 58, 60, 61, 62, 63], 'y se suma a lo que ya había');
});

test('cadena, mute y solo, copia de patrones, base 4×4 y swing', () => {
  const P = PT(), s = P.create();
  assert.deepEqual(plain(P.parseChain('a a-b x c d e')), [0, 0, 1, 2, 3]);
  assert.equal(P.chainText([0, 0, 1, 0]), 'AABA');
  s.chain = [0, 0, 1]; s.chainOn = true;
  assert.deepEqual(plain(P.first(s)), { pattern: 0, chainPos: 0 });
  assert.deepEqual(plain(P.next(s, 1)), { pattern: 1, chainPos: 2 });
  assert.deepEqual(plain(P.next(s, 2)), { pattern: 0, chainPos: 0 }, 'la cadena da la vuelta');
  s.chainOn = false; s.pattern = 3; assert.deepEqual(plain(P.next(s, 0)), { pattern: 3, chainPos: 0 }, 'sin cadena, el patrón elegido');
  assert.equal(P.audible(s, 1), true);
  P.flag(s, 'mute', 1); assert.equal(P.audible(s, 1), false);
  P.flag(s, 'solo', 2); assert.equal(P.audible(s, 0), false); assert.equal(P.audible(s, 2), true);
  P.fill(s, 0, 5, 'negras'); P.copy(s, 0, 2); P.fill(s, 0, 5, 'clear');
  assert.deepEqual(hits(P.row(s, 2, 5)), [0, 4, 8, 12], 'la copia es independiente');
  const used = P.base(s, 1, [{ i: 3, role: 'kick' }, { i: 6, role: 'kick' }, { i: 4, role: 'clap' }, { i: 7, role: 'hat' }, { i: 8, role: 'ohat' }]);
  assert.deepEqual(plain(used), [3, 4, 7, 8], 'un pad por papel');
  assert.deepEqual(hits(P.row(s, 1, 3)), [0, 4, 8, 12]);
  assert.deepEqual(hits(P.row(s, 1, 4)), [4, 12]);
  assert.deepEqual(hits(P.row(s, 1, 8)), [2, 6, 10, 14]);
  assert.deepEqual(hits(P.row(s, 1, 7)), [0, 4, 8, 12], 'con charles abierto, el cerrado va a los tiempos');
  assert.equal(P.row(s, 1, 6), '0'.repeat(64));
  s.bpm = 150; s.swing = 100;
  assert.equal(P.swingDelay(s, 0), 0);
  assert.ok(Math.abs(P.swingDelay(s, 1) - 0.05) < 1e-12, 'swing al 100 %: medio paso (a 150 BPM, 50 ms)');
});

test('bancos: cada banco lleva su secuencia; duplicar la copia y vaciar un pad borra su fila', () => {
  const H = load(['js/lib/patterns.js', 'js/lib/banks.js']).window.H, B = H.Banks, P = H.Patterns;
  const st = B.defaultState(), b = B.current(st);
  assert.deepEqual(plain(b.seq), plain(P.create()));
  P.fill(b.seq, 0, 2, 'negras'); P.flag(b.seq, 'mute', 2);
  const d = B.duplicate(st, b.id); P.fill(d.seq, 0, 2, 'clear');
  assert.deepEqual(hits(P.row(b.seq, 0, 2)), [0, 4, 8, 12], 'la copia no comparte la secuencia');
  B.clearPad(b, 2);
  assert.equal(b.seq.patterns[0].rows[2], undefined); assert.deepEqual(plain(b.seq.mute), []);
  const again = B.normalize(plain(st));
  assert.equal(again.banks[1].seq.patterns[0].rows[2], undefined);
  const old = B.normalize({ banks: [{ name: 'Viejo', pads: [] }] });
  assert.equal(old.banks[0].seq.bpm, 170, 'los bancos guardados antes del secuenciador reciben uno vacío');
});

/* ---------- reloj, con un contexto de audio falso ---------- */
function clockRig() {
  let fn = null;
  const ctx = { currentTime: 0 }, calls = [];
  const c = load(['js/lib/patterns.js', 'js/lib/banks.js', 'js/audio/sequencer.js'], {
    window: { H: { U: { emit() {}, on() {} } } },
    setInterval: (f) => { fn = f; return 1; }, clearInterval: () => { fn = null; }, Blob: undefined, URL: undefined, Worker: undefined
  });
  const H = c.window.H;
  H.Audio = { ctx: () => ctx, ensure: () => ctx };
  H.PadAudio = { load: () => Promise.resolve(), at: (k, pad, when, o) => calls.push({ k, when, vel: o.vel, choke: o.choke }), seqStop() {} };
  const st = H.Banks.defaultState(), b = H.Banks.current(st);
  for (const i of [0, 1, 2]) b.pads[i].src = { type: 'harmony', sampleId: 'x/' + i };
  b.seq.patterns.forEach((pt) => { pt.len = 16; });   // un compás: las cuentas de abajo son por compás
  H.Seq.source(() => b);
  const run = (until) => { while (ctx.currentTime < until) { ctx.currentTime = +(ctx.currentTime + 0.025).toFixed(6); if (fn) fn(); } };
  return { H, ctx, calls, b, run };
}

test('reloj: golpes en la rejilla exacta, sin repetir ni perder ninguno', () => {
  const { H, calls, b, run } = clockRig(), P = H.Patterns;
  b.seq.bpm = 150;
  P.fill(b.seq, 0, 0, 'negras'); P.fill(b.seq, 0, 1, 'dosycuatro'); P.set(b.seq, 0, 2, 7, 2);
  H.Seq.start();
  run(3.25);   // 2 compases a 150 BPM = 3,2 s
  H.Seq.stop();
  const t0 = 0.08, sd = 60 / 150 / 4, kick = calls.filter((c) => c.k.endsWith(':0'));
  assert.equal(kick.length, 9, 'ocho negras en dos compases, y la primera del tercero ya programada');
  kick.forEach((c, n) => assert.ok(Math.abs(c.when - (t0 + n * 4 * sd)) < 1e-9, `negra ${n} fuera de sitio: ${c.when}`));
  assert.deepEqual(calls.filter((c) => c.k.endsWith(':1')).map((c) => +((c.when - t0) / sd).toFixed(6)), [4, 12, 20, 28]);
  const soft = calls.filter((c) => c.k.endsWith(':2'));
  assert.equal(soft.length, 2); assert.equal(soft[0].vel, 0.45);
  // nada se programa con más de 120 ms de antelación
  assert.ok(calls.every((c) => c.when <= 3.25 + 0.12 + 1e-9));
});

test('reloj: swing, tempo que cambia en marcha, mute y cadena de patrones', () => {
  const { H, ctx, calls, b, run } = clockRig(), P = H.Patterns;
  b.seq.bpm = 120; b.seq.swing = 50;
  P.fill(b.seq, 0, 0, 'semis');
  H.Seq.start(); run(0.5); H.Seq.stop();
  const sd = 60 / 120 / 4, w = calls.map((c) => c.when - 0.08);
  assert.ok(Math.abs(w[1] - (sd + 0.25 * sd)) < 1e-9, 'la semicorchea par se retrasa un cuarto de paso con swing 50 %');
  assert.ok(Math.abs(w[2] - 2 * sd) < 1e-9, 'la impar no se mueve');

  calls.length = 0; b.seq.swing = 0;
  P.fill(b.seq, 0, 0, 'clear'); P.fill(b.seq, 0, 0, 'negras');
  P.fill(b.seq, 1, 1, 'negras');
  P.flag(b.seq, 'mute', 2); P.fill(b.seq, 0, 2, 'semis');
  b.seq.chain = [0, 1]; b.seq.chainOn = true;
  H.Seq.start(); run(ctx.currentTime + 4.1); H.Seq.stop();   // A y B duran 2 s cada uno
  assert.equal(calls.filter((c) => c.k.endsWith(':2')).length, 0, 'un pad silenciado no suena');
  const order = calls.map((c) => c.k.slice(-1));
  assert.deepEqual(order.slice(0, 4), ['0', '0', '0', '0']);
  assert.deepEqual(order.slice(4, 8), ['1', '1', '1', '1'], 'tras el patrón A, el B');
  assert.equal(order[8], '0', 'y vuelta a A');

  calls.length = 0; b.seq.chainOn = false; b.seq.pattern = 0; b.seq.bpm = 120;
  H.Seq.start(); run(ctx.currentTime + 1); b.seq.bpm = 240; run(ctx.currentTime + 1); H.Seq.stop();
  const gaps = calls.map((c, n) => (n ? c.when - calls[n - 1].when : 0)).slice(1).map((g) => +g.toFixed(6));
  assert.ok(gaps.includes(0.5) && gaps.includes(0.25), 'el tempo nuevo entra al momento: ' + gaps.join(' '));
});

test('reloj: un patrón de 16 tiempos dura 64 pasos antes de pasar al siguiente de la cadena', () => {
  const { H, ctx, calls, b, run } = clockRig(), P = H.Patterns;
  b.seq.bpm = 240; b.seq.patterns[0].len = 64; b.seq.patterns[1].len = 16;
  P.fill(b.seq, 0, 0, 'negras'); P.fill(b.seq, 1, 1, 'negras');
  b.seq.chain = [0, 1]; b.seq.chainOn = true;
  H.Seq.start(); run(ctx.currentTime + 5.2); H.Seq.stop();   // 16 tiempos a 240 BPM = 4 s; luego 1 s de B
  const order = calls.map((c) => c.k.slice(-1));
  assert.equal(order.slice(0, 16).join(''), '0'.repeat(16));
  assert.equal(order.slice(16, 20).join(''), '1111');
});

test('reloj: grabar en directo pone el golpe en el paso más cercano', () => {
  const { H, ctx, b, run } = clockRig(), P = H.Patterns;
  b.seq.bpm = 150;
  H.Seq.start(); H.Seq.setRecording(true);
  run(0.08 + 5 * 0.1 + 0.03);   // un poco después del paso 5
  const n = H.Seq.record(1);
  assert.deepEqual(plain(n && { step: n.step, pat: n.pat }), { step: 5, pat: 0 });
  assert.equal(P.get(b.seq, 0, 1, 5), 1);
  ctx.currentTime += 0.06;      // ahora más cerca del 6
  assert.equal(H.Seq.record(1).step, 6);
  assert.equal(H.Seq.record(9), null, 'un pad vacío no se graba');
  H.Seq.stop();
  assert.equal(H.Seq.recording(), false, 'parar deja de grabar');
});
