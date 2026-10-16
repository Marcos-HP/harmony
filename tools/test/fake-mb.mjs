/* Servidor falso de MusicBrainz para los tests.
   TODO lo que hay aquí es inventado (MBID, números de catálogo, enlaces): sirve para probar la lógica
   con la forma real de las respuestas JSON de la API, nunca debe acabar en el catálogo publicado. */

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const credit = (...names) => names.map((n, i) => ({ name: n, joinphrase: i < names.length - 1 ? ' & ' : '', artist: { id: id(900 + i), name: n.replace(/^DJ /, ''), 'sort-name': n } }));
const rel = (rid, title, date, { status = 'Official', type = 'Single', secondary = [], format = '12" Vinyl', country = 'NL' } = {}) =>
  ({ id: rid, title, status, date, country, 'release-group': { id: rid.replace(/^0/, '1'), 'primary-type': type, 'secondary-types': secondary }, media: [{ position: 1, format, 'track-count': 2 }] });
const url = (type, resource) => ({ type, 'target-type': 'url', url: { resource } });

export const IDS = { id };

/* catálogo mínimo con la misma forma que js/data/catalog.js */
export const CATALOG = `(function () {
  const H = (window.H = window.H || {});
  H.data = H.data || {};
  H.data.sources = { 'w-x': ['Wikipedia · prueba', 'https://example.org'] };
  H.data.labels = [ { id: 'rotterdam', name: 'Rotterdam Records', ok: [], src: [] }, { id: 'downwards', name: 'Downwards Records', ok: [], src: [] } ];
  H.data.artists = [
    { id: 'rts', name: 'Rotterdam Termination Source' }, { id: 'josh-wink', name: 'Josh Wink' },
    { id: 'blutonium-boy', name: 'Blutonium Boy' }, { id: 'nadie', name: 'Artista Inexistente' },
    { id: 'surgeon', name: 'Surgeon' }, { id: 'headhunterz', name: 'Headhunterz' },
    { id: 'paul-elstak', name: 'Paul Elstak' }, { id: 'zany', name: 'Zany' }, { id: 'hr', name: 'Human Resource' }
  ];
  const T = (n, id, title, artists, year, genre, o = {}) => ({ n, id, title, artists, year, genre, g2: null, bpm: null, label: null, release: null, kind: 'tema', format: null, catno: null, ok: [], src: [], note: null, tags: [], ...o });
  H.data.tracks = [
    T(1, 'poing', 'Poing', ['rts'], 1992, 'gabber', { label: 'rotterdam', ok: ['label'], src: ['w-x'] }),
    T(2, 'hsoc', 'Higher State of Consciousness', ['josh-wink'], 1995, 'acid-techno'),
    T(3, 'make-it-loud', 'Make It Loud', ['blutonium-boy'], null, 'hardstyle'),
    T(4, 'nada', 'Tema que no existe', ['nadie'], 2000, 'gabber'),
    T(5, 'surgeon-ep', 'Surgeon', ['surgeon'], 1994, 'hard-techno', { kind: 'ep' }),
    T(6, 'scrap', 'Scrap Attack', ['headhunterz'], 2009, 'hardstyle', { ok: ['year'], src: ['w-x'] }),
    T(7, 'rainbow', 'Rainbow in the Sky', ['paul-elstak'], 1995, 'happy-hardcore', { mb: { recording: '${id(700)}' } }),
    T(8, 'skipme', 'Lo que sea', ['zany'], 2001, 'hardstyle', { mb: { skip: true } }),
    T(9, 'domi', 'Dominator', ['hr'], 1991, 'early-hardcore'),
    T(10, 'late', 'Late Track', ['zany'], 1995, 'hardstyle')
  ];
})();
`;

