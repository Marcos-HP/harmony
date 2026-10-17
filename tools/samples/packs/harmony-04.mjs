/* HARMONY 04 · Más melodías
   Otros ocho kits de bucles melódicos originales, como los de Harmony 03: las piezas de un kit comparten tonalidad y
   tempo y duran compases exactos, así que se apilan en el secuenciador (todas en el paso 1) o en pads en modo bucle.
     Mákina II        178 BPM · La menor   · Lam – Fa – Sol – Mi        (4 compases)
     Mákina III       172 BPM · Mi menor   · Mim – Do – Re – Si          (4 compases)
     Hardcore II      190 BPM · Fa# menor  · Fa#m – Re – La – Do#       (4 compases)
     Newstyle II      150 BPM · Fa menor   · Fam – Re♭ – Mi♭ – Do        (4 compases)
     Uptempo II       210 BPM · Re menor   · Rem – Si♭                   (2 compases)
     Hardstyle II     150 BPM · Sol menor  · Solm – Mi♭ – Si♭ – Fa       (4 compases)
     Happy hardcore   175 BPM · Re mayor   · Re – La – Sim – Sol         (4 compases)
     Hard trance II   140 BPM · Re menor   · Rem – Si♭ – Fa – Do         (4 compases)
   Todo es composición y síntesis de Harmony (tools/samples/synth.mjs): ni melodías ni sonidos de nadie. */
import * as D from '../dsp.mjs';
import * as S from '../synth.mjs';

export const PACK = {
  id: 'harmony-04',
  name: 'Harmony 04',
  title: 'Más melodías',
  version: '1.0.0',
  date: '2026-10-17',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Melodías compuestas para Harmony y sintetizadas en tools/samples/ (Harmony). Sin grabaciones, sin samples de terceros y sin melodías de nadie.',
  credits: 'Harmony'
};

/* ---------------------------------------------------------------- piezas comunes (como en Harmony 03) */

const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));
/* Bucle: tocado dos veces, limpio y limitado entero; se queda la segunda vuelta, que lleva dentro las colas de la
   primera y empalma consigo misma. 1,5 ms de fundido en los bordes */
