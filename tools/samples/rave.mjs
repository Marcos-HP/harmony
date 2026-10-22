/* HARMONY · instrumentos duros para el hardcore y el hard techno (Harmony 09)
   Cada uno devuelve una nota (mono, salvo el hoover, que es estéreo). Se apoyan en dsp.mjs y synth.mjs.
     hoover    pulso-sierra con ancho modulado ×3 (dos a ±40 cents y una octava abajo), unísono abierto en estéreo,
               subida de tono de 5 semitonos que vuelve a la nota (el «uuah»), paso bajo resonante, coro y saturación;
               es la receta del hoover de los 90 (MusicRadar, «How to create a classic 90s hoover sound»).
     screech   sierras por un paso banda muy resonante que baja y tiembla, con el cuerpo en la fundamental, muy saturado.
     rawLead   supersierra de 7 voces y cuadrada una octava abajo, dos distorsiones y los medios (1,4 kHz) realzados.
     ravePiano piano de rave: dos cuerdas por nota algo desafinadas, parciales inarmónicos, martillo brillante;
               −4 dB en 500 Hz, +5 dB en 2,5 kHz y algo de saturación (MusicRadar, «90s rave-style piano chords»).
     glideBass bajo distorsionado que cae a la nota desde un semitono arriba (el bajo a contratiempo del hardcore). */
import * as D from './dsp.mjs';
import * as S from './synth.mjs';
import * as V from './voice.mjs';

const SR = D.SR, TAU = Math.PI * 2;

/* el hoover: devuelve { L, R } */
export function hoover(f, gate, vel = 1, { bend = 5, seed = 3, cutoff = 3600, res = 1.4 } = {}) {
  const r = D.rng(seed), L = gate + 0.3;
  // tono: sube `bend` semitonos en 35 ms y vuelve en ~150 ms
  const pe = (t) => (t < 0.035 ? t / 0.035 : Math.exp(-(t - 0.035) / 0.09));
  const side = (s) => {
    const parts = [];
    for (const [mult, cents] of [[1, 40], [1, -40], [0.5, 0]]) for (let u = 0; u < 3; u++) {
      const c = cents + (u - 1) * 9 + (r() - 0.5) * 4 + s * 5, ph = r(), rate = 2.2 + r() * 1.6;
      const fr = (t) => f * mult * Math.pow(2, (c / 100 + bend * pe(t)) / 12);
      const pw = (t) => 0.5 + 0.38 * Math.sin(TAU * rate * t + ph * TAU);
      parts.push([D.osc(L, fr, { shape: 'saw', phase: ph }), 0.22], [D.osc(L, fr, { shape: 'pulse', pw, phase: (ph + 0.3) % 1 }), 0.2]);
    }
    let x = D.mix(...parts);
    x = D.filter(x, 'lp', (t) => cutoff * (0.75 + 0.25 * Math.exp(-t / 0.2)), { q: res });
    // fase (muesca que se mueve despacio) y coro
    x = D.filter(x, 'notch', (t) => 1300 + 900 * Math.sin(TAU * 0.6 * t + s), { q: 1.2 });
    const ch = D.mix([x, 1], [x, 0.5, 0.011 + 0.003 * s, 0.002]);
    const e = S.adsr(gate, { a: 0.008, d: 0.35, s: 0.82, r: 0.22 });
    return D.map(ch, (v, i) => Math.tanh(v * 1.7 * e(i / SR)) * vel);
  };
  return D.same(D.stereo(side(0), side(1)));
}

/* screech de hardcore */
export function screech(f, gate, vel = 1, { from = 6, to = 2.5, q = 10, wob = 7, drive = 10, seed = 5 } = {}) {
  const r = D.rng(seed), L = gate + 0.06;
  const x = D.mix([D.osc(L, f * 1.007, { shape: 'saw', phase: r() }), 0.5], [D.osc(L, f * 0.993, { shape: 'saw', phase: r() }), 0.5], [D.osc(L, f * 0.5, { shape: 'square', phase: r() }), 0.35]);
  const cf = (t) => f * (to + (from - to) * Math.exp(-t / 0.15)) * (1 + 0.15 * Math.sin(TAU * wob * t));
  const bp = D.filter(x, 'bp', cf, { q });
  const body = D.lp(D.lp(x, f * 1.3, 0.8), f * 1.3, 0.8);
  let y = D.map(bp, (v, i) => Math.tanh((v * 2 + body[i] * 0.7) * drive));
  y = D.filter(D.hp(y, 150), 'peak', 2500, { q: 0.9, gain: 4 });
  y = D.lp(y, 9000, 0.7);
  const e = S.adsr(gate, { a: 0.003, d: 0.05, s: 0.9, r: 0.05 });
  return D.map(y, (v, i) => v * e(i / SR) * vel * 0.7);
}

/* lead raw */
export function rawLead(f, gate, vel = 1, { seed = 7, center = 1400 } = {}) {
  const x = D.mix([S.supersaw(f, gate, 1, { n: 7, spread: 30, cutoff: 12000, env: { a: 0.002, d: 0.05, s: 1, r: 0.05 }, seed }), 1],
    [D.osc(gate + 0.06, f / 2, { shape: 'square', phase: 0.25 }), 0.45], [D.osc(gate + 0.06, f * 2, { shape: 'saw', phase: 0.6 }), 0.15]);
  let y = D.map(x, (v) => Math.tanh(v * 5));
  y = D.eq(y, center, 6, 0.8); y = D.eq(y, 400, -4, 1);
  y = D.map(y, (v) => { const a = v * 3; return a / Math.pow(1 + Math.pow(Math.abs(a), 6), 1 / 6); });
  y = D.lp(D.hp(y, 160), 8500, 0.7);
  const e = S.adsr(gate, { a: 0.002, d: 0.05, s: 0.9, r: 0.05 });
  return D.map(y, (v, i) => v * e(i / SR) * vel * 0.6);
}