const SEARCH = {
  'Poing': { recordings: [
    { id: id(11), score: 100, title: 'Poing (Remix)', 'artist-credit': credit('Rotterdam Termination Source'), 'first-release-date': '1993', releases: [rel(id(111), 'Poing (Remixes)', '1993')] },
    { id: id(10), score: 100, title: 'Poing', 'artist-credit': credit('Rotterdam Termination Source'), 'first-release-date': '1992', releases: [
      rel(id(102), 'Thunderdome', '1993', { type: 'Album', secondary: ['Compilation'], format: 'CD' }),
      rel(id(101), 'Poing', '1992-06', {}),
      rel(id(103), 'Poing', '1992-06', { status: 'Bootleg' })
    ] }
  ] },
  'Higher State of Consciousness': { recordings: [
    { id: id(20), score: 98, title: 'Higher State of Consciousness (Radio Edit)', 'artist-credit': credit('Josh Wink'), 'first-release-date': '1995', releases: [rel(id(201), 'Higher State of Consciousness', '1995')] }
  ] },
  'Make It Loud': { recordings: [
    { id: id(30), score: 100, title: 'Make It Loud', 'artist-credit': credit('Blutonium Boy'), 'first-release-date': '2003-02', releases: [rel(id(301), 'Make It Loud', '2003-02', { country: 'DE' })] }
  ] },
  'Scrap Attack': { recordings: [
    { id: id(60), score: 100, title: 'Scrap Attack', 'artist-credit': credit('Headhunterz'), 'first-release-date': '2010', releases: [rel(id(601), 'Scrap Attack', '2010')] }
  ] }
};

/* Dominator: sus dos grabaciones solo salen en recopilatorios; el single está en su propio grupo */
const VA = [{ name: 'Various Artists', joinphrase: '', artist: { id: '89ad4ac3-39f7-470e-963a-56509c546377', name: 'Various Artists' } }];
SEARCH['Dominator'] = { recordings: [
  { id: id(90), score: 100, title: 'Dominator', 'artist-credit': credit('Human Resource'), 'first-release-date': '1991',
    releases: [{ ...rel(id(901), 'Turn Up the Bass 16', '1991', { type: 'Album', format: 'CD' }), 'artist-credit': VA }] },
  { id: id(91), score: 98, title: 'Dominator', 'artist-credit': credit('Human Resource'), 'first-release-date': '1991',
    releases: [rel(id(902), 'Thunderdome', '1992', { type: 'Album', secondary: ['Compilation'], format: 'CD' })] }
] };

SEARCH['Late Track'] = { recordings: [
  { id: id(95), score: 100, title: 'Late Track', 'artist-credit': credit('Zany'), 'first-release-date': '1995',
    releases: [{ ...rel(id(951), 'Late Track', '2002', { format: 'Digital Media' }), 'artist-credit': credit('Zany') }] }
] };

