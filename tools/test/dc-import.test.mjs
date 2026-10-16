// node --test tools/test/dc-import.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import * as Z from '../dc-import.mjs';
import { fakeDiscogs } from './fake-dc.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const ONLY = ['anonim-vol-3', 'anonim-4', 'poing', 'pildo', 'elements'];
const TOKEN = 'token-de-prueba-123';

/* Copia del catálogo real con los registros fijados apuntando a las ediciones del Discogs falso */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'harmony-dc-'));
  mkdirSync(join(root, 'js/data'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'js/data/genres.js'), readFileSync(join(ROOT, 'js/data/genres.js'), 'utf8'));
  const cat = readFileSync(join(ROOT, 'js/data/catalog.js'), 'utf8')
    .replace('dc: { release: 597824 }', 'dc: { release: 90003 }')
    .replace(/dc: \{ release: (?!90003|365589)\d+ \}, /g, '')
    .replace('dc: { release: 365589 }', 'dc: { release: 90004 }');
  writeFileSync(join(root, 'js/data/catalog.js'), cat);
  // MusicBrainz ya enlaza Poing con su edición en Discogs
  writeFileSync(join(root, 'js/data/mb.js'), `(function(){const H=(window.H=window.H||{});H.data=H.data||{};H.data.mb={records:{poing:{apply:true,status:'matched',year:1992,release:{links:{discogs:{url:'https://www.discogs.com/release/90010',scope:'release'}}}}}};})();`);
  return root;
}
const run = (root, o = {}) => Z.run({ root, only: ONLY, fetchImpl: o.fetch || fakeDiscogs(), token: o.token ?? TOKEN, minGap: 0, retryBase: 1, contact: 'test', log: () => {}, ...o });

test('lectura: formatos, fechas, créditos y vídeos por corte', () => {
  assert.deepEqual(Z.fmtES([{ name: 'Vinyl', qty: '2', descriptions: ['12"', '33 ⅓ RPM'] }, { name: 'CD', qty: '1', descriptions: ['Album'] }]), ['Vinilo 2×12″', 'CD']);
  assert.deepEqual(Z.fmtES([{ name: 'File', qty: '2', descriptions: ['MP3'] }]), ['Digital']);
  assert.equal(Z.typeES([{ name: 'Vinyl', descriptions: ['12"', 'Maxi-Single'] }]), 'Maxisingle');
  assert.equal(Z.cleanDate('1998-00-00'), '1998');
  assert.equal(Z.cleanDate('1997-11-17'), '1997-11-17');
  assert.equal(Z.cleanName('Cyberia (4)'), 'Cyberia');
  assert.equal(Z.artistLine([{ name: 'Anonim', join: 'Featuring' }, { name: 'Cyberia (4)' }]), 'Anonim Featuring Cyberia');
  assert.equal(Z.artistLine([{ name: 'Skudero', join: '&' }, { name: 'Xavi Metralla' }]), 'Skudero & Xavi Metralla');
  assert.deepEqual(Z.idFromUrl('https://www.discogs.com/es/release/597824-Anonim-Anonim-Vol-3'), { kind: 'release', id: 597824 });
  assert.deepEqual(Z.idFromUrl('https://www.discogs.com/master/3294907'), { kind: 'master', id: 3294907 });

  const tracks = [{ title: 'Anonim 3 (Vocal Mix)', duration: '8:18' }, { title: 'Anonim 3 (Dragon Mix)', duration: '8:18' }, { title: 'Moskito 2 (Raid Version)', duration: '5:22' }];
  const vids = [{ title: 'Anonim 3 (Dragon Mix)', duration: 505 }, { title: 'Anonim - Anonim', duration: 2300 }, { title: 'Moskito 2 (Raid Version)', duration: 321 }];
  assert.deepEqual(Z.matchVideos(tracks, vids), [null, 0, 2], 'con varias mezclas del mismo tema, la versión decide; el vídeo de la cara entera no va con ningún corte');
  const t4 = [{ title: 'Anonim 4 (Up Mix)' }, { title: 'Anonim 3 (Over Out Mix)' }];
  assert.deepEqual(Z.matchVideos(t4, [{ title: 'Anonim 3 (Over Out Mix)' }, { title: 'Anonim - Anonim 4 (Up Mix)' }]), [1, 0]);
});

