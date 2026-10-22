/* HARMONY 09 · Hardcore duro y hard techno
   Lo que faltaba para que el hardcore suene como debe: kicks del motor de hardcore del Laboratorio de kicks (afinado
   contra kicks de referencia), hoover, screech, lead raw, piano de rave y bajos en notas sueltas (para el piano roll) y en
   bucles, percusión con pegada, efectos de drop, gritos oscuros y lo básico del hard techno: rumble, acid, stab y
   charles. Hardcore a 175 BPM en Fa menor (Fam – Re♭ – Mi♭ – Do); hard techno a 150 en Fa menor. Melodías de Harmony.
   Las técnicas (no los sonidos) salen de cómo se hacen en los temas: el hoover de pulso-sierra con subida de tono y coro,
   el piano de rave con −500 Hz / +2,5 kHz, el rumble como la sala del kick distorsionada, filtrada a ~100 Hz y empujada
   por el kick (MusicRadar: «90s hoover», «90s rave-style piano chords», «Create a rumbling techno kick»). */
import * as D from '../dsp.mjs';
import * as S from '../synth.mjs';
import * as K from '../hard.mjs';
import * as R from '../rave.mjs';
import { labKick as LK, labParams } from '../kicklib.mjs';

export const PACK = {
  id: 'harmony-09',
  name: 'Harmony 09',
  title: 'Hardcore duro y hard techno',
  version: '1.0.0',
  date: '2026-10-22',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis y procesado digital en tools/samples/ (Harmony): kicks con el motor de hardcore de hard.mjs (los mismos ajustes que el Laboratorio de kicks), instrumentos de rave.mjs. Melodías compuestas para Harmony; sin grabaciones ni samples de terceros.',
  credits: 'Harmony'
};

