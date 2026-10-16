#!/usr/bin/env node
/* HARMONY · importador de Discogs
   Segunda fuente, para lo que MusicBrainz no tiene: la mákina, el newstyle y casi todo lo que salió
   solo en vinilo en España. Para cada registro elige la edición original en Discogs y escribe:
     js/data/dc.js        sello, n.º de catálogo, formato, país, fecha, caras del disco y vídeos de cada corte
     tools/dc-report.md   qué se ha emparejado, con qué seguridad, qué choca con otras fuentes y qué revisar
   La portada (imagen principal de la edición) se baja a art/dc-<id>.jpg, igual que las de Cover Art Archive.
   Cada respuesta se guarda en tools/cache/: repetir no vuelve a pedir nada.

   Token: la búsqueda de Discogs exige un token personal (gratis). Créalo en
   https://www.discogs.com/settings/developers → «Generate new token» y pásalo con --token o DISCOGS_TOKEN.
   No se guarda en ningún archivo ni entra en la caché. Sin token solo se importan los registros fijados
   a mano y los que MusicBrainz ya enlaza con Discogs.

   Uso (Node 18 o superior, sin dependencias):
     DISCOGS_TOKEN=xxxx node tools/dc-import.mjs
     node tools/dc-import.mjs --token xxxx --only anonim-vol-3,anonim-4
     node tools/dc-import.mjs --refresh                ignora la caché
     node tools/dc-import.mjs --offline                solo caché, sin red
     node tools/dc-import.mjs --no-art                 no descarga portadas
   En PowerShell:  $env:DISCOGS_TOKEN="xxxx"; node tools/dc-import.mjs

   Corregir un emparejado (en catalog.js, dentro de T(...)):
     dc: { release: 597824 }     usar esa edición (el número de discogs.com/release/…)
     dc: { master: 3294907 }     usar la edición principal de ese master
     dc: { q: '…' }              buscar con otros términos
     dc: { skip: true }          no buscar este registro

   Política: se aplica lo fijado a mano, lo que enlaza MusicBrainz y lo de confianza alta (título exacto y
   artista principal, fuera de recopilatorios). MusicBrainz manda: si Discogs da otro año para un registro
   ya contrastado allí, no se aplica y queda en el informe. Las demás diferencias se marcan en la ficha.

   Condiciones de la API de Discogs: datos con atribución a Discogs; las imágenes son de sus autores. */

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { ROOT, loadCatalog, makeClient, norm, titleScore, baseTitle, artistMatch, yearOf } from './mb-import.mjs';

const DC = 'https://api.discogs.com/';
const WEB = 'https://www.discogs.com/';
const LEVEL = { 3: 'alta', 2: 'media', 1: 'baja', 0: '—' };

/* ---------------------------------------------------------------- datos */

function loadLayer(root, file, key) {
  const p = join(root, file);
  if (!existsSync(p)) return {};
  const sb = { window: {} }; vm.createContext(sb);
  vm.runInContext(readFileSync(p, 'utf8'), sb);
  return (sb.window.H && sb.window.H.data && sb.window.H.data[key] && sb.window.H.data[key].records) || {};
}

