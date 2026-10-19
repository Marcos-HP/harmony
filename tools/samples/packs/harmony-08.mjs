/* HARMONY 08 · Himnos (uptempo y frenchcore)
   Todo a 200 BPM en Re menor sobre Rem – Si♭ – Fa – Do (i – VI – III – VII, la progresión épica), para los presets
   «Uptempo himno» y «Frenchcore himno».
   Los kicks salen del motor de tools/samples/hard.mjs, que sigue cómo los hacen los productores (bajo sostenido con
   caída de tono, reflexiones antes de distorsionar, banda resonante antes de cada distorsión, tok limpio aparte,
   graves en mono, compresión tipo OTT). Cada kick está afinado a la raíz de un acorde, para que el kick siga la
   armonía como en los temas de verdad. La melodía del himno es de Harmony. */
import * as D from '../dsp.mjs';
import * as S from '../synth.mjs';
import * as V from '../voice.mjs';
import * as K from '../hard.mjs';

export const PACK = {
  id: 'harmony-08',
  name: 'Harmony 08',
  title: 'Himnos: uptempo y frenchcore',
  version: '1.0.0',
  date: '2026-10-19',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis y procesado digital en tools/samples/ (Harmony): kicks con el motor de hard.mjs, hecho a partir de cómo se diseñan los kicks de uptempo y frenchcore. Melodías compuestas para Harmony; sin grabaciones ni samples de terceros.',
  credits: 'Harmony'
};

