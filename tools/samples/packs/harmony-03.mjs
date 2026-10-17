/* HARMONY 03 · Melodías y retro
   Bucles melódicos originales, notas sueltas para tocar con los pads y efectos de 8 bits hechos desde cero.
   Los bucles van por kits: las piezas de un kit comparten tonalidad y tempo, y duran compases exactos, así que se
   pueden apilar en el secuenciador (todas en el paso 1) o en pads en modo bucle y suenan juntas.
     Hardstyle    150 BPM · Fa menor  · Fam – Re♭ – La♭ – Mi♭ (4 compases)
     Hardcore     180 BPM · La menor  · Lam – Fa – Sol – Mim (4 compases)
     Uptempo      200 BPM · Do# menor · Do#m – La / Si (2 compases)
     Mákina       175 BPM · Re menor  · Rem – Si♭ – Do – La (4 compases)
     Newstyle     150 BPM · Sol# menor · Sol#m – Mi / Fa# (2 compases)
     Techno       144 BPM · Mi menor  (2 compases)
     Hard trance  140 BPM · La menor  · Lam – Fa – Do – Sol (4 compases)
   Todo es composición y síntesis de Harmony (tools/samples/synth.mjs): ni melodías ni sonidos de nadie. */
import * as D from '../dsp.mjs';
import * as S from '../synth.mjs';

export const PACK = {
  id: 'harmony-03',
  name: 'Harmony 03',
  title: 'Melodías y retro',
  version: '1.0.0',
  date: '2026-10-17',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Melodías compuestas para Harmony y sintetizadas en tools/samples/ (Harmony). Sin grabaciones, sin samples de terceros y sin melodías de nadie.',
  credits: 'Harmony'
};

/* ---------------------------------------------------------------- cierre */

const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));
const st = (x) => (x.L ? x : D.stereo(x, Float64Array.from(x)));
/* Bucle: se construye tocado dos veces (build(2) → estéreo), se limpia y se limita entero y se queda la segunda
   vuelta, que lleva dentro las colas de la primera. 1,5 ms de fundido en los bordes (sin clic al empalmar). */
function loop(bpm, bars, build) {
  const raw = build(2);
  if (!raw.L) {   // mono (bajos): mitad de tamaño
    let x = D.limit(D.dcBlock(raw), -0.7);
    x = D.normalizeTP(S.loopCut(x, bpm, bars), -1);
    return D.fades(x, 0.0015, 0.0015);
  }
  let s = D.same(raw);
  s = D.stereo(D.dcBlock(s.L), D.dcBlock(s.R));
  s = D.limitSt(s, -0.7);
  s = S.loopCut(s, bpm, bars);
  s = D.normalizeTP(s, -1);
  return D.stereo(D.fades(s.L, 0.0015, 0.0015), D.fades(s.R, 0.0015, 0.0015));
}
/* Nota suelta o golpe: como en los otros packs */
function finishSt(s, { tailDb = -66, peak = -1 } = {}) {
  s = D.same(st(s));
  const L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0008, 0.02), D.fades(R0.slice(0, n), 0.0008, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function finish(x, { tailDb = -66, peak = -1 } = {}) {
  let y = D.fades(D.trimTail(D.dcBlock(x), tailDb), 0.0008, 0.015);
  y = D.limit(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
const room = (x, size = 0.8, tail = 1.6, damp = 0.45) => D.reverb(x.L ? mono(x) : x, { size, damp, tail, pre: 0.012 });
/* mismo instrumento con otra semilla a cada lado: estéreo ancho sin desfase en el centro */
const wide = (notes, o, voice) => D.same(D.stereo(S.play(notes, { ...o, voice: voice(1) }), S.play(notes, { ...o, voice: voice(2) })));
const steps = (bars) => bars * 16;

/* ---------------------------------------------------------------- utilidades de composición */

/* arpegio en semicorcheas: para cada compás, las notas del acorde y el orden en que se recorren */
function arp(chords, order, { vel = [1, 0.75], len = 1 } = {}) {
  const out = [];
  chords.forEach((tones, b) => order.forEach((k, j) => out.push([b * 16 + j, len, tones[k % tones.length], vel[j % vel.length]])));
  return out;
}
/* el mismo ritmo con otras notas en cada compás */
const riff = (rhythm, bars) => bars.flatMap((notes, b) => rhythm.map(([s, l], k) => [b * 16 + s, l, notes[k]]));
/* golpes en unos pasos de cada compás con el acorde de ese compás */
const hits = (chords, at, len = 1, vel = 1) => chords.flatMap((c, b) => at.map((s, k) => [b * 16 + s, len, c, Array.isArray(vel) ? vel[k % vel.length] : vel]));

/* ================================================================= HARDSTYLE · 150 BPM · Fa menor */
const HS = { bpm: 150, bars: 4 };
const HS_CHORDS = [['F4', 'Ab4', 'C5'], ['F4', 'Ab4', 'Db5'], ['Eb4', 'Ab4', 'C5'], ['Eb4', 'G4', 'Bb4']];
const HS_ROOTS = ['F2', 'Db2', 'Ab1', 'Eb2'];
const HS_LEAD = [
  [0, 2, 'C5'], [2, 2, 'C5'], [4, 2, 'Ab4'], [6, 2, 'C5'], [8, 3, 'Eb5'], [11, 3, 'Db5'], [14, 2, 'C5'],
  [16, 2, 'Db5'], [18, 2, 'Db5'], [20, 2, 'F5'], [22, 2, 'Db5'], [24, 3, 'C5'], [27, 3, 'Bb4'], [30, 2, 'Ab4'],
  [32, 2, 'C5'], [34, 2, 'C5'], [36, 2, 'Eb5'], [38, 2, 'C5'], [40, 3, 'Ab5'], [43, 3, 'G5'], [46, 2, 'Eb5'],
  [48, 3, 'G5'], [51, 3, 'F5'], [54, 2, 'Eb5'], [56, 3, 'Db5'], [59, 3, 'C5'], [62, 2, 'Bb4']
];
function hsLead() {
  return loop(HS.bpm, HS.bars, (cycles) => {
    const o = { bpm: HS.bpm, steps: steps(HS.bars), cycles, gateScale: 0.92 };
    const lead = wide(HS_LEAD, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed, spread: 26, cutoff: 6500, drive: 1.6, env: { r: 0.09 } }));
    const oct = S.play(HS_LEAD, { ...o, voice: (f, g, v) => S.supersaw(f * 2, g, v, { seed: 3, n: 3, spread: 12, cutoff: 9000, env: { r: 0.06 } }) });
    const dry = D.mixSt([lead, 1], [oct, 0.22]);
    return D.mixSt([D.applySt(dry, (c) => S.pump(c, HS.bpm, { depth: 0.35 })), 1], [room(dry, 0.82, 1.4), 0.22], [S.pingpong(mono(dry), HS.bpm, { div: 0.75, n: 3, gain: 0.18 }), 1]);
  });
}
function hsChords() {
  return loop(HS.bpm, HS.bars, (cycles) => {
    const notes = HS_CHORDS.map((c, b) => [b * 16, 16, c, 0.9]);
    const o = { bpm: HS.bpm, steps: steps(HS.bars), cycles };
    const pad = wide(notes, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 10, spread: 30, cutoff: 4200, env: { a: 0.01, s: 0.95, r: 0.08 } }));
    const pumped = D.applySt(pad, (c) => S.pump(c, HS.bpm, { depth: 0.85, rel: 0.2 }));
    return D.mixSt([pumped, 1], [room(pad, 0.85, 1.6), 0.18]);
  });
}
function hsArp() {
  return loop(HS.bpm, HS.bars, (cycles) => {
    const tones = HS_CHORDS.map((c) => [...c, S.midi(c[0]) + 12]);
    const notes = arp(tones, [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 1, 2, 3, 2]);
    const x = S.play(notes, { bpm: HS.bpm, steps: steps(HS.bars), cycles, voice: (f, g, v) => S.pluck(f, g, v, { decay: 0.16, bright: 6000 }) });
    return D.mixSt([D.widen(x, 0.3, 4), 1], [S.pingpong(x, HS.bpm, { div: 0.75, n: 4, gain: 0.3, lp: 3500 }), 1], [room(x, 0.8, 1.2), 0.15]);
  });
}
function hsRevBass() {
  return loop(HS.bpm, HS.bars, (cycles) => {
    // un bajo inverso en cada tiempo, del paso 2 al 4: crece y se corta justo antes del kick siguiente
    const notes = HS_ROOTS.flatMap((r, b) => [0, 1, 2, 3].map((q) => [b * 16 + q * 4 + 1, 3, r, 1]));
    const x = S.play(notes, { bpm: HS.bpm, steps: steps(HS.bars), cycles, tail: 0.1, voice: (f, g, v) => S.reverseBass(f, g, v) });
    return x;
  });
}

