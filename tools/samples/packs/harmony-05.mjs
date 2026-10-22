/* HARMONY 05 · Escuelas del hardcore y del newstyle
   Sonidos agrupados por escuela, cada una con su tempo y su tonalidad para que todo encaje entre sí (y en los presets
   de banco de js/data/presets.js). Son recreaciones de los rasgos de cada estilo (tempo, tipo de kick, distorsión,
   timbre), no de los temas de nadie: ni melodías ni sonidos ajenos.
     Rotterdam / early     175 BPM · Re menor   · 909 llevado a la saturación, hoovers, sirenas
     Hardcore italiano     172 BPM · Fa# menor  · kick con cola larga afinada, coros, leads épicos
     Mainstream oscuro     178 BPM · Mi menor   · kick largo y muy distorsionado con chillido, campanas, drones
     Mainstream melódico   174 BPM · La menor   · cola tonal, leads eufóricos, piano y coros
     Raw / uptempo         205 BPM · Re menor   · distorsión extrema, kicks que cambian de tono, melodías de kicks
     Newstyle              150 BPM · La menor   · kick seco y corto, bajo a contratiempo, palma con sala (los pitidos, aparte) */
import * as D from '../dsp.mjs';
import { labKick as LK } from '../kicklib.mjs';
import * as S from '../synth.mjs';
import * as V from '../voice.mjs';

export const PACK = {
  id: 'harmony-05',
  name: 'Harmony 05',
  title: 'Escuelas del hardcore y del newstyle',
  version: '1.0.0',
  date: '2026-10-18',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis y procesado digital en tools/samples/ (Harmony), con melodías compuestas para Harmony. Sin grabaciones, sin samples de terceros y sin melodías de nadie.',
  credits: 'Harmony'
};

/* ---------------------------------------------------------------- piezas comunes */

const beat = (bpm) => 60 / bpm;
const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));
/* cuerpo de kick: seno con doble caída de tono (clic → cuerpo → cola) y una deriva final opcional (bend, semitonos) */
function body({ f0 = 2600, mid = 190, f1 = 55, tau = 0.0035, tau2 = 0.045, len = 0.6, amp, bend = 0, bendStart = 0.08 }) {
  const f = (t) => {
    const b = t > bendStart ? Math.pow(2, (bend * Math.min(1, (t - bendStart) / (len - bendStart))) / 12) : 1;
    return (f1 + (mid - f1) * Math.exp(-t / tau2) + (f0 - mid) * Math.exp(-t / tau)) * b;
  };
  return D.osc(len, f, { amp: amp || D.ahd(0.0006, 0.1, 0.16) });
}
function click(seed, { f = 4500, q = 0.9, tau = 0.0025, tok = 1600, tokTau = 0.003, nGain = 0.7, tGain = 0.8 } = {}) {
  const n = D.env(D.bp(D.noise(0.03, seed), f, q), D.expEnv(tau));
  const t = D.osc(0.03, D.sweep(tok * 1.6, tok, 0.002), { amp: D.expEnv(tokTau) });
  return D.mix([n, nGain], [t, tGain]);
}
function finish(x, { tailDb = -66, peak = -1, release = 0 } = {}) {
  let y = D.dcBlock(x);
  if (release) y = D.fadeEnd(y, release);
  y = D.fades(D.trimTail(y, tailDb));
  y = D.limit(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function finishSt(s, { tailDb = -66, peak = -1 } = {}) {
  s = D.same(s.L ? s : D.stereo(s, Float64Array.from(s)));
  const L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0008, 0.02), D.fades(R0.slice(0, n), 0.0008, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
const room = (x, size = 0.8, tail = 1.4, damp = 0.45) => D.reverb(x.L ? mono(x) : x, { size, damp, tail, pre: 0.012 });
/* bucle de compases exactos: tocado dos veces y quedándose la segunda vuelta (lleva dentro las colas de la primera) */
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
const wide = (notes, o, voice) => D.same(D.stereo(S.play(notes, { ...o, voice: voice(1) }), S.play(notes, { ...o, voice: voice(2) })));
const steps = (bars) => bars * 16;
const hits = (chords, at, len = 1, vel = 1) => chords.flatMap((c, b) => at.map((s, k) => [b * 16 + s, len, c, Array.isArray(vel) ? vel[k % vel.length] : vel]));
function arp(chords, order, { vel = [1, 0.75], len = 1 } = {}) {
  const out = [];
  chords.forEach((tones, b) => order.forEach((k, j) => out.push([b * 16 + j, len, tones[k % tones.length], vel[j % vel.length]])));
  return out;
}
/* palma: ráfagas de ruido separadas unos ms, con su cola */
function clapCore(seed, { f = 1300, q = 1.1, bursts = 4, gap = 0.009, tail = 0.12 } = {}) {
  const parts = [];
  for (let k = 0; k < bursts; k++) parts.push([D.env(D.bp(D.noise(0.03, seed + k), f, q), D.expEnv(0.004)), k === bursts - 1 ? 1 : 0.7, k * gap]);
  parts.push([D.env(D.bp(D.noise(tail * 6, seed + 9), f * 0.9, 0.8), D.expEnv(tail)), 0.6, bursts * gap]);
  return D.mix(...parts);
}
/* charles metálico: osciladores cuadrados inarmónicos más ruido, por encima de `hp` */
function metal(dur, seed, { hp = 7000, tau = 0.05 } = {}) {
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.9);
  const m = D.mix(...fr.map((f, k) => [D.osc(dur, f, { shape: 'square', phase: (k * 0.17) % 1 }), 0.18]), [D.noise(dur, seed), 0.5]);
  return D.env(D.hp(D.hp(m, hp), hp), D.expEnv(tau));
}

/* ================================================================= ROTTERDAM / EARLY · 175 BPM · Re menor */
const RT = { bpm: 175 };
function rtHoover() {
  // hoover de alarma (La 3): cae siete semitonos al entrar y vuelve, pulsos con ancho modulado y sierras
  const f = D.note('A', 3), L = 1.7;
  const fr = (m) => (t) => f * m * Math.pow(2, (-7 * Math.exp(-t / 0.06)) / 12) * (1 + 0.004 * Math.sin(2 * Math.PI * 6 * t));
  const pwm = (t) => 0.5 + 0.38 * Math.sin(2 * Math.PI * 4.5 * t);
  const side = (det, ph) => D.mix([D.osc(L, fr(Math.pow(2, det / 1200)), { shape: 'pulse', pw: pwm, phase: ph }), 0.45], [D.osc(L, fr(Math.pow(2, -det / 1200)), { shape: 'saw', phase: ph * 0.5 }), 0.35], [D.osc(L, fr(0.5), { shape: 'pulse', pw: (t) => 1 - pwm(t), phase: ph * 0.2 }), 0.45]);
  const shape = (x) => D.env(D.drive(D.lp(x, 3000, 1), 1.8), D.ahd(0.003, 0.5, 0.3));
  const st = D.stereo(shape(side(18, 0.13)), shape(side(-21, 0.71)));
  return finishSt(D.mixSt([st, 1], [room(st, 0.75, 0.9), 0.14]));
}
function rtStab() {
  // stab de rave en Re menor con séptima (Re 4, Fa 4, La 4, Do 5): órgano y sierras, golpe corto
  const notes = ['D4', 'F4', 'A4', 'C5'].map(S.freq), L = 0.5;
  const one = (f, k) => D.mix([S.organ(f, 0.18, 1, { decay: 0.25 }), 0.6], [D.env(D.lp(D.osc(L, f * 1.004, { shape: 'saw', phase: k * 0.21 }), 3200), D.ahd(0.002, 0.08, 0.12)), 0.35]);
  const x = sat(D.mix(...notes.map((f, k) => [one(f, k), 0.4])), 1.4);
  return finishSt(D.mixSt([D.widen(x, 0.35, 5), 1], [room(x, 0.8, 1.1), 0.18]));
}
function rtClap() {
  // palma 909 saturada con una sala corta
  let x = clapCore(53, { f: 1200, q: 1.0, tail: 0.1 });
  x = D.drive(D.eq(x, 1800, 4, 1), 2.4);
  return finishSt(D.mixSt([D.widen(x, 0.25, 2), 1], [room(x, 0.6, 0.6, 0.5), 0.22]));
}
function rtHat() {
  // charles abierto a contratiempo, metálico y un poco sucio
  const x = D.drive(metal(0.35, 54, { hp: 6500, tau: 0.09 }), 1.6);
  return finishSt(D.widen(x, 0.4, 7));
}
function rtRiff() {
  // riff de hoover de 2 compases a 175 BPM en Re menor (Re – Re – Fa – Mi / Do – Re)
  return loop(RT.bpm, 2, (cycles) => {
    const notes = [[0, 2, 'D4'], [3, 1, 'D4'], [4, 2, 'D4'], [6, 2, 'F4'], [8, 2, 'E4'], [11, 1, 'D4'], [12, 4, 'A3'],
      [16, 2, 'D4'], [19, 1, 'D4'], [20, 2, 'F4'], [22, 2, 'G4'], [24, 2, 'F4'], [27, 1, 'E4'], [28, 4, 'C4']];
    const x = wide(notes, { bpm: RT.bpm, steps: steps(2), cycles, gateScale: 0.85 }, (seed) => (f, g, v) => S.hoover(f, g, v, { seed: seed + 51, bend: 2, bendTau: 0.015 }));
    return D.mixSt([x, 1], [room(x, 0.75, 0.9), 0.15]);
  });
}
function rtSiren() {
  // sirena que sube: dos sierras que barren de 500 Hz a 2 kHz en dos tiempos (175 BPM), con eco
  const L = beat(175) * 2;
  const f = (t) => 500 * Math.pow(4, Math.pow(t / L, 1.3));
  let x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.5], [D.osc(L, (t) => f(t) * 1.01, { shape: 'square' }), 0.35]);
  x = D.env(D.drive(D.lp(x, 3500), 1.6), D.ahd(0.03, L - 0.12, 0.05));
  const d = beat(175) * 0.75;
  return finishSt(D.mixSt([x, 1], [D.stereo(D.mix([x, 0.3, d]), D.mix([x, 0.3, d * 2])), 1]));
}

