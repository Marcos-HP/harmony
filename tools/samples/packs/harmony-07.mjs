/* HARMONY 07 · Oscuro y distorsionado
   Dos familias para ir más allá de Harmony 05:
     Hardcore oscuro / industrial   170 BPM · Fa menor (frigio)  kicks largos y graves, metal, golpes de fábrica,
                                                                 coros graves, campana con tercera menor, órgano siniestro
     Uptempo distorsionado          210 BPM · Re menor           kicks zaag, con chillido y triturados, melodías de
                                                                 kicks, screech, acordes cortados y gritos de ruido
   El uptempo va a 210 BPM y en Re menor, como el kit Uptempo II de Harmony 04, para que se mezclen.
   Todo por síntesis; las melodías son de Harmony. */
import * as D from '../dsp.mjs';
import * as R from '../rave.mjs';
import { labKick as LK } from '../kicklib.mjs';
import * as S from '../synth.mjs';
import * as V from '../voice.mjs';

export const PACK = {
  id: 'harmony-07',
  name: 'Harmony 07',
  title: 'Oscuro y distorsionado',
  version: '1.0.0',
  date: '2026-10-19',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis y procesado digital en tools/samples/ (Harmony), con melodías compuestas para Harmony. Sin grabaciones, sin samples de terceros y sin melodías de nadie.',
  credits: 'Harmony'
};

/* ---------------------------------------------------------------- piezas comunes (como en Harmony 05) */
const SR = D.SR;
const beat = (bpm) => 60 / bpm;
const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));
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
function clapCore(seed, { f = 1300, q = 1.1, bursts = 4, gap = 0.009, tail = 0.12 } = {}) {
  const parts = [];
  for (let k = 0; k < bursts; k++) parts.push([D.env(D.bp(D.noise(0.03, seed + k), f, q), D.expEnv(0.004)), k === bursts - 1 ? 1 : 0.7, k * gap]);
  parts.push([D.env(D.bp(D.noise(tail * 6, seed + 9), f * 0.9, 0.8), D.expEnv(tail)), 0.6, bursts * gap]);
  return D.mix(...parts);
}
function metal(dur, seed, { hp = 7000, tau = 0.05, base = 1.9 } = {}) {
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * base);
  const m = D.mix(...fr.map((f, k) => [D.osc(dur, f, { shape: 'square', phase: (k * 0.17) % 1 }), 0.18]), [D.noise(dur, seed), 0.5]);
  return D.env(D.hp(D.hp(m, hp), hp), D.expEnv(tau));
}
/* golpe metálico: parciales inarmónicos de un tubo (1 · 2,76 · 5,40 · 8,93), con sus caídas */
function pipe(f, dur, seed, { decay = 0.9, noise = 0.25 } = {}) {
  const parts = [[1, 1, decay], [2.76, 0.6, decay * 0.6], [5.4, 0.4, decay * 0.4], [8.93, 0.25, decay * 0.25]];
  return D.mix(...parts.map(([r, g, d]) => [D.osc(dur, f * r, { amp: D.expEnv(d), phase: (r * 0.13) % 1 }), g]), [D.env(D.bp(D.noise(0.05, seed), f * 4, 1.2), D.expEnv(0.006)), noise]);
}

