#!/usr/bin/env node
/* HARMONY · importador de Deezer (muestras de 30 s)
   Busca cada registro del catálogo en la API pública de Deezer (sin clave) y elige el tema cuya muestra
   de 30 s sonará en el plato y en la mesa. Escribe:
     js/data/dz.js        qué tema de Deezer corresponde a cada registro (solo identificadores, nunca audio)
     tools/dz-report.md   qué se ha emparejado, con qué seguridad y qué hay que revisar
   La URL de la muestra caduca a los pocos minutos: la web la pide a Deezer al darle a play.
   Cada respuesta se guarda en tools/cache/ (la caché del importador de MusicBrainz): repetir no vuelve a pedir nada.

   Verificación: si el registro tiene grabación de MusicBrainz (js/data/mb.js), se piden sus ISRC y se comparan
   con el del tema de Deezer. Si coinciden, es la misma grabación: «verificado».

   Uso (Node 18 o superior, sin dependencias):
     node tools/dz-import.mjs --contact https://github.com/tu-usuario
     node tools/dz-import.mjs --only poing,mentasm     solo esos registros (el resto se conserva)
     node tools/dz-import.mjs --refresh                ignora la caché
     node tools/dz-import.mjs --offline                solo caché, sin red
     node tools/dz-import.mjs --no-isrc                sin consultar ISRC en MusicBrainz

   Corregir un emparejado (en catalog.js, dentro de T(...)):
     dz: { track: 123456 }       usar ese tema de Deezer (el número de deezer.com/track/…)
     dz: { q: '…' }              buscar con otros términos
     dz: { skip: true }          sin muestra

   Política: se aplica lo verificado por ISRC, lo fijado a mano y lo de confianza alta (mismo título y artista
   principal, sin remezclas, fuera de sesiones mezcladas). Una versión extendida o de radio del mismo tema vale:
   es la misma producción. Lo demás queda en el informe para revisar.

   Condiciones de Deezer: uso no comercial y privado; prohibido guardar el audio. Harmony no lo guarda. */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { ROOT, loadCatalog, makeClient, norm, titleScore, artistMatch } from './mb-import.mjs';

const DZ = 'https://api.deezer.com/';
const LEVEL = { 3: 'alta', 2: 'media', 1: 'baja', 0: '—' };
/* Lo que va entre paréntesis (o tras « - ») solo puede llevar estas palabras para ser la misma producción:
   versión extendida, de radio, original, remasterizada… Cualquier otra palabra (un nombre, «Spacefunkmix»,
   «2k12», «Hardcore») es otra versión: «Dominator (Slim Shore Edit)» no es el «Dominator» original. */
const SAME_PRODUCTION = new Set(['original', 'extended', 'radio', 'edit', 'mix', 'version', 'club', 'remaster', 'remastered',
  'single', 'album', '12', 'inch', 'vinyl', 'digital', 'full', 'long', 'short', 'cut', 'video', 'the', 'and']);
const MIXED = /\b(mixed by|mixed|dj mix|continuous|megamix|in the mix|session|sessions)\b/;
const REMIX_ALBUM = /\b(remix|remixes|rmx|mixes|rework|reworks|bootleg|remake|reloaded)\b/;

/* ---------------------------------------------------------------- datos */

function loadExisting(root) {
  const p = join(root, 'js/data/dz.js');
  if (!existsSync(p)) return {};
  const sb = { window: {} }; vm.createContext(sb);
  vm.runInContext(readFileSync(p, 'utf8'), sb);
  return (sb.window.H && sb.window.H.data && sb.window.H.data.dz && sb.window.H.data.dz.records) || {};
}
function loadMB(root) {
  const p = join(root, 'js/data/mb.js');
  if (!existsSync(p)) return {};
  const sb = { window: {} }; vm.createContext(sb);
  vm.runInContext(readFileSync(p, 'utf8'), sb);
  return (sb.window.H && sb.window.H.data && sb.window.H.data.mb && sb.window.H.data.mb.records) || {};
}