/* ================================================================= HARDCORE ITALIANO · 172 BPM · Fa# menor */
const IT = { bpm: 172 };
function itTailKick(note, seed, { bend = -0.6, len = 0.9, cutoff = [6500, 1300] } = {}) {
  // golpe con mucho ataque y cola larga afinada que se va cerrando: la cola canta la nota
  const punch = D.drive(body({ f0: 3200, mid: 260, f1: 64, tau: 0.0028, tau2: 0.028, len: 0.15, amp: D.ahd(0.0005, 0.03, 0.035) }), 2.4);
  const n = D.note(note[0], note[1]);
  let tail = body({ f0: 1000, mid: n * 2, f1: n, tau: 0.004, tau2: 0.035, len, amp: D.ahd(0.018, len * 0.42, len * 0.22), bend, bendStart: len * 0.55 });
  tail = D.fold(D.gain(tail, 1.6), 1); tail = D.drive(tail, 5.5);
  tail = D.filter(tail, 'lp', D.ramp(cutoff[0], cutoff[1], len, 0.55), { q: 1.6 });
  tail = D.env(tail, (t) => (t < 0.035 ? t / 0.035 : 1));
  let x = D.mix([punch, 0.95], [click(seed, { f: 5400, tok: 2100 }), 0.32], [tail, 0.8, 0.03]);
  x = D.eq(x, 95, 2.5, 0.8); x = D.hp(x, 30);
  return finish(x, { release: 0.3 });
}
function itChoir() {
  // golpe de coro en Fa# menor (Fa# 3, La 3, Do# 4, Fa# 4) con la reverb cortada: el coro épico del hardcore italiano
  const L = 0.9, amp = D.ahd(0.01, 0.42, 0.18);
  const lo = V.choir(L, [S.freq('F#3')], { reg: 'tenor', vowel: 'a', voices: 3, seed: 61, amp });
  const hi = V.choir(L, ['A3', 'C#4', 'F#4'].map(S.freq), { reg: 'soprano', vowel: 'a', voices: 3, seed: 63, amp });
  const dry = D.applySt(D.mixSt([lo, 0.9], [hi, 0.75]), (c) => D.shelf(D.eq(c, 3200, 3, 0.8), 'highshelf', 5000, 6));
  const wet = D.applySt(D.reverb(mono(dry), { size: 0.86, damp: 0.5, tail: 1.2 }), (c) => D.gate(c, 0.75, 0.05));
  return finishSt(D.mixSt([dry, 1], [wet, 0.4]));
}
const IT_LEAD = [
  [0, 4, 'C#5'], [4, 2, 'F#5'], [6, 2, 'A5'], [8, 4, 'G#5'], [12, 2, 'F#5'], [14, 2, 'E5'],
  [16, 4, 'F#5'], [20, 2, 'D5'], [22, 2, 'A4'], [24, 4, 'D5'], [28, 4, 'E5'],
  [32, 4, 'E5'], [36, 2, 'G#5'], [38, 2, 'B5'], [40, 4, 'A5'], [44, 2, 'G#5'], [46, 2, 'E5'],
  [48, 6, 'F5'], [54, 2, 'G#5'], [56, 8, 'C#6']
];
function itLead() {
  // lead épico de 4 compases sobre Fa#m – Re – Mi – Do#: supersierra y hoover juntos, sala grande
  return loop(IT.bpm, 4, (cycles) => {
    const o = { bpm: IT.bpm, steps: steps(4), cycles, gateScale: 0.92 };
    const saw = wide(IT_LEAD, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 64, spread: 26, cutoff: 5800, drive: 1.6, env: { r: 0.1 } }));
    const hv = S.play(IT_LEAD, { ...o, voice: (f, g, v) => S.hoover(f / 2, g, v, { seed: 65, bend: 1, bendTau: 0.02 }) });
    const dry = D.mixSt([saw, 1], [hv, 0.3]);
    return D.mixSt([D.applySt(dry, (c) => S.pump(c, IT.bpm, { depth: 0.3 })), 1], [room(dry, 0.85, 1.6), 0.24], [S.pingpong(mono(dry), IT.bpm, { div: 0.75, n: 3, gain: 0.16 }), 1]);
  });
}
function itStrings() {
  // pad de cuerdas oscuro en Fa# menor: sierras desafinadas con ataque lento
  const L = 3.2, notes = ['F#3', 'A3', 'C#4', 'F#4'].map(S.freq);
  const side = (seed) => D.mix(...notes.map((f) => [S.supersaw(f, L - 0.8, 0.8, { seed: seed + Math.round(f), n: 5, spread: 18, cutoff: 2600, env: { a: 0.6, d: 0.3, s: 0.9, r: 0.8 } }), 0.4]));
  const st = D.same(D.stereo(side(1), side(2)));
  return finishSt(D.mixSt([st, 1], [room(st, 0.88, 2), 0.3]));
}
function itRoll() {
  const s = beat(172) / 4, at = [];
  for (let t = 0; t < 8 * s - 1e-9; t += 2 * s) at.push(t);
  for (let t = 8 * s; t < 12 * s - 1e-9; t += s) at.push(t);
  for (let t = 12 * s; t < 16 * s - 1e-9; t += s / 2) at.push(t);
  const hit = (t, k) => D.mix([D.env(D.hp(D.noise(0.12, 600 + k), 1500), D.expEnv(0.035)), 0.8], [D.osc(0.08, 210 * Math.pow(2, (t / (s * 16)) * 0.6), { amp: D.expEnv(0.03) }), 0.5]);
  const x = sat(D.mix(...at.map((t, k) => [hit(t, k), 0.5 + 0.5 * (t / (16 * s)), t])), 1.6);
  return finishSt(D.mixSt([D.widen(x, 0.2, 4), 1], [room(x, 0.7, 0.8), 0.18]));
}
function itReverse() {
  // entrada inversa: la cola del kick italiano al revés, creciendo hasta el golpe
  const k = itTailKick(['F#', 1], 66);
  const wet = D.reverb(k, { size: 0.9, damp: 0.4, tail: 1.6 });
  const r = (c) => D.reverse(D.trimTail(D.mix([c, 1], [k, 0.6]), -54));
  return finishSt(D.applySt(wet, (c) => D.fades(r(c), 0.02, 0.004)));
}

