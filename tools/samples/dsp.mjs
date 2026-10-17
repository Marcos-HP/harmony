/* HARMONY · síntesis de audio sin dependencias (Node 18+)
   Las piezas con las que se fabrican los samples originales de Harmony: osciladores sin aliasing (polyBLEP),
   ruido con semilla (todo es reproducible: misma receta → mismos bytes), filtros biquad que se pueden barrer,
   saturación, compresión, reverb, utilidades de mezcla, un escritor de WAV con dither y análisis para validar. */

export const SR = 44100;
const TAU = Math.PI * 2;

/* ---------- utilidades ---------- */
export const secs = (s) => Math.max(1, Math.round(s * SR));
export const buf = (s) => new Float64Array(secs(s));
export const hz = (note) => 440 * Math.pow(2, (note - 69) / 12);          // nota MIDI → Hz
export const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export const note = (name, oct) => hz(12 * (oct + 1) + NOTE[name]);       // note('F', 1) = 43,65 Hz
export const dB = (d) => Math.pow(10, d / 20);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* f puede ser número o función del tiempo (s) */
const fnOf = (f) => (typeof f === 'function' ? f : () => f);

/* ---------- envolventes ---------- */
/* exponencial: 1 → 0 con constante de tiempo tau (s) */
export const expEnv = (tau) => (t) => Math.exp(-t / tau);
/* ataque lineal, meseta y caída exponencial */
export const ahd = (a, h, tau) => (t) => (t < a ? t / a : t < a + h ? 1 : Math.exp(-(t - a - h) / tau));
/* rampa entre dos valores con curva (1 = lineal, >1 lenta al principio) */
export const ramp = (v0, v1, dur, curve = 1) => (t) => v0 + (v1 - v0) * Math.pow(clamp(t / dur, 0, 1), curve);
/* barrido exponencial de frecuencia: f0 → f1 con constante tau */
export const sweep = (f0, f1, tau) => (t) => f1 + (f0 - f1) * Math.exp(-t / tau);

/* ---------- osciladores ---------- */
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
/* shape: sine · saw · square · tri · pulse (pw) — freq en Hz o función del tiempo */
export function osc(dur, freq, { shape = 'sine', phase = 0, pw = 0.5, amp = 1 } = {}) {
  const n = secs(dur), out = new Float64Array(n), f = fnOf(freq), A = fnOf(amp), PW = fnOf(pw);
  let ph = phase, tri = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, fr = f(t), dt = Math.min(0.5, Math.abs(fr) / SR);
    let v;
    if (shape === 'sine') v = Math.sin(TAU * ph);
    else if (shape === 'saw') v = 2 * ph - 1 - polyblep(ph, dt);
    else {
      const w = shape === 'pulse' ? clamp(PW(t), 0.05, 0.95) : 0.5;
      v = (ph < w ? 1 : -1) + polyblep(ph, dt) - polyblep((ph - w + 1) % 1, dt);
      if (shape === 'tri') { tri = dt * 4 * v + (1 - dt * 4) * tri; v = tri; }
    }
    out[i] = v * A(t);
    ph += fr / SR; ph -= Math.floor(ph);
  }
  return out;
}
/* ruido blanco o rosa, con semilla */
export function noise(dur, seed = 1, color = 'white') {
  const n = secs(dur), out = new Float64Array(n), r = rng(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else out[i] = w;
  }
  return out;
}

