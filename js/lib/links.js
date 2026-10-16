/* HARMONY · enlaces externos
   Ningún enlace es inventado. Los directos vienen de MusicBrainz (relaciones URL del lanzamiento o de
   la grabación, importadas con tools/mb-import.mjs); cuando no hay, se construye una búsqueda en el
   servicio y la interfaz lo dice («búsqueda»). */
(function () {
  const H = (window.H = window.H || {});
  const q = (s) => encodeURIComponent(s);
  const SCOPE = { recording: 'tema', release: 'lanzamiento', 'release-group': 'todas las ediciones' };
  const NAMES = { bandcamp: 'Bandcamp', beatport: 'Beatport', deezer: 'Deezer', apple: 'Apple Music', soundcloud: 'SoundCloud', tidal: 'Tidal' };

  function query(t) {
    const main = t.artists[0] === 'various' ? '' : t.A.map((a) => a.name).join(' ');
    return (main + ' ' + t.title).trim();
  }
  const direct = (name, l) => ({ name, url: l.url, direct: true, scope: SCOPE[l.scope] || null });
  const ytId = (u) => { try { const x = new URL(u); return x.hostname === 'youtu.be' ? x.pathname.slice(1) : x.searchParams.get('v'); } catch (e) { return null; } };

  H.Links = {
    listen(t) {
      const s = query(t);
      const d = t.links || {};
      const yt = d.youtube && d.youtube.scope === 'recording' ? ytId(d.youtube.url) : null;
      return {
        spotify: d.spotify ? direct('Spotify', d.spotify) : { name: 'Spotify', url: 'https://open.spotify.com/search/' + q(s), direct: false },
        ytmusic: yt ? { name: 'YouTube Music', url: 'https://music.youtube.com/watch?v=' + q(yt), direct: true, scope: 'tema' } : { name: 'YouTube Music', url: 'https://music.youtube.com/search?q=' + q(s), direct: false },
        youtube: d.youtube ? direct('YouTube', d.youtube) : { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=' + q(s), direct: false }
      };
    },
    // Otros servicios con enlace directo verificado (sin búsquedas: si no hay enlace, no aparecen)
    more(t) {
      const d = t.links || {};
      return Object.keys(NAMES).filter((k) => d[k]).map((k) => direct(NAMES[k], d[k]));
    },
    physical(t) {
      const d = t.links || {};
      const base = t.kind === 'recopilatorio' ? t.title : query(t);
      const disc = t.catno ? (t.L ? t.L.name + ' ' : '') + t.catno : base + (t.L ? ' ' + t.L.name : '');
      return {
        discogs: d.discogs ? direct('Discogs', d.discogs) : { name: 'Discogs', url: 'https://www.discogs.com/search/?type=release&q=' + q(disc), direct: false },
        amazon: { name: 'Amazon', url: 'https://www.amazon.es/s?k=' + q(base + ' vinilo'), direct: false }
      };
    },
    genre(g) {
      return {
        spotify: { name: 'Spotify', url: 'https://open.spotify.com/search/' + q(g.name), direct: false },
        youtube: { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=' + q(g.name + ' mix'), direct: false },
        discogs: { name: 'Discogs', url: 'https://www.discogs.com/search/?type=all&q=' + q(g.name), direct: false }
      };
    },
    source(key) { const s = H.data.sources[key]; return s ? { name: s[0], url: s[1], date: s[2] || null } : null; }
  };
})();
