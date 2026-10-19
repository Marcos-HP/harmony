/* HARMONY · motor de kicks y leads duros (uptempo, frenchcore)
   Sigue cómo los hacen los productores, no un seno que cae y se satura:
     1. la fuente es un bajo sostenido (seno + algo de sierra) con una caída de tono desde Do 4–Do 5 hasta la nota
        en 100–200 ms;
     2. reflexiones tempranas ANTES de distorsionar (dan textura y estéreo a la cola);
     3. antes de cada distorsión se realzan los medios y una banda resonante (sin un armónico ahí, la distorsión no
        tiene qué amplificar); dos etapas de distorsión;
     4. después: subir graves, quitar 6 dB en 300 Hz, un poco de agudos, soft clip;
     5. el «movimiento» de la cola: la ganancia de la banda resonante cambia a lo largo del golpe;
     6. tok y tick limpios y aparte (sin graves), graves en mono por debajo de 180 Hz y compresión tipo OTT;
     7. frenchcore: un trozo pegado al ataque repetido (unas tres veces por negra) da la cola zumbona.
   Fuentes de la técnica: musicproductionwiki.com («How to recreate the hardstyle kick»), idmforums.com («Tutorial for
   creating uptempo and frenchcore type kicks»), screechhouse.com («Raw kick tutorial»), en.wikipedia.org/wiki/Frenchcore. */
import * as D from './dsp.mjs';

const SR = D.SR, TAU = Math.PI * 2;
const hz = (n) => (typeof n === 'number' ? n : D.note(n.replace(/-?\d+$/, ''), +n.match(/-?\d+$/)[0]));

/* sierra sin aliasing (polyBLEP) con frecuencia variable */
function saw(dur, f, phase = 0) {
  const n = D.secs(dur), o = new Float64Array(n), fn = typeof f === 'function' ? f : () => f;
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const fr = fn(i / SR), dt = Math.min(0.5, fr / SR);
    let v = 2 * ph - 1;
    if (ph < dt) { const x = ph / dt; v -= x + x - x * x - 1; } else if (ph > 1 - dt) { const x = (ph - 1) / dt; v -= x * x + x + x + 1; }
    o[i] = v; ph += fr / SR; ph -= Math.floor(ph);
  }
  return o;
}
/* seno con frecuencia variable (fase continua) */
function sine(dur, f, phase = 0) {
  const n = D.secs(dur), o = new Float64Array(n), fn = typeof f === 'function' ? f : () => f;
  let ph = phase;
  for (let i = 0; i < n; i++) { o[i] = Math.sin(TAU * ph); ph += fn(i / SR) / SR; ph -= Math.floor(ph); }
  return o;
}

