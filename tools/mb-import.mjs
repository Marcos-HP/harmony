#!/usr/bin/env node
/* HARMONY · importador de MusicBrainz
   Lee el catálogo editorial (js/data/catalog.js), busca cada registro en MusicBrainz, elige la grabación
   y el lanzamiento original, y escribe:
     js/data/mb.js        capa de datos contrastados que la web fusiona al arrancar
     tools/mb-report.md   qué se ha encontrado, qué cambia respecto a lo editorial y qué hay que revisar
   Cada respuesta se guarda en tools/cache/: repetir la importación no vuelve a pedir nada.

   Diseño real de los discos: para cada lanzamiento aplicado, consulta Cover Art Archive y descarga a art/
   la portada y, si hay foto de ella, la galleta del vinilo (500 px). La web las muestra tal cual, en color.
   Quedan en local porque la web publicada no puede cargar imágenes de otros servidores.

   Uso (Node 18 o superior, sin dependencias):
     node tools/mb-import.mjs --contact tu@correo.com
     node tools/mb-import.mjs --only poing,mentasm     solo esos registros (el resto se conserva)
     node tools/mb-import.mjs --refresh                ignora la caché
     node tools/mb-import.mjs --offline                solo caché, sin red
     node tools/mb-import.mjs --no-art                 no descarga imágenes

   Corregir un emparejado (en catalog.js, dentro de T(...)):
     mb: { recording: '<mbid>' }        usar esa grabación
     mb: { release: '<mbid>' }          usar ese lanzamiento como edición original
     mb: { releaseGroup: '<mbid>' }     (EP, álbum, recopilatorio) usar ese grupo
     mb: { title: '…', artist: '…' }   buscar con otros términos
     mb: { skip: true }                 no buscar este registro

   Política: solo se aplican los emparejados de confianza alta (título exacto, artista principal,
   sin remezclas ni ediciones) o fijados a mano. El resto queda en el informe para revisar. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://musicbrainz.org/ws/2/';
const CAA = 'https://coverartarchive.org/release/';
const VERSION = '0.4';
const VARIOUS = '89ad4ac3-39f7-470e-963a-56509c546377';
const LEVEL = { 3: 'alta', 2: 'media', 1: 'baja', 0: '—' };
const REL_INC_REC = 'labels+release-groups+recordings+artist-credits+url-rels+recording-level-rels+release-group-level-rels';
const REL_INC_RG = 'labels+release-groups+media+artist-credits+url-rels+release-group-level-rels';

/* ---------------------------------------------------------------- catálogo */

function runInSandbox(files, root, sandbox = { window: {} }) {
  vm.createContext(sandbox);
  for (const f of files) {
    const p = join(root, f);
    if (existsSync(p)) vm.runInContext(readFileSync(p, 'utf8'), sandbox, { filename: f });
  }
  return sandbox.window.H || {};
}
export function loadCatalog(root = ROOT) {
  return runInSandbox(['js/data/genres.js', 'js/data/catalog.js'], root).data;
}
export function loadExisting(root = ROOT) {
  const H = runInSandbox(['js/data/mb.js'], root);
  return (H.data && H.data.mb && H.data.mb.records) || {};
}

/* ---------------------------------------------------------- normalización */

