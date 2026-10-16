// node --test tools/test/mb-import.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import * as M from '../mb-import.mjs';
import { CATALOG, fakeFetch, IDS, JPEG } from './fake-mb.mjs';

const id = IDS.id;

test('títulos: misma canción escrita de otra forma', () => {
  assert.equal(M.titleScore('O – Overdrive', 'O (Overdrive)'), 1);
  assert.equal(M.titleScore("Ravers' Rules", 'Raver’s Rules'), 1);
  assert.equal(M.titleScore('Psychedelic', 'Psychedelic (Original Mix)'), 1);
  assert.equal(M.titleScore('Amsterdam waar lech dat dan?', 'Amsterdam (Waar Lech Dat Dan?)'), 1);
  assert.equal(M.titleScore('Psychedelic', 'Psychedelic (Radio Edit)'), 0.92);
  assert.ok(M.titleScore('Wonderful Days', 'Wonderful Days 2.08') < 0.9);
  assert.ok(M.titleScore('Poing', 'Boing') < 0.5);
});

test('versiones: remezclas y ediciones se detectan, el «original mix» no', () => {
  assert.equal(M.versionTag('Psychedelic', 'Psychedelic (Radio Edit)'), 'radio edit');
  assert.equal(M.versionTag('Psychedelic', 'Psychedelic (Original Mix)'), null);
  assert.equal(M.versionTag('Poing', 'Poing', 'live, 1993-12-31'), 'live');
  assert.equal(M.versionTag('Unbelievable (Remix)', 'Unbelievable (Remix)'), null);
});

test('artistas: alias con DJ, dúos y colaboraciones', () => {
  const c = (...xs) => xs.map(([name, canon, jp = '']) => ({ name, joinphrase: jp, artist: { name: canon } }));
  assert.ok(M.artistMatch(['Paul Elstak'], c(['DJ Paul Elstak', 'Paul Elstak'])).primary);
  assert.ok(M.artistMatch(['Charly Lownoise & Mental Theo'], c(['Charly Lownoise', 'Charly Lownoise', ' & '], ['Mental Theo', 'Mental Theo'])).all);
  const sig = M.artistMatch(['Signum', 'Scott Mac'], c(['Signum', 'Signum', ' feat. '], ['Scott Mac', 'Scott Mac']));
  assert.ok(sig.all);
  const solo = M.artistMatch(['Showtek', 'MC DV8'], c(['Showtek', 'Showtek']));
  assert.ok(solo.primary && !solo.all);
  assert.deepEqual(solo.missing, ['MC DV8']);
  assert.ok(!M.artistMatch(['Zany'], c(['Zanyx', 'Zanyx'])).primary, 'coincidencia de palabra completa, no de subcadena');
});

test('edición original: la más antigua que no sea recopilatorio, bootleg ni remezclas', () => {
  const r = (id, date, o = {}) => ({ id, date, status: o.status || 'Official', 'release-group': { 'primary-type': o.type || 'Single', 'secondary-types': o.sec || [] }, media: [{ format: o.format || '12" Vinyl' }] });
  assert.equal(M.pickRelease([r('comp', '1994-12', { type: 'Album', sec: ['Compilation'] }), r('single', '1995'), r('lp', '1996', { type: 'Album' })]).id, 'single');
  assert.equal(M.pickRelease([r('boot', '1990', { status: 'Bootleg' }), r('ok', '1991')]).id, 'ok');
  assert.equal(M.pickRelease([r('cd', '1995-03', { format: 'CD' }), r('vinyl', '1995-03')]).id, 'vinyl');
  assert.equal(M.pickRelease([r('nodate', undefined), r('dated', '2001')]).id, 'dated');
  const only = M.pickRelease([r('c1', '1999', { sec: ['Compilation'] })]);
  assert.equal(only.id, 'c1');
  assert.equal(only.fromCompilation, true);
});