/* ================================================================= HARDCORE · 180 BPM · La menor */
const HC = { bpm: 180, bars: 4 };
const HC_RHYTHM = [[0, 2], [3, 1], [4, 2], [6, 2], [8, 2], [11, 1], [12, 2], [14, 2]];
const HC_RIFF = riff(HC_RHYTHM, [
  ['A3', 'A3', 'C4', 'A3', 'E4', 'A3', 'D4', 'C4'],
  ['F3', 'F3', 'A3', 'F3', 'C4', 'F3', 'E4', 'C4'],
  ['G3', 'G3', 'B3', 'G3', 'D4', 'G3', 'E4', 'D4'],
  ['E3', 'E3', 'G3', 'E3', 'B3', 'E3', 'D4', 'B3']
]);
const HC_CHORDS = [['A3', 'C4', 'E4'], ['A3', 'C4', 'F4'], ['B3', 'D4', 'G4'], ['B3', 'E4', 'G4']];
const HC_LEAD = [
  [0, 4, 'E5'], [4, 2, 'D5'], [6, 2, 'C5'], [8, 4, 'D5'], [12, 4, 'E5'],
  [16, 4, 'C5'], [20, 4, 'A4'], [24, 2, 'C5'], [26, 2, 'D5'], [28, 4, 'C5'],
  [32, 4, 'B4'], [36, 2, 'D5'], [38, 2, 'G5'], [40, 4, 'G5'], [44, 2, 'F5'], [46, 2, 'E5'],
  [48, 6, 'E5'], [54, 2, 'D5'], [56, 4, 'B4'], [60, 4, 'G4']
];
function hcHoover() {
  return loop(HC.bpm, HC.bars, (cycles) => {
    const o = { bpm: HC.bpm, steps: steps(HC.bars), cycles, gateScale: 0.85 };
    // la caída de tono del hoover, más corta que en el stab suelto: en una semicorchea no se puede comer la nota
    const x = wide(HC_RIFF, o, (seed) => (f, g, v) => S.hoover(f, g, v, { seed: seed + 3, bend: 1.5, bendTau: 0.015 }));
    return D.mixSt([x, 1], [room(x, 0.78, 1.0), 0.16]);
  });
}
function hcPiano() {
  return loop(HC.bpm, HC.bars, (cycles) => {
    const notes = hits(HC_CHORDS, [0, 3, 6, 8, 11, 14], 2, [1, 0.8, 0.85, 0.95, 0.8, 0.85]);
    const x = S.play(notes, { bpm: HC.bpm, steps: steps(HC.bars), cycles, voice: (f, g, v) => S.piano(f, g, v, { decay: 0.9 }) });
    return D.mixSt([D.widen(x, 0.35, 6), 1], [room(x, 0.8, 1.3), 0.25]);
  });
}
function hcLead() {
  return loop(HC.bpm, HC.bars, (cycles) => {
    const o = { bpm: HC.bpm, steps: steps(HC.bars), cycles, gateScale: 0.9 };
    const x = wide(HC_LEAD, o, (seed) => (f, g, v) => D.mix([S.rawLead(f, g, v, { drive: 5 }), 0.7], [S.supersaw(f, g, v, { seed: seed + 20, n: 5, spread: 20, cutoff: 5000 }), 0.6]));
    return D.mixSt([x, 1], [room(x, 0.8, 1.2), 0.18], [S.pingpong(mono(x), HC.bpm, { div: 0.75, n: 2, gain: 0.15 }), 1]);
  });
}

