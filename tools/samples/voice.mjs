/* HARMONY · herramientas de voz para los packs de samples
   - tomas de eSpeak NG (tools/samples/voices/src): lectura, cambio de frecuencia de muestreo y recorte de silencios
   - vocoder de bandas
   - síntesis de coros por formantes (fuente glotal + filtros de formante), sin tomas de nadie */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './dsp.mjs';
const { SR } = D;
const TAU = Math.PI * 2;
const SRC = join(dirname(fileURLToPath(import.meta.url)), 'voices', 'src');

/* cambio de frecuencia de muestreo con sinc enventanado (Blackman, 2×16 puntos), corte por debajo del Nyquist menor */
export function resample(x, from, to) {
  if (from === to) return Float64Array.from(x);
  const K = 16, r = from / to, fc = Math.min(1, to / from) * 0.94, n = Math.floor(x.length / r), o = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * r, c = Math.floor(t);
    let v = 0;
    for (let k = c - K + 1; k <= c + K; k++) {
      if (k < 0 || k >= x.length) continue;
      const d = t - k, a = Math.PI * d * fc, s = d === 0 ? 1 : Math.sin(a) / a;
      const w = 0.42 + 0.5 * Math.cos(Math.PI * d / K) + 0.08 * Math.cos(TAU * d / K);
      v += x[k] * s * w * fc;
    }
    o[i] = v;
  }
  return o;
}

/* quita el silencio de delante y de detrás (umbral relativo al pico), dejando un margen */
export function trimSilence(x, { lead = -42, tail = -54, keepLead = 0.004, keepTail = 0.03 } = {}) {
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  if (!m) return x;
  const a = m * D.dB(lead), b = m * D.dB(tail);
  let s = 0; while (s < x.length && Math.abs(x[s]) < a) s++;
  let e = x.length - 1; while (e > s && Math.abs(x[e]) < b) e--;
  return x.slice(Math.max(0, s - D.secs(keepLead)), Math.min(x.length, e + D.secs(keepTail)));
}

/* una toma de eSpeak, a 44,1 kHz, sin silencios y normalizada a pico 0,9.
   rate < 1: más lenta y grave, con los formantes más bajos (voz más grande); > 1: más rápida y aguda */
const cache = new Map();
export function take(id, { rate = 1 } = {}) {
  const k = id + '@' + rate;
  if (!cache.has(k)) {
    const w = D.readWav(readFileSync(join(SRC, id + '.wav')));
    let x = resample(w.chans[0], w.rate, SR);
    if (rate !== 1) x = resample(x, SR * rate, SR);
    x = trimSilence(D.dcBlock(x));
    cache.set(k, D.normalize(x, -1));
  }
  return Float64Array.from(cache.get(k));
}

/* seguidor de envolvente (rectificado y un polo con ataque y caída distintos) */
export function follow(x, att = 0.003, rel = 0.03) {
  const o = new Float64Array(x.length), a = Math.exp(-1 / (att * SR)), r = Math.exp(-1 / (rel * SR));
  let e = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]), c = v > e ? a : r; e = c * e + (1 - c) * v; o[i] = e; }
  return o;
}

/* vocoder: la envolvente de cada banda de la voz modula la misma banda del portador; las sibilantes de la voz
   (por encima de `sib` Hz) pasan tal cual, para que se entiendan las consonantes */
export function vocoder(mod, carrier, { bands = 24, lo = 110, hi = 8000, q = 6, att = 0.002, rel = 0.025, sib = 5500, sibGain = 0.5 } = {}) {
  const n = Math.min(mod.length, carrier.length), out = new Float64Array(n);
  const m = mod.slice(0, n), c = carrier.slice(0, n);
  for (let b = 0; b < bands; b++) {
    const f = lo * Math.pow(hi / lo, b / (bands - 1));
    const mb = D.bp(D.bp(m, f, q), f, q), cb = D.bp(D.bp(c, f, q), f, q), e = follow(mb, att, rel);
    for (let i = 0; i < n; i++) out[i] += cb[i] * e[i];
  }
  const s = D.hp(D.hp(m, sib, 0.7), sib, 0.7);
  let pm = 0, ps = 0; for (let i = 0; i < n; i++) { pm = Math.max(pm, Math.abs(out[i])); ps = Math.max(ps, Math.abs(s[i])); }
  const g = pm ? 1 / pm : 1;
  for (let i = 0; i < n; i++) out[i] = out[i] * g + (ps ? s[i] / ps : 0) * sibGain;
  return out;
}