test('importación completa contra el Discogs falso', async () => {
  const root = project();
  const fetch = fakeDiscogs();
  const { records, report } = await run(root, { fetch });
  const R = (id) => records[id];

  // fijado a mano
  assert.equal(R('anonim-vol-3').status, 'matched');
  assert.equal(R('anonim-vol-3').pinned, true);
  assert.equal(R('anonim-vol-3').release.released, '1998');
  assert.deepEqual(R('anonim-vol-3').release.formats, ['Vinilo 12″']);
  assert.equal(R('anonim-vol-3').release.type, 'Maxisingle');
  assert.equal(R('anonim-vol-3').release.tracks.length, 4, 'sin la cabecera «Cara A»');
  assert.deepEqual(R('anonim-vol-3').release.tracks.map((x) => x.video && x.video.slice(-11)), [null, 'fakeDragon1', null, 'fakeMoskit2']);
  assert.equal(R('anonim-vol-3').release.image.file, 'art/dc-90003.jpg');
  assert.ok(existsSync(join(root, 'art/dc-90003.jpg')));

  // enlazado desde MusicBrainz, sin buscar
  assert.equal(R('poing').via, 'MusicBrainz');
  assert.equal(R('poing').apply, true);
  assert.ok(!fetch.calls.some((c) => /search.*Poing/i.test(c.url)));

  // búsqueda: gana el vinilo original del artista, no el recopilatorio de un año antes
  assert.equal(R('pildo').status, 'matched');
  assert.equal(R('pildo').release.id, 90020);
  assert.equal(R('pildo').apply, true);
  assert.equal(R('pildo').confidence, 'alta');

  assert.equal(R('elements').status, 'not-found');

  // el token va en la cabecera de la API, nunca en la URL ni en la caché, y no se manda al servidor de imágenes
  assert.ok(fetch.calls.filter((c) => c.url.startsWith('https://api.discogs.com/')).every((c) => c.headers.Authorization === 'Discogs token=' + TOKEN));
  assert.ok(fetch.calls.filter((c) => !c.url.startsWith('https://api.discogs.com/')).every((c) => !c.headers.Authorization));
  assert.ok(fetch.calls.every((c) => !c.url.includes(TOKEN)));
  const cacheFiles = readdirSync(join(root, 'tools/cache'), { recursive: true }).filter((f) => String(f).endsWith('.json'));
  assert.ok(cacheFiles.length > 0);
  assert.ok(cacheFiles.every((f) => !readFileSync(join(root, 'tools/cache', String(f)), 'utf8').includes(TOKEN)));
  assert.ok(!readFileSync(join(root, 'js/data/dc.js'), 'utf8').includes(TOKEN));

  // informe: el desacuerdo de año de Anonim 4 se anuncia
  assert.match(report, /Anonim 4.*year: 1999 → 2000 \(\*\*desacuerdo\*\*/);
  assert.match(report, /## Sin encontrar[\s\S]*Elements/);

  // repetir sale de la caché
  const again = await run(root, { fetch: fakeDiscogs() });
  assert.equal(again.meta.requests, 0);
});

test('sin token: solo fijados y enlazados desde MusicBrainz', async () => {
  const root = project();
  const { records, report } = await run(root, { token: '' });
  assert.equal(records['anonim-vol-3'].status, 'matched');
  assert.equal(records.poing.status, 'matched');
  assert.equal(records.pildo.status, 'not-searched');
  assert.match(report, /Sin buscar \(falta token\):\*\* 2/);
});

test('fusión de Discogs en el archivo', async () => {
  const root = project();
  await run(root);
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const f of [join(ROOT, 'js/lib/util.js'), join(root, 'js/data/genres.js'), join(root, 'js/data/catalog.js'), join(root, 'js/data/dc.js'), join(ROOT, 'js/lib/archive.js')]) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
  const H = ctx.window.H;
  H.A.init();
  const t = H.A.t;
  assert.equal(H.A.dcStats.applied, 4);

  // ya contrastado con la página de Discogs: coincide (el n.º de catálogo solo cambia en los espacios)
  const v3 = t['anonim-vol-3'];
  assert.equal(v3.catno, 'NM5087MX');
  assert.equal(v3.okBy.catno, 'Discogs');
  assert.equal(v3.conflicts.length, 0);
  assert.equal(v3.cover, 'art/dc-90003.jpg');
  assert.equal(v3.artBy, 'Discogs');
  assert.equal(v3.fmtKind, 'vinyl');
  assert.equal(v3.sides.length, 4);
  assert.equal(v3.links.discogs.url, 'https://www.discogs.com/release/90003');
  assert.equal(v3.releaseInfo.type, 'Maxisingle');
  assert.ok(v3.src.includes('dc-rel:anonim-vol-3'), 'otra edición que la citada: se añade como fuente');

  // contrastado y en desacuerdo: se mantiene y se marca
  const a4 = t['anonim-4'];
  assert.equal(a4.year, 1999);
  assert.deepEqual(JSON.parse(JSON.stringify(a4.conflicts)), [{ field: 'year', ed: 1999, by: 'Discogs', other: 2000, otherBy: 'Discogs' }]);

  // dato editorial: pasa a contrastado por Discogs; sello nuevo creado
  const p = t.pildo;
  assert.equal(p.catno, 'INV 001');
  assert.equal(p.okBy.catno, 'Discogs');
  assert.equal(p.L.name, 'Sello Inventado');
  assert.equal(p.format, 'Vinilo 12″');
  assert.equal(p.links.youtube, undefined, 'sin vídeo de su corte');

  // tema con vídeo de su corte: enlace directo a YouTube
  assert.equal(t.poing.links.youtube.url, 'https://www.youtube.com/watch?v=fakePoing01');
  assert.equal(H.A.status(t.poing, 'catno'), 'ok');
});