/* ================================================================= UPTEMPO · 200 BPM · Do# menor */
const UT = { bpm: 200, bars: 2 };
const UT_SCREECH = [
  [0, 2, 'C#5'], [2, 2, 'E5'], [4, 2, 'G#5'], [6, 1, 'F#5'], [7, 1, 'E5'], [8, 4, 'C#5'], [12, 2, 'B4'], [14, 2, 'C#5'],
  [16, 2, 'E5'], [18, 2, 'C#5'], [20, 2, 'A4'], [22, 2, 'C#5'], [24, 2, 'D#5'], [26, 2, 'F#5'], [28, 4, 'D#5']
];
const UT_RAW = [
  [2, 1, 'C#4'], [3, 1, 'C#4'], [6, 2, 'E4'], [10, 1, 'C#4'], [11, 1, 'C#4'], [14, 2, 'G#4'],
  [18, 1, 'A3'], [19, 1, 'A3'], [22, 2, 'C#4'], [26, 1, 'B3'], [27, 1, 'B3'], [30, 2, 'D#4']
];
function utScreech() {
  return loop(UT.bpm, UT.bars, (cycles) => {
    const x = S.play(UT_SCREECH, { bpm: UT.bpm, steps: steps(UT.bars), cycles, gateScale: 0.9, voice: (f, g, v) => S.screech(f, g, v) });
    return D.mixSt([D.widen(x, 0.25, 8), 1], [room(x, 0.75, 0.9), 0.14]);
  });
}
function utRaw() {
  return loop(UT.bpm, UT.bars, (cycles) => {
    const x = S.play(UT_RAW, { bpm: UT.bpm, steps: steps(UT.bars), cycles, gateScale: 0.8, voice: (f, g, v) => S.rawLead(f, g, v, { drive: 9, center: 1100 }) });
    return D.mixSt([D.widen(x, 0.2, 9), 1], [room(x, 0.7, 0.7), 0.1]);
  });
}
function utChords() {
  return loop(UT.bpm, UT.bars, (cycles) => {
    const notes = [[0, 16, ['C#4', 'E4', 'G#4']], [16, 8, ['C#4', 'E4', 'A4']], [24, 8, ['D#4', 'F#4', 'B4']]];
    const o = { bpm: UT.bpm, steps: steps(UT.bars), cycles };
    const pad = wide(notes, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 30, spread: 28, cutoff: 6000, drive: 1.4, env: { a: 0.004, s: 1, r: 0.03 } }));
    const gated = D.applySt(pad, (c) => S.gate16(c, UT.bpm, 'x.xxx.x.xx.xx.x.', { duty: 0.6 }));
    return D.mixSt([gated, 1], [room(gated, 0.8, 1.0), 0.16]);
  });
}

/* ================================================================= MÁKINA · 175 BPM · Re menor */
const MK = { bpm: 175, bars: 4 };
const MK_LEAD = [
  [0, 3, 'A4'], [3, 3, 'D5'], [6, 2, 'F5'], [8, 3, 'E5'], [11, 3, 'D5'], [14, 2, 'A4'],
  [16, 3, 'Bb4'], [19, 3, 'D5'], [22, 2, 'F5'], [24, 3, 'F5'], [27, 3, 'E5'], [30, 2, 'D5'],
  [32, 3, 'C5'], [35, 3, 'E5'], [38, 2, 'G5'], [40, 3, 'G5'], [43, 3, 'F5'], [46, 2, 'E5'],
  [48, 3, 'C#5'], [51, 3, 'E5'], [54, 2, 'A5'], [56, 3, 'G5'], [59, 3, 'E5'], [62, 2, 'C#5']
];
const MK_TONES = [['D4', 'F4', 'A4', 'D5'], ['D4', 'F4', 'Bb4', 'D5'], ['E4', 'G4', 'C5', 'E5'], ['C#4', 'E4', 'A4', 'C#5']];
const MK_ROOTS = ['D2', 'Bb1', 'C2', 'A1'];
/* lead de mákina: cuadrada y sierras desafinadas, brillante y con la octava de abajo */
const mkVoice = (seed) => (f, g, v) => {
  const L = g + 0.08, e = S.adsr(g, { a: 0.003, d: 0.12, s: 0.75, r: 0.07 }), r = D.rng(seed);
  const x = D.mix([D.osc(L, f, { shape: 'pulse', pw: 0.4, phase: r() }), 0.4, 0, 0.001], [D.osc(L, f * 1.007, { shape: 'saw', phase: r() }), 0.3, 0, 0.001], [D.osc(L, f * 0.994, { shape: 'saw', phase: r() }), 0.3, 0, 0.001], [D.osc(L, f / 2, { shape: 'square', phase: r() }), 0.25, 0, 0.001]);
  return D.map(D.filter(x, 'lp', (t) => 1800 + 5200 * Math.exp(-t / 0.12), { q: 1.4 }), (s, i) => s * e(i / D.SR) * v);
};
function mkLead() {
  return loop(MK.bpm, MK.bars, (cycles) => {
    const o = { bpm: MK.bpm, steps: steps(MK.bars), cycles, gateScale: 0.85 };
    const x = wide(MK_LEAD, o, mkVoice);
    return D.mixSt([x, 1], [room(x, 0.8, 1.2), 0.2], [S.pingpong(mono(x), MK.bpm, { div: 0.75, n: 3, gain: 0.2 }), 1]);
  });
}
function mkArp() {
  return loop(MK.bpm, MK.bars, (cycles) => {
    const notes = arp(MK_TONES, [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 1]);
    const x = S.play(notes, { bpm: MK.bpm, steps: steps(MK.bars), cycles, voice: (f, g, v) => S.pluck(f, g, v, { decay: 0.12, bright: 5200, q: 3 }) });
    return D.mixSt([D.widen(x, 0.3, 5), 1], [S.pingpong(x, MK.bpm, { div: 0.5, n: 3, gain: 0.22 }), 1]);
  });
}
function mkBass() {
  return loop(MK.bpm, MK.bars, (cycles) => {
    // bajo a contratiempo: en el «y» de cada tiempo, corto y con cuerpo
    const notes = MK_ROOTS.flatMap((r, b) => [2, 6, 10, 14].map((s) => [b * 16 + s, 2, r, 1]));
    const o = { bpm: MK.bpm, steps: steps(MK.bars), cycles, tail: 0.3 };
    const top = S.play(notes, { ...o, voice: (f, g, v) => S.pluck(f, g * 0.8, v, { decay: 0.09, bright: 2400, low: 180, q: 2.5 }) });
    const low = S.play(notes, { ...o, voice: (f, g, v) => S.sub(f, g * 0.8, v) });
    const x = sat(D.mix([top, 0.8, 0, 0.001], [low, 0.7, 0, 0.001]), 1.3);
    return x;
  });
}