function loop(bpm, bars, build) {
  const raw = build(2);
  if (!raw.L) {
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
const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
const room = (x, size = 0.8, tail = 1.6, damp = 0.45) => D.reverb(x.L ? mono(x) : x, { size, damp, tail, pre: 0.012 });
/* mismo instrumento con otra semilla a cada lado: estéreo ancho sin desfase en el centro */
const wide = (notes, o, voice) => D.same(D.stereo(S.play(notes, { ...o, voice: voice(1) }), S.play(notes, { ...o, voice: voice(2) })));
const steps = (bars) => bars * 16;
/* arpegio en semicorcheas sobre las notas de cada acorde, en el orden dado */
function arp(chords, order, { vel = [1, 0.75], len = 1 } = {}) {
  const out = [];
  chords.forEach((tones, b) => order.forEach((k, j) => out.push([b * 16 + j, len, tones[k % tones.length], vel[j % vel.length]])));
  return out;
}
/* el mismo ritmo con otras notas en cada compás */
const riff = (rhythm, bars) => bars.flatMap((notes, b) => rhythm.map(([s, l], k) => [b * 16 + s, l, notes[k]]));
/* golpes en unos pasos de cada compás con el acorde (o la nota) de ese compás */
const hits = (chords, at, len = 1, vel = 1) => chords.flatMap((c, b) => at.map((s, k) => [b * 16 + s, len, c, Array.isArray(vel) ? vel[k % vel.length] : vel]));
/* bajo a contratiempo con cuerpo: pluck oscuro y sub debajo */
function offBass(roots, at, { bpm, bars, cycles, len = 2, vel = 1, bright = 2400 }) {
  const notes = hits(roots, at, len, vel);
  const o = { bpm, steps: steps(bars), cycles, tail: 0.3 };
  const top = S.play(notes, { ...o, voice: (f, g, v) => S.pluck(f, g * 0.8, v, { decay: 0.09, bright, low: 180, q: 2.5 }) });
  const low = S.play(notes, { ...o, voice: (f, g, v) => S.sub(f, g * 0.8, v) });
  return sat(D.mix([top, 0.8, 0, 0.001], [low, 0.7, 0, 0.001]), 1.3);
}
/* lead de mákina: cuadrada y sierras desafinadas, brillante y con la octava de abajo */
const pulseVoice = (seed, { pw = 0.4, open = 5200, base = 1800 } = {}) => (f, g, v) => {
  const L = g + 0.08, e = S.adsr(g, { a: 0.003, d: 0.12, s: 0.75, r: 0.07 }), r = D.rng(seed);
  const x = D.mix([D.osc(L, f, { shape: 'pulse', pw, phase: r() }), 0.4, 0, 0.001], [D.osc(L, f * 1.007, { shape: 'saw', phase: r() }), 0.3, 0, 0.001], [D.osc(L, f * 0.994, { shape: 'saw', phase: r() }), 0.3, 0, 0.001], [D.osc(L, f / 2, { shape: 'square', phase: r() }), 0.25, 0, 0.001]);
  return D.map(D.filter(x, 'lp', (t) => base + open * Math.exp(-t / 0.12), { q: 1.4 }), (s, i) => s * e(i / D.SR) * v);
};
const saw = (seed, o = {}) => (f, g, v) => S.supersaw(f, g, v, { seed, spread: 24, cutoff: 6200, drive: 1.4, env: { r: 0.08 }, ...o });
/* lead de supersierra con su octava, sala y eco */
function sawLead(K, notes, { gateScale = 0.9, oct = 0.2, pump = 0.3, echo = 0.18, voice = {} } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const o = { bpm: K.bpm, steps: steps(K.bars), cycles, gateScale };
    const lead = wide(notes, o, (seed) => saw(seed + 40, voice));
    const up = S.play(notes, { ...o, voice: (f, g, v) => S.supersaw(f * 2, g, v, { seed: 7, n: 3, spread: 12, cutoff: 9000, env: { r: 0.06 } }) });
    const dry = D.mixSt([lead, 1], [up, oct]);
    const body = pump ? D.applySt(dry, (c) => S.pump(c, K.bpm, { depth: pump })) : dry;
    return D.mixSt([body, 1], [room(dry, 0.82, 1.3), 0.2], [S.pingpong(mono(dry), K.bpm, { div: 0.75, n: 3, gain: echo }), 1]);
  });
}
function pulseLead(K, notes, { gateScale = 0.85, voice = {}, echo = 0.2 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const o = { bpm: K.bpm, steps: steps(K.bars), cycles, gateScale };
    const x = wide(notes, o, (seed) => pulseVoice(seed + 50, voice));
    return D.mixSt([x, 1], [room(x, 0.8, 1.2), 0.2], [S.pingpong(mono(x), K.bpm, { div: 0.75, n: 3, gain: echo }), 1]);
  });
}
function pluckArp(K, tones, order, { decay = 0.14, bright = 5600, echo = 0.24 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const x = S.play(arp(tones, order), { bpm: K.bpm, steps: steps(K.bars), cycles, voice: (f, g, v) => S.pluck(f, g, v, { decay, bright, q: 3 }) });
    return D.mixSt([D.widen(x, 0.3, 5), 1], [S.pingpong(x, K.bpm, { div: 0.75, n: 3, gain: echo, lp: 3800 }), 1], [room(x, 0.8, 1.1), 0.12]);
  });
}
function bellArp(K, tones, order, { decay = 0.7, len = 1 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const x = S.play(arp(tones, order, { len }), { bpm: K.bpm, steps: steps(K.bars), cycles, voice: (f, g, v) => S.bell(f, g, v * 0.8, { decay }) });
    return D.mixSt([D.widen(x, 0.35, 8), 1], [room(x, 0.86, 1.8), 0.25], [S.pingpong(x, K.bpm, { div: 0.75, n: 2, gain: 0.18 }), 1]);
  });
}
function pianoHits(K, chords, at, { len = 2, vel = 1, decay = 0.9 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const x = S.play(hits(chords, at, len, vel), { bpm: K.bpm, steps: steps(K.bars), cycles, voice: (f, g, v) => S.piano(f, g, v, { decay }) });
    return D.mixSt([D.widen(x, 0.35, 6), 1], [room(x, 0.8, 1.3), 0.24]);
  });
}
function organHits(K, chords, at, { len = 1, vel = 1 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const x = S.play(hits(chords, at, len, vel), { bpm: K.bpm, steps: steps(K.bars), cycles, voice: (f, g, v) => S.organ(f, g, v, { decay: 0.3 }) });
    return D.mixSt([D.widen(x, 0.25, 3), 1], [room(x, 0.8, 1.1), 0.18]);
  });
}
function sawPad(K, chords, { pump = 0.85 } = {}) {
  return loop(K.bpm, K.bars, (cycles) => {
    const notes = chords.map((c, b) => [b * 16, 16, c, 0.9]);
    const pad = wide(notes, { bpm: K.bpm, steps: steps(K.bars), cycles }, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 60, spread: 30, cutoff: 4000, env: { a: 0.01, s: 0.95, r: 0.08 } }));
    const pumped = D.applySt(pad, (c) => S.pump(c, K.bpm, { depth: pump, rel: 0.2 }));
    return D.mixSt([pumped, 1], [room(pad, 0.85, 1.6), 0.18]);
  });
}
/* acordes de supersierra cortados en semicorcheas por un patrón */
function gatedChords(K, chords, pattern) {
  return loop(K.bpm, K.bars, (cycles) => {
    const notes = chords.map((c, b) => [b * 16, 16, c, 0.9]);
    const pad = wide(notes, { bpm: K.bpm, steps: steps(K.bars), cycles }, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 70, spread: 28, cutoff: 5200, drive: 1.3, env: { a: 0.004, s: 1, r: 0.05 } }));
    const g = D.applySt(pad, (c) => S.gate16(c, K.bpm, pattern));
    return D.mixSt([g, 1], [room(g, 0.82, 1.2), 0.18], [S.pingpong(mono(g), K.bpm, { div: 0.75, n: 2, gain: 0.14 }), 1]);
  });
}
const OFF = [2, 6, 10, 14];                    // contratiempos de cada tiempo
const ROLL = [2, 3, 6, 7, 10, 11, 14, 15];      // bajo galopante (dos semicorcheas tras cada contratiempo)
const ROLL_V = [1, 0.7];