const HC = 175, HT = 150, SR = D.SR, TAU = Math.PI * 2;
const beat = (bpm) => 60 / bpm;
const mono = (s) => (s.L ? D.mix([s.L, 0.5], [s.R, 0.5]) : s);
const room = (x, size = 0.75, tail = 0.9, damp = 0.5) => D.reverb(mono(x), { size, damp, tail, pre: 0.01 });
const hclip = (x, g, k = 6) => D.map(x, (v) => { const a = v * g; return a / Math.pow(1 + Math.pow(Math.abs(a), k), 1 / k); });
function finishSt(s, { tailDb = -66, peak = -1, release = 0 } = {}) {
  s = D.same(s.L ? s : D.stereo(s, Float64Array.from(s)));
  let L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  if (release) { L0 = D.fadeEnd(L0, release); R0 = D.fadeEnd(R0, release); }
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0008, 0.02), D.fades(R0.slice(0, n), 0.0008, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function loop(bpm, bars, build) {
  let s = build(2);
  s = D.same(s.L ? s : D.stereo(s, Float64Array.from(s)));
  s = D.stereo(D.dcBlock(s.L), D.dcBlock(s.R));
  s = D.limitSt(s, -0.7);
  s = S.loopCut(s, bpm, bars);
  s = D.normalizeTP(s, -1);
  return D.stereo(D.fades(s.L, 0.0015, 0.0015), D.fades(s.R, 0.0015, 0.0015));
}
const withRoom = (x, wet = 0.2, o = {}) => D.mixSt([x.L ? x : D.stereo(x, Float64Array.from(x)), 1], [room(x, o.size, o.tail, o.damp), wet]);
const kick = (id) => K.labSound(labParams('harmony-09/' + id));

/* ---------------------------------------------------------------- notas sueltas (para el piano roll) */
const hooverNote = () => finishSt(withRoom(R.hoover(S.freq('C3'), 1.2, 1, { seed: 31 }), 0.18, { size: 0.8, tail: 1.2 }));
const screechNote = () => finishSt(withRoom(D.widen(R.screech(S.freq('C4'), 0.7, 1, { seed: 32 }), 0.35, 32), 0.12));
const rawNote = () => finishSt(withRoom(D.widen(R.rawLead(S.freq('C4'), 0.7, 1, { seed: 33 }), 0.5, 33), 0.12));
const pianoNote = () => finishSt(withRoom(D.widen(R.ravePiano(S.freq('C4'), 1.4, 1, { seed: 34, decay: 1.1, rel: 0.3 }), 0.25, 34), 0.18, { size: 0.6, tail: 0.8 }));
const bassNote = () => finishSt(R.glideBass(S.freq('F2'), 0.2, 1));

/* ---------------------------------------------------------------- bucles de hardcore (175, Fa menor) */
// Fam – Re♭ – Mi♭ – Do: el gancho del hoover en frases de 3 + 3 + 2
const HOOVER = [
  [0, 3, 'F2'], [3, 3, 'F2'], [6, 2, 'G#2'], [8, 3, 'C3'], [11, 3, 'G#2'], [14, 2, 'G2'],
  [16, 3, 'F2'], [19, 3, 'F2'], [22, 2, 'G#2'], [24, 3, 'C#3'], [27, 3, 'C3'], [30, 2, 'G#2'],
  [32, 3, 'G2'], [35, 3, 'G2'], [38, 2, 'A#2'], [40, 3, 'D#3'], [43, 3, 'C#3'], [46, 2, 'A#2'],
  [48, 3, 'G2'], [51, 3, 'C3'], [54, 2, 'E3'], [56, 4, 'G3'], [60, 2, 'F3'], [62, 2, 'E3']
];
const SCREECH = [
  [0, 2, 'F4'], [3, 2, 'F4'], [6, 2, 'G#4'], [10, 2, 'C5'], [12, 3, 'A#4'],
  [16, 2, 'F4'], [19, 2, 'F4'], [22, 2, 'G#4'], [26, 2, 'C#5'], [28, 3, 'C5'],
  [32, 2, 'G4'], [35, 2, 'G4'], [38, 2, 'A#4'], [42, 2, 'D#5'], [44, 3, 'C#5'],
  [48, 2, 'G4'], [51, 2, 'G4'], [54, 2, 'C5'], [58, 2, 'E5'], [60, 4, 'G5']
];
export const SCORES = { 'hd-hoover-riff': [HC, HOOVER], 'hd-screech-riff': [HC, SCREECH] };
const hooverRiff = () => loop(HC, 4, (c) => withRoom(R.playSt(HOOVER, { bpm: HC, steps: 64, cycles: c, voice: (f, g, v) => R.hoover(f, g, v, { seed: 41 }) }), 0.15, { size: 0.8, tail: 1.2 }));
const screechRiff = () => loop(HC, 4, (c) => {
  const x = S.play(SCREECH, { bpm: HC, steps: 64, cycles: c, voice: (f, g, v) => R.screech(f, g, v, { seed: 42 }) });
  return D.mixSt([D.widen(x, 0.4, 42), 1], [S.pingpong(x, HC, { div: 0.75, n: 3, fb: 0.4, gain: 0.22, lp: 5000 }), 1], [room(x, 0.7, 0.8), 0.1]);
});
// piano de happy hardcore: La♭ – Mi♭ – Fam – Re♭, acordes a 3 + 3 + 2 y octavas en la mano izquierda
const PCH = [['G#4', 'C5', 'D#5'], ['G4', 'A#4', 'D#5'], ['G#4', 'C5', 'F5'], ['G#4', 'C#5', 'F5']], PLO = [['G#2', 'G#3'], ['D#2', 'D#3'], ['F2', 'F3'], ['C#2', 'C#3']];
const PIANO = [];
PCH.forEach((ch, b) => {
  [[0, 1], [3, 0.75], [6, 0.85], [8, 1], [11, 0.75], [14, 0.85]].forEach(([s, v]) => PIANO.push([b * 16 + s, 1, ch, v]));
  PIANO.push([b * 16, 2, PLO[b], 0.85], [b * 16 + 8, 2, PLO[b], 0.8]);
});
// el remate de cada frase: una nota arriba en el último paso
PIANO.push([31, 1, 'G5', 0.7], [63, 1, 'G#5', 0.7]);
const pianoHappy = () => loop(HC, 4, (c) => {
  const x = S.play(PIANO, { bpm: HC, steps: 64, cycles: c, voice: (f, g, v) => R.ravePiano(f, g, v, { seed: 43 }) });
  return D.mixSt([D.widen(x, 0.3, 43), 1], [S.pingpong(x, HC, { div: 0.75, n: 2, fb: 0.3, gain: 0.07, lp: 6000 }), 1], [room(x, 0.5, 0.5), 0.09]);
});
// bajo a contratiempo que cae a cada nota, siguiendo los acordes (un compás por acorde)
const BASS = [];
['F2', 'C#2', 'D#2', 'C2'].forEach((n, b) => [2, 6, 10, 14].forEach((s) => BASS.push([b * 16 + s, 2, n, 1])));
const bassline = () => loop(HC, 4, (c) => S.play(BASS, { bpm: HC, steps: 64, cycles: c, voice: (f, g, v) => R.glideBass(f, g, v) }));
// wobble: Fa 1 con el paso bajo abriéndose y cerrándose a corcheas (y a semicorcheas en el último tiempo)
const wobble = () => loop(HC, 1, (c) => {
  const B = beat(HC), L = c * 4 * B + 0.3, f = S.freq('F1');
  let x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.6], [D.osc(L, f * 1.005, { shape: 'square', phase: 0.3 }), 0.5], [D.osc(L, f / 2, { shape: 'sine' }), 0.5]);
  const rate = (t) => ((t % (4 * B)) > 3 * B ? 4 : 2) / B;
  let ph = 0, last = 0;
  const cut = (t) => { ph += rate(t) * (t - last); last = t; return 150 + 2600 * Math.pow(0.5 - 0.5 * Math.cos(TAU * ph), 2); };
  x = D.filter(x, 'lp', cut, { q: 4 });
  x = D.map(x, (v) => Math.tanh(v * 4)); x = hclip(D.eq(x, 900, 5, 0.9), 1.6);
  return D.env(x, (t) => Math.min(1, t / 0.004) * (t < c * 4 * B ? 1 : 0));
});