/* ---------- filtros (RBJ) ---------- */
function coefs(type, f, q, gain) {
  const w = TAU * clamp(f, 10, SR * 0.49) / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q), A = Math.pow(10, gain / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'lowshelf': { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s); a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break; }
    case 'highshelf': { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s); a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break; }
    default: throw new Error('filtro ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
/* filtro biquad; freq puede ser función del tiempo (barrido): los coeficientes se recalculan cada 16 muestras */
export function filter(x, type, freq, { q = 0.707, gain = 0 } = {}) {
  const out = new Float64Array(x.length), f = fnOf(freq), Q = fnOf(q);
  let c = coefs(type, f(0), Q(0), gain), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const vary = typeof freq === 'function' || typeof q === 'function';
  for (let i = 0; i < x.length; i++) {
    if (vary && (i & 15) === 0) c = coefs(type, f(i / SR), Q(i / SR), gain);
    const y = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
export const lp = (x, f, q) => filter(x, 'lp', f, { q });
export const hp = (x, f, q) => filter(x, 'hp', f, { q });
export const bp = (x, f, q) => filter(x, 'bp', f, { q });
export const eq = (x, f, gain, q = 1) => filter(x, 'peak', f, { q, gain });
export const shelf = (x, type, f, gain) => filter(x, type, f, { gain, q: 0.707 });
export const dcBlock = (x) => filter(x, 'hp', 18, { q: 0.6 });

/* ---------- saturación ---------- */
export const map = (x, fn) => { const o = new Float64Array(x.length); for (let i = 0; i < x.length; i++) o[i] = fn(x[i], i); return o; };
/* tanh con ganancia de entrada; se compensa para que el pico no se dispare */
export const drive = (x, gain) => map(x, (v) => Math.tanh(v * gain));
export const clip = (x, gain = 1, thr = 1) => map(x, (v) => clamp(v * gain, -thr, thr));
/* asimétrica (válvula): genera pares, más «caliente» */
export const tube = (x, gain, bias = 0.2) => { const off = Math.tanh(bias * gain); return map(x, (v) => Math.tanh((v + bias) * gain) - off); };
/* plegado: armónicos ásperos (el «zumbido» del uptempo) */
export const fold = (x, gain) => map(x, (v) => { let y = v * gain; for (let k = 0; k < 6 && Math.abs(y) > 1; k++) y = y > 1 ? 2 - y : -2 - y; return y; });
/* reducción de bits y de frecuencia de muestreo */
export function crush(x, bits = 8, hold = 1) {
  const o = new Float64Array(x.length), steps = Math.pow(2, bits - 1);
  let v = 0;
  for (let i = 0; i < x.length; i++) { if (i % hold === 0) v = Math.round(x[i] * steps) / steps; o[i] = v; }
  return o;
}

/* ---------- dinámica ---------- */
/* limitador con anticipación: ningún pico pasa del umbral, sin recortar */
export function limit(x, ceilDb = -1, { look = 0.0015, release = 0.06 } = {}) {
  const thr = dB(ceilDb), L = Math.max(1, Math.round(look * SR)), rel = Math.exp(-1 / (release * SR));
  const n = x.length, o = new Float64Array(n), need = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); need[i] = a > thr ? thr / a : 1; }
  // mínimo en la ventana que viene (lo que tendrá que bajar)
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) { let m = 1; for (let k = 0; k <= L && i + k < n; k++) if (need[i + k] < m) m = need[i + k]; win[i] = m; }
  // la ganancia baja suave a lo largo de la anticipación y sube con el «release»; un tope final garantiza el techo
  const att = Math.exp(-3 / L);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const target = win[i];
    g = target < g ? target + (g - target) * att : target + (g - target) * rel;
    o[i] = clamp(x[i] * g, -thr, thr);
  }
  return o;
}
/* compresor de pico simple (para pegar capas) */
export function compress(x, { thrDb = -12, ratio = 4, att = 0.002, rel = 0.08, makeup = 0 } = {}) {
  const o = new Float64Array(x.length), aa = Math.exp(-1 / (att * SR)), ar = Math.exp(-1 / (rel * SR));
  let env = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]); env = a > env ? a + (env - a) * aa : a + (env - a) * ar;
    const lv = 20 * Math.log10(env + 1e-9), over = lv - thrDb;
    o[i] = x[i] * dB((over > 0 ? -over * (1 - 1 / ratio) : 0) + makeup);
  }
  return o;
}
/* puerta: corta la cola a partir de un tiempo (el «gated reverb» de las cajas hardcore) */
export const gate = (x, at, fade = 0.01) => map(x, (v, i) => { const t = i / SR; return t < at ? v : t < at + fade ? v * (1 - (t - at) / fade) : 0; });