/* ================================================================= MÁKINA II · 178 BPM · La menor */
const M2 = { bpm: 178, bars: 4 };
const M2_CH = [['A4', 'C5', 'E5'], ['A4', 'C5', 'F5'], ['B4', 'D5', 'G5'], ['B4', 'E5', 'G#5']];
const M2_TONES = [['A4', 'C5', 'E5', 'A5'], ['F4', 'A4', 'C5', 'F5'], ['G4', 'B4', 'D5', 'G5'], ['E4', 'G#4', 'B4', 'E5']];
const M2_LEAD = [
  [0, 3, 'E5'], [3, 3, 'A5'], [6, 2, 'C6'], [8, 2, 'B5'], [10, 2, 'A5'], [12, 2, 'E5'], [14, 2, 'A5'],
  [16, 3, 'F5'], [19, 3, 'A5'], [22, 2, 'C6'], [24, 2, 'B5'], [26, 2, 'A5'], [28, 4, 'F5'],
  [32, 3, 'G5'], [35, 3, 'B5'], [38, 2, 'D6'], [40, 2, 'C6'], [42, 2, 'B5'], [44, 2, 'G5'], [46, 2, 'B5'],
  [48, 3, 'G#5'], [51, 3, 'B5'], [54, 2, 'E6'], [56, 2, 'D6'], [58, 2, 'B5'], [60, 4, 'G#5']
];
const m2Lead = () => pulseLead(M2, M2_LEAD, { voice: { pw: 0.35 } });
const m2Piano = () => pianoHits(M2, M2_CH, [0, 3, 6, 10, 12], { vel: [1, 0.8, 0.9, 0.85, 0.9] });
const m2Bass = () => loop(M2.bpm, M2.bars, (cycles) => offBass(['A1', 'F1', 'G1', 'E1'], ROLL, { ...M2, cycles, len: 1, vel: ROLL_V }));
const m2Bell = () => bellArp(M2, M2_TONES, [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2], { decay: 0.55 });
const m2Organ = () => organHits(M2, M2_CH, OFF, { vel: [0.9, 0.8, 1, 0.8] });

/* ================================================================= MÁKINA III · 172 BPM · Mi menor */
const M3 = { bpm: 172, bars: 4 };
const M3_HOOVER = [
  [0, 4, 'E4'], [4, 2, 'G4'], [6, 2, 'B4'], [8, 4, 'E5'], [12, 4, 'D5'],
  [16, 4, 'C5'], [20, 2, 'B4'], [22, 2, 'G4'], [24, 4, 'E4'], [28, 4, 'G4'],
  [32, 4, 'F#4'], [36, 2, 'A4'], [38, 2, 'D5'], [40, 4, 'F#5'], [44, 4, 'E5'],
  [48, 4, 'D#5'], [52, 2, 'B4'], [54, 2, 'F#4'], [56, 8, 'B4']
];
const M3_TONES = [['E4', 'G4', 'B4', 'E5'], ['C4', 'E4', 'G4', 'C5'], ['D4', 'F#4', 'A4', 'D5'], ['B3', 'D#4', 'F#4', 'B4']];
const M3_STAB = [['E4', 'G4', 'B4'], ['E4', 'G4', 'C5'], ['F#4', 'A4', 'D5'], ['F#4', 'B4', 'D#5']];
function m3Hoover() {
  return loop(M3.bpm, M3.bars, (cycles) => {
    const o = { bpm: M3.bpm, steps: steps(M3.bars), cycles, gateScale: 0.9 };
    const x = wide(M3_HOOVER, o, (seed) => (f, g, v) => S.hoover(f, g, v, { seed: seed + 9, bend: 2, bendTau: 0.02 }));
    return D.mixSt([x, 1], [room(x, 0.8, 1.2), 0.2], [S.pingpong(mono(x), M3.bpm, { div: 0.75, n: 2, gain: 0.15 }), 1]);
  });
}
const m3Arp = () => pluckArp(M3, M3_TONES, [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]);
const m3Bass = () => loop(M3.bpm, M3.bars, (cycles) => offBass(['E2', 'C2', 'D2', 'B1'], OFF, { ...M3, cycles }));
const m3Stabs = () => organHits(M3, M3_STAB, [2, 6, 10, 13, 14], { vel: [0.9, 0.85, 1, 0.7, 0.9] });

