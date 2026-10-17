/* HARMONY 02 · Voces
   Frases de MC, gritos, efectos de voz y coros. Las frases y los gritos parten de tomas de eSpeak NG
   (tools/samples/voices: voz sintética por formantes, sin grabar a nadie) y se procesan aquí: limpieza, presencia,
   compresión, saturación, doblado en estéreo, ecos a tempo, megáfono, radio, vocoder, demonio…
   Los coros no usan ninguna toma: son síntesis por formantes (tools/samples/voice.mjs).
   Todo es determinista: las mismas tomas y la misma receta dan los mismos archivos. */
import * as D from '../dsp.mjs';
import * as V from '../voice.mjs';

export const PACK = {
  id: 'harmony-02',
  name: 'Harmony 02',
  title: 'Voces',
  version: '1.0.0',
  date: '2026-10-17',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Frases y gritos: voz sintética de eSpeak NG 1.53 (programa libre, GPL-3.0) procesada en tools/samples/ (Harmony). Coros: síntesis por formantes de Harmony. Sin grabaciones de personas ni samples de terceros.',
  credits: 'Harmony · voz de base: eSpeak NG',
  note: 'voz de base: eSpeak NG'
};

/* ---------------------------------------------------------------- piezas comunes */

const beat = (bpm) => 60 / bpm;
/* cierre en estéreo: sin continua, cola recortada, sin clics, limitado y a −1 dBTP */
function finishSt(s, { tailDb = -66, peak = -1 } = {}) {
  s = D.same(s.L ? s : D.stereo(s));
  const L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.001, 0.025), D.fades(R0.slice(0, n), 0.001, 0.025));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
