/* HARMONY · instrumentos y notas a tempo para los packs de samples
   Instrumentos (una nota → Float64Array mono, con su caída): supersierra, pluck, hoover, screech, lead raw, órgano,
   piano, campana FM, sub, bajo inverso, chiptune. Y un renderizador de notas a tempo:
     notas: [paso, pasos que dura, altura (‘F4’, ‘Bb3’ o una lista para acordes), intensidad 0…1, opciones]
   Los bucles se tocan dos veces y se queda la segunda vuelta: las colas (caídas, reverb, ecos) del final de la
   vuelta caen sobre su principio, así el bucle empalma consigo mismo sin hueco. */
import * as D from './dsp.mjs';
const { SR } = D;
const TAU = Math.PI * 2;

/* ---------- alturas ---------- */
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(n);
  if (!m || PC[m[1]] == null) throw new Error('nota no válida: ' + n);
  return 12 * (+m[2] + 1) + PC[m[1]];
}
export const freq = (n) => D.hz(midi(n));
export const stepDur = (bpm) => 60 / bpm / 4;
export const loopLen = (bpm, bars) => Math.round(bars * 16 * stepDur(bpm) * SR);

/* suma `b` en `out` desde la muestra `at` */
function addAt(out, b, at, g = 1) { for (let i = 0; i < b.length && at + i < out.length; i++) if (at + i >= 0) out[at + i] += b[i] * g; }
/* envolvente ADSR con la puerta en `gate` s y caída de `rel` s; termina en 0 exacto */
export function adsr(gate, { a = 0.004, d = 0.08, s = 0.8, r = 0.08 } = {}) {
  const lvlAt = (t) => (t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s);
  const g = Math.max(gate, a), endLvl = lvlAt(g);
  return (t) => (t < g ? lvlAt(t) : t < g + r ? endLvl * Math.cos(((t - g) / r) * Math.PI / 2) ** 2 : 0);
}
const len = (gate, rel) => gate + rel + 0.002;

