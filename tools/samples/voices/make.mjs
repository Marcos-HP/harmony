#!/usr/bin/env node
/* HARMONY · genera las tomas de voz con eSpeak NG
   Uso:  node tools/samples/voices/make.mjs            genera las que faltan
         node tools/samples/voices/make.mjs --all      las regenera todas
   Necesita espeak-ng en el PATH (o ESPEAK=/ruta/a/espeak-ng). Escribe tools/samples/voices/src/<id>.wav y
   manifest.json con la versión de eSpeak y los parámetros de cada toma. Las tomas que ya no estén en
   sources.mjs se borran. Después: npm run samples. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './sources.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SRC = join(DIR, 'src');
const ESPEAK = process.env.ESPEAK || 'espeak-ng';
const all = process.argv.includes('--all');

let version;
try { const v = execFileSync(ESPEAK, ['--version'], { encoding: 'utf8' }); version = 'eSpeak NG ' + ((/(\d+\.\d+[.\d]*)/.exec(v) || [])[1] || '?'); }
catch { console.error(`No encuentro eSpeak NG (${ESPEAK}). Instálalo o indica la ruta con ESPEAK=…`); process.exit(1); }

mkdirSync(SRC, { recursive: true });
const ids = new Set();
let made = 0;
for (const s of SOURCES) {
  if (ids.has(s.id)) throw new Error('toma repetida: ' + s.id);
  ids.add(s.id);
  const out = join(SRC, s.id + '.wav');
  if (!all && existsSync(out)) continue;
  execFileSync(ESPEAK, ['-v', s.voice, '-p', String(s.pitch), '-s', String(s.speed), '-a', '100', '-w', out, s.text]);
  made++;
}
for (const f of readdirSync(SRC)) if (f.endsWith('.wav') && !ids.has(f.slice(0, -4))) rmSync(join(SRC, f));
writeFileSync(join(DIR, 'manifest.json'), JSON.stringify({ engine: version, license: 'eSpeak NG es software GPL-3.0-or-later; las tomas son lo que genera el programa', sources: SOURCES }, null, 1) + '\n');
console.log(`${made} tomas generadas · ${SOURCES.length} en total · ${version}`);
