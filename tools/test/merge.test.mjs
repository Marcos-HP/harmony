// node --test tools/test/merge.test.mjs
// Fusiona en la web (js/lib/archive.js) una capa de MusicBrainz generada con el servidor falso
// contra una copia del catálogo real, y comprueba que la regla de fusión es la del informe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import * as M from '../mb-import.mjs';
import { fakeFetch } from './fake-mb.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const ONLY = ['poing', 'hsoc', 'make-it-loud', 'surgeon-ep', 'scrap-attack', 'rainbow'];

export async function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'harmony-merge-'));
  mkdirSync(join(root, 'js/data'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  copyFileSync(join(ROOT, 'js/data/genres.js'), join(root, 'js/data/genres.js'));
  // los emparejados fijados a mano apuntan a MBID reales que el servidor falso no conoce
  writeFileSync(join(root, 'js/data/catalog.js'), readFileSync(join(ROOT, 'js/data/catalog.js'), 'utf8').replace(/mb: \{[^}]*\}, /g, ''));
  await M.run({ root, only: ONLY, fetchImpl: fakeFetch(), minGap: 0, retryBase: 1, contact: 'test', log: () => {} });
  return root;
}

function boot(root, { noMB = false } = {}) {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  const files = [join(ROOT, 'js/lib/util.js'), join(root, 'js/data/genres.js'), join(root, 'js/data/catalog.js'), ...(noMB ? [] : [join(root, 'js/data/mb.js')]), join(ROOT, 'js/lib/archive.js')];
  for (const f of files) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
  const H = ctx.window.H;
  H.A.init();
  return H;
}

test('fusión de MusicBrainz en el archivo', async () => {
  const root = await fixtureProject();
  const H = boot(root);
  const A = H.A, t = A.t;

  assert.equal(A.mbStats.applied, 4, 'poing, make-it-loud, surgeon-ep, scrap-attack');
  assert.equal(A.mbStats.review, 1, 'hsoc');
  assert.equal(A.mbStats.missing, 1, 'rainbow');

  // dato nuevo: pasa a contrastado por MusicBrainz
  assert.equal(t['make-it-loud'].year, 2003);
  assert.equal(t['make-it-loud'].okBy.year, 'MusicBrainz');
  assert.equal(t['make-it-loud'].format, 'Vinilo 2×12″');
  assert.equal(t['make-it-loud'].L.id, 'blutonium', 'reutiliza el sello existente');
  assert.equal(t['make-it-loud'].links.spotify.scope, 'release');

  // contrastado antes con Wikipedia y en desacuerdo: se mantiene y se marca
  const s = t['scrap-attack'];
  assert.equal(s.year, 2009);
  assert.deepEqual(JSON.parse(JSON.stringify(s.conflicts)), [{ field: 'year', ed: 2009, by: 'Wikipedia', other: 2010, otherBy: 'MusicBrainz' }]);
  assert.equal(A.status(s, 'year'), 'cf');
  assert.equal(s.releaseInfo.selfReleased, true);

  // sello con nombre distinto pero equivalente («Downwards» ≈ «Downwards Records»)
  assert.equal(t['surgeon-ep'].L.id, 'downwards');
  assert.equal(t['surgeon-ep'].catno, 'TEST-EP1');
  assert.equal(t['surgeon-ep'].links.discogs.scope, 'release-group');

  // portada, fuentes y enlaces directos
  // diseño real: la copia local que bajó el importador; sin índice en Cover Art Archive, la portada remota
  assert.match(t.poing.cover, /^art\/0{8}-0{4}-4000-8000-0{9}101-11\.jpg$/);
  assert.match(t.poing.labelArt, /^art\/.+-12\.jpg$/);
  assert.match(t.poing.artFrom, /^https:\/\/musicbrainz\.org\/release\/.+\/cover-art$/);
  assert.match(t['surgeon-ep'].cover, /^https:\/\/coverartarchive\.org\/release\/.+\/front-250$/);
  assert.equal(t['surgeon-ep'].labelArt, null);
  assert.ok(t.poing.src.includes('mb-rel:poing') && t.poing.src.includes('mb-rec:poing'));
  assert.equal(t.poing.okBy.catno, 'MusicBrainz');
  assert.equal(t.poing.okBy.label, 'Wikipedia y MusicBrainz', 'el sello ya estaba contrastado y coincide');

  // lo que no se aplica no toca nada
  assert.equal(t.hsoc.MB, null);
  assert.equal(t.hsoc.catno, null);
  assert.equal(t.rainbow.MB, null);

  // nadie más se ve afectado
  assert.equal(t.dragonborn.MB, null);
  assert.deepEqual(JSON.parse(JSON.stringify(t.dragonborn.ok)), ['year', 'release']);

  // formatos
  assert.equal(A.fmtES('12" Vinyl'), 'Vinilo 12″');
  assert.equal(A.fmtES('2×CD'), '2×CD');
  assert.equal(A.fmtES('Digital Media'), 'Digital');
});