export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const dropOriginal = (s) => s.replace(/\boriginal (mix|version)\b/g, ' ').replace(/\s+/g, ' ').trim();
export const baseTitle = (s) => dropOriginal(norm(String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')));

/* 1 = mismo título · 0,92 = igual sin lo que va entre paréntesis · <0,85 = parecido por palabras */
export function titleScore(a, b) {
  const fa = dropOriginal(norm(a)), fb = dropOriginal(norm(b));
  if (!fa || !fb) return 0;
  if (fa === fb) return 1;
  const ba = baseTitle(a), bb = baseTitle(b);
  if (ba && (ba === bb || ba === fb || fa === bb)) return 0.92;
  const ta = new Set(fa.split(' ')), tb = new Set(fb.split(' '));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  return Math.round((0.85 * inter / new Set([...ta, ...tb]).size) * 1000) / 1000;
}

/* Palabras que delatan una versión que no es la original (remezcla, edición de radio, directo…) */
const VERSION_WORDS = new Set(['remix', 'remixes', 'rmx', 'mix', 'edit', 'rework', 'remaster', 'remastered', 'live', 'vip', 'bootleg',
  'instrumental', 'radio', 'extended', 'dub', 'reprise', 'refix', 'remake', 'acapella', 'megamix', 'medley', 'reconstruction', 'reedit', 'mixed']);
export function versionTag(hTitle, mbTitle, disambiguation) {
  const own = new Set(dropOriginal(norm(hTitle)).split(' '));
  const words = dropOriginal(norm((mbTitle || '') + ' ' + (disambiguation || ''))).split(' ')
    .filter((w) => VERSION_WORDS.has(w) && !own.has(w));
  return words.length ? [...new Set(words)].join(' ') : null;
}

const normA = (s) => ' ' + norm(s).replace(/\b(the|dj|mc)\b/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
export const creditText = (credit = []) => credit.map((c) => (c.name || c.artist?.name || '') + (c.joinphrase || '')).join('');
export function artistMatch(names, credit = []) {
  const credited = normA(credit.map((c) => (c.name || c.artist?.name || '') + ' ' + (c.joinphrase || '')).join(' '));
  const canonical = normA(credit.map((c) => (c.artist?.name || c.name || '') + ' ' + (c.joinphrase || '')).join(' '));
  const compact = (x) => x.replace(/\s+/g, '');
  const hit = names.map((n) => {
    const a = normA(n);
    if (a.trim() === '') return false;
    if (credited.includes(a) || canonical.includes(a)) return true;
    // mismo nombre con otra separación («Abel K Kaña» ≈ «Abel K'Kaña»); solo nombres de varias palabras
    return a.trim().includes(' ') && compact(a).length >= 6 && (compact(credited).includes(compact(a)) || compact(canonical).includes(compact(a)));
  });
  return { primary: !!hit[0], all: hit.length > 0 && hit.every(Boolean), missing: names.filter((_, i) => !hit[i]) };
}

export const yearOf = (d) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
export const cmpDate = (a, b) => (a && b ? (a < b ? -1 : a > b ? 1 : 0) : a ? -1 : b ? 1 : 0);
export const phrase = (s) => '"' + String(s).replace(/["\\]/g, '\\$&') + '"';
export const words = (s) => norm(s) || '""';

/* ------------------------------------------------------------- emparejado */

export function rate(entity, ctx) {
  let title = titleScore(ctx.title, entity.title);
  const a = artistMatch(ctx.artists, entity['artist-credit']);
  const version = versionTag(ctx.title, entity.title, entity.disambiguation);
  // «(The Official Masters of Hardcore 2005 Anthem)» y similares son subtítulos del mismo tema, no versiones
  if (title === 0.92 && !version && /\banthem\b/.test(norm(entity.title)) && !/\banthem\b/.test(norm(ctx.title))) title = 1;
  let level = 0;
  if (a.primary && title >= 0.75) level = 1;
  if (a.primary && title >= 0.9) level = 2;
  if (a.primary && title === 1 && !version) level = 3;
  return {
    level, title, all: a.all, missing: a.missing, version,
    date: entity['first-release-date'] || null,
    score: Number(entity.score) || 0,
    type: entity['primary-type'] || null
  };
}

export function pick(entities = [], ctx, wantType = null) {
  const rated = entities.map((e) => ({ e, ...rate(e, ctx) }));
  const ok = rated.filter((x) => x.level > 0).sort((x, y) =>
    y.level - x.level ||
    (wantType ? (y.type === wantType) - (x.type === wantType) : 0) ||
    y.all - x.all ||
    cmpDate(x.date, y.date) ||
    y.score - x.score);
  return { best: ok[0] || null, rated: ok };
}

const BAD_STATUS = new Set(['Bootleg', 'Pseudo-Release', 'Withdrawn', 'Cancelled']);
const NOT_ORIGINAL = new Set(['Compilation', 'DJ-mix', 'Live', 'Mixtape/Street', 'Remix', 'Soundtrack']);
/* Un lanzamiento que no es del artista: recopilatorio, sesión, emisión de radio, banda sonora o «Various Artists» */
export function isCompilation(r) {
  const rg = r['release-group'] || {};
  if ((rg['secondary-types'] || []).some((x) => NOT_ORIGINAL.has(x))) return true;
  if (rg['primary-type'] === 'Broadcast') return true;
  const ac = r['artist-credit'] || rg['artist-credit'] || [];
  return ac.some((c) => c.artist?.id === VARIOUS || /^various artists$/i.test(c.name || c.artist?.name || ''));
}
/* Edición original: la más antigua que sea del propio artista y no un recopilatorio, sesión, directo ni remezclas.
   Con `artists`, si hay lanzamientos acreditados a ese artista, se elige entre ellos. */
export function pickRelease(releases = [], { allowCompilation = false, artists = null, labels = null } = {}) {
  const valid = releases.filter((r) => !BAD_STATUS.has(r.status));
  let own = allowCompilation ? valid : valid.filter((r) => !isCompilation(r));
  let foreign = false;
  if (artists && artists.length && !allowCompilation) {
    const credited = own.filter((r) => r['artist-credit']);
    const mine = credited.filter((r) => artistMatch(artists, r['artist-credit']).primary);
    // ninguna edición está acreditada al artista: es un recopilatorio aunque no lo diga
    if (mine.length) own = mine; else if (credited.length) foreign = true;
  }
  const pool = own.length ? own : valid.length ? valid : releases;
  // a igual año, la edición del sello que ya figura en el archivo (la original suele ser esa, no una licencia extranjera)
  const want = (labels || []).filter(Boolean).map(norm);
  const labelRank = (r) => (want.length && (r['label-info'] || []).some((li) => {
    const n = li.label ? norm(li.label.name) : '';
    return n && want.some((w) => w && (n.includes(w) || w.includes(n)));
  }) ? 0 : 1);
  const yr = (r) => yearOf(r.date) ?? 9999;
  const typeRank = (r) => ({ Single: 0, EP: 0, Album: 1 }[r['release-group']?.['primary-type']] ?? 2);
  const vinyl = (r) => ((r.media || []).some((m) => /vinyl/i.test(m.format || '')) ? 0 : 1);
  const official = (r) => (r.status === 'Official' ? 0 : 1);
  const best = pool.slice().sort((a, b) =>
    yr(a) - yr(b) || labelRank(a) - labelRank(b) || cmpDate(a.date, b.date) || official(a) - official(b) || typeRank(a) - typeRank(b) || vinyl(a) - vinyl(b))[0] || null;
  return best ? { id: best.id, fromCompilation: pool !== own || foreign } : null;
}

/* ----------------------------------------------------- resumen del lanzamiento */

const SERVICES = [
  ['spotify', /(^|\.)spotify\.com$/], ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/], ['discogs', /(^|\.)discogs\.com$/],
  ['bandcamp', /(^|\.)bandcamp\.com$/], ['beatport', /(^|\.)beatport\.com$/], ['deezer', /(^|\.)deezer\.com$/],
  ['apple', /(^|\.)(music|itunes)\.apple\.com$/], ['soundcloud', /(^|\.)soundcloud\.com$/], ['tidal', /(^|\.)tidal\.com$/],
  ['amazon', /(^|\.)amazon\.[a-z.]+$/]
];
const SCOPE_RANK = { recording: 3, release: 2, 'release-group': 1 };
function addLink(links, rel, scope) {
  const url = rel?.url?.resource;
  if (!url) return;
  let host;
  try { host = new URL(url).hostname; } catch { return; }
  const svc = SERVICES.find(([, re]) => re.test(host));
  if (!svc) return;
  const k = svc[0];
  if (!links[k] || SCOPE_RANK[scope] > SCOPE_RANK[links[k].scope]) links[k] = { url, scope };
}

export function summarizeFormats(media = []) {
  const count = new Map();
  for (const m of media) { const f = m.format || 'Formato desconocido'; count.set(f, (count.get(f) || 0) + 1); }
  return [...count].map(([f, n]) => (n > 1 ? n + '×' + f : f));
}

export function summarizeRelease(rel, recordingId = null) {
  const labels = [];
  let selfReleased = false;
  for (const li of rel['label-info'] || []) {
    const name = li.label?.name;
    const catno = li['catalog-number'] && !/^\[none\]$/i.test(li['catalog-number']) ? li['catalog-number'] : null;
    if (!name) { if (catno) labels.push({ name: null, mbid: null, catno }); continue; }
    if (/^\[no label\]$/i.test(name)) { selfReleased = true; if (catno) labels.push({ name: null, mbid: null, catno }); continue; }
    if (!labels.some((l) => l.name === name && l.catno === catno)) labels.push({ name, mbid: li.label.id || null, catno });
  }
  const media = rel.media || [];
  const rg = rel['release-group'] || {};
  const links = {};
  for (const r of rel.relations || []) addLink(links, r, 'release');
  for (const r of rg.relations || []) addLink(links, r, 'release-group');
  if (recordingId) for (const m of media) for (const tr of m.tracks || []) {
    if (tr.recording?.id === recordingId) for (const r of tr.recording.relations || []) addLink(links, r, 'recording');
  }
  return {
    id: rel.id, title: rel.title, date: rel.date || null, country: rel.country || null, status: rel.status || null,
    labels, selfReleased, formats: summarizeFormats(media),
    tracks: media.reduce((n, m) => n + (m['track-count'] || (m.tracks || []).length || 0), 0),
    cover: !!rel['cover-art-archive']?.front,
    caa: { artwork: !!rel['cover-art-archive']?.artwork, front: !!rel['cover-art-archive']?.front, count: rel['cover-art-archive']?.count || 0 },
    group: { id: rg.id || null, title: rg.title || null, type: rg['primary-type'] || null, secondary: rg['secondary-types'] || [], firstReleaseDate: rg['first-release-date'] || null },
    links
  };
}

/* Imágenes de Cover Art Archive: la portada (Front) y la galleta del vinilo (Medium).
   Si hay varias fotos de la galleta, gana la que dice ser la cara A o la etiqueta. */
const LABEL_HINT = /\b(label|labels|etiqueta|galleta|side\s*a|lado\s*a|cara\s*a|a[\s-]?side)\b/i;
const SIDE_B = /\b((side|lado|cara)\s*b|b[\s-]?side)\b/i;
export function summarizeArt(index, releaseId) {
  const imgs = (index && index.images) || [];
  const types = (i) => i.types || [];
  const at = (i) => (i ? { id: String(i.id), types: types(i), comment: i.comment || null, url: `${CAA}${releaseId}/${i.id}-500.jpg` } : null);
  const front = imgs.find((i) => i.front) || imgs.find((i) => types(i).includes('Front')) || null;
  const score = (i) => (LABEL_HINT.test(i.comment || '') ? 2 : 0) - (SIDE_B.test(i.comment || '') ? 1 : 0);
  const label = imgs.filter((i) => i !== front && types(i).includes('Medium')).sort((a, b) => score(b) - score(a))[0] || null;
  return { front: at(front), label: at(label), count: imgs.length };
}
export const artFile = (releaseId, img) => `art/${releaseId}-${img.id}.jpg`;

/* Formato de un lanzamiento: vinyl · cd · digital · cassette · other */
export function formatKind(formats = []) {
  const f = [].concat(formats).join(' ');
  if (/vinyl/i.test(f)) return 'vinyl';
  if (/\b(cd|hdcd|sacd)\b|cd-r/i.test(f)) return 'cd';
  if (/digital/i.test(f)) return 'digital';
  if (/cassette/i.test(f)) return 'cassette';
  return f ? 'other' : null;
}

/* Si la edición original no es un vinilo, la primera edición en vinilo del mismo tema (si existe):
   su galleta es la que gira en el plato. Fuera recopilatorios, sesiones, remezclas y bootlegs. */
export function pickVinyl(releases = [], exceptId = null) {
  const ok = releases.filter((r) => r.id !== exceptId && !BAD_STATUS.has(r.status)
    && (r.media || []).some((m) => /vinyl/i.test(m.format || ''))
    && !isCompilation(r));
  return ok.sort((a, b) => cmpDate(a.date, b.date))[0] || null;
}

/* ------------------------------------------------------------------ cliente */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeClient({ contact = '', cacheDir = join(ROOT, 'tools/cache'), refresh = false, offline = false, fetchImpl = globalThis.fetch, minGap = 1100, retryBase = 2000, log = () => {} } = {}) {
  let last = 0, requests = 0, cached = 0;
  const ua = `Harmony/${VERSION} ( ${contact || 'archivo personal; sin contacto'} )`;
  const save = (file, obj) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(obj)); };

  const host = (url) => new URL(url).hostname.replace(/^www\./, '');
  const pace = async () => { const wait = last + minGap - Date.now(); if (wait > 0) await sleep(wait); last = Date.now(); };
  const get = (path, params = {}) => getUrl(API + path + '?' + new URLSearchParams({ ...params, fmt: 'json' }).toString());

  async function getUrl(url) {
    const key = createHash('sha1').update(url).digest('hex');
    const file = join(cacheDir, key.slice(0, 2), key + '.json');
    if (!refresh && existsSync(file)) {
      cached++;
      const c = JSON.parse(readFileSync(file, 'utf8'));
      return c.status === 404 ? null : c.body;
    }
    if (offline) { const e = new Error('No está en la caché y el modo es --offline'); e.code = 'OFFLINE'; throw e; }
    for (let attempt = 0; ; attempt++) {
      await pace();
      requests++;
      let res;
      try {
        res = await fetchImpl(url, { headers: { 'User-Agent': ua, Accept: 'application/json' } });
      } catch (e) {
        if (attempt < 4) { log(`    red caída (${e.message}); reintento`); await sleep(retryBase * 2 ** attempt); continue; }
        throw e;
      }
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        if (attempt < 4) { log(`    ${host(url)} responde ${res.status}; espero ${(retryBase * 2 ** attempt) / 1000} s`); await sleep(retryBase * 2 ** attempt); continue; }
        throw new Error(`HTTP ${res.status} tras varios intentos`);
      }
      if (res.status === 404) { save(file, { url, status: 404, fetchedAt: new Date().toISOString() }); return null; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const body = await res.json();
      save(file, { url, status: 200, fetchedAt: new Date().toISOString(), body });
      return body;
    }
  }
  /* Descarga binaria (imágenes). No repite lo que ya está en disco. */
  let downloads = 0;
  async function download(url, file) {
    if (existsSync(file) && statSync(file).size > 0) return 'exists';
    if (offline) return 'offline';
    for (let attempt = 0; ; attempt++) {
      await pace();
      let res;
      try { res = await fetchImpl(url, { headers: { 'User-Agent': ua } }); }
      catch (e) { if (attempt < 3) { await sleep(retryBase * 2 ** attempt); continue; } throw e; }
      if (res.status === 429 || res.status >= 500) { if (attempt < 3) { await sleep(retryBase * 2 ** attempt); continue; } throw new Error(`HTTP ${res.status}`); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('imagen vacía');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buf);
      downloads++;
      return 'new';
    }
  }
  return { get, getUrl, download, ua, stats: () => ({ requests, cached, downloads }) };
}

async function vinylFor(releases, release, client) {
  if (formatKind(release.formats) === 'vinyl') return null;
  const v = pickVinyl(releases, release.id);
  if (!v) return null;
  let art = null;
  try { const idx = await client.getUrl(CAA + v.id); art = idx ? summarizeArt(idx, v.id) : null; }
  catch (e) { art = null; }
  return { id: v.id, title: v.title, date: v.date || null, country: v.country || null, formats: summarizeFormats(v.media || []), art };
}

/* Lista de imágenes del lanzamiento en Cover Art Archive (si MusicBrainz dice que tiene alguna) */
async function artFor(rel, client) {
  const caa = rel['cover-art-archive'] || {};
  if (!caa.artwork && !caa.front) return null;
  try {
    const idx = await client.getUrl(CAA + rel.id);
    return idx ? summarizeArt(idx, rel.id) : null;
  } catch (e) {
    return e.code === 'OFFLINE' ? null : { front: null, label: null, count: 0, error: e.message };
  }
}

/* ------------------------------------------------------------- importación */

const brief = (x) => ({ id: x.e.id, title: x.e.title, credit: creditText(x.e['artist-credit']), date: x.date, level: x.level, version: x.version });

function result(base, { recording, release, chosen, year, notes, pinned, level, rated }) {
  const out = {
    ...base, status: 'matched', level, confidence: LEVEL[level], pinned,
    apply: pinned || (level === 3 && !chosen.fromCompilation && !chosen.late),
    year, release, notes,
    alternatives: rated.slice(1, 4).map(brief)
  };
  if (recording) out.recording = recording;
  if (chosen.fromCompilation) out.notes.push('Solo aparece en recopilatorios, sesiones o bandas sonoras: no se aplica sin revisar.');
  return out;
}

/* Si el tema solo aparece en recopilatorios, busca su single o EP: muchas veces MusicBrainz guarda
   la grabación del single y la de los recopilatorios por separado. Acepta títulos dobles («A / B»). */
async function singleFor(q, client) {
  const r = await client.get('release-group', { query: `releasegroup:${phrase(q.title)} AND artist:${phrase(q.artists[0])} AND (primarytype:single OR primarytype:ep)`, limit: '25' });
  const groups = (r?.['release-groups'] || []).filter((g) => !(g['secondary-types'] || []).some((x) => NOT_ORIGINAL.has(x)));
  const rated = groups.map((g) => {
    const parts = String(g.title || '').split(/\s+\/\s+/);
    const best = parts.map((title) => rate({ ...g, title }, q)).sort((a, b) => b.level - a.level)[0];
    return { e: g, ...best };
  }).filter((x) => x.level === 3).sort((a, b) => cmpDate(a.date, b.date));
  const best = rated[0];
  if (!best) return null;
  const br = await client.get('release', { 'release-group': best.e.id, inc: 'labels+media+artist-credits', limit: '100' });
  const rels = (br?.releases || []).map((x) => ({ ...x, 'release-group': { 'primary-type': best.e['primary-type'], 'secondary-types': best.e['secondary-types'] || [] } }));
  const chosen = pickRelease(rels, { artists: q.artists, labels: q.labels });
  if (!chosen || chosen.fromCompilation) return null;
  return { rg: best.e, chosen, rels };
}

async function importRecording(t, q, pin, client) {
  let rec, rated = [], level = 3, cands = [];
  if (pin.recording) {
    rec = await client.get('recording/' + pin.recording, { inc: 'releases+release-groups+artist-credits+media' });
    if (!rec) return { kind: 'recording', status: 'error', error: 'La grabación fijada no existe en MusicBrainz: ' + pin.recording };
  } else {
    let r = await client.get('recording', { query: `recording:${phrase(q.title)} AND artist:${phrase(q.artists[0])}`, limit: '50' });
    let p = pick(r?.recordings, q);
    if (!p.best) {
      r = await client.get('recording', { query: `recording:(${words(q.title)}) AND artist:(${words(q.artists[0])})`, limit: '50' });
      p = pick(r?.recordings, q);
    }
    if (!p.best) return { kind: 'recording', status: 'not-found', candidates: (r?.recordings || []).slice(0, 3).map((e) => ({ id: e.id, title: e.title, credit: creditText(e['artist-credit']), date: e['first-release-date'] || null })) };
    rec = p.best.e; rated = p.rated; level = p.best.level;
    // otras grabaciones igual de buenas del mismo tema: el single y los recopilatorios suelen estar separados
    cands = p.rated.filter((x) => x.level === p.best.level).slice(0, 3).map((x) => x.e);
  }
  const notes = [];
  // Todas las ediciones de cada grabación candidata, con su tipo: la búsqueda no dice cuáles son recopilatorios
  let releases = [], chosen = null, used = rec;
  for (const cand of cands.length ? cands : [rec]) {
    const br = await client.get('release', { recording: cand.id, inc: 'release-groups+media+artist-credits+labels', limit: '100' });
    const rels = br?.releases?.length ? br.releases : cand.releases || [];
    const c = pin.release ? { id: pin.release } : pickRelease(rels, { artists: q.artists, labels: q.labels });
    if (!c) continue;
    if (!chosen || (chosen.fromCompilation && !c.fromCompilation)) { chosen = c; releases = rels; used = cand; }
    if (!c.fromCompilation) break;
  }
  rec = used;
  const miss = artistMatch(q.artists, rec['artist-credit']).missing;
  if (miss.length) notes.push('Los créditos de MusicBrainz no incluyen a ' + miss.join(', ') + '.');
  let viaSingle = null;
  if (chosen && chosen.fromCompilation && !pin.release) {
    viaSingle = await singleFor(q, client);
    if (viaSingle) { chosen = viaSingle.chosen; releases = viaSingle.rels; notes.push(`Edición original localizada por su single: «${viaSingle.rg.title}».`); }
  }
  if (!chosen) return { kind: 'recording', status: 'not-found', candidates: [brief({ e: rec, ...rate(rec, q) })], error: 'Grabación sin lanzamientos' };
  const rel = await client.get('release/' + chosen.id, { inc: REL_INC_REC });
  if (!rel) return { kind: 'recording', status: 'error', error: 'El lanzamiento no existe: ' + chosen.id };
  const release = summarizeRelease(rel, viaSingle ? null : rec.id);
  const firstY = viaSingle ? yearOf(viaSingle.rg['first-release-date']) ?? yearOf(release.date) : yearOf(rec['first-release-date']);
  const relY = yearOf(release.date);
  // una edición muy posterior a la primera aparición del tema no es la original: es una reedición
  if (!pin.release && firstY && relY && relY > firstY) {
    chosen = { ...chosen, late: true };
    notes.push(`La edición encontrada (${relY}) es posterior a la primera aparición del tema (${firstY}): la original no está en MusicBrainz.`);
  }
  release.art = await artFor(rel, client);
  release.vinyl = await vinylFor(releases, release, client);
  return result({ kind: 'recording' }, {
    recording: { id: rec.id, title: rec.title, credit: creditText(rec['artist-credit']), firstReleaseDate: rec['first-release-date'] || null, length: rec.length || null },
    release, chosen, notes, rated, level,
    year: firstY ?? relY,
    pinned: !!(pin.recording || pin.release)
  });
}
async function importReleaseGroup(t, q, pin, client) {
  const wantType = { ep: 'EP', album: 'Album', recopilatorio: 'Album' }[t.kind] || null;
  let rg = null, rated = [], level = 3;
  if (pin.releaseGroup) {
    rg = await client.get('release-group/' + pin.releaseGroup, { inc: 'artist-credits' });
    if (!rg) return { kind: 'release-group', status: 'error', error: 'El grupo fijado no existe en MusicBrainz: ' + pin.releaseGroup };
  } else if (!pin.release) {
    let r = await client.get('release-group', { query: `releasegroup:${phrase(q.title)} AND artist:${phrase(q.artists[0])}`, limit: '25' });
    let p = pick(r?.['release-groups'], q, wantType);
    if (!p.best) {
      r = await client.get('release-group', { query: `releasegroup:(${words(q.title)}) AND artist:(${words(q.artists[0])})`, limit: '25' });
      p = pick(r?.['release-groups'], q, wantType);
    }
    if (!p.best) return { kind: 'release-group', status: 'not-found', candidates: (r?.['release-groups'] || []).slice(0, 3).map((e) => ({ id: e.id, title: e.title, credit: creditText(e['artist-credit']), date: e['first-release-date'] || null })) };
    rg = p.best.e; rated = p.rated; level = p.best.level;
  }
  let chosen = pin.release ? { id: pin.release } : null;
  let rels = [];
  if (!chosen) {
    const br = await client.get('release', { 'release-group': rg.id, inc: 'labels+media', limit: '100' });
    rels = (br?.releases || []).map((x) => ({ ...x, 'release-group': { 'primary-type': rg['primary-type'], 'secondary-types': rg['secondary-types'] || [] } }));
    chosen = pickRelease(rels, { allowCompilation: true });
    if (!chosen) return { kind: 'release-group', status: 'not-found', error: 'Grupo sin lanzamientos' };
  }
  const rel = await client.get('release/' + chosen.id, { inc: REL_INC_RG });
  if (!rel) return { kind: 'release-group', status: 'error', error: 'El lanzamiento no existe: ' + chosen.id };
  const release = summarizeRelease(rel);
  release.art = await artFor(rel, client);
  release.vinyl = await vinylFor(rels, release, client);
  return result({ kind: 'release-group' }, {
    release, chosen, rated, level, notes: [],
    year: yearOf(release.group.firstReleaseDate) ?? yearOf(rg?.['first-release-date']) ?? yearOf(release.date),
    pinned: !!(pin.releaseGroup || pin.release)
  });
}

export async function importRecord(t, artistsById, client) {
  const pin = t.mb || {};
  if (pin.skip) return { status: 'skipped', pinned: true, apply: false };
  const names = t.artists[0] === 'various' ? ['Various Artists'] : t.artists.map((id) => artistsById[id]?.name).filter(Boolean);
  const label = t.label ? (artistsById.__labels || {})[t.label] : null;
  const q = { title: pin.title || t.title, artists: pin.artist ? [pin.artist, ...names.slice(1)] : names, labels: label ? [label] : [] };
  const r = await (t.kind === 'tema' ? importRecording(t, q, pin, client) : importReleaseGroup(t, q, pin, client));
  // si el año de MusicBrainz y el del archivo se separan más de dos años, probablemente no es la misma edición
  if (r.status === 'matched' && r.apply && !r.pinned && t.year != null && r.year != null && Math.abs(r.year - t.year) > 2) {
    r.apply = false;
    r.notes.push(`El año de MusicBrainz (${r.year}) no cuadra con el del archivo (${t.year}): puede ser otra edición.`);
  }
  return r;
}

/* ------------------------------------------------- diferencias con lo editorial
   Misma regla que aplica la web (js/lib/archive.js · mergeMB):
   - si el dato editorial no estaba contrastado, MusicBrainz lo sustituye;
   - si estaba contrastado con otra fuente y no coincide, se mantiene y se marca el desacuerdo. */

const loose = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
export function diffRecord(t, r, data) {
  if (r.status !== 'matched') return [];
  const labelName = (id) => (data.labels.find((l) => l.id === id) || {}).name || id;
  const L0 = r.release.labels.find((l) => l.name) || null;
  const fields = [
    ['year', 'Año', t.year, r.year, (a, b) => a === b],
    ['label', 'Sello', t.label ? labelName(t.label) : null, L0 ? L0.name : null, loose],
    ['release', 'Lanzamiento', t.release, r.release.title, loose],
    ['catno', 'N.º de catálogo', t.catno, (r.release.labels.find((l) => l.catno) || {}).catno || null, loose],
    ['format', 'Formato', t.format, r.release.formats.join(' + ') || null, () => true]
  ];
  const out = [];
  for (const [f, name, ed, mb, same] of fields) {
    if (mb == null) continue;
    if (ed != null && same(ed, mb)) continue;
    const contrasted = ed != null && t.ok.includes(f);
    out.push({ field: f, name, ed, mb, outcome: contrasted ? 'conflicto' : ed == null ? 'nuevo' : 'corrige' });
  }
  return out;
}

/* ---------------------------------------------------------------- salidas */

export function renderDataFile(records, meta) {
  const payload = { version: 1, source: 'MusicBrainz', generatedAt: meta.generatedAt, records };
  return `/* HARMONY · datos contrastados con MusicBrainz.
   Generado por tools/mb-import.mjs${meta.generatedAt ? ' el ' + meta.generatedAt.slice(0, 10) : ''}. No editar a mano: vuelve a ejecutar el importador.
   Para corregir un emparejado, fíjalo en js/data/catalog.js (campo mb) y vuelve a importar ese registro con --only. */
(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  H.data.mb = ${JSON.stringify(payload, null, 1)};
})();
`;
}

const mbUrl = (type, id) => `https://musicbrainz.org/${type}/${id}`;
const cell = (s) => String(s ?? '—').replace(/\|/g, '\\|');

export function renderReport(records, data, meta) {
  const tracks = data.tracks.filter((t) => records[t.id]);
  const by = (fn) => tracks.filter((t) => fn(records[t.id]));
  const applied = by((r) => r.status === 'matched' && r.apply);
  const review = by((r) => r.status === 'matched' && !r.apply);
  const missing = by((r) => r.status === 'not-found');
  const errors = by((r) => r.status === 'error');
  const skipped = by((r) => r.status === 'skipped');
  const hmy = (t) => 'HMY·' + String(t.n).padStart(3, '0');
  const who = (t) => t.artists.map((id) => (data.artists.find((a) => a.id === id) || {}).name || id).join(' & ');
  const lines = [];
  lines.push(`# Importación de MusicBrainz`, '');
  lines.push(`${meta.generatedAt.slice(0, 16).replace('T', ' ')} UTC · ${tracks.length} registros · ${meta.requests} peticiones nuevas · ${meta.cached} desde caché`, '');
  lines.push(`- **Aplicados:** ${applied.length} (confianza alta o fijados a mano)`);
  lines.push(`- **Para revisar:** ${review.length}`);
  lines.push(`- **Sin encontrar:** ${missing.length}`);
  if (errors.length) lines.push(`- **Errores:** ${errors.length}`);
  if (skipped.length) lines.push(`- **Omitidos a propósito:** ${skipped.length}`);
  lines.push('');

  const changes = applied.flatMap((t) => diffRecord(t, records[t.id], data).map((d) => ({ t, d })));
  lines.push(`## Cambios respecto al catálogo editorial`, '');
  if (!changes.length) lines.push('Ninguno.', '');
  else {
    lines.push('| Registro | Campo | Editorial | MusicBrainz | Resultado |', '|---|---|---|---|---|');
    const OUT = { nuevo: 'dato nuevo', corrige: 'se corrige', conflicto: '**en desacuerdo**: se mantiene el contrastado' };
    for (const { t, d } of changes) lines.push(`| ${hmy(t)} ${cell(t.title)} | ${d.name} | ${cell(d.ed)}${d.outcome === 'conflicto' ? ' ✓' : ''} | ${cell(d.mb)} | ${OUT[d.outcome]} |`);
    lines.push('', '✓ = contrastado antes con otra fuente citada en el catálogo.', '');
  }

  lines.push(`## Para revisar`, '');
  if (!review.length) lines.push('Nada.', '');
  for (const t of review) {
    const r = records[t.id];
    const target = r.recording ? `grabación [${cell(r.recording.title)}](${mbUrl('recording', r.recording.id)}) · ${r.recording.credit}` : `lanzamiento [${cell(r.release.title)}](${mbUrl('release', r.release.id)})`;
    lines.push(`- **${hmy(t)} ${t.title}** — ${who(t)} · confianza ${r.confidence}`);
    lines.push(`  - Mejor candidato: ${target} · ${r.year ?? 'sin año'}`);
    for (const n of r.notes || []) lines.push(`  - ${n}`);
    const notOriginal = (r.notes || []).some((n) => /recopilatorios|posterior a la primera|no cuadra/.test(n));
    if (notOriginal) {
      lines.push(`  - Encontrado en: [${cell(r.release.title)}](${mbUrl('release', r.release.id)})${r.release.date ? ' · ' + r.release.date : ''}`);
      lines.push(`  - Si la edición original está en MusicBrainz con otra ficha, fíjala: \`mb: { release: '<mbid>' }\`. Si no, déjalo así: no se aplica nada.`);
      continue;
    }
    for (const a of r.alternatives) lines.push(`  - Alternativa: [${cell(a.title)}](${mbUrl(r.kind === 'recording' ? 'recording' : 'release-group', a.id)}) · ${a.credit} · ${a.date || 'sin fecha'}${a.version ? ' · ' + a.version : ''}`);
    lines.push(`  - Para aceptarlo: \`mb: { ${r.recording ? `recording: '${r.recording.id}'` : `release: '${r.release.id}'`} }\``);
  }
  if (review.length) lines.push('');

  lines.push(`## Sin encontrar`, '');
  if (!missing.length) lines.push('Nada.', '');
  for (const t of missing) {
    const r = records[t.id];
    lines.push(`- **${hmy(t)} ${t.title}** — ${who(t)}${r.error ? ' · ' + r.error : ''}`);
    for (const c of r.candidates || []) lines.push(`  - Resultado descartado: [${cell(c.title)}](${mbUrl(r.kind === 'recording' ? 'recording' : 'release-group', c.id)}) · ${c.credit} · ${c.date || 'sin fecha'}`);
    lines.push(`  - Prueba \`mb: { title: '…', artist: '…' }\`, fija el MBID o usa \`mb: { skip: true }\` si no está en MusicBrainz.`);
  }
  if (missing.length) lines.push('');

  if (errors.length) {
    lines.push(`## Errores`, '');
    for (const t of errors) lines.push(`- **${hmy(t)} ${t.title}**: ${records[t.id].error}`);
    lines.push('');
  }

  lines.push(`## Aplicados`, '');
  if (!applied.length) lines.push('Ninguno.', '');
  else {
    lines.push('| Registro | Año | Lanzamiento | Sello · n.º | Formato | Enlaces | Diseño |', '|---|---|---|---|---|---|---|');
    for (const t of applied) {
      const r = records[t.id], R = r.release;
      const lab = R.labels.map((l) => [l.name, l.catno].filter(Boolean).join(' ')).join(' / ') || (R.selfReleased ? 'Autoeditado' : '—');
      const links = Object.keys(R.links).join(', ') || '—';
      const kind = formatKind(R.formats);
      const art = R.art ? [R.art.front && 'portada' + (kind && kind !== 'vinyl' ? ' (' + (kind === 'cd' ? 'CD' : kind) + ')' : '') + (R.art.front.file ? '' : ' (sin bajar)'), kind === 'vinyl' && R.art.label && 'galleta' + (R.art.label.file ? '' : ' (sin bajar)')].filter(Boolean).join(' · ') : '';
      const V = R.vinyl;
      const vin = V ? ` · vinilo: [${cell(V.title)}${V.date ? ', ' + V.date.slice(0, 4) : ''}](${mbUrl('release', V.id)})${V.art && V.art.label ? ' con galleta' : ''}` : kind && kind !== 'vinyl' ? ' · sin vinilo' : '';
      lines.push(`| ${hmy(t)} ${cell(t.title)} | ${r.year ?? '—'} | [${cell(R.title)}](${mbUrl('release', R.id)})${R.group.type ? ' · ' + R.group.type : ''}${R.country ? ' · ' + R.country : ''} | ${cell(lab)} | ${cell(R.formats.join(' + ') || '—')} | ${links} | ${art ? `[${art}](${mbUrl('release', R.id)}/cover-art)` : '—'}${vin} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------- main */

export async function run({ root = ROOT, only = null, refresh = false, offline = false, art = true, contact = '', fetchImpl, minGap, retryBase, log = console.log, write = true } = {}) {
  if (typeof (fetchImpl || globalThis.fetch) !== 'function') throw new Error('Hace falta Node 18 o superior (fetch global).');
  const data = loadCatalog(root);
  const artistsById = Object.fromEntries(data.artists.map((a) => [a.id, a]));
  artistsById.__labels = Object.fromEntries((data.labels || []).map((l) => [l.id, l.name]));
  const client = makeClient({ contact, refresh, offline, fetchImpl, minGap, retryBase, log, cacheDir: join(root, 'tools/cache') });
  const unknown = only ? only.filter((id) => !data.tracks.some((t) => t.id === id)) : [];
  if (unknown.length) throw new Error('No existen en el catálogo: ' + unknown.join(', '));
  const list = data.tracks.filter((t) => !only || only.includes(t.id));
  const records = only ? loadExisting(root) : {};
  if (!contact) log('Aviso: MusicBrainz pide un contacto en el User-Agent. Usa --contact tu@correo.com o HARMONY_CONTACT.');
  log(`Importando ${list.length} registros desde MusicBrainz (máx. 1 petición por segundo)…`);
  for (const [i, t] of list.entries()) {
    let r;
    try { r = await importRecord(t, artistsById, client); }
    catch (e) { r = { status: 'error', error: e.message }; }
    records[t.id] = r;
    log(progressLine(i, list.length, t, r));
  }
  await fetchArt(records, { root, client, download: art && write, log });
  if (!only && write) pruneArt(records, { root, log });
  const meta = { generatedAt: new Date().toISOString(), ...client.stats() };
  const report = renderReport(records, data, meta);
  if (write) {
    writeFileSync(join(root, 'js/data/mb.js'), renderDataFile(records, meta));
    writeFileSync(join(root, 'tools/mb-report.md'), report);
  }
  const vals = Object.values(records);
  log(`\nListo: ${vals.filter((r) => r.apply).length} aplicados · ${vals.filter((r) => r.status === 'matched' && !r.apply).length} para revisar · ${vals.filter((r) => r.status === 'not-found').length} sin encontrar · ${vals.filter((r) => r.status === 'error').length} errores.`);
  log(`Peticiones: ${meta.requests} nuevas, ${meta.cached} desde caché${meta.downloads ? `, ${meta.downloads} imágenes descargadas` : ''}.${write ? '\nEscrito: js/data/mb.js y tools/mb-report.md. Ejecuta node build.mjs para regenerar dist/.' : ''}`);
  return { records, report, meta };
}

/* Descarga a art/ las imágenes de los registros aplicados y anota la ruta local.
   Sin descarga (--no-art), solo se anotan las que ya estén en disco. */
export async function fetchArt(records, { root = ROOT, client, download = true, log = () => {} } = {}) {
  const jobs = [];
  for (const r of Object.values(records)) {
    if (r.status !== 'matched' || !r.apply || !r.release || !r.release.art) continue;
    for (const k of ['front', 'label']) if (r.release.art[k]) jobs.push({ R: r.release, img: r.release.art[k], k });
  }
  for (const r of Object.values(records)) {
    const V = r.status === 'matched' && r.apply && r.release?.vinyl;
    if (V && V.art) for (const k of ['front', 'label']) if (V.art[k]) jobs.push({ R: V, img: V.art[k], k });
  }
  if (download && jobs.length) log(`\nDiseño de los discos: ${jobs.length} imágenes de Cover Art Archive…`);
  let fails = 0;
  for (const { R, img } of jobs) {
    const rel = artFile(R.id, img), abs = join(root, rel);
    if (download) {
      try { await client.download(img.url, abs); }
      catch (e) { fails++; log(`    no se pudo bajar ${img.url}: ${e.message}`); }
    }
    if (existsSync(abs)) img.file = rel; else delete img.file;
  }
  if (download && jobs.length) log(`  ${jobs.filter((j) => j.img.file).length} en art/${fails ? ` · ${fails} sin descargar` : ''}`);
}

/* En una importación completa, borra de art/ las imágenes que ya no usa ningún registro
   (por ejemplo, la portada de un recopilatorio que antes se tomó por error como edición original). */
export function pruneArt(records, { root = ROOT, log = () => {} } = {}) {
  const dir = join(root, 'art');
  if (!existsSync(dir)) return 0;
  const keep = new Set();
  for (const r of Object.values(records)) {
    const R = r.release;
    if (!R) continue;
    for (const A of [R.art, R.vinyl && R.vinyl.art]) if (A) for (const k of ['front', 'label']) if (A[k] && A[k].file) keep.add(A[k].file.replace(/^art\//, ''));
  }
  let n = 0;
  // las portadas de Discogs (dc-…) son cosa del importador de Discogs: aquí no se tocan
  for (const f of readdirSync(dir)) if (/\.jpg$/i.test(f) && !/^dc-/.test(f) && !keep.has(f)) { unlinkSync(join(dir, f)); n++; }
  if (n) log(`  ${n} imágenes que ya no se usan, borradas de art/`);
  return n;
}

function progressLine(i, n, t, r) {
  const head = `  ${String(i + 1).padStart(String(n).length)}/${n}  ${t.id.padEnd(26)}`;
  if (r.status === 'matched') {
    const R = r.release, L = R.labels.find((l) => l.name);
    const bits = [r.year, L ? [L.name, L.catno].filter(Boolean).join(' ') : R.selfReleased ? 'autoeditado' : null, R.formats.join(' + '), R.links.discogs ? 'Discogs' : null,
      R.art && R.art.front ? 'portada' : null, R.art && R.art.label ? 'galleta' : null].filter(Boolean);
    return `${head}${r.apply ? '✓' : '?'} ${r.confidence.padEnd(5)}  ${bits.join(' · ')}`;
  }
  if (r.status === 'not-found') return `${head}✗ sin resultados`;
  if (r.status === 'skipped') return `${head}– omitido`;
  return `${head}! ${r.error}`;
}

function parseArgs(argv) {
  const o = { only: null, refresh: false, offline: false, art: true, contact: process.env.HARMONY_CONTACT || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
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