/* ================================================================= NEWSTYLE · 150 BPM · Sol# menor */
const NS = { bpm: 150, bars: 2 };
const NS_LEAD = [
  [2, 2, 'D#5'], [6, 2, 'D#5'], [8, 2, 'B4'], [10, 2, 'D#5'], [12, 2, 'F#5'], [14, 2, 'D#5'],
  [18, 2, 'B4'], [22, 2, 'B4'], [24, 2, 'C#5'], [26, 2, 'A#4'], [28, 2, 'F#4'], [30, 2, 'A#4']
];
function nsLead() {
  return loop(NS.bpm, NS.bars, (cycles) => {
    const x = S.play(NS_LEAD, { bpm: NS.bpm, steps: steps(NS.bars), cycles, voice: (f, g, v) => D.mix([S.pluck(f, g, v, { decay: 0.2, bright: 7500 }), 0.8, 0, 0.001], [S.pluck(f * 2, g, v, { decay: 0.1, bright: 9000, seed: 9 }), 0.25, 0, 0.001]) });
    return D.mixSt([D.widen(x, 0.35, 3), 1], [S.pingpong(x, NS.bpm, { div: 0.75, n: 3, gain: 0.28 }), 1], [room(x, 0.82, 1.3), 0.18]);
  });
}
function nsStabs() {
  return loop(NS.bpm, NS.bars, (cycles) => {
    const notes = [2, 6, 10, 14].map((s) => [s, 1, ['G#3', 'B3', 'D#4'], 1]).concat([18, 22].map((s) => [s, 1, ['G#3', 'B3', 'E4'], 1]), [26, 30].map((s) => [s, 1, ['A#3', 'C#4', 'F#4'], 1]));
    const o = { bpm: NS.bpm, steps: steps(NS.bars), cycles };
    const org = S.play(notes, { ...o, voice: (f, g, v) => S.organ(f, g, v, { decay: 0.18 }) });
    const saw = wide(notes, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 40, n: 5, spread: 18, cutoff: 3800, env: { a: 0.002, d: 0.08, s: 0.5, r: 0.05 } }));
    const x = D.mixSt([org, 0.7], [saw, 0.6]);
    return D.mixSt([x, 1], [room(x, 0.8, 1.0), 0.18]);
  });
}

/* ================================================================= TECHNO · 144 BPM · Mi menor */
const TK = { bpm: 144, bars: 2 };
const ACC = 1, n_ = 0.6, sl = { slide: true };
const TK_ACID = [
  [0, 1, 'E2', ACC], [1, 1, 'E2', n_], [2, 1, 'E3', ACC], [3, 1, 'E2', n_], [4, 1, 'G2', n_], [5, 1, 'E2', n_], [6, 1, 'D3', ACC], [7, 1, 'E3', n_, sl],
  [8, 1, 'E2', n_], [9, 1, 'B2', ACC], [10, 1, 'E2', n_], [11, 1, 'A2', n_], [12, 1, 'E2', ACC], [13, 1, 'G3', n_, sl], [14, 1, 'E3', n_], [15, 1, 'D3', n_],
  [16, 1, 'E2', ACC], [17, 1, 'E2', n_], [18, 1, 'E3', n_], [20, 1, 'B2', ACC], [21, 1, 'E2', n_], [22, 1, 'D3', n_], [23, 1, 'E3', ACC, sl],
  [24, 1, 'E2', n_], [25, 1, 'G2', n_], [26, 1, 'A2', ACC], [27, 1, 'B2', n_, sl], [28, 1, 'E2', n_], [29, 1, 'E3', ACC], [30, 1, 'D3', n_], [31, 1, 'B2', n_, sl]
];
function tkAcid() {
  return loop(TK.bpm, TK.bars, (cycles) => {
    const x = S.acidLine(TK_ACID, { bpm: TK.bpm, steps: steps(TK.bars), cycles, shape: 'saw' });
    return D.mixSt([D.stereo(x, Float64Array.from(x)), 1], [S.pingpong(x, TK.bpm, { div: 0.75, n: 3, gain: 0.18, lp: 2500 }), 1]);
  });
}
function tkStab() {
  return loop(TK.bpm, TK.bars, (cycles) => {
    const chord = ['E3', 'G3', 'B3', 'D4'];
    const notes = [3, 10, 14, 19, 26, 29].map((s) => [s, 1, chord, 1]);
    const x = S.play(notes, { bpm: TK.bpm, steps: steps(TK.bars), cycles, voice: (f, g, v) => S.supersaw(f, g, v, { n: 3, spread: 10, cutoff: 1700, q: 2, env: { a: 0.002, d: 0.1, s: 0.3, r: 0.08 } }) });
    return D.mixSt([D.stereo(x, Float64Array.from(x)), 0.9], [S.pingpong(x, TK.bpm, { div: 0.75, n: 6, fb: 0.6, gain: 0.45, lp: 1800 }), 1], [room(x, 0.88, 2.0, 0.6), 0.3]);
  });
}
function tkRoll() {
  return loop(TK.bpm, TK.bars, (cycles) => {
    // bajo rodante: las tres semicorcheas que quedan entre kick y kick, la última del segundo compás sube
    const notes = [];
    for (let q = 0; q < 8; q++) for (const k of [1, 2, 3]) notes.push([q * 4 + k, 1, q === 7 && k === 3 ? 'G2' : 'E2', k === 1 ? 0.8 : 1]);
    const o = { bpm: TK.bpm, steps: steps(TK.bars), cycles, tail: 0.2 };
    const top = S.play(notes, { ...o, voice: (f, g, v) => S.pluck(f, g * 0.8, v, { decay: 0.07, bright: 1600, low: 120, q: 1.5 }) });
    const low = S.play(notes, { ...o, voice: (f, g, v) => S.sub(f, g * 0.7, v, { drive: 2 }) });
    const x = sat(D.mix([top, 0.7, 0, 0.001], [low, 0.8, 0, 0.001]), 1.4);
    return x;
  });
}