/* ---------- instrumentos ---------- */
/* Supersierra: n sierras desafinadas (en céntimos alrededor de la nota), fases con semilla, paso bajo */
export function supersaw(f, gate, vel = 1, { n = 7, spread = 22, cutoff = 7000, q = 0.7, env = {}, seed = 1, sub = 0, drive = 0 } = {}) {
  const e = adsr(gate, { a: 0.006, d: 0.15, s: 0.85, r: 0.12, ...env }), L = len(gate, env.r != null ? env.r : 0.12), r = D.rng(seed);
  const parts = [];
  for (let k = 0; k < n; k++) {
    const c = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * spread + (r() - 0.5) * spread * 0.2;
    parts.push([D.osc(L, f * Math.pow(2, c / 1200), { shape: 'saw', phase: r() }), 1 / Math.sqrt(n)]);
  }
  if (sub) parts.push([D.osc(L, f / 2, { shape: 'sine' }), sub]);
  let x = mixRaw(parts);
  x = D.filter(x, 'lp', typeof cutoff === 'function' ? cutoff : cutoff, { q });
  if (drive) x = D.map(x, (v) => Math.tanh(v * drive) / Math.tanh(drive));
  return D.map(x, (v, i) => v * e(i / SR) * vel);
}
function mixRaw(parts) {
  let n = 0; for (const [b] of parts) n = Math.max(n, b.length);
  const o = new Float64Array(n);
  for (const [b, g] of parts) for (let i = 0; i < b.length; i++) o[i] += b[i] * g;
  return o;
}
/* Pluck: sierra y cuadrada con un paso bajo que se cierra rápido */
export function pluck(f, gate, vel = 1, { decay = 0.22, bright = 7000, low = 500, q = 2, seed = 2 } = {}) {
  const L = len(gate, 0.1) + decay * 1.5, r = D.rng(seed);
  const x = mixRaw([[D.osc(L, f * 1.004, { shape: 'saw', phase: r() }), 0.5], [D.osc(L, f * 0.996, { shape: 'saw', phase: r() }), 0.5], [D.osc(L, f, { shape: 'pulse', pw: 0.3, phase: r() }), 0.35]]);
  const y = D.filter(x, 'lp', (t) => low + (bright * (0.5 + 0.5 * vel) - low) * Math.exp(-t / (decay * 0.5)), { q });
  const e = (t) => Math.exp(-t / decay) * (t < gate ? 1 : Math.max(0, 1 - (t - gate) / 0.06)) * Math.min(1, t / 0.002);
  return D.map(y, (v, i) => v * e(i / SR) * vel);
}
/* Hoover: pulsos con ancho modulado y sierras desafinadas, con la caída de tono del principio */
export function hoover(f, gate, vel = 1, { bend = 3, bendTau = 0.03, cutoff = 3400, seed = 3 } = {}) {
  const L = len(gate, 0.1), r = D.rng(seed), ph = r();
  const fb = (m) => (t) => f * m * Math.pow(2, (bend * Math.exp(-t / bendTau)) / 12);
  const pwm = (t) => 0.5 + 0.35 * Math.sin(TAU * 5.5 * t + ph * TAU);
  const x = mixRaw([
    [D.osc(L, fb(1.006), { shape: 'pulse', pw: pwm, phase: ph }), 0.45],
    [D.osc(L, fb(0.993), { shape: 'saw', phase: r() }), 0.35],
    [D.osc(L, fb(0.5), { shape: 'pulse', pw: (t) => 1 - pwm(t), phase: r() }), 0.4]]);
  const e = adsr(gate, { a: 0.004, d: 0.2, s: 0.7, r: 0.1 });
  return D.map(D.lp(x, cutoff, 0.9), (v, i) => Math.tanh(v * 1.6 * e(i / SR)) * vel);
}
/* Screech (uptempo): sierra por un paso banda resonante que barre hacia abajo, muy saturada */
export function screech(f, gate, vel = 1, { from = 5, to = 2.2, q = 7, drive = 3, bodyGain = 0.9 } = {}) {
  const L = len(gate, 0.05);
  const x = mixRaw([[D.osc(L, f, { shape: 'saw' }), 0.6], [D.osc(L, f * 1.01, { shape: 'saw', phase: 0.3 }), 0.6]]);
  const y = D.filter(x, 'bp', (t) => f * (to + (from - to) * Math.exp(-t / 0.09)), { q });
  // cuerpo en la fundamental: sin él, el paso banda deja al tercer armónico mandando y la nota se oye una quinta arriba
  const body = D.lp(D.lp(x, f * 1.3, 0.8), f * 1.3, 0.8);
  const e = adsr(gate, { a: 0.003, d: 0.05, s: 0.9, r: 0.05 });
  return D.map(y, (v, i) => Math.tanh((v + body[i] * bodyGain) * drive * 3) * e(i / SR) * vel * 0.8);
}
/* Lead raw: cuadrada y sierra muy saturadas, con un paso banda ancho */
export function rawLead(f, gate, vel = 1, { drive = 6, center = 1400 } = {}) {
  const L = len(gate, 0.05);
  const x = mixRaw([[D.osc(L, f, { shape: 'square' }), 0.5], [D.osc(L, f * 2.005, { shape: 'saw', phase: 0.2 }), 0.3], [D.osc(L, f * 0.5, { shape: 'saw', phase: 0.6 }), 0.4]]);
  let y = D.map(x, (v) => Math.tanh(v * drive));
  y = D.filter(D.hp(y, 180), 'peak', center, { q: 0.8, gain: 4 });
  y = D.lp(y, 7000, 0.7);
  const e = adsr(gate, { a: 0.002, d: 0.06, s: 0.85, r: 0.05 });
  return D.map(y, (v, i) => v * e(i / SR) * vel * 0.6);
}
/* Órgano de rave: armónicos 1, 2, 3, 4, 6 y 8 con caída corta y clic de tecla */
export function organ(f, gate, vel = 1, { decay = 0.45, bars = [1, 0.8, 0.55, 0.45, 0.25, 0.18] } = {}) {
  const mult = [1, 2, 3, 4, 6, 8], L = len(gate, 0.08);
  const x = mixRaw(mult.map((m, k) => [D.osc(L, f * m, { shape: 'sine', phase: k * 0.13 }), bars[k] * (f * m < 12000 ? 1 : 0)]));
  const click = D.env(D.bp(D.noise(0.01, Math.round(f)), 2500, 1), D.expEnv(0.002));
  const e = (t) => Math.min(1, t / 0.002) * (0.35 + 0.65 * Math.exp(-t / decay)) * (t < gate ? 1 : Math.max(0, Math.cos(((t - gate) / 0.08) * Math.PI / 2)));
  const y = D.map(x, (v, i) => v * e(i / SR));
  addAt(y, click, 0, 0.3);
  return D.map(y, (v) => Math.tanh(v * 0.8) * vel);
}
/* Piano sencillo: parciales algo inarmónicos, cada uno con su caída, y el golpe del martillo */
export function piano(f, gate, vel = 1, { decay = 1.4, seed = 5 } = {}) {
  const B = 0.0004, L = len(gate, 0.25), parts = [];
  for (let k = 1; k <= 12 && f * k < 14000; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k), a = (1 / k) * (k === 1 ? 1 : 0.9) * Math.pow(vel, 0.3 + k * 0.05);
    const tk = decay / (1 + 0.35 * (k - 1));
    parts.push([D.osc(L, fk, { shape: 'sine', amp: (t) => Math.exp(-t / tk), phase: (k * 0.17) % 1 }), a]);
  }
  const y = mixRaw(parts);
  addAt(y, D.env(D.bp(D.noise(0.02, seed), 3000, 0.8), D.expEnv(0.004)), 0, 0.15 * vel);
  const e = (t) => Math.min(1, t / 0.0015) * (t < gate ? 1 : Math.max(0, Math.cos(((t - gate) / 0.25) * Math.PI / 2)));
  return D.map(y, (v, i) => v * e(i / SR) * vel * 0.5);
}
/* Campana FM: portadora y moduladora a 3,5×, con un índice que se apaga antes que el sonido */
export function bell(f, gate, vel = 1, { ratio = 3.5, index = 4, decay = 1.6 } = {}) {
  const L = Math.max(gate, decay * 2.2), n = D.secs(L), o = new Float64Array(n);
  let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, I = index * Math.exp(-t / (decay * 0.35));
    o[i] = Math.sin(TAU * pc + I * Math.sin(TAU * pm)) * Math.exp(-t / decay) * Math.min(1, t / 0.001);
    pc += f / SR; pm += (f * ratio) / SR; pc -= Math.floor(pc); pm -= Math.floor(pm);
  }
  return D.fadeEnd(D.map(o, (v) => v * vel * 0.7), 0.05);
}
/* Sub: seno con un poco de saturación (para que se oiga en altavoces pequeños) */
export function sub(f, gate, vel = 1, { drive = 1.4 } = {}) {
  const L = len(gate, 0.06), e = adsr(gate, { a: 0.004, d: 0.1, s: 0.9, r: 0.06 });
  return D.map(D.osc(L, f), (v, i) => Math.tanh(v * drive) / Math.tanh(drive) * e(i / SR) * vel);
}
/* Bajo inverso (hardstyle): un golpe grave que cae de tono, saturado, al revés: crece hasta el siguiente kick */
export function reverseBass(f, gate, vel = 1, { drive = 3 } = {}) {
  const L = gate;
  let x = D.osc(L, (t) => f * (1 + 0.6 * Math.exp(-t / 0.02)), { amp: (t) => Math.exp(-t / (L * 0.5)) });
  x = D.map(x, (v) => Math.tanh(v * drive) / Math.tanh(drive));
  x = D.lp(x, 1800, 0.8);
  const y = D.reverse(x);
  // entra con 4 ms de fundido y se corta con 8 ms al final (más corto, chasquea si suena solo)
  return D.map(y, (v, i) => v * Math.min(1, i / (SR * 0.004)) * Math.sin(Math.min(1, (y.length - 1 - i) / (SR * 0.008)) * Math.PI / 2) * vel);
}
/* Chiptune: pulso de ancho fijo (12,5 · 25 · 50 %), triángulo o ruido de registro (LFSR), sin filtrar */
export function chip(f, gate, vel = 1, { shape = 'pulse', pw = 0.25, r = 0.02, sweep = null, vib = 0 } = {}) {
  const L = len(gate, r), F = (t) => (sweep ? sweep(t) : f) * (1 + vib * Math.sin(TAU * 6 * t) * Math.min(1, t / 0.08));
  let x;
  if (shape === 'noise') {
    // ruido de 15 bits como en las consolas de 8 bits: el tono decide cada cuánto avanza el registro
    const n = D.secs(L); x = new Float64Array(n);
    let reg = 1, acc = 0, v = 1;
    for (let i = 0; i < n; i++) { acc += F(i / SR) / SR; while (acc >= 1) { acc -= 1; const b = (reg ^ (reg >> 1)) & 1; reg = (reg >> 1) | (b << 14); v = reg & 1 ? 1 : -1; } x[i] = v; }
  } else x = D.osc(L, F, { shape: shape === 'tri' ? 'tri' : 'pulse', pw });
  const e = (t) => Math.min(1, t / 0.001) * (t < gate ? 1 : Math.max(0, 1 - (t - gate) / r));
  return D.map(x, (v, i) => v * e(i / SR) * vel * 0.5);
}

