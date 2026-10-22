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

/* El kick de hardcore (early, gabber, mainstream, industrial, crossbreed, terror). Otro animal que el de uptempo:
     1. la fuente es un 909: un seno con caída de tono muy rápida y el volumen cayendo (fade, en s; 0 = sostenido
        como en el mainstream), con algo de cuadrada si se quiere más zumbido;
     2. «rumble» (verb): una sala ANTES de distorsionar; la distorsión convierte su cola en el retumbe del industrial;
     3. reducción de bits (crunch) antes de distorsionar, como en el gabber de los 90;
     4. realce de cuerpo (~200 Hz) y medios (~1,5 kHz) antes de distorsionar, saturación asimétrica (de válvula: pares
        e impares), plegado opcional y recorte duro;
     5. después: graves en la nota, «gabinete» (quita la bola de medios en 4,5 kHz y los agudos ásperos) y un filtro
        que oscurece (dark) para el industrial;
     6. el golpe aparte, limpio: punch (seno de ~150 Hz afinado a un armónico de la nota que cae en 6 ms), tok y tick;
     7. graves en mono por debajo de 140 Hz, OTT y soft clip.
   Fuentes: forum.renoise.com («Making gabber kicks…»: separar clic, cuerpo distorsionado y sub; distorsionar en
   paralelo; 2–4 bits antes de distorsionar; gabinete para quitar la bola de medios), attackmagazine.com («In the red»:
   un 909 con la ganancia de entrada al máximo, +100 Hz, +1,5 kHz, −4,5 kHz, +8 kHz). */
/* una distorsión con sobremuestreo ×4 (FIR de seno enventanado): el recorte duro sin sobremuestrear crea aliasing y
   picos entre muestras de +3–4 dB, que al normalizar a −1 dBTP dejan la cola 4 dB más floja */
const FIR = (() => { const N = 64, fc = 0.5 / 4 * 0.9, h = new Float64Array(N + 1); let sum = 0;
  for (let i = 0; i <= N; i++) { const m = i - N / 2, w = 0.42 - 0.5 * Math.cos(TAU * i / N) + 0.08 * Math.cos(2 * TAU * i / N); h[i] = (m === 0 ? 2 * fc : Math.sin(TAU * fc * m) / (Math.PI * m)) * w; sum += h[i]; }
  for (let i = 0; i <= N; i++) h[i] /= sum; return h; })();
function conv(x, gain) { const N = FIR.length, o = new Float64Array(x.length + N - 1); for (let i = 0; i < x.length; i++) { const v = x[i]; if (!v) continue; for (let k = 0; k < N; k++) o[i + k] += v * FIR[k] * gain; } return o.subarray((N - 1) / 2, (N - 1) / 2 + x.length); }
export function os4(x, fn) {
  const up = new Float64Array(x.length * 4); for (let i = 0; i < x.length; i++) up[i * 4] = x[i];
  const y = conv(fn(conv(up, 4)), 1), o = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) o[i] = y[i * 4];
  return o;
}

