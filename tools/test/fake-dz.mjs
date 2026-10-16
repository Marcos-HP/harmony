/* Servidor falso de Deezer (y de los ISRC de MusicBrainz) para los tests.
   TODO lo que hay aquí es inventado: identificadores, ISRC, álbumes y URL de muestra. Sirve para probar la
   lógica con la forma real de las respuestas JSON de la API; nunca debe acabar en la web publicada. */
import { IDS } from './fake-mb.mjs';
const id = IDS.id;

const art = (name) => ({ id: name.length * 1000, name });
const tr = (tid, title, version, artist, album, { preview = true, isrc = null, contributors = null } = {}) => ({
  id: tid, title: version ? `${title} ${version}` : title, title_short: title, title_version: version || '', duration: 300, rank: 500000 - tid,
  preview: preview ? `https://cdnt-preview.example.test/${tid}.mp3?hdnea=exp=1` : '',
  artist: art(artist), album: { id: album, title: ALBUMS[album].title }, type: 'track',
  ...(isrc ? { isrc } : {}), ...(contributors ? { contributors: contributors.map(art) } : {})
});
const ALBUMS = {
  501: { title: 'Poing', record_type: 'single', release_date: '1992-06-01', label: 'Rotterdam Records', artist: 'Rotterdam Termination Source' },
  502: { title: 'Poing (Remixes)', record_type: 'single', release_date: '1993-01-01', label: 'Rotterdam Records', artist: 'Rotterdam Termination Source' },
  503: { title: 'Thunderdome XXL (Mixed by DJ Prueba)', record_type: 'compile', release_date: '2009-01-01', label: 'ID&T', artist: 'Various Artists' },
  504: { title: 'Hardstyle Top 100', record_type: 'compile', release_date: '2012-01-01', label: 'Cloud 9', artist: 'Various Artists' },
  505: { title: 'Surgeon', record_type: 'ep', release_date: '1994-01-01', label: 'Downwards', artist: 'Surgeon' },
  506: { title: 'Happy Hardcore Top 100', record_type: 'compile', release_date: '2014-01-01', label: 'Cloud 9', artist: 'Various Artists' },
  507: { title: 'Rainbow in the Sky', record_type: 'single', release_date: '1995-01-01', label: 'Rotterdam Records', artist: 'Paul Elstak' },
  508: { title: 'Scrap Attack', record_type: 'single', release_date: '2010-01-01', label: 'Scantraxx', artist: 'Headhunterz' }
};
const TRACKS = {
  1: tr(1, 'Poing', '(Remix)', 'Rotterdam Termination Source', 502),
  2: tr(2, 'Poing!', '(Extended Mix)', 'Rotterdam Termination Source', 501, { isrc: 'NLA109200001' }),
  3: tr(3, 'Poing', '', 'Rotterdam Termination Source', 503, { isrc: 'NLA109200099' }),
  10: tr(10, 'Higher State of Consciousness', '(Tweekend Remix)', 'Josh Wink', 503),
  20: tr(20, 'Make It Loud', '', 'Blutonium Boy', 504),
  30: tr(30, 'Surgeon Track One', '', 'Surgeon', 505),
  31: tr(31, 'Surgeon Track Two', '', 'Surgeon', 505),
  40: tr(40, 'Rainbow in the Sky', '', 'Paul Elstak', 507, { preview: false }),
  41: tr(41, 'Rainbow in the Sky', '', 'Paul Elstak', 506),
  50: tr(50, 'Scrap Attack', '(Radio Edit)', 'Headhunterz', 508)
};
const SEARCH_TRACK = {
  'Rotterdam Termination Source Poing': [1, 3, 2],
  'Josh Wink Higher State of Consciousness': [10],
  'Higher State of Consciousness': [10],
  'Blutonium Boy Make It Loud': [20],
  'Paul Elstak Rainbow in the Sky': [40, 41]
};
const SEARCH_ALBUM = { 'Surgeon Surgeon': [505] };
const ISRCS = { [id(10)]: ['NLA109200001'] };

const full = (t) => ({ ...t, isrc: t.isrc || 'XXX' + t.id, release_date: ALBUMS[t.album.id].release_date, contributors: t.contributors || [t.artist] });
const album = (aid) => ({ id: aid, title: ALBUMS[aid].title, record_type: ALBUMS[aid].record_type, release_date: ALBUMS[aid].release_date, label: ALBUMS[aid].label,
  artist: art(ALBUMS[aid].artist), tracks: { data: Object.values(TRACKS).filter((t) => t.album.id === aid) } });

/* fetch falso. quota: la primera petición a esas URL devuelve el error de cuota de Deezer (HTTP 200 con {error}). */
export function fakeDeezer({ quota = [] } = {}) {
  const calls = [];
  const hit = new Set();
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const fn = async (u) => {
    calls.push(u);
    const url = new URL(u);
    if (quota.some((q) => u.includes(q)) && !hit.has(u)) { hit.add(u); return json({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }); }
    if (url.hostname === 'musicbrainz.org') {
      const m = url.pathname.match(/recording\/([^/]+)$/);
      return m && ISRCS[m[1]] ? json({ id: m[1], isrcs: ISRCS[m[1]] }) : new Response('{}', { status: 404 });
    }
    if (url.hostname !== 'api.deezer.com') return new Response('', { status: 404 });
    const p = url.pathname;
    if (p === '/search/track') return json({ data: (SEARCH_TRACK[url.searchParams.get('q')] || []).map((n) => TRACKS[n]), total: 0 });
    if (p === '/search/album') return json({ data: (SEARCH_ALBUM[url.searchParams.get('q')] || []).map((a) => ({ id: a, title: ALBUMS[a].title, artist: art(ALBUMS[a].artist) })) });
    let m = p.match(/^\/track\/(\d+)$/);
    if (m) return TRACKS[m[1]] ? json(full(TRACKS[m[1]])) : json({ error: { type: 'DataException', message: 'no data', code: 800 } });
    m = p.match(/^\/album\/(\d+)$/);
    if (m) return ALBUMS[m[1]] ? json(album(+m[1])) : json({ error: { type: 'DataException', message: 'no data', code: 800 } });
    return json({ error: { type: 'DataException', message: 'no data', code: 800 } });
  };
  fn.calls = calls;
  return fn;
}