/* ---------------------------------------------------------------- percusión */
function clap(seed = 51, { tone = 1100, tail = 0.13 } = {}) {
  const L = 0.6, nz = D.noise(L, seed);
  const bursts = (t) => [0, 0.009, 0.018, 0.028].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / 0.0035) * (t < 0.03 ? 1 : 0) : 0), 0) + (t > 0.028 ? 0.9 * Math.exp(-(t - 0.028) / tail) : 0);
  let x = D.env(D.hp(D.filter(nz, 'bp', tone, { q: 0.9 }), 500), bursts);
  const body = D.osc(L, D.sweep(260, 195, 0.02), { amp: D.ahd(0.001, 0.005, 0.05) });
  x = D.mix([x, 1], [body, 0.35]);
  x = D.tube(D.gain(x, 2), 3, 0.15); x = hclip(D.eq(x, 2400, 4, 1), 1.5);
  return finishSt(withRoom(D.widen(x, 0.4, seed), 0.22, { size: 0.65, tail: 0.6 }));
}
function snareHit(f = 190, seed = 52, { len = 0.32, room0 = 0.18 } = {}) {
  const tone = D.osc(len, D.sweep(f * 1.4, f, 0.015), { amp: D.ahd(0.001, 0.01, 0.08) });
  const nz = D.env(D.hp(D.noise(len, seed), 1400), D.ahd(0.001, 0.006, 0.12));
  let x = D.mix([tone, 0.8], [nz, 0.9]);
  x = D.tube(x, 2, 0.1); x = hclip(D.eq(x, 2600, 4, 1), 1.1);
  return room0 ? withRoom(D.widen(x, 0.3, seed), room0, { size: 0.6, tail: 0.5 }) : x;
}
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(L, seed, { mult = 2, hp = 7000, decay = 0.04, drive = 2 } = {}) {
  const r = D.rng(seed);
  let x = D.mix(...METAL.map((f) => [D.osc(L, f * mult, { shape: 'square', phase: r() }), 0.3]));
  x = D.hp(D.filter(x, 'bp', 10000, { q: 0.7 }), hp);
  x = D.mix([x, 1], [D.hp(D.noise(L, seed + 1), 9000), 0.3]);
  return D.env(D.map(x, (v) => Math.tanh(v * drive)), D.ahd(0.0005, 0.002, decay));
}
const hat = () => finishSt(D.widen(metal(0.2, 53), 0.3, 53));
const hatOpen = () => finishSt(D.widen(metal(0.7, 54, { decay: 0.24 }), 0.4, 54));
function crash(seed = 55, L = 2.6) {
  const x = D.mix([metal(L, seed, { mult: 2.7, hp: 3500, decay: 0.9, drive: 1.6 }), 1], [D.env(D.hp(D.noise(L, seed + 2), 4000), D.ahd(0.001, 0.02, 0.8)), 0.5]);
  return withRoom(D.widen(x, 0.7, seed), 0.15, { size: 0.8, tail: 1.2 });
}
function ride() {
  const L = 1.6, r = D.rng(56);
  const ping = D.mix(...[1, 1.47, 2.09, 2.56, 3.19].map((m, k) => [D.osc(L, 3150 * m / 1.47, { phase: r(), amp: D.expEnv(0.5 / (1 + k * 0.4)) }), 0.25]));
  const x = D.mix([ping, 0.7], [metal(L, 57, { mult: 3, hp: 5000, decay: 0.55, drive: 1.3 }), 0.8]);
  return finishSt(D.widen(D.map(x, (v) => Math.tanh(v * 1.5)), 0.4, 56));
}
function roll() {
  // un compás a 175: corcheas, semicorcheas y fusas, subiendo de tono y de volumen
  const B = beat(HC), sd = B / 4, out = [], L = 4 * B + 0.5;
  const hits = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((k) => k * sd / 2);
  hits.forEach((t, k) => { const u = t / (4 * B); out.push([mono(snareHit(190 * Math.pow(2, (u * 7) / 12), 60 + k, { len: 0.2, room0: 0 })), 0.45 + 0.55 * u, t]); });
  let x = D.mix(...out); x = D.pad(x, L);
  return finishSt(withRoom(D.widen(x, 0.3, 61), 0.14));
}
function htPerc() {
  const L = 0.4, n = D.secs(L), o = new Float64Array(n);
  let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, fc = 170 + 140 * Math.exp(-t / 0.02), I = 3.2 * Math.exp(-t / 0.05); o[i] = Math.sin(TAU * pc + I * Math.sin(TAU * pm)) * Math.exp(-t / 0.12); pc += fc / SR; pm += fc * 1.47 / SR; pc -= Math.floor(pc); pm -= Math.floor(pm); }
  const x = hclip(D.tube(D.gain(o, 2), 3, 0.2), 1.3);
  return finishSt(withRoom(D.widen(D.hp(x, 90), 0.3, 62), 0.25, { size: 0.82, tail: 1.1, damp: 0.6 }));
}
// charles de hard techno: semicorcheas, abierto a contratiempo, con acentos
const htHats = () => loop(HT, 1, (c) => {
  const sd = beat(HT) / 4, parts = [], cl = mono(D.widen(metal(0.12, 63), 0.2, 63)), op = mono(metal(0.4, 64, { decay: 0.16 }));
  for (let k = 0; k < 16 * c; k++) parts.push(k % 4 === 2 ? [op, 0.8, k * sd] : [cl, [0.55, 0.35, 0, 0.45][k % 4], k * sd]);
  const x = D.mix(...parts);
  return D.mixSt([D.widen(x, 0.4, 65), 1], [room(x, 0.6, 0.5), 0.1]);
});