/* ---------- notas a tempo ---------- */
/* Toca una lista de notas con un instrumento. voice(f, gate, vel, opciones, nota) → muestras.
   cycles: vueltas seguidas (2 para bucles). Devuelve el buffer con espacio para las colas. */
export function play(notes, { bpm, steps, voice, cycles = 1, tail = 1.5, gateScale = 1 }) {
  const sd = stepDur(bpm), n = D.secs(cycles * steps * sd + tail), out = new Float64Array(n);
  for (let c = 0; c < cycles; c++) for (const nt of notes) {
    const [s, l, p, v = 1, o = {}] = nt;
    const at = Math.round((c * steps + s) * sd * SR), gate = l * sd * gateScale;
    for (const h of Array.isArray(p) ? p : [p]) addAt(out, voice(freq(h), gate, v, o, nt), at);
  }
  return out;
}
/* La segunda vuelta de algo tocado dos veces: un bucle que empalma consigo mismo */
export function loopCut(x, bpm, bars) {
  const L = loopLen(bpm, bars), cut = (c) => { const y = c.slice(L, 2 * L); const o = new Float64Array(L); o.set(y); return o; };
  return x.L ? D.stereo(cut(x.L), cut(x.R)) : cut(x);
}
/* Acid: una sola voz (sierra o cuadrada) con paso bajo resonante; acento sube el filtro y el volumen,
   ligado (slide) desliza el tono desde la nota anterior y no vuelve a disparar el filtro */