test('resumen del lanzamiento: sellos, formatos, enlaces y portada', () => {
  const s = M.summarizeRelease({
    id: 'r', title: 'X', date: '1994', country: 'GB',
    'label-info': [{ 'catalog-number': '[none]', label: { id: 'l1', name: 'Downwards' } }, { 'catalog-number': 'ABC 1', label: { id: 'l0', name: '[no label]' } }],
    media: [{ format: '12" Vinyl', 'track-count': 2, tracks: [{ recording: { id: 'rec', relations: [{ url: { resource: 'https://open.spotify.com/track/T' } }] } }] }, { format: '12" Vinyl', 'track-count': 2 }],
    relations: [{ url: { resource: 'https://open.spotify.com/album/A' } }, { url: { resource: 'https://www.discogs.com/release/9' } }, { url: { resource: 'https://example.org/x' } }],
    'release-group': { 'primary-type': 'EP', relations: [{ url: { resource: 'https://www.discogs.com/master/8' } }] },
    'cover-art-archive': { front: true }
  }, 'rec');
  assert.deepEqual(s.labels, [{ name: 'Downwards', mbid: 'l1', catno: null }, { name: null, mbid: null, catno: 'ABC 1' }]);
  assert.equal(s.selfReleased, true);
  assert.deepEqual(s.formats, ['2×12" Vinyl']);
  assert.equal(s.tracks, 4);
  assert.equal(s.cover, true);
  assert.deepEqual(s.links.spotify, { url: 'https://open.spotify.com/track/T', scope: 'recording' }, 'el enlace del tema gana al del lanzamiento');
  assert.deepEqual(s.links.discogs, { url: 'https://www.discogs.com/release/9', scope: 'release' }, 'la edición gana al máster');
  assert.equal(Object.keys(s.links).length, 2, 'los dominios desconocidos se ignoran');
});