/* ================================================================= MAINSTREAM OSCURO · 178 BPM · Mi menor */
const MO = { bpm: 178 };
function moScreech() {
  // chillido: sierra por un paso banda muy resonante que sube y baja, saturada, con eco
  const L = 1.1, f = 330;
  let x = D.osc(L, (t) => f * (1 + 0.02 * Math.sin(2 * Math.PI * 7 * t)), { shape: 'saw' });
  x = D.filter(x, 'bp', (t) => 900 + 2600 * Math.sin(Math.PI * Math.min(1, t / L)) ** 2, { q: 14 });
  x = D.env(D.drive(x, 5), D.ahd(0.02, 0.8, 0.15));
  const d = beat(178) * 0.75;
  return finishSt(D.mixSt([D.widen(x, 0.3, 3), 1], [D.stereo(D.mix([D.lp(x, 2500), 0.3, d]), D.mix([D.lp(x, 2000), 0.25, d * 2])), 1]));
}
function moBell() {
  // campana de terror en Mi 3: FM grave e inarmónica, sala larga
  const x = D.mix([S.bell(S.freq('E3'), 0.6, 1, { ratio: 2.76, index: 6, decay: 2.2 }), 1], [S.bell(S.freq('E2'), 0.6, 0.6, { ratio: 1.41, index: 3, decay: 1.9 }), 0.5]);
  return finishSt(D.mixSt([D.widen(x, 0.3, 6), 1], [room(x, 0.9, 2.6, 0.55), 0.35]));
}
function moDrone() {
  // drone oscuro en Mi: sierras desafinadas en Mi 1, Mi 2 y Si 2, filtro que respira despacio
  const L = 5;
  const one = (seed) => {
    const r = D.rng(seed);
    const x = D.mix(...[['E1', 0.5], ['E2', 0.45], ['B2', 0.3], ['E3', 0.15]].flatMap(([n, g]) => [-9, 7].map((c) => [D.osc(L, S.freq(n) * Math.pow(2, c / 1200), { shape: 'saw', phase: r() }), g * 0.5])));
    return D.env(D.filter(x, 'lp', (t) => 500 + 900 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / L)), { q: 3 }), D.ahd(0.8, 2.4, 0.4));
  };
  const st = D.same(D.stereo(sat(one(71), 1.6), sat(one(72), 1.6)));
  return finishSt(D.mixSt([st, 1], [room(st, 0.85, 1.8, 0.6), 0.25]));
}
function moImpact() {
  // impacto oscuro: sub que cae, golpe metálico y ruido que se cierra
  const sub = D.osc(2.8, D.sweep(85, 30, 0.35), { amp: D.ahd(0.002, 0.2, 0.5) });
  const hit = D.env(D.bp(D.mix([D.osc(0.6, 173, { shape: 'square' }), 0.5], [D.osc(0.6, 271, { shape: 'square' }), 0.5], [D.noise(0.6, 73), 0.8]), 1300, 2), D.expEnv(0.12));
  const air = D.env(D.filter(D.noise(1.4, 74), 'lp', D.ramp(9000, 300, 1.2, 0.5)), D.ahd(0.001, 0.05, 0.4));
  const x = sat(D.mix([sub, 1], [hit, 0.5], [air, 0.35]), 1.8);
  return finishSt(D.mixSt([D.widen(x, 0.3, 4), 1], [room(x, 0.9, 2.2, 0.6), 0.3]));
}
function moLead() {
  // riff oscuro de 2 compases a 178 BPM en Mi frigio (el Fa natural es lo que lo oscurece)
  return loop(MO.bpm, 2, (cycles) => {
    const notes = [[0, 2, 'E4'], [2, 1, 'E4'], [3, 1, 'F4'], [4, 2, 'E4'], [6, 2, 'G4'], [8, 3, 'F4'], [11, 3, 'E4'], [14, 2, 'B3'],
      [16, 2, 'E4'], [18, 1, 'E4'], [19, 1, 'F4'], [20, 2, 'E4'], [22, 2, 'A4'], [24, 3, 'G4'], [27, 3, 'F4'], [30, 2, 'D4']];
    const x = wide(notes, { bpm: MO.bpm, steps: steps(2), cycles, gateScale: 0.85 }, (seed) => (f, g, v) => D.mix([S.rawLead(f, g, v, { drive: 7, center: 1100 }), 0.6], [S.supersaw(f / 2, g, v, { seed: seed + 75, n: 5, spread: 30, cutoff: 3200, drive: 2 }), 0.6]));
    return D.mixSt([x, 1], [room(x, 0.82, 1.3, 0.55), 0.2]);
  });
}
function moPerc() {
  // golpe industrial: metal grave y ruido, saturado, con una sala corta y oscura
  const m = D.mix([D.osc(0.4, 147, { shape: 'square' }), 0.4], [D.osc(0.4, 233, { shape: 'square' }), 0.4], [D.osc(0.4, 389, { shape: 'square' }), 0.3], [D.noise(0.4, 76), 0.7]);
  const x = D.drive(D.env(D.bp(m, 1100, 1.6), D.expEnv(0.06)), 3);
  return finishSt(D.mixSt([D.widen(x, 0.3, 5), 1], [room(x, 0.6, 0.6, 0.6), 0.25]));
}