export function hcKick(note, {
  len = 0.45, from = null, semis = 36, drop = 0.04, fade = 0.25, sq = 0, punch = 0.8, verb = 0, bits = 0, fold = 0,
  body = 4, mids = 6, drive1 = 12, drive2 = 5, low = 1, cab = 0.3, dark = 0, tok = 0.8, tick = 0.6, refl = 0.15, ottAmt = 0.45, seed = 1,
  grit = 0, clip = 0, hollow = 0, bend = 0, screech = 0, close = 0
} = {}) {
  const f1 = hz(note), st = from ? 12 * Math.log2(hz(from) / f1) : semis, tc = drop / 3;
  // bend: la cola se curva al final (semitonos, hacia abajo si es negativo), como en el mainstream
  const fr = (t) => f1 * Math.pow(2, (st * Math.exp(-t / tc) + bend * Math.pow(Math.min(1, t / len), 3)) / 12);
  const L = len + 0.02;
  // 1. el 909: seno (y cuadrada) con caída de tono y de volumen
  let src = sine(L, fr);
  if (sq) { const s2 = saw(L, fr, 0), s3 = saw(L, fr, 0.5); src = D.mix([src, 1 - sq * 0.5], [D.map(s2, (v, i) => v - s3[i]), sq * 0.5]); }
  const amp = (t) => Math.min(1, t / 0.0006) * (fade ? Math.exp(-t / fade) * 0.85 + 0.15 * Math.max(0, 1 - t / len) : 1) * (t < len - 0.03 ? 1 : Math.max(0, (L - t) / 0.05));
  src = D.env(src, amp);
  // 2. rumble: la sala antes de distorsionar, cortada al largo del golpe
  if (verb) {
    const w = D.reverb(src, { size: 0.86, damp: 0.55, tail: 0.6, pre: 0.008 });
    src = D.mix([src, 1], [D.env(D.hp(w.L.slice(0, src.length), 35), (t) => Math.min(1, t / 0.03) * Math.max(0, 1 - t / L)), verb * 9]);
  }
  const stS = early(src, seed, { wet: refl });
  const resF = f1 * Math.max(2, Math.round(1500 / f1));   // los medios, en un armónico de la nota
  let side = 0;
  const chain = (x) => {
    // grano: ruido de 0,5–5 kHz que sigue al golpe, metido ANTES de distorsionar; el recorte lo pega a la onda y da
    // los bordes ásperos y la joroba de 1–4 kHz que tienen los kicks de hardcore de verdad
    if (grit) x = D.mix([x, 1], [D.env(D.bp(D.noise(x.length / SR, seed + 40 + side++), 1800, 0.45), amp), grit * 0.35]);
    // 3. crunch
    if (bits) x = D.crush(D.gain(x, 0.9), bits, 1);
    // 4. válvula (crea los armónicos) → cuerpo y medios realzados → (plegado) → recorte: la segunda distorsión
    //    convierte el realce en dureza (un realce antes de la primera no haría nada: el seno no tiene medios)
    x = D.tube(x, drive1, 0.15);
    x = D.filter(x, 'hp', 20, { q: 0.6 });   // la válvula asimétrica deja continua que sube y baja con el golpe: fuera antes de recortar
    x = D.eq(x, f1 * Math.max(2, Math.round(200 / f1)), body, 0.9); x = D.eq(x, resF, mids, 0.8); x = D.eq(x, 3000, mids * 0.5, 1);
    if (fold) x = D.mix([x, 1 - fold], [D.fold(x, 1 + fold * 2.5), fold]);
    x = hardClip(x, drive2);
    // 5. graves en la nota, gabinete, oscuridad, soft clip
    x = D.eq(x, f1, 3 * low, 1); x = D.eq(x, 300, -3, 1.1);
    if (cab) { x = D.eq(x, 4500, -8 * cab, 1); x = D.lp(x, 11000 - 5000 * cab, 0.7); }
    x = D.shelf(x, 'highshelf', 8000, 2 - 3 * cab);
    if (dark) x = D.filter(x, 'lp', (t) => (900 + 9000 * (1 - dark)) * (0.35 + 0.65 * Math.exp(-t / 0.08)) + 300, { q: 0.9 });
    // close: un paso bajo que se va cerrando a lo largo del golpe (el «se apaga» de las colas largas)
    if (close) x = D.filter(x, 'lp', (t) => 400 + 9000 * Math.pow(1 - close * Math.min(1, t / len), 2), { q: 1.1 });
    // screech: un paso banda muy resonante que baja de 3,2 kHz a 700 Hz, distorsionado otra vez: el chillido
    if (screech) { const b2 = D.filter(x, 'bp', (t) => 700 + 2500 * Math.pow(Math.max(0, 1 - t / len), 1.6), { q: 9 }); x = D.mix([x, 1], [D.map(b2, (v) => Math.tanh(v * 6)), screech * 0.5]); }
    return softClip(D.gain(x, 0.6));
  };
  let tail = D.stereo(chain(stS.L), chain(stS.R));
  // un refuerzo de sub: el mismo 909 sin distorsionar, solo la nota, que el recorte final pega a la cola
  const sub = D.map(D.lp(D.lp(D.env(sine(L, fr), amp), f1 * 1.6, 0.7), f1 * 1.6, 0.7), (v) => Math.tanh(v * 1.6) * 0.35 * low);
  const glue = (c) => softClip(hardClip(D.mix([c, 1], [sub, 1]), 2.2, 4));   // pegamento: una distorsión ligera sobre todo deja la cola densa
  tail = D.stereo(glue(tail.L), glue(tail.R));
  // 6. punch, tok y tick limpios, delante
  const pf = f1 * Math.max(2, Math.round(150 / f1));
  const pS = D.map(D.osc(0.12, D.sweep(pf * 2.2, pf, 0.006), { amp: D.ahd(0.0004, 0.012, 0.035) }), (v) => Math.tanh(v * 1.8));
  const tokS = D.hp(D.osc(0.1, D.sweep(1800, 260, 0.01), { amp: D.ahd(0.0003, 0.006, 0.018) }), 180);
  const tickS = D.env(D.hp(D.noise(0.03, seed + 9), 3000), D.expEnv(0.0035));
  const front = D.mix([pS, punch], [tokS, tok], [tickS, tick]);
  tail = D.stereo(D.mix([tail.L, 1], [front, 0.7]), D.mix([tail.R, 1], [front, 0.7]));
  tail = monoLow(tail, 140);
  // OTT y un último recorte suave: el OTT sube los armónicos y deja picos; el recorte los aplana (cola al tope)
  // clip: el recorte final del gabber, la cola casi cuadrada (la del kick entero, sub incluido)
  // hollow: después del recorte, quitar los armónicos bajos (130–400 Hz) que el recorte llena: la nota queda sola
  // abajo y el golpe se oye en los medios, como en los kicks de referencia (la nota 20 dB por encima de esa banda)
  const end = (c) => {
    const hol = (y, k) => (hollow ? D.eq(D.eq(D.eq(y, f1 * 3, -hollow * k, 1.4), f1 * 5, -hollow * 0.8 * k, 1.4), 260, -hollow * 0.5 * k, 0.9) : y);
    // la mitad antes del recorte (el recorte la rellena un poco: queda redondeada, sin pinchos) y la mitad después
    return softClip(D.gain(hol(os4(hol(ott(c, { amount: ottAmt }), 0.6), (u) => softClip(hardClip(u, 1.6 + clip * 3, 4 + clip * 8))), 0.5), 1.08));
  };
  // el final, limpio y después de todo el recorte: si no, al bajar la nota el recorte sube el ruido y la sala (un
  // soplido al final del golpe)
  const out = (c) => D.env(end(c), (t) => (t < len - 0.025 ? 1 : Math.pow(Math.max(0, (len + 0.01 - t) / 0.035), 1.5)));
  return D.stereo(out(tail.L), out(tail.R));
}