/* El token va en una cabecera, nunca en la URL: así no acaba en la caché ni en el informe. */
export function discogsFetch(fetchImpl = globalThis.fetch, token = '') {
  return (url, opts = {}) => {
    if (!token || !String(url).startsWith(DC)) return fetchImpl(url, opts);
    return fetchImpl(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Discogs token=' + token } });
  };
}

/* ------------------------------------------------------------ lectura */

/* Discogs numera los homónimos («Cyberia (4)») y marca con * los nombres de variación */
export const cleanName = (s) => String(s || '').replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim();
export function artistLine(artists = []) {
  return artists.map((a, i) => cleanName(a.anv || a.name) + (i < artists.length - 1 ? (a.join && a.join !== ',' ? ' ' + a.join + ' ' : a.join === ',' ? ', ' : ' & ') : '')).join('').replace(/\s+/g, ' ').trim();
}
const credit = (artists = []) => artists.map((a) => ({ name: cleanName(a.anv || a.name), artist: { name: cleanName(a.name) }, joinphrase: ' ' + (a.join || '') + ' ' }));

/* «1997-11-17» se queda; «1998-00-00» → «1998» */
export const cleanDate = (d) => (d ? String(d).replace(/(-00)+$/, '') || null : null);

const SIZE = /^(\d+(?:\.\d+)?)"$/;
/* Formatos de Discogs en el mismo estilo que el archivo: «Vinilo 12″», «CD», «Digital» */
export function fmtES(formats = []) {
  return formats.map((f) => {
    const n = Number(f.qty) > 1 ? f.qty + '×' : '';
    const d = f.descriptions || [];
    if (f.name === 'Vinyl') {
      const size = d.map((x) => SIZE.exec(x)).find(Boolean);
      return 'Vinilo ' + n + (size ? size[1] + '″' : d.includes('LP') ? 'LP' : '').trim();
    }
    if (f.name === 'File') return 'Digital';
    if (f.name === 'Cassette') return n + 'Casete';
    if (f.name === 'CDr') return n + 'CD-R';
    return n + f.name;
  }).map((s) => s.trim()).filter(Boolean);
}
export function typeES(formats = []) {
  const d = formats.flatMap((f) => f.descriptions || []);
  if (d.includes('Compilation')) return 'Recopilatorio';
  if (d.includes('Maxi-Single')) return 'Maxisingle';
  if (d.includes('EP')) return 'EP';
  if (d.includes('Single')) return 'Single';
  if (d.includes('LP') || d.includes('Album')) return 'Álbum';
  return null;
}
const isCompilation = (rel) => typeES(rel.formats) === 'Recopilatorio' || (rel.artists || []).some((a) => /^various$/i.test(cleanName(a.name)));
const isVinyl = (formats = []) => formats.some((f) => f.name === 'Vinyl');

const secs = (d) => { const m = /^(\d+):(\d\d)$/.exec(String(d || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const versionOf = (s) => [...String(s || '').matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');

/* Vídeos de YouTube que Discogs asocia a la edición: a qué corte corresponde cada uno.
   Un vídeo va con un corte si lleva su título base y, si hay varios cortes con el mismo título base
   («Anonim 3 (Vocal Mix)», «Anonim 3 (Dragon Mix)»…), también las palabras de su versión. Cada vídeo, una vez. */
export function matchVideos(tracks, videos) {
  const out = tracks.map(() => null);
  const used = new Set();
  const GENERIC = new Set(['mix', 'version', 'remix', 'rmx', 'original', 'rmx']);
  // «ANONIM VOL.III (Dragon Mix)» es «Anonim 3 (Dragon Mix)»: fuera «vol.» y números romanos a cifras
  const plain = (s) => (' ' + s + ' ').replace(/ vol(ume|umen)? /g, ' ').replace(/ iii /g, ' 3 ').replace(/ ii /g, ' 2 ').replace(/ iv /g, ' 4 ').replace(/\s+/g, ' ').trim();
  const bases = tracks.map((t) => plain(baseTitle(t.title)));
  const vws = tracks.map((t) => norm(versionOf(t.title)).split(' ').filter((w) => w && !GENERIC.has(w)));
  const pairs = [];
  tracks.forEach((t, i) => {
    const b = bases[i], vw = vws[i];
    if (!b) return;
    const shared = bases.filter((x) => x === b).length > 1;
    videos.forEach((v, j) => {
      const vt = ' ' + plain(norm(v.title)) + ' ';
      if (!vt.includes(' ' + b + ' ')) return;
      const hit = vw.filter((w) => vt.includes(' ' + w + ' ')).length;
      if (shared && vw.length && !hit) return;
      // el vídeo es claramente de otro corte con el mismo título base
      if (!hit && bases.some((x, k) => k !== i && x === b && vws[k].length && vws[k].every((w) => vt.includes(' ' + w + ' ')))) return;
      const dt = secs(t.duration) != null && v.duration ? Math.abs(secs(t.duration) - v.duration) : 60;
      pairs.push({ i, j, score: (vw.length ? hit / vw.length : 0.5) - Math.min(dt, 120) / 600 });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs) if (out[p.i] == null && !used.has(p.j)) { out[p.i] = p.j; used.add(p.j); }
  return out;
}

export function summarizeRelease(rel) {
  const tracks = (rel.tracklist || []).filter((x) => (x.type_ || 'track') === 'track')
    .map((x) => ({ pos: x.position || null, title: x.title, duration: x.duration || null, artist: x.artists && x.artists.length ? artistLine(x.artists) : null }));
  const videos = (rel.videos || []).filter((v) => /youtu/.test(v.uri || '')).map((v) => ({ url: v.uri, title: v.title || '', duration: v.duration || null }));
  const vi = matchVideos(tracks, videos);
  tracks.forEach((x, i) => { x.video = vi[i] == null ? null : videos[vi[i]].url; });
  const img = (rel.images || []).find((i) => i.type === 'primary') || (rel.images || [])[0] || null;
  return {
    id: rel.id, title: rel.title, artist: artistLine(rel.artists), year: rel.year || yearOf(rel.released) || null, released: cleanDate(rel.released),
    country: rel.country || null,
    labels: (rel.labels || []).map((l) => ({ name: cleanName(l.name), catno: l.catno && l.catno !== 'none' ? l.catno : null, id: l.id || null })),
    formats: fmtES(rel.formats), type: typeES(rel.formats), vinyl: isVinyl(rel.formats), compilation: isCompilation(rel),
    styles: rel.styles || [], master: rel.master_id || null,
    url: WEB + 'release/' + rel.id, tracks, videos,
    image: img ? { url: img.uri || img.resource_url, w: img.width || null, h: img.height || null } : null
  };
}

/* ------------------------------------------------------------ emparejado */

export const idFromUrl = (u) => {
  const m = /discogs\.com\/(?:[^/]+\/)?(release|master)\/(\d+)/.exec(String(u || ''));
  return m ? { kind: m[1], id: Number(m[2]) } : null;
};

async function getRelease(client, id) { return client.getUrl(DC + 'releases/' + id); }
async function mainOfMaster(client, id) {
  const m = await client.getUrl(DC + 'masters/' + id);
  return m && m.main_release ? getRelease(client, m.main_release) : null;
}

/* Nivel de un candidato: 3 = título exacto (o el corte está en el disco) y artista principal */
export function rateRelease(rel, q, { tema = false } = {}) {
  const a = q.various ? { primary: isCompilation(rel), missing: [] } : artistMatch(q.artists, credit(rel.artists));
  let title = titleScore(q.title, rel.title);
  if (tema) {
    const inTracks = Math.max(0, ...(rel.tracklist || []).filter((x) => (x.type_ || 'track') === 'track').map((x) => {
      const s = titleScore(q.title, x.title);
      return s >= 0.92 ? 1 : s;   // «Poing (Original Mix)» es el corte «Poing»
    }));
    title = Math.max(title, inTracks);
  }
  let level = 0;
  if (a.primary && title >= 0.75) level = 1;
  if (a.primary && title >= 0.9) level = 2;
  if (a.primary && title === 1) level = 3;
  return { level, title, missing: a.missing || [] };
}

async function searchCandidates(client, t, q, pin) {
  const tema = t.kind === 'tema';
  const base = { type: 'release', per_page: '25' };
  const tries = pin.q ? [{ ...base, q: pin.q }]
    : [{ ...base, ...(q.various ? {} : { artist: q.artists[0] }), [tema ? 'track' : 'release_title']: q.title },
       { ...base, q: (q.various ? '' : q.artists[0] + ' ') + q.title }];
  const seen = new Map();
  for (const p of tries) {
    const r = await client.getUrl(DC + 'database/search?' + new URLSearchParams(p));
    for (const x of (r && r.results) || []) if (!seen.has(x.id)) seen.set(x.id, x);
    if (seen.size >= 5) break;
  }
  // los más antiguos primero, y en vinilo antes que en otro formato: buscamos la edición original
  return [...seen.values()].sort((a, b) => (Number(a.year) || 9999) - (Number(b.year) || 9999)
    || ((b.format || []).includes('Vinyl') - (a.format || []).includes('Vinyl')));
}

export async function importRecord(t, artistsById, ctx) {
  const { client, mb, token } = ctx;
  const pin = t.dc || {};
  if (pin.skip) return { status: 'skipped', pinned: true, apply: false };
  const names = t.artists[0] === 'various' ? [] : t.artists.map((id) => artistsById[id]?.name).filter(Boolean);
  const q = { title: t.title, artists: names, various: t.artists[0] === 'various' };
  const notes = [];
  const M = mb[t.id] && mb[t.id].status === 'matched' && mb[t.id].apply ? mb[t.id] : null;
  const mbYear = M ? M.year : null;
  const done = (rel, o) => {
    const R = summarizeRelease(rel);
    const r = rateRelease(rel, q, { tema: t.kind === 'tema' });
    if (r.missing.length) notes.push('Discogs no acredita a ' + r.missing.join(', ') + '.');
    if (R.compilation) notes.push('Es un recopilatorio, no la edición original del registro.');
    if (!R.vinyl && R.formats.length) notes.push('Esta edición no es en vinilo (' + R.formats.join(' + ') + ').');
    return { kind: 'release', status: 'matched', release: R, notes, ...o };
  };

  // 1) fijado a mano
  if (pin.release || pin.master) {
    const rel = pin.release ? await getRelease(client, pin.release) : await mainOfMaster(client, pin.master);
    if (!rel) return { status: 'error', error: 'No existe en Discogs: ' + (pin.release ? 'release ' + pin.release : 'master ' + pin.master) };
    notes.push('Edición fijada a mano en el catálogo.');
    return done(rel, { apply: true, level: 3, confidence: 'fijada', pinned: true, via: 'catálogo' });
  }
  // 2) MusicBrainz ya la enlaza
  const link = M && M.release && M.release.links && M.release.links.discogs ? idFromUrl(M.release.links.discogs.url) : null;
  if (link) {
    const rel = link.kind === 'release' ? await getRelease(client, link.id) : await mainOfMaster(client, link.id);
    if (rel) {
      notes.push(link.kind === 'release' ? 'Misma edición que MusicBrainz (enlace del lanzamiento).' : 'Edición principal del master que enlaza MusicBrainz.');
      return done(rel, { apply: true, level: 3, confidence: 'vía MusicBrainz', pinned: false, via: 'MusicBrainz' });
    }
  }
  // 3) búsqueda (necesita token)
  if (!token) return { status: 'not-searched', apply: false, error: 'Sin token: Discogs no deja buscar.' };
  const cands = await searchCandidates(client, t, q, pin);
  if (!cands.length) return { status: 'not-found', candidates: [] };
  const rated = [];
  for (const c of cands.slice(0, 6)) {
    const rel = await getRelease(client, c.id);
    if (!rel) continue;
    rated.push({ rel, r: rateRelease(rel, q, { tema: t.kind === 'tema' }) });
    if (rated.some((x) => x.r.level === 3 && !isCompilation(x.rel))) break;
  }
  const ok = rated.filter((x) => x.r.level >= 1);
  if (!ok.length) return { status: 'not-found', candidates: cands.slice(0, 3).map((c) => ({ id: c.id, title: c.title, year: c.year || null })) };
  ok.sort((a, b) => (b.r.level - a.r.level) || (isCompilation(a.rel) - isCompilation(b.rel))
    || ((a.rel.year || 9999) - (b.rel.year || 9999)) || (isVinyl(b.rel.formats) - isVinyl(a.rel.formats)));
  const best = ok[0];
  let apply = best.r.level === 3 && !isCompilation(best.rel);
  const year = best.rel.year || yearOf(best.rel.released);
  if (apply && mbYear && year && year !== mbYear) { apply = false; notes.push(`Discogs da ${year} y MusicBrainz ${mbYear}: puede ser otra edición.`); }
  return done(best.rel, {
    apply, level: best.r.level, confidence: LEVEL[best.r.level], pinned: false, via: 'búsqueda',
    alternatives: ok.slice(1, 4).map((x) => ({ id: x.rel.id, title: x.rel.title, artist: artistLine(x.rel.artists), year: x.rel.year || null, formats: fmtES(x.rel.formats) }))
  });
}

/* ------------------------------------------------------------ portadas */

export const artFile = (id) => `art/dc-${id}.jpg`;
/* Solo hace falta la portada de Discogs si Cover Art Archive no tiene la del original (o si la edición se fijó a mano) */
export async function fetchArt(records, { root = ROOT, client, download = true, mb = {}, log = () => {} } = {}) {
  const caa = (id) => { const m = mb[id]; return !!(m && m.status === 'matched' && m.apply && m.release && m.release.art && m.release.art.front); };
  const jobs = Object.entries(records).filter(([id, r]) => r.status === 'matched' && r.apply && r.release && r.release.image && (r.pinned || !caa(id))).map(([, r]) => r);
  for (const r of Object.values(records)) if (r.release && r.release.image && !jobs.includes(r)) delete r.release.image.file;
  if (download && jobs.length) log(`\nPortadas: ${jobs.length} imágenes de Discogs…`);
  let fails = 0;
  for (const r of jobs) {
    const rel = artFile(r.release.id), abs = join(root, rel);
    if (download && r.release.image.url) {
      try { await client.download(r.release.image.url, abs); }
      catch (e) { fails++; log(`    no se pudo bajar la portada de ${r.release.url}: ${e.message}`); }
    }
    if (existsSync(abs)) r.release.image.file = rel; else delete r.release.image.file;
  }
  if (download && jobs.length) log(`  ${jobs.filter((r) => r.release.image.file).length} en art/${fails ? ` · ${fails} sin descargar` : ''}`);
}
export function pruneArt(records, { root = ROOT, log = () => {} } = {}) {
  const dir = join(root, 'art');
  if (!existsSync(dir)) return 0;
  const keep = new Set(Object.values(records).map((r) => r.release && r.release.image && r.release.image.file).filter(Boolean).map((f) => f.replace(/^art\//, '')));
  let n = 0;
  for (const f of readdirSync(dir)) if (/^dc-\d+\.jpg$/.test(f) && !keep.has(f)) { unlinkSync(join(dir, f)); n++; }
  if (n) log(`  ${n} portadas de Discogs que ya no se usan, borradas de art/`);
  return n;
}

/* ---------------------------------------------------------------- salidas */

export function renderDataFile(records, meta) {
  const payload = { version: 1, source: 'Discogs', generatedAt: meta.generatedAt, records };
  return `/* HARMONY · datos contrastados con Discogs: edición original, caras del disco y vídeos.
   Generado por tools/dc-import.mjs${meta.generatedAt ? ' el ' + meta.generatedAt.slice(0, 10) : ''}. No editar a mano: vuelve a ejecutar el importador.
   Para corregir un emparejado, fíjalo en js/data/catalog.js (campo dc) y vuelve a importar ese registro con --only.
   Datos proporcionados por Discogs; las imágenes son de sus autores. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  H.data.dc = ${JSON.stringify(payload, null, 1)};
})();
`;
}

const cell = (s) => String(s ?? '—').replace(/\|/g, '\\|');
const looseName = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
/* Qué cambiaría en la ficha: lo editorial se sustituye, lo contrastado que no coincide se marca */
export function diffRecord(t, r, data) {
  const R = r.release, out = [];
  const lab = t.label ? (data.labels.find((l) => l.id === t.label) || {}).name : null;
  const L0 = (lab && R.labels.find((l) => looseName(lab, l.name))) || R.labels[0];
  const cmp = (field, mine, theirs, same) => {
    if (theirs == null || theirs === '') return;
    if (mine == null || mine === '') out.push(`${field}: — → ${theirs}`);
    else if (!same(mine, theirs)) out.push(`${field}: ${mine} → ${theirs}${t.ok.includes(field) ? ' (**desacuerdo**: se marcará en la ficha)' : ''}`);
  };
  const loose = (a, b) => { const x = norm(a), y = norm(b); return x === y || x.includes(y) || y.includes(x); };
  cmp('year', t.year, R.year, (a, b) => a === b);
  cmp('label', lab, L0 && L0.name, loose);
  cmp('catno', t.catno, L0 && L0.catno, (a, b) => norm(a).replace(/ /g, '') === norm(b).replace(/ /g, ''));
  cmp('format', t.format, R.formats.join(' + '), (a, b) => { const x = norm(a), y = norm(b); return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '); });
  return out;
}

export function renderReport(records, data, meta) {
  const tracks = data.tracks.filter((t) => records[t.id]);
  const by = (fn) => tracks.filter((t) => fn(records[t.id]));
  const applied = by((r) => r.status === 'matched' && r.apply);
  const review = by((r) => r.status === 'matched' && !r.apply);
  const missing = by((r) => r.status === 'not-found');
  const unsearched = by((r) => r.status === 'not-searched');
  const errors = by((r) => r.status === 'error');
  const hmy = (t) => 'HMY·' + String(t.n).padStart(3, '0') + ' ' + t.title;
  const L = [];
  L.push('# Discogs', '');
  L.push(`${meta.generatedAt.slice(0, 16).replace('T', ' ')} UTC · ${tracks.length} registros · ${meta.requests} peticiones nuevas · ${meta.cached} desde caché${meta.downloads ? ` · ${meta.downloads} portadas descargadas` : ''}`, '');
  L.push(`- **Aplicados:** ${applied.length} (${applied.filter((t) => records[t.id].pinned).length} fijados, ${applied.filter((t) => records[t.id].via === 'MusicBrainz').length} vía MusicBrainz)`);
  L.push(`- **Para revisar:** ${review.length}`);
  L.push(`- **Sin encontrar:** ${missing.length}${unsearched.length ? ` · **Sin buscar (falta token):** ${unsearched.length}` : ''}${errors.length ? ` · **Errores:** ${errors.length}` : ''}`, '');
  L.push('## Aplicados', '', '| Registro | Edición en Discogs | Sello · n.º | Formato | Caras · vídeos | Cambios |', '|---|---|---|---|---|---|');
  for (const t of applied) {
    const r = records[t.id], R = r.release, L0 = R.labels[0] || {};
    const d = diffRecord(t, r, data);
    L.push(`| ${cell(hmy(t))} | [${cell(R.artist + ' – ' + R.title)}](${R.url}) · ${R.released || R.year || 's. f.'} · ${R.country || '—'} · ${r.confidence} | ${cell([L0.name, L0.catno].filter(Boolean).join(' · '))} | ${cell(R.formats.join(' + '))} | ${R.tracks.length} · ${R.tracks.filter((x) => x.video).length}/${R.videos.length} | ${cell(d.length ? d.join('; ') : 'sin cambios')}${r.notes.length ? ' · ' + cell(r.notes.join(' ')) : ''} |`);
  }
  if (review.length) {
    L.push('', '## Para revisar', '');
    for (const t of review) {
      const r = records[t.id], R = r.release;
      L.push(`- **${hmy(t)}** — mejor candidato: [${R.artist} – ${R.title}](${R.url}) · ${R.year || 's. f.'} · ${R.formats.join(' + ') || '—'} · confianza ${r.confidence}`);
      for (const n of r.notes) L.push('  - ' + n);
      for (const a of r.alternatives || []) L.push(`  - Otra: [${a.artist} – ${a.title}](${WEB}release/${a.id}) · ${a.year || 's. f.'} · ${a.formats.join(' + ')}`);
      L.push(`  - Si es la buena, fíjala: \`dc: { release: ${R.id} }\`. Si no, busca la original en discogs.com y fija su número, o \`dc: { skip: true }\`.`);
    }
  }
  if (missing.length) {
    L.push('', '## Sin encontrar', '');
    for (const t of missing) {
      const r = records[t.id];
      L.push(`- **${hmy(t)}**`);
      for (const c of r.candidates || []) L.push(`  - Descartado: [${c.title}](${WEB}release/${c.id}) · ${c.year || 's. f.'}`);
      L.push('  - Prueba `dc: { q: \'…\' }` con otros términos o fija la edición con `dc: { release: … }`.');
    }
  }
  if (unsearched.length) L.push('', '## Sin buscar', '', `${unsearched.length} registros sin fijar ni enlazados desde MusicBrainz. Vuelve a ejecutar con un token de Discogs (\`--token\` o \`DISCOGS_TOKEN\`).`);
  if (errors.length) { L.push('', '## Errores', ''); for (const t of errors) L.push(`- **${hmy(t)}** — ${records[t.id].error}`); }
  return L.join('\n') + '\n';
}

/* ------------------------------------------------------------------- main */

export async function run({ root = ROOT, only = null, refresh = false, offline = false, art = true, token = '', contact = '', fetchImpl, minGap, retryBase, log = console.log, write = true } = {}) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('Hace falta Node 18 o superior (fetch global).');
  const data = loadCatalog(root);
  const artistsById = Object.fromEntries(data.artists.map((a) => [a.id, a]));
  // Discogs: 60 peticiones por minuto con token, 25 sin él
  const client = makeClient({ contact, refresh, offline, fetchImpl: discogsFetch(f, token), minGap: minGap ?? (token ? 1100 : 2500), retryBase, log, cacheDir: join(root, 'tools/cache') });
  const mb = loadLayer(root, 'js/data/mb.js', 'mb');
  const unknown = only ? only.filter((id) => !data.tracks.some((t) => t.id === id)) : [];
  if (unknown.length) throw new Error('No existen en el catálogo: ' + unknown.join(', '));
  const list = data.tracks.filter((t) => !only || only.includes(t.id));
  const records = only ? loadLayer(root, 'js/data/dc.js', 'dc') : {};
  if (!token) log('Aviso: sin token de Discogs solo se importan los registros fijados (dc: { release }) y los que enlaza MusicBrainz. Usa --token o DISCOGS_TOKEN.');
  log(`Importando ${list.length} registros desde Discogs…`);
  for (const [i, t] of list.entries()) {
    let r;
    try { r = await importRecord(t, artistsById, { client, mb, token }); }
    catch (e) { r = { status: 'error', error: e.message }; }
    records[t.id] = r;
    log(progressLine(i, list.length, t, r));
  }
  await fetchArt(records, { root, client, download: art && write, mb, log });
  if (!only && write) pruneArt(records, { root, log });
  const meta = { generatedAt: new Date().toISOString(), ...client.stats() };
  const report = renderReport(records, data, meta);
  if (write) {
    writeFileSync(join(root, 'js/data/dc.js'), renderDataFile(records, meta));
    writeFileSync(join(root, 'tools/dc-report.md'), report);
  }
  const vals = Object.values(records);
  log(`\nListo: ${vals.filter((r) => r.apply).length} aplicados · ${vals.filter((r) => r.status === 'matched' && !r.apply).length} para revisar · ${vals.filter((r) => r.status === 'not-found').length} sin encontrar · ${vals.filter((r) => r.status === 'not-searched').length} sin buscar · ${vals.filter((r) => r.status === 'error').length} errores.`);
  log(`Peticiones: ${meta.requests} nuevas, ${meta.cached} desde caché${meta.downloads ? `, ${meta.downloads} portadas descargadas` : ''}.${write ? '\nEscrito: js/data/dc.js y tools/dc-report.md. Ejecuta node build.mjs para regenerar dist/.' : ''}`);
  return { records, report, meta };
}

function progressLine(i, n, t, r) {
  const head = `  ${String(i + 1).padStart(String(n).length)}/${n}  ${t.id.padEnd(26)}`;
  if (r.status === 'matched') {
    const R = r.release, L0 = R.labels[0] || {};
    return `${head}${r.apply ? '✓' : '?'} ${String(r.confidence).padEnd(15)} ${[R.year, [L0.name, L0.catno].filter(Boolean).join(' '), R.formats.join(' + '), R.tracks.length + ' cortes', R.videos.length ? R.videos.length + ' vídeos' : null].filter(Boolean).join(' · ')}`;
  }
  if (r.status === 'not-found') return `${head}✗ sin resultados`;
  if (r.status === 'not-searched') return `${head}· sin buscar`;
  if (r.status === 'skipped') return `${head}– omitido`;
  return `${head}! ${r.error}`;
}

function parseArgs(argv) {
  const o = { only: null, refresh: false, offline: false, art: true, token: process.env.DISCOGS_TOKEN || '', contact: process.env.HARMONY_CONTACT || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--token') o.token = argv[++i];
    else if (a.startsWith('--token=')) o.token = a.slice(8);
    else if (a === '--contact') o.contact = argv[++i];
    else if (a.startsWith('--contact=')) o.contact = a.slice(10);
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--offline') o.offline = true;
    else if (a === '--no-art') o.art = false;
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