const BPM = 200, SR = D.SR, BEAT = 60 / BPM, BAR = BEAT * 4;
const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));
const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
const room = (x, size = 0.8, tail = 1.4, damp = 0.45) => D.reverb(x.L ? mono(x) : x, { size, damp, tail, pre: 0.012 });
function finish(x, { tailDb = -66, peak = -1, release = 0 } = {}) {
  if (x.L) return finishSt(x, { tailDb, peak, release });
  let y = D.dcBlock(x);
  if (release) y = D.fadeEnd(y, release);
  y = D.fades(D.trimTail(y, tailDb));
  y = D.limit(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function finishSt(s, { tailDb = -66, peak = -1, release = 0 } = {}) {
  s = D.same(s.L ? s : D.stereo(s, Float64Array.from(s)));
  let L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  if (release) { L0 = D.fadeEnd(L0, release); R0 = D.fadeEnd(R0, release); }
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0008, 0.02), D.fades(R0.slice(0, n), 0.0008, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function loop(bars, build) {
  let s = build(2);
  s = D.same(s.L ? s : D.stereo(s, Float64Array.from(s)));
  s = D.stereo(D.dcBlock(s.L), D.dcBlock(s.R));
  s = D.limitSt(s, -0.7);
  s = S.loopCut(s, BPM, bars);
  s = D.normalizeTP(s, -1);
  return D.stereo(D.fades(s.L, 0.0015, 0.0015), D.fades(s.R, 0.0015, 0.0015));
}
const wide = (notes, o, voice) => D.same(D.stereo(S.play(notes, { ...o, voice: voice(1) }), S.play(notes, { ...o, voice: voice(2) })));

/* ---------------------------------------------------------------- armonía y melodía */
const ROOTS = ['D', 'A#', 'F', 'C'];   // Rem – Si♭ – Fa – Do
const CH = [['D4', 'F4', 'A4'], ['D4', 'F4', 'A#4'], ['C4', 'F4', 'A4'], ['C4', 'E4', 'G4']];   // voces cercanas, sin saltos
const LOWS = ['D3', 'A#2', 'F3', 'C3'];
/* el gancho: frases de 3 + 3 + 2 (la síncopa del hardcore), pregunta en los dos primeros compases y respuesta arriba */
const HOOK = [
  [0, 3, 'A4'], [3, 3, 'A4'], [6, 2, 'D5'], [8, 2, 'C5'], [10, 2, 'A4'], [12, 2, 'F4'], [14, 2, 'G4'],
  [16, 3, 'F4'], [19, 3, 'F4'], [22, 2, 'A#4'], [24, 2, 'A4'], [26, 2, 'G4'], [28, 2, 'F4'], [30, 2, 'D4'],
  [32, 3, 'C5'], [35, 3, 'C5'], [38, 2, 'F5'], [40, 2, 'E5'], [42, 2, 'C5'], [44, 2, 'A4'], [46, 2, 'C5'],
  [48, 3, 'E5'], [51, 3, 'D5'], [54, 2, 'C5'], [56, 3, 'E5'], [59, 3, 'F5'], [62, 2, 'E5']
];
export const SCORES = { 'himno-lead': [BPM, HOOK] };

/* ---------------------------------------------------------------- kicks */
const KEYS = [['D2', 'Re'], ['A#1', 'Si♭'], ['F2', 'Fa'], ['C2', 'Do']];
// menos sub y más medios que el kick por defecto: en el uptempo el carácter está en los medios
const upKick = (note, o = {}) => () => finish(K.hardKick(note, { len: BEAT, seed: 11, low: 0.45, mids: 11, drive1: 11, scoop300: -2, ...o }), { release: 0.02 });
const fcKick = () => finish(K.frenchKick('D2', { len: BEAT, bpm: BPM, seed: 21 }), { release: 0.02 });
/* bajo de frenchcore: la cola del kick duro sin tok, una corchea, a contratiempo */
const fcBass = (note) => () => {
  const b = K.hardKick(note, { len: BEAT / 2, from: note.replace(/\d$/, (d) => +d + 2), drop: 0.03, tok: 0, tick: 0, move: 'hold', refl: 0.4, drive1: 11, seed: 31 });
  const env = (t) => Math.min(1, t / 0.004) * (t < BEAT * 0.38 ? 1 : Math.max(0, 1 - (t - BEAT * 0.38) / (BEAT * 0.12)));
  return finish(D.stereo(D.env(b.L, env), D.env(b.R, env)), { release: 0.01 });
};

/* ---------------------------------------------------------------- melodías y armonía (4 compases) */
function lead() {
  return loop(4, (cycles) => {
    const o = { bpm: BPM, steps: 64, cycles, gateScale: 0.94 };
    // la voz del himno con los medios por delante (es lo que da el carácter al uptempo) y un screech debajo que muerde
    const x = wide(HOOK, o, (seed) => K.anthemVoice(seed * 7 + 1, { fgain: [12, 9], sub: 0.12, drive: 3.4 }));
    const bite = S.play(HOOK, { ...o, voice: (f, g, v) => S.screech(f, g, v, { from: 5, to: 2.6, q: 7, drive: 2.5 }) });
    // su octava, fina y por debajo: da brillo sin tapar
    const oct = S.play(HOOK.map(([s, l, p]) => [s, l, S.midi(p) + 12, 0.35]), { ...o, voice: K.anthemVoice(9, { voices: 3, spread: 8, scoop: 0, sub: 0, drive: 1.3 }) });
    const all = D.mixSt([x, 1], [D.stereo(oct, Float64Array.from(oct)), 0.3], [D.stereo(bite, Float64Array.from(bite)), 0.35]);
    const pumped = D.applySt(all, (c) => S.pump(c, BPM, { depth: 0.45, rel: 0.13 }));
    return D.mixSt([pumped, 1], [room(all, 0.86, 1.6, 0.5), 0.2], [S.pingpong(mono(all), BPM, { div: 0.75, n: 3, gain: 0.16, lp: 5000 }), 1]);
  });
}
function chords() {
  // acordes de supersierra largos y abiertos, con mucha sala (intro y break)
  return loop(4, (cycles) => {
    const notes = CH.flatMap((c, b) => [[b * 16, 15.5, c, 0.8], [b * 16, 15.5, [LOWS[b]], 0.55]]);
    const x = wide(notes, { bpm: BPM, steps: 64, cycles }, (seed) => (f, g, v) => S.supersaw(f, g, v, { seed: seed * 13 + 3, n: 7, spread: 32, cutoff: 4800, env: { a: 0.03, d: 0.3, s: 0.8, r: 0.35 } }));
    return D.mixSt([x, 1], [room(x, 0.9, 2.4, 0.5), 0.35]);
  });
}
function choir() {
  // coro «aah» que sigue los acordes compás a compás (tenores abajo, sopranos arriba)
  return loop(4, (cycles) => {
    const L = BAR + 0.25, parts = [];
    for (let c = 0; c < cycles; c++) for (let b = 0; b < 4; b++) {
      const amp = (t) => Math.min(1, t / 0.12) * (t > BAR ? Math.max(0, 1 - (t - BAR) / 0.25) : 1);
      const hi = V.choir(L, CH[b].map(S.freq), { reg: 'soprano', vowel: 'a', voices: 3, seed: 100 + b, amp });
      const lo = V.choir(L, [S.freq(LOWS[b])], { reg: 'tenor', vowel: 'a', voices: 3, seed: 200 + b, amp });
      parts.push([D.mixSt([hi, 0.75], [lo, 0.8]), (c * 4 + b) * BAR]);
    }
    const n = Math.max(...parts.map(([s, t]) => s.L.length + D.secs(t)));
    const L2 = new Float64Array(n), R2 = new Float64Array(n);
    for (const [s, t] of parts) { const o = D.secs(t); for (let i = 0; i < s.L.length; i++) { L2[o + i] += s.L[i]; R2[o + i] += s.R[i]; } }
    const st = D.applySt(D.stereo(L2, R2), (ch) => D.shelf(D.eq(ch, 3200, 3, 0.8), 'highshelf', 5000, 5));
    return D.mixSt([st, 1], [room(st, 0.9, 2.4), 0.35]);
  });
}
function piano() {
  // piano del break: acordes a «1 · y del 2 · 4» y el gancho arriba, con sala
  return loop(4, (cycles) => {
    const chordsN = CH.flatMap((c, b) => [0, 6, 12].map((s) => [b * 16 + s, s === 12 ? 4 : 6, [LOWS[b], ...c], 0.55]));
    const mel = HOOK.map(([s, l, p]) => [s, l + 1, S.midi(p) + 12, 0.85]);
    const x = S.play([...chordsN, ...mel], { bpm: BPM, steps: 64, cycles, voice: (f, g, v) => S.piano(f, g, v, { decay: 1.2 }) });
    return D.mixSt([D.widen(x, 0.3, 6), 1], [room(x, 0.88, 2), 0.3]);
  });
}
function arp() {
  return loop(4, (cycles) => {
    const order = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
    const notes = CH.flatMap((c, b) => { const t = [...c, S.midi(c[0]) + 12]; return order.map((k, j) => [b * 16 + j, 1, t[k % t.length], j % 4 === 0 ? 1 : 0.7]); });
    const x = S.play(notes, { bpm: BPM, steps: 64, cycles, voice: (f, g, v) => S.pluck(f, g, v, { decay: 0.12, bright: 6500, q: 3 }) });
    return D.mixSt([D.widen(x, 0.3, 4), 1], [S.pingpong(x, BPM, { div: 0.75, n: 3, gain: 0.22 }), 1], [room(x, 0.8, 1), 0.1]);
  });
}
function strings() {
  // cuerdas en staccato a corcheas, como en los temas de frenchcore (sierras en conjunto, cortas)
  return loop(4, (cycles) => {
    const pat = [0, 2, 1, 2, 0, 2, 1, 2];
    const notes = CH.flatMap((c, b) => pat.map((k, j) => [b * 16 + j * 2, 1, [c[k], S.midi(c[k]) - 12], j % 2 ? 0.7 : 1]));
    const x = wide(notes, { bpm: BPM, steps: 64, cycles, gateScale: 0.6 }, (seed) => (f, g, v) => {
      const L = g + 0.08, r = D.rng(seed + Math.round(f));
      const y = D.mix(...[-9, 0, 7].map((c) => [D.osc(L, f * Math.pow(2, c / 1200) * (1 + 0.003 * Math.sin(2 * Math.PI * 5 * r())), { shape: 'saw', phase: r() }), 0.33]));
      return D.env(D.lp(D.eq(y, 1200, 3, 1), 3800, 0.8), D.ahd(0.006, g * 0.6, 0.04));
    });
    return D.mixSt([x, 1], [room(x, 0.85, 1.4), 0.25]);
  });
}
function chops() {
  // chops de voz: sílabas cortas de soprano por las notas de cada acorde, con ritmo sincopado
  return loop(4, (cycles) => {
    const rhythm = [[0, 2], [3, 1], [4, 2], [7, 1], [8, 2], [10, 2], [12, 1], [14, 2]], vow = ['a', 'e', 'a', 'o', 'a', 'e', 'i', 'a'];
    const notes = CH.flatMap((c, b) => rhythm.map(([s, l], j) => [b * 16 + s, l, S.midi(c[(j + b) % 3]) + 12, j % 2 ? 0.75 : 1, { vowel: vow[j] }]));
    const x = S.play(notes, { bpm: BPM, steps: 64, cycles, tail: 0.6, voice: (f, g, v, o) => {
      const L = g * 0.85 + 0.03;
      let y = D.hp(V.singer(L, f, { reg: 'soprano', vowel: o.vowel, seed: Math.round(f) }), 250);
      // cada vocal sale con un nivel distinto: todas las sílabas al mismo
      let rms = 0; for (const v of y) rms += v * v; rms = Math.sqrt(rms / y.length) || 1;
      y = D.gain(y, 0.18 / rms);
      return D.env(y, (t) => Math.min(1, t / 0.004) * (t < L - 0.02 ? 1 : Math.max(0, (L - t) / 0.02)) * v);
    } });
    const y = D.shelf(D.eq(x, 3000, 4, 0.8), 'highshelf', 6000, 4);
    return D.mixSt([D.widen(y, 0.25, 5), 1], [S.pingpong(y, BPM, { div: 0.5, n: 2, gain: 0.18 }), 1], [room(y, 0.82, 1.2), 0.18]);
  });
}

/* ---------------------------------------------------------------- percusión y efectos */
function clap() {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push([D.env(D.bp(D.noise(0.03, 300 + k), 1400, 1.1), D.expEnv(0.004)), k === 3 ? 1 : 0.7, k * 0.008]);
  parts.push([D.env(D.bp(D.noise(0.6, 309), 1250, 0.8), D.expEnv(0.09)), 0.6, 0.032]);
  const snare = D.mix([D.env(D.hp(D.noise(0.3, 310), 1800), D.expEnv(0.05)), 0.5], [D.osc(0.15, D.sweep(320, 200, 0.01), { amp: D.expEnv(0.04) }), 0.5]);
  const x = D.drive(D.mix(...parts, [snare, 0.55]), 2.6);
  return finishSt(D.mixSt([D.widen(x, 0.3, 2), 1], [room(x, 0.6, 0.6), 0.2]));
}
function hat() {
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 2.1);
  const m = D.mix(...fr.map((f, k) => [D.osc(0.2, f, { shape: 'square', phase: (k * 0.17) % 1 }), 0.18]), [D.noise(0.2, 320), 0.6]);
  return finishSt(D.widen(D.env(D.hp(D.hp(m, 8000), 8000), D.expEnv(0.035)), 0.35, 4));
}
function roll() {
  // redoble de un compás: corcheas, semicorcheas y fusas, subiendo
  const s = BEAT / 4, at = [];
  for (let t = 0; t < 8 * s - 1e-9; t += 2 * s) at.push(t);
  for (let t = 8 * s; t < 12 * s - 1e-9; t += s) at.push(t);
  for (let t = 12 * s; t < 16 * s - 1e-9; t += s / 2) at.push(t);
  const hit = (t, k) => D.mix([D.env(D.hp(D.noise(0.1, 330 + k), 1600), D.expEnv(0.03)), 0.8], [D.osc(0.07, 210 * Math.pow(2, (t / (16 * s)) * 1.2), { amp: D.expEnv(0.025) }), 0.55]);
  const x = sat(D.mix(...at.map((t, k) => [hit(t, k), 0.45 + 0.55 * (t / (16 * s)), t])), 1.8);
  return finishSt(D.mixSt([D.widen(x, 0.2, 4), 1], [room(x, 0.7, 0.8), 0.18]));
}
function kickRoll() {
  // el kick de Re a semicorcheas durante un compás, subiendo una octava
  const k = K.hardKick('D2', { len: BEAT / 4, move: 'hold', seed: 41 }), parts = [];
  for (let j = 0; j < 16; j++) {
    const r = Math.pow(2, j / 16);
    parts.push([D.rate(k.L, r), 0.6 + 0.4 * (j / 15), j * BEAT / 4]);
  }
  return finish(D.mix(...parts), { release: 0.02 });
}
function riser() {
  // subida de 2 compases: ruido blanco que se abre y una sierra que sube dos octavas
  const L = BAR * 2;
  const noise = D.filter(D.noise(L, 340), 'hp', (t) => 300 * Math.pow(25, t / L), { q: 1.4 });
  const tone = D.mix([D.osc(L, (t) => 110 * Math.pow(4, Math.pow(t / L, 1.3)), { shape: 'saw' }), 0.5], [D.osc(L, (t) => 111 * Math.pow(4, Math.pow(t / L, 1.3)), { shape: 'saw', phase: 0.4 }), 0.5]);
  const x = D.env(D.mix([noise, 0.7], [D.lp(sat(tone, 1.6), 7000), 0.5]), (t) => Math.pow(t / L, 1.5) * (t > L - 0.015 ? (L - t) / 0.015 : 1));
  return finishSt(D.mixSt([D.widen(x, 0.5, 6), 1], [room(x, 0.8, 1, 0.5), 0.18]));
}
function impact() {
  const sub = D.osc(2.4, D.sweep(95, 34, 0.25), { amp: D.ahd(0.001, 0.12, 0.6) });
  const crash = D.env(D.hp(D.noise(2.4, 350), 3500), D.ahd(0.001, 0.05, 0.7));
  const hit = D.env(D.lp(D.noise(0.3, 351), 2500), D.expEnv(0.03));
  const x = sat(D.mix([sub, 1], [crash, 0.35], [hit, 0.6]), 1.6);
  return finishSt(D.mixSt([D.widen(x, 0.4, 5), 1], [room(x, 0.9, 2.6), 0.35]));
}
function reverseCrash() {
  // plato al revés de dos tiempos: crece hasta el golpe
  const L = BEAT * 2;
  const m = D.mix([D.env(D.hp(D.noise(L + 0.6, 360), 4000), D.expEnv(0.5)), 1], ...[3150, 4720, 6110].map((f, k) => [D.osc(L + 0.6, f, { shape: 'square', amp: D.expEnv(0.3), phase: k * 0.2 }), 0.05]));
  const wet = D.reverb(m, { size: 0.85, tail: 1.2 });
  const rev = (c) => { const r = D.reverse(c.slice(0, D.secs(L))); return D.fades(r, 0.02, 0.006); };
  return finishSt(D.applySt(D.mixSt([D.stereo(m, Float64Array.from(m)), 1], [wet, 0.6]), rev));
}

/* ---------------------------------------------------------------- catálogo */
const Kk = (o) => ({ cat: 'kick', type: 'kick', style: 'uptempo', bpm: [195, 210], ...o });
const Lp = (o) => ({ cat: 'loop', loop: true, style: o.style || 'uptempo', tonality: 'Re menor', bpm: [BPM, BPM], bars: 4, ...o });
const tg = (...t) => ['himno', ...t];
export const SAMPLES = [
  ...KEYS.map(([n, name]) => Kk({ id: 'up-kick-' + n.toLowerCase().replace('#', 's'), name: `Kick uptempo (${name})`, key: n, tags: tg('uptempo', 'afinado', name), render: upKick(n),
    notes: `Kick de uptempo en ${name} (cola en ${n.replace('#', '♯')}): bajo sostenido que cae desde Do 5, reflexiones antes de distorsionar, dos etapas de distorsión con la banda resonante delante, tok limpio aparte, graves en mono y OTT. La cola se va cerrando.` })),
  Kk({ id: 'up-kick-chillon', name: 'Kick uptempo que se abre', key: 'D2', tags: tg('uptempo', 'screech'), render: upKick('D2', { move: 'up', seed: 12 }),
    notes: 'El mismo kick en Re con la banda resonante subiendo: la cola se abre y chilla al final.' }),
  Kk({ id: 'up-kick-wobble', name: 'Kick uptempo con vaivén', key: 'D2', tags: tg('uptempo', 'movimiento'), render: upKick('D2', { move: 'wobble', seed: 13 }),
    notes: 'El kick en Re con la cola que se abre y se cierra dos veces en un tiempo.' }),
  Kk({ id: 'fc-kick', name: 'Kick frenchcore', key: 'D2', style: 'hardcore', bpm: [190, 210], tags: tg('frenchcore', 'zumbido'), render: fcKick,
    notes: 'El ataque del kick duro en Re y, detrás, un trozo pegado al ataque repetido tres veces por negra: la cola zumbona del frenchcore.' }),
  ...KEYS.map(([n, name]) => ({ id: 'fc-bajo-' + n.toLowerCase().replace('#', 's'), name: `Bajo frenchcore (${name})`, type: 'bajo', cat: 'bajo', style: 'hardcore', key: n, bpm: [BPM, BPM], tags: tg('frenchcore', 'contratiempo', name), render: fcBass(n),
    notes: `Bajo distorsionado de una corchea en ${name}, para el contratiempo: la cola del kick duro sin tok.` })),
  Lp({ id: 'himno-lead', name: 'Lead del himno', type: 'melodía', tags: tg('lead', 'supersierra'), render: lead,
    notes: 'El gancho (frases de 3 + 3 + 2) sobre Rem – Si♭ – Fa – Do: siete sierras que entran desde abajo, formantes, dos distorsiones, vibrato tardío y su octava, con «sidechain», sala y eco.' }),
  Lp({ id: 'himno-acordes', name: 'Acordes del himno', type: 'acordes', tags: tg('acordes', 'pad'), render: chords,
    notes: 'Rem – Si♭ – Fa – Do en supersierras largas con mucha sala: para la intro y el break.' }),
  Lp({ id: 'himno-coro', name: 'Coro del himno', type: 'coro', cat: 'voz', tags: tg('coro', 'aah'), render: choir,
    notes: 'Coro sintético «aah» (sopranos y tenores) que sigue los acordes compás a compás.' }),
  Lp({ id: 'himno-piano', name: 'Piano del himno', type: 'acordes', style: 'hardcore', tags: tg('piano', 'break'), render: piano,
    notes: 'Acordes de piano y el gancho una octava arriba: el break de frenchcore.' }),
  Lp({ id: 'himno-arp', name: 'Arpegio del himno', type: 'arpegio', tags: tg('arpegio', 'pluck'), render: arp,
    notes: 'Pluck en semicorcheas por los acordes, con eco a corchea con puntillo.' }),
  Lp({ id: 'fc-cuerdas', name: 'Cuerdas en staccato', type: 'acordes', style: 'hardcore', tags: tg('frenchcore', 'cuerdas'), render: strings,
    notes: 'Cuerdas de sierra en conjunto, cortas y a corcheas, por las notas de cada acorde.' }),
  Lp({ id: 'himno-chops', name: 'Chops de voz', type: 'voz', cat: 'voz', tags: tg('voz', 'chops'), render: chops,
    notes: 'Sílabas cortas de soprano sintética («a», «e», «o», «i») por las notas de los acordes, sincopadas, con eco.' }),
  { id: 'himno-palma', name: 'Palma del himno', type: 'palma', cat: 'perc', style: 'uptempo', tags: tg('clap'), render: clap,
    notes: 'Palma de cuatro ráfagas con una caja debajo, saturada.' },
  { id: 'himno-charles', name: 'Charles del himno', type: 'charles', cat: 'perc', style: 'uptempo', tags: tg('hi-hat'), render: hat,
    notes: 'Charles corto y brillante por encima de 8 kHz.' },
  { id: 'himno-redoble', name: 'Redoble del himno', type: 'redoble', cat: 'perc', style: 'uptempo', bpm: [BPM, BPM], tags: tg('fill'), render: roll,
    notes: 'Un compás a 200: corcheas, semicorcheas y fusas, subiendo.' },
  { id: 'himno-kickroll', name: 'Redoble de kick', type: 'redoble', cat: 'kick', style: 'uptempo', bpm: [BPM, BPM], tags: tg('kick roll', 'fill'), render: kickRoll,
    notes: 'El kick de Re a semicorcheas durante un compás a 200, subiendo una octava.' },
  { id: 'himno-subida', name: 'Subida del himno', type: 'subida', cat: 'fx', style: 'uptempo', bpm: [BPM, BPM], tags: tg('riser'), render: riser,
    notes: 'Dos compases a 200: ruido que se abre y una sierra que sube dos octavas.' },
  { id: 'himno-impacto', name: 'Impacto del himno', type: 'impacto', cat: 'fx', style: 'uptempo', tags: tg('impacto', 'plato'), render: impact,
    notes: 'Sub que cae, golpe y un plato largo, con sala grande: para el primer tiempo del drop.' },
  { id: 'himno-plato-reves', name: 'Plato al revés', type: 'transición', cat: 'fx', style: 'uptempo', bpm: [BPM, BPM], tags: tg('reverse'), render: reverseCrash,
    notes: 'Dos tiempos a 200: un plato al revés que crece hasta el golpe.' }
];