/* reflexiones tempranas: unos cuantos ecos de 6–40 ms, distintos a cada lado */
export function early(x, seed = 1, { wet = 0.35 } = {}) {
  const r = D.rng(seed), taps = (k) => Array.from({ length: 7 }, () => [0.006 + r() * 0.034, (0.25 + r() * 0.5) * (r() < 0.5 ? -1 : 1)]);
  const side = (tp) => { const parts = [[x, 1]]; tp.forEach(([t, g]) => parts.push([D.lp(x, 6000), g * wet, t, 0.003])); return D.mix(...parts); };
  return D.same(D.stereo(side(taps(0)), side(taps(1))));   // los dos lados, del mismo largo
}
/* distorsiones: suave (tanh) y dura (recorte con rodilla corta), con la ganancia de entrada */
export const soft = (x, pre) => D.map(x, (v) => Math.tanh(v * pre));
export const hardClip = (x, pre, k = 5) => D.map(x, (v) => { const y = v * pre; return y / Math.pow(1 + Math.pow(Math.abs(y), k), 1 / k); });
export const softClip = (x, ceil = 0.95) => D.map(x, (v) => (Math.abs(v) < ceil * 0.66 ? v : Math.sign(v) * (ceil * 0.66 + (ceil * 0.34) * Math.tanh((Math.abs(v) - ceil * 0.66) / (ceil * 0.34)))));
/* compresión tipo OTT (hacia arriba y hacia abajo) en tres bandas: lo flojo sube, lo fuerte se aplana */
export function ott(x, { amount = 0.5, low = 1, mid = 0.6, high = 0.7, xl = 150, xh = 2500 } = {}) {
  const lo = D.lp(D.lp(x, xl, 0.7), xl, 0.7), hi = D.hp(D.hp(x, xh, 0.7), xh, 0.7);
  const md = D.map(x, (v, i) => v - lo[i] - hi[i]);
  const band = (b, w) => {
    const out = new Float64Array(b.length), a = Math.exp(-1 / (0.004 * SR)), r = Math.exp(-1 / (0.05 * SR));
    let e = 0;
    for (let i = 0; i < b.length; i++) {
      const v = Math.abs(b[i]); e = v > e ? v + (e - v) * a : v + (e - v) * r;
      const t = 0.3, g = e < t ? Math.min(4, Math.pow(t / Math.max(e, 1e-4), 0.6 * amount * w)) : Math.pow(t / e, 0.4 * amount * w);
      out[i] = b[i] * g;
    }
    return out;
  };
  const L = band(lo, low), M = band(md, mid), Hh = band(hi, high);
  return D.map(x, (v, i) => v * (1 - amount) + (L[i] + M[i] + Hh[i]) * amount);
}
/* graves en mono por debajo de f (lo que suena en un club tiene que sumar en mono) */
export function monoLow(s, f = 180) {
  if (!s.L) return s;
  const m = D.mix([s.L, 0.5], [s.R, 0.5]), low = D.lp(D.lp(m, f, 0.7), f, 0.7);
  const hiL = D.hp(D.hp(s.L, f, 0.7), f, 0.7), hiR = D.hp(D.hp(s.R, f, 0.7), f, 0.7);
  return D.stereo(D.map(low, (v, i) => v + hiL[i]), D.map(low, (v, i) => v + hiR[i]));
}
/* una banda resonante cuya ganancia cambia en el tiempo (el «movimiento» de la cola) */
function moveBand(x, f, q, g) { const b = D.bp(x, f, q); return D.map(x, (v, i) => v + g(i / SR) * b[i]); }
const MOVES = {
  down: (len) => (t) => 5 * Math.pow(Math.max(0, 1 - t / len), 1.5),                       // se cierra
  up: (len) => (t) => 0.3 + 5 * Math.pow(Math.min(1, t / len), 1.5),                       // se abre (chilla al final)
  wobble: (len) => (t) => 2.6 + 2.6 * Math.sin(TAU * (t / len) * 2 - Math.PI / 2),          // dos vaivenes
  hold: () => () => 2.5
};

/* El kick duro. note: nota de la cola (p. ej. 'D2'); len: lo que dura (a 200 BPM, un tiempo = 0,3 s) */
export function hardKick(note, {
  len = 0.3, from = 'C5', drop = 0.13, sawMix = 0.3, refl = 0.35, mids = 9, res = 4, resQ = 5, drive1 = 9, drive2 = 5,
  move = 'down', tok = 0.8, tick = 0.5, ottAmt = 0.45, seed = 1, air = 0, low = 1, scoop300 = -6
} = {}) {
  const f1 = hz(note), semis = 12 * Math.log2(hz(from) / f1), tc = drop / 3;
  const fr = (t) => f1 * Math.pow(2, (semis * Math.exp(-t / tc)) / 12);
  const L = len + 0.02;
  // 1. fuente: bajo sostenido con su caída de tono
  let src = D.mix([sine(L, fr), 1], [saw(L, fr, 0.25), sawMix]);
  src = D.env(src, (t) => Math.min(1, t / 0.0008) * (t < len - 0.03 ? 1 : Math.max(0, (L - t) / 0.05)));
  if (air) src = D.mix([src, 1], [D.env(D.bp(D.noise(L, seed + 5), 1800, 0.8), D.expEnv(0.04)), air]);
  // 2. reflexiones antes de distorsionar
  const st = early(src, seed, { wet: refl });
  // la banda resonante: el armónico de la nota más cercano a ~900 Hz
  const resF = f1 * Math.max(2, Math.round(900 / f1));
  const chain = (x) => {
    // 3. medios y resonancia → distorsión → resonancia y graves → distorsión
    x = D.eq(x, 650, mids, 0.9); x = D.eq(x, resF, res + 3, resQ); x = D.eq(x, 1600, mids * 0.4, 1.2);
    x = soft(x, drive1);
    x = D.eq(x, f1, 6 * low, 1.2); x = D.eq(x, 450, 3, 1);
    // 5. movimiento: la banda resonante sube y baja ANTES de la segunda distorsión, que la convierte en timbre
    x = moveBand(x, resF, resQ, MOVES[move](len));
    x = hardClip(x, drive2);
    // 4. graves, −6 dB en 300 Hz, agudos, soft clip
    x = D.eq(x, f1, 5 * low, 1); x = D.eq(x, 300, scoop300, 1.1); x = D.shelf(x, 'highshelf', 6000, 2); x = D.lp(x, 12000, 0.7);
    x = softClip(D.gain(x, 0.6));
    // y después de distorsionar, un filtro que se mueve igual (es lo que más se oye)
    if (move === 'down') x = D.filter(x, 'lp', (t) => 1600 + 9000 * Math.pow(Math.max(0, 1 - t / len), 1.4), { q: 1.2 });
    else if (move === 'up') x = moveBand(x, resF * 2, 3, (t) => 3.2 * Math.pow(Math.min(1, t / len), 1.3));
    else if (move === 'wobble') x = D.filter(x, 'lp', (t) => 1400 + 7000 * (0.5 + 0.5 * Math.cos(TAU * (t / len) * 2)), { q: 2.2 });
    return x;
  };
  let tail = D.stereo(chain(st.L), chain(st.R));
  // 6. tok y tick limpios, sin graves, delante
  const tokS = D.hp(D.osc(0.12, D.sweep(1400, 180, 0.012), { amp: D.ahd(0.0004, 0.01, 0.025) }), 140);
  const tickS = D.env(D.hp(D.noise(0.03, seed + 9), 2500), D.expEnv(0.004));
  const front = D.mix([tokS, tok], [tickS, tick]);
  tail = D.stereo(D.mix([tail.L, 1], [front, 0.9]), D.mix([tail.R, 1], [front, 0.9]));
  tail = monoLow(tail, 180);
  tail = D.stereo(ott(tail.L, { amount: ottAmt }), ott(tail.R, { amount: ottAmt }));
  return D.stereo(softClip(tail.L), softClip(tail.R));
}