/* ---------------------------------------------------------------- efectos */
function riser(bpm = HC) {
  // dos compases: ruido que se abre, una sierra que sube dos octavas cada vez más distorsionada, y el filtro al final
  const L = 8 * beat(bpm);
  const nz = D.env(D.filter(D.noise(L, 71), 'bp', D.ramp(300, 9000, L, 2), { q: D.ramp(1.2, 4, L) }), D.ramp(0.1, 1, L, 1.6));
  const saw = D.mix([D.osc(L, (t) => S.freq('F2') * Math.pow(4, Math.pow(t / L, 1.6)), { shape: 'saw' }), 0.5], [D.osc(L, (t) => S.freq('F2') * 1.01 * Math.pow(4, Math.pow(t / L, 1.6)), { shape: 'saw', phase: 0.4 }), 0.5]);
  const sd = D.map(saw, (v, i) => Math.tanh(v * (1 + 8 * Math.pow(i / saw.length, 2))) * Math.pow(i / saw.length, 1.2));
  const x = D.mix([D.hp(nz, 150), 0.9], [D.lp(sd, 7000), 0.5]);
  return finishSt(D.mixSt([D.widen(x, 0.8, 71), 1], [room(x, 0.7, 0.6), 0.15]), { release: 0.02 });
}
function impact() {
  const k = mono(kick('hd-kick-gabber'));
  const sub = D.osc(2.2, D.sweep(120, 30, 0.35), { amp: D.ahd(0.001, 0.2, 0.7) });
  let x = D.mix([k, 0.8], [D.tube(sub, 2.5, 0.1), 0.8], [mono(crash(72, 2.2)), 0.45]);
  x = D.lp(hclip(x, 1.4), 12000);
  return finishSt(D.mixSt([D.widen(x, 0.4, 72), 1], [room(x, 0.88, 2), 0.35]));
}
function downlifter() {
  const L = 2.4;
  const nz = D.env(D.filter(D.noise(L, 73), 'bp', D.sweep(8000, 140, 0.8), { q: 2 }), D.ahd(0.01, 0.15, 0.9));
  const tone = D.osc(L, D.sweep(900, 45, 0.6), { shape: 'saw', amp: D.ahd(0.01, 0.1, 0.7) });
  const x = D.mix([nz, 1], [D.map(D.lp(tone, 2500), (v) => Math.tanh(v * 3)), 0.35]);
  return finishSt(D.mixSt([D.widen(x, 0.8, 73), 1], [room(x, 0.85, 1), 0.25]));
}
function siren() {
  // sirena antiaérea: dos sierras que suben y bajan despacio (dos compases a 175), distorsionadas
  const L = 8 * beat(HC), f = (t) => 380 + 520 * (0.5 - 0.5 * Math.cos(TAU * t / (L / 2)));
  let x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.5], [D.osc(L, (t) => f(t) * 1.012, { shape: 'saw', phase: 0.3 }), 0.5], [D.osc(L, (t) => f(t) / 2, { shape: 'square' }), 0.3]);
  x = D.lp(D.map(x, (v) => Math.tanh(v * 3)), 4500, 1.2);
  x = D.env(x, (t) => Math.min(1, t / 0.4) * Math.min(1, (L - t) / 0.4));
  return finishSt(D.mixSt([D.widen(x, 0.6, 74), 1], [S.pingpong(x, HC, { div: 0.75, n: 3, fb: 0.4, gain: 0.25 }), 1], [room(x, 0.8, 1.2), 0.2]));
}
function laser() {
  const L = 0.35, x = D.osc(L, D.sweep(3200, 110, 0.045), { shape: 'saw', amp: D.ahd(0.001, 0.02, 0.1) });
  const y = D.lp(D.map(x, (v) => Math.tanh(v * 4)), 8000);
  return finishSt(D.mixSt([D.widen(y, 0.3, 75), 1], [S.pingpong(y, HC, { div: 0.5, n: 4, fb: 0.5, gain: 0.45, lp: 5000 }), 1]));
}
function reverseCrash() {
  const L = 2 * beat(HC), c = crash(76, L + 1.5);
  const rev = (x) => D.fades(D.reverse(x.slice(0, D.secs(L))), 0.02, 0.004);
  return finishSt(D.stereo(rev(c.L), rev(c.R)));
}