const RELEASES = {
  [id(101)]: { id: id(101), title: 'Poing', status: 'Official', date: '1992-06', country: 'NL',
    'label-info': [{ 'catalog-number': 'TEST 001', label: { id: id(5001), name: 'Rotterdam Records' } }],
    media: [{ format: '12" Vinyl', 'track-count': 2, tracks: [{ recording: { id: id(10), relations: [url('free streaming', 'https://www.youtube.com/watch?v=TESTTESTTST')] } }] }],
    'release-group': { id: id(1101), title: 'Poing', 'primary-type': 'Single', 'secondary-types': [], 'first-release-date': '1992-06', relations: [] },
    relations: [url('discogs', 'https://www.discogs.com/release/1-TEST'), url('free streaming', 'https://www.youtube.com/watch?v=RELEASE0000')],
    'cover-art-archive': { artwork: true, front: true, count: 1 } },
  [id(201)]: { id: id(201), title: 'Higher State of Consciousness', status: 'Official', date: '1995', country: 'US',
    'label-info': [{ 'catalog-number': 'TEST 002', label: { id: id(5002), name: 'Strictly Rhythm' } }], media: [{ format: '12" Vinyl', 'track-count': 2 }],
    'release-group': { id: id(1201), 'primary-type': 'Single', 'secondary-types': [] }, relations: [], 'cover-art-archive': { front: false } },
  [id(301)]: { id: id(301), title: 'Make It Loud', status: 'Official', date: '2003-02', country: 'DE',
    'label-info': [{ 'catalog-number': '[none]', label: { id: id(5003), name: 'Blutonium Records' } }], media: [{ format: '12" Vinyl' }, { format: '12" Vinyl' }],
    'release-group': { id: id(1301), 'primary-type': 'Single', 'secondary-types': [] },
    relations: [url('free streaming', 'https://open.spotify.com/album/TESTALBUM')], 'cover-art-archive': { front: false } },
  [id(401)]: { id: id(401), title: 'Surgeon', status: 'Official', date: '1994', country: 'GB',
    'label-info': [{ 'catalog-number': 'TEST-EP1', label: { id: id(5004), name: 'Downwards' } }], media: [{ format: '12" Vinyl', 'track-count': 4 }],
    'release-group': { id: id(1401), title: 'Surgeon', 'primary-type': 'EP', 'secondary-types': [], 'first-release-date': '1994', relations: [url('discogs', 'https://www.discogs.com/master/2-TEST')] },
    relations: [], 'cover-art-archive': { front: true } },
  [id(601)]: { id: id(601), title: 'Scrap Attack', status: 'Official', date: '2010', country: 'NL',
    'label-info': [{ 'catalog-number': 'TEST 006', label: { id: id(5006), name: '[no label]' } }], media: [{ format: 'Digital Media' }],
    'release-group': { id: id(1601), 'primary-type': 'Single', 'secondary-types': [] }, relations: [], 'cover-art-archive': { front: false } },
  [id(1911)]: { id: id(1911), title: 'Dominator', status: 'Official', date: '1991', country: 'NL',
    'label-info': [{ 'catalog-number': 'TEST 019', label: { id: id(5019), name: 'Arcade' } }], media: [{ format: '12" Vinyl', 'track-count': 2 }],
    'release-group': { id: id(1901), title: 'Dominator / Dominator (Tribal Mix)', 'primary-type': 'Single', 'secondary-types': [], 'first-release-date': '1991', relations: [] },
    relations: [], 'cover-art-archive': { front: false } },
  [id(951)]: { id: id(951), title: 'Late Track', status: 'Official', date: '2002', country: 'XW', 'label-info': [], media: [{ format: 'Digital Media' }],
    'release-group': { id: id(1951), title: 'Late Track', 'primary-type': 'Single', 'secondary-types': [], relations: [] }, relations: [], 'cover-art-archive': { front: false } },
  [id(701)]: { id: id(701), title: 'Rainbow in the Sky', status: 'Official', date: '1995', country: 'NL',
    'label-info': [{ 'catalog-number': 'TEST 007', label: { id: id(5007), name: 'Rotterdam Records' } }], media: [{ format: 'CD' }],
    'release-group': { id: id(1701), 'primary-type': 'Single', 'secondary-types': [] }, relations: [], 'cover-art-archive': { front: false } }
};

const LOOKUP_RECORDING = {
  [id(700)]: { id: id(700), title: 'Rainbow in the Sky', 'artist-credit': credit('DJ Paul Elstak'), 'first-release-date': '1995',
    releases: [rel(id(701), 'Rainbow in the Sky', '1995', { format: 'CD' }), rel(id(702), 'Rainbow in the Sky (Remixes)', '1996-03', { secondary: ['Remix'] }), rel(id(703), 'Rainbow in the Sky', '1996-05')] }
};

const RG_SEARCH_SINGLES = {
  'Dominator': { 'release-groups': [
    { id: id(1902), score: 100, title: 'Dominator (remixes)', 'primary-type': 'Single', 'secondary-types': ['Remix'], 'first-release-date': '1992', 'artist-credit': credit('Human Resource') },
    { id: id(1901), score: 100, title: 'Dominator / Dominator (Tribal Mix)', 'primary-type': 'Single', 'first-release-date': '1991', 'artist-credit': credit('Human Resource') }
  ] }
};
const RG_SEARCH = {
  'Surgeon': { 'release-groups': [
    { id: id(1401), score: 100, title: 'Surgeon', 'primary-type': 'EP', 'first-release-date': '1994', 'artist-credit': credit('Surgeon') },
    { id: id(1402), score: 90, title: 'Surgeon', 'primary-type': 'Album', 'first-release-date': '2001', 'artist-credit': credit('Surgeon') }
  ] }
};