/* ================================================================= HARDCORE OSCURO / INDUSTRIAL · 170 BPM · Fa menor */
const OS = { bpm: 170 };
/* el golpe de tubo metálico encima del kick industrial del laboratorio */
function metalHit(k) {
  const hit = D.drive(D.hp(pipe(311, 0.25, 703, { decay: 0.08 }), 400), 2);
  const add = (c) => D.mix([c, 1], [hit, 0.22]);
  return D.normalizeTP(D.limitSt(D.stereo(D.fades(add(k.L).slice(0, k.L.length), 0.0005, 0.01), D.fades(add(k.R).slice(0, k.R.length), 0.0005, 0.01)), -0.7), -1);
}
function osClap() {
  // palma oscura: grave (900 Hz), sucia y con una sala que se apaga pronto en los agudos
  let x = clapCore(705, { f: 900, q: 1, tail: 0.14 });
  x = D.drive(D.eq(x, 1400, 3, 1), 2.8);
  return finishSt(D.mixSt([D.widen(x, 0.3, 3), 1], [room(x, 0.86, 1.8, 0.72), 0.4]));
}
function osSnare() {
  // caja industrial: ruido, tono de 180 Hz y un anillo metálico, con la resolución rebajada
  const L = 0.5;
  const n = D.env(D.bp(D.noise(L, 706), 2400, 0.7), D.expEnv(0.07));
  const tone = D.osc(L, D.sweep(260, 180, 0.02), { amp: D.expEnv(0.05) });
  const ring = D.hp(pipe(523, L, 707, { decay: 0.12, noise: 0 }), 600);
  let x = D.mix([n, 0.9], [tone, 0.6], [ring, 0.25]);
  x = D.crush(D.drive(x, 2.5), 8, 2);
  return finishSt(D.mixSt([D.widen(x, 0.25, 5), 1], [room(x, 0.7, 0.9, 0.65), 0.25]));
}
function osHat() {
  const x = D.crush(D.drive(metal(0.3, 708, { hp: 5200, tau: 0.08, base: 1.4 }), 1.8), 10, 2);
  return finishSt(D.widen(x, 0.4, 9));
}
function osPipe() {
  // tubo de metal golpeado (La 3 grave e inarmónico) con sala de nave industrial
  const x = D.drive(pipe(D.note('F', 3), 2.2, 709, { decay: 0.9 }), 1.4);
  return finishSt(D.mixSt([D.widen(x, 0.2, 2), 1], [room(x, 0.9, 2.6, 0.6), 0.35]));
}
function osSlam() {
  // portazo de fábrica: ráfaga de ruido grave, golpe de sub y una sala enorme y oscura
  const sub = D.osc(0.8, D.sweep(90, 38, 0.08), { amp: D.ahd(0.001, 0.04, 0.18) });
  const burst = D.env(D.lp(D.noise(0.6, 710), 1600), D.ahd(0.001, 0.02, 0.09));
  const creak = D.env(D.bp(D.osc(0.4, D.sweep(140, 95, 0.2), { shape: 'saw' }), 700, 3), D.ahd(0.01, 0.1, 0.1));
  const x = sat(D.mix([sub, 1], [burst, 0.8], [creak, 0.2, 0.02]), 1.6);
  return finishSt(D.mixSt([D.widen(x, 0.3, 4), 1], [room(x, 0.95, 3.2, 0.75), 0.5]));
}
function osDrone() {
  // fondo del break: sierras graves en Fa menor con ruido filtrado que respira, un poco plegadas
  const L = 6;
  const one = (seed) => {
    const r = D.rng(seed);
    const x = D.mix(...[['F1', 0.5], ['C2', 0.35], ['F2', 0.4], ['G#2', 0.25]].flatMap(([n, g]) => [-11, 8].map((c) => [D.osc(L, S.freq(n) * Math.pow(2, c / 1200), { shape: 'saw', phase: r() }), g * 0.5])));
    const air = D.filter(D.noise(L, seed + 3, 'pink'), 'bp', (t) => 700 + 400 * Math.sin(2 * Math.PI * t / 3.1), { q: 2 });
    const y = D.filter(D.mix([x, 1], [air, 0.25]), 'lp', (t) => 380 + 700 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / L)), { q: 4 });
    return D.env(D.fold(D.gain(y, 1.3), 1), D.ahd(1, 3.6, 0.3));
  };
  const st = D.same(D.stereo(one(711), one(712)));
  return finishSt(D.mixSt([st, 1], [room(st, 0.9, 2.2, 0.65), 0.28]));
}
function osChoir() {
  // coro grave «oh» en Fa menor (Fa 2, Do 3, Fa 3, La♭ 3): bajos y tenores, con una sala de iglesia
  const L = 3.6, amp = (t) => (t < 0.6 ? Math.sin((t / 0.6) * Math.PI / 2) : t < 2.5 ? 1 : Math.max(0, Math.cos(((t - 2.5) / 1.1) * Math.PI / 2)));
  const lo = V.choir(L, ['F2', 'C3'].map(S.freq), { reg: 'bass', vowel: 'o', voices: 3, seed: 713, amp });
  const hi = V.choir(L, ['F3', 'G#3'].map(S.freq), { reg: 'tenor', vowel: 'o', voices: 3, seed: 714, amp });
  const st = D.applySt(D.mixSt([lo, 1], [hi, 0.7]), (c) => D.shelf(D.eq(c, 2600, 2, 0.8), 'highshelf', 5000, 4));
  return finishSt(D.mixSt([st, 1], [room(st, 0.92, 3, 0.6), 0.42]));
}
function osStab() {
  // golpe disonante: Fa y Sol♭ juntos (segunda menor) con Do y Re♭ arriba, en sierras saturadas
  const notes = ['F3', 'F#3', 'C4', 'C#4'].map(S.freq), L = 0.6;
  const x = D.mix(...notes.map((f, k) => [D.env(D.mix([D.osc(L, f, { shape: 'saw', phase: k * 0.2 }), 0.5], [D.osc(L, f * 1.006, { shape: 'saw', phase: k * 0.37 }), 0.5]), D.ahd(0.002, 0.08, 0.14)), 0.3]));
  const y = D.drive(D.lp(x, 2600, 1.2), 2.4);
  return finishSt(D.mixSt([D.widen(y, 0.35, 6), 1], [room(y, 0.88, 2, 0.6), 0.35]));
}
function osBell() {
  // campana de iglesia en Fa 2: sus parciales (bordón, fundamental, tercera menor, quinta, nominal) la hacen sonar triste
  const f = D.note('F', 3), L = 6.2;
  const parts = [[0.5, 0.6, 1.6], [1, 1, 1.7], [1.2, 0.55, 1.3], [1.5, 0.4, 1.2], [2, 0.5, 1], [2.51, 0.25, 0.6], [3.01, 0.18, 0.4]];
  const x = D.mix(...parts.map(([r, g, d], k) => [D.osc(L, f * r * (1 + (k % 2 ? 0.0012 : -0.0008)), { amp: (t) => Math.exp(-t / d) * Math.min(1, t / 0.002) }), g * 0.4]), [D.env(D.bp(D.noise(0.05, 715), 3000, 1), D.expEnv(0.008)), 0.2]);
  return finishSt(D.mixSt([D.widen(x, 0.3, 7), 1], [room(x, 0.92, 1.8, 0.55), 0.35]));
}
const OS_ORGAN = [   // órgano siniestro, 4 compases, Fa menor con el Sol♭ del frigio
  [0, 2, 'F4'], [2, 2, 'G#4'], [4, 2, 'C5'], [6, 2, 'C#5'], [8, 4, 'C5'], [12, 2, 'G#4'], [14, 2, 'G4'],
  [16, 2, 'F4'], [18, 2, 'G#4'], [20, 2, 'C5'], [22, 2, 'F5'], [24, 4, 'E5'], [28, 4, 'C5'],
  [32, 2, 'C#5'], [34, 2, 'C5'], [36, 2, 'G#4'], [38, 2, 'F4'], [40, 4, 'F#4'], [44, 4, 'G#4'],
  [48, 6, 'F4'], [54, 2, 'E4'], [56, 8, 'F4']
];
function osOrgan() {
  return loop(OS.bpm, 4, (cycles) => {
    const o = { bpm: OS.bpm, steps: steps(4), cycles };
    const mel = S.play(OS_ORGAN, { ...o, voice: (f, g, v) => S.organ(f, g, v, { decay: 0.8 }) });
    const low = S.play(OS_ORGAN.filter((n, k) => k % 3 === 0).map(([s, l, p]) => [s, l + 2, S.midi(p) - 12, 0.6]), { ...o, voice: (f, g, v) => S.organ(f, g, v, { decay: 1.2 }) });
    const x = sat(D.mix([mel, 1], [low, 0.6]), 1.3);
    return D.mixSt([D.widen(x, 0.3, 8), 1], [room(x, 0.9, 2.4, 0.6), 0.32]);
  });
}
const OS_LEAD = [   // riff oscuro de 2 compases
  [0, 1, 'F4'], [1, 1, 'F4'], [2, 2, 'F#4'], [4, 1, 'F4'], [6, 2, 'C5'], [8, 1, 'F4'], [9, 1, 'F4'], [10, 2, 'G#4'], [12, 4, 'F#4'],
  [16, 1, 'F4'], [17, 1, 'F4'], [18, 2, 'F#4'], [20, 1, 'F4'], [22, 2, 'C#5'], [24, 2, 'C5'], [26, 2, 'G#4'], [28, 4, 'E4']
];
function osLead() {
  return loop(OS.bpm, 2, (cycles) => {
    const x = wide(OS_LEAD, { bpm: OS.bpm, steps: steps(2), cycles, gateScale: 0.85 }, (seed) => (f, g, v) => D.mix([S.rawLead(f, g, v, { drive: 9, center: 900 }), 0.6], [S.supersaw(f / 2, g, v, { seed: seed + 716, n: 5, spread: 34, cutoff: 2400, drive: 2.4 }), 0.6]));
    return D.mixSt([x, 1], [room(x, 0.85, 1.4, 0.62), 0.22]);
  });
}
function osBass() {
  // bajo «rumble» a contratiempo, 4 compases: Fa – Re♭ – Mi♭ – Do, grave y saturado
  return loop(OS.bpm, 4, (cycles) => {
    const roots = ['F1', 'C#1', 'D#1', 'C2'];
    const notes = roots.flatMap((r, b) => [2, 6, 10, 14].map((s) => [b * 16 + s, 2, r, 1]));
    const x = S.play(notes, { bpm: OS.bpm, steps: steps(4), cycles, tail: 0.3, voice: (f, g, v) => {
      const L = g + 0.05, y = D.mix([D.osc(L, f), 1], [D.osc(L, f * 2, { shape: 'saw' }), 0.3]);
      return D.env(D.filter(D.drive(y, 3), 'lp', D.ramp(1400, 220, L, 0.7), { q: 2 }), D.ahd(0.004, g * 0.5, g * 0.3));
    } });
    return D.hp(sat(x, 1.4), 30);
  });
}
function osRiser() {
  // subida de 2 compases a 170: ruido plegado con un paso banda resonante que sube y se va saturando
  const L = beat(170) * 8;
  const n = D.noise(L, 717, 'pink');
  let x = D.filter(n, 'bp', (t) => 200 * Math.pow(30, t / L), { q: 6 });
  x = D.map(x, (v, i) => { const u = i / SR / L; return Math.tanh(v * (2 + 10 * u * u)); });
  x = D.env(x, (t) => Math.pow(t / L, 1.6) * (t > L - 0.02 ? (L - t) / 0.02 : 1));
  return finishSt(D.mixSt([D.widen(x, 0.5, 4), 1], [room(x, 0.8, 1, 0.5), 0.2]));
}
function osScream() {
  // chillido de terror: dos sierras con el tono temblando, por dos formantes que se abren
  const L = 1.6;
  const f = (t) => 440 * Math.pow(2, (1.5 * Math.sin(2 * Math.PI * 9 * t) + 4 * Math.min(1, t / 0.4)) / 12);
  const src = D.mix([D.osc(L, f, { shape: 'saw' }), 0.5], [D.osc(L, (t) => f(t) * 1.02, { shape: 'saw', phase: 0.4 }), 0.5]);
  const v = D.mix([D.filter(src, 'bp', D.ramp(700, 1100, L, 0.6), { q: 8 }), 1], [D.filter(src, 'bp', D.ramp(1800, 2800, L, 0.6), { q: 9 }), 0.8]);
  const x = D.env(D.drive(D.fold(D.gain(v, 3), 2), 2.5), D.ahd(0.05, 0.9, 0.3));
  return finishSt(D.mixSt([D.widen(x, 0.4, 5), 1], [room(x, 0.88, 2, 0.6), 0.35]));
}
function osHeart() {
  // latido: dos golpes graves (pum-pum), para los breaks
  const thump = (seed) => D.osc(0.35, D.sweep(70, 42, 0.05), { amp: D.ahd(0.004, 0.03, 0.08) });
  const x = D.lp(D.mix([thump(1), 1, 0], [thump(2), 0.7, 0.22]), 400);
  return finishSt(D.mixSt([D.stereo(x, Float64Array.from(x)), 1], [room(x, 0.7, 1, 0.8), 0.15]));
}

