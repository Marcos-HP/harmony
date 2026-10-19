// node tools/samples/render-preset.mjs <id del preset> [salida.wav]
// Toca un preset de banco (js/data/presets.js) fuera del navegador, como lo haría el secuenciador: su cadena de patrones
// una vez, cada pad monofónico con su grupo de corte, su volumen, la duración de las notas y sus efectos (distorsión,
// filtro, bits y eco, aproximados), y lo guarda en WAV. Sirve para escuchar un preset entero (y para revisarlo).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import * as D from './dsp.mjs';

const ROOT = new URL('../../', import.meta.url).pathname, SR = D.SR;
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/data/presets.js', 'js/lib/patterns.js', 'js/lib/banks.js']) vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx);
const H = ctx.window.H;

export function renderPreset(id) {
  const pr = H.data.presets.find((p) => p.id === id);
  if (!pr) throw new Error('No hay preset ' + id);
  const st = H.Banks.defaultState(), b = H.Banks.fromPreset(st, pr), seq = b.seq, P = H.Patterns;
  const sd = P.stepDur(seq.bpm), order = seq.chainOn && seq.chain.length ? seq.chain : [seq.pattern];
  const total = order.reduce((n, p) => n + seq.patterns[p].len, 0);
  const audio = b.pads.map((p) => {
    if (!p.src) return null;
    const [pack, slug] = p.src.sampleId.split('/'), w = D.readWav(readFileSync(join(ROOT, 'samples', pack, slug + '.wav')));
    let L = w.chans[0], R = w.chans[1] || w.chans[0];
    if (p.pitch) { const r = Math.pow(2, p.pitch / 12); L = D.rate(L, r); R = D.rate(R, r); }
    return { L, R };
  });
  const n = D.secs(total * sd + 4), L = new Float64Array(n), R = new Float64Array(n);
  // pistas por pad (para aplicar sus efectos al final, como la cadena de cada pad en el navegador)
  const tracks = b.pads.map(() => null);
  const voice = b.pads.map(() => null);   // la voz que suena en cada pad: { at, end }
  let t0 = 0;
  for (const p of order) {
    const pat = seq.patterns[p];
    for (let s = 0; s < pat.len; s++) {
      const when = t0 + (s * sd) + P.swingDelay(seq, s);
      for (const [k, row] of Object.entries(pat.rows)) {
        const i = +k, v = +row[s]; if (!v || !audio[i]) continue;
        // corta lo que sonaba en este pad y en su grupo de corte
        [i, ...H.Banks.chokeMates(b, i)].forEach((j) => { if (voice[j] && voice[j].end > when) voice[j].end = when; });
        const len = P.noteLen(seq, p, i, s);
        voice[i] = { at: when, end: len ? when + len * sd : Infinity, vel: P.VEL[v], pad: i };
        (tracks[i] = tracks[i] || []).push(voice[i]);
      }
    }
    t0 += pat.len * sd;
  }
  b.pads.forEach((pad, i) => {
    if (!tracks[i]) return;
    const tl = new Float64Array(n), tr = new Float64Array(n), a = audio[i];
    for (const v of tracks[i]) {
      const s0 = Math.round(v.at * SR), dur = Math.min(a.L.length, v.end === Infinity ? a.L.length : Math.round((v.end - v.at) * SR));
      const fade = Math.round(0.004 * SR);
      for (let j = 0; j < dur && s0 + j < n; j++) {
        const g = pad.volume * v.vel * (j > dur - fade && dur < a.L.length ? (dur - j) / fade : 1);
        tl[s0 + j] += a.L[j] * g; tr[s0 + j] += a.R[j] * g;
      }
    }
    const fx = (x) => {
      if (pad.drive) { const k = 1 + (pad.drive / 100) * 24; x = D.map(x, (v) => Math.tanh(k * v) / Math.tanh(k) / (1 + (pad.drive / 100) * 0.9)); }
      if (pad.filter !== 'off') x = D.filter(x, { lp: 'lp', hp: 'hp', bp: 'bp' }[pad.filter], pad.cutoff, { q: pad.filter === 'bp' ? 0.7 + pad.res / 100 * 14 : 0.7 + pad.res / 100 * 6 });
      if (pad.bits) x = D.crush(x, pad.bits, 1);
      if (pad.echo) { const d = D.secs((60 / seq.bpm) * pad.echoDiv), y = Float64Array.from(x); for (let j = d; j < y.length; j++) y[j] += y[j - d] * (pad.echoFb / 100); x = D.map(x, (v, j) => v + (y[j] - v) * (pad.echo / 100) * 0.8); }
      return x;
    };
    const fl = fx(tl), fr = fx(tr);
    for (let j = 0; j < n; j++) { L[j] += fl[j]; R[j] += fr[j]; }
  });
  // máster: un poco de margen, limitador y −1 dBTP (en el navegador va el compresor del máster de Harmony)
  let out = D.stereo(D.gain(L, 0.7), D.gain(R, 0.7));
  out = D.limitSt(out, -1.3);
  out = D.normalizeTP(out, -1);
  const len = D.secs(total * sd + 1.5);
  return { audio: D.stereo(D.fades(out.L.slice(0, len), 0.001, 1.2), D.fades(out.R.slice(0, len), 0.001, 1.2)), preset: pr, seconds: total * sd };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2], out = process.argv[3] || `${id}.wav`;
  const r = renderPreset(id);
  writeFileSync(out, D.wav(r.audio));
  const a = D.analyze(r.audio);
  console.log(`${r.preset.name}: ${r.seconds.toFixed(1)} s · RMS ${a.rmsDb.toFixed(1)} dB · pico real ${a.truePeakDb.toFixed(1)} dBTP → ${out}`);
}