/* ================================================================= HARD TRANCE · 140 BPM · La menor */
const TR = { bpm: 140, bars: 4 };
const TR_CHORDS = [['A3', 'C4', 'E4', 'A4'], ['A3', 'C4', 'F4', 'A4'], ['G3', 'C4', 'E4', 'G4'], ['G3', 'B3', 'D4', 'G4']];
function trPad() {
  return loop(TR.bpm, TR.bars, (cycles) => {
    const notes = TR_CHORDS.map((c, b) => [b * 16, 16, c, 0.8]);
    const o = { bpm: TR.bpm, steps: steps(TR.bars), cycles, tail: 2 };
    const pad = wide(notes, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 50, spread: 34, cutoff: (t) => 1400 + 1600 * Math.min(1, t / 1.2), env: { a: 0.35, d: 0.5, s: 0.85, r: 0.6 } }));
    return D.mixSt([pad, 1], [room(pad, 0.9, 2.5, 0.35), 0.35]);
  });
}
function trGated() {
  return loop(TR.bpm, TR.bars, (cycles) => {
    const notes = TR_CHORDS.map((c, b) => [b * 16, 16, c, 0.9]);
    const o = { bpm: TR.bpm, steps: steps(TR.bars), cycles };
    const pad = wide(notes, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 60, spread: 26, cutoff: 5200, env: { a: 0.004, s: 1, r: 0.03 } }));
    const gated = D.applySt(pad, (c) => S.gate16(c, TR.bpm, 'x.x.xx.xx.x.xx.x', { duty: 0.55 }));
    return D.mixSt([gated, 1], [S.pingpong(mono(gated), TR.bpm, { div: 0.75, n: 2, gain: 0.15 }), 1], [room(gated, 0.82, 1.4), 0.18]);
  });
}

/* ================================================================= más melodías */
function happyPiano() {
  // piano de happy hardcore en Sol mayor (Sol – Re – Mim – Do), 180 BPM: acordes a contratiempo y melodía arriba
  const bpm = 180, bars = 4;
  const chords = [['B3', 'D4', 'G4'], ['A3', 'D4', 'F#4'], ['B3', 'E4', 'G4'], ['C4', 'E4', 'G4']];
  const melody = [
    [0, 2, 'D5'], [2, 2, 'G5'], [4, 2, 'F#5'], [6, 2, 'G5'], [8, 4, 'B5'], [12, 4, 'A5'],
    [16, 2, 'A5'], [18, 2, 'F#5'], [20, 2, 'D5'], [22, 2, 'F#5'], [24, 4, 'A5'], [28, 4, 'F#5'],
    [32, 2, 'G5'], [34, 2, 'E5'], [36, 2, 'B4'], [38, 2, 'E5'], [40, 4, 'G5'], [44, 4, 'F#5'],
    [48, 2, 'E5'], [50, 2, 'G5'], [52, 2, 'C6'], [54, 2, 'B5'], [56, 4, 'G5'], [60, 4, 'E5']
  ];
  return loop(bpm, bars, (cycles) => {
    const o = { bpm, steps: steps(bars), cycles };
    const ch = S.play(hits(chords, [2, 6, 10, 14], 2, 0.75), { ...o, voice: (f, g, v) => S.piano(f, g, v, { decay: 0.7 }) });
    const me = S.play(melody, { ...o, voice: (f, g, v) => S.piano(f, g, v, { decay: 1.1, seed: 7 }) });
    const x = D.mix([ch, 0.8, 0, 0.001], [me, 1, 0, 0.001]);
    return D.mixSt([D.widen(x, 0.35, 2), 1], [room(x, 0.82, 1.3), 0.22]);
  });
}
function bells() {
  // caja de música en La menor, 150 BPM, 2 compases
  const bpm = 150, bars = 2;
  const melody = [
    [0, 2, 'E5'], [2, 2, 'A5'], [4, 2, 'C6'], [6, 2, 'B5'], [8, 2, 'A5'], [10, 2, 'E5'], [12, 4, 'G5'],
    [16, 2, 'F5'], [18, 2, 'A5'], [20, 2, 'C6'], [22, 2, 'A5'], [24, 2, 'G5'], [26, 2, 'E5'], [28, 4, 'D5']
  ];
  return loop(bpm, bars, (cycles) => {
    const x = S.play(melody, { bpm, steps: steps(bars), cycles, tail: 3, voice: (f, g, v) => S.bell(f, g, v, { decay: 0.9, index: 2.6 }) });
    return D.mixSt([D.widen(x, 0.4, 7), 1], [S.pingpong(x, bpm, { div: 0.75, n: 3, gain: 0.25, lp: 6000 }), 1], [room(x, 0.88, 2.2, 0.3), 0.3]);
  });
}
function hsRawLead() {
  // lead de raw hardstyle en Fa menor, 150 BPM, 2 compases: frases cortas y saturadas con la nota grave de pedal
  const bpm = 150, bars = 2;
  const notes = [
    [0, 2, 'F4'], [2, 1, 'F4'], [3, 1, 'Ab4'], [4, 2, 'C5'], [6, 2, 'F4'], [8, 2, 'Eb5'], [10, 2, 'Db5'], [12, 2, 'C5'], [14, 2, 'Ab4'],
    [16, 2, 'F4'], [18, 1, 'F4'], [19, 1, 'Ab4'], [20, 2, 'Bb4'], [22, 2, 'F4'], [24, 2, 'C5'], [26, 2, 'Bb4'], [28, 2, 'Ab4'], [30, 2, 'G4']
  ];
  return loop(bpm, bars, (cycles) => {
    const x = S.play(notes, { bpm, steps: steps(bars), cycles, gateScale: 0.85, voice: (f, g, v) => S.rawLead(f, g, v, { drive: 8, center: 1300 }) });
    const r = S.play(notes, { bpm, steps: steps(bars), cycles, gateScale: 0.85, voice: (f, g, v) => S.rawLead(f * 1.004, g, v, { drive: 8, center: 1500 }) });
    const s2 = D.same(D.stereo(x, r));
    return D.mixSt([s2, 1], [room(s2, 0.8, 1.1), 0.16]);
  });
}

