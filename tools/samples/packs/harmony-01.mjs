/* HARMONY 01 · Hardcore, Newstyle y Uptempo
   Primer pack de samples originales de Harmony. Cada sonido es una receta de síntesis con semilla fija:
   construir el pack otra vez da exactamente los mismos archivos. Nada sale de grabaciones ni de samples ajenos.
   Para añadir sonidos: una entrada más en SAMPLES (id estable: no se cambia nunca, los bancos lo guardan). */
import * as D from '../dsp.mjs';
const { SR } = D;

export const PACK = {
  id: 'harmony-01',
  name: 'Harmony 01',
  title: 'Hardcore, Newstyle y Uptempo',
  version: '1.0.0',
  date: '2026-10-17',
  license: 'CC0-1.0',
  licenseName: 'CC0 1.0 (dominio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
  origin: 'Síntesis y procesado digital en tools/samples/ (Harmony). Sin grabaciones ni samples de terceros.',
  credits: 'Harmony'
};

/* ---------------------------------------------------------------- piezas comunes */

/* Cuerpo de kick: seno con doble caída de tono (clic → cuerpo → cola) y una deriva final opcional (bend, semitonos) */
function body({ f0 = 2600, mid = 190, f1 = 55, tau = 0.0035, tau2 = 0.045, len = 0.6, amp, bend = 0, bendStart = 0.08 }) {
  const f = (t) => {
    const b = t > bendStart ? Math.pow(2, (bend * Math.min(1, (t - bendStart) / (len - bendStart))) / 12) : 1;
    return (f1 + (mid - f1) * Math.exp(-t / tau2) + (f0 - mid) * Math.exp(-t / tau)) * b;
  };
  return D.osc(len, f, { amp: amp || D.ahd(0.0006, 0.1, 0.16) });
}
/* Clic de ataque: ráfaga de ruido filtrada + un «tok» de seno muy corto */
function click(seed, { f = 4500, q = 0.9, tau = 0.0025, tok = 1600, tokTau = 0.003, nGain = 0.7, tGain = 0.8 } = {}) {
  const n = D.env(D.bp(D.noise(0.03, seed), f, q), D.expEnv(tau));
  const t = D.osc(0.03, D.sweep(tok * 1.6, tok, 0.002), { amp: D.expEnv(tokTau) });
  return D.mix([n, nGain], [t, tGain]);
}
/* Cierre común (mono): sin continua, cola recortada, sin clics, limitado y a −1 dBTP (pico real) */
function finish(x, { tailDb = -66, peak = -1, release = 0 } = {}) {
  // release: caída final (s) para los kicks, que tras la saturación llegan al final con la cola entera
  let y = D.dcBlock(x);
  if (release) y = D.fadeEnd(y, release);
  y = D.fades(D.trimTail(y, tailDb));
  y = D.limit(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
/* Lo mismo en estéreo, con la misma ganancia en los dos canales */
function finishSt(s, { tailDb = -66, peak = -1 } = {}) {
  s = D.same(s);
  const L0 = D.dcBlock(s.L), R0 = D.dcBlock(s.R);
  const n = Math.max(D.trimTail(L0, tailDb).length, D.trimTail(R0, tailDb).length);
  let y = D.stereo(D.fades(L0.slice(0, n), 0.0005, 0.02), D.fades(R0.slice(0, n), 0.0005, 0.02));
  y = D.limitSt(y, peak + 0.3);
  return D.normalizeTP(y, peak);
}
const beat = (bpm) => 60 / bpm;

/* ---------------------------------------------------------------- kicks · hardcore */

function gabber() {
  // Rotterdam: un 909 llevado a la saturación, con la cola larga y cuadrada
  const b = body({ f0: 2400, mid: 210, f1: D.note('F', 1), tau: 0.004, tau2: 0.05, len: 0.78, amp: D.ahd(0.0006, 0.16, 0.2) });
  let x = D.mix([b, 1], [click(11, { f: 3800, tok: 1400 }), 0.35]);
  x = D.tube(x, 7, 0.15);
  x = D.eq(x, 420, -5, 0.9);
  x = D.eq(x, 2600, 4, 1.2);
  x = D.drive(x, 3.2);
  x = D.lp(x, 9000);
  x = D.hp(x, 32);
  return finish(x, { release: 0.26 });
}
function mainstream() {
  // punch limpio + cola tonal distorsionada que se va cerrando: la cola «habla» al bajar el filtro
  const punch = D.drive(body({ f0: 3000, mid: 240, f1: 62, tau: 0.003, tau2: 0.03, len: 0.16, amp: D.ahd(0.0005, 0.03, 0.04) }), 2.2);
  const tailN = D.note('G#', 1);
  let tail = body({ f0: 900, mid: tailN * 2, f1: tailN, tau: 0.004, tau2: 0.04, len: 0.72, amp: D.ahd(0.02, 0.32, 0.17), bend: -0.7, bendStart: 0.3 });
  tail = D.fold(D.gain(tail, 1.8), 1);
  tail = D.drive(tail, 6);
  tail = D.filter(tail, 'lp', D.ramp(7000, 1600, 0.7, 0.6), { q: 1.4 });
  tail = D.env(tail, (t) => (t < 0.04 ? t / 0.04 : 1));
  let x = D.mix([punch, 0.9], [click(12, { f: 5200, tok: 2000 }), 0.3], [tail, 0.75, 0.035]);
  x = D.eq(x, 90, 2.5, 0.8);
  x = D.hp(x, 30);
  return finish(x, { release: 0.26 });
}
function industrial() {
  // más oscuro: cuerpo grave, capa de ruido metálico y una sala pequeña
  const b = body({ f0: 1800, mid: 160, f1: D.note('D#', 1), tau: 0.005, tau2: 0.06, len: 0.7, amp: D.ahd(0.0008, 0.14, 0.18) });
  const metal = D.env(D.bp(D.mix([D.osc(0.25, 317, { shape: 'square' }), 0.5], [D.osc(0.25, 461, { shape: 'square' }), 0.5], [D.noise(0.25, 21), 0.6]), 1900, 2.5), D.expEnv(0.045));
  let x = D.mix([b, 1], [metal, 0.35], [click(13, { f: 2600, tok: 900, q: 1.4 }), 0.4]);
  x = D.tube(x, 5, 0.25);
  x = D.drive(x, 2.6);
  x = D.lp(x, 4200, 0.9);
  x = D.fadeEnd(x, 0.24);
  const room = D.reverb(x, { size: 0.55, damp: 0.6, tail: 0.5 });
  const y = D.mixSt([x, 1], [room, 0.18]);
  return finishSt(D.stereo(D.hp(y.L, 30), D.hp(y.R, 30)));
}
function crunch() {
  // corto y roto: reducción de bits y frecuencia de muestreo sobre un kick saturado
  const b = body({ f0: 2200, mid: 200, f1: D.note('A', 1), tau: 0.004, tau2: 0.04, len: 0.36, amp: D.ahd(0.0006, 0.07, 0.09) });
  let x = D.mix([b, 1], [click(14, { f: 3000 }), 0.4]);
  x = D.drive(x, 5);
  x = D.crush(x, 6, 3);
  x = D.lp(x, 7000);
  x = D.clip(x, 1.4, 0.95);
  x = D.hp(x, 35);
  return finish(x, { release: 0.12 });
}
function earlyHC() {
  // early hardcore (1992–1995): 909 saturado, menos cola, más golpe; a 160–180 BPM
  const b = body({ f0: 1500, mid: 150, f1: D.note('B', 1), tau: 0.006, tau2: 0.05, len: 0.48, amp: D.ahd(0.0008, 0.05, 0.13) });
  let x = D.mix([b, 1], [click(15, { f: 3500, tok: 1200, nGain: 0.9 }), 0.45]);
  x = D.drive(x, 3.5);
  x = D.eq(x, 160, 2, 1);
  x = D.lp(x, 8000);
  x = D.hp(x, 35);
  return finish(x, { release: 0.16 });
}
function millennium() {
  // golpe con clic seco y cola grave y redonda, saturación media y filtrada (más «boom» que «crunch»)
  const b = body({ f0: 3200, mid: 180, f1: D.note('E', 1), tau: 0.0025, tau2: 0.055, len: 1.0, amp: D.ahd(0.0006, 0.24, 0.26) });
  let x = D.mix([b, 1], [click(16, { f: 6000, tok: 2400, tau: 0.0018 }), 0.5]);
  x = D.tube(x, 2.5, 0.1);
  x = D.drive(x, 1.6);
  x = D.lp(x, 1800, 0.8);
  x = D.eq(x, 50, 4, 0.9);
  // el clic vuelve a ponerse por encima del filtro: golpe seco arriba, «boom» limpio abajo
  x = D.mix([x, 1], [D.hp(click(17, { f: 6500, tok: 2600, tau: 0.0015 }), 2500), 0.35]);
  x = D.hp(x, 28);
  return finish(x, { release: 0.28 });
}

/* ---------------------------------------------------------------- kicks · newstyle */

function nsPunch() {
  // corto y apretado, mucho ataque: el kick del newstyle de sala, a 150 BPM
  const b = body({ f0: 2000, mid: 160, f1: D.note('G#', 1), tau: 0.003, tau2: 0.035, len: 0.32, amp: D.ahd(0.0005, 0.05, 0.07) });
  let x = D.mix([b, 1], [click(21, { f: 5000, tok: 1800 }), 0.5]);
  x = D.tube(x, 2.5, 0.1);
  x = D.drive(x, 2);
  x = D.eq(x, 100, 3, 0.9);
  x = D.eq(x, 3500, 2, 1);
  x = D.hp(x, 35);
  return finish(x, { release: 0.1 });
}
function nsTail() {
  // golpe y cola afinada (La 1) que cae un tono: la herencia del hard house americano
  const b = body({ f0: 2200, mid: 200, f1: D.note('A', 1), tau: 0.003, tau2: 0.04, len: 0.56, amp: D.ahd(0.0005, 0.14, 0.13), bend: -2, bendStart: 0.1 });
  let x = D.mix([b, 1], [click(22, { f: 4200, tok: 1500 }), 0.4]);
  x = D.tube(x, 3.5, 0.15);
  x = D.drive(x, 2.4);
  x = D.lp(x, 6500);
  x = D.hp(x, 32);
  return finish(x, { release: 0.2 });
}
function nsMasia() {
  // parte de arriba dura y metálica sobre un cuerpo corto: corta la mezcla sin subir graves
  const b = body({ f0: 2600, mid: 230, f1: D.note('A#', 1), tau: 0.003, tau2: 0.03, len: 0.26, amp: D.ahd(0.0005, 0.04, 0.06) });
  const top = D.env(D.hp(D.noise(0.06, 23), 5500), D.expEnv(0.012));
  let x = D.mix([b, 1], [click(24, { f: 6500, q: 1.2, tok: 2600 }), 0.55], [top, 0.45]);
  x = D.drive(x, 4.5);
  x = D.eq(x, 4500, 4, 1.3);
  x = D.hp(x, 38);
  return finish(x, { release: 0.1 });
}
function nsJump() {
  // «boom» redondo y largo, poca distorsión: el kick de jump que el newstyle mezcla con el suyo
  const b = body({ f0: 1300, mid: 130, f1: D.note('F#', 1), tau: 0.004, tau2: 0.06, len: 0.62, amp: D.ahd(0.0008, 0.12, 0.18) });
  let x = D.mix([b, 1], [click(25, { f: 3000, tok: 1000, nGain: 0.5 }), 0.3]);
  x = D.tube(x, 1.8, 0.1);
  x = D.lp(x, 5000);
  x = D.eq(x, 70, 2.5, 0.8);
  x = D.hp(x, 28);
  return finish(x, { release: 0.22 });
}
function nsOffbeat() {
  // bajo inverso para el contratiempo (La 1, 150 BPM): sube en una corchea y se corta seco antes del kick
  const f = D.note('A', 1), L = beat(150) / 2;
  const tone = D.mix([D.osc(L + 0.01, f), 1], [D.osc(L + 0.01, f, { shape: 'tri' }), 0.3], [D.osc(L + 0.01, f * 2), 0.15]);
  let x = D.env(tone, (t) => Math.pow(t / L, 2.2) * (t > L - 0.008 ? (L - t) / 0.008 : 1));
  x = D.lp(x, D.ramp(300, 1800, L, 2), 1.2);
  x = D.tube(x, 2.4, 0.2);
  x = D.hp(x, 35);
  return finish(x);
}

/* ---------------------------------------------------------------- kicks · uptempo */

function utScreech() {
  // golpe brutal y un chillido resonante que baja: el uptempo a 200+ BPM
  const f1 = D.note('C#', 2);
  const b = body({ f0: 3000, mid: 280, f1, tau: 0.0025, tau2: 0.03, len: 0.34, amp: D.ahd(0.0005, 0.12, 0.08) });
  let x = D.mix([b, 1], [click(31, { f: 5000, tok: 2200 }), 0.4]);
  x = D.fold(x, 2.2);
  x = D.drive(x, 6);
  const scr = D.filter(D.osc(0.34, (t) => f1 * 4 * Math.pow(0.7, t * 3), { shape: 'saw', amp: D.ahd(0.02, 0.15, 0.06) }), 'bp', D.ramp(3200, 900, 0.3, 0.7), { q: 9 });
  x = D.mix([x, 0.85], [D.drive(scr, 3), 0.45]);
  x = D.lp(x, 9000);
  x = D.hp(x, 40);
  return finish(x, { release: 0.1 });
}
function utRaw() {
  // recorte duro: casi una onda cuadrada, muy corta
  const b = body({ f0: 2600, mid: 260, f1: D.note('C#', 2), tau: 0.003, tau2: 0.03, len: 0.27, amp: D.ahd(0.0005, 0.08, 0.06) });
  let x = D.mix([b, 1], [click(32, { f: 4500 }), 0.3]);
  x = D.clip(x, 18, 0.9);
  x = D.lp(x, 6000, 0.8);
  x = D.eq(x, 1200, -4, 1);
  x = D.hp(x, 40);
  return finish(x, { release: 0.09 });
}
function utTok() {
  // «tok» seco de ataque y cola alta (Re 2) distorsionada
  const tok = D.env(D.osc(0.05, D.sweep(1200, 240, 0.006)), D.expEnv(0.008));
  const f1 = D.note('D', 2);
  let tail = body({ f0: 600, mid: f1 * 1.6, f1, tau: 0.004, tau2: 0.03, len: 0.3, amp: D.ahd(0.004, 0.1, 0.07) });
  tail = D.drive(D.tube(tail, 6, 0.3), 4);
  let x = D.mix([tok, 0.9], [tail, 0.8, 0.008], [click(33, { f: 6000, tok: 2500 }), 0.3]);
  x = D.eq(x, 2400, 3, 1.4);
  x = D.lp(x, 9000);
  x = D.hp(x, 40);
  return finish(x, { release: 0.1 });
}
function utZaag() {
  // la cola es una sierra plegada: un zumbido áspero («zaag») típico del uptempo
  const f1 = D.note('D#', 2);
  const b = body({ f0: 2400, mid: 240, f1, tau: 0.003, tau2: 0.03, len: 0.1, amp: D.ahd(0.0005, 0.03, 0.03) });
  let saw = D.osc(0.32, (t) => f1 * (1 - 0.06 * t), { shape: 'saw', amp: D.ahd(0.01, 0.12, 0.07) });
  saw = D.fold(D.gain(saw, 2.4), 1);
  saw = D.filter(saw, 'lp', D.ramp(5000, 1400, 0.3), { q: 2 });
  let x = D.mix([D.drive(b, 4), 1], [saw, 0.6, 0.02], [click(34, { f: 4000 }), 0.35]);
  x = D.drive(x, 2.5);
  x = D.hp(x, 40);
  return finish(x, { release: 0.11 });
}
function utPitch() {
  // cola que se desploma de tono (de 90 a 55 Hz) con mucha saturación: el «drop» de cada golpe
  const b = body({ f0: 3000, mid: 300, f1: 90, tau: 0.0025, tau2: 0.025, len: 0.38, amp: D.ahd(0.0005, 0.14, 0.09), bend: -8.5, bendStart: 0.04 });
  let x = D.mix([b, 1], [click(35, { f: 5200, tok: 2000 }), 0.4]);
  x = D.tube(x, 9, 0.25);
  x = D.drive(x, 4);
  x = D.lp(x, 7000, 0.9);
  x = D.hp(x, 40);
  return finish(x, { release: 0.12 });
}

/* ---------------------------------------------------------------- palmas y cajas */

function clapBursts(seed, { f = 1250, q = 1.1, last = 0.07 } = {}) {
  const offs = [0, 0.0095, 0.019, 0.031], parts = [];
  offs.forEach((o, k) => {
    const tau = k === offs.length - 1 ? last : 0.0055;
    parts.push([D.env(D.bp(D.noise(k === offs.length - 1 ? 0.5 : 0.04, seed + k), f, q), D.expEnv(tau)), k === offs.length - 1 ? 1 : 0.75, o]);
  });
  return D.mix(...parts);
}
function clapRoom() {
  const c = D.hp(clapBursts(41), 400);
  const room = D.reverb(c, { size: 0.72, damp: 0.5, tail: 0.9, pre: 0.012 });
  return finishSt(D.mixSt([c, 1], [room, 0.32]));
}
function clapHC() {
  // la palma del hardcore: saturada, con medios al frente y cola cortada
  let c = clapBursts(43, { f: 1500, q: 1.3, last: 0.1 });
  c = D.drive(c, 5);
  c = D.eq(c, 2100, 4, 1);
  c = D.hp(c, 500);
  const room = D.reverb(c, { size: 0.8, damp: 0.35, tail: 0.6 });
  const y = D.mixSt([c, 1], [room, 0.35]);
  return finishSt(D.stereo(D.gate(y.L, 0.24, 0.04), D.gate(y.R, 0.24, 0.04)));
}
function snareBody(seed, { f = 205, tau = 0.05, nTau = 0.09, nf = 1800 } = {}) {
  const tone = D.osc(0.4, D.sweep(f * 1.5, f, 0.012), { amp: D.expEnv(tau) });
  const tone2 = D.osc(0.4, f * 1.62, { amp: D.expEnv(tau * 0.6) });
  const nz = D.env(D.hp(D.noise(0.4, seed), nf), D.expEnv(nTau));
  return D.mix([tone, 0.8], [tone2, 0.3], [nz, 0.9], [click(seed + 5, { f: 5000, tok: 1800 }), 0.25]);
}
function snareTight() {
  let x = snareBody(51);
  x = D.tube(x, 1.6, 0.1);
  x = D.eq(x, 220, 2, 1.2);
  return finish(x);
}
function snareHC() {
  // caja gorda y saturada con reverb cortada en seco (la «gated reverb» de siempre)
  let x = snareBody(53, { f: 190, tau: 0.07, nTau: 0.14, nf: 1400 });
  x = D.drive(x, 4.5);
  x = D.eq(x, 900, -3, 1);
  const room = D.reverb(x, { size: 0.85, damp: 0.3, tail: 0.8 });
  const y = D.mixSt([x, 1], [room, 0.55]);
  return finishSt(D.stereo(D.gate(y.L, 0.3, 0.03), D.gate(y.R, 0.3, 0.03)));
}
function snareClap() {
  const s = snareBody(55, { f: 215, nTau: 0.08 }), c = D.hp(clapBursts(56, { f: 1350 }), 350);
  let x = D.mix([s, 0.8], [c, 0.8, 0.003]);
  x = D.compress(x, { thrDb: -14, ratio: 4, makeup: 2 });
  x = D.drive(x, 1.6);
  return finish(x);
}
function rim() {
  const a = D.osc(0.06, 1720, { amp: D.expEnv(0.012) }), b = D.osc(0.06, 510, { amp: D.expEnv(0.018) });
  const n = D.env(D.bp(D.noise(0.06, 57), 3200, 1.5), D.expEnv(0.004));
  let x = D.mix([a, 0.7], [b, 0.6], [n, 0.8]);
  x = D.drive(x, 1.8);
  return finish(x);
}

/* ---------------------------------------------------------------- percusión y redobles */

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(dur, seed, scale = 1.45) {
  return D.mix(...METAL.map((f, k) => [D.osc(dur, f * scale, { shape: 'square', phase: (seed * 0.137 * (k + 1)) % 1 }), 1 / METAL.length]));
}
function hatClosed() {
  let x = D.mix([metal(0.15, 61), 1], [D.noise(0.15, 61), 0.25]);
  x = D.bp(x, 9000, 0.8); x = D.hp(x, 6500);
  x = D.env(x, D.ahd(0.0005, 0.004, 0.02));
  return finish(x, { tailDb: -60 });
}
function hatOpen() {
  let x = D.mix([metal(0.7, 62), 1], [D.noise(0.7, 62), 0.25]);
  x = D.bp(x, 8500, 0.7); x = D.hp(x, 6000);
  x = D.env(x, D.ahd(0.001, 0.02, 0.17));
  return finishSt(D.widen(x, 0.4, 62));
}
function percMetal() {
  // golpe metálico por FM: portadora 620 Hz modulada a 1381 Hz, con una sala corta
  const n = D.secs(0.5), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, I = 3.2 * Math.exp(-t / 0.05); x[i] = Math.sin(2 * Math.PI * 620 * t + I * Math.sin(2 * Math.PI * 1381 * t)) * Math.exp(-t / 0.11); }
  let y = D.drive(x, 2.2);
  const room = D.reverb(y, { size: 0.6, damp: 0.5, tail: 0.5 });
  return finishSt(D.mixSt([y, 1], [room, 0.25]));
}
function crashBuf(seed) {
  let x = D.mix([D.noise(2.6, seed), 0.8], [metal(2.6, seed, 2.1), 0.5], [metal(2.6, seed + 1, 3.3), 0.35]);
  x = D.hp(x, 3500); x = D.eq(x, 7000, 3, 0.8);
  return D.env(x, D.ahd(0.002, 0.01, 0.75));
}
function crash() {
  const x = crashBuf(63);
  const w = D.widen(x, 0.7, 63);
  const room = D.reverb(x, { size: 0.7, damp: 0.4, tail: 0.8 });
  return finishSt(D.mixSt([w, 1], [room, 0.18]));
}
function fillSnare() {
  // 1 compás a 180 BPM: semicorcheas y, en la segunda mitad, fusas; sube el volumen y el tono
  const bpm = 180, bar = beat(bpm) * 4, hit = snareBody(71, { nTau: 0.06 }), parts = [];
  let t = 0;
  while (t < bar - 1e-6) {
    const step = t < bar / 2 ? beat(bpm) / 4 : beat(bpm) / 8, p = t / bar;
    const h = D.cut(D.rate(hit, 1 + 0.3 * p * p), 0, step * 1.6);
    parts.push([D.fades(h, 0.0003, 0.005), 0.3 + 0.7 * Math.pow(p, 1.5), t]);
    t += step;
  }
  let x = D.drive(D.mix(...parts), 1.6);
  return finishSt(D.widen(x, 0.25, 71));
}
function fillKick() {
  // 1 compás a 200 BPM: corcheas, semicorcheas y fusas de kick uptempo, cada golpe cortado a su paso
  const bpm = 200, B = beat(bpm), k = utRaw(), parts = [];
  const plan = [[0, 2, B / 2], [2 * B, 1, B / 4], [3 * B, 1, B / 8]];
  for (const [start, beats, step] of plan) for (let t = start; t < start + beats * B - 1e-6; t += step) {
    const p = t / (4 * B);
    parts.push([D.fades(D.cut(D.rate(k, 1 + 0.12 * p), 0, step * 0.95), 0.0003, 0.004), 0.55 + 0.45 * p, t]);
  }
  return finish(D.mix(...parts));
}
function fillToms() {
  // ocho golpes de tom en semicorcheas a 180 BPM, bajando de agudo a grave
  const bpm = 180, step = beat(bpm) / 4, pitches = [240, 240, 190, 190, 150, 150, 115, 115], parts = [];
  pitches.forEach((f, k) => {
    const tom = D.mix([D.osc(0.5, D.sweep(f * 1.5, f, 0.03), { amp: D.expEnv(0.16) }), 1], [D.env(D.lp(D.noise(0.5, 80 + k), 2000), D.expEnv(0.02)), 0.2]);
    parts.push([tom, 0.75 + 0.05 * k, k * step]);
  });
  let x = D.drive(D.mix(...parts), 1.8);
  const room = D.reverb(x, { size: 0.6, damp: 0.5, tail: 0.6 });
  return finishSt(D.mixSt([x, 1], [room, 0.2]));
}

/* ---------------------------------------------------------------- impactos y transiciones */

function impactBoom() {
  const sub = D.osc(3, D.sweep(70, 32, 0.6), { amp: D.ahd(0.002, 0.1, 0.9) });
  const nz = D.env(D.filter(D.noise(3, 91), 'lp', D.sweep(9000, 180, 0.35), { q: 0.9 }), D.ahd(0.001, 0.02, 0.5));
  const hit = body({ f0: 2000, mid: 160, f1: 45, len: 0.6, amp: D.ahd(0.0006, 0.08, 0.14) });
  let x = D.mix([D.tube(sub, 1.8, 0.1), 0.9], [nz, 0.5], [D.drive(hit, 3), 0.8]);
  const room = D.reverb(D.hp(x, 200), { size: 0.9, damp: 0.35, tail: 2.2 });
  return finishSt(D.mixSt([x, 1], [room, 0.6]));
}
function impactHC() {
  const k = gabber(), c = crashBuf(93);
  let x = D.mix([k, 1], [c, 0.45]);
  x = D.drive(x, 2);
  const room = D.reverb(D.hp(x, 250), { size: 0.88, damp: 0.3, tail: 1.8 });
  return finishSt(D.mixSt([x, 1], [room, 0.5]));
}
function subDrop() {
  let x = D.osc(2.2, D.sweep(78, 27, 0.7), { amp: D.ahd(0.003, 0.15, 0.75) });
  x = D.tube(x, 2.2, 0.15);   // armónicos para que se oiga también en altavoces pequeños
  x = D.lp(x, 600);
  return finish(x, { tailDb: -60 });
}
function downlifter() {
  const L = 3;
  const nz = D.env(D.filter(D.noise(L, 95), 'bp', D.sweep(7000, 150, 0.9), { q: 1.8 }), D.ahd(0.01, 0.2, 1));
  const tone = D.osc(L, D.sweep(650, 55, 0.7), { shape: 'saw', amp: D.ahd(0.01, 0.1, 0.8) });
  const x = D.mix([nz, 1], [D.lp(tone, 1500), 0.3]);
  const w = D.widen(x, 0.8, 95);
  const room = D.reverb(x, { size: 0.85, damp: 0.4, tail: 1 });
  return finishSt(D.mixSt([w, 1], [room, 0.25]));
}
function reverseCrash() {
  const x = D.reverse(D.cut(crashBuf(97), 0, 2.2));
  const w = D.widen(x, 0.7, 97);
  return finishSt(w);
}
function tapeStop() {
  // cuatro negras de gabber a 180 BPM con bajo y, en el tercer tiempo, la cinta se frena hasta parar
  const B = beat(180), k = gabber(), parts = [];
  for (let i = 0; i < 4; i++) parts.push([D.cut(k, 0, B), 1, i * B]);
  const bass = D.env(D.lp(D.osc(4 * B, D.note('F', 2), { shape: 'saw' }), 700), (t) => ((t % B) > B / 2 ? 0.6 : 0));
  const loop = D.mix(...parts, [bass, 0.6]);
  const stop = 2 * B, end = stop + 0.85;
  const x = D.varispeed(loop, (t) => (t < stop ? 1 : Math.max(0, 1 - (t - stop) / (end - stop)) ** 1.4), end + 0.05);
  return finish(D.lp(x, 9000));
}

/* ---------------------------------------------------------------- subidas y efectos */

function riserNoise() {
  // 2 compases a 180 BPM: ruido que se abre de 300 Hz a 9 kHz y sube de volumen
  const L = beat(180) * 8;
  const x = D.env(D.filter(D.noise(L, 101), 'bp', D.ramp(300, 9000, L, 2.2), { q: D.ramp(1.4, 4, L) }), D.ramp(0.08, 1, L, 1.8));
  const w = D.widen(D.hp(x, 120), 0.85, 101);
  return finishSt(w);
}
function riserSaw() {
  // superserra (7 osciladores desafinados) que sube dos octavas en 2 compases a 180 BPM mientras abre el filtro
  const L = beat(180) * 8, f0 = D.note('C', 3), det = [-0.11, -0.07, -0.035, 0, 0.035, 0.07, 0.11];
  const f = (d) => (t) => f0 * Math.pow(2, 2 * Math.pow(t / L, 1.6) + d / 12 * 1.2);
  // la subida llega a tope al final y se corta (con 12 ms de fundido): ahí entra el drop
  const side = (sign) => D.mix(...det.map((d, k) => [D.osc(L, f(d * (k % 2 ? sign : -sign)), { shape: 'saw', phase: (k * 0.31) % 1 }), 1 / det.length, 0, 0.012]));
  const flt = (x) => D.env(D.filter(x, 'lp', D.ramp(400, 9000, L, 1.8), { q: 1.2 }), D.ramp(0.15, 1, L, 1.3));
  const st = D.stereo(flt(side(1)), flt(side(-1)));
  const room = D.reverb(D.mix([st.L, 0.5], [st.R, 0.5]), { size: 0.8, damp: 0.4, tail: 0.6 });
  return finishSt(D.mixSt([st, 1], [room, 0.2]));
}
function siren() {
  // sirena de rave: el tono sube y baja entre 650 y 1300 Hz, con eco a corchea con puntillo (180 BPM)
  const L = 2.4, f = (t) => 650 * Math.pow(2, 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.6 * t - Math.PI / 2));
  let x = D.mix([D.osc(L, f, { shape: 'saw' }), 0.6], [D.osc(L, (t) => f(t) * 1.005, { shape: 'square' }), 0.4]);
  x = D.lp(x, 3200); x = D.env(x, D.ahd(0.02, 1.8, 0.25)); x = D.drive(x, 1.5);
  const d = beat(180) * 0.75;
  return finishSt(D.mixSt([x, 1], [D.stereo(D.mix([x, 0.35, d]), D.mix([x, 0.35, d * 2])), 1]));
}
function laser() {
  // «zap» de 4 kHz a 120 Hz con eco ping-pong a semicorchea (180 BPM)
  const z = D.osc(0.18, D.sweep(4200, 120, 0.035), { shape: 'tri', amp: D.ahd(0.0005, 0.02, 0.05) });
  const s = beat(180) / 4;
  const L = D.mix([z, 1], [z, 0.45, 2 * s], [z, 0.2, 4 * s]), R = D.mix([z, 0.6, s], [z, 0.3, 3 * s], [z, 0.12, 5 * s]);
  return finishSt(D.stereo(L, R));
}
function hooverStab() {
  // golpe de sintetizador al estilo «hoover» (Do 3): pulsos con ancho modulado, desafinados, con la caída de tono típica
  const f = D.note('C', 3), L = 1.3, bendF = (m) => (t) => f * m * Math.pow(2, (3 * Math.exp(-t / 0.035)) / 12);
  const pwm = (t) => 0.5 + 0.35 * Math.sin(2 * Math.PI * 5.5 * t);
  const side = (det, seed) => D.mix(
    [D.osc(L, bendF(Math.pow(2, det / 1200)), { shape: 'pulse', pw: pwm, phase: seed }), 0.45],
    [D.osc(L, bendF(Math.pow(2, -det / 1200)), { shape: 'saw', phase: seed * 0.7 }), 0.35],
    [D.osc(L, bendF(0.5), { shape: 'pulse', pw: (t) => 1 - pwm(t), phase: seed * 0.3 }), 0.4]);
  const shape = (x) => D.env(D.drive(D.lp(x, 3200, 0.9), 1.6), D.ahd(0.004, 0.35, 0.35));
  const st = D.stereo(shape(side(14, 0.1)), shape(side(-17, 0.6)));
  return finishSt(st);
}
function horn() {
  // trompeta de rave (Fa# 3): sierras desafinadas con envolvente de filtro de metal y un poco de vibrato
  const f = D.note('F#', 3), L = 1.1;
  const vib = (m) => (t) => f * m * (1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.3));
  const side = (d) => D.mix([D.osc(L, vib(1 + d), { shape: 'saw' }), 0.4], [D.osc(L, vib(1 - d * 0.7), { shape: 'saw', phase: 0.4 }), 0.4], [D.osc(L, vib(0.5), { shape: 'saw', phase: 0.2 }), 0.3]);
  const shape = (x) => D.env(D.drive(D.filter(x, 'lp', (t) => 500 + 2600 * Math.min(1, t / 0.05) * Math.exp(-t / 0.6), { q: 1.6 }), 2), D.ahd(0.012, 0.6, 0.15));
  const st = D.stereo(shape(side(0.004)), shape(side(-0.005)));
  return finishSt(st);
}