/* Ajustes del Laboratorio de kicks (js/data/kicks.js) → kick. Lo usan el worker del laboratorio y los packs, así que un
   kick de la biblioteca y el mismo ajuste en el laboratorio suenan igual. Devuelve el kick sin normalizar. */
export function labKick(p) {
  const f1 = hz(p.note);
  if (p.type === 'hc') {
    return hcKick(p.note, {
      len: p.len / 1000, semis: p.semis, drop: p.drop / 1000, fade: p.fade, sq: p.sq, punch: p.punch, verb: p.verb, bits: p.bits, fold: p.fold,
      body: p.body, mids: p.mids, drive1: p.drive1, drive2: p.drive2, low: p.low, cab: p.cab, dark: p.dark, tok: p.tok, tick: p.tick, refl: p.refl, ottAmt: p.ott, seed: p.seed, grit: p.grit || 0, clip: p.clip || 0, hollow: p.hollow || 0, bend: p.bend || 0, screech: p.screech || 0, close: p.close || 0
    });
  }
  const common = {
    from: f1 * Math.pow(2, p.semis / 12), drop: p.drop / 1000, sawMix: p.saw, refl: p.refl, mids: p.mids, res: p.res,
    drive1: p.drive1, drive2: p.drive2, tok: p.tok, tick: p.tick, ottAmt: p.ott, low: p.low, scoop300: p.scoop, seed: p.seed
  };
  return p.type === 'french'
    ? frenchKick(p.note, { ...common, len: p.len / 1000, bpm: p.bpm, at: p.at / 1000, per: p.per, decay: p.decay, drop: Math.min(common.drop, 0.05) })
    : hardKick(p.note, { ...common, len: p.len / 1000, move: p.move });
}

/* el kick listo para sonar: sin continua, cola recortada a −66 dB, fundidos y −1 dBTP (igual en el laboratorio y en los packs) */
export function labSound(p) {
  let s = D.same(labKick(p));
  // sin continua; en el hardcore con un filtro más bajo: a 18 Hz, la cola casi cuadrada de 40–55 Hz se combaría
  const dc = (x) => (p.type === 'hc' ? D.filter(x, 'hp', 6, { q: 0.6 }) : D.dcBlock(x));
  const L = dc(s.L), R = dc(s.R);
  const n = Math.max(D.trimTail(L, -66).length, D.trimTail(R, -66).length);
  s = D.stereo(D.fades(L.slice(0, n), 0.0005, 0.01), D.fades(R.slice(0, n), 0.0005, 0.01));
  return D.normalizeTP(D.limitSt(s, -0.7), -1);
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