const BROWSE = {
  [id(1901)]: { releases: [
    { id: id(1911), title: 'Dominator', status: 'Official', date: '1991', media: [{ format: '12" Vinyl' }], 'artist-credit': credit('Human Resource') }
  ] },
  [id(1401)]: { releases: [
    { id: id(402), title: 'Surgeon', status: 'Official', date: '2004', media: [{ format: '12" Vinyl' }] },
    { id: id(401), title: 'Surgeon', status: 'Official', date: '1994', media: [{ format: '12" Vinyl' }] }
  ] }
};

/* Cover Art Archive: Poing tiene portada y dos fotos de la galleta (gana la cara A); Surgeon dice tener
   portada pero el índice no existe (404). */
const CAA_INDEX = {
  [id(101)]: { release: 'https://musicbrainz.org/release/' + id(101), images: [
    { id: 11, types: ['Front'], front: true, back: false, comment: '', approved: true },
    { id: 13, types: ['Medium'], front: false, back: false, comment: 'Side B', approved: true },
    { id: 12, types: ['Medium'], front: false, back: false, comment: 'Label, side A', approved: true }
  ] },
  // reedición en vinilo de un tema cuyo original es un CD
  [id(703)]: { release: 'https://musicbrainz.org/release/' + id(703), images: [
    { id: 31, types: ['Front'], front: true, back: false, comment: '', approved: true },
    { id: 32, types: ['Medium'], front: false, back: false, comment: 'A', approved: true }
  ] }
};
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

/* fetch falso: entiende las rutas que usa el importador. Opcional: fallar con 503 la primera vez. */
export function fakeFetch({ flaky = [] } = {}) {
  const calls = [];
  const failed = new Set();
  const fn = async (u, init) => {
    calls.push({ url: u, ua: init?.headers?.['User-Agent'] });
    const url = new URL(u);
    const path = url.pathname.replace('/ws/2/', '');
    const q = url.searchParams.get('query') || '';
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    const notFound = { ok: false, status: 404, json: async () => ({ error: 'Not Found' }), text: async () => 'Not Found' };
    if (flaky.some((f) => u.includes(f)) && !failed.has(u)) { failed.add(u); return { ok: false, status: 503, text: async () => 'slow down' }; }
    if (url.hostname === 'coverartarchive.org') {
      const ix = url.pathname.match(/^\/release\/([^/]+)\/?$/);
      if (ix) return CAA_INDEX[ix[1]] ? ok(CAA_INDEX[ix[1]]) : notFound;
      const im = url.pathname.match(/^\/release\/([^/]+)\/(\d+)-500\.jpg$/);
      if (im && CAA_INDEX[im[1]] && CAA_INDEX[im[1]].images.some((i) => String(i.id) === im[2])) return { ok: true, status: 200, arrayBuffer: async () => JPEG.buffer.slice(0) };
      return notFound;
    }
    if (url.searchParams.get('fmt') !== 'json') return { ok: false, status: 400, text: async () => 'fmt' };
    if (path === 'recording') {
      const m = q.match(/^recording:"(.+?)" AND artist:"(.+?)"$/);
      return ok(m && SEARCH[m[1]] ? SEARCH[m[1]] : { recordings: [] });
    }
    if (path === 'release-group') {
      const single = / AND \(primarytype:single OR primarytype:ep\)$/.test(q);
      const m = q.replace(/ AND \(primarytype:single OR primarytype:ep\)$/, '').match(/^releasegroup:"(.+?)" AND artist:"(.+?)"$/);
      const table = single ? RG_SEARCH_SINGLES : RG_SEARCH;
      return ok(m && table[m[1]] ? table[m[1]] : { 'release-groups': [] });
    }
    if (path === 'release' && url.searchParams.get('release-group')) return ok(BROWSE[url.searchParams.get('release-group')] || { releases: [] });
    const lk = path.match(/^(release|recording|release-group)\/(.+)$/);
    if (lk) {
      const table = { release: RELEASES, recording: LOOKUP_RECORDING, 'release-group': {} }[lk[1]];
      return table[lk[2]] ? ok(table[lk[2]]) : notFound;
    }
    return notFound;
  };
  fn.calls = calls;
  return fn;
}