/* Kick de frenchcore: el ataque del kick duro y, detrás, un trozo pegado al ataque repetido (cola zumbona) */
export function frenchKick(note, { len = 0.3, bpm = 200, at = 0.07, per = 3, decay = 0.6, ...o } = {}) {
  // caída de tono corta: el trozo que se repite ya está en la nota (si no, la cola suena más aguda)
  const k = hardKick(note, { len: 0.2, move: 'hold', drop: 0.05, ...o });
  // el trozo dura un número entero de ciclos de la nota: así cada vuelta empalma en fase y la cola suena afinada
  const f1 = hz(note), seg = Math.max(1, Math.round((60 / bpm / per) * f1)) / f1;
  const n = D.secs(len), head = D.secs(at), sl = D.secs(seg), xf = D.secs(0.003);
  const one = (c) => {
    const out = new Float64Array(n);
    for (let i = 0; i < Math.min(head, n); i++) out[i] = c[i];
    for (let i = head; i < n; i++) {
      // el trozo [ataque, ataque + seg] una y otra vez, con fundidos de 3 ms en cada empalme
      const j = i - head, rep = Math.floor(j / sl), p = j % sl;
      const w = (rep > 0 ? Math.min(1, p / xf) : 1) * Math.min(1, (sl - p) / xf);
      out[i] = c[head + p] * w;
    }
    return D.env(out, (t) => (t < at ? 1 : Math.pow(Math.max(0, 1 - (t - at) / (len - at)), decay)));
  };
  return D.stereo(one(k.L), one(k.R));
}

/* Lead de himno: supersierra con entrada desde abajo (2 semitonos), vibrato tardío, formantes y dos distorsiones */
export function anthemVoice(seed = 1, { voices = 7, spread = 24, scoop = 2, vib = 0.18, formant = [1300, 2700], fgain = [7, 5], drive = 2.4, sub = 0.35 } = {}) {
  return (f, gate, vel = 1) => {
    const L = gate + 0.12, r = D.rng(seed + Math.round(f));
    const fr = (t) => f * Math.pow(2, (-scoop * Math.exp(-t / 0.014) + (t > 0.16 ? vib * Math.sin(TAU * 5.6 * (t - 0.16)) * Math.min(1, (t - 0.16) / 0.25) : 0)) / 12);
    const parts = [];
    for (let k = 0; k < voices; k++) {
      const c = (k - (voices - 1) / 2) / ((voices - 1) / 2) * spread;
      parts.push([saw(L, (t) => fr(t) * Math.pow(2, c / 1200), r()), 1 / voices]);
    }
    parts.push([D.osc(L, (t) => fr(t) / 2, { shape: 'square', phase: r() }), sub]);
    let x = D.mix(...parts);
    x = D.eq(x, formant[0], fgain[0], 1.8); x = D.eq(x, formant[1], fgain[1], 2.5);
    x = soft(x, drive); x = D.eq(x, 320, -4, 1); x = soft(x, 1.4); x = D.lp(x, 9500, 0.7);
    const e = (t) => (t < 0.003 ? t / 0.003 : t < gate ? 0.85 + 0.15 * Math.exp(-(t - 0.003) / 0.08) : 0.85 * Math.exp(-(t - gate) / 0.035));
    return D.map(D.env(x, e), (v) => v * vel * 0.7);
  };
}