/* piano de rave */
export function ravePiano(f, gate, vel = 1, { decay = 0.9, seed = 9, bright = 1, rel = 0.14 } = {}) {
  const r = D.rng(seed), B = 0.00035, L = Math.min(gate + rel + 0.01, decay * 2.2), parts = [];
  for (const det of [-2.5, 2.5]) for (let k = 1; k <= 18 && f * k < 15000; k++) {
    const fk = f * Math.pow(2, det / 1200) * k * Math.sqrt(1 + B * k * k);
    const a = Math.pow(k, -0.9) * Math.pow(vel, 0.25 + k * 0.04) * (k > 6 ? bright : 1);
    const tk = decay / (1 + 0.28 * (k - 1));
    parts.push([D.osc(L, fk, { shape: 'sine', amp: (t) => Math.exp(-t / tk) * (1 - 0.6 * Math.exp(-t / 0.002)), phase: r() }), a * 0.5]);
  }
  let y = D.mix(...parts);
  const hammer = D.env(D.bp(D.noise(0.03, seed + 1), 3200, 0.7), D.expEnv(0.005));
  y = D.mix([y, 1], [hammer, 0.25 * vel]);
  y = D.eq(y, 500, -4, 0.9); y = D.eq(y, 2500, 5, 0.8);
  y = D.map(y, (v) => Math.tanh(v * 1.2) / Math.tanh(1.2));
  const e = (t) => Math.min(1, t / 0.0012) * (t < gate ? 1 : Math.max(0, Math.cos(Math.min(1, (t - gate) / rel) * Math.PI / 2)));
  return D.map(y, (v, i) => v * e(i / SR) * vel * 0.55);
}

/* bajo que cae a la nota */
export function glideBass(f, gate, vel = 1, { from = 1, tau = 0.04, drive = 6 } = {}) {
  const L = gate + 0.03, fr = (t) => f * Math.pow(2, (from * Math.exp(-t / tau)) / 12);
  let x = D.mix([D.osc(L, fr, { shape: 'saw' }), 0.6], [D.osc(L, fr, { shape: 'square', phase: 0.1 }), 0.5]);
  x = D.map(D.lp(x, 2600, 1.1), (v) => Math.tanh(v * drive));
  x = D.eq(x, 300, -5, 1); x = D.eq(x, 1200, 3, 1);
  const e = S.adsr(gate, { a: 0.002, d: 0.05, s: 0.9, r: 0.02 });
  return D.map(x, (v, i) => v * e(i / SR) * vel * 0.7);
}

/* notas a tempo con una voz estéreo (como S.play, pero { L, R }) */
export function playSt(notes, { bpm, steps, voice, cycles = 1, tail = 1.5 }) {
  const sd = S.stepDur(bpm), n = D.secs(cycles * steps * sd + tail), L = new Float64Array(n), R = new Float64Array(n);
  for (let c = 0; c < cycles; c++) for (const nt of notes) {
    const [s, l, p, v = 1, o = {}] = nt, at = Math.round((c * steps + s) * sd * SR);
    for (const h of Array.isArray(p) ? p : [p]) {
      const y = voice(S.freq(h), l * sd, v, o);
      for (let i = 0; i < y.L.length && at + i < n; i++) { L[at + i] += y.L[i]; R[at + i] += y.R[i]; }
    }
  }
  return D.stereo(L, R);
}

/* grito oscuro: voz de bajo sintética (formantes de «a» a «o») que cae de tono, con un gruñido (modulación a ~45 Hz)
   y ruido áspero, distorsionada y con los agudos cortados: el peso en 700 Hz–1,6 kHz, como los gritos distorsionados
   del hardcore (se midió una voz de referencia: el 75 % de la energía entre 400 Hz y 1,6 kHz y casi nada por encima) */
export function darkScream(dur, { f0 = 150, to = 98, seed = 11, vowels = [[0, 'a'], [0.3, 'o']], growl = 0.55, rasp = 0.35, drive = 5 } = {}) {
  let s = V.singer(dur * 1.6, f0, { reg: 'bass', vowel: vowels, glide: 0.14, seed, vibDepth: 0.012, breath: 0.12 });
  s = D.varispeed(s, (t) => 1 - (1 - to / f0) * Math.pow(Math.min(1, t / dur), 0.7), dur);
  const nz = D.filter(D.noise(dur, seed + 3, 'pink'), 'bp', 1000, { q: 0.9 });
  let x = D.mix([s, 1], [nz, rasp * 0.4]);
  x = D.map(x, (v, i) => v * (1 + growl * Math.sin(TAU * 45 * i / SR)));
  x = D.tube(D.gain(x, 3), drive, 0.12);
  x = D.map(x, (v) => { const a = v * 2.4; return a / Math.pow(1 + Math.pow(Math.abs(a), 5), 0.2); });
  x = D.hp(x, 170); x = D.eq(x, 1000, 8, 0.7); x = D.eq(x, 300, -6, 0.9);
  x = D.lp(D.lp(x, 2400, 0.7), 2800, 0.7);
  return D.env(x, D.ahd(0.03, dur * 0.6, dur * 0.18));
}