/* ---------------------------------------------------------------- catálogo del pack */

/* cat: kick · bajo · perc · fx · loop · voz · tema · otro (las categorías del Soundpad); type: subtipo para filtrar */
export const SAMPLES = [
  { id: 'hc-kick-gabber', name: 'Kick gabber', style: 'hardcore', type: 'kick', cat: 'kick', key: 'F1', bpm: [170, 190], tags: ['gabber', 'rotterdam', '909', 'distorsión', 'cola larga'], render: gabber,
    notes: 'Seno con doble caída de tono (2,4 kHz → 210 Hz → Fa 1) y clic de ruido; saturación asimétrica, medios recortados a 420 Hz, presencia a 2,6 kHz y tanh.' },
  { id: 'hc-kick-mainstream', name: 'Kick mainstream', style: 'hardcore', type: 'kick', cat: 'kick', key: 'G#1', bpm: [180, 200], tags: ['mainstream', 'cola tonal', 'distorsión', 'moderno'], render: mainstream,
    notes: 'Dos capas: golpe limpio y cola afinada en Sol# 1 que se curva hacia abajo al final, plegada y saturada, con un paso bajo que se cierra de 7 a 1,6 kHz.' },
  { id: 'hc-kick-industrial', name: 'Kick industrial', style: 'hardcore', type: 'kick', cat: 'kick', key: 'D#1', bpm: [140, 180], tags: ['industrial', 'oscuro', 'metálico', 'sala'], render: industrial,
    notes: 'Cuerpo grave en Re# 1, capa metálica de cuadradas y ruido, filtrado a 4,2 kHz y una sala pequeña.' },
  { id: 'hc-kick-crunch', name: 'Kick crunch', style: 'hardcore', type: 'kick', cat: 'kick', key: 'A1', bpm: [170, 200], tags: ['bitcrush', 'corto', 'roto', 'lo-fi'], render: crunch,
    notes: 'Kick corto saturado y reducido a 6 bits y un tercio de la frecuencia de muestreo, con recorte final.' },
  { id: 'hc-kick-early', name: 'Kick early hardcore', style: 'hardcore', type: 'kick', cat: 'kick', key: 'B1', bpm: [160, 180], tags: ['early', '90s', '909', 'golpe'], render: earlyHC,
    notes: 'Un 909 saturado al estilo de principios de los 90: menos cola y más golpe, realce a 160 Hz.' },
  { id: 'hc-kick-millennium', name: 'Kick millennium', style: 'hardcore', type: 'kick', cat: 'kick', key: 'E1', bpm: [170, 190], tags: ['millennium', 'boom', 'grave', 'clic'], render: millennium,
    notes: 'Cola larga y grave en Mi 1, poco saturada y filtrada a 1,8 kHz con los subgraves realzados, y el clic seco repuesto por encima: más «boom» que «crunch».' },

  { id: 'ns-kick-punch', name: 'Kick newstyle punch', style: 'newstyle', type: 'kick', cat: 'kick', key: 'G#1', bpm: [145, 155], tags: ['punch', 'corto', 'sala', 'masía'], render: nsPunch,
    notes: 'Corto y apretado, con mucho ataque: saturación suave, graves a 100 Hz y presencia a 3,5 kHz.' },
  { id: 'ns-kick-tail', name: 'Kick newstyle con cola', style: 'newstyle', type: 'kick', cat: 'kick', key: 'G#1', bpm: [145, 155], tags: ['cola', 'hard house', 'afinado'], render: nsTail,
    notes: 'Golpe y cola que arranca en La 1 y cae un tono (se oye en torno a Sol# 1), heredera del hard house americano.' },
  { id: 'ns-kick-masia', name: 'Kick newstyle duro', style: 'newstyle', type: 'kick', cat: 'kick', key: null, bpm: [145, 155], tags: ['agudo', 'metálico', 'corta la mezcla'], render: nsMasia,
    notes: 'Cuerpo corto con una capa de ruido agudo y realce a 4,5 kHz: se oye sin subir los graves.' },
  { id: 'ns-kick-jump', name: 'Kick jump', style: 'newstyle', type: 'kick', cat: 'kick', key: 'F#1', bpm: [140, 150], tags: ['jumpstyle', 'boom', 'redondo'], render: nsJump,
    notes: '«Boom» largo y redondo en Fa# 1 con poca distorsión, el kick de jump que el newstyle mezcla con el suyo.' },
  { id: 'ns-bass-offbeat', name: 'Bajo de contratiempo', style: 'newstyle', type: 'bajo', cat: 'bajo', key: 'A1', bpm: [150, 150], tags: ['reverse bass', 'offbeat', 'contratiempo'], render: nsOffbeat,
    notes: 'Bajo inverso de una corchea a 150 BPM en La 1: sube de volumen y de brillo y se corta seco justo antes del siguiente kick.' },

  { id: 'ut-kick-screech', name: 'Kick uptempo screech', style: 'uptempo', type: 'kick', cat: 'kick', key: 'C#2', bpm: [200, 230], tags: ['screech', 'chillido', 'resonante'], render: utScreech,
    notes: 'Kick plegado y saturado con un chillido: sierra filtrada por un paso banda resonante (Q 9) que baja de 3,2 a 0,9 kHz.' },
  { id: 'ut-kick-raw', name: 'Kick uptempo raw', style: 'uptempo', type: 'kick', cat: 'kick', key: 'C#2', bpm: [200, 250], tags: ['recorte', 'cuadrado', 'corto'], render: utRaw,
    notes: 'Recorte duro (×18) hasta casi una cuadrada, filtrado a 6 kHz y con un hueco a 1,2 kHz.' },
  { id: 'ut-kick-tok', name: 'Kick uptempo tok', style: 'uptempo', type: 'kick', cat: 'kick', key: 'D2', bpm: [200, 230], tags: ['tok', 'ataque', 'cola alta'], render: utTok,
    notes: '«Tok» de seno muy corto y cola alta en Re 2 con saturación de válvula.' },
  { id: 'ut-kick-zaag', name: 'Kick uptempo zaag', style: 'uptempo', type: 'kick', cat: 'kick', key: 'D#2', bpm: [200, 240], tags: ['zaag', 'sierra', 'zumbido'], render: utZaag,
    notes: 'Golpe corto y cola de sierra plegada que se va cerrando: el zumbido áspero del uptempo.' },
  { id: 'ut-kick-pitch', name: 'Kick uptempo drop', style: 'uptempo', type: 'kick', cat: 'kick', key: null, bpm: [200, 230], tags: ['caída de tono', 'drop', 'distorsión'], render: utPitch,
    notes: 'La cola cae de 90 a 55 Hz en cada golpe, con saturación de válvula y tanh.' },

  { id: 'clap-room', name: 'Palma con sala', style: 'general', type: 'palma', cat: 'perc', tags: ['clap', 'sala', 'reverb'], render: clapRoom,
    notes: 'Cuatro ráfagas de ruido a 1,25 kHz separadas unos 10 ms y una sala de 0,9 s.' },
  { id: 'clap-hardcore', name: 'Palma hardcore', style: 'hardcore', type: 'palma', cat: 'perc', tags: ['clap', 'saturada', 'reverb cortada'], render: clapHC,
    notes: 'Palma saturada con los medios al frente (2,1 kHz) y reverb cortada en seco a 240 ms.' },
  { id: 'snare-tight', name: 'Caja seca', style: 'general', type: 'caja', cat: 'perc', tags: ['snare', 'corta', 'seca'], render: snareTight,
    notes: 'Tono de 205 Hz con armónico, ruido por encima de 1,8 kHz y clic de ataque.' },
  { id: 'snare-hardcore', name: 'Caja hardcore', style: 'hardcore', type: 'caja', cat: 'perc', tags: ['snare', 'gated reverb', 'saturada'], render: snareHC,
    notes: 'Caja gorda saturada con reverb grande cortada a 300 ms.' },
  { id: 'snare-clap', name: 'Caja y palma', style: 'newstyle', type: 'caja', cat: 'perc', tags: ['snare', 'clap', 'capas'], render: snareClap,
    notes: 'Caja y palma superpuestas y pegadas con compresión.' },
  { id: 'rim', name: 'Aro', style: 'general', type: 'percusión', cat: 'perc', tags: ['rimshot', 'corto', 'seco'], render: rim,
    notes: 'Dos senos (1,72 kHz y 510 Hz) y un clic de ruido, muy corto.' },

  { id: 'hat-closed', name: 'Charles cerrado', style: 'general', type: 'charles', cat: 'perc', tags: ['hi-hat', 'cerrado', 'metálico'], render: hatClosed,
    notes: 'Seis osciladores cuadrados en proporciones inarmónicas (estilo 808) más ruido, filtrados por encima de 6,5 kHz.' },
  { id: 'hat-open', name: 'Charles abierto', style: 'general', type: 'charles', cat: 'perc', tags: ['hi-hat', 'abierto', 'offbeat'], render: hatOpen,
    notes: 'El mismo metal con una caída de 170 ms y algo de estéreo. Ponlo en el mismo grupo de corte que el cerrado.' },
  { id: 'perc-metal', name: 'Golpe metálico', style: 'hardcore', type: 'percusión', cat: 'perc', tags: ['fm', 'metal', 'ping'], render: percMetal,
    notes: 'FM: portadora de 620 Hz modulada a 1381 Hz con índice que cae, saturada y con sala corta.' },
  { id: 'crash', name: 'Plato crash', style: 'general', type: 'plato', cat: 'perc', tags: ['crash', 'plato', 'estéreo'], render: crash,
    notes: 'Ruido y dos capas metálicas por encima de 3,5 kHz, caída de 0,75 s, ensanchado y con sala.' },
  { id: 'fill-snare-180', name: 'Redoble de caja', style: 'hardcore', type: 'redoble', cat: 'perc', bpm: [180, 180], tags: ['fill', 'redoble', 'build', '1 compás'], render: fillSnare,
    notes: 'Un compás a 180 BPM: semicorcheas y fusas en la segunda mitad, subiendo de volumen y de tono.' },
  { id: 'fill-kick-200', name: 'Redoble de kick', style: 'uptempo', type: 'redoble', cat: 'kick', bpm: [200, 200], tags: ['fill', 'kick roll', '1 compás'], render: fillKick,
    notes: 'Un compás a 200 BPM con el kick uptempo raw: corcheas, semicorcheas y fusas, cada golpe cortado a su paso.' },
  { id: 'fill-toms-180', name: 'Redoble de toms', style: 'general', type: 'redoble', cat: 'perc', bpm: [180, 180], tags: ['fill', 'toms', 'bajada'], render: fillToms,
    notes: 'Ocho toms en semicorcheas a 180 BPM, de 240 a 115 Hz.' },

  { id: 'impact-boom', name: 'Impacto grave', style: 'general', type: 'impacto', cat: 'fx', tags: ['impact', 'sub', 'reverb'], render: impactBoom,
    notes: 'Sub que cae de 70 a 32 Hz, ruido que se cierra de 9 kHz a 180 Hz, un golpe de kick y una reverb grande.' },
  { id: 'impact-hardcore', name: 'Impacto hardcore', style: 'hardcore', type: 'impacto', cat: 'fx', tags: ['impact', 'kick', 'crash'], render: impactHC,
    notes: 'El kick gabber con un crash encima, saturado y con reverb larga: para marcar la entrada de un drop.' },
  { id: 'subdrop', name: 'Sub drop', style: 'general', type: 'transición', cat: 'fx', tags: ['sub', 'drop', 'grave'], render: subDrop,
    notes: 'Seno que cae de 78 a 27 Hz en 2 s, con armónicos para que se note en altavoces pequeños.' },
  { id: 'downlifter', name: 'Bajada', style: 'general', type: 'transición', cat: 'fx', tags: ['downlifter', 'ruido', 'barrido'], render: downlifter,
    notes: 'Ruido por un paso banda que baja de 7 kHz a 150 Hz y una sierra que cae de 650 a 55 Hz.' },
  { id: 'reverse-crash', name: 'Crash al revés', style: 'general', type: 'transición', cat: 'fx', tags: ['reverse', 'crash', 'entrada'], render: reverseCrash,
    notes: 'El crash del pack al revés, 2,2 s: para entrar a un compás.' },
  { id: 'tape-stop', name: 'Parada de cinta', style: 'hardcore', type: 'transición', cat: 'fx', bpm: [180, 180], tags: ['tape stop', 'frenazo', 'transición'], render: tapeStop,
    notes: 'Cuatro negras de kick gabber con bajo a 180 BPM; en el tercer tiempo la «cinta» se frena hasta pararse.' },

  { id: 'riser-noise', name: 'Subida de ruido', style: 'general', type: 'subida', cat: 'fx', bpm: [180, 180], tags: ['riser', 'ruido', '2 compases'], render: riserNoise,
    notes: 'Dos compases a 180 BPM: ruido por un paso banda que se abre de 300 Hz a 9 kHz mientras sube de volumen.' },
  { id: 'riser-supersaw', name: 'Subida de superserra', style: 'general', type: 'subida', cat: 'fx', key: 'C3', bpm: [180, 180], tags: ['riser', 'supersaw', '2 compases'], render: riserSaw,
    notes: 'Siete sierras desafinadas que suben dos octavas desde Do 3 en dos compases a 180 BPM, con el filtro abriéndose.' },
  { id: 'siren', name: 'Sirena', style: 'hardcore', type: 'efecto', cat: 'fx', tags: ['sirena', 'rave', 'eco'], render: siren,
    notes: 'Sierra y cuadrada cuyo tono oscila entre 650 y 1300 Hz, con eco a corchea con puntillo (180 BPM).' },
  { id: 'laser', name: 'Láser', style: 'general', type: 'efecto', cat: 'fx', tags: ['zap', 'láser', 'ping-pong'], render: laser,
    notes: 'Barrido de 4,2 kHz a 120 Hz en 35 ms con eco ping-pong a semicorchea.' },
  { id: 'hoover-stab', name: 'Stab estilo hoover', style: 'hardcore', type: 'sintetizador', cat: 'fx', key: 'C3', tags: ['hoover', 'stab', 'rave', 'pwm'], render: hooverStab,
    notes: 'Pulsos con ancho modulado y sierras desafinadas en Do 3, con la caída de tono de tres semitonos típica de ese sonido.' },
  { id: 'horn', name: 'Trompeta de rave', style: 'hardcore', type: 'sintetizador', cat: 'fx', key: 'F#3', tags: ['horn', 'rave', 'metal'], render: horn,
    notes: 'Sierras desafinadas en Fa# 3 con una envolvente de filtro de metal y algo de vibrato.' }
];
