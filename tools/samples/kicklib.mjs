/* Los kicks de la biblioteca que salen del Laboratorio de kicks: lee js/data/kicks.js (lo mismo que usa la web) y
   los calcula con el motor de hard.mjs. kick(id) → { render, lab } para el catálogo de un pack. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as K from './hard.mjs';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../../js/data/kicks.js', import.meta.url), 'utf8'), ctx);
export const KICKS = ctx.window.H.data.kicks;

export function labParams(id) {
  const p = KICKS.lib(id);
  if (!p) throw new Error('No hay receta de laboratorio para ' + id);
  return JSON.parse(JSON.stringify(p));
}
/* render: el kick del laboratorio (y, si se da, lo que se ponga encima); lab: los ajustes para abrirlo en el laboratorio */
export function labKick(id, layer = null) {
  const lab = labParams(id);
  return { render: () => (layer ? layer(K.labSound(lab)) : K.labSound(lab)), lab };
}