/* ---------- mezcla y edición ---------- */
export function mix(...parts) {
  // parts: [buffer, gain, offsetSegundos?, fundidoFinal?]. Cada capa termina con un fundido (por defecto el 12 %
  // de su duración, entre 6 y 150 ms): una capa cortada mientras aún suena da un clic justo donde acaba
  // (se ve como una raya vertical en el espectrograma)
  let n = 0;
  for (const [b, , off = 0] of parts) n = Math.max(n, b.length + Math.round(off * SR));
  const o = new Float64Array(n);
  for (const [b, g, off = 0, fade] of parts) {
    const s = Math.round(off * SR), L = b.length, F = Math.max(1, Math.round((fade != null ? fade : clamp(L / SR * 0.12, 0.006, 0.15)) * SR));
    for (let i = 0; i < L; i++) { const k = L - 1 - i, f = k < F ? 0.5 - 0.5 * Math.cos(Math.PI * k / F) : 1; o[s + i] += b[i] * g * f; }
  }
  return o;
}
/* caída final: los últimos `dur` segundos bajan a cero con curva de coseno² (un final natural, no un corte) */
export function fadeEnd(x, dur) {
  const o = Float64Array.from(x), n = Math.min(o.length, secs(dur));
  for (let k = 0; k < n; k++) { const c = Math.cos((k / n) * Math.PI / 2); o[o.length - n + k] *= c * c; }
  return o;
}
export const gain = (x, g) => map(x, (v) => v * g);
export const env = (x, e) => map(x, (v, i) => v * e(i / SR));
export const reverse = (x) => Float64Array.from(x).reverse();
export const cut = (x, from, to) => x.slice(Math.round(from * SR), to == null ? x.length : Math.round(to * SR));
export const pad = (x, dur) => { const o = new Float64Array(Math.max(x.length, secs(dur))); o.set(x); return o; };
/* fundidos para que el principio y el final no hagan clic */
export function fades(x, fin = 0.0005, fout = 0.004) {
  const o = Float64Array.from(x), a = Math.round(fin * SR), b = Math.round(fout * SR);
  for (let i = 0; i < a && i < o.length; i++) o[i] *= i / a;
  for (let i = 0; i < b && i < o.length; i++) o[o.length - 1 - i] *= i / b;
  return o;
}
/* recorta el silencio del final (por debajo de -70 dB) */
export function trimTail(x, thrDb = -70, keep = 0.01) {
  const thr = dB(thrDb); let end = x.length - 1;
  while (end > 0 && Math.abs(x[end]) < thr) end--;
  return x.slice(0, Math.min(x.length, end + Math.round(keep * SR)));
}
/* pico real (entre muestras): sobremuestreo ×4 con sinc enventanado, como los medidores dBTP */
const TP = (() => {
  const P = 4, T = 48, h = [];
  for (let p = 1; p < P; p++) {
    const k = [];
    for (let j = 0; j < T; j++) { const n = j - T / 2 + 1 - p / P, w = 0.5 - 0.5 * Math.cos(TAU * (j + 0.5) / T); k.push((n === 0 ? 1 : Math.sin(Math.PI * n) / (Math.PI * n)) * w); }
    h.push(k);
  }
  return { P, T, h };
})();
export function truePeak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]); if (a > m) m = a;
    for (const k of TP.h) {
      let v = 0;
      for (let j = 0; j < TP.T; j++) { const s = x[i + j - TP.T / 2 + 1]; if (s !== undefined) v += s * k[j]; }
      if (Math.abs(v) > m) m = Math.abs(v);
    }
  }
  return m;
}
/* normaliza al pico real (dBTP), para que no recorte al convertirse a otra frecuencia de muestreo */
export function normalizeTP(s, tpDb = -1) {
  const chans = isSt(s) ? [s.L, s.R] : [s], m = Math.max(...chans.map(truePeak));
  if (!m) return s;
  const g = dB(tpDb) / m;
  return isSt(s) ? stereo(gain(s.L, g), gain(s.R, g)) : gain(s, g);
}
export function normalize(x, peakDb = -1) {
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  return m ? gain(x, dB(peakDb) / m) : x;
}
/* lee un buffer a otra velocidad (tono y tempo juntos, como un sampler) */
export function rate(x, r) {
  const n = Math.floor(x.length / r), o = new Float64Array(n);
  for (let i = 0; i < n; i++) { const p = i * r, k = Math.floor(p), f = p - k; o[i] = (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; }
  return o;
}
/* lectura con velocidad variable (para el «tape stop») */
export function varispeed(x, r, dur) {
  const n = secs(dur), o = new Float64Array(n), R = fnOf(r);
  let p = 0;
  for (let i = 0; i < n; i++) { const k = Math.floor(p), f = p - k; o[i] = k + 1 < x.length ? x[k] * (1 - f) + x[k + 1] * f : 0; p += Math.max(0, R(i / SR)); }
  return o;
}

/* ---------- estéreo y espacio ---------- */
export const stereo = (L, R = L) => ({ L, R: R || L });
/* los dos canales del mismo largo (rellena con silencio) */
export function same(s) {
  const n = Math.max(s.L.length, s.R.length);
  const fit = (c) => { if (c.length === n) return c; const o = new Float64Array(n); o.set(c); return o; };
  return stereo(fit(s.L), fit(s.R));
}
const isSt = (s) => s && s.L instanceof Float64Array;
/* ensancha un mono con dos cadenas de pasatodo distintas (sin desfase en graves) */
export function widen(x, amount = 0.5, seed = 3) {
  const r = rng(seed), mk = () => { let y = x; for (let k = 0; k < 4; k++) y = filter(y, 'notch', 800 + r() * 6000, { q: 6 }); return y; };
  const a = mk(), b = mk(), low = lp(x, 180);
  return stereo(mix([low, 1], [hp(x, 180), 1 - amount], [hp(a, 180), amount]), mix([low, 1], [hp(x, 180), 1 - amount], [hp(b, 180), amount]));
}
/* Freeverb reducido: 8 peines y 4 pasatodo por canal; devuelve solo la cola húmeda (estéreo) */
export function reverb(x, { size = 0.8, damp = 0.4, tail = 2, pre = 0.01 } = {}) {
  const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AP = [556, 441, 341, 225], SPREAD = 23;
  const n = x.length + secs(tail) + secs(pre), input = new Float64Array(n);
  input.set(x, secs(pre));
  const ch = (spread) => {
    const out = new Float64Array(n);
    for (const d0 of COMB) {
      const d = d0 + spread, bufc = new Float64Array(d); let idx = 0, store = 0;
      for (let i = 0; i < n; i++) { const y = bufc[idx]; store = y * (1 - damp) + store * damp; bufc[idx] = input[i] * 0.015 + store * size; idx = (idx + 1) % d; out[i] += y; }
    }
    for (const d0 of AP) {
      const d = d0 + spread, bufa = new Float64Array(d); let idx = 0;
      for (let i = 0; i < n; i++) { const b = bufa[idx], y = -out[i] + b; bufa[idx] = out[i] + b * 0.5; idx = (idx + 1) % d; out[i] = y; }
    }
    return out;
  };
  return stereo(ch(0), ch(SPREAD));
}
/* suma mono + estéreo (o estéreo + estéreo) */
export function mixSt(...parts) {
  const Ls = parts.map(([s, g, off]) => [isSt(s) ? s.L : s, g, off]), Rs = parts.map(([s, g, off]) => [isSt(s) ? s.R : s, g, off]);
  return same(stereo(mix(...Ls), mix(...Rs)));
}
export const applySt = (s, fn) => (isSt(s) ? stereo(fn(s.L), fn(s.R)) : fn(s));
/* limitador enlazado en estéreo */
export function limitSt(s, ceilDb = -1) {
  if (!isSt(s)) return limit(s, ceilDb);
  const m = map(s.L, (v, i) => (Math.abs(v) > Math.abs(s.R[i]) ? v : s.R[i]));
  const lim = limit(m, ceilDb);
  const g = map(m, (v, i) => (Math.abs(v) > 1e-12 ? lim[i] / v : 1));
  return stereo(map(s.L, (v, i) => v * g[i]), map(s.R, (v, i) => v * g[i]));
}

/* ---------- WAV ---------- */
/* PCM 16 bits con dither triangular; mono o estéreo */
export function wav(s, seed = 7) {
  const chans = isSt(s) ? [s.L, s.R] : [s];
  const n = Math.max(...chans.map((c) => c.length)), C = chans.length, r = rng(seed);
  const data = Buffer.alloc(n * C * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) {
    const v = chans[c][i] || 0, d = (r() - r()) / 32768;
    data.writeInt16LE(Math.round(clamp(v + d, -1, 32767 / 32768) * 32768), (i * C + c) * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(C, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * C * 2, 28); h.writeUInt16LE(C * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
export function readWav(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('no es WAV');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) throw new Error('WAV no soportado');
  const n = data.length / 2 / fmt.channels, chans = Array.from({ length: fmt.channels }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.channels; c++) chans[c][i] = data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  return { ...fmt, frames: n, duration: n / fmt.rate, chans };
}

/* ---------- análisis (para validar cada sample) ---------- */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/* espectro medio (Hann, 8192) de un tramo */
export function spectrum(x, from = 0, to = x.length) {
  const N = 8192, mag = new Float64Array(N / 2); let frames = 0;
  for (let s = from; s + N <= Math.max(to, from + N) && s + N <= x.length + N; s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (x[s + i] || 0) * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1)));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k]);
    frames++;
    if (s + N >= to) break;
  }
  return { mag, bin: SR / N, frames };
}
export function infraRatio(x) {
  const N = 1 << Math.ceil(Math.log2(Math.max(65536, x.length * 2))), re = new Float64Array(N), im = new Float64Array(N);
  re.set(x.subarray ? x.subarray(0, N) : x.slice(0, N)); fft(re, im);
  const bin = SR / N; let lo = 0, all = 0;
  for (let k = 0; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; all += p; if (k * bin < 10) lo += p; }
  return all ? lo / all : 0;
}
/* tono fundamental de la cola (desde la cuarta parte del sonido, entre 60 y 150 ms, hasta 600 ms): FFT de 65536 con relleno de ceros e interpolación parabólica */
export function tailPitch(x, from = clamp(x.length / SR * 0.25, 0.06, 0.15), to = Math.min(x.length / SR, 0.6)) {
  const a = Math.round(from * SR), b = Math.min(x.length, Math.round(to * SR));
  if (b - a < 2048) return 0;
  const N = 65536, re = new Float64Array(N), im = new Float64Array(N), L = b - a;
  for (let i = 0; i < L; i++) re[i] = x[a + i] * (0.5 - 0.5 * Math.cos(TAU * i / (L - 1)));
  fft(re, im);
  const mag = (k) => Math.hypot(re[k], im[k]), bin = SR / N;
  let best = 0, bk = 0;
  for (let k = Math.ceil(30 / bin); k <= Math.floor(200 / bin); k++) { const m = mag(k); if (m > best) { best = m; bk = k; } }
  if (!bk) return 0;
  const y0 = mag(bk - 1), y1 = best, y2 = mag(bk + 1), d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
  return (bk + (isFinite(d) ? d : 0)) * bin;
}
export function analyze(s) {
  const chans = isSt(s) ? [s.L, s.R] : [s], x = chans[0], n = x.length;
  let peak = 0, sum = 0, dc = 0, clipped = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; sum += c[i] * c[i]; if (a >= 0.9999) clipped++; }
  // continua: proporción de energía por debajo de 10 Hz (FFT larga con relleno); una onda desplazada la dispara,
  // la caída natural de un golpe no
  dc = infraRatio(x);
  const total = chans.reduce((a, c) => a + c.length, 0);
  // energía por bandas y centroide sobre todo el sonido
  const { mag, bin } = spectrum(x);
  let e = 0, ec = 0, sub = 0, low = 0, mid = 0, high = 0;
  mag.forEach((m, k) => { const f = k * bin, p = m * m; e += p; ec += p * f; if (f < 60) sub += p; else if (f < 250) low += p; else if (f < 4000) mid += p; else high += p; });
  // nota de la cola de un kick: pico entre 30 y 200 Hz del tramo tras los primeros 60 ms
  const bf = tailPitch(x);
  return {
    duration: n / SR, channels: chans.length,
    peakDb: 20 * Math.log10(peak || 1e-9), rmsDb: 10 * Math.log10(sum / total + 1e-12), dc, clipped,
    startAbs: Math.abs(x[0]), endAbs: Math.abs(x[n - 1]), truePeakDb: 20 * Math.log10(Math.max(...chans.map(truePeak)) || 1e-9),
    centroid: e ? ec / e : 0, bands: { sub: sub / e, low: low / e, mid: mid / e, high: high / e }, tailHz: bf
  };
}
export const hzToNote = (f) => { if (!f) return null; const m = Math.round(69 + 12 * Math.log2(f / 440)); return Object.keys(NOTE)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };
