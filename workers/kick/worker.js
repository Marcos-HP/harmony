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
    const s = K.labSound(p);
    const a = D.analyze(s);
    const out = { id, L: Float32Array.from(s.L), R: Float32Array.from(s.R), ms: Math.round(performance.now() - t0), hz: a.tailHz || 0, note: a.tailHz ? D.hzToNote(a.tailHz) : null, peakDb: a.truePeakDb, rmsDb: a.rmsDb };
    self.postMessage(out, [out.L.buffer, out.R.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