export function acidLine(notes, { bpm, steps, cycles = 2, shape = 'saw', cutoff = 380, envMod = 2600, q = 9, decay = 0.11 }) {
  const sd = stepDur(bpm), n = D.secs(cycles * steps * sd + 0.3), f = new Float64Array(n), g = new Float64Array(n), cf = new Float64Array(n);
  const ev = [];
  for (let c = 0; c < cycles; c++) for (const [s, l, p, v = 1, o = {}] of notes) ev.push({ t: (c * steps + s) * sd, d: l * sd, f: freq(p), acc: v > 0.9, slide: !!o.slide });
  ev.sort((a, b) => a.t - b.t);
  let prevF = ev.length ? ev[0].f : 110;
  ev.forEach((e, k) => {
    const a = Math.round(e.t * SR), b = Math.min(n, Math.round((e.t + e.d * (e.slide || (ev[k + 1] && ev[k + 1].slide) ? 1.02 : 0.8)) * SR));
    const from = e.slide ? prevF : e.f, glide = 0.045;
    for (let i = a; i < b; i++) {
      const t = (i - a) / SR, envT = e.slide && k > 0 ? t + 0.05 : t;
      f[i] = e.slide ? e.f + (from - e.f) * Math.exp(-t / (glide / 3)) : e.f;
      g[i] = e.acc ? 1 : 0.72;
      cf[i] = cutoff + envMod * (e.acc ? 1.5 : 1) * Math.exp(-envT / (e.acc ? decay * 0.7 : decay));
    }
    prevF = e.f;
  });
  // oscilador continuo (sin chasquidos entre notas ligadas) y puerta suavizada
  let ph = 0, gs = 0;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const fr = f[i] || prevF, dt = fr / SR;
    let v;
    if (shape === 'square') v = ph < 0.5 ? 1 : -1; else v = 2 * ph - 1;
    // polyBLEP sencillo para la sierra
    if (shape !== 'square') { if (ph < dt) { const x = ph / dt; v -= x + x - x * x - 1; } else if (ph > 1 - dt) { const x = (ph - 1) / dt; v -= x * x + x + x + 1; } }
    ph += dt; ph -= Math.floor(ph);
    gs += (g[i] - gs) * (g[i] > gs ? 0.02 : 0.004);
    raw[i] = v * gs;
  }
  const y = D.filter(raw, 'lp', (t) => cf[Math.min(n - 1, Math.round(t * SR))] || cutoff, { q });
  return D.map(y, (v) => Math.tanh(v * 1.8));
}