/* ================================================================= HARDCORE II · 190 BPM · Fa# menor */
const C2 = { bpm: 190, bars: 4 };
const C2_LEAD = [
  [0, 4, 'C#5'], [4, 4, 'F#5'], [8, 2, 'E5'], [10, 2, 'F#5'], [12, 4, 'A5'],
  [16, 4, 'A5'], [20, 2, 'F#5'], [22, 2, 'E5'], [24, 4, 'D5'], [28, 4, 'F#5'],
  [32, 4, 'E5'], [36, 4, 'A5'], [40, 2, 'G#5'], [42, 2, 'A5'], [44, 4, 'C#6'],
  [48, 6, 'B5'], [54, 2, 'A5'], [56, 4, 'G#5'], [60, 4, 'F5']
];
const C2_CH = [['F#4', 'A4', 'C#5'], ['F#4', 'A4', 'D5'], ['E4', 'A4', 'C#5'], ['F4', 'G#4', 'C#5']];
const C2_TONES = [['F#4', 'A4', 'C#5', 'F#5'], ['D4', 'F#4', 'A4', 'D5'], ['C#4', 'E4', 'A4', 'C#5'], ['C#4', 'F4', 'G#4', 'C#5']];
const c2Lead = () => sawLead(C2, C2_LEAD, { voice: { drive: 1.8, cutoff: 5600 }, pump: 0.25 });
const c2Piano = () => pianoHits(C2, C2_CH, [0, 3, 6, 8, 11, 14], { vel: [1, 0.8, 0.85, 0.95, 0.8, 0.85] });
const c2Chords = () => gatedChords(C2, C2_CH, 'x.xx.xx.x.xx.xx.');
const c2Arp = () => pluckArp(C2, C2_TONES, [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 2, 1, 0, 1], { decay: 0.11 });

/* ================================================================= NEWSTYLE II · 150 BPM · Fa menor */
const N2 = { bpm: 150, bars: 4 };
const N2_LEAD = [
  [2, 2, 'C5'], [6, 2, 'C5'], [8, 2, 'Ab4'], [10, 2, 'C5'], [12, 2, 'F5'], [14, 2, 'Eb5'],
  [18, 2, 'Db5'], [22, 2, 'Db5'], [24, 2, 'F5'], [26, 2, 'Ab5'], [28, 2, 'F5'], [30, 2, 'Db5'],
  [34, 2, 'Eb5'], [38, 2, 'Eb5'], [40, 2, 'G5'], [42, 2, 'Bb5'], [44, 2, 'G5'], [46, 2, 'Eb5'],
  [50, 2, 'E5'], [54, 2, 'G5'], [56, 2, 'C6'], [58, 2, 'Bb5'], [60, 2, 'G5'], [62, 2, 'E5']
];
const N2_CH = [['F4', 'Ab4', 'C5'], ['F4', 'Ab4', 'Db5'], ['G4', 'Bb4', 'Eb5'], ['G4', 'C5', 'E5']];
const N2_TONES = [['F5', 'Ab5', 'C6'], ['F5', 'Ab5', 'Db6'], ['G5', 'Bb5', 'Eb6'], ['G5', 'C6', 'E6']];
const n2Lead = () => pulseLead(N2, N2_LEAD, { voice: { pw: 0.3, base: 1500, open: 4200 }, gateScale: 0.8 });
const n2Bass = () => loop(N2.bpm, N2.bars, (cycles) => offBass(['F2', 'Db2', 'Eb2', 'C2'], OFF, { ...N2, cycles, bright: 2000 }));
const n2Stabs = () => pianoHits(N2, N2_CH, OFF, { len: 1, vel: [0.95, 0.85, 1, 0.85], decay: 0.5 });
const n2Bell = () => bellArp(N2, N2_TONES, [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2], { decay: 0.45 });