test('desacuerdos entre fuentes editoriales y BPM de la fuente', () => {
  const H = boot(ROOT);
  const x = H.A.t['ex-p-cial'];
  assert.deepEqual(JSON.parse(JSON.stringify(x.conflicts)), [{ field: 'year', ed: 1996, by: 'Wikipedia · Mákina', other: 1995, otherBy: 'Wikipedia · EX-3' }]);
  assert.equal(H.A.status(x, 'year'), 'cf');
  const ff = H.A.t['flying-free'];
  assert.equal(H.A.status(ff, 'bpm'), 'ok');
  assert.equal(H.A.bpmTxt(ff), '158');
  assert.equal(H.A.bpmTxt(H.A.t.poing), '≈' + H.A.t.poing.bpm);
  assert.equal(H.A.status(H.A.t.poing, 'bpm'), 'est');
});

test('catálogo: cada referencia apunta a algo que existe', () => {
  const H = boot(ROOT);
  const d = H.data;
  for (const t of d.tracks) {
    for (const k of [...t.src, ...Object.values(t.alt || {}).map((v) => v[1])]) assert.ok(d.sources[k], `${t.id}: fuente ${k}`);
    for (const a of t.artists) assert.ok(H.A.a[a], `${t.id}: artista ${a}`);
    assert.ok(H.A.g[t.genre], `${t.id}: género ${t.genre}`);
    if (t.label) assert.ok(H.A.l[t.label], `${t.id}: sello ${t.label}`);
    for (const f of t.ok) assert.ok(t[f] != null, `${t.id}: «${f}» contrastado pero vacío`);
  }
  for (const x of [...d.artists, ...d.labels, ...d.genres]) for (const k of x.src || []) assert.ok(d.sources[k], `${x.id}: fuente ${k}`);
  for (const r of d.routes) for (const [id] of r.steps) assert.ok(H.A.t[id], `${r.id}: ${id}`);
  const ns = d.tracks.map((t) => t.n), ids = d.tracks.map((t) => t.id);
  assert.equal(new Set(ns).size, ns.length, 'números HMY repetidos');
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
});

test('sin datos importados la web arranca igual', () => {
  const H = boot(ROOT, { noMB: true });
  assert.equal(H.A.mbStats.applied, 0);
  assert.equal(H.A.t.poing.cover, null);
  assert.equal(H.A.t.poing.okBy.label, 'Wikipedia');
});

test('la capa importada de verdad es coherente', () => {
  const H = boot(ROOT);
  const A = H.A;
  assert.ok(A.mbStats.applied > 0);
  for (const t of Object.values(A.t)) {
    if (!t.MB) continue;
    // el diseño real siempre es una copia local publicada junto a la web o la URL de Cover Art Archive
    for (const k of ['cover', 'labelArt']) if (t[k]) assert.match(t[k], /^(art\/[\w-]+\.jpg|https:\/\/coverartarchive\.org\/)/, `${t.id}: ${k}`);
    // la galleta solo si hay vinilo
    if (t.labelArt) assert.equal(t.fmtKind === 'vinyl' || !!t.vinylEd, true, `${t.id}: galleta sin vinilo`);
  }
});