/* ---------- coros por formantes ----------
   Frecuencias (Hz), niveles (dB) y anchos de banda (Hz) de los cinco primeros formantes de cada vocal cantada,
   valores de referencia habituales en síntesis de voz por formantes. */
export const VOWELS = {
  soprano: {
    a: [[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
    e: [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
    i: [[270, 2140, 2950, 3900, 4950], [0, -12, -26, -26, -44], [60, 90, 100, 120, 120]],
    o: [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]]
  },
  alto: {
    a: [[800, 1150, 2800, 3500, 4950], [0, -4, -20, -36, -60], [80, 90, 120, 130, 140]],
    e: [[400, 1600, 2700, 3300, 4950], [0, -24, -30, -35, -60], [60, 80, 120, 150, 200]],
    i: [[350, 1700, 2700, 3700, 4950], [0, -20, -30, -36, -60], [50, 100, 120, 150, 200]],
    o: [[450, 800, 2830, 3500, 4950], [0, -9, -16, -28, -55], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2530, 3500, 4950], [0, -12, -30, -40, -64], [50, 60, 170, 180, 200]]
  },
  tenor: {
    a: [[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
    e: [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
    i: [[290, 1870, 2800, 3250, 3540], [0, -15, -18, -20, -30], [40, 90, 100, 120, 120]],
    o: [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]]
  },
  bass: {
    a: [[600, 1040, 2250, 2450, 2750], [0, -7, -9, -9, -20], [60, 70, 110, 120, 130]],
    e: [[400, 1620, 2400, 2800, 3100], [0, -12, -9, -12, -18], [40, 80, 100, 120, 120]],
    i: [[250, 1750, 2600, 3050, 3340], [0, -30, -16, -22, -28], [60, 90, 100, 120, 120]],
    o: [[400, 750, 2400, 2600, 2900], [0, -11, -21, -20, -40], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2400, 2675, 2950], [0, -20, -32, -28, -36], [40, 80, 100, 120, 120]]
  }
};
/* vocal en el instante t: `vowel` es 'a' o una lista de [segundo, vocal] (pasa de una a otra en `glide` s) */
function vowelAt(reg, vowel, glide) {
  const T = VOWELS[reg];
  if (typeof vowel === 'string') return () => T[vowel];
  const pts = vowel.map(([t, v]) => [t, T[v]]);
  return (t) => {
    let k = 0; while (k + 1 < pts.length && t >= pts[k + 1][0]) k++;
    const [t0, a] = pts[k];
    if (k === 0 && t < t0) return a;
    const prev = k > 0 ? pts[k - 1][1] : a, u = k > 0 ? D.clamp((t - t0) / glide, 0, 1) : 1, s = u * u * (3 - 2 * u);
    return a.map((row, r) => row.map((v, c) => prev[r][c] + (v - prev[r][c]) * s));
  };
}
/* fuente glotal: armónicos con caída de unos −7,5 dB por octava, vibrato con retardo,
   pequeñas variaciones de tono (jitter) y un poco de aire */
function glottal(dur, f0, { seed = 1, vib = 5.4, vibDepth = 0.005, vibDelay = 0.25, drift = 0.002, breath = 0.04 } = {}) {
  const r = D.rng(seed), ph = r() * TAU, vphase = r() * TAU, rate = vib * (0.92 + 0.16 * r());
  const wander = D.lp(D.noise(dur, seed * 7 + 3), 4, 0.7), wn = wander.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  const f = (t) => {
    const i = Math.min(wander.length - 1, Math.round(t * SR));
    return f0 * (1 + vibDepth * Math.min(1, t / vibDelay) * Math.sin(TAU * rate * t + vphase) + drift * wander[i] / wn);
  };
  // aditiva: armónicos hasta `top` Hz con amplitud 1/n^1,25 (sin aliasing, aunque el tono se mueva);
  // sen(nθ) por recurrencia de Chebyshev, con una sola llamada a sen/cos por muestra
  const n = D.secs(dur), x = new Float64Array(n), top = 11000;
  const amp = Float64Array.from({ length: Math.ceil(top / (f0 * 0.9)) + 2 }, (_, k) => (k ? Math.pow(k, -1.25) : 0));
  let p = ph / TAU;
  for (let i = 0; i < n; i++) {
    const fr = f(i / SR), N = Math.max(1, Math.floor(top / fr)), th = TAU * p, c2 = 2 * Math.cos(th);
    let s0 = 0, s1 = Math.sin(th), v = 0;
    for (let k = 1; k <= N; k++) {
      // el último 20 % de los armónicos se desvanece para que no aparezcan de golpe al bajar el tono
      const fadeTop = Math.min(1, (N + 1 - k) / Math.max(1, N * 0.2));
      v += s1 * (amp[k] || Math.pow(k, -1.25)) * fadeTop;
      const s2 = c2 * s1 - s0; s0 = s1; s1 = s2;
    }
    x[i] = v * 0.7;
    p += fr / SR; p -= Math.floor(p);
  }
  const air = D.hp(D.noise(dur, seed * 13 + 1), 1800, 0.7);
  return D.mix([x, 1], [air, breath]);
}
/* una voz cantando `f0` (Hz) con la vocal dada */
export function singer(dur, f0, { reg = 'soprano', vowel = 'a', glide = 0.08, seed = 1, ...src } = {}) {
  const at = vowelAt(reg, vowel, glide), g = glottal(dur, f0, { seed, ...src });
  const out = new Float64Array(g.length);
  for (let k = 0; k < 5; k++) {
    const F = (t) => at(t)[0][k], A = D.dB(at(0)[1][k]), Q = (t) => at(t)[0][k] / at(t)[2][k];
    const b = D.filter(g, 'bp', F, { q: Q });
    // el nivel del formante también cambia con la vocal (se calcula cada 64 muestras)
    if (typeof vowel === 'string') { for (let i = 0; i < g.length; i++) out[i] += b[i] * A; continue; }
    for (let i0 = 0; i0 < g.length; i0 += 64) { const l = D.dB(at(i0 / SR)[1][k]); for (let i = i0; i < Math.min(g.length, i0 + 64); i++) out[i] += b[i] * l; }
  }
  return out;
}
/* coro: varias voces por nota, cada una con su desafinación, su vibrato y su posición en el estéreo */
export function choir(dur, notes, { voices = 3, detune = 9, reg = 'soprano', vowel = 'a', glide, seed = 11, amp = (t) => 1, spread = 0.8, ...src } = {}) {
  const L = new Float64Array(D.secs(dur)), R = new Float64Array(D.secs(dur)), r = D.rng(seed);
  let k = 0;
  for (const nt of notes) for (let v = 0; v < voices; v++, k++) {
    const cents = (v - (voices - 1) / 2) * detune + (r() - 0.5) * detune * 0.6;
    const delay = r() * 0.03;
    const s = D.env(singer(dur, nt * Math.pow(2, cents / 1200), { reg, vowel, glide, seed: seed * 31 + k * 17, ...src }), (t) => amp(Math.max(0, t - delay)));
    const pan = D.clamp(0.5 + (r() - 0.5) * spread, 0, 1), gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2);
    const off = D.secs(delay);
    for (let i = 0; i + off < L.length; i++) { L[i + off] += s[i] * gl; R[i + off] += s[i] * gr; }
  }
  return D.stereo(L, R);
}