/* ================================================================= UPTEMPO DISTORSIONADO · 210 BPM · Re menor */
const UD = { bpm: 210 };
function udBody(note, { len = 0.32, bend = 0, seed = 801 } = {}) {
  const f1 = D.note(note[0], note[1]);
  const b = body({ f0: 3600, mid: 320, f1, tau: 0.002, tau2: 0.022, len, amp: D.ahd(0.0005, len * 0.5, len * 0.22), bend, bendStart: 0.035 });
  return { f1, x: D.mix([b, 1], [click(seed, { f: 5600, tok: 2600 }), 0.5]) };
}
function udKickZaag() {
  // «zaag»: en la cola entra una sierra a la misma nota y todo se pliega y se recorta: zumba como una sierra mecánica
  const { f1, x: k } = udBody(['D', 2], { len: 0.34 });
  const saw = D.env(D.osc(0.34, f1, { shape: 'saw' }), (t) => (t < 0.03 ? t / 0.03 : 1) * Math.exp(-Math.max(0, t - 0.15) / 0.1));
  let x = D.mix([k, 1], [saw, 0.55]);
  x = D.fold(x, 2.6); x = D.clip(x, 3, 0.9); x = D.drive(x, 3);
  x = D.eq(x, 1100, -4, 1.2); x = D.lp(x, 8000); x = D.hp(x, 40);
  return finish(x, { release: 0.06 });
}
function udKickScreech() {
  // la cola del kick pasa por un paso banda muy resonante que sube: chilla al final de cada golpe
  const { x: k } = udBody(['D', 2], { len: 0.38, seed: 802 });
  let x = D.fold(k, 3); x = D.drive(x, 4);
  const scr = D.filter(x, 'bp', (t) => 500 * Math.pow(6, Math.min(1, Math.max(0, t - 0.08) / 0.26)), { q: 12 });
  x = D.mix([D.lp(x, 2000), 0.8], [D.drive(scr, 3), 0.55]);
  x = D.hp(x, 40);
  return finish(x, { release: 0.06 });
}
function udKickCrush() {
  // triturado: el kick en Fa 2 con 6 bits y la frecuencia de muestreo a un tercio
  const { x: k } = udBody(['F', 2], { len: 0.3, seed: 803 });
  let x = D.drive(D.fold(k, 2.4), 3);
  x = D.crush(x, 6, 3); x = D.lp(x, 9000);
  // el triturado se come los graves: un seno limpio a la misma nota debajo
  const sub = D.osc(0.3, D.note('F', 2), { amp: D.ahd(0.004, 0.12, 0.06) });
  x = D.hp(D.mix([x, 0.85], [sub, 0.5]), 40);
  return finish(x, { release: 0.05 });
}
function udKickTok() {
  // corto y con mucho golpe (Re 2): para rodar a semicorcheas sin emborronar
  const { x: k } = udBody(['D', 2], { len: 0.2, seed: 804 });
  let x = D.drive(D.fold(k, 2), 3.5); x = D.eq(x, 2500, 4, 1); x = D.hp(x, 45);
  return finish(x, { release: 0.04 });
}
function udKickPump() {
  // kick con «bajo inverso»: el golpe y, hasta el siguiente tiempo, una cola al revés que crece (un tiempo a 210)
  const L = beat(210);
  const { x: k } = udBody(['D', 2], { len: 0.14, seed: 805 });
  const rev = S.reverseBass(D.note('D', 2), L * 0.78, 1, { drive: 4 });
  let x = D.mix([D.drive(D.fold(k, 2), 3), 1], [rev, 0.8, L * 0.2]);
  x = D.drive(x, 1.6); x = D.hp(x, 40);
  return finish(D.pad(x, L), { release: 0.01 });
}
function udClap() {
  let x = clapCore(806, { f: 1500, q: 1.3, tail: 0.07 });
  x = D.crush(D.drive(x, 3.5), 10, 1);
  return finishSt(D.mixSt([D.widen(x, 0.3, 2), 1], [room(x, 0.55, 0.5, 0.5), 0.18]));
}
function udRoll() {
  // redoble de un compás a 210: semicorcheas, fusas y garrapateas, subiendo y cada vez más rotas
  const s = beat(210) / 4, at = [];
  for (let t = 0; t < 8 * s - 1e-9; t += s) at.push(t);
  for (let t = 8 * s; t < 12 * s - 1e-9; t += s / 2) at.push(t);
  for (let t = 12 * s; t < 16 * s - 1e-9; t += s / 4) at.push(t);
  const hit = (t, k) => D.mix([D.env(D.hp(D.noise(0.08, 807 + k), 1800), D.expEnv(0.02)), 0.8], [D.osc(0.06, 230 * Math.pow(2, (t / (16 * s)) * 1), { amp: D.expEnv(0.02) }), 0.6]);
  let x = D.mix(...at.map((t, k) => [hit(t, k), 0.45 + 0.55 * (t / (16 * s)), t]));
  x = D.crush(D.drive(x, 2.6), 9, 2);
  return finishSt(D.mixSt([D.widen(x, 0.25, 3), 1], [room(x, 0.6, 0.6), 0.15]));
}
function udHat() {
  return finishSt(D.widen(D.crush(D.drive(metal(0.16, 808, { hp: 7500, tau: 0.03 }), 2.2), 7, 2), 0.35, 4));
}
const UD_SCREECH = [   // 2 compases en Re menor
  [0, 2, 'D5'], [2, 1, 'D5'], [3, 1, 'F5'], [4, 2, 'E5'], [6, 2, 'D5'], [8, 2, 'A4'], [10, 2, 'C5'], [12, 4, 'D5'],
  [16, 2, 'F5'], [18, 1, 'E5'], [19, 1, 'D5'], [20, 2, 'C5'], [22, 2, 'A4'], [24, 2, 'A#4'], [26, 2, 'A4'], [28, 4, 'G4']
];
function udScreech() {
  return loop(UD.bpm, 2, (cycles) => {
    const x = wide(UD_SCREECH, { bpm: UD.bpm, steps: steps(2), cycles, gateScale: 0.85 }, (seed) => (f, g, v) => S.screech(f, g, v, { from: 6, to: 2.4, q: 8, drive: 4 }));
    return D.mixSt([D.applySt(x, (c) => D.crush(c, 10, 1)), 1], [room(x, 0.7, 0.8), 0.15]);
  });
}
const UD_RAW = [       // golpes de lead raw con bends, 2 compases
  [0, 2, 'D4'], [3, 1, 'D4'], [6, 2, 'F4'], [8, 2, 'E4'], [11, 1, 'D4'], [12, 2, 'A3'], [14, 2, 'C4'],
  [16, 2, 'D4'], [19, 1, 'D4'], [22, 2, 'G4'], [24, 2, 'F4'], [27, 1, 'E4'], [28, 4, 'D4']
];
function udRaw() {
  return loop(UD.bpm, 2, (cycles) => {
    const x = wide(UD_RAW, { bpm: UD.bpm, steps: steps(2), cycles, gateScale: 0.8 }, (seed) => (f, g, v) => {
      const L = g + 0.05, fr = (t) => f * Math.pow(2, (-3 * Math.exp(-t / 0.025)) / 12);   // entra desde abajo
      const y = D.mix([D.osc(L, fr, { shape: 'square' }), 0.5], [D.osc(L, (t) => fr(t) * 1.008, { shape: 'saw', phase: seed * 0.3 }), 0.5], [D.osc(L, (t) => fr(t) / 2, { shape: 'saw' }), 0.4]);
      return D.env(D.lp(D.fold(D.gain(y, 2), 3), 6500), D.ahd(0.002, g * 0.8, 0.03));
    });
    return D.mixSt([x, 1], [room(x, 0.65, 0.7), 0.12]);
  });
}
function udKickMelody() {
  // melodía de kicks rodante: el kick tok a semicorcheas, saltando por Re menor (2 compases)
  return loop(UD.bpm, 2, (cycles) => {
    const notes = [[0, 1, 'D2'], [2, 1, 'D2'], [3, 1, 'D2'], [4, 1, 'F2'], [6, 1, 'D2'], [7, 1, 'D2'], [8, 1, 'A2'], [10, 1, 'G2'], [11, 1, 'F2'], [12, 1, 'D2'], [14, 1, 'C2'], [15, 1, 'D2'],
      [16, 1, 'D2'], [18, 1, 'D2'], [19, 1, 'D2'], [20, 1, 'F2'], [22, 1, 'G2'], [23, 1, 'A2'], [24, 1, 'A#2'], [26, 1, 'A2'], [27, 1, 'G2'], [28, 1, 'F2'], [30, 1, 'E2'], [31, 1, 'C#2']];
    const voice = (f) => {
      const n = D.hzToNote(f), m = /^([A-G]#?)(-?\d)$/.exec(n);
      const { x: k } = udBody([m[1], +m[2]], { len: 0.14, seed: 809 });
      return D.gain(D.drive(D.fold(k, 2.2), 3), 0.8);
    };
    return D.hp(S.play(notes, { bpm: UD.bpm, steps: steps(2), cycles, tail: 0.3, voice }), 40);
  });
}
const UD_CH = [['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['A#3', 'D4', 'F4'], ['A3', 'C#4', 'E4']];
function udChords() {
  // acordes cortados y plegados, 4 compases: Rem – Do – Sib – La
  return loop(UD.bpm, 4, (cycles) => {
    const notes = UD_CH.map((c, b) => [b * 16, 16, c, 1]);
    const x = wide(notes, { bpm: UD.bpm, steps: steps(4), cycles, gateScale: 1 }, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed + 810, n: 5, spread: 28, cutoff: 4200, drive: 3 }));
    const g = D.applySt(x, (c) => D.drive(D.fold(S.gate16(c, UD.bpm, 'x.xx.xx.x.xx.x.x', { duty: 0.6 }), 1.5), 1.6));
    return D.mixSt([g, 1], [room(g, 0.7, 0.8), 0.14]);
  });
}
function udSiren() {
  // sirena raw de un compás a 210: dos sierras a una cuarta que suben y bajan dos veces, plegadas
  const L = beat(210) * 4;
  const f = (t) => 520 * Math.pow(2, (7 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t / L))) / 12);
  const x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.5], [D.osc(L, (t) => f(t) * 4 / 3, { shape: 'saw', phase: 0.3 }), 0.4]);
  const y = D.env(D.drive(D.fold(D.lp(x, 4000), 2), 2), D.ahd(0.01, L - 0.08, 0.03));
  return finishSt(D.mixSt([D.widen(y, 0.35, 3), 1], [room(y, 0.6, 0.6), 0.12]));
}
function udScream() {
  // grito oscuro (rave.mjs, darkScream): voz de bajo sintética de «a» a «o» que cae de tono, con gruñido y ruido áspero,
  // distorsionada y sin agudos; antes era ruido con formantes «a-e» triturado a 9 bits y sonaba raro
  const x = R.darkScream(0.9, { f0: 165, to: 105, seed: 811, growl: 0.45, rasp: 0.5, drive: 6 });
  return finishSt(D.mixSt([D.widen(x, 0.4, 6), 1], [room(x, 0.75, 0.9), 0.2]));
}
function udImpact() {
  const sub = D.osc(1.6, D.sweep(110, 32, 0.2), { amp: D.ahd(0.001, 0.15, 0.35) });
  const crash = D.env(D.hp(D.noise(1.4, 812), 800), D.ahd(0.001, 0.02, 0.35));
  const x = D.crush(sat(D.mix([sub, 1], [crash, 0.5]), 3), 8, 2);
  return finishSt(D.mixSt([D.widen(x, 0.35, 5), 1], [room(x, 0.85, 1.6), 0.3]));
}
function udRiser() {
  // subida de 2 compases a 210: sierra que sube una octava y media y se pliega cada vez más
  const L = beat(210) * 8;
  const f = (t) => 110 * Math.pow(2, (18 * Math.pow(t / L, 1.4)) / 12);
  const x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.5], [D.osc(L, (t) => f(t) * 1.01, { shape: 'saw', phase: 0.5 }), 0.5], [D.noise(L, 813), 0.15]);
  const y = D.map(D.lp(x, 6000), (v, i) => { const u = i / SR / L; return Math.sin(Math.PI / 2 * v * (1 + 6 * u * u)); });
  const z = D.env(y, (t) => (0.15 + 0.85 * Math.pow(t / L, 1.2)) * (t > L - 0.015 ? (L - t) / 0.015 : 1));
  return finishSt(D.mixSt([D.widen(z, 0.4, 4), 1], [room(z, 0.6, 0.5), 0.12]));
}
function udStutter() {
  // tartamudeo: el kick zaag repetido a fusas, cada vez más grave, durante un tiempo a 210
  const k = udKickZaag(), s = beat(210) / 8, parts = [];
  for (let j = 0; j < 8; j++) parts.push([D.rate(k.slice(0, Math.round(s * SR * 0.9)), Math.pow(2, -j / 12)), 0.9, j * s]);
  return finish(D.mix(...parts), { release: 0.02 });
}
function udLaser() {
  const L = 0.5;
  const x = D.env(D.osc(L, D.sweep(4200, 180, 0.09), { shape: 'square' }), D.ahd(0.001, 0.12, 0.12));
  const y = D.crush(D.drive(x, 2), 8, 1);
  const d = beat(210) * 0.75;
  return finishSt(D.mixSt([D.widen(y, 0.3, 2), 1], [D.stereo(D.mix([y, 0.3, d]), D.mix([y, 0.22, d * 2])), 1]));
}