/* ---------------------------------------------------------------- hard techno (150, Fa menor) */
// rumble: la sala del kick, distorsionada, filtrada a ~120 Hz y empujada por el propio kick
function rumble(withKick) {
  return () => loop(HT, 1, (c) => {
    const B = beat(HT), n = D.secs(4 * c * B + 2.2), k = kick('ht-kick-f'), Lk = new Float64Array(n), Rk = new Float64Array(n);
    for (let i = 0; i < 4 * c + 1; i++) { const o = Math.round(i * B * SR), len = Math.min(k.L.length, Math.round(B * SR)); for (let j = 0; j < len && o + j < n; j++) { const w = j > len - 200 ? (len - j) / 200 : 1; Lk[o + j] += k.L[j] * w; Rk[o + j] += k.R[j] * w; } }
    const w = D.reverb(D.mix([Lk, 0.5], [Rk, 0.5]), { size: 0.93, damp: 0.6, tail: 1.8, pre: 0.02 });
    let r = D.mix([w.L, 0.5], [w.R, 0.5]).slice(0, n);
    r = D.tube(D.gain(r, 14), 3, 0.1); r = D.lp(D.lp(r, 130, 0.9), 160, 0.8); r = D.hp(r, 32);
    // el kick empuja al rumble: baja en 5 ms justo antes de cada tiempo (sin el fundido, chasquea) y vuelve en ~0,6 tiempos
    r = D.map(r, (v, i) => { const t = (i / SR + 0.005) % B, g = t < 0.005 ? 1 - 0.97 * (t / 0.005) : 1 - 0.97 * Math.pow(Math.max(0, 1 - (t - 0.005) / (B * 0.6)), 1.4); return v * g; });
    let pk = 1e-9; for (const v of r) pk = Math.max(pk, Math.abs(v));
    r = D.map(r, (v) => Math.tanh((v / pk) * 1.6) * 0.7);
    return withKick ? D.stereo(D.mix([Lk, 0.85], [r, 1]), D.mix([Rk, 0.85], [r, 1])) : D.stereo(r, Float64Array.from(r));
  });
}
const ACID = [
  [0, 1, 'F2', 1], [2, 1, 'F2', 0.6], [3, 1, 'F3', 1, { slide: true }], [4, 1, 'F2', 0.6], [6, 1, 'G#2', 1], [7, 1, 'F2', 0.6],
  [8, 2, 'C3', 1], [10, 1, 'F2', 0.6], [11, 1, 'D#3', 1, { slide: true }], [12, 1, 'F2', 0.6], [14, 1, 'F#2', 1], [15, 1, 'F2', 0.6],
  [16, 1, 'F2', 1], [18, 1, 'F2', 0.6], [19, 1, 'G#3', 1, { slide: true }], [20, 1, 'F3', 0.6, { slide: true }], [22, 1, 'C3', 1], [23, 1, 'F2', 0.6],
  [24, 1, 'D#3', 1], [25, 1, 'C3', 0.6, { slide: true }], [26, 1, 'F2', 0.6], [27, 2, 'F#2', 1], [30, 1, 'C3', 1], [31, 1, 'F2', 0.6]
];
SCORES['ht-acid'] = [HT, ACID];
const acid = () => loop(HT, 2, (c) => {
  let x = S.acidLine(ACID, { bpm: HT, steps: 32, cycles: c, cutoff: 320, envMod: 3200, q: 11, decay: 0.12 });
  x = D.map(D.hp(x, 70), (v) => Math.tanh(v * 2.6)); x = D.eq(x, 1200, 4, 0.9);
  return D.mixSt([D.widen(x, 0.25, 81), 1], [S.pingpong(x, HT, { div: 0.75, n: 4, fb: 0.45, gain: 0.25, lp: 3500 }), 1], [room(x, 0.7, 0.8), 0.1]);
});
function stab() {
  // Fam oscuro: sierras y FM metálica, distorsionado, con una sala larga y oscura
  const L = 1.2, ch = ['F3', 'G#3', 'C4'].map(S.freq), parts = [];
  ch.forEach((f, k) => {
    parts.push([D.osc(L, f * 1.004, { shape: 'saw', phase: k * 0.2 }), 0.3], [D.osc(L, f * 0.996, { shape: 'saw', phase: k * 0.37 }), 0.3]);
    const n = D.secs(L), o = new Float64Array(n); let pc = 0, pm = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, I = 2.5 * Math.exp(-t / 0.08); o[i] = Math.sin(TAU * pc + I * Math.sin(TAU * pm)); pc += f / SR; pm += f * 3.5 / SR; pc -= Math.floor(pc); pm -= Math.floor(pm); }
    parts.push([o, 0.35]);
  });
  let x = D.mix(...parts);
  x = D.filter(x, 'lp', D.sweep(6000, 900, 0.08), { q: 2 });
  x = D.env(D.map(x, (v) => Math.tanh(v * 2.5)), D.ahd(0.002, 0.03, 0.18));
  return finishSt(D.mixSt([D.widen(x, 0.5, 82), 1], [room(x, 0.9, 1.8, 0.65), 0.45]));
}

/* ---------------------------------------------------------------- voces */
const grito = () => finishSt(withRoom(D.widen(R.darkScream(0.95, { f0: 150, to: 98, seed: 91 }), 0.35, 91), 0.2, { size: 0.82, tail: 1.2, damp: 0.6 }));
const growl = () => finishSt(withRoom(D.widen(R.darkScream(1.1, { f0: 95, to: 72, seed: 92, vowels: [[0, 'o'], [0.5, 'u']], growl: 0.8, rasp: 0.5 }), 0.3, 92), 0.22, { size: 0.85, tail: 1.3, damp: 0.65 }));

