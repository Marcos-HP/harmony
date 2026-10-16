// node --test tools/test/dz-import.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import * as Z from '../dz-import.mjs';
import { CATALOG, IDS } from './fake-mb.mjs';
import { fakeDeezer } from './fake-dz.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;

function project() {
  const root = mkdtempSync(join(tmpdir(), 'harmony-dz-'));
  mkdirSync(join(root, 'js/data'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'js/data/genres.js'), readFileSync(join(ROOT, 'js/data/genres.js'), 'utf8'));
  // «Scrap Attack» fijado a mano en Deezer
  writeFileSync(join(root, 'js/data/catalog.js'), CATALOG.replace("{ ok: ['year'], src: ['w-x'] }", "{ ok: ['year'], src: ['w-x'], dz: { track: 50 } }"));
  // capa de MusicBrainz mínima: Poing tiene grabación, y MusicBrainz conoce su ISRC
  writeFileSync(join(root, 'js/data/mb.js'), `(function(){const H=(window.H=window.H||{});H.data=H.data||{};H.data.mb={records:{poing:{apply:true,status:'matched',recording:{id:'${IDS.id(10)}'}}}};})();`);
  return root;
}
const run = (root, extra = {}) => Z.run({ root, fetchImpl: fakeDeezer(extra), minGap: 0, mbGap: 0, retryBase: 1, contact: 'test', log: () => {} });

test('emparejado: la misma producción vale, una remezcla no', () => {
  const q = { title: 'Poing', artists: ['Rotterdam Termination Source'] };
  const t = (title, version, artist = 'Rotterdam Termination Source') => ({ title: version ? title + ' ' + version : title, title_short: title, title_version: version, artist: { name: artist } });
  assert.equal(Z.rateTrack(t('Poing!', '(Extended Mix)'), q).level, 3);
  assert.equal(Z.rateTrack(t('Poing', '(Radio Edit)'), q).level, 3);
  assert.equal(Z.rateTrack(t('Poing', '(Original Mix)'), q).level, 3);
  assert.ok(Z.rateTrack(t('Poing', '(Remix)'), q).level < 3);
  assert.ok(Z.rateTrack(t('Poing', '(Armin van Buuren Mix)'), q).level < 3, 'una mezcla con nombre es otra versión');
  assert.ok(Z.rateTrack(t('Poing', '(VIP Mix)'), q).level < 3);
  assert.equal(Z.rateTrack(t('Poing', '', 'Otro Artista'), q).level, 0);
  // casos reales de la primera importación: nombres propios entre paréntesis = otra versión
  const lv = (qt, title, version, artist) => Z.rateTrack(t(title, version, artist), { title: qt, artists: [artist] }).level;
  assert.ok(lv('Dominator', 'Dominator', '(Slim Shore Edit)', 'Human Resource') < 3);
  assert.ok(lv('Acperience 1', 'Acperience 1', '(Robert Babicz Spacefunkmix)', 'Hardfloor') < 3);
  assert.ok(lv('Luv U More', 'Luv U More', "(K&A's Radio Blast)", 'Paul Elstak') < 3);
  assert.ok(lv('Holiday', 'Holiday', '(2k12 Mach 10 Hardstyle Jump Edit)', 'Patrick Jumpen') < 3);
  assert.ok(lv('Next Dimensional World', 'Next Dimensional World', '(Fitness Version)', 'Technoboy') < 3);
  assert.ok(lv('Pildo', 'Pildo', '(Space Version)', 'Pastis & Buenri') < 3);
  assert.ok(lv('Flying Free', 'Flying Free', '(20th Anniversary - Radio Edit)', 'Skudero') < 3);
  assert.ok(lv('U (I Got a Feeling)', 'U (I Got A Feeling)', '(Eats Everything Reebeef)', 'Scot Project') < 3);
  assert.equal(lv('U (I Got a Feeling)', 'U (I Got A Feeling)', '', 'Scot Project'), 3, 'el paréntesis del propio título no es versión');
  assert.equal(lv('The Power of the Mind', 'The Power of the Mind', '(Qlimax Anthem 2007)', 'Headhunterz'), 3, 'subtítulo de himno');
  assert.equal(lv('Next Dimensional World', 'Next Dimensional World', '(Qlimax Anthem 2008) (Extended Version)', 'Technoboy'), 3);
  assert.equal(lv('Scrap Attack', 'Scrap Attack', '(Defqon.1 2009 anthem) (Original Mix)', 'Headhunterz'), 3);
  assert.equal(lv('We Have Arrived', 'We Have Arrived', '(Remastered)', 'Mescalinum United'), 3);
  assert.equal(lv('Life Is Too Short', 'Life Is Too Short', '(Video Cut)', 'Kai Tracid'), 3);
  assert.equal(lv('Make It Loud', 'Make It Loud', '(Radio Mix)', 'Blutonium Boy'), 3);
  assert.equal(lv('Dance for Eternity', 'Dance For Eternity', '(Club Mix)', 'Kai Tracid'), 3);
  assert.equal(lv('Lose My Mind', 'Lose My Mind - Radio Edit', '', 'Brennan Heart'), 3, 'versión tras un guion');
  const duo = { title: 'Pont Aeri', artists: ['DJ Skudero', 'Xavi Metralla'] };
  assert.equal(Z.rateTrack(t('Pont Aeri', '', 'Skudero & Xavi Metralla'), duo).level, 3);
});