/* ================================================================= UPTEMPO II · 210 BPM · Re menor */
const U2 = { bpm: 210, bars: 2 };
const U2_SCREECH = [
  [0, 2, 'D5'], [2, 2, 'F5'], [4, 1, 'A5'], [5, 1, 'G5'], [6, 2, 'F5'], [8, 4, 'D5'], [12, 2, 'C5'], [14, 2, 'E5'],
  [16, 2, 'F5'], [18, 2, 'D5'], [20, 2, 'Bb4'], [22, 2, 'D5'], [24, 2, 'F5'], [26, 2, 'A5'], [28, 4, 'G5']
];
const U2_RAW = riff([[2, 1], [3, 1], [6, 2], [10, 1], [11, 1], [14, 2]], [['D4', 'D4', 'F4', 'D4', 'D4', 'A4'], ['Bb3', 'Bb3', 'D4', 'C4', 'C4', 'E4']]);
function u2Screech() {
  return loop(U2.bpm, U2.bars, (cycles) => {
    const o = { bpm: U2.bpm, steps: steps(U2.bars), cycles, gateScale: 0.9 };
    const x = S.play(U2_SCREECH, { ...o, voice: (f, g, v) => S.screech(f, g, v) });
    return D.mixSt([D.widen(x, 0.3, 3), 1], [room(x, 0.75, 0.9), 0.14]);
  });
}
function u2Raw() {
  return loop(U2.bpm, U2.bars, (cycles) => {
    const x = S.play(U2_RAW, { bpm: U2.bpm, steps: steps(U2.bars), cycles, gateScale: 0.8, voice: (f, g, v) => S.rawLead(f, g, v, { drive: 7, center: 1200 }) });
    return D.mixSt([D.widen(x, 0.25, 2), 1], [room(x, 0.7, 0.8), 0.12]);
  });
}
const u2Chords = () => gatedChords(U2, [['D4', 'F4', 'A4'], ['D4', 'F4', 'Bb4']], 'x..x..x.x..x.x..');

/* ================================================================= HARDSTYLE II · 150 BPM · Sol menor */
const S2 = { bpm: 150, bars: 4 };
const S2_LEAD = [
  [0, 2, 'D5'], [2, 2, 'D5'], [4, 2, 'Bb4'], [6, 2, 'D5'], [8, 3, 'G5'], [11, 3, 'F5'], [14, 2, 'D5'],
  [16, 2, 'Eb5'], [18, 2, 'Eb5'], [20, 2, 'G5'], [22, 2, 'Eb5'], [24, 3, 'Bb5'], [27, 3, 'G5'], [30, 2, 'F5'],
  [32, 2, 'F5'], [34, 2, 'F5'], [36, 2, 'D5'], [38, 2, 'F5'], [40, 3, 'Bb5'], [43, 3, 'A5'], [46, 2, 'F5'],
  [48, 3, 'A5'], [51, 3, 'G5'], [54, 2, 'F5'], [56, 3, 'C5'], [59, 3, 'D5'], [62, 2, 'F5']
];
const S2_CH = [['G4', 'Bb4', 'D5'], ['G4', 'Bb4', 'Eb5'], ['F4', 'Bb4', 'D5'], ['F4', 'A4', 'C5']];
const S2_TONES = [['G4', 'Bb4', 'D5', 'G5'], ['Eb4', 'G4', 'Bb4', 'Eb5'], ['F4', 'Bb4', 'D5', 'F5'], ['F4', 'A4', 'C5', 'F5']];
const s2Lead = () => sawLead(S2, S2_LEAD, { voice: { spread: 28, cutoff: 6800, drive: 1.6 }, pump: 0.35, oct: 0.24 });
const s2Arp = () => pluckArp(S2, S2_TONES, [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 1, 2, 3, 2], { decay: 0.16, bright: 6000, echo: 0.3 });
function s2RevBass() {
  return loop(S2.bpm, S2.bars, (cycles) => {
    const notes = ['G1', 'Eb2', 'Bb1', 'F1'].flatMap((r, b) => [0, 1, 2, 3].map((q) => [b * 16 + q * 4 + 1, 3, r, 1]));
    return S.play(notes, { bpm: S2.bpm, steps: steps(S2.bars), cycles, tail: 0.1, voice: (f, g, v) => S.reverseBass(f, g, v) });
  });
}
const s2Pad = () => sawPad(S2, S2_CH);

/* ================================================================= HAPPY HARDCORE · 175 BPM · Re mayor */
const HH = { bpm: 175, bars: 4 };
const HH_LEAD = [
  [0, 2, 'F#5'], [2, 2, 'A5'], [4, 2, 'D6'], [6, 2, 'A5'], [8, 4, 'F#5'], [12, 4, 'E5'],
  [16, 2, 'E5'], [18, 2, 'A5'], [20, 2, 'C#6'], [22, 2, 'A5'], [24, 4, 'E5'], [28, 4, 'C#5'],
  [32, 2, 'D5'], [34, 2, 'F#5'], [36, 2, 'B5'], [38, 2, 'F#5'], [40, 4, 'D6'], [44, 4, 'C#6'],
  [48, 4, 'B5'], [52, 2, 'A5'], [54, 2, 'G5'], [56, 4, 'F#5'], [60, 4, 'E5']
];
const HH_CH = [['D4', 'F#4', 'A4'], ['C#4', 'E4', 'A4'], ['D4', 'F#4', 'B4'], ['D4', 'G4', 'B4']];
const HH_TONES = [['D5', 'F#5', 'A5', 'D6'], ['C#5', 'E5', 'A5', 'C#6'], ['B4', 'D5', 'F#5', 'B5'], ['B4', 'D5', 'G5', 'B5']];
const hhLead = () => sawLead(HH, HH_LEAD, { voice: { cutoff: 7500, drive: 1.2 }, pump: 0.3, oct: 0.3, echo: 0.2 });
const hhPiano = () => pianoHits(HH, HH_CH, OFF, { len: 2, vel: [0.9, 0.85, 1, 0.85], decay: 0.7 });
const hhBell = () => bellArp(HH, HH_TONES, [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2], { decay: 0.5 });