/* Deezer responde 200 con {error} cuando algo falla: lo traducimos a códigos HTTP para que la caché
   no guarde errores y el cliente reintente cuando toca (cuota: 50 peticiones cada 5 s). */
export function deezerFetch(fetchImpl = globalThis.fetch) {
  return async (url, opts) => {
    const res = await fetchImpl(url, opts);
    if (!String(url).startsWith(DZ) || !res.ok) return res;
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch (e) { return new Response(text, { status: 502 }); }
    if (body && body.error) {
      const code = body.error.code;
      if (code === 4 || code === 700) return new Response('', { status: 429 });   // cuota o servicio ocupado
      if (code === 800) return new Response('', { status: 404 });                 // no existe
      return new Response(JSON.stringify(body), { status: 400 });
    }
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

/* ------------------------------------------------------------ emparejado */

const credit = (names) => names.filter(Boolean).map((n) => ({ name: n, joinphrase: ' & ' }));
const groupsOf = (s) => [...String(s || '').matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)].map((m) => m[1] ?? m[2])
  .concat((/\s[-–]\s(.+)$/.exec(String(s || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '')) || []).slice(1));
const bare = (s) => String(s || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s[-–]\s.*$/, ' ').replace(/\s+/g, ' ').trim();

/* Palabras de versión que no son de la misma producción. Se ignoran los subtítulos de himno
   («Qlimax Anthem 2007»), los «feat.» y lo que ya está en el título del archivo («U (I Got a Feeling)»). */
export function versionExtras(title, q) {
  const qn = norm(q.title), own = new Set(qn.split(' '));
  const extra = new Set(), groups = [];
  for (const g of new Set(groupsOf(title))) {
    const n = norm(g);
    if (!n || qn.includes(n)) continue;
    if (/\banthem\b/.test(n) || /^(feat|ft|featuring)\b/.test(n)) continue;
    groups.push(g.trim());
    for (const w of n.split(' ')) if (!SAME_PRODUCTION.has(w) && !own.has(w) && !/^(19|20)\d\d$/.test(w)) extra.add(w);
  }
  return { extra: [...extra], groups };
}

export function rateTrack(tr, q) {
  const full = [tr.title || '', tr.title_version && !String(tr.title || '').includes(tr.title_version) ? tr.title_version : ''].join(' ');
  const title = Math.max(titleScore(q.title, tr.title_short || tr.title), titleScore(q.title, bare(tr.title_short || tr.title)));
  const { extra, groups } = versionExtras(full, q);
  const names = [tr.artist && tr.artist.name, ...((tr.contributors || []).map((c) => c.name))];
  const a = artistMatch(q.artists, credit(names));
  const sameProduction = extra.length === 0;
  let level = 0;
  if (a.primary && title >= 0.75) level = 1;
  if (a.primary && title >= 0.9) level = 2;
  if (a.primary && title === 1 && sameProduction) level = 3;
  return { level, title, version: groups.length ? groups.join(' · ') : null, extra, sameProduction, missing: a.missing, all: a.all };
}

const typeRank = (t) => ({ single: 0, ep: 0, album: 1, compile: 2 }[t] ?? 3);

async function searchTracks(client, query) {
  const r = await client.getUrl(DZ + 'search/track?' + new URLSearchParams({ q: query, limit: '25' }));
  return (r && r.data) || [];
}

/* Elige el tema para un registro de tipo «tema» */
async function importTema(t, q, pin, ctx) {
  const { dz, isrcsFor } = ctx;
  const notes = [];
  let cands = [];
  if (pin.track) {
    const tr = await dz.getUrl(DZ + 'track/' + pin.track);
    if (!tr) return { status: 'error', error: 'El tema fijado no existe en Deezer: ' + pin.track };
    cands = [tr];
  } else {
    const queries = pin.q ? [pin.q] : [q.artists[0] + ' ' + q.title, q.title];
    const seen = new Set();
    for (const query of queries) {
      for (const tr of await searchTracks(dz, query)) if (!seen.has(tr.id)) { seen.add(tr.id); cands.push(tr); }
      if (cands.some((c) => rateTrack(c, q).level >= 2)) break;
    }
  }
  let rated = cands.map((tr) => ({ tr, r: rateTrack(tr, q) })).filter((x) => pin.track || x.r.level >= 1);
  if (!rated.length) return { status: 'not-found', candidates: cands.slice(0, 3).map(brief) };
  rated.sort((a, b) => b.r.level - a.r.level || b.r.title - a.r.title || (b.tr.rank || 0) - (a.tr.rank || 0));
  rated = rated.slice(0, 6);
  // detalle de los mejores: ISRC, colaboradores, tipo de álbum y fecha
  const isrcs = await isrcsFor(t.id);
  for (const x of rated) {
    const full = await dz.getUrl(DZ + 'track/' + x.tr.id);
    if (full) { x.tr = { ...x.tr, ...full }; x.r = rateTrack(x.tr, q); }
    const al = x.tr.album && x.tr.album.id ? await dz.getUrl(DZ + 'album/' + x.tr.album.id) : null;
    x.album = al ? { id: al.id, title: al.title, type: al.record_type, date: al.release_date || null, label: al.label || null } : { id: x.tr.album && x.tr.album.id, title: x.tr.album && x.tr.album.title, type: null, date: null, label: null };
    x.mixed = MIXED.test(norm(x.album.title || '')) || MIXED.test(norm(x.tr.title_version || ''));
    x.remixAlbum = REMIX_ALBUM.test(norm(versionExtras(x.album.title || '', q).groups.join(' ')));
    x.verified = !!(isrcs && x.tr.isrc && isrcs.includes(x.tr.isrc));
    x.hasPreview = !!x.tr.preview;
  }
  rated = rated.filter((x) => x.hasPreview || pin.track);
  if (!rated.length) return { status: 'not-found', candidates: cands.slice(0, 3).map(brief), error: 'Ningún candidato tiene muestra' };
  rated.sort((a, b) => (b.verified - a.verified) || (b.r.level - a.r.level) || (a.mixed - b.mixed) || ((a.remixAlbum ? 1 : 0) - (b.remixAlbum ? 1 : 0))
    || (typeRank(a.album.type) - typeRank(b.album.type)) || String(a.album.date || '9999').localeCompare(String(b.album.date || '9999'))
    || ((b.tr.rank || 0) - (a.tr.rank || 0)));
  const best = rated[0];
  const level = best.verified ? 3 : best.remixAlbum ? Math.min(best.r.level, 2) : best.r.level;
  const apply = !!pin.track || best.verified || (level === 3 && !best.mixed);
  if (best.verified) notes.push('Misma grabación que MusicBrainz (ISRC ' + best.tr.isrc + ').');
  else if (isrcs && isrcs.length) notes.push('MusicBrainz tiene ISRC de esta grabación, pero ninguno coincide con el de Deezer: puede ser otra versión.');
  if (pin.track) notes.push('Elegida a mano en el catálogo.');
  if (best.r.version) notes.push('Versión en Deezer: «' + best.r.version + '»' + (best.r.sameProduction ? '.' : ': es otra versión, no la original.'));
  if (best.remixAlbum && !best.verified) notes.push('Sale de un lanzamiento de remezclas: «' + best.album.title + '».');
  if (best.r.missing.length) notes.push('Deezer no acredita a ' + best.r.missing.join(', ') + '.');
  if (best.mixed) notes.push('Solo aparece en una sesión mezclada: la muestra puede llevar otros temas encima.');
  if (best.album.type === 'compile') notes.push('Muestra tomada de un recopilatorio: «' + best.album.title + '».');
  return {
    kind: 'track', status: 'matched', apply, level, confidence: best.verified ? 'verificada' : pin.track ? 'fijada' : LEVEL[level], verified: best.verified, pinned: !!pin.track,
    track: summarize(best), notes,
    alternatives: rated.slice(1, 4).map((x) => ({ ...brief(x.tr), album: x.album.title, type: x.album.type, verified: x.verified }))
  };
}

/* EP, álbum, recopilatorio o lanzamiento: busca el álbum y toma su primer corte (o el que se llame como el registro) */
async function importRelease(t, q, pin, ctx) {
  const { dz } = ctx;
  if (pin.track) return importTema(t, q, pin, ctx);
  const query = pin.q || (t.artists[0] === 'various' ? q.title : q.artists[0] + ' ' + q.title);
  const r = await dz.getUrl(DZ + 'search/album?' + new URLSearchParams({ q: query, limit: '25' }));
  const albums = (r && r.data) || [];
  const scored = albums.map((al) => {
    const ex = versionExtras(al.title, q);
    const title = Math.max(titleScore(q.title, al.title), ex.extra.length ? 0 : titleScore(q.title, bare(al.title)));
    const a = t.artists[0] === 'various' ? { primary: true } : artistMatch(q.artists, credit([al.artist && al.artist.name]));
    return { al, title, level: a.primary ? (title === 1 ? 3 : title >= 0.9 ? 2 : title >= 0.75 ? 1 : 0) : 0 };
  }).filter((x) => x.level >= 1).sort((a, b) => b.level - a.level || b.title - a.title);
  if (!scored.length) return { status: 'not-found', candidates: albums.slice(0, 3).map((al) => ({ id: al.id, title: al.title, artist: al.artist && al.artist.name })) };
  const best = scored[0];
  const al = await dz.getUrl(DZ + 'album/' + best.al.id);
  const tracks = (al && al.tracks && al.tracks.data) || [];
  if (!tracks.length) return { status: 'not-found', error: 'El álbum no tiene temas' };
  const named = tracks.find((tr) => titleScore(q.title, tr.title_short || tr.title) === 1);
  const pick = named || tracks.find((tr) => tr.preview) || tracks[0];
  const full = await dz.getUrl(DZ + 'track/' + pick.id);
  const x = { tr: { ...pick, ...(full || {}) }, album: { id: al.id, title: al.title, type: al.record_type, date: al.release_date || null, label: al.label || null } };
  const level = best.level;
  return {
    kind: 'release', status: 'matched', apply: level === 3, level, confidence: LEVEL[level], verified: false, pinned: false,
    track: summarize(x), notes: [named ? 'Tema del mismo nombre que el lanzamiento.' : `Primer corte del lanzamiento: «${pick.title}».`],
    alternatives: scored.slice(1, 4).map((s) => ({ id: s.al.id, title: s.al.title, artist: s.al.artist && s.al.artist.name }))
  };
}

const brief = (tr) => ({ id: tr.id, title: tr.title, artist: tr.artist && tr.artist.name, album: tr.album && tr.album.title });
function summarize(x) {
  const tr = x.tr;
  return {
    id: tr.id, title: tr.title_short || tr.title, version: tr.title_version || null, artist: tr.artist && tr.artist.name,
    album: x.album.title, albumId: x.album.id, albumType: x.album.type, released: x.album.date, label: x.album.label,
    duration: tr.duration || null, isrc: tr.isrc || null, link: 'https://www.deezer.com/track/' + tr.id
  };
}

export async function importRecord(t, artistsById, ctx) {
  const pin = t.dz || {};
  if (pin.skip) return { status: 'skipped', pinned: true, apply: false };
  const names = t.artists[0] === 'various' ? ['Various Artists'] : t.artists.map((id) => artistsById[id]?.name).filter(Boolean);
  const q = { title: t.title, artists: names };
  return t.kind === 'tema' ? importTema(t, q, pin, ctx) : importRelease(t, q, pin, ctx);
}

/* ---------------------------------------------------------------- salidas */

export function renderDataFile(records, meta) {
  const payload = { version: 1, source: 'Deezer', generatedAt: meta.generatedAt, records };
  return `/* HARMONY · muestras de 30 s de Deezer: qué tema de Deezer corresponde a cada registro.
   Generado por tools/dz-import.mjs${meta.generatedAt ? ' el ' + meta.generatedAt.slice(0, 10) : ''}. No editar a mano: vuelve a ejecutar el importador.
   Solo identificadores: el audio no se guarda nunca; la web pide la muestra a Deezer al darle a play.
   Para corregir un emparejado, fíjalo en js/data/catalog.js (campo dz) y vuelve a importar ese registro con --only. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  H.data.dz = ${JSON.stringify(payload, null, 1)};
})();
`;
}

const cell = (s) => String(s ?? '—').replace(/\|/g, '\\|');
export function renderReport(records, data, meta) {
  const tracks = data.tracks.filter((t) => records[t.id]);
  const by = (fn) => tracks.filter((t) => fn(records[t.id]));
  const applied = by((r) => r.status === 'matched' && r.apply);
  const review = by((r) => r.status === 'matched' && !r.apply);
  const missing = by((r) => r.status === 'not-found');
  const errors = by((r) => r.status === 'error');
  const hmy = (t) => 'HMY·' + String(t.n).padStart(3, '0') + ' ' + t.title;
  const L = [];
  L.push('# Muestras de Deezer', '');
  L.push(`${meta.generatedAt.slice(0, 16).replace('T', ' ')} UTC · ${tracks.length} registros · ${meta.requests} peticiones nuevas · ${meta.cached} desde caché`, '');
  L.push(`- **Con muestra:** ${applied.length} (${applied.filter((t) => records[t.id].verified).length} verificadas por ISRC)`);
  L.push(`- **Para revisar:** ${review.length}`);
  L.push(`- **Sin encontrar:** ${missing.length}${errors.length ? ` · **Errores:** ${errors.length}` : ''}`, '');
  L.push('## Con muestra', '', '| Registro | Tema en Deezer | Álbum | Seguridad | Notas |', '|---|---|---|---|---|');
  for (const t of applied) {
    const r = records[t.id], k = r.track;
    L.push(`| ${cell(hmy(t))} | [${cell(k.title + (k.version ? ' ' + k.version : ''))}](${k.link}) · ${cell(k.artist)} | ${cell(k.album)}${k.albumType ? ' (' + k.albumType + ')' : ''} | ${r.confidence}${r.pinned ? ' · fijado' : ''} | ${cell(r.notes.join(' '))} |`);
  }
  if (review.length) {
    L.push('', '## Para revisar', '');
    for (const t of review) {
      const r = records[t.id], k = r.track;
      L.push(`- **${hmy(t)}** — mejor candidato: [${k.title}${k.version ? ' ' + k.version : ''}](${k.link}) · ${k.artist} · «${k.album}» · confianza ${r.confidence}`);
      for (const n of r.notes) L.push('  - ' + n);
      L.push(`  - Si es el bueno, fíjalo: \`dz: { track: ${k.id} }\`. Si no, busca otro en deezer.com y fija su número, o \`dz: { skip: true }\`.`);
    }
  }
  if (missing.length) {
    L.push('', '## Sin encontrar', '');
    for (const t of missing) {
      const r = records[t.id];
      L.push(`- **${hmy(t)}**${r.error ? ' — ' + r.error : ''}`);
      for (const c of r.candidates || []) L.push(`  - Descartado: ${c.title} · ${c.artist || '—'}${c.album ? ' · «' + c.album + '»' : ''}`);
      L.push('  - Prueba `dz: { q: \'…\' }` con otros términos o fija el tema con `dz: { track: … }`.');
    }
  }
  if (errors.length) { L.push('', '## Errores', ''); for (const t of errors) L.push(`- **${hmy(t)}** — ${records[t.id].error}`); }
  return L.join('\n') + '\n';
}

/* ------------------------------------------------------------------- main */

export async function run({ root = ROOT, only = null, refresh = false, offline = false, isrc = true, contact = '', fetchImpl, minGap, mbGap, retryBase, log = console.log, write = true } = {}) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('Hace falta Node 18 o superior (fetch global).');
  const data = loadCatalog(root);
  const artistsById = Object.fromEntries(data.artists.map((a) => [a.id, a]));
  const cacheDir = join(root, 'tools/cache');
  const dz = makeClient({ contact, refresh, offline, fetchImpl: deezerFetch(f), minGap: minGap ?? 130, retryBase, log, cacheDir });
  const mbc = makeClient({ contact, refresh: false, offline, fetchImpl: f, minGap: mbGap ?? 1100, retryBase, log, cacheDir });
  const mb = loadMB(root);
  const isrcsFor = async (id) => {
    const rec = mb[id];
    if (!isrc || !rec || !rec.apply || !rec.recording) return null;
    try { const r = await mbc.get('recording/' + rec.recording.id, { inc: 'isrcs' }); return (r && r.isrcs) || []; }
    catch (e) { return null; }
  };
  const unknown = only ? only.filter((id) => !data.tracks.some((t) => t.id === id)) : [];
  if (unknown.length) throw new Error('No existen en el catálogo: ' + unknown.join(', '));
  const list = data.tracks.filter((t) => !only || only.includes(t.id));
  const records = only ? loadExisting(root) : {};
  if (isrc && !contact) log('Aviso: para consultar ISRC en MusicBrainz conviene un contacto (--contact). Sin él, va más lento o falla.');
  log(`Buscando ${list.length} registros en Deezer…`);
  for (const [i, t] of list.entries()) {
    let r;
    try { r = await importRecord(t, artistsById, { dz, isrcsFor }); }
    catch (e) { r = { status: 'error', error: e.message }; }
    records[t.id] = r;
    log(progressLine(i, list.length, t, r));
  }
  const s1 = dz.stats(), s2 = mbc.stats();
  const meta = { generatedAt: new Date().toISOString(), requests: s1.requests + s2.requests, cached: s1.cached + s2.cached };
  const report = renderReport(records, data, meta);
  if (write) {
    writeFileSync(join(root, 'js/data/dz.js'), renderDataFile(records, meta));
    writeFileSync(join(root, 'tools/dz-report.md'), report);
  }
  const vals = Object.values(records);
  log(`\nListo: ${vals.filter((r) => r.apply).length} con muestra (${vals.filter((r) => r.apply && r.verified).length} verificadas) · ${vals.filter((r) => r.status === 'matched' && !r.apply).length} para revisar · ${vals.filter((r) => r.status === 'not-found').length} sin encontrar · ${vals.filter((r) => r.status === 'error').length} errores.`);
  log(`Peticiones: ${meta.requests} nuevas, ${meta.cached} desde caché.${write ? '\nEscrito: js/data/dz.js y tools/dz-report.md. Ejecuta node build.mjs para regenerar dist/.' : ''}`);
  return { records, report, meta };
}

function progressLine(i, n, t, r) {
  const head = `[${String(i + 1).padStart(3)}/${n}] ${t.id.padEnd(24)} `;
  if (r.status === 'matched') return `${head}${r.apply ? '✓' : '?'} ${String(r.confidence).padEnd(10)} ${r.track.artist} — ${r.track.title}${r.track.version ? ' ' + r.track.version : ''} [${r.track.album}]`;
  if (r.status === 'not-found') return `${head}✗ sin resultados`;
  if (r.status === 'skipped') return `${head}– omitido`;
  return `${head}! ${r.error}`;
}

function parseArgs(argv) {
  const o = { only: null, refresh: false, offline: false, isrc: true, contact: process.env.HARMONY_CONTACT || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--contact') o.contact = argv[++i];
    else if (a.startsWith('--contact=')) o.contact = a.slice(10);
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--offline') o.offline = true;
    else if (a === '--no-isrc') o.isrc = false;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('Opción desconocida: ' + a);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exit(2); }
  if (opts.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\s?/, ''));
    process.exit(0);
  }
  run(opts).catch((e) => { console.error('Error: ' + e.message); process.exit(1); });
}
