/* Servidor falso de Discogs para los tests.
   TODO lo que hay aquí es inventado (identificadores, fechas, n.º de catálogo, vídeos): sirve para probar
   la lógica con la forma real de las respuestas JSON de la API; nunca debe acabar en la web publicada. */

const A = (name, join = '') => ({ name, anv: '', join });
const fmt = (name, ...descriptions) => ({ name, qty: '1', descriptions });
const T = (position, title, duration) => ({ position, type_: 'track', title, duration });
const V = (id, title, duration) => ({ uri: 'https://www.youtube.com/watch?v=' + id, title, duration, embed: true });
const img = (id) => [{ type: 'primary', uri: `https://i.discogs.example.test/${id}.jpeg`, width: 600, height: 600 }];

export const RELEASES = {
  90003: {
    id: 90003, title: 'Anonim Vol. 3', artists: [A('Anonim')], year: 1998, released: '1998-00-00', country: 'Spain',
    labels: [{ name: "DJ's At Work", catno: 'NM 5087 MX', id: 7001 }], formats: [fmt('Vinyl', '12"', '33 ⅓ RPM', 'Maxi-Single')],
    tracklist: [{ position: '', type_: 'heading', title: 'Cara A' }, T('A1', 'Anonim 3 (Vocal Mix)', '8:18'), T('A2', 'Anonim 3 (Dragon Mix)', '8:18'), T('B1', 'Anonim 3 (Double Mix)', '8:48'), T('B2', 'Moskito 2 (Raid Version)', '5:22')],
    videos: [V('fakeDragon1', 'Anonim 3 (Dragon Mix)', 505), V('fakeMoskit2', 'Anonim - Moskito 2 (Raid Version)', 321), V('fakeWhole03', 'Anonim - Anonim (cara entera)', 2300)],
    images: img(90003), master_id: 80003
  },
  90004: {
    id: 90004, title: 'Anonim 4', artists: [A('Anonim')], year: 2000, released: '2000', country: 'Spain',
    labels: [{ name: 'Bit Music', catno: '71-429', id: 7002 }], formats: [fmt('Vinyl', '12"', '33 ⅓ RPM')],
    tracklist: [T('A1', 'Anonim 4 (Up Mix)', '6:52'), T('A2', 'Anonim 3 (Over Out Mix)', '6:05')],
    videos: [], images: [], master_id: null
  },
  // enlazado desde MusicBrainz
  90010: {
    id: 90010, title: 'Poing', artists: [A('Rotterdam Termination Source')], year: 1992, released: '1992', country: 'Netherlands',
    labels: [{ name: 'Rotterdam Records', catno: 'ROT 999', id: 7003 }], formats: [fmt('Vinyl', '12"')],
    tracklist: [T('A', 'Poing', '4:00'), T('B', 'Poing (Remix)', '4:30')], videos: [V('fakePoing01', 'Rotterdam Termination Source - Poing', 238)], images: img(90010)
  },
  // búsqueda: el original en vinilo y un recopilatorio anterior que no vale
  90020: {
    id: 90020, title: 'Pildo', artists: [A('Pastis & Buenri')], year: 1996, released: '1996-03-00', country: 'Spain',
    labels: [{ name: 'Sello Inventado', catno: 'INV 001', id: 7004 }], formats: [fmt('Vinyl', '12"', 'Maxi-Single')],
    tracklist: [T('A', 'Pildo (Original Mix)', '6:00'), T('B', 'Pildo (Space Version)', '6:10')], videos: [], images: img(90020)
  },
  90021: {
    id: 90021, title: 'Mákina Inventada 96', artists: [A('Various')], year: 1995, released: '1995', country: 'Spain',
    labels: [{ name: 'Otro Sello', catno: 'OS 1', id: 7005 }], formats: [fmt('CD', 'Compilation')],
    tracklist: [T('1', 'Pildo', '5:00')], videos: [], images: []
  }
};

const SEARCH = {
  'Pastis & Buenri|Pildo': [90021, 90020],
  'Pastis & Buenri Pildo': [90020]
};

/* fetch falso. Guarda las cabeceras de cada petición en `calls` para comprobar el token. */
export function fakeDiscogs() {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), headers: { ...(opts.headers || {}) } });
    const u = new URL(url);
    const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.hostname === 'i.discogs.example.test') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200 });
    if (u.hostname !== 'api.discogs.com') return new Response('', { status: 404 });
    let m;
    if ((m = /^\/releases\/(\d+)$/.exec(u.pathname))) return RELEASES[m[1]] ? json(RELEASES[m[1]]) : new Response('{"message":"Release not found."}', { status: 404 });
    if ((m = /^\/masters\/(\d+)$/.exec(u.pathname))) return m[1] === '80003' ? json({ id: 80003, main_release: 90003 }) : new Response('', { status: 404 });
    if (u.pathname === '/database/search') {
      if (!(opts.headers || {}).Authorization) return new Response('{"message":"You must authenticate to access this resource."}', { status: 401 });
      const p = u.searchParams;
      const k = p.get('q') || (p.get('artist') + '|' + (p.get('track') || p.get('release_title')));
      const ids = SEARCH[k] || [];
      return json({ pagination: { items: ids.length }, results: ids.map((id) => ({ id, type: 'release', title: RELEASES[id].artists.map((a) => a.name).join(' ') + ' - ' + RELEASES[id].title, year: String(RELEASES[id].year), format: RELEASES[id].formats.map((x) => x.name) })) });
    }
    return new Response('', { status: 404 });
  };
  f.calls = calls;
  return f;
}