/* ================================================================= notas sueltas */
function stab(chord) {
  return () => {
    const g = 0.18, notes = chord.map(S.freq);
    const org = D.mix(...notes.map((f) => [S.organ(f, g, 1, { decay: 0.25 }), 0.5, 0, 0.001]));
    const sawL = D.mix(...notes.map((f, k) => [S.supersaw(f, g, 1, { seed: 70 + k, n: 5, spread: 20, cutoff: 4500, env: { a: 0.002, d: 0.1, s: 0.5, r: 0.12 } }), 0.4, 0, 0.001]));
    const sawR = D.mix(...notes.map((f, k) => [S.supersaw(f, g, 1, { seed: 80 + k, n: 5, spread: 20, cutoff: 4500, env: { a: 0.002, d: 0.1, s: 0.5, r: 0.12 } }), 0.4, 0, 0.001]));
    const x = D.mixSt([D.stereo(org, Float64Array.from(org)), 1], [D.stereo(sawL, sawR), 1]);
    return finishSt(D.mixSt([D.applySt(x, (c) => sat(c, 1.3)), 1], [room(x, 0.82, 1.4), 0.25]));
  };
}
const oneOrgan = () => { const x = D.mix([S.organ(S.freq('C4'), 0.3, 1), 1], [S.organ(S.freq('C5'), 0.3, 0.6, { decay: 0.3 }), 0.5]); return finishSt(D.mixSt([D.widen(x, 0.2, 3), 1], [room(x, 0.8, 1.2), 0.2])); };
const onePluck = () => { const x = S.pluck(S.freq('C4'), 0.3, 1, { decay: 0.3 }); return finishSt(D.mixSt([D.widen(x, 0.3, 2), 1], [S.pingpong(x, 150, { div: 0.75, n: 3, gain: 0.25 }), 1], [room(x, 0.8, 1.2), 0.15])); };
const onePiano = () => { const x = S.piano(S.freq('C4'), 1.2, 1, { decay: 1.6 }); return finishSt(D.mixSt([D.widen(x, 0.25, 4), 1], [room(x, 0.85, 1.6), 0.2])); };
const oneBell = () => { const x = S.bell(S.freq('C5'), 0.5, 1); return finishSt(D.mixSt([D.widen(x, 0.3, 6), 1], [room(x, 0.88, 2.2, 0.3), 0.25])); };
const oneSub = () => finish(S.sub(S.freq('C2'), 0.9, 1, { drive: 1.6 }));
const oneLead = () => {
  const f = S.freq('C4'), L = D.same(D.stereo(S.supersaw(f, 0.9, 1, { seed: 91, spread: 26, cutoff: 6000, drive: 1.5, env: { r: 0.25 } }), S.supersaw(f, 0.9, 1, { seed: 92, spread: 26, cutoff: 6000, drive: 1.5, env: { r: 0.25 } })));
  return finishSt(D.mixSt([L, 1], [room(L, 0.84, 1.8), 0.25]));
};

/* ================================================================= 8 bits (originales) */
const chipSeq = (notes, { bpm = 300, shape = 'pulse', pw = 0.25, vib = 0, r = 0.02 } = {}) =>
  S.play(notes, { bpm, steps: 1 + Math.max(...notes.map(([s, l]) => s + l)), tail: 0.4, voice: (f, g, v) => S.chip(f, g, v, { shape, pw, vib, r }) });
const retroJump = () => finish(S.chip(0, 0.2, 1, { pw: 0.25, sweep: (t) => 180 * Math.pow(5, Math.min(1, t / 0.17)), r: 0.03 }));
const retroPickup = () => finish(chipSeq([[0, 1, 'E6'], [1, 1, 'A6'], [2, 3, 'C#7']], { bpm: 700, pw: 0.125 }));
// subida continua con un trémolo rápido de tono (no arpegios): 300 → 1500 Hz en 0,7 s
const retroPower = () => finish(S.chip(0, 0.75, 1, { pw: 0.5, sweep: (t) => 300 * Math.pow(5, Math.min(1, t / 0.7)) * (1 + 0.06 * Math.sign(Math.sin(2 * Math.PI * 28 * t))), r: 0.06 }));
const retroShot = () => finish(D.mix([S.chip(0, 0.12, 1, { pw: 0.5, sweep: (t) => 1500 * Math.exp(-t / 0.03) + 120 }), 0.8], [S.chip(2500, 0.05, 0.6, { shape: 'noise', r: 0.03 }), 0.4]));
const retroBoom = () => finish(S.chip(0, 0.7, 1, { shape: 'noise', sweep: (t) => 3000 * Math.exp(-t / 0.18) + 60, r: 0.25 }));
const retroOver = () => finish(D.mix([chipSeq([[0, 3, 'G4'], [3, 3, 'F#4'], [6, 3, 'F4'], [9, 8, 'E4']], { bpm: 300, pw: 0.5, vib: 0.008, r: 0.1 }), 0.8], [chipSeq([[0, 3, 'C3'], [3, 3, 'B2'], [6, 3, 'Bb2'], [9, 8, 'A2']], { bpm: 300, shape: 'tri', r: 0.1 }), 0.9]));
const retroBlip = () => finish(chipSeq([[0, 1, 'A5'], [1, 1, 'E6']], { bpm: 1200, pw: 0.125 }));
const retroWin = () => finish(D.mix([chipSeq([[0, 1, 'G5'], [1, 1, 'B5'], [2, 1, 'D6'], [3, 2, 'G6'], [6, 1, 'F#6'], [7, 6, 'G6']], { bpm: 520, pw: 0.25, vib: 0.008, r: 0.08 }), 0.8], [chipSeq([[0, 3, 'G3'], [3, 3, 'D4'], [7, 6, 'G3']], { bpm: 520, shape: 'tri', r: 0.08 }), 0.9]));

/* ---------------------------------------------------------------- catálogo del pack */