/* partituras para el test de afinación */
export const SCORES = { 'os-organ': [OS.bpm, OS_ORGAN], 'ud-screech': [UD.bpm, UD_SCREECH] };

/* ---------------------------------------------------------------- catálogo del pack */
const K = (o) => ({ cat: 'kick', type: 'kick', ...o });
const L = (o) => ({ cat: 'loop', loop: true, ...o });
const os = (...t) => ['oscuro', 'industrial', ...t];
const ud = (...t) => ['uptempo', 'distorsión', ...t];
export const SAMPLES = [
  // Hardcore oscuro / industrial
  K({ id: 'os-kick-doom', name: 'Kick oscuro largo', style: 'hardcore', key: 'F1', bpm: [160, 180], tags: os('cola larga', 'grave'), ...LK('harmony-07/os-kick-doom'),
    notes: 'Golpe seco y una cola larguísima en Fa 1, plegada, con rumble, que se va cerrando hasta quedarse en un gruñido.' }),
  K({ id: 'os-kick-metal', name: 'Kick industrial con metal', style: 'hardcore', key: 'G#1', bpm: [160, 180], tags: os('metal', 'fábrica'), ...LK('harmony-07/os-kick-metal', metalHit),
    notes: 'Kick industrial en Sol# 1 a 8 bits, con un chillido que baja y un golpe de tubo metálico encima: suena a fábrica.' }),
  K({ id: 'os-kick-thud', name: 'Kick sordo', style: 'hardcore', key: 'F1', bpm: [140, 180], tags: os('corto', 'medio tiempo'), ...LK('harmony-07/os-kick-thud'),
    notes: 'Golpe corto y sordo en Fa 1, oscuro y poco recortado: para el medio tiempo y los breaks.' }),
  { id: 'os-clap', name: 'Palma oscura', style: 'hardcore', type: 'palma', cat: 'perc', tags: os('clap', 'reverb'), render: osClap,
    notes: 'Palma grave (900 Hz), saturada, con una sala larga que apaga los agudos.' },
  { id: 'os-snare', name: 'Caja industrial', style: 'hardcore', type: 'caja', cat: 'perc', tags: os('snare', 'metal', 'bits'), render: osSnare,
    notes: 'Ruido, tono de 180 Hz y un anillo metálico, saturado y a 8 bits.' },
  { id: 'os-hat', name: 'Charles de chatarra', style: 'hardcore', type: 'charles', cat: 'perc', tags: os('hi-hat', 'bits'), render: osHat,
    notes: 'Metal inarmónico más grave de lo normal, saturado y triturado a 10 bits.' },
  { id: 'os-pipe', name: 'Tubo de metal', style: 'hardcore', type: 'percusión', cat: 'perc', key: 'F3', tags: os('metal', 'golpe'), render: osPipe,
    notes: 'Tubo golpeado en Fa 3 (parciales 1 · 2,76 · 5,4 · 8,93) con una sala de nave industrial.' },
  { id: 'os-slam', name: 'Portazo de fábrica', style: 'hardcore', type: 'impacto', cat: 'fx', tags: os('impacto', 'sala'), render: osSlam,
    notes: 'Golpe de sub, ráfaga de ruido grave y un crujido, con una sala enorme y oscura.' },
  { id: 'os-drone', name: 'Drone de fábrica (Fa m)', style: 'hardcore', type: 'acordes', cat: 'fx', key: 'F1', tags: os('drone', 'pad', 'break'), render: osDrone,
    notes: 'Sierras graves en Fa menor con ruido filtrado que respira, un poco plegadas: el fondo del break.' },
  { id: 'os-choir', name: 'Coro grave «oh» (Fa m)', style: 'hardcore', type: 'coro', cat: 'voz', key: 'F2', tags: os('coro', 'grave'), render: osChoir,
    notes: 'Bajos y tenores sintéticos (por formantes) en Fa menor, vocal «o», con sala de iglesia.' },
  { id: 'os-stab', name: 'Golpe disonante', style: 'hardcore', type: 'stab', cat: 'fx', key: 'F3', tags: os('stab', 'disonante'), render: osStab,
    notes: 'Fa y Sol♭ juntos (segunda menor) con Do y Re♭ arriba, en sierras saturadas: tensión pura.' },
  { id: 'os-bell', name: 'Campana de iglesia (Fa)', style: 'hardcore', type: 'nota', cat: 'fx', key: 'F3', tags: os('campana', 'terror'), render: osBell,
    notes: 'Campana con los parciales de una de verdad (bordón, tercera menor, quinta, nominal): la tercera menor la hace sonar triste.' },
  L({ id: 'os-organ', name: 'Órgano siniestro', style: 'hardcore', type: 'melodía', tonality: 'Fa menor', bpm: [170, 170], bars: 4, tags: os('órgano', 'frigio'), render: osOrgan,
    notes: 'Melodía de órgano de 4 compases en Fa menor con el Sol♭ del frigio, doblada una octava abajo.' }),
  L({ id: 'os-lead', name: 'Riff oscuro (Fa frigio)', style: 'hardcore', type: 'melodía', tonality: 'Fa frigio', bpm: [170, 170], bars: 2, tags: os('riff', 'raw'), render: osLead,
    notes: 'Riff de 2 compases: lead raw muy saturado y supersierra una octava abajo.' }),
  L({ id: 'os-bass', name: 'Bajo rumble (Fa – Re♭ – Mi♭ – Do)', style: 'hardcore', type: 'línea', tonality: 'Fa menor', bpm: [170, 170], bars: 4, tags: os('bajo', 'rumble', 'contratiempo'), render: osBass,
    notes: 'Bajo a contratiempo, grave y saturado, con un paso bajo que se cierra en cada nota.' }),
  { id: 'os-riser', name: 'Subida oscura', style: 'hardcore', type: 'subida', cat: 'fx', bpm: [170, 170], tags: os('riser', 'ruido'), render: osRiser,
    notes: 'Dos compases a 170: ruido rosa por un paso banda que sube cinco octavas y se satura cada vez más.' },
  { id: 'os-scream', name: 'Chillido de terror', style: 'hardcore', type: 'efecto', cat: 'fx', tags: os('scream', 'terror'), render: osScream,
    notes: 'Dos sierras con el tono temblando a 9 Hz por dos formantes que se abren, plegadas.' },
  { id: 'os-heart', name: 'Latido', style: 'hardcore', type: 'efecto', cat: 'fx', tags: os('latido', 'break'), render: osHeart,
    notes: 'Dos golpes graves (pum-pum) para los breaks.' },

  // Uptempo distorsionado
  K({ id: 'ud-kick-zaag', name: 'Kick zaag', style: 'uptempo', key: 'D2', bpm: [200, 220], tags: ud('zaag', 'sierra'), render: udKickZaag,
    notes: 'En la cola entra una sierra a la misma nota (Re 2) y todo se pliega y se recorta: zumba como una sierra mecánica.' }),
  K({ id: 'ud-kick-screech', name: 'Kick que chilla', style: 'uptempo', key: null, bpm: [200, 220], tags: ud('screech'), render: udKickScreech,
    notes: 'Kick raw en Re 2 cuya cola pasa por un paso banda muy resonante que sube: chilla al final de cada golpe.' }),
  K({ id: 'ud-kick-crush', name: 'Kick triturado', style: 'uptempo', key: 'F2', bpm: [200, 220], tags: ud('bits', 'crush'), render: udKickCrush,
    notes: 'Kick plegado en Fa 2 con 6 bits y la frecuencia de muestreo a un tercio.' }),
  K({ id: 'ud-kick-tok', name: 'Kick tok rodante', style: 'uptempo', key: 'D2', bpm: [200, 230], tags: ud('corto', 'rolling'), render: udKickTok,
    notes: 'Corto y con mucho golpe en Re 2: para rodar a semicorcheas sin emborronar.' }),
  K({ id: 'ud-kick-pump', name: 'Kick con bajo inverso', style: 'uptempo', key: null, bpm: [210, 210], tags: ud('reverse bass', 'pump'), render: udKickPump,
    notes: 'Un tiempo a 210: el golpe y una cola al revés en Re 2 que crece hasta el tiempo siguiente.' }),
  { id: 'ud-clap', name: 'Palma uptempo', style: 'uptempo', type: 'palma', cat: 'perc', tags: ud('clap'), render: udClap,
    notes: 'Palma corta y saturada a 10 bits, con una sala pequeña.' },
  { id: 'ud-roll', name: 'Redoble raw', style: 'uptempo', type: 'redoble', cat: 'perc', bpm: [210, 210], tags: ud('fill', 'redoble'), render: udRoll,
    notes: 'Un compás a 210: semicorcheas, fusas y garrapateas, subiendo de tono y cada vez más rotas.' },
  { id: 'ud-hat', name: 'Charles roto', style: 'uptempo', type: 'charles', cat: 'perc', tags: ud('hi-hat', 'bits'), render: udHat,
    notes: 'Charles cerrado corto, saturado y a 7 bits.' },
  L({ id: 'ud-screech', name: 'Screech uptempo', style: 'uptempo', type: 'melodía', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ud('screech', 'lead'), render: udScreech,
    notes: 'Melodía de screech de 2 compases en Re menor, triturada a 10 bits.' }),
  L({ id: 'ud-raw', name: 'Golpes de lead raw', style: 'uptempo', type: 'melodía', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ud('raw', 'bend'), render: udRaw,
    notes: 'Golpes de cuadrada y sierras plegadas que entran tres semitonos abajo y suben.' }),
  L({ id: 'ud-kick-melody', name: 'Melodía de kicks rodante', style: 'uptempo', type: 'línea', tonality: 'Re menor', bpm: [210, 210], bars: 2, tags: ud('kick melody', 'rolling'), render: udKickMelody,
    notes: 'El kick tok a semicorcheas saltando por Re menor, 2 compases a 210.' }),
  L({ id: 'ud-chords', name: 'Acordes cortados (Rem – Do – Sib – La)', style: 'uptempo', type: 'acordes', tonality: 'Re menor', bpm: [210, 210], bars: 4, tags: ud('acordes', 'gate'), render: udChords,
    notes: 'Supersierras cortadas a semicorcheas y plegadas, 4 compases.' }),
  { id: 'ud-siren', name: 'Sirena raw', style: 'uptempo', type: 'efecto', cat: 'fx', bpm: [210, 210], tags: ud('sirena'), render: udSiren,
    notes: 'Un compás a 210: dos sierras a una cuarta que suben y bajan dos veces, plegadas.' },
  { id: 'ud-scream', name: 'Grito distorsionado', style: 'uptempo', type: 'efecto', cat: 'fx', tags: ud('scream'), render: udScream,
    notes: 'Grito oscuro: voz de bajo sintética de «a» a «o» que cae de tono, con gruñido y ruido áspero, distorsionada y sin agudos (el peso entre 700 Hz y 1,6 kHz).' },
  { id: 'ud-impact', name: 'Impacto triturado', style: 'uptempo', type: 'impacto', cat: 'fx', tags: ud('impacto', 'bits'), render: udImpact,
    notes: 'Sub que cae de 110 a 32 Hz y un platillo de ruido, saturado a 8 bits.' },
  { id: 'ud-riser', name: 'Subida plegada', style: 'uptempo', type: 'subida', cat: 'fx', bpm: [210, 210], tags: ud('riser'), render: udRiser,
    notes: 'Dos compases a 210: sierras que suben octava y media y se pliegan cada vez más.' },
  { id: 'ud-stutter', name: 'Tartamudeo de kick', style: 'uptempo', type: 'transición', cat: 'fx', bpm: [210, 210], tags: ud('stutter', 'glitch'), render: udStutter,
    notes: 'El kick zaag repetido a fusas durante un tiempo, cada vez un semitono más grave.' },
  { id: 'ud-laser', name: 'Láser roto', style: 'uptempo', type: 'efecto', cat: 'fx', tags: ud('láser'), render: udLaser,
    notes: 'Cuadrada que cae de 4,2 kHz a 180 Hz, a 8 bits, con eco a corchea con puntillo.' }
];