function tempProject() {
  const root = mkdtempSync(join(tmpdir(), 'harmony-mb-'));
  mkdirSync(join(root, 'js/data'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  copyFileSync(new URL('../../js/data/genres.js', import.meta.url), join(root, 'js/data/genres.js'));
  writeFileSync(join(root, 'js/data/catalog.js'), CATALOG);
  return root;
}
const quiet = () => {};

test('importación completa contra el servidor falso', async () => {
  const root = tempProject();
  const fetchImpl = fakeFetch({ flaky: ['recording/' + id(700)] });
  const { records } = await M.run({ root, fetchImpl, minGap: 0, retryBase: 1, contact: 'test@example.org', log: quiet });

  // 1. caso limpio: grabación original, edición original, enlaces y portada
  const p = records.poing;
  assert.equal(p.status, 'matched');
  assert.equal(p.confidence, 'alta');
  assert.equal(p.apply, true);
  assert.equal(p.recording.id, id(10), 'descarta la remezcla');
  assert.equal(p.release.id, id(101), 'descarta recopilatorio y bootleg');
  assert.equal(p.year, 1992);
  assert.deepEqual(p.release.labels, [{ name: 'Rotterdam Records', mbid: id(5001), catno: 'TEST 001' }]);
  assert.equal(p.release.links.youtube.scope, 'recording');
  assert.equal(p.release.links.discogs.url, 'https://www.discogs.com/release/1-TEST');
  assert.equal(p.release.cover, true);
  // diseño real: portada y galleta de la cara A, descargadas a art/
  assert.equal(p.release.art.front.id, '11');
  assert.equal(p.release.art.label.id, '12', 'gana la foto de la cara A');
  assert.equal(p.release.art.front.url, 'https://coverartarchive.org/release/' + id(101) + '/11-500.jpg');
  assert.equal(p.release.art.front.file, 'art/' + id(101) + '-11.jpg');
  assert.deepEqual([...readFileSync(join(root, p.release.art.label.file))], [...JPEG]);
  assert.equal(records['surgeon-ep'].release.art, null, 'índice de Cover Art Archive inexistente: sin imágenes, sin error');
  assert.equal(records['make-it-loud'].release.art, null, 'sin portada en MusicBrainz no se pregunta');

  // 2. solo existe una edición de radio: se queda para revisar
  assert.equal(records.hsoc.status, 'matched');
  assert.equal(records.hsoc.confidence, 'media');
  assert.equal(records.hsoc.apply, false);

  // 3. año que faltaba, catálogo [none], dos discos
  assert.equal(records['make-it-loud'].year, 2003);
  assert.equal(records['make-it-loud'].release.labels[0].catno, null);
  assert.deepEqual(records['make-it-loud'].release.formats, ['2×12" Vinyl']);

  // 4. sin resultados en ninguna de las dos búsquedas
  assert.equal(records.nada.status, 'not-found');

  // 5. EP: grupo de lanzamientos, edición de 1994 y no la reedición de 2004
  const ep = records['surgeon-ep'];
  assert.equal(ep.kind, 'release-group');
  assert.equal(ep.release.id, id(401));
  assert.equal(ep.year, 1994);
  assert.equal(ep.release.links.discogs.scope, 'release-group');

  // 6. desacuerdo con un dato ya contrastado
  const diff = M.diffRecord({ year: 2009, ok: ['year'], label: null, release: null, catno: null, format: null }, records.scrap, { labels: [] });
  assert.deepEqual(diff.find((d) => d.field === 'year'), { field: 'year', name: 'Año', ed: 2009, mb: 2010, outcome: 'conflicto' });
  assert.equal(records.scrap.release.selfReleased, true);

  // 7. grabación fijada a mano (y un 503 en el camino que se reintenta)
  assert.equal(records.rainbow.pinned, true);
  assert.equal(records.rainbow.apply, true);
  assert.equal(records.rainbow.recording.credit, 'DJ Paul Elstak');
  assert.equal(fetchImpl.calls.filter((c) => c.url.includes('recording/' + id(700))).length, 2);
  // original en CD: se busca la primera edición en vinilo que no sea de remezclas, y su galleta
  assert.equal(M.formatKind(records.rainbow.release.formats), 'cd');
  assert.equal(records.rainbow.release.vinyl.id, id(703), 'salta el vinilo de remezclas');
  assert.equal(records.rainbow.release.vinyl.art.label.id, '32');
  assert.equal(records.rainbow.release.vinyl.art.label.file, 'art/' + id(703) + '-32.jpg');
  assert.equal(records.poing.release.vinyl, null, 'si el original ya es vinilo no se busca otro');

  // 7b. solo en recopilatorios: prueba las dos grabaciones y acaba en su single (título doble «A / B»), no en el de remezclas
  const d = records.domi;
  assert.equal(d.release.id, id(1911));
  assert.equal(d.apply, true);
  assert.ok(d.notes.some((n) => /single/.test(n)));
  assert.equal(d.year, 1991);

  // 7c. la única edición propia es una reedición de 2002 de un tema de 1995: a revisar
  assert.equal(records.late.apply, false);
  assert.ok(records.late.notes.some((n) => /posterior a la primera aparición/.test(n)));

  // 8. omitido
  assert.equal(records.skipme.status, 'skipped');
  assert.equal(fetchImpl.calls.some((c) => c.url.includes('Lo%20que%20sea') || c.url.includes('Lo+que+sea')), false);

  // salidas
  assert.ok(fetchImpl.calls.every((c) => c.ua === 'Harmony/0.4 ( test@example.org )'));
  const H = { window: {} }; vm.createContext(H);
  vm.runInContext(readFileSync(join(root, 'js/data/mb.js'), 'utf8'), H);
  assert.equal(Object.keys(H.window.H.data.mb.records).length, 10);
  const report = readFileSync(join(root, 'tools/mb-report.md'), 'utf8');
  assert.match(report, /\*\*Aplicados:\*\* 6/);
  assert.match(report, /\*\*en desacuerdo\*\*/);
  assert.match(report, /recording: '00000000-0000-4000-8000-000000000020'/);
  assert.match(report, /\[portada · galleta\]\(https:\/\/musicbrainz\.org\/release\/.+\/cover-art\)/);

  // caché: la segunda pasada no hace ni una petición
  const again = fakeFetch();
  await M.run({ root, fetchImpl: again, minGap: 0, retryBase: 1, contact: 'x', log: quiet });
  assert.equal(again.calls.length, 0);

  // --only conserva el resto de registros
  await M.run({ root, only: ['poing'], fetchImpl: fakeFetch(), minGap: 0, refresh: true, contact: 'x', log: quiet });
  const H2 = { window: {} }; vm.createContext(H2);
  vm.runInContext(readFileSync(join(root, 'js/data/mb.js'), 'utf8'), H2);
  assert.equal(Object.keys(H2.window.H.data.mb.records).length, 10);
});

test('--offline sin caché no sale a la red', async () => {
  const root = tempProject();
  const f = fakeFetch();
  const { records } = await M.run({ root, offline: true, fetchImpl: f, minGap: 0, log: quiet, write: false });
  assert.equal(f.calls.length, 0);
  assert.equal(records.poing.status, 'error');
  assert.ok(!existsSync(join(root, 'js/data/mb.js')));
});

test('respeta un segundo entre peticiones', async () => {
  const root = tempProject();
  const f = fakeFetch();
  const t0 = Date.now();
  await M.run({ root, only: ['make-it-loud'], fetchImpl: f, minGap: 150, log: quiet, write: false });
  assert.equal(f.calls.length, 3, 'búsqueda, ediciones del tema y lanzamiento');
  assert.ok(Date.now() - t0 >= 300, 'tres peticiones separadas por minGap');
});

test('formatos y edición en vinilo', () => {
  assert.equal(M.formatKind(['2×12" Vinyl']), 'vinyl');
  assert.equal(M.formatKind(['CD', '12" Vinyl']), 'vinyl');
  assert.equal(M.formatKind(['Enhanced CD']), 'cd');
  assert.equal(M.formatKind(['Digital Media']), 'digital');
  assert.equal(M.formatKind([]), null);
  const r = (id, date, format, o = {}) => ({ id, date, status: o.status || 'Official', media: [{ format }], 'release-group': { 'secondary-types': o.sec || [] } });
  assert.equal(M.pickVinyl([r('cd', '1995', 'CD'), r('v2', '1999', '12" Vinyl'), r('v1', '1996', '12" Vinyl')], 'cd').id, 'v1');
  assert.equal(M.pickVinyl([r('cd', '1995', 'CD'), r('comp', '1996', '12" Vinyl', { sec: ['Compilation'] })], 'cd'), null);
  assert.equal(M.pickVinyl([r('boot', '1996', '12" Vinyl', { status: 'Bootleg' })]), null);
});

test('Cover Art Archive: elección de portada y galleta', () => {
  const S = (images) => M.summarizeArt({ images }, 'R');
  const front = { id: 1, types: ['Front'], front: true };
  assert.equal(S([front]).label, null);
  assert.equal(S([front, { id: 2, types: ['Medium'], comment: '' }]).label.id, '2', 'una sola foto de la galleta');
  assert.equal(S([{ id: 3, types: ['Medium'], comment: 'Side B' }, { id: 4, types: ['Medium'], comment: '' }]).label.id, '4', 'la cara B, solo si no hay otra');
  assert.equal(S([{ id: 5, types: ['Back'] }]).front, null);
  assert.equal(S([{ id: 6, types: ['Front', 'Medium'], front: true }]).label, null, 'la portada no cuenta como galleta');
});

test('--no-art: no descarga, pero anota las imágenes que ya están en disco', async () => {
  const root = tempProject();
  const f = fakeFetch();
  const { records } = await M.run({ root, only: ['poing'], art: false, fetchImpl: f, minGap: 0, log: quiet });
  assert.equal(f.calls.filter((c) => c.url.endsWith('.jpg')).length, 0);
  assert.equal(records.poing.release.art.front.file, undefined);
  mkdirSync(join(root, 'art'), { recursive: true });
  writeFileSync(join(root, 'art', id(101) + '-11.jpg'), JPEG);
  const again = await M.run({ root, only: ['poing'], art: false, fetchImpl: fakeFetch(), minGap: 0, log: quiet });
  assert.equal(again.records.poing.release.art.front.file, 'art/' + id(101) + '-11.jpg');
  assert.equal(again.records.poing.release.art.label.file, undefined);
});

test('edición original: fuera recopilatorios sin marcar, emisiones, bandas sonoras y «Various Artists»', () => {
  const VA = [{ name: 'Various Artists', artist: { id: '89ad4ac3-39f7-470e-963a-56509c546377', name: 'Various Artists' } }];
  const ME = [{ name: 'Chimo Bayo', artist: { id: 'x', name: 'Chimo Bayo' } }];
  const r = (id, date, o = {}) => ({ id, date, status: 'Official', 'artist-credit': o.ac || ME, 'release-group': { 'primary-type': o.type || 'Single', 'secondary-types': o.sec || [] }, media: [{ format: o.format || '12" Vinyl' }] });
  const rels = [
    r('va', '1990', { ac: VA, type: 'Album' }),
    r('ost', '1989', { type: 'Album', sec: ['Soundtrack'] }),
    r('radio', '1988', { type: 'Broadcast' }),
    r('single', '1991')
  ];
  assert.equal(M.pickRelease(rels, { artists: ['Chimo Bayo'] }).id, 'single');
  assert.equal(M.isCompilation(rels[0]), true);
  const only = M.pickRelease([rels[0], rels[1]], { artists: ['Chimo Bayo'] });
  assert.equal(only.fromCompilation, true, 'si solo hay recopilatorios, se marca');
  // con varias ediciones propias, se prefiere la acreditada al artista
  const other = r('remixer', '1990', { ac: [{ name: 'Otro', artist: { id: 'y', name: 'Otro' } }] });
  assert.equal(M.pickRelease([other, r('own', '1991')], { artists: ['Chimo Bayo'] }).id, 'own');
});

test('emparejado: subtítulos de himno y nombres con apóstrofo', () => {
  const ctx = { title: 'The World Will Shiver', artists: ['Angerfist'] };
  const rr = M.rate({ title: 'The World Will Shiver (The Official Masters of Hardcore 2005 Anthem)', 'artist-credit': [{ name: 'Angerfist', artist: { name: 'Angerfist' } }] }, ctx);
  assert.equal(rr.level, 3);
  assert.ok(M.artistMatch(['Abel K Kaña'], [{ name: "Abel K'Kaña", artist: { name: "Abel K'Kaña" } }]).primary);
  assert.ok(!M.artistMatch(['Zany'], [{ name: 'Zanyx', artist: { name: 'Zanyx' } }]).primary, 'una sola palabra no usa el atajo');
});

test('limpieza de art/: solo se quedan las imágenes que usa algún registro', () => {
  const root = tempProject();
  mkdirSync(join(root, 'art'), { recursive: true });
  for (const f of ['usada.jpg', 'vieja.jpg', 'vinilo.jpg']) writeFileSync(join(root, 'art', f), JPEG);
  const records = { a: { status: 'matched', apply: true, release: { art: { front: { file: 'art/usada.jpg' } }, vinyl: { art: { label: { file: 'art/vinilo.jpg' } } } } } };
  assert.equal(M.pruneArt(records, { root }), 1);
  assert.ok(existsSync(join(root, 'art', 'usada.jpg')) && existsSync(join(root, 'art', 'vinilo.jpg')));
  assert.ok(!existsSync(join(root, 'art', 'vieja.jpg')));
});

test('edición original: sin ninguna edición del artista es recopilatorio; a igual año, el sello del archivo', () => {
  const ac = (n) => [{ name: n, artist: { id: n, name: n } }];
  const r = (id, date, o = {}) => ({ id, date, status: 'Official', 'artist-credit': o.ac, 'label-info': o.label ? [{ label: { name: o.label } }] : [], 'release-group': { 'primary-type': o.type || 'Album', 'secondary-types': [] }, media: [{ format: 'CD' }] });
  const foreign = M.pickRelease([r('a', '2005', { ac: ac('Traxtorm Records'), type: 'Other' })], { artists: ['Angerfist'] });
  assert.equal(foreign.fromCompilation, true);
  const lic = r('ru', '2007', { ac: ac('Scooter'), label: 'Танцевальный рай' });
  const orig = r('de', '2007-06-29', { ac: ac('Scooter'), label: 'Sheffield Tunes' });
  assert.equal(M.pickRelease([lic, orig], { artists: ['Scooter'], labels: ['Sheffield Tunes'] }).id, 'de');
  assert.equal(M.pickRelease([lic, orig], { artists: ['Scooter'] }).id, 'ru', 'sin sello en el archivo, manda la fecha');
});
