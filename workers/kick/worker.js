/* HARMONY · Laboratorio de kicks: el motor de kicks duros (tools/samples/hard.mjs) corriendo en el navegador.
   Recibe los ajustes, calcula el kick y lo devuelve listo para sonar (sin continua, cola recortada, −1 dBTP), con la
   nota que se mide en la cola. dsp.js y hard.js los copia el build desde tools/samples/: es el mismo motor con el que
   se hacen los samples de Harmony.
     → { id, p: ajustes }   ← { id, L, R, ms, note, hz, peakDb, rmsDb } o { id, error } */
import * as D from './dsp.js';
import * as K from './hard.js';

self.onmessage = (ev) => {
  const { id, p } = ev.data || {};
  try {
    const t0 = performance.now();
    const f1 = D.note(p.note.replace(/-?\d+$/, ''), +p.note.match(/-?\d+$/)[0]);
    const common = {
      from: f1 * Math.pow(2, p.semis / 12), drop: p.drop / 1000, sawMix: p.saw, refl: p.refl, mids: p.mids, res: p.res,
      drive1: p.drive1, drive2: p.drive2, tok: p.tok, tick: p.tick, ottAmt: p.ott, low: p.low, scoop300: p.scoop, seed: p.seed
    };
    let s = p.type === 'french'
      ? K.frenchKick(p.note, { ...common, len: p.len / 1000, bpm: p.bpm, at: p.at / 1000, per: p.per, decay: p.decay, drop: Math.min(common.drop, 0.05) })
      : K.hardKick(p.note, { ...common, len: p.len / 1000, move: p.move });
    s = D.same(s);
    let L = D.dcBlock(s.L), R = D.dcBlock(s.R);
    const n = Math.max(D.trimTail(L, -66).length, D.trimTail(R, -66).length);
    s = D.stereo(D.fades(L.slice(0, n), 0.0005, 0.01), D.fades(R.slice(0, n), 0.0005, 0.01));
    s = D.normalizeTP(D.limitSt(s, -0.7), -1);
    const a = D.analyze(s);
    const out = { id, L: Float32Array.from(s.L), R: Float32Array.from(s.R), ms: Math.round(performance.now() - t0), hz: a.tailHz || 0, note: a.tailHz ? D.hzToNote(a.tailHz) : null, peakDb: a.truePeakDb, rmsDb: a.rmsDb };
    self.postMessage(out, [out.L.buffer, out.R.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