function finish(x, { tailDb = -66, peak = -1 } = {}) {
  let y = D.fades(D.trimTail(D.dcBlock(x), tailDb), 0.001, 0.025);
  y = D.limit(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
const sat = (x, g) => D.map(x, (v) => Math.tanh(v * g) / Math.tanh(g));

/* timbre de MC: fuera graves y «caja», presencia, aire, compresión y saturación (la saturación además rellena por
   encima de 11 kHz, donde la toma de eSpeak no llega) */
function tone(x, { hp = 110, box = -3, presence = 5, air = 4, comp = 8, drive = 1.8 } = {}) {
  let y = D.hp(D.hp(x, hp, 0.7), hp, 0.7);
  y = D.eq(y, 340, box, 1.1);
  y = D.eq(y, 2700, presence, 0.9);
  y = D.shelf(y, 'highshelf', 6500, air);
  if (comp) y = D.compress(y, { thrDb: -20, ratio: 4, att: 0.002, rel: 0.07, makeup: comp });
  return sat(y, drive);
}
/* ecos a tempo, alternando izquierda y derecha, cada vez más oscuros */
function echo(x, { bpm = 150, div = 0.75, n = 3, gain = 0.3, fb = 0.5, lp = 3500 } = {}) {
  const d = beat(bpm) * div, L = [], R = [];
  let y = x;
  for (let k = 1; k <= n; k++) { y = D.lp(y, lp, 0.6); (k % 2 ? L : R).push([y, gain * Math.pow(fb, k - 1), d * k]); }
  const z = new Float64Array(1);
  return D.same(D.stereo(L.length ? D.mix(...L) : z, R.length ? D.mix(...R) : z));
}
const mono = (s) => D.mix([s.L, 0.5], [s.R, 0.5]);
const room = (x, g, o = {}) => [D.reverb(x, { size: 0.72, damp: 0.55, tail: 0.9, pre: 0.015, ...o }), g];

/* una frase de MC: toma principal y doble (otra voz de eSpeak con la misma duración) abierto en estéreo */
function mc(ids, { rate = 1, dbl = 0.55, rv = 0.13, ech = null, ...t } = {}) {
  const [a, b] = ids.map((id) => tone(V.take(id, { rate }), t));
  const st = b ? D.same(D.stereo(D.mix([a, 1], [b, dbl * 0.7]), D.mix([a, 0.9], [b, dbl, 0.011]))) : D.widen(a, 0.3);
  const parts = [[st, 1], room(mono(st), rv)];
  if (ech) parts.push([echo(mono(st), ech), 1]);
  return finishSt(D.mixSt(...parts));
}
/* palabras puestas a tempo (cuenta atrás, cuenta de entrada) */
function onBeats(ids, bpm, o = {}) {
  const words = ids.map((id) => tone(V.take(id), o));
  const x = D.mix(...words.map((w, k) => [w, 1, k * beat(bpm)]));
  return finishSt(D.mixSt([D.widen(x, 0.25), 1], room(x, 0.12), [echo(words[words.length - 1], { bpm, div: 0.5, n: 3, gain: 0.25 }), 1, (words.length - 1) * beat(bpm)]));
}
/* grito de grupo: cada toma dos veces (algo más grave y algo más aguda), con pequeños retrasos y repartida en el estéreo */
function crowd(ids, { seed = 5, rates = [0.95, 1.05], spread = 0.9, rv = 0.2 } = {}) {
  const r = D.rng(seed), L = [], R = [];
  for (const id of ids) for (const rt of rates) {
    const x = tone(V.take(id, { rate: rt }), { hp: 170, presence: 6, drive: 3, comp: 10 });
    const off = r() * 0.018, pan = D.clamp(0.5 + (r() - 0.5) * spread, 0, 1);
    L.push([x, Math.cos(pan * Math.PI / 2), off]); R.push([x, Math.sin(pan * Math.PI / 2), off]);
  }
  const st = D.same(D.stereo(D.mix(...L), D.mix(...R)));
  return { st, dry: mono(st), rv };
}
function shout(ids, o) { const c = crowd(ids, o); return finishSt(D.mixSt([c.st, 1], room(c.dry, c.rv, { size: 0.8, tail: 1.1 }))); }

/* ---------------------------------------------------------------- frases */

const hardcore = () => mc(['hardcore-a', 'hardcore-b'], { drive: 2.2, ech: { bpm: 180, div: 0.75, n: 2, gain: 0.22 } });
const uptempo = () => mc(['uptempo-a', 'uptempo-b'], { drive: 2.6, ech: { bpm: 200, div: 0.5, n: 3, gain: 0.2 } });
const newstyle = () => mc(['newstyle-a', 'newstyle-b'], { ech: { bpm: 150, div: 0.75, n: 2, gain: 0.22 } });
const harmony = () => mc(['harmony-a', 'harmony-b'], { rv: 0.24, drive: 1.5, ech: { bpm: 150, div: 1, n: 3, gain: 0.28, fb: 0.55, lp: 2800 } });
const noise = () => mc(['noise-a', 'noise-b'], { drive: 2.2, rv: 0.15 });
const ready = () => mc(['ready-a', 'ready-b'], { ech: { bpm: 150, div: 0.75, n: 2, gain: 0.2 } });
const letsgo = () => mc(['letsgo-a', 'letsgo-b'], { drive: 2.4 });
const comeon = () => mc(['comeon-a', 'comeon-b'], { drive: 2.2 });
const louder = () => mc(['louder-a', 'louder-b'], { drive: 2.8, presence: 6 });
const handsup = () => mc(['handsup-a', 'handsup-b'], { drive: 2.2, ech: { bpm: 150, div: 0.5, n: 2, gain: 0.18 } });
const bass = () => mc(['bass-a'], { rate: 0.82, hp: 70, presence: 3, box: 0, drive: 2.4, ech: { bpm: 150, div: 0.5, n: 4, gain: 0.32, fb: 0.62, lp: 2200 } });
const drop = () => mc(['drop-a', 'drop-b'], { drive: 2.4, ech: { bpm: 150, div: 0.75, n: 3, gain: 0.3, fb: 0.55 } });
const rotterdam = () => mc(['rotterdam-a', 'rotterdam-b'], { drive: 2.8, ech: { bpm: 180, div: 0.75, n: 2, gain: 0.2 } });
const countdown = () => onBeats(['three-a', 'two-a', 'one-a'], 150, { drive: 2.2 });
const countin = () => onBeats(['one-a', 'two-a', 'three-a', 'four-a'], 150, { drive: 2 });

const vamos = () => mc(['vamos-a', 'vamos-b'], { drive: 2.4, ech: { bpm: 150, div: 0.75, n: 2, gain: 0.2 } });
const dale = () => mc(['dale-a', 'dale-b'], { drive: 2.4 });
const fuerte = () => mc(['fuerte-a', 'fuerte-b'], { drive: 2.8, presence: 6 });
const manos = () => mc(['manos-a', 'manos-b'], { drive: 2.2, ech: { bpm: 150, div: 0.75, n: 2, gain: 0.2 } });
const makina = () => mc(['makina-a', 'makina-b'], { drive: 2.4, ech: { bpm: 170, div: 0.75, n: 3, gain: 0.24 } });
const suene = () => mc(['suene-a', 'suene-b'], { drive: 2.4 });

/* ---------------------------------------------------------------- gritos */

const hey = () => shout(['hey-a', 'hey-b', 'hey-c', 'hey-d'], { seed: 3 });
const oi = () => shout(['oi-a', 'oi-b', 'oi-c'], { seed: 7 });
const yeah = () => shout(['yeah-a', 'yeah-b', 'yeah-c'], { seed: 9 });
const ho = () => shout(['ho-a', 'ho-b', 'ho-c'], { seed: 13 });
/* gritos de alegría: dos voces dobladas, algo más agudas, con sala y un eco */
const yahoo = () => mc(['yahoo-a', 'yahoo-b'], { rate: 1.04, drive: 2, presence: 6, rv: 0.18, ech: { bpm: 150, div: 0.75, n: 2, gain: 0.2 } });
const yuju = () => mc(['yuju-a', 'yuju-b'], { rate: 1.04, drive: 2, presence: 6, rv: 0.18, ech: { bpm: 150, div: 0.75, n: 2, gain: 0.2 } });
function heyX3() {
  // «¡Hey! ¡Hey! ¡Hey!» a negras, 150 BPM: el grupo de gritos tres veces, con la sala solo en el último
  const c = crowd(['hey-a', 'hey-b', 'hey-c', 'hey-d'], { seed: 21 }), b = beat(150);
  const L = D.mix([c.st.L, 1], [c.st.L, 0.95, b], [c.st.L, 1, 2 * b]), R = D.mix([c.st.R, 1], [c.st.R, 0.95, b], [c.st.R, 1, 2 * b]);
  return finishSt(D.mixSt([D.stereo(L, R), 1], [D.reverb(c.dry, { size: 0.8, damp: 0.5, tail: 1.1 }), 0.22, 2 * b]));
}

/* ---------------------------------------------------------------- efectos de voz */

function warning() {
  // megáfono: banda estrecha (550 Hz–3,8 kHz), resonancia a 1,6 kHz, saturación fuerte y ecos a 180 BPM
  let x = V.take('warning-a');
  x = D.hp(D.hp(x, 550, 0.8), 550, 0.8); x = D.lp(D.lp(x, 3800, 0.8), 3800, 0.8);
  x = D.eq(x, 1600, 9, 1.4); x = D.compress(x, { thrDb: -22, ratio: 6, makeup: 10 }); x = sat(x, 4.5);
  x = D.lp(x, 5000, 0.7);
  return finishSt(D.mixSt([D.stereo(x), 1], [echo(x, { bpm: 180, div: 0.75, n: 3, gain: 0.3, fb: 0.55, lp: 3000 }), 1], room(x, 0.1)));
}
function radio() {
  // walkie: banda de teléfono, saturación, algo de reducción de bits y un chasquido de ruido al abrir y al cerrar
  let x = V.take('thisis-a');
  x = D.hp(D.hp(x, 450, 0.8), 450, 0.8); x = D.lp(D.lp(x, 3000, 0.8), 3000, 0.8);
  x = D.eq(x, 1800, 5, 1); x = D.compress(x, { thrDb: -20, ratio: 5, makeup: 9 }); x = sat(x, 3); x = D.crush(x, 10, 2);
  x = D.lp(D.hp(x, 300), 3400);
  const sq = D.env(D.bp(D.noise(0.07, 41), 2400, 0.8), D.ahd(0.002, 0.03, 0.015));
  const len = x.length / D.SR;
  const y = D.mix([sq, 0.35], [x, 1, 0.06], [sq, 0.3, 0.06 + len + 0.02]);
  return finish(y);
}
function demon() {
  // la toma un 34 % más lenta: tono y formantes más de siete semitonos abajo; graves realzados y sala grande y oscura
  let x = V.take('demon-a', { rate: 0.66 });
  x = D.hp(x, 45, 0.7); x = D.shelf(x, 'lowshelf', 160, 5); x = D.eq(x, 2200, 3, 1);
  x = D.compress(x, { thrDb: -22, ratio: 5, makeup: 10 }); x = sat(x, 3.2);
  const st = D.widen(x, 0.35, 9);
  return finishSt(D.mixSt([st, 1], [D.reverb(x, { size: 0.88, damp: 0.72, tail: 1.6, pre: 0.02 }), 0.28]));
}
function stutter() {
  // «Ha-ha-ha-hardcore»: cuatro semicorcheas del principio de la palabra a 180 BPM y luego la palabra entera
  const w = tone(V.take('hardcore-a'), { drive: 2.4 }), s = beat(180) / 4;
  const chop = D.fades(D.cut(w, 0, s * 0.88), 0.001, 0.008);
  const x = D.mix([chop, 1, 0, 0.008], [chop, 1, s, 0.008], [chop, 1, 2 * s, 0.008], [chop, 1, 3 * s, 0.008], [w, 1, 4 * s]);
  return finishSt(D.mixSt([D.widen(x, 0.25), 1], room(x, 0.12), [echo(w, { bpm: 180, div: 0.75, n: 2, gain: 0.22 }), 1, 4 * s]));
}
function robot() {
  // vocoder de 24 bandas: la voz modula un acorde de Do menor (Do 3, Re# 3, Sol 3, Do 4) de sierras desafinadas
  const m = V.take('robot-a'), dur = m.length / D.SR + 0.02;
  const notes = [D.note('C', 3), D.note('D#', 3), D.note('G', 3), D.note('C', 4)];
  const car = D.mix(...notes.flatMap((f, k) => [-7, 6].map((c, j) => [D.osc(dur, f * Math.pow(2, c / 1200), { shape: 'saw', phase: (k * 0.27 + j * 0.5) % 1 }), 0.25])), [D.noise(dur, 17), 0.04]);
  let x = V.vocoder(m, car, { bands: 24, q: 6 });
  x = D.compress(x, { thrDb: -18, ratio: 3, makeup: 6 }); x = sat(x, 1.4);
  const st = D.widen(x, 0.5, 5);
  return finishSt(D.mixSt([st, 1], room(x, 0.2, { tail: 1.2 }), [echo(x, { bpm: 200, div: 0.75, n: 2, gain: 0.2 }), 1]));
}
function whisper() {
  // susurro (variante «whisper» de eSpeak) con presencia y una sala larga
  let x = V.take('whisper-a');
  x = D.hp(D.hp(x, 260, 0.7), 260, 0.7); x = D.eq(x, 4500, 5, 0.9); x = D.compress(x, { thrDb: -24, ratio: 4, makeup: 10 });
  const st = D.widen(x, 0.4, 7);
  return finishSt(D.mixSt([st, 1], [D.reverb(x, { size: 0.86, damp: 0.4, tail: 2, pre: 0.03 }), 0.4], [echo(x, { bpm: 150, div: 1, n: 2, gain: 0.25, lp: 5000 }), 1]));
}
function reverseIn() {
  // entrada inversa: la reverb de la palabra al revés crece hasta la palabra, que entra seca
  const w = tone(V.take('hardcore-b'), { drive: 2.2 });
  const wet = D.reverb(w, { size: 0.88, damp: 0.45, tail: 1.6, pre: 0 });
  const tail = (c) => D.reverse(D.trimTail(c, -52));
  const L = tail(wet.L), R = tail(wet.R), n = Math.min(L.length, R.length), at = n / D.SR - 0.02;
  return finishSt(D.mixSt([D.stereo(L.slice(L.length - n), R.slice(R.length - n)), 1.6], [D.stereo(w), 1, at], room(w, 0.1)));
}

/* ---------------------------------------------------------------- coros (síntesis por formantes) */

/* las vocales cantadas tienen poco por encima de 3 kHz: un estante de agudos les da la presencia de una mezcla */
const bright = (st, g = 6) => D.applySt(st, (c) => D.shelf(D.eq(c, 3200, g * 0.5, 0.8), 'highshelf', 5000, g));
const env3 = (a, hold, rel) => (t) => (t < a ? Math.sin((t / a) * Math.PI / 2) : t < a + hold ? 1 : Math.max(0, Math.cos(((t - a - hold) / rel) * Math.PI / 2)));
function aah() {
  // «Aah» en La menor: tenores en La 3 y sopranos en Do 4, Mi 4 y La 4, tres voces por nota
  const L = 3.2, amp = env3(0.45, 1.75, 1.0);
  const lo = V.choir(L, [D.note('A', 3)], { reg: 'tenor', vowel: 'a', voices: 3, seed: 3, amp });
  const hi = V.choir(L, [D.note('C', 4), D.note('E', 4), D.note('A', 4)], { reg: 'soprano', vowel: 'a', voices: 3, seed: 5, amp });
  const st = bright(D.mixSt([lo, 0.9], [hi, 0.75]));
  return finishSt(D.mixSt([st, 1], [D.reverb(mono(st), { size: 0.86, damp: 0.5, tail: 2.2, pre: 0.02 }), 0.35]));
}
function ooh() {
  // «Ooh» en Fa# menor: tenores en Fa# 3 y contraltos en La 3 y Do# 4
  const L = 2.8, amp = env3(0.5, 1.4, 0.9);
  const lo = V.choir(L, [D.note('F#', 3)], { reg: 'tenor', vowel: 'u', voices: 3, seed: 7, amp });
  const hi = V.choir(L, [D.note('A', 3), D.note('C#', 4)], { reg: 'alto', vowel: 'u', voices: 3, seed: 9, amp });
  const st = bright(D.mixSt([lo, 0.9], [hi, 0.85]));
  return finishSt(D.mixSt([st, 1], [D.reverb(mono(st), { size: 0.86, damp: 0.55, tail: 2.2, pre: 0.02 }), 0.35]));
}
function chopAh() {
  // «Ah» cortado en Do# 4 doblado a la octava: el golpe vocal del uptempo
  const L = 0.36, amp = D.ahd(0.006, 0.14, 0.06);
  const st = bright(D.mixSt([V.choir(L, [D.note('C#', 4)], { reg: 'soprano', vowel: 'a', voices: 3, seed: 11, amp, vibDepth: 0 }), 1],
    [V.choir(L, [D.note('C#', 5)], { reg: 'soprano', vowel: 'a', voices: 2, seed: 13, amp, vibDepth: 0 }), 0.5]), 8);
  const x = sat(mono(st), 1.3);
  return finishSt(D.mixSt([D.applySt(st, (c) => sat(c, 1.3)), 1], room(x, 0.12, { tail: 0.5 })));
}
function chopEy() {
  // «Ey» en Fa# 4: la vocal pasa de e a i en 80 ms
  const L = 0.42, amp = D.ahd(0.008, 0.18, 0.07);
  const st = bright(V.choir(L, [D.note('F#', 4)], { reg: 'soprano', vowel: [[0, 'e'], [0.1, 'i']], glide: 0.08, voices: 3, seed: 15, amp, vibDepth: 0 }), 8);
  return finishSt(D.mixSt([D.applySt(st, (c) => sat(c, 1.3)), 1], room(mono(st), 0.12, { tail: 0.5 })));
}
function ohStab() {
  // «Oh» en Sol# menor (Sol# 3, Si 3, Re# 4) con la reverb cortada en seco a 480 ms
  const L = 0.62, amp = D.ahd(0.012, 0.24, 0.1);
  const st = bright(V.choir(L, [D.note('G#', 3), D.note('B', 3), D.note('D#', 4)], { reg: 'alto', vowel: 'o', voices: 3, seed: 19, amp, vibDepth: 0.002 }));
  const wet = D.reverb(mono(st), { size: 0.85, damp: 0.5, tail: 0.6 });
  const gated = D.applySt(wet, (c) => D.gate(c, 0.48, 0.03));
  return finishSt(D.mixSt([st, 1], [gated, 0.5]));
}

/* ---------------------------------------------------------------- catálogo del pack */

const en = 'inglés', es = 'castellano';
export const SAMPLES = [
  { id: 'mc-hardcore', name: '«Hardcore!»', style: 'hardcore', type: 'voz', cat: 'voz', bpm: [170, 200], tags: ['mc', en, 'doblada', 'eco'], render: hardcore,
    notes: 'Dos voces de eSpeak dobladas en estéreo, presencia a 2,7 kHz, saturación y eco a corchea con puntillo (180 BPM).' },
  { id: 'mc-uptempo', name: '«Uptempo!»', style: 'uptempo', type: 'voz', cat: 'voz', bpm: [200, 230], tags: ['mc', en, 'saturada', 'eco'], render: uptempo,
    notes: 'Doblada y más saturada, con eco a corchea a 200 BPM.' },
  { id: 'mc-newstyle', name: '«New style!»', style: 'newstyle', type: 'voz', cat: 'voz', bpm: [145, 155], tags: ['mc', en, 'doblada'], render: newstyle,
    notes: 'Doblada en estéreo con eco a corchea con puntillo (150 BPM).' },
  { id: 'mc-harmony', name: '«Harmony»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'firma', 'eco largo'], render: harmony,
    notes: 'El nombre de la casa: voz doblada, sala grande y tres ecos a negra (150 BPM) cada vez más oscuros.' },
  { id: 'mc-make-some-noise', name: '«Make some noise!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'público'], render: noise,
    notes: 'Frase de MC doblada, saturada, con sala.' },
  { id: 'mc-are-you-ready', name: '«Are you ready?»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'antes del drop'], render: ready,
    notes: 'Doblada, con eco a corchea con puntillo (150 BPM): para el final de una subida.' },
  { id: 'mc-lets-go', name: '«Let\'s go!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'arranque'], render: letsgo,
    notes: 'Frase corta doblada y saturada.' },
  { id: 'mc-come-on', name: '«Come on!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'corta'], render: comeon,
    notes: 'Frase corta doblada y saturada.' },
  { id: 'mc-louder', name: '«Louder!»', style: 'hardcore', type: 'voz', cat: 'voz', tags: ['mc', en, 'muy saturada'], render: louder,
    notes: 'La más saturada de las frases, con presencia extra a 2,7 kHz.' },
  { id: 'mc-hands-up', name: '«Hands up!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', en, 'público', 'eco'], render: handsup,
    notes: 'Doblada, con dos ecos a corchea (150 BPM).' },
  { id: 'mc-bass', name: '«Bass!»', style: 'general', type: 'voz', cat: 'voz', bpm: [150, 150], tags: ['mc', en, 'grave', 'eco'], render: bass,
    notes: 'Toma un 18 % más lenta (más grave y con formantes más bajos), sin recortar graves, con cuatro ecos a corchea que se apagan.' },
  { id: 'mc-drop', name: '«Drop!»', style: 'general', type: 'voz', cat: 'voz', bpm: [150, 150], tags: ['mc', en, 'drop', 'eco'], render: drop,
    notes: 'Doblada y saturada, con tres ecos a corchea con puntillo (150 BPM) que van cayendo de izquierda a derecha.' },
  { id: 'mc-rotterdam', name: '«Rotterdam!»', style: 'hardcore', type: 'voz', cat: 'voz', bpm: [170, 190], tags: ['mc', en, 'gabber', 'saturada'], render: rotterdam,
    notes: 'Doblada y muy saturada, con eco a 180 BPM: para el gabber.' },
  { id: 'mc-countdown', name: '«Three, two, one!»', style: 'general', type: 'voz', cat: 'voz', bpm: [150, 150], tags: ['mc', en, 'cuenta atrás', 'a tempo'], render: countdown,
    notes: 'Cuenta atrás a negras a 150 BPM: «three» en el 1, «two» en el 2, «one» en el 3; el drop entra en el 4.' },
  { id: 'mc-count-in', name: '«One, two, three, four!»', style: 'general', type: 'voz', cat: 'voz', bpm: [150, 150], tags: ['mc', en, 'cuenta', 'a tempo'], render: countin,
    notes: 'Un compás de cuenta a negras a 150 BPM.' },

  { id: 'mc-vamos', name: '«¡Vamos!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', es, 'doblada', 'eco'], render: vamos,
    notes: 'Voz de eSpeak en castellano, doblada y saturada, con eco a corchea con puntillo (150 BPM).' },
  { id: 'mc-dale-cana', name: '«¡Dale caña!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', es, 'doblada'], render: dale,
    notes: 'Doblada y saturada.' },
  { id: 'mc-mas-fuerte', name: '«¡Más fuerte!»', style: 'hardcore', type: 'voz', cat: 'voz', tags: ['mc', es, 'muy saturada'], render: fuerte,
    notes: 'Doblada, con más presencia y más saturación.' },
  { id: 'mc-manos-arriba', name: '«¡Manos arriba!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', es, 'público', 'eco'], render: manos,
    notes: 'Doblada, con eco a corchea con puntillo (150 BPM).' },
  { id: 'mc-makina', name: '«¡Makina!»', style: 'newstyle', type: 'voz', cat: 'voz', bpm: [165, 180], tags: ['mc', es, 'makina', 'eco'], render: makina,
    notes: 'Doblada, con tres ecos a 170 BPM.' },
  { id: 'mc-que-suene', name: '«¡Que suene!»', style: 'general', type: 'voz', cat: 'voz', tags: ['mc', es, 'doblada'], render: suene,
    notes: 'Doblada y saturada.' },

  { id: 'shout-hey', name: 'Grito «¡Hey!»', style: 'general', type: 'grito', cat: 'voz', tags: ['grito', 'grupo', 'estéreo'], render: hey,
    notes: 'Ocho voces: cuatro tomas distintas, cada una algo más grave y algo más aguda, repartidas en el estéreo con pequeños retrasos.' },
  { id: 'shout-oi', name: 'Grito «¡Oi!»', style: 'hardcore', type: 'grito', cat: 'voz', tags: ['grito', 'grupo', 'gabber'], render: oi,
    notes: 'Seis voces repartidas en el estéreo, saturadas, con sala.' },
  { id: 'shout-yeah', name: 'Grito «¡Yeah!»', style: 'general', type: 'grito', cat: 'voz', tags: ['grito', 'grupo'], render: yeah,
    notes: 'Seis voces repartidas en el estéreo, saturadas, con sala.' },
  { id: 'shout-ho', name: 'Grito «¡Ho!»', style: 'general', type: 'grito', cat: 'voz', tags: ['grito', 'grupo', 'corto'], render: ho,
    notes: 'Seis voces repartidas en el estéreo, saturadas, con sala.' },
  { id: 'shout-yahoo', name: 'Grito «¡Yahoo!»', style: 'general', type: 'grito', cat: 'voz', tags: ['grito', 'alegría', 'salto', 'inglés'], render: yahoo,
    notes: 'Grito de alegría con dos voces de eSpeak dobladas, un poco más agudas, con sala y eco. Voz propia: no imita a ningún personaje.' },
  { id: 'shout-yuju', name: 'Grito «¡Yujuu!»', style: 'general', type: 'grito', cat: 'voz', tags: ['grito', 'alegría', 'castellano'], render: yuju,
    notes: 'El mismo grito de alegría en castellano.' },
  { id: 'shout-hey-x3', name: 'Grito «¡Hey! ¡Hey! ¡Hey!»', style: 'general', type: 'grito', cat: 'voz', bpm: [150, 150], tags: ['grito', 'grupo', 'a tempo', 'tres golpes'], render: heyX3,
    notes: 'El grupo de «¡Hey!» tres veces a negras a 150 BPM, con la sala en el último.' },

  { id: 'fx-warning', name: 'Megáfono «Warning!»', style: 'hardcore', type: 'voz', cat: 'voz', bpm: [180, 180], tags: ['megáfono', en, 'eco', 'aviso'], render: warning,
    notes: 'Banda de 550 Hz a 3,8 kHz con resonancia a 1,6 kHz, compresión y saturación fuerte; ecos a corchea con puntillo (180 BPM).' },
  { id: 'fx-radio', name: 'Radio «This is Harmony»', style: 'general', type: 'voz', cat: 'voz', tags: ['radio', en, 'walkie', 'lo-fi'], render: radio,
    notes: 'Banda de teléfono (450 Hz–3 kHz), saturación, 10 bits y un chasquido de ruido al abrir y al cerrar.' },
  { id: 'fx-demon', name: 'Demonio «Hardcore»', style: 'hardcore', type: 'voz', cat: 'voz', tags: ['demonio', en, 'grave', 'oscuro'], render: demon,
    notes: 'La toma un 34 % más lenta (más de siete semitonos abajo, con los formantes), graves realzados, saturación y una sala grande y oscura.' },
  { id: 'fx-stutter', name: '«Ha-ha-ha-hardcore»', style: 'hardcore', type: 'voz', cat: 'voz', bpm: [180, 180], tags: ['stutter', en, 'a tempo', 'cortes'], render: stutter,
    notes: 'Cuatro semicorcheas del principio de la palabra a 180 BPM y luego la palabra entera, con eco.' },
  { id: 'fx-robot', name: 'Robot «Harmony»', style: 'uptempo', type: 'voz', cat: 'voz', key: 'C3', tags: ['vocoder', en, 'acorde', 'Do menor'], render: robot,
    notes: 'Vocoder de 24 bandas: la voz modula un acorde de Do menor de sierras desafinadas; las sibilantes pasan aparte para que se entienda.' },
  { id: 'fx-whisper', name: 'Susurro «Harmony»', style: 'general', type: 'voz', cat: 'voz', tags: ['susurro', en, 'reverb', 'intro'], render: whisper,
    notes: 'Variante susurrada de eSpeak, presencia a 4,5 kHz, sala larga y dos ecos a negra (150 BPM).' },
  { id: 'fx-reverse', name: 'Entrada inversa «Hardcore!»', style: 'hardcore', type: 'voz', cat: 'voz', tags: ['reverse', en, 'entrada', 'reverb'], render: reverseIn,
    notes: 'La reverb de la palabra al revés crece hasta la palabra, que entra seca: para dar paso a un drop.' },

  { id: 'choir-aah', name: 'Coro «Aah»', style: 'general', type: 'coro', cat: 'voz', key: 'A3', tags: ['coro', 'pad', 'La menor', 'formantes'], render: aah,
    notes: 'Doce voces sintéticas (fuente glotal y cinco formantes de la «a»): tenores en La 3 y sopranos en Do 4, Mi 4 y La 4, con vibrato y sala.' },
  { id: 'choir-ooh', name: 'Coro «Ooh»', style: 'general', type: 'coro', cat: 'voz', key: 'F#3', tags: ['coro', 'pad', 'Fa# menor', 'formantes'], render: ooh,
    notes: 'Nueve voces con la «u»: tenores en Fa# 3 y contraltos en La 3 y Do# 4.' },
  { id: 'choir-chop-ah', name: 'Golpe vocal «Ah»', style: 'uptempo', type: 'coro', cat: 'voz', key: 'C#4', tags: ['vocal chop', 'stab', 'corto', 'formantes'], render: chopAh,
    notes: '«Ah» corto en Do# 4 doblado a la octava, sin vibrato, algo saturado.' },
  { id: 'choir-chop-ey', name: 'Golpe vocal «Ey»', style: 'newstyle', type: 'coro', cat: 'voz', key: 'F#4', tags: ['vocal chop', 'stab', 'diptongo', 'formantes'], render: chopEy,
    notes: '«Ey» en Fa# 4: los formantes pasan de la «e» a la «i» en 80 ms.' },
  { id: 'choir-oh-stab', name: 'Acorde vocal «Oh»', style: 'hardcore', type: 'coro', cat: 'voz', key: 'G#3', tags: ['coro', 'stab', 'Sol# menor', 'gated reverb'], render: ohStab,
    notes: 'Acorde de Sol# menor cantado con la «o», con la reverb cortada en seco a 480 ms.' }
];