/* ---------------------------------------------------------------- catálogo */
const Kk = (o) => ({ cat: 'kick', type: 'kick', style: 'hardcore', ...o });
const Lp = (o) => ({ cat: 'loop', loop: true, style: 'hardcore', tonality: 'Fa menor', bpm: [HC, HC], bars: 4, ...o });
const tg = (...t) => ['hardcore duro', ...t];
export const SAMPLES = [
  Kk({ id: 'hd-kick-early', name: 'Kick early (Fa)', key: 'F1', bpm: [160, 180], tags: tg('early', 'rotterdam', '909'), ...LK('harmony-09/hd-kick-early'),
    notes: 'El punto de partida «Early / Rotterdam» del Laboratorio de kicks: un 909 en Fa 1 que se apaga despacio, saturado y recortado, con grano y medios.' }),
  Kk({ id: 'hd-kick-gabber', name: 'Kick gabber 909 (Sol)', key: 'G1', bpm: [175, 195], tags: tg('gabber', '909', 'cuadrada'), ...LK('harmony-09/hd-kick-gabber'),
    notes: 'Gabber 909 en Sol 1: rumble antes de distorsionar, medios muy realzados, grano y recorte final casi cuadrado.' }),
  Kk({ id: 'hd-kick-gabber-f', name: 'Kick gabber 909 (Fa)', key: 'F1', bpm: [175, 195], tags: tg('gabber', '909'), ...LK('harmony-09/hd-kick-gabber-f'),
    notes: 'El mismo gabber en Fa 1, para la tonalidad de los bucles del pack.' }),
  Kk({ id: 'hd-kick-mainstream', name: 'Kick mainstream (Fa#)', key: 'F#1', bpm: [165, 180], tags: tg('mainstream', 'sostenido'), ...LK('harmony-09/hd-kick-mainstream'),
    notes: 'Mainstream en Fa# 1: cola sostenida, cuadrada en la fuente, plegado, mucho grano y el hueco en 130–400 Hz.' }),
  Kk({ id: 'hd-kick-mainstream-f', name: 'Kick mainstream (Fa)', key: 'F1', bpm: [165, 180], tags: tg('mainstream'), ...LK('harmony-09/hd-kick-mainstream-f'),
    notes: 'El mainstream en Fa 1.' }),
  Kk({ id: 'hd-kick-industrial', name: 'Kick industrial (Mi)', key: 'E1', bpm: [140, 170], tags: tg('industrial', 'rumble', 'bits'), ...LK('harmony-09/hd-kick-industrial'),
    notes: 'Industrial en Mi 1: mucho rumble, 6 bits, válvula y oscuro.' }),
  Kk({ id: 'hd-kick-crossbreed', name: 'Kick crossbreed (Sol)', key: 'G1', bpm: [170, 178], tags: tg('crossbreed', 'plegado'), ...LK('harmony-09/hd-kick-crossbreed'),
    notes: 'Crossbreed en Sol 1: corto, plegado, con mucho tok y tick.' }),
  Kk({ id: 'hd-kick-terror', name: 'Kick terror (La)', key: 'A1', bpm: [220, 260], tags: tg('terror', 'speedcore', 'corto'), ...LK('harmony-09/hd-kick-terror'),
    notes: 'Terror en La 1: muy corto, 8 bits, plegado y recortado a tope.' }),
  Kk({ id: 'ht-kick', name: 'Kick hard techno (Sol)', style: 'techno', key: 'G1', bpm: [140, 155], tags: ['hard techno', 'industrial', 'punch'], ...LK('harmony-09/ht-kick'),
    notes: 'Kick de hard techno en Sol 1: corto, con mucho punch, saturado y algo oscuro.' }),
  Kk({ id: 'ht-kick-f', name: 'Kick hard techno (Fa)', style: 'techno', key: 'F1', bpm: [140, 155], tags: ['hard techno', 'industrial'], ...LK('harmony-09/ht-kick-f'),
    notes: 'El kick de hard techno en Fa 1, el de los bucles de rumble.' }),
  { id: 'hd-hoover', name: 'Hoover (Do 3)', type: 'sintetizador', cat: 'fx', style: 'hardcore', key: 'C3', tags: tg('hoover', 'rave', 'nota'), render: hooverNote,
    notes: 'Una nota de hoover en Do 3 para tocar con el piano roll: pulso-sierra ×3 (±40 cents y una octava abajo) con ancho modulado, unísono en estéreo, subida de 5 semitonos que vuelve a la nota, coro y saturación.' },
  { id: 'hd-screech', name: 'Screech (Do 4)', type: 'sintetizador', cat: 'fx', style: 'hardcore', key: 'C4', tags: tg('screech', 'nota'), render: screechNote,
    notes: 'Screech en Do 4 para el piano roll: sierras por un paso banda muy resonante que baja y tiembla, con el cuerpo en la nota, muy saturado.' },
  { id: 'hd-raw-lead', name: 'Lead raw (Do 4)', type: 'sintetizador', cat: 'fx', style: 'hardcore', key: 'C4', tags: tg('lead', 'raw', 'nota'), render: rawNote,
    notes: 'Lead raw en Do 4 para el piano roll: supersierra de 7 voces y cuadrada una octava abajo, dos distorsiones y los medios realzados.' },
  { id: 'hd-piano', name: 'Piano de rave (Do 4)', type: 'nota', cat: 'fx', style: 'hardcore', key: 'C4', tags: tg('piano', 'happy hardcore', 'nota'), render: pianoNote,
    notes: 'Piano de rave en Do 4 para el piano roll: dos cuerdas por nota, martillo brillante, −4 dB en 500 Hz, +5 dB en 2,5 kHz, saturación y sala corta.' },
  { id: 'hd-bajo', name: 'Bajo que cae (Fa 2)', type: 'bajo', cat: 'bajo', style: 'hardcore', key: 'F2', bpm: [HC, HC], tags: tg('bajo', 'contratiempo', 'nota'), render: bassNote,
    notes: 'Una corchea de bajo distorsionado en Fa 2 que cae a la nota desde un semitono arriba: el bajo a contratiempo del hardcore; con el piano roll sigue los acordes.' },
  Lp({ id: 'hd-hoover-riff', name: 'Riff de hoover', type: 'melodía', tags: tg('hoover', 'riff'), render: hooverRiff,
    notes: 'El gancho en frases de 3 + 3 + 2 sobre Fam – Re♭ – Mi♭ – Do, con el hoover del pack.' }),
  Lp({ id: 'hd-screech-riff', name: 'Riff de screech', type: 'melodía', tags: tg('screech', 'riff'), render: screechRiff,
    notes: 'Screech a golpes sincopados sobre los mismos acordes, con eco ping-pong.' }),
  Lp({ id: 'hd-piano-happy', name: 'Piano de happy hardcore', type: 'acordes', tonality: 'La♭ mayor', tags: tg('piano', 'happy hardcore', 'acordes'), render: pianoHappy,
    notes: 'La♭ – Mi♭ – Fam – Re♭ en acordes de piano de rave a 3 + 3 + 2, octavas en la izquierda y un remate arriba al final de cada frase.' }),
  Lp({ id: 'hd-bajo-linea', name: 'Bajo a contratiempo', type: 'línea', cat: 'bajo', tags: tg('bajo', 'contratiempo'), render: bassline,
    notes: 'El bajo que cae a la nota, a contratiempo, un compás en cada acorde (Fa, Re♭, Mi♭, Do).' }),
  Lp({ id: 'hd-wobble', name: 'Wobble (Fa)', type: 'línea', cat: 'bajo', bars: 1, tags: tg('wobble', 'bajo'), render: wobble,
    notes: 'Un compás de bajo en Fa 1 con el paso bajo abriéndose y cerrándose a corcheas (a semicorcheas en el último tiempo), distorsionado.' }),
  { id: 'hd-palma', name: 'Palma hardcore', type: 'palma', cat: 'perc', style: 'hardcore', tags: tg('clap'), render: () => clap(51),
    notes: 'Cuatro ráfagas de ruido y un cuerpo de caja, con válvula, recorte y sala corta.' },
  { id: 'hd-palma-grande', name: 'Palma grande', type: 'palma', cat: 'perc', style: 'hardcore', tags: tg('clap', 'sala'), render: () => clap(58, { tone: 900, tail: 0.22 }),
    notes: 'La palma más grave y larga, para el break.' },
  { id: 'hd-caja', name: 'Caja hardcore', type: 'caja', cat: 'perc', style: 'hardcore', tags: tg('snare'), render: () => finishSt(snareHit()),
    notes: 'Tono que cae a 190 Hz y ruido por encima de 1,4 kHz, con válvula y recorte.' },
  { id: 'hd-charles', name: 'Charles cerrado', type: 'charles', cat: 'perc', style: 'hardcore', tags: tg('hi-hat'), render: hat,
    notes: 'Seis cuadradas inarmónicas (las del charles de caja de ritmos) y ruido por encima de 7 kHz, saturado.' },
  { id: 'hd-charles-abierto', name: 'Charles abierto', type: 'charles', cat: 'perc', style: 'hardcore', tags: tg('hi-hat', 'abierto'), render: hatOpen,
    notes: 'El mismo metal con 240 ms de caída.' },
  { id: 'hd-plato', name: 'Plato', type: 'plato', cat: 'perc', style: 'hardcore', tags: tg('crash'), render: () => finishSt(crash()),
    notes: 'Metal inarmónico más agudo y ruido, con dos segundos de caída.' },
  { id: 'ht-ride', name: 'Ride de hard techno', type: 'plato', cat: 'perc', style: 'techno', tags: ['hard techno', 'ride'], render: ride,
    notes: 'Campana de ride (cinco parciales) y metal, saturado: para las semicorcheas del hard techno.' },
  { id: 'hd-redoble', name: 'Redoble de caja', type: 'redoble', cat: 'perc', style: 'hardcore', bpm: [HC, HC], tags: tg('fill', 'redoble'), render: roll,
    notes: 'Un compás a 175: corcheas, semicorcheas y fusas de caja, subiendo siete semitonos y de volumen.' },
  { id: 'ht-percusion', name: 'Golpe metálico', type: 'percusión', cat: 'perc', style: 'techno', tags: ['hard techno', 'industrial', 'metal'], render: htPerc,
    notes: 'Tom FM metálico (moduladora a 1,47×) que cae, saturado, con una sala de nave.' },
  { id: 'ht-charles', name: 'Charles de hard techno', type: 'charles', cat: 'loop', loop: true, style: 'techno', bpm: [HT, HT], bars: 1, tonality: 'Fa menor', tags: ['hard techno', 'semicorcheas'], render: htHats,
    notes: 'Un compás a 150: semicorcheas con acentos y el abierto a contratiempo.' },
  { id: 'hd-subida', name: 'Subida distorsionada', type: 'subida', cat: 'fx', style: 'hardcore', bpm: [HC, HC], tags: tg('riser'), render: () => riser(HC),
    notes: 'Dos compases a 175: ruido que se abre y dos sierras que suben dos octavas, cada vez más distorsionadas.' },
  { id: 'ht-subida', name: 'Subida de hard techno', type: 'subida', cat: 'fx', style: 'techno', bpm: [HT, HT], tags: ['hard techno', 'riser'], render: () => riser(HT),
    notes: 'La subida distorsionada en dos compases a 150.' },
  { id: 'hd-impacto', name: 'Impacto con kick', type: 'impacto', cat: 'fx', style: 'hardcore', tags: tg('impacto', 'drop'), render: impact,
    notes: 'El kick gabber, un sub que cae y un plato, recortado, con una sala grande: para el primer tiempo del drop.' },
  { id: 'hd-bajada', name: 'Bajada', type: 'transición', cat: 'fx', style: 'hardcore', tags: tg('downlifter'), render: downlifter,
    notes: 'Ruido y una sierra que caen en dos segundos: para salir del drop.' },
  { id: 'hd-sirena', name: 'Sirena antiaérea', type: 'efecto', cat: 'fx', style: 'hardcore', bpm: [HC, HC], tags: tg('sirena', 'rave'), render: siren,
    notes: 'Dos compases a 175: dos sierras que suben y bajan despacio, distorsionadas, con eco.' },
  { id: 'hd-laser', name: 'Láser', type: 'efecto', cat: 'fx', style: 'hardcore', tags: tg('láser', 'zap'), render: laser,
    notes: 'Una sierra que cae de 3,2 kHz a 110 Hz en unos 50 ms, saturada, con eco a corchea.' },
  { id: 'hd-plato-reves', name: 'Plato al revés', type: 'transición', cat: 'fx', style: 'hardcore', bpm: [HC, HC], tags: tg('reverse'), render: reverseCrash,
    notes: 'Dos tiempos a 175: el plato al revés, que crece hasta el golpe.' },
  { id: 'ht-rumble', name: 'Kick con rumble', type: 'kick', cat: 'loop', loop: true, style: 'techno', bpm: [HT, HT], bars: 1, tonality: 'Fa menor', tags: ['hard techno', 'rumble', 'industrial'], render: rumble(true),
    notes: 'Un compás a 150: el kick de hard techno en Fa a negras y su rumble (la sala del kick, distorsionada, filtrada a ~130 Hz y empujada por el kick).' },
  { id: 'ht-rumble-solo', name: 'Rumble solo', type: 'línea', cat: 'bajo', loop: true, style: 'techno', bpm: [HT, HT], bars: 1, tonality: 'Fa menor', tags: ['hard techno', 'rumble'], render: rumble(false),
    notes: 'El rumble sin el kick, para ponerlo debajo de cualquier kick a 150.' },
  { id: 'ht-acid', name: 'Acid de hard techno', type: 'línea', cat: 'loop', loop: true, style: 'techno', bpm: [HT, HT], bars: 2, tonality: 'Fa menor', tags: ['hard techno', 'acid', '303'], render: acid,
    notes: 'Dos compases a 150: una línea acid en Fa (con el Sol♭ frigio) con acentos y ligados, distorsionada y con eco.' },
  { id: 'ht-stab', name: 'Stab oscuro (Fam)', type: 'stab', cat: 'fx', style: 'techno', key: 'F3', tags: ['hard techno', 'stab', 'industrial'], render: stab,
    notes: 'Acorde de Fa menor en sierras y FM metálica, con un paso bajo que se cierra, distorsionado y con una sala larga y oscura.' },
  { id: 'hd-grito', name: 'Grito oscuro', type: 'grito', cat: 'voz', style: 'hardcore', tags: tg('grito', 'oscuro'), render: grito,
    notes: 'Voz de bajo sintética (de «a» a «o») que cae de tono, con gruñido y ruido áspero, distorsionada y sin agudos: el peso entre 700 Hz y 1,6 kHz.' },
  { id: 'hd-grunido', name: 'Gruñido', type: 'grito', cat: 'voz', style: 'hardcore', tags: tg('grito', 'gruñido', 'oscuro'), render: growl,
    notes: 'El grito oscuro más grave y largo («o» a «u»), con más gruñido.' }
];