/* loop: true → dura compases exactos (bars) y empalma consigo mismo; tonality: tonalidad de la pieza */
const L = (o) => ({ cat: 'loop', loop: true, ...o });
export const SAMPLES = [
  L({ id: 'hs-lead', name: 'Lead hardstyle eufórico', style: 'hardstyle', type: 'melodía', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['lead', 'supersierra', 'eufórico', 'kit hardstyle'], render: hsLead,
    notes: 'Melodía de 4 compases sobre Fam – Re♭ – La♭ – Mi♭: supersierra ancha con su octava, un poco saturada y empujada por el «sidechain», con sala y eco.' }),
  L({ id: 'hs-chords', name: 'Acordes hardstyle', style: 'hardstyle', type: 'acordes', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['acordes', 'supersierra', 'sidechain', 'kit hardstyle'], render: hsChords,
    notes: 'Fam – Re♭ – La♭ – Mi♭ en supersierra, bombeando en cada tiempo.' }),
  L({ id: 'hs-arp', name: 'Arpegio hardstyle', style: 'hardstyle', type: 'arpegio', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['arpegio', 'pluck', 'semicorcheas', 'kit hardstyle'], render: hsArp,
    notes: 'Pluck en semicorcheas por las notas de cada acorde, con eco a corchea con puntillo.' }),
  L({ id: 'hs-reverse-bass', name: 'Bajo inverso hardstyle', style: 'hardstyle', type: 'línea', cat: 'bajo', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['reverse bass', 'contratiempo', 'kit hardstyle'], render: hsRevBass,
    notes: 'Un bajo al revés en cada tiempo (Fa – Re♭ – La♭ – Mi♭) que crece y se corta antes del kick siguiente. Ponlo con un kick a negras.' }),
  L({ id: 'hs-raw-lead', name: 'Lead raw hardstyle', style: 'hardstyle', type: 'melodía', tonality: 'Fa menor', bpm: [150, 150], bars: 2, tags: ['raw', 'saturado', 'lead'], render: hsRawLead,
    notes: 'Frases cortas de cuadrada y sierra muy saturadas, un lado algo desafinado respecto al otro.' }),

  L({ id: 'hc-hoover-riff', name: 'Riff hoover hardcore', style: 'hardcore', type: 'melodía', tonality: 'La menor', bpm: [180, 180], bars: 4, tags: ['hoover', 'riff', 'rave', 'kit hardcore'], render: hcHoover,
    notes: 'Riff de hoover sobre Lam – Fa – Sol – Mim: el mismo ritmo en cada compás, con la caída de tono del hoover en cada nota.' }),
  L({ id: 'hc-piano', name: 'Piano hardcore', style: 'hardcore', type: 'acordes', tonality: 'La menor', bpm: [180, 180], bars: 4, tags: ['piano', 'acordes', 'síncopa', 'kit hardcore'], render: hcPiano,
    notes: 'Acordes de piano sincopados (Lam – Fa – Sol – Mim) con sala.' }),
  L({ id: 'hc-lead', name: 'Lead hardcore', style: 'hardcore', type: 'melodía', tonality: 'La menor', bpm: [180, 180], bars: 4, tags: ['lead', 'saturado', 'kit hardcore'], render: hcLead,
    notes: 'Melodía larga de 4 compases con lead saturado y supersierra.' }),
  L({ id: 'hc-happy-piano', name: 'Piano happy hardcore', style: 'hardcore', type: 'melodía', tonality: 'Sol mayor', bpm: [180, 180], bars: 4, tags: ['happy hardcore', 'piano', 'mayor'], render: happyPiano,
    notes: 'Sol – Re – Mim – Do: acordes a contratiempo y melodía arriba, todo piano.' }),

  L({ id: 'ut-screech-lead', name: 'Melodía screech uptempo', style: 'uptempo', type: 'melodía', tonality: 'Do# menor', bpm: [200, 200], bars: 2, tags: ['screech', 'lead', 'kit uptempo'], render: utScreech,
    notes: 'Melodía con el chillido del uptempo (sierra por un paso banda resonante que barre). En Do#, como los kicks uptempo de Harmony 01.' }),
  L({ id: 'ut-raw-stabs', name: 'Golpes raw uptempo', style: 'uptempo', type: 'melodía', tonality: 'Do# menor', bpm: [200, 200], bars: 2, tags: ['raw', 'stabs', 'contratiempo', 'kit uptempo'], render: utRaw,
    notes: 'Golpes muy saturados entre kick y kick: Do#m y luego La / Si.' }),
  L({ id: 'ut-gated-chords', name: 'Acordes cortados uptempo', style: 'uptempo', type: 'acordes', tonality: 'Do# menor', bpm: [200, 200], bars: 2, tags: ['gated', 'acordes', 'kit uptempo'], render: utChords,
    notes: 'Do#m – La / Si en supersierra cortada a semicorcheas.' }),

  L({ id: 'mk-lead', name: 'Melodía mákina', style: 'makina', type: 'melodía', tonality: 'Re menor', bpm: [175, 175], bars: 4, tags: ['lead', 'cuadrada', 'kit mákina'], render: mkLead,
    notes: 'Melodía sobre Rem – Si♭ – Do – La, con la séptima alzada (Do#) al final: cuadrada y sierras desafinadas con la octava de abajo.' }),
  L({ id: 'mk-arp', name: 'Arpegio mákina', style: 'makina', type: 'arpegio', tonality: 'Re menor', bpm: [175, 175], bars: 4, tags: ['arpegio', 'pluck', 'kit mákina'], render: mkArp,
    notes: 'Arpegio en semicorcheas por los acordes del kit, con eco a corchea.' }),
  L({ id: 'mk-bass', name: 'Bajo mákina', style: 'makina', type: 'línea', cat: 'bajo', tonality: 'Re menor', bpm: [175, 175], bars: 4, tags: ['bajo', 'contratiempo', 'kit mákina'], render: mkBass,
    notes: 'Bajo a contratiempo (Re – Si♭ – Do – La) con cuerpo de sub.' }),

  L({ id: 'ns-lead', name: 'Melodía newstyle', style: 'newstyle', type: 'melodía', tonality: 'Sol# menor', bpm: [150, 150], bars: 2, tags: ['pluck', 'contratiempo', 'kit newstyle'], render: nsLead,
    notes: 'Pluck brillante entre los kicks, sobre Sol#m – Mi / Fa#. En Sol#, como los kicks newstyle de Harmony 01.' }),
  L({ id: 'ns-stabs', name: 'Acordes newstyle', style: 'newstyle', type: 'acordes', tonality: 'Sol# menor', bpm: [150, 150], bars: 2, tags: ['stabs', 'órgano', 'contratiempo', 'kit newstyle'], render: nsStabs,
    notes: 'Órgano y supersierra a contratiempo.' }),

  L({ id: 'tk-acid', name: 'Línea acid', style: 'techno', type: 'línea', cat: 'bajo', tonality: 'Mi menor', bpm: [144, 144], bars: 2, tags: ['acid', '303', 'ligados', 'kit techno'], render: tkAcid,
    notes: 'Una sola voz de sierra con paso bajo resonante: acentos que abren el filtro y notas ligadas que deslizan el tono.' }),
  L({ id: 'tk-dub-stab', name: 'Acorde dub techno', style: 'techno', type: 'acordes', tonality: 'Mi menor', bpm: [144, 144], bars: 2, tags: ['dub', 'stab', 'eco', 'kit techno'], render: tkStab,
    notes: 'Mim7 corto y oscuro, con eco largo a corchea con puntillo y sala.' }),
  L({ id: 'tk-rolling-bass', name: 'Bajo rodante techno', style: 'techno', type: 'línea', cat: 'bajo', tonality: 'Mi menor', bpm: [144, 144], bars: 2, tags: ['rolling', 'bajo', 'kit techno'], render: tkRoll,
    notes: 'Las tres semicorcheas entre kick y kick, en Mi 2.' }),

  L({ id: 'tr-pad', name: 'Pad hard trance', style: 'trance', type: 'acordes', tonality: 'La menor', bpm: [140, 140], bars: 4, tags: ['pad', 'supersierra', 'kit trance'], render: trPad,
    notes: 'Lam – Fa – Do – Sol con entrada lenta y el filtro abriéndose, sala grande.' }),
  L({ id: 'tr-gated', name: 'Acordes cortados trance', style: 'trance', type: 'acordes', tonality: 'La menor', bpm: [140, 140], bars: 4, tags: ['gated', 'trance', 'kit trance'], render: trGated,
    notes: 'Los mismos acordes cortados en semicorcheas.' }),
  L({ id: 'music-box', name: 'Caja de música', style: 'general', type: 'melodía', tonality: 'La menor', bpm: [150, 150], bars: 2, tags: ['campana', 'fm', 'intro'], render: bells,
    notes: 'Campanas FM con eco y sala: para intros y partes tranquilas.' }),

  { id: 'stab-minor', name: 'Stab menor (Do m)', style: 'general', type: 'stab', cat: 'fx', key: 'C4', tonality: 'Do menor', tags: ['stab', 'acorde', 'rave'], render: stab(['C4', 'Eb4', 'G4', 'C5']),
    notes: 'Órgano y supersierra en Do menor, corto, con sala.' },
  { id: 'stab-major', name: 'Stab mayor (Do)', style: 'general', type: 'stab', cat: 'fx', key: 'C4', tonality: 'Do mayor', tags: ['stab', 'acorde', 'rave'], render: stab(['C4', 'E4', 'G4', 'C5']),
    notes: 'El mismo stab en Do mayor.' },
  { id: 'note-organ', name: 'Órgano de rave (Do 4)', style: 'general', type: 'nota', cat: 'fx', key: 'C4', tags: ['órgano', 'nota', 'rave'], render: oneOrgan,
    notes: 'Seis armónicos con caída corta y clic de tecla: el órgano percusivo de las raves. Súbelo o bájalo con el tono del pad.' },
  { id: 'note-pluck', name: 'Pluck (Do 4)', style: 'general', type: 'nota', cat: 'fx', key: 'C4', tags: ['pluck', 'nota'], render: onePluck,
    notes: 'Pluck con eco: cambia de nota con el tono del pad.' },
  { id: 'note-piano', name: 'Piano (Do 4)', style: 'general', type: 'nota', cat: 'fx', key: 'C4', tags: ['piano', 'nota'], render: onePiano,
    notes: 'Nota de piano sintetizado.' },
  { id: 'note-bell', name: 'Campana (Do 5)', style: 'general', type: 'nota', cat: 'fx', key: 'C5', tags: ['campana', 'fm', 'nota'], render: oneBell,
    notes: 'Campana FM con sala.' },
  { id: 'note-sub', name: 'Sub (Do 2)', style: 'general', type: 'bajo', cat: 'bajo', key: 'C2', tags: ['sub', 'nota', 'grave'], render: oneSub,
    notes: 'Seno en Do 2 con un poco de saturación.' },
  { id: 'note-lead', name: 'Lead supersierra (Do 4)', style: 'hardstyle', type: 'nota', cat: 'fx', key: 'C4', tags: ['lead', 'supersierra', 'nota'], render: oneLead,
    notes: 'Una nota larga de supersierra con sala: con el tono del pad, para tocar melodías con las teclas.' },

  { id: 'retro-jump', name: 'Salto 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'salto'], render: retroJump,
    notes: 'Pulso al 25 % que sube de 180 a 900 Hz.' },
  { id: 'retro-pickup', name: 'Recoger 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'objeto'], render: retroPickup,
    notes: 'Tres notas rápidas hacia arriba con pulso al 12,5 %.' },
  { id: 'retro-power', name: 'Mejora 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'subida'], render: retroPower,
    notes: 'Pulso que sube de 300 a 1500 Hz con un trémolo rápido de tono.' },
  { id: 'retro-shot', name: 'Disparo 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'disparo'], render: retroShot,
    notes: 'Pulso que cae de golpe y un chasquido de ruido de registro.' },
  { id: 'retro-boom', name: 'Explosión 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'explosión'], render: retroBoom,
    notes: 'Ruido de registro de 15 bits que se va haciendo más grave.' },
  { id: 'retro-game-over', name: 'Fin de partida 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'perder'], render: retroOver,
    notes: 'Bajada cromática con pulso y triángulo.' },
  { id: 'retro-blip', name: 'Menú 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'interfaz'], render: retroBlip,
    notes: 'Dos notas muy cortas: el «bip» de un menú.' },
  { id: 'retro-win', name: 'Victoria 8 bits', style: 'general', type: 'retro', cat: 'fx', tags: ['8 bits', 'videojuego', 'fanfarria'], render: retroWin,
    notes: 'Fanfarria corta en Sol mayor con pulso y triángulo.' }
];