/* ---------- efectos para bucles ---------- */
/* «sidechain»: baja el volumen en cada tiempo y lo recupera, como si el kick lo empujara */
export function pump(x, bpm, { depth = 0.75, rel = 0.16, curve = 2 } = {}) {
  const beat = 60 / bpm;
  return D.map(x, (v, i) => { const t = (i / SR) % beat; return v * (1 - depth * Math.pow(Math.max(0, 1 - t / rel), curve)); });
}
/* puerta rítmica en semicorcheas: patrón de 16 (x = abierta) */
export function gate16(x, bpm, pattern = 'x.xxx.x.xx.xx.x.', { duty = 0.7 } = {}) {
  const sd = stepDur(bpm), P = pattern.replace(/\s/g, '');
  return D.map(x, (v, i) => {
    const t = i / SR, k = Math.floor(t / sd), ph = (t - k * sd) / sd;
    if (P[k % P.length] !== 'x') return 0;
    const a = Math.sin(Math.min(1, ph / 0.07) * Math.PI / 2), r = ph > duty ? Math.max(0, 1 - (ph - duty) / 0.1) : 1;
    return v * a * r;
  });
}
/* eco ping-pong a tempo (en estéreo, solo la parte húmeda) */
export function pingpong(x, bpm, { div = 0.75, n = 4, fb = 0.45, gain = 0.35, lp = 4000 } = {}) {
  const d = (60 / bpm) * div, L = new Float64Array(x.length + D.secs(d * n + 0.05)), R = new Float64Array(L.length);
  let y = x;
  for (let k = 1; k <= n; k++) { y = D.lp(y, lp, 0.6); addAt(k % 2 ? L : R, y, Math.round(d * k * SR), gain * Math.pow(fb, k - 1)); }
  return D.stereo(L, R);
}