test('importación completa contra el Deezer falso', async () => {
  const root = project();
  const { records, report } = await run(root, { quota: ['/search/track?q=Blutonium'] });
  const r = records;
  // Poing: gana la versión cuyo ISRC coincide con MusicBrainz, aunque haya otras antes en la búsqueda
  assert.equal(r.poing.apply, true);
  assert.equal(r.poing.verified, true);
  assert.equal(r.poing.confidence, 'verificada');
  assert.equal(r.poing.track.id, 2);
  assert.equal(r.poing.track.version, '(Extended Mix)');
  assert.equal(r.poing.track.link, 'https://www.deezer.com/track/2');
  assert.equal(r.poing.track.preview, undefined, 'la URL de la muestra caduca: no se guarda');
  // solo una remezcla dentro de una sesión mezclada: a revisar
  assert.equal(r.hsoc.status, 'matched');
  assert.equal(r.hsoc.apply, false);
  // recopilatorio sin mezclar, mismo título y artista: vale, con nota (y tras un error de cuota, reintenta)
  assert.equal(r['make-it-loud'].apply, true);
  assert.equal(r['make-it-loud'].confidence, 'alta');
  assert.ok(r['make-it-loud'].notes.some((n) => /recopilatorio/.test(n)));
  // sin muestra en la edición original: toma la que sí la tiene
  assert.equal(r.rainbow.apply, true);
  assert.equal(r.rainbow.track.id, 41);
  // EP: primer corte del lanzamiento
  assert.equal(r['surgeon-ep'].apply, true);
  assert.equal(r['surgeon-ep'].track.id, 30);
  assert.ok(r['surgeon-ep'].notes[0].includes('Primer corte'));
  // fijado a mano
  assert.equal(r.scrap.apply, true);
  assert.equal(r.scrap.pinned, true);
  assert.equal(r.scrap.track.id, 50);
  // lo que no está
  assert.equal(r.nada.status, 'not-found');
  // salidas
  const out = readFileSync(join(root, 'js/data/dz.js'), 'utf8');
  assert.ok(out.includes('H.data.dz'));
  assert.ok(!/cdnt-preview|hdnea/.test(out), 'ninguna URL de audio en los datos publicados');
  assert.ok(report.includes('## Con muestra') && report.includes('## Para revisar') && report.includes('## Sin encontrar'));
  assert.ok(report.includes('dz: { track: 10 }'));
});

test('la web fusiona la capa de Deezer: solo lo aplicado tiene muestra', async () => {
  const root = project();
  await run(root);
  const ctx = { window: {}, console }; ctx.window.window = ctx.window; vm.createContext(ctx);
  for (const f of [join(ROOT, 'js/lib/util.js'), join(root, 'js/data/genres.js'), join(root, 'js/data/catalog.js'), join(root, 'js/data/dz.js'), join(ROOT, 'js/lib/archive.js')]) vm.runInContext(readFileSync(f, 'utf8'), ctx);
  const A = ctx.window.H.A; A.init();
  assert.equal(A.t.poing.dz.id, 2);
  assert.equal(A.t.poing.dz.verified, true);
  assert.equal(A.t.hsoc.dz, null);
  assert.equal(A.t.nada.dz, null);
  assert.equal(A.dzStats.applied, 5, 'poing, make-it-loud, rainbow, surgeon-ep, scrap');
  assert.equal(A.t.poing.links.deezer.url, 'https://www.deezer.com/track/2');
});