/* ================================================================= MAINSTREAM MELÓDICO · 174 BPM · La menor */
const MM = { bpm: 174 };
const MM_CH = [['A4', 'C5', 'E5'], ['A4', 'C5', 'F5'], ['G4', 'C5', 'E5'], ['G4', 'B4', 'D5']];
const MM_LEAD = [
  [0, 2, 'E5'], [2, 2, 'A5'], [4, 2, 'C6'], [6, 2, 'B5'], [8, 4, 'A5'], [12, 2, 'E5'], [14, 2, 'G5'],
  [16, 2, 'F5'], [18, 2, 'A5'], [20, 2, 'C6'], [22, 2, 'A5'], [24, 4, 'F5'], [28, 4, 'E5'],
  [32, 2, 'E5'], [34, 2, 'G5'], [36, 2, 'C6'], [38, 2, 'B5'], [40, 4, 'G5'], [44, 2, 'E5'], [46, 2, 'G5'],
  [48, 4, 'B5'], [52, 2, 'A5'], [54, 2, 'G5'], [56, 8, 'D5']
];
function mmLead() {
  // lead eufórico sobre Lam – Fa – Do – Sol: supersierra brillante con su octava, «sidechain» y eco
  return loop(MM.bpm, 4, (cycles) => {
    const o = { bpm: MM.bpm, steps: steps(4), cycles, gateScale: 0.92 };
    const lead = wide(MM_LEAD, o, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 84, spread: 24, cutoff: 7200, drive: 1.3, env: { r: 0.1 } }));
    const up = S.play(MM_LEAD, { ...o, voice: (f, g, v) => S.supersaw(f * 2, g, v, { seed: 85, n: 3, spread: 12, cutoff: 9000, env: { r: 0.06 } }) });
    const dry = D.mixSt([lead, 1], [up, 0.25]);
    return D.mixSt([D.applySt(dry, (c) => S.pump(c, MM.bpm, { depth: 0.35 })), 1], [room(dry, 0.85, 1.5), 0.22], [S.pingpong(mono(dry), MM.bpm, { div: 0.75, n: 3, gain: 0.18 }), 1]);
  });
}
function mmPiano() {
  // piano del break: acordes largos y la melodía arriba
  return loop(MM.bpm, 4, (cycles) => {
    const chords = MM_CH.map((c, b) => [b * 16, 14, c, 0.75]);
    const mel = MM_LEAD.filter((n, k) => k % 2 === 0).map(([s, l, p]) => [s, l + 2, p, 0.9]);
    const x = S.play([...chords, ...mel], { bpm: MM.bpm, steps: steps(4), cycles, voice: (f, g, v) => S.piano(f, g, v, { decay: 1.4 }) });
    return D.mixSt([D.widen(x, 0.35, 6), 1], [room(x, 0.86, 1.8), 0.28]);
  });
}
function mmChoir() {
  // coro «Aah» en La menor para el break, largo y con sala
  const L = 3.4, amp = (t) => (t < 0.5 ? Math.sin((t / 0.5) * Math.PI / 2) : t < 2.4 ? 1 : Math.max(0, Math.cos(((t - 2.4) / 1) * Math.PI / 2)));
  const lo = V.choir(L, [S.freq('A3')], { reg: 'tenor', vowel: 'a', voices: 3, seed: 86, amp });
  const hi = V.choir(L, ['C4', 'E4', 'A4'].map(S.freq), { reg: 'soprano', vowel: 'a', voices: 3, seed: 87, amp });
  const st = D.applySt(D.mixSt([lo, 0.9], [hi, 0.75]), (c) => D.shelf(D.eq(c, 3200, 3, 0.8), 'highshelf', 5000, 6));
  return finishSt(D.mixSt([st, 1], [room(st, 0.88, 2.2), 0.35]));
}
function mmArp() {
  return loop(MM.bpm, 4, (cycles) => {
    const tones = MM_CH.map((c) => [...c, S.midi(c[0]) + 12]);
    const x = S.play(arp(tones, [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2]), { bpm: MM.bpm, steps: steps(4), cycles, voice: (f, g, v) => S.pluck(f, g, v, { decay: 0.14, bright: 6000, q: 3 }) });
    return D.mixSt([D.widen(x, 0.3, 5), 1], [S.pingpong(x, MM.bpm, { div: 0.75, n: 3, gain: 0.26 }), 1], [room(x, 0.8, 1.1), 0.12]);
  });
}