/* ================================================================= HARD TRANCE II · 140 BPM · Re menor */
const T2 = { bpm: 140, bars: 4 };
const T2_LEAD = [
  [0, 6, 'A5'], [6, 2, 'F5'], [8, 8, 'D5'],
  [16, 6, 'F5'], [22, 2, 'D5'], [24, 8, 'Bb4'],
  [32, 6, 'C6'], [38, 2, 'A5'], [40, 8, 'F5'],
  [48, 6, 'G5'], [54, 2, 'E5'], [56, 8, 'C5']
];
const T2_TONES = [['D4', 'F4', 'A4', 'D5'], ['D4', 'F4', 'Bb4', 'D5'], ['C4', 'F4', 'A4', 'C5'], ['C4', 'E4', 'G4', 'C5']];
const t2Lead = () => sawLead(T2, T2_LEAD, { gateScale: 0.97, voice: { spread: 30, cutoff: 5200, drive: 1.2, env: { a: 0.01, s: 0.9, r: 0.15 } }, pump: 0.4, oct: 0.15, echo: 0.24 });
const t2Arp = () => pluckArp(T2, T2_TONES, [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 3, 2, 1, 0], { decay: 0.13, bright: 5000, echo: 0.3 });
const t2Bass = () => loop(T2.bpm, T2.bars, (cycles) => offBass(['D2', 'Bb1', 'F1', 'C2'], [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], { ...T2, cycles, len: 1, vel: [0.7, 0.85, 0.7], bright: 1800 }));

/* ---------------------------------------------------------------- catálogo del pack */

