#!/usr/bin/env node
/* HARMONY · construye los packs de samples originales
   Para cada pack de tools/samples/packs/*.mjs: sintetiza cada sonido, lo valida y escribe
     samples/<pack>/<id>.wav     el audio (PCM 16 bits, 44,1 kHz; mono o estéreo), servido tal cual por la web
     js/data/samples.js          catálogo con los metadatos (la web lo carga como el resto de datos)
     tools/samples/report.md     medidas de cada sonido y avisos
   Todo es determinista: la misma receta da los mismos archivos.

   Uso:  node tools/samples/build.mjs            construye todo
         node tools/samples/build.mjs --only harmony-01/hc-kick-gabber,harmony-01/clap-room
         node tools/samples/build.mjs --check    no escribe: comprueba que lo construido coincide con lo guardado */
import { readdirSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as D from './dsp.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKS = join(ROOT, 'tools/samples/packs');

/* Reglas de calidad: lo que no las cumple no se publica */
export function validate(s, a) {
  const err = [], warn = [];
  if (a.clipped > 0) err.push(`${a.clipped} muestras recortadas`);
  if (a.truePeakDb > -0.8) err.push(`pico real ${a.truePeakDb.toFixed(2)} dBTP (máx. −0,8)`);
  if (a.truePeakDb < -1.5) warn.push(`pico bajo: ${a.truePeakDb.toFixed(2)} dBTP`);
  if (a.dc > 0.01) err.push(`energía por debajo de 10 Hz: ${(a.dc * 100).toFixed(1)} % (continua o infrasonidos)`);
  if (a.endAbs > 0.002) err.push(`el final no llega a cero (${a.endAbs.toFixed(4)}): haría clic`);
  if (a.startAbs > 0.05) err.push(`empieza de golpe (${a.startAbs.toFixed(3)})`);
  if (a.duration < 0.03 || a.duration > 8) err.push(`duración ${a.duration.toFixed(2)} s fuera de 0,03–8 s`);
  if (s.cat === 'kick' && s.type === 'kick' && a.bands.sub + a.bands.low < 0.25) warn.push('kick con pocos graves');
  if (s.key && /kick|bajo/.test(s.type)) {
    const got = D.hzToNote(a.tailHz);
    if (got !== s.key) {
      const semis = (n) => { const m = /^([A-G]#?)(-?\d)$/.exec(n); return m ? D.NOTE[m[1]] + 12 * +m[2] : null; };
      const d = got && semis(got) != null ? Math.abs(semis(got) - semis(s.key)) : 99;
      (d > 1 ? err : warn).push(`afinación: se mide ${got || '—'} (${a.tailHz.toFixed(1)} Hz) y se anuncia ${s.key}`);
    }
  }
  return { err, warn };
}

export async function loadPacks(only = null) {
  const out = [];
  for (const f of readdirSync(PACKS).filter((x) => x.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(join(PACKS, f)).href);
    const samples = mod.SAMPLES.filter((s) => !only || only.includes(mod.PACK.id + '/' + s.id));
    out.push({ pack: mod.PACK, samples, all: mod.SAMPLES });
  }
  return out;
}

const r2 = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

export async function build({ only = null, check = false, log = console.log } = {}) {
  const packs = await loadPacks(only);
  const catalog = [], report = ['# Samples de Harmony', '', `Construido el ${new Date().toISOString().slice(0, 10)} con tools/samples/build.mjs. Medidas sobre el archivo final (16 bits, 44,1 kHz).`, ''];
  let errors = 0, mismatches = 0;
  for (const { pack, samples, all } of packs) {
    const ids = new Set();
    for (const s of all) { if (ids.has(s.id)) throw new Error(`id repetido en ${pack.id}: ${s.id}`); ids.add(s.id); if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) throw new Error('id no válido: ' + s.id); }
    const dir = join(ROOT, 'samples', pack.id);
    if (!check) mkdirSync(dir, { recursive: true });
    const metas = [];
    report.push(`## ${pack.name} · ${pack.title}`, '', `Licencia: ${pack.licenseName}. ${pack.origin}`, '', '| Sonido | Estilo · tipo | Dur. | Canales | Pico real | RMS | Centroide | Nota medida | Avisos |', '|---|---|---|---|---|---|---|---|---|');
    for (const s of all) {
      const file = `samples/${pack.id}/${s.id}.wav`, abs = join(ROOT, file);
      let meta;
      if (samples.includes(s)) {
        const t0 = Date.now();
        const audio = s.render();
        const bytes = D.wav(audio, D.rng(s.id.length * 977)() * 1e9 | 0);
        // se valida lo que de verdad se publica: el WAV ya cuantizado a 16 bits
        const w = D.readWav(bytes), aud = w.channels === 2 ? D.stereo(w.chans[0], w.chans[1]) : w.chans[0];
        const a = D.analyze(aud), v = validate(s, a);
        if (process.env.HMY_DEBUG) log('      infra', (a.dc * 100).toFixed(2) + ' %');
        if (v.err.length) { errors++; log(`  ✗ ${pack.id}/${s.id}: ${v.err.join('; ')}`); }
        else log(`  ✓ ${pack.id}/${s.id}  ${a.duration.toFixed(2)} s · ${w.channels === 2 ? 'estéreo' : 'mono'} · pico ${a.peakDb.toFixed(1)} dBFS / ${a.truePeakDb.toFixed(1)} dBTP · RMS ${a.rmsDb.toFixed(1)} dB${a.tailHz ? ' · ' + D.hzToNote(a.tailHz) : ''}${v.warn.length ? ' · ' + v.warn.join('; ') : ''}  (${Date.now() - t0} ms)`);
        if (check) {
          if (!existsSync(abs)) { mismatches++; log('    falta el archivo'); }
          else {
            const old = D.readWav(readFileSync(abs));
            let diff = old.frames === w.frames && old.channels === w.channels ? 0 : Infinity;
            if (isFinite(diff)) for (let c = 0; c < w.channels; c++) for (let i = 0; i < w.frames; i++) diff = Math.max(diff, Math.abs(old.chans[c][i] - w.chans[c][i]));
            if (diff > 3 / 32768) { mismatches++; log(`    distinto de lo guardado (diferencia ${isFinite(diff) ? (diff * 32768).toFixed(0) + ' LSB' : 'de tamaño'})`); }
          }
        } else if (!v.err.length) writeFileSync(abs, bytes);
        meta = {
          id: pack.id + '/' + s.id, slug: s.id, name: s.name, style: s.style, type: s.type, cat: s.cat, tags: s.tags,
          key: s.key || null, bpm: s.bpm || null, duration: r2(a.duration, 3), channels: w.channels, bytes: bytes.length, file,
          notes: s.notes, peakDb: r2(a.peakDb, 1), truePeakDb: r2(a.truePeakDb, 1), rmsDb: r2(a.rmsDb, 1), centroid: Math.round(a.centroid)
        };
        report.push(`| ${s.name} \`${s.id}\` | ${s.style} · ${s.type} | ${a.duration.toFixed(2)} s | ${w.channels} | ${a.truePeakDb.toFixed(1)} dBTP | ${a.rmsDb.toFixed(1)} dB | ${Math.round(a.centroid)} Hz | ${a.tailHz && /kick|bajo/.test(s.type) ? D.hzToNote(a.tailHz) + ' (' + a.tailHz.toFixed(0) + ' Hz)' : '—'} | ${[...v.err, ...v.warn].join('; ') || '—'} |`);
      } else {
        // con --only, los demás se describen a partir del archivo que ya existe
        if (!existsSync(abs)) continue;
        const w = D.readWav(readFileSync(abs)), aud = w.channels === 2 ? D.stereo(w.chans[0], w.chans[1]) : w.chans[0], a = D.analyze(aud);
        meta = { id: pack.id + '/' + s.id, slug: s.id, name: s.name, style: s.style, type: s.type, cat: s.cat, tags: s.tags, key: s.key || null, bpm: s.bpm || null, duration: r2(a.duration, 3), channels: w.channels, bytes: readFileSync(abs).length, file, notes: s.notes, peakDb: r2(a.peakDb, 1), rmsDb: r2(a.rmsDb, 1), centroid: Math.round(a.centroid) };
      }
      metas.push(meta);
    }
    report.push('');
    const { render, ...p } = pack;
    catalog.push({ ...p, count: metas.length, bytes: metas.reduce((n, m) => n + m.bytes, 0), samples: metas });
  }
  if (!check) {
    writeFileSync(join(ROOT, 'js/data/samples.js'), `/* HARMONY · samples originales (packs de tools/samples/packs/).
   Generado por tools/samples/build.mjs. No editar a mano: cambia la receta y vuelve a construir.
   El audio está en samples/<pack>/<id>.wav y se sirve con la web; aquí solo van los metadatos. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  H.data.samples = ${JSON.stringify({ version: 1, packs: catalog }, null, 1)};
})();
`);
    writeFileSync(join(ROOT, 'tools/samples/report.md'), report.join('\n') + '\n');
  }
  const total = catalog.reduce((n, p) => n + p.count, 0), mb = catalog.reduce((n, p) => n + p.bytes, 0) / 1048576;
  log(`\n${total} sonidos · ${mb.toFixed(2)} MB${errors ? ` · ${errors} con errores (no se han escrito)` : ''}${check ? ` · ${mismatches} distintos de lo guardado` : ''}`);
  return { catalog, errors, mismatches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1].split(',') : null;
  build({ only, check: args.includes('--check') }).then((r) => process.exit(r.errors || r.mismatches ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}