/* ================================================================= RAW / UPTEMPO · 205 BPM · Re menor */
const RW = { bpm: 205 };
function rawKick(note, seed, { len = 0.3, fold = 3, bend = 0, noise = 0 } = {}) {
  const f1 = D.note(note[0], note[1]);
  const b = body({ f0: 3400, mid: 300, f1, tau: 0.0022, tau2: 0.025, len, amp: D.ahd(0.0005, len * 0.45, len * 0.25), bend, bendStart: 0.04 });
  let x = D.mix([b, 1], [click(seed, { f: 5200, tok: 2400 }), 0.45]);
  if (noise) x = D.mix([x, 1], [D.env(D.bp(D.noise(len, seed + 3), 2500, 0.7), D.ahd(0.001, 0.05, 0.03)), noise]);
  x = D.fold(x, fold); x = D.clip(x, 3, 0.92); x = D.drive(x, 4);
  x = D.eq(x, 1300, -4, 1.2); x = D.lp(x, 8500); x = D.hp(x, 40);
  return x;
}
const rwKick = () => finish(rawKick(['D', 2], 91), { release: 0.08 });
const rwKickBend = () => finish(rawKick(['D', 2], 92, { len: 0.36, bend: 5 }), { release: 0.08 });
const rwKickNoise = () => finish(rawKick(['C', 2], 93, { len: 0.32, noise: 0.4, fold: 3.2 }), { release: 0.08 });
function rwScream() {
  // grito de ruido: ruido rosa por un banco de pasos banda que barre, plegado y saturado
  const L = 0.9;
  let x = D.noise(L, 94, 'pink');
  x = D.mix([D.filter(x, 'bp', D.ramp(600, 3200, L, 0.6), { q: 6 }), 1], [D.filter(x, 'bp', D.ramp(1200, 5200, L, 0.6), { q: 6 }), 0.7]);
  x = D.env(D.drive(D.fold(D.gain(x, 6), 2), 3), D.ahd(0.02, 0.6, 0.2));
  return finishSt(D.mixSt([D.widen(x, 0.5, 9), 1], [room(x, 0.7, 0.7), 0.2]));
}
function rwRiff() {
  // melodía de kicks (2 compases a 205 BPM): el kick raw tocado a distintas alturas, a contratiempo y en semicorcheas
  return loop(RW.bpm, 2, (cycles) => {
    const notes = [[2, 1, 'D2'], [3, 1, 'D2'], [6, 2, 'F2'], [10, 1, 'D2'], [11, 1, 'E2'], [14, 2, 'A1'],
      [18, 1, 'D2'], [19, 1, 'D2'], [22, 2, 'G2'], [26, 1, 'F2'], [27, 1, 'E2'], [30, 2, 'C2']];
    const voice = (f, g) => { const n = D.hzToNote(f), m = /^([A-G]#?)(-?\d)$/.exec(n); return D.gain(rawKick([m[1], +m[2]], 95, { len: Math.min(0.3, g + 0.05) }), 0.8); };
    const x = S.play(notes, { bpm: RW.bpm, steps: steps(2), cycles, tail: 0.4, voice });
    return x;
  });
}
function rwStab() {
  // golpe de acorde raw en Re menor: sierras y cuadradas plegadas, muy corto
  const notes = ['D3', 'F3', 'A3', 'D4'].map(S.freq), L = 0.35;
  const x = D.mix(...notes.map((f, k) => [D.mix([D.osc(L, f, { shape: 'saw', phase: k * 0.3 }), 0.5], [D.osc(L, f * 1.01, { shape: 'square', phase: k * 0.2 }), 0.4]), 0.35]));
  const y = D.env(D.drive(D.fold(D.lp(x, 4000), 2.4), 3), D.ahd(0.002, 0.1, 0.07));
  return finishSt(D.mixSt([D.widen(y, 0.35, 3), 1], [room(y, 0.6, 0.5), 0.15]));
}

/* ================================================================= NEWSTYLE · 150 BPM · La menor */
const NW = { bpm: 150 };
function nwBass() {
  // bajo de contratiempo (La 1): golpe corto con cuerpo en la «y» del tiempo, a 150 BPM
  const f = D.note('A', 1), L = beat(150) / 2 - 0.01;
  const tone = D.mix([D.osc(L, f), 1], [D.osc(L, f * 2, { shape: 'tri' }), 0.35], [D.osc(L, f, { shape: 'saw' }), 0.25]);
  let x = D.env(tone, D.ahd(0.004, L * 0.35, L * 0.25));
  x = D.filter(x, 'lp', D.ramp(2400, 400, L, 0.6), { q: 1.4 }); x = D.tube(x, 2.6, 0.2); x = D.hp(x, 35);
  return finish(x);
}
function nwClap() {
  // palma de newstyle con sala grande (la que suena en el 2 y el 4)
  const x = D.drive(D.eq(clapCore(103, { f: 1400, q: 1.2, tail: 0.13 }), 2200, 3, 1), 1.8);
  return finishSt(D.mixSt([D.widen(x, 0.3, 2), 1], [room(x, 0.86, 1.6, 0.45), 0.35]));
}
function nwHat() {
  // charles abierto corto para el contratiempo
  return finishSt(D.widen(metal(0.25, 104, { hp: 8000, tau: 0.06 }), 0.35, 4));
}
function nwStab() {
  // golpe de órgano y piano en La menor (La 3, Do 4, Mi 4): el acorde a contratiempo del newstyle
  const x = D.mix(...['A3', 'C4', 'E4'].map((n, k) => [D.mix([S.organ(S.freq(n), 0.12, 1, { decay: 0.2 }), 0.6], [S.piano(S.freq(n), 0.15, 0.8, { decay: 0.35 }), 0.5]), 0.45]));
  return finishSt(D.mixSt([D.widen(D.drive(x, 1.3), 0.3, 6), 1], [room(x, 0.8, 1.0), 0.2]));
}
function nwBassLoop() {
  // bajo a contratiempo de 4 compases: La – Fa – Sol – Mi
  return loop(NW.bpm, 4, (cycles) => {
    const notes = hits(['A1', 'F1', 'G1', 'E1'], [2, 6, 10, 14], 2);
    const o = { bpm: NW.bpm, steps: steps(4), cycles, tail: 0.3 };
    const top = S.play(notes, { ...o, voice: (f, g, v) => S.pluck(f, g * 0.8, v, { decay: 0.09, bright: 2200, low: 180, q: 2.5 }) });
    const low = S.play(notes, { ...o, voice: (f, g, v) => S.sub(f, g * 0.8, v) });
    return sat(D.mix([top, 0.8, 0, 0.001], [low, 0.7, 0, 0.001]), 1.3);
  });
}

/* partituras de las melodías, para el test de afinación (cada nota tiene que sonar a la altura escrita) */
export const SCORES = { 'it-lead': [IT.bpm, IT_LEAD], 'mm-lead': [MM.bpm, MM_LEAD] };

/* ---------------------------------------------------------------- catálogo del pack */

const K = (o) => ({ cat: 'kick', type: 'kick', ...o });
const L = (o) => ({ cat: 'loop', loop: true, ...o });
const sch = (s) => 'escuela ' + s;
export const SAMPLES = [
  // Rotterdam / early
  K({ id: 'rt-kick-fuzz', name: 'Kick gabber zumbón', style: 'hardcore', key: 'D1', bpm: [170, 190], tags: ['gabber', '909', 'rotterdam', 'saturado', sch('rotterdam')], ...LK('harmony-05/rt-kick-fuzz'),
    notes: 'El 909 saturado hasta que zumba, en Re 1: cuadrada en la fuente, medios muy realzados (la «bocina» del gabber de los 90), grano y recorte final casi cuadrado.' }),
  K({ id: 'rt-kick-thump', name: 'Kick early gordo', style: 'hardcore', key: 'A1', bpm: [160, 180], tags: ['early', '909', 'corto', sch('rotterdam')], ...LK('harmony-05/rt-kick-thump'),
    notes: 'Golpe gordo y corto en La 1, con mucho punch y menos zumbido: para el early hardcore de 160–180 BPM.' }),
  { id: 'rt-hoover-alarm', name: 'Hoover de alarma', style: 'hardcore', type: 'sintetizador', cat: 'fx', key: 'A3', tags: ['hoover', 'rave', 'caída de tono', sch('rotterdam')], render: rtHoover,
    notes: 'Hoover en La 3 que entra siete semitonos abajo y sube: pulsos con ancho modulado y sierras desafinadas.' },
  { id: 'rt-stab-rave', name: 'Stab de rave (Re m7)', style: 'hardcore', type: 'stab', cat: 'fx', key: 'D4', tags: ['stab', 'órgano', 'rave', sch('rotterdam')], render: rtStab,
    notes: 'Acorde de Re menor con séptima en órgano y sierras, corto y algo saturado.' },
  { id: 'rt-clap-909', name: 'Palma 909 saturada', style: 'hardcore', type: 'palma', cat: 'perc', tags: ['clap', '909', sch('rotterdam')], render: rtClap,
    notes: 'Cuatro ráfagas de ruido a 1,2 kHz, saturadas, con sala corta.' },
  { id: 'rt-hat-open', name: 'Charles abierto sucio', style: 'hardcore', type: 'charles', cat: 'perc', tags: ['hi-hat', 'abierto', sch('rotterdam')], render: rtHat,
    notes: 'Metal inarmónico y ruido por encima de 6,5 kHz con 90 ms de caída, un poco saturado.' },
  L({ id: 'rt-riff', name: 'Riff hoover Rotterdam', style: 'hardcore', type: 'melodía', tonality: 'Re menor', bpm: [175, 175], bars: 2, tags: ['hoover', 'riff', sch('rotterdam')], render: rtRiff,
    notes: 'Riff de hoover de 2 compases a 175 BPM en Re menor, con la caída de tono corta para que no se coma las semicorcheas.' }),
  { id: 'rt-siren-up', name: 'Sirena que sube', style: 'hardcore', type: 'efecto', cat: 'fx', bpm: [175, 175], tags: ['sirena', 'subida', sch('rotterdam')], render: rtSiren,
    notes: 'Sierra y cuadrada que barren de 500 Hz a 2 kHz en dos tiempos a 175 BPM, con eco.' },

  // Hardcore italiano
  K({ id: 'it-kick-tail', name: 'Kick italiano con cola', style: 'hardcore', key: 'F#1', bpm: [165, 180], tags: ['italiano', 'cola larga', 'afinado', sch('italiana')], ...LK('harmony-05/it-kick-tail'),
    notes: 'Golpe con mucho ataque y una cola larga en Fa# 1, plegada y con grano, que se va cerrando hasta apagarse.' }),
  K({ id: 'it-kick-high', name: 'Kick italiano agudo', style: 'hardcore', key: 'A1', bpm: [165, 180], tags: ['italiano', 'cola', sch('italiana')], ...LK('harmony-05/it-kick-high'),
    notes: 'La misma escuela en La 1, con la cola más corta y brillante.' }),
  { id: 'it-choir-stab', name: 'Golpe de coro épico', style: 'hardcore', type: 'coro', cat: 'voz', key: 'F#3', tags: ['coro', 'épico', 'Fa# menor', sch('italiana')], render: itChoir,
    notes: 'Coro sintético (tenores y sopranos, por formantes) en Fa# menor con la reverb cortada en seco.' },
  L({ id: 'it-lead', name: 'Lead épico italiano', style: 'hardcore', type: 'melodía', tonality: 'Fa# menor', bpm: [172, 172], bars: 4, tags: ['lead', 'épico', 'supersierra', sch('italiana')], render: itLead,
    notes: 'Melodía de 4 compases sobre Fa#m – Re – Mi – Do#: supersierra con un hoover una octava abajo, sala grande y eco.' }),
  { id: 'it-strings', name: 'Cuerdas oscuras (Fa# m)', style: 'hardcore', type: 'acordes', cat: 'fx', key: 'F#3', tags: ['pad', 'cuerdas', sch('italiana')], render: itStrings,
    notes: 'Pad de sierras desafinadas en Fa# menor con ataque lento y sala larga.' },
  { id: 'it-roll', name: 'Redoble italiano', style: 'hardcore', type: 'redoble', cat: 'perc', bpm: [172, 172], tags: ['fill', 'redoble', 'subida', sch('italiana')], render: itRoll,
    notes: 'Un compás a 172 BPM: corcheas, semicorcheas y fusas, subiendo de volumen y de tono.' },
  { id: 'it-reverse', name: 'Kick al revés', style: 'hardcore', type: 'transición', cat: 'fx', tags: ['reverse', 'entrada', sch('italiana')], render: itReverse,
    notes: 'La cola del kick italiano con su reverb, al revés: crece hasta el golpe.' },

  // Mainstream oscuro
  K({ id: 'mo-kick-screech', name: 'Kick oscuro con chillido', style: 'hardcore', key: 'E1', bpm: [175, 185], tags: ['mainstream', 'oscuro', 'screech', sch('mainstream oscuro')], ...LK('harmony-05/mo-kick-screech'),
    notes: 'Cola larga en Mi 1, plegada y muy distorsionada, con un chillido: un paso banda resonante que baja de 3,2 kHz a 700 Hz.' }),
  K({ id: 'mo-kick-rumble', name: 'Kick rumble', style: 'hardcore', key: 'F1', bpm: [175, 185], tags: ['mainstream', 'rumble', 'cola larga', sch('mainstream oscuro')], ...LK('harmony-05/mo-kick-rumble'),
    notes: 'Cola larguísima en Fa 1 con mucho rumble (sala antes de distorsionar) que se va cerrando hasta quedarse en un gruñido.' }),
  { id: 'mo-screech', name: 'Chillido oscuro', style: 'hardcore', type: 'efecto', cat: 'fx', tags: ['screech', 'oscuro', sch('mainstream oscuro')], render: moScreech,
    notes: 'Sierra por un paso banda de Q 14 que sube y baja, saturada, con eco a 178 BPM.' },
  { id: 'mo-bell', name: 'Campana de terror', style: 'hardcore', type: 'nota', cat: 'fx', key: 'E3', tags: ['campana', 'terror', 'fm', sch('mainstream oscuro')], render: moBell,
    notes: 'Dos campanas FM inarmónicas (Mi 3 y Mi 2) con una sala larga y oscura.' },
  { id: 'mo-drone', name: 'Drone oscuro (Mi)', style: 'hardcore', type: 'acordes', cat: 'fx', key: 'E1', tags: ['drone', 'pad', 'oscuro', sch('mainstream oscuro')], render: moDrone,
    notes: 'Sierras desafinadas en Mi 1, Mi 2, Si 2 y Mi 3 con un filtro que respira, saturadas: el fondo del break.' },
  { id: 'mo-impact', name: 'Impacto oscuro', style: 'hardcore', type: 'impacto', cat: 'fx', tags: ['impact', 'sub', 'metal', sch('mainstream oscuro')], render: moImpact,
    notes: 'Sub que cae de 85 a 30 Hz, golpe metálico y ruido que se cierra, con sala grande.' },
  L({ id: 'mo-lead', name: 'Riff oscuro (Mi frigio)', style: 'hardcore', type: 'melodía', tonality: 'Mi frigio', bpm: [178, 178], bars: 2, tags: ['riff', 'oscuro', 'raw', sch('mainstream oscuro')], render: moLead,
    notes: 'Riff de 2 compases a 178 BPM en Mi frigio: lead raw y supersierra una octava abajo.' }),
  { id: 'mo-perc', name: 'Golpe industrial', style: 'hardcore', type: 'percusión', cat: 'perc', tags: ['industrial', 'metal', sch('mainstream oscuro')], render: moPerc,
    notes: 'Metal grave y ruido por un paso banda a 1,1 kHz, saturado, con sala corta.' },

  // Mainstream melódico
  K({ id: 'mm-kick-tonal', name: 'Kick con cola tonal (La)', style: 'hardcore', key: 'A1', bpm: [170, 178], tags: ['mainstream', 'melódico', 'cola tonal', sch('mainstream melódico')], ...LK('harmony-05/mm-kick-tonal'),
    notes: 'Cola afinada en La 1, menos distorsionada para que cante la nota, que se va cerrando: para tocar la tónica en La menor.' }),
  K({ id: 'mm-kick-tonal-c', name: 'Kick con cola tonal (Do)', style: 'hardcore', key: 'C2', bpm: [170, 178], tags: ['mainstream', 'melódico', 'cola tonal', sch('mainstream melódico')], ...LK('harmony-05/mm-kick-tonal-c'),
    notes: 'La misma cola en Do 2 (la tercera de La menor), para cambiar de nota en el drop.' }),
  L({ id: 'mm-lead', name: 'Lead eufórico', style: 'hardcore', type: 'melodía', tonality: 'La menor', bpm: [174, 174], bars: 4, tags: ['lead', 'eufórico', 'supersierra', sch('mainstream melódico')], render: mmLead,
    notes: 'Melodía de 4 compases sobre Lam – Fa – Do – Sol: supersierra brillante con su octava, «sidechain» y eco.' }),
  L({ id: 'mm-piano', name: 'Piano melódico', style: 'hardcore', type: 'acordes', tonality: 'La menor', bpm: [174, 174], bars: 4, tags: ['piano', 'break', sch('mainstream melódico')], render: mmPiano,
    notes: 'Acordes largos de piano con la melodía del lead arriba (una nota de cada dos), para el break.' }),
  { id: 'mm-choir', name: 'Coro del break (La m)', style: 'hardcore', type: 'coro', cat: 'voz', key: 'A3', tags: ['coro', 'pad', sch('mainstream melódico')], render: mmChoir,
    notes: 'Coro sintético «Aah» en La menor, largo y con sala.' },
  L({ id: 'mm-arp', name: 'Arpegio melódico', style: 'hardcore', type: 'arpegio', tonality: 'La menor', bpm: [174, 174], bars: 4, tags: ['arpegio', 'pluck', sch('mainstream melódico')], render: mmArp,
    notes: 'Pluck en semicorcheas por los acordes del kit, con eco a corchea con puntillo.' }),

  // Raw / uptempo
  K({ id: 'rw-kick-raw', name: 'Kick raw', style: 'uptempo', key: 'D2', bpm: [200, 220], tags: ['raw', 'distorsión', 'plegado', sch('raw')], render: rwKick,
    notes: 'Corto y brutal en Re 2: plegado, recortado y saturado, con un hueco a 1,3 kHz.' }),
  K({ id: 'rw-kick-bend', name: 'Kick raw que sube', style: 'uptempo', key: null, bpm: [200, 220], tags: ['raw', 'pitch', sch('raw')], render: rwKickBend,
    notes: 'El kick raw con la cola subiendo cinco semitonos.' }),
  K({ id: 'rw-kick-noise', name: 'Kick raw con ruido', style: 'uptempo', key: 'C2', bpm: [200, 220], tags: ['raw', 'ruido', sch('raw')], render: rwKickNoise,
    notes: 'Kick raw en Do 2 con una capa de ruido a 2,5 kHz, más plegado.' }),
  { id: 'rw-scream', name: 'Grito de ruido', style: 'uptempo', type: 'efecto', cat: 'fx', tags: ['scream', 'ruido', sch('raw')], render: rwScream,
    notes: 'Ruido rosa por dos pasos banda que suben, plegado y saturado.' },
  L({ id: 'rw-riff', name: 'Melodía de kicks raw', style: 'uptempo', type: 'línea', tonality: 'Re menor', bpm: [205, 205], bars: 2, tags: ['kick melody', 'raw', sch('raw')], render: rwRiff,
    notes: 'El kick raw tocado a distintas alturas en Re menor, a contratiempo y en semicorcheas, 2 compases a 205 BPM: el «riff» del uptempo.' }),
  { id: 'rw-stab', name: 'Acorde raw (Re m)', style: 'uptempo', type: 'stab', cat: 'fx', key: 'D3', tags: ['stab', 'raw', sch('raw')], render: rwStab,
    notes: 'Sierras y cuadradas en Re menor, plegadas y muy cortas.' },

  // Newstyle
  K({ id: 'nw-kick-seco', name: 'Kick newstyle seco', style: 'newstyle', key: 'A1', bpm: [145, 155], tags: ['newstyle', 'corto', 'clic', sch('newstyle')], ...LK('harmony-05/nw-kick-seco'),
    notes: 'Seco y corto en La 1, con mucho clic y grano.' }),
  K({ id: 'nw-kick-tok', name: 'Kick newstyle tok', style: 'newstyle', key: 'B1', bpm: [145, 155], tags: ['newstyle', 'tok', 'medios', sch('newstyle')], ...LK('harmony-05/nw-kick-tok'),
    notes: 'Golpe en los medios en Si 1, con mucho tok y cuerpo: se oye aunque el bajo vaya fuerte.' }),
  { id: 'nw-bass-off', name: 'Bajo a contratiempo (La)', style: 'newstyle', type: 'bajo', cat: 'bajo', key: 'A1', bpm: [150, 150], tags: ['bajo', 'offbeat', sch('newstyle')], render: nwBass,
    notes: 'Golpe de bajo de una corchea a 150 BPM en La 1, con un paso bajo que se cierra.' },
  { id: 'nw-clap', name: 'Palma newstyle con sala', style: 'newstyle', type: 'palma', cat: 'perc', tags: ['clap', 'reverb', sch('newstyle')], render: nwClap,
    notes: 'Palma a 1,4 kHz con una sala grande, para el 2 y el 4.' },
  { id: 'nw-hat', name: 'Charles newstyle', style: 'newstyle', type: 'charles', cat: 'perc', tags: ['hi-hat', 'contratiempo', sch('newstyle')], render: nwHat,
    notes: 'Charles abierto corto por encima de 8 kHz.' },
  { id: 'nw-stab', name: 'Golpe de órgano (La m)', style: 'newstyle', type: 'stab', cat: 'fx', key: 'A3', tags: ['stab', 'órgano', 'piano', sch('newstyle')], render: nwStab,
    notes: 'Órgano y piano en La menor (La 3, Do 4, Mi 4), corto: el acorde a contratiempo.' },
  L({ id: 'nw-bass-loop', name: 'Bajo newstyle (La – Fa – Sol – Mi)', style: 'newstyle', type: 'línea', tonality: 'La menor', bpm: [150, 150], bars: 4, tags: ['bajo', 'contratiempo', sch('newstyle')], render: nwBassLoop,
    notes: 'Bajo a contratiempo de 4 compases: pluck oscuro con sub, La – Fa – Sol – Mi.' })
];