const L = (o) => ({ cat: 'loop', loop: true, ...o });
const kit = (k) => 'kit ' + k;
export const SAMPLES = [
  L({ id: 'mk2-lead', name: 'Melodía mákina II', style: 'makina', type: 'melodía', tonality: 'La menor', bpm: [178, 178], bars: 4, tags: ['lead', 'cuadrada', kit('mákina II')], render: m2Lead,
    notes: 'Melodía en frases de 3 + 3 + 2 sobre Lam – Fa – Sol – Mi (con el Sol# de la menor armónica al final): cuadrada y sierras desafinadas.' }),
  L({ id: 'mk2-piano', name: 'Piano mákina II', style: 'makina', type: 'acordes', tonality: 'La menor', bpm: [178, 178], bars: 4, tags: ['piano', 'acordes', kit('mákina II')], render: m2Piano,
    notes: 'Acordes de piano en el ritmo 3 + 3 + 4 + 2 de cada compás.' }),
  L({ id: 'mk2-bass', name: 'Bajo galopante mákina II', style: 'makina', type: 'línea', tonality: 'La menor', bpm: [178, 178], bars: 4, tags: ['bajo', 'galope', 'contratiempo', kit('mákina II')], render: m2Bass,
    notes: 'Dos semicorcheas tras cada contratiempo (la segunda más suave): La – Fa – Sol – Mi, pluck oscuro con sub.' }),
  L({ id: 'mk2-bell', name: 'Campanas mákina II', style: 'makina', type: 'arpegio', tonality: 'La menor', bpm: [178, 178], bars: 4, tags: ['campana', 'fm', 'arpegio', kit('mákina II')], render: m2Bell,
    notes: 'Arpegio de campana FM en semicorcheas por las notas de cada acorde, con sala y eco.' }),
  L({ id: 'mk2-organ', name: 'Órgano mákina II', style: 'makina', type: 'acordes', tonality: 'La menor', bpm: [178, 178], bars: 4, tags: ['órgano', 'stab', 'contratiempo', kit('mákina II')], render: m2Organ,
    notes: 'Golpes de órgano de rave a contratiempo con los acordes del kit.' }),

  L({ id: 'mk3-hoover', name: 'Hoover mákina III', style: 'makina', type: 'melodía', tonality: 'Mi menor', bpm: [172, 172], bars: 4, tags: ['hoover', 'lead', 'remember', kit('mákina III')], render: m3Hoover,
    notes: 'Melodía de hoover sobre Mim – Do – Re – Si, que acaba en la dominante (Re#): pulsos con ancho modulado y su caída de tono.' }),
  L({ id: 'mk3-arp', name: 'Arpegio mákina III', style: 'makina', type: 'arpegio', tonality: 'Mi menor', bpm: [172, 172], bars: 4, tags: ['arpegio', 'pluck', kit('mákina III')], render: m3Arp,
    notes: 'Pluck en semicorcheas por las notas de cada acorde, con eco a corchea con puntillo.' }),
  L({ id: 'mk3-bass', name: 'Bajo mákina III', style: 'makina', type: 'línea', tonality: 'Mi menor', bpm: [172, 172], bars: 4, tags: ['bajo', 'contratiempo', kit('mákina III')], render: m3Bass,
    notes: 'Bajo a contratiempo: Mi – Do – Re – Si.' }),
  L({ id: 'mk3-stabs', name: 'Golpes de órgano mákina III', style: 'makina', type: 'acordes', tonality: 'Mi menor', bpm: [172, 172], bars: 4, tags: ['órgano', 'stab', kit('mákina III')], render: m3Stabs,
    notes: 'Órgano a contratiempo con un golpe de más antes del último tiempo.' }),

  L({ id: 'hc2-lead', name: 'Himno hardcore II', style: 'hardcore', type: 'melodía', tonality: 'Fa# menor', bpm: [190, 190], bars: 4, tags: ['lead', 'supersierra', 'himno', kit('hardcore II')], render: c2Lead,
    notes: 'Melodía de himno sobre Fa#m – Re – La – Do#: supersierra saturada con su octava, sala y eco.' }),
  L({ id: 'hc2-piano', name: 'Piano hardcore II', style: 'hardcore', type: 'acordes', tonality: 'Fa# menor', bpm: [190, 190], bars: 4, tags: ['piano', 'break', kit('hardcore II')], render: c2Piano,
    notes: 'Acordes de piano sincopados para el break.' }),
  L({ id: 'hc2-chords', name: 'Acordes cortados hardcore II', style: 'hardcore', type: 'acordes', tonality: 'Fa# menor', bpm: [190, 190], bars: 4, tags: ['supersierra', 'gate', kit('hardcore II')], render: c2Chords,
    notes: 'Acordes de supersierra cortados en semicorcheas.' }),
  L({ id: 'hc2-arp', name: 'Arpegio hardcore II', style: 'hardcore', type: 'arpegio', tonality: 'Fa# menor', bpm: [190, 190], bars: 4, tags: ['arpegio', 'pluck', kit('hardcore II')], render: c2Arp,
    notes: 'Pluck corto en semicorcheas.' }),

  L({ id: 'ns2-lead', name: 'Melodía newstyle II', style: 'newstyle', type: 'melodía', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['lead', 'contratiempo', kit('newstyle II')], render: n2Lead,
    notes: 'Melodía que entra a contratiempo sobre Fam – Re♭ – Mi♭ – Do: cuadrada estrecha y sierras.' }),
  L({ id: 'ns2-bass', name: 'Bajo newstyle II', style: 'newstyle', type: 'línea', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['bajo', 'contratiempo', kit('newstyle II')], render: n2Bass,
    notes: 'Bajo a contratiempo: Fa – Re♭ – Mi♭ – Do.' }),
  L({ id: 'ns2-stabs', name: 'Piano newstyle II', style: 'newstyle', type: 'acordes', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['piano', 'stab', kit('newstyle II')], render: n2Stabs,
    notes: 'Golpes cortos de piano a contratiempo.' }),
  L({ id: 'ns2-bell', name: 'Campanas newstyle II', style: 'newstyle', type: 'arpegio', tonality: 'Fa menor', bpm: [150, 150], bars: 4, tags: ['campana', 'arpegio', kit('newstyle II')], render: n2Bell,
    notes: 'Campanas en semicorcheas una octava arriba.' }),

  L({ id: 'ut2-screech', name: 'Screech uptempo II', style: 'uptempo', type: 'melodía', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ['screech', 'lead', kit('uptempo II')], render: u2Screech,
    notes: 'Melodía de screech sobre Rem – Si♭: sierra por un paso banda resonante que barre hacia abajo, muy saturada.' }),
  L({ id: 'ut2-raw', name: 'Riff raw uptempo II', style: 'uptempo', type: 'melodía', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ['raw', 'riff', kit('uptempo II')], render: u2Raw,
    notes: 'Riff corto de cuadrada y sierra muy saturadas.' }),
  L({ id: 'ut2-chords', name: 'Acordes cortados uptempo II', style: 'uptempo', type: 'acordes', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ['supersierra', 'gate', kit('uptempo II')], render: u2Chords,
    notes: 'Rem y Si♭ en supersierra, cortados en un ritmo de 3 + 3 + 2.' }),

  L({ id: 'hs2-lead', name: 'Lead hardstyle II', style: 'hardstyle', type: 'melodía', tonality: 'Sol menor', bpm: [150, 150], bars: 4, tags: ['lead', 'supersierra', 'eufórico', kit('hardstyle II')], render: s2Lead,
    notes: 'Melodía eufórica sobre Solm – Mi♭ – Si♭ – Fa: supersierra ancha con su octava, empujada por el «sidechain».' }),
  L({ id: 'hs2-arp', name: 'Arpegio hardstyle II', style: 'hardstyle', type: 'arpegio', tonality: 'Sol menor', bpm: [150, 150], bars: 4, tags: ['arpegio', 'pluck', kit('hardstyle II')], render: s2Arp,
    notes: 'Pluck en semicorcheas con eco a corchea con puntillo.' }),
  L({ id: 'hs2-reverse-bass', name: 'Bajo inverso hardstyle II', style: 'hardstyle', type: 'línea', tonality: 'Sol menor', bpm: [150, 150], bars: 4, tags: ['reverse bass', 'bajo', kit('hardstyle II')], render: s2RevBass,
    notes: 'Bajo inverso en cada tiempo: Sol – Mi♭ – Si♭ – Fa, se corta justo antes del kick.' }),
  L({ id: 'hs2-pad', name: 'Pad hardstyle II', style: 'hardstyle', type: 'acordes', tonality: 'Sol menor', bpm: [150, 150], bars: 4, tags: ['pad', 'supersierra', 'sidechain', kit('hardstyle II')], render: s2Pad,
    notes: 'Acordes sostenidos de supersierra, bombeando en cada tiempo.' }),

  L({ id: 'hh-lead', name: 'Lead happy hardcore', style: 'hardcore', type: 'melodía', tonality: 'Re mayor', bpm: [175, 175], bars: 4, tags: ['happy hardcore', 'lead', 'mayor', kit('happy hardcore')], render: hhLead,
    notes: 'Melodía alegre sobre Re – La – Sim – Sol: supersierra brillante con su octava.' }),
  L({ id: 'hh-piano', name: 'Piano happy hardcore', style: 'hardcore', type: 'acordes', tonality: 'Re mayor', bpm: [175, 175], bars: 4, tags: ['happy hardcore', 'piano', kit('happy hardcore')], render: hhPiano,
    notes: 'Acordes de piano a contratiempo.' }),
  L({ id: 'hh-bell', name: 'Campanas happy hardcore', style: 'hardcore', type: 'arpegio', tonality: 'Re mayor', bpm: [175, 175], bars: 4, tags: ['happy hardcore', 'campana', 'arpegio', kit('happy hardcore')], render: hhBell,
    notes: 'Arpegio de campanas en semicorcheas.' }),

  L({ id: 'tr2-lead', name: 'Lead hard trance II', style: 'trance', type: 'melodía', tonality: 'Re menor', bpm: [140, 140], bars: 4, tags: ['lead', 'supersierra', 'notas largas', kit('hard trance II')], render: t2Lead,
    notes: 'Notas largas sobre Rem – Si♭ – Fa – Do: supersierra suave, con «sidechain», sala y eco.' }),
  L({ id: 'tr2-arp', name: 'Arpegio hard trance II', style: 'trance', type: 'arpegio', tonality: 'Re menor', bpm: [140, 140], bars: 4, tags: ['arpegio', 'pluck', 'tresillo', kit('hard trance II')], render: t2Arp,
    notes: 'Pluck que recorre tres notas en semicorcheas (cruza el compás) y baja al final.' }),
  L({ id: 'tr2-bass', name: 'Bajo rodante hard trance II', style: 'trance', type: 'línea', tonality: 'Re menor', bpm: [140, 140], bars: 4, tags: ['bajo', 'rodante', kit('hard trance II')], render: t2Bass,
    notes: 'Bajo en las tres semicorcheas de después de cada tiempo: Re – Si♭ – Fa – Do.' })
];

/* partituras de las melodías (para comprobar que cada nota suena a la altura escrita) */
export const SCORES = {
  'mk2-lead': [M2.bpm, M2_LEAD], 'mk3-hoover': [M3.bpm, M3_HOOVER], 'hc2-lead': [C2.bpm, C2_LEAD], 'ns2-lead': [N2.bpm, N2_LEAD],
  'ut2-screech': [U2.bpm, U2_SCREECH], 'ut2-raw': [U2.bpm, U2_RAW], 'hs2-lead': [S2.bpm, S2_LEAD], 'hh-lead': [HH.bpm, HH_LEAD], 'tr2-lead': [T2.bpm, T2_LEAD]
};
