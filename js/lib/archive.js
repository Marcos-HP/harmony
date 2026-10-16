/* HARMONY · índice del archivo: búsqueda, filtros, orden, relaciones y recomendaciones.
   Lógica pura sobre H.data: no toca el DOM. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const A = (H.A = {});

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const joinNames = (names) => names.length <= 2 ? names.join(' & ') : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];

  A.BPM = [100, 260];
  A.YEARS = [1986, 2026];

  /* ---------- capa de MusicBrainz (js/data/mb.js, generada por tools/mb-import.mjs) ----------
     Misma regla que el informe del importador:
     - un dato editorial sin contrastar se sustituye por el de MusicBrainz;
     - uno ya contrastado con otra fuente se mantiene si no coincide, y se marca el desacuerdo. */
  // NFKD además pliega «A²» en «A2» y ligaduras raras de los títulos
  const key = (s) => U.norm(String(s == null ? '' : s).normalize('NFKD')).replace(/['’`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const loose = (a, b) => { const x = key(a), y = key(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
  const slug = (s) => key(s).replace(/ /g, '-') || 'sello';
  const FMT = { 'Vinyl': 'Vinilo', 'Digital Media': 'Digital', 'Cassette': 'Casete', 'Enhanced CD': 'CD mejorado', 'Flexi-disc': 'Flexi' };
  A.fmtES = function (f) {
    const m = /^(?:(\d+)×)?(.+)$/.exec(String(f).trim());
    const n = m[1] ? m[1] + '×' : '';
    const vinyl = /^(\d+(?:\.\d+)?)" Vinyl$/.exec(m[2]);
    return vinyl ? 'Vinilo ' + n + vinyl[1] + '″' : n + (FMT[m[2]] || m[2]);
  };
  /* Formato físico: vinyl · cd · digital · cassette · other. Vale para MusicBrainz y para el texto editorial. */
  A.formatKind = function (f) {
    const x = [].concat(f || []).join(' ');
    if (!x) return null;
    if (/vinyl|vinilo|″|"/i.test(x)) return 'vinyl';
    if (/\b(cd|hdcd|sacd)\b|cd-r/i.test(x)) return 'cd';
    if (/digital/i.test(x)) return 'digital';
    if (/cassette|casete/i.test(x)) return 'cassette';
    return 'other';
  };
  A.FORMAT_ES = { vinyl: 'vinilo', cd: 'CD', digital: 'digital', cassette: 'casete', other: 'otro formato' };
  /* País de la edición: MusicBrainz da el código ISO y Discogs el nombre en inglés */
  const COUNTRY = { ES: 'España', Spain: 'España', NL: 'Países Bajos', Netherlands: 'Países Bajos', DE: 'Alemania', Germany: 'Alemania',
    BE: 'Bélgica', Belgium: 'Bélgica', IT: 'Italia', Italy: 'Italia', GB: 'Reino Unido', UK: 'Reino Unido', US: 'EE. UU.',
    FR: 'Francia', France: 'Francia', AT: 'Austria', Austria: 'Austria', AU: 'Australia', Australia: 'Australia', CA: 'Canadá', Canada: 'Canadá',
    JP: 'Japón', Japan: 'Japón', PT: 'Portugal', Portugal: 'Portugal', XE: 'Europa', Europe: 'Europa', XW: 'Mundial', Worldwide: 'Mundial' };
  A.countryES = (c) => (c ? COUNTRY[c] || c : null);
  A.TYPE_ES = { Single: 'Single', EP: 'EP', Album: 'Álbum', Broadcast: 'Emisión', Other: 'Otro' };

  A.mergeMB = function (d) {
    const mb = d.mb;
    const stats = { applied: 0, review: 0, missing: 0, conflicts: 0, date: mb && mb.generatedAt ? mb.generatedAt.slice(0, 10) : null };
    d.tracks.forEach((t) => {
      const first = d.sources[t.src[0]];
      const site = first ? first[0].split(' · ')[0].replace(/ \([A-Z]{2}\)$/, '') : 'la fuente citada';
      t.okBy = {}; t.ok.forEach((f) => (t.okBy[f] = site));
      t.conflicts = []; t.links = t.links || {}; t.MB = null; t.cover = null; t.labelArt = null; t.artFrom = null; t.artBy = null; t.releaseInfo = null;
      t.fmtKind = A.formatKind(t.format); t.vinylEd = null; t.vinylSleeve = null; t.labelFromVinylEd = false; t.noVinyl = false;
      // desacuerdos entre fuentes editoriales: alt: { campo: [valor, clave de fuente] }
      Object.entries(t.alt || {}).forEach(([field, [val, key]]) => {
        const name = (s) => (d.sources[s] ? d.sources[s][0] : s);
        t.conflicts.push({ field, ed: t[field], by: name(t.src[0]), other: val, otherBy: name(key) });
      });
    });
    if (!mb || !mb.records) return stats;
    const byKey = new Map(d.labels.map((l) => [key(l.name), l]));
    const labelName = (id) => (d.labels.find((l) => l.id === id) || {}).name || id;
    d.tracks.forEach((t) => {
      const r = mb.records[t.id];
      if (!r) return;
      if (r.status === 'not-found') stats.missing++;
      if (r.status === 'matched' && !r.apply) stats.review++;
      if (r.status !== 'matched' || !r.apply) return;
      stats.applied++;
      const R = r.release;
      t.MB = r;
      const set = (field, val, same, show = (x) => x) => {
        if (val == null || val === '') return;
        const cur = t[field];
        if (cur != null && t.ok.includes(field)) {
          if (!same(cur, val)) { t.conflicts.push({ field, ed: show(cur), by: t.okBy[field], other: show(val), otherBy: 'MusicBrainz' }); stats.conflicts++; return; }
          if (!/MusicBrainz/.test(t.okBy[field] || '')) t.okBy[field] = (t.okBy[field] ? t.okBy[field] + ' y ' : '') + 'MusicBrainz';
          return; // coincide: se conserva el valor ya contrastado
        }
        t[field] = val;
        if (!t.ok.includes(field)) t.ok.push(field);
        t.okBy[field] = 'MusicBrainz';
      };
      set('year', r.year, (a, b) => a === b);
      const L0 = R.labels.find((l) => l.name);
      if (L0) {
        let lab = byKey.get(key(L0.name)) || d.labels.find((l) => loose(l.name, L0.name));
        if (!lab) {
          lab = { id: 'mb-' + slug(L0.name), name: L0.name, country: null, founded: null, note: null, ok: [], src: [], mbid: L0.mbid || null };
          d.labels.push(lab); byKey.set(key(L0.name), lab);
        }
        set('label', lab.id, (a, b) => a === b || loose(labelName(a), labelName(b)), labelName);
      }
      set('release', R.title, loose);
      set('catno', (R.labels.find((l) => l.catno) || {}).catno, loose);
      if (R.formats.length) set('format', R.formats.map(A.fmtES).join(' + '), (a, b) => key(a) === key(b));
      t.releaseInfo = { type: A.TYPE_ES[R.group.type] || R.group.type, country: A.countryES(R.country), date: R.date, selfReleased: R.selfReleased };
      // diseño real del disco (Cover Art Archive): primero la copia local que baja el importador.
      // La portada es la de la edición original, sea vinilo, CD o digital.
      // En el plato solo gira vinilo: la galleta sale del original si es vinilo, o de su primera edición en vinilo.
      const img = (x) => (x ? x.file || x.url : null);
      t.fmtKind = A.formatKind(R.formats) || t.fmtKind;
      if (R.art) { t.cover = img(R.art.front); t.labelArt = t.fmtKind === 'vinyl' ? img(R.art.label) : null; }
      else t.cover = R.cover ? 'https://coverartarchive.org/release/' + R.id + '/front-250' : null;
      if (t.cover || t.labelArt) { t.artFrom = 'https://musicbrainz.org/release/' + R.id + '/cover-art'; t.artBy = 'Cover Art Archive'; }
      const V = R.vinyl;
      if (V) {
        t.vinylEd = { title: V.title, date: V.date, url: 'https://musicbrainz.org/release/' + V.id, artUrl: 'https://musicbrainz.org/release/' + V.id + '/cover-art' };
        if (V.art) {
          t.vinylSleeve = img(V.art.front);
          if (!t.labelArt && V.art.label) { t.labelArt = img(V.art.label); t.labelFromVinylEd = true; }
        }
      }
      t.noVinyl = !!t.fmtKind && t.fmtKind !== 'vinyl' && !V;
      t.links = R.links || {};
      if (r.recording) { d.sources['mb-rec:' + t.id] = ['MusicBrainz · grabación «' + r.recording.title + '»', 'https://musicbrainz.org/recording/' + r.recording.id]; t.src.push('mb-rec:' + t.id); }
      d.sources['mb-rel:' + t.id] = ['MusicBrainz · lanzamiento «' + R.title + '»' + (R.date ? ', ' + R.date : ''), 'https://musicbrainz.org/release/' + R.id];
      t.src.push('mb-rel:' + t.id);
    });
    return stats;
  };

  /* ---------- capa de Discogs (js/data/dc.js, generada por tools/dc-import.mjs) ----------
     Segunda fuente, misma regla que MusicBrainz: lo editorial se sustituye y lo contrastado que no coincide
     se marca como desacuerdo. Va después de MusicBrainz, así que donde MusicBrainz ya contrastó un dato manda él.
     Además aporta lo que MusicBrainz casi nunca tiene para la mákina: portada, caras del disco y vídeos por corte. */
  /* «Vinilo» y «Vinilo 12″» dicen lo mismo con distinto detalle */
  const sameFormat = (a, b) => { const x = key(a), y = key(b); return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '); };
  A.mergeDC = function (d) {
    const dc = d.dc;
    const stats = { applied: 0, review: 0, missing: 0, conflicts: 0, covers: 0, date: dc && dc.generatedAt ? dc.generatedAt.slice(0, 10) : null };
    d.tracks.forEach((t) => { t.DC = null; t.sides = null; t.videos = null; });
    if (!dc || !dc.records) return stats;
    const byKey = new Map(d.labels.map((l) => [key(l.name), l]));
    const labelName = (id) => (d.labels.find((l) => l.id === id) || {}).name || id;
    const relId = (u) => { const m = /discogs\.com\/(?:[^/]+\/)?release\/(\d+)/.exec(String(u || '')); return m ? m[1] : null; };
    d.tracks.forEach((t) => {
      const r = dc.records[t.id];
      if (!r) return;
      if (r.status === 'not-found') stats.missing++;
      if (r.status === 'matched' && !r.apply) stats.review++;
      if (r.status !== 'matched' || !r.apply) return;
      stats.applied++;
      const R = r.release;
      t.DC = r;
      const set = (field, val, same, show = (x) => x) => {
        if (val == null || val === '') return;
        const cur = t[field];
        if (cur != null && t.ok.includes(field)) {
          if (!same(cur, val)) {
            // contrastado solo con MusicBrainz: manda MusicBrainz (la edición enlazada puede ser otra prensa),
            // salvo que la edición de Discogs se haya fijado a mano: entonces manda esa y se anota el desacuerdo
            if (t.okBy[field] === 'MusicBrainz') {
              if (!r.pinned) return;
              t[field] = val; t.okBy[field] = 'Discogs';
              t.conflicts.push({ field, ed: show(val), by: 'Discogs (edición fijada)', other: show(cur), otherBy: 'MusicBrainz' }); stats.conflicts++;
              return;
            }
            // si MusicBrainz ya discrepaba con el mismo valor, Discogs se suma a esa discrepancia
            const prev = t.conflicts.find((c) => c.field === field && same(c.other, show(val)));
            if (prev) { if (!/Discogs/.test(prev.otherBy)) prev.otherBy += ' y Discogs'; return; }
            t.conflicts.push({ field, ed: show(cur), by: t.okBy[field], other: show(val), otherBy: 'Discogs' }); stats.conflicts++; return;
          }
          if (!/Discogs/.test(t.okBy[field] || '')) t.okBy[field] = (t.okBy[field] ? t.okBy[field] + ' y ' : '') + 'Discogs';
          if (field === 'format' && String(val).length > String(cur).length) t.format = val;   // «Vinilo» → «Vinilo 12″»
          return;
        }
        t[field] = val;
        if (!t.ok.includes(field)) t.ok.push(field);
        t.okBy[field] = 'Discogs';
      };
      set('year', R.year, (a, b) => a === b);
      // con varios sellos (coediciones), vale el que ya figure en el archivo
      const curLab = t.label ? labelName(t.label) : null;
      const L0 = (curLab && R.labels.find((l) => l.name && loose(curLab, l.name))) || R.labels.find((l) => l.name);
      if (L0) {
        let lab = byKey.get(key(L0.name)) || d.labels.find((l) => loose(l.name, L0.name));
        if (!lab) {
          lab = { id: 'dc-' + slug(L0.name), name: L0.name, country: null, founded: null, note: null, ok: [], src: [], discogs: L0.id || null };
          d.labels.push(lab); byKey.set(key(L0.name), lab);
        }
        set('label', lab.id, (a, b) => a === b || loose(labelName(a), labelName(b)), labelName);
      }
      set('release', R.title, loose);
      set('catno', (R.labels.find((l) => l.catno) || {}).catno, (a, b) => key(a).replace(/ /g, '') === key(b).replace(/ /g, ''));
      if (R.formats.length) set('format', R.formats.join(' + '), sameFormat);
      if (!t.releaseInfo) t.releaseInfo = { type: R.type, country: A.countryES(R.country), date: R.released || (R.year ? String(R.year) : null), selfReleased: false };
      else if (!t.releaseInfo.country && R.country) t.releaseInfo.country = A.countryES(R.country);
      // una edición fijada a mano en Discogs es la original: su formato y su portada mandan sobre MusicBrainz
      const own = !t.MB || r.pinned;
      if (own) t.fmtKind = A.formatKind(R.formats) || t.fmtKind;
      if (r.pinned && t.MB && R.image && R.image.file) { t.cover = null; t.labelArt = null; t.vinylEd = null; t.vinylSleeve = null; t.labelFromVinylEd = false; t.noVinyl = false; }
      // portada: la de Cover Art Archive si la hay; si no, la imagen principal de la edición en Discogs
      if (!t.cover && R.image && R.image.file) { t.cover = R.image.file; t.artFrom = R.url + '/image/'; t.artBy = 'Discogs'; stats.covers++; }
      const sides = R.tracks.filter((x) => x.title && x.title.trim());
      t.sides = sides.length ? sides : null;
      t.videos = R.videos.length ? R.videos : null;
      t.links = t.links || {};
      if (!t.links.discogs) t.links.discogs = { url: R.url, scope: 'release' };
      // un registro de tipo «tema» enlaza el vídeo de su corte
      if (!t.links.youtube && t.kind === 'tema') {
        const k = R.tracks.find((x) => x.video && loose(x.title, t.title));
        if (k) t.links.youtube = { url: k.video, scope: 'recording' };
      }
      // fuente: si el catálogo ya cita esta misma edición, no se repite
      const cited = t.src.some((s) => d.sources[s] && relId(d.sources[s][1]) === String(R.id));
      if (!cited) {
        d.sources['dc-rel:' + t.id] = ['Discogs · ' + R.artist + ', «' + R.title + '»' + (R.labels[0] && R.labels[0].catno ? ' (' + R.labels[0].catno + ')' : ''), R.url, stats.date];
        t.src.push('dc-rel:' + t.id);
      }
    });
    return stats;
  };

  /* ---------- capa de Deezer (js/data/dz.js, generada por tools/dz-import.mjs) ----------
     Solo dice qué tema de Deezer tiene la muestra de 30 s de cada registro. No toca ningún dato del archivo:
     el audio se pide a Deezer al darle a play (la URL caduca) y nunca se guarda. */
  A.mergeDZ = function (d) {
    const dz = d.dz;
    const stats = { applied: 0, verified: 0, review: 0, date: dz && dz.generatedAt ? dz.generatedAt.slice(0, 10) : null };
    d.tracks.forEach((t) => { t.dz = null; });
    if (!dz || !dz.records) return stats;
    d.tracks.forEach((t) => {
      const r = dz.records[t.id];
      if (!r || r.status !== 'matched') return;
      if (!r.apply) { stats.review++; return; }
      const k = r.track;
      t.dz = { id: k.id, title: k.title, version: k.version || null, artist: k.artist, album: k.album, albumType: k.albumType || null,
        link: k.link, verified: !!r.verified, pinned: !!r.pinned, confidence: r.confidence, kind: r.kind || 'track', notes: r.notes || [] };
      t.links = t.links || {};
      if (!t.links.deezer || t.links.deezer.scope !== 'recording') t.links.deezer = { url: k.link, scope: r.kind === 'release' ? 'release' : 'recording' };
      stats.applied++; if (r.verified) stats.verified++;
    });
    return stats;
  };

  A.init = function () {
    const d = H.data;
    if (!d._merged) { A.mbStats = A.mergeMB(d); A.dcStats = A.mergeDC(d); A.dzStats = A.mergeDZ(d); d._merged = true; }
    A.families = d.families; A.fam = byId(d.families);
    A.genres = d.genres; A.g = byId(d.genres);
    A.labels = d.labels; A.l = byId(d.labels);
    A.artists = d.artists; A.a = byId(d.artists);
    A.tracks = d.tracks.slice().sort((x, y) => x.n - y.n); A.t = byId(A.tracks);
    A.sources = d.sources; A.routes = d.routes;

    A.genres.forEach((g) => { g.F = A.fam[g.family]; g.tracks = []; g.primary = []; });
    A.artists.forEach((a) => { a.tracks = []; });
    A.labels.forEach((l) => { l.tracks = []; });

    A.tracks.forEach((t) => {
      t.A = t.artists.map((id) => A.a[id]).filter(Boolean);
      t.G = A.g[t.genre];
      t.G2 = t.g2 ? A.g[t.g2] : null;
      t.L = t.label ? A.l[t.label] : null;
      t.fam = t.G.family;
      t.artistLine = joinNames(t.A.map((a) => a.name));
      t.decade = U.decade(t.year);
      t.hmy = U.hmy(t);
      t._idx = U.norm([t.title, t.artistLine, t.L && t.L.name, t.G.name, t.G2 && t.G2.name, t.year, t.release, t.hmy, t.catno, t.kind].filter(Boolean).join(' · '));
      t.G.tracks.push(t); t.G.primary.push(t);
      if (t.G2) t.G2.tracks.push(t);
      t.A.forEach((a) => a.tracks.push(t));
      if (t.L) t.L.tracks.push(t);
    });

    // Relaciones entre géneros
    A.adj = {};
    A.genres.forEach((g) => (A.adj[g.id] = []));
    d.relations.forEach(([a, b, type]) => {
      if (!A.g[a] || !A.g[b]) return;
      A.adj[a].push({ id: b, type, dir: 'out' });
      A.adj[b].push({ id: a, type, dir: 'in' });
    });
    return A;
  };

  /* Estado de un dato: ok (contrastado) · ed (editorial) · est (estimado) · na (sin datos) */
  A.status = function (t, field) {
    const v = field === 'artists' ? t.artists : t[field];
    if (v == null || (Array.isArray(v) && !v.length)) return 'na';
    if (t.conflicts && t.conflicts.some((c) => c.field === field)) return 'cf';
    if (field === 'bpm') return t.ok.includes('bpm') ? 'ok' : 'est';
    if (field === 'title' || field === 'artists' || field === 'genre') return t.src.length ? 'src' : 'ed';
    return t.ok.includes(field) ? 'ok' : 'ed';
  };
  A.okCount = (t) => t.ok.length;
  /* BPM para mostrar: con ≈ salvo que la fuente lo dé */
  A.bpmTxt = (t, none = '—') => (t.bpm == null ? none : (t.ok.includes('bpm') ? '' : '≈') + t.bpm);

  A.lineage = function (gid) {
    const out = { from: [], to: [], with: [] };
    (A.adj[gid] || []).forEach((r) => {
      const g = A.g[r.id];
      if (r.type === 'paralelo') out.with.push({ g, type: r.type });
      else if (r.dir === 'in') out.from.push({ g, type: r.type });
      else out.to.push({ g, type: r.type });
    });
    const order = (x, y) => (x.type === y.type ? x.g.era[0] - y.g.era[0] : x.type === 'origen' ? -1 : 1);
    out.from.sort(order); out.to.sort(order); out.with.sort(order);
    return out;
  };

  // Distancia entre géneros en el grafo (sin dirección)
  A.dist = function (a, b) {
    if (a === b) return 0;
    const seen = new Set([a]); let frontier = [a]; let d = 0;
    while (frontier.length && d < 6) {
      d++;
      const next = [];
      for (const g of frontier) for (const r of A.adj[g] || []) {
        if (r.id === b) return d;
        if (!seen.has(r.id)) { seen.add(r.id); next.push(r.id); }
      }
      frontier = next;
    }
    return Infinity;
  };

  A.relationLabel = function (fromG, toG) {
    for (const r of A.adj[fromG.id] || []) {
      if (r.id !== toG.id) continue;
      if (r.type === 'paralelo') return 'Escena paralela: ' + toG.name;
      if (r.type === 'origen') return r.dir === 'out' ? fromG.name + ' → ' + toG.name : toG.name + ' → ' + fromG.name;
      return 'Influencia: ' + (r.dir === 'out' ? fromG.name + ' → ' + toG.name : toG.name + ' → ' + fromG.name);
    }
    return null;
  };

  /* Búsqueda por texto: todos los términos deben aparecer; puntúa dónde aparecen */
  A.score = function (t, q) {
    const terms = U.norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return 1;
    let s = 0;
    const title = U.norm(t.title), artist = U.norm(t.artistLine), label = U.norm(t.L ? t.L.name : ''), genre = U.norm(t.G.name + ' ' + (t.G2 ? t.G2.name : ''));
    for (const term of terms) {
      if (!t._idx.includes(term)) return 0;
      if (title.startsWith(term)) s += 4; else if (title.includes(term)) s += 3;
      if (artist.includes(term)) s += 2.5;
      if (label.includes(term)) s += 1.5;
      if (genre.includes(term)) s += 1;
      if (String(t.year) === term) s += 2;
    }
    return s;
  };

  A.defaultFilters = () => ({ q: '', genres: [], decades: [], artists: [], labels: [], bpm: A.BPM.slice(), onlyOk: false, sort: 'year-asc' });

  A.isBpmActive = (f) => f.bpm[0] > A.BPM[0] || f.bpm[1] < A.BPM[1];

  A.filter = function (f) {
    const bpmOn = A.isBpmActive(f);
    return A.tracks.filter((t) => {
      if (f.genres.length && !f.genres.includes(t.genre) && !(t.g2 && f.genres.includes(t.g2))) return false;
      if (f.decades.length && !f.decades.includes(t.decade)) return false;
      if (f.artists.length && !t.artists.some((a) => f.artists.includes(a))) return false;
      if (f.labels.length && !f.labels.includes(t.label)) return false;
      if (bpmOn && (t.bpm == null || t.bpm < f.bpm[0] || t.bpm > f.bpm[1])) return false;
      if (f.onlyOk && !t.ok.includes('year')) return false;
      if (f.q && !A.score(t, f.q)) return false;
      return true;
    });
  };

  const nullLast = (a, b, dir) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir);
  A.sort = function (list, key, q) {
    const l = list.slice();
    const tie = (x, y) => x.n - y.n;
    const cmp = {
      'relevance': (x, y) => A.score(y, q) - A.score(x, q) || tie(x, y),
      'year-asc': (x, y) => nullLast(x.year, y.year, 1) || tie(x, y),
      'year-desc': (x, y) => nullLast(x.year, y.year, -1) || tie(x, y),
      'bpm-asc': (x, y) => nullLast(x.bpm, y.bpm, 1) || tie(x, y),
      'bpm-desc': (x, y) => nullLast(x.bpm, y.bpm, -1) || tie(x, y),
      'title': (x, y) => x.title.localeCompare(y.title, 'es') || tie(x, y),
      'artist': (x, y) => x.artistLine.localeCompare(y.artistLine, 'es') || tie(x, y),
      'n': tie
    }[key] || tie;
    return l.sort(cmp);
  };

  /* Recomendaciones con motivo musical */
  A.related = function (t, n = 6) {
    const scored = [];
    for (const o of A.tracks) {
      if (o === t) continue;
      const reasons = [];
      let s = 0;
      const sharedArtist = o.A.find((a) => t.artists.includes(a.id));
      if (sharedArtist) { s += 5; reasons.push([5, 'Mismo artista: ' + sharedArtist.name]); }
      if (t.label && o.label === t.label) { s += 3; reasons.push([3, 'Mismo sello: ' + t.L.name]); }
      if (o.genre === t.genre) { s += 3; reasons.push([2.5, 'Mismo género']); }
      else {
        const rel = A.relationLabel(t.G, o.G);
        if (rel) { const w = rel.startsWith('Escena') || rel.startsWith('Influencia') ? 1.6 : 2.2; s += w; reasons.push([w, rel]); }
        else if ((t.g2 && t.g2 === o.genre) || (o.g2 && o.g2 === t.genre)) { s += 1.5; reasons.push([1.5, 'Entre ' + t.G.name + ' y ' + o.G.name]); }
      }
      if (t.bpm != null && o.bpm != null) {
        const db = Math.abs(t.bpm - o.bpm);
        if (db === 0) { s += 1.6; reasons.push([1.2, 'Mismo tempo (≈' + t.bpm + ')']); }
        else if (db <= 4) { s += 1.2; reasons.push([1, '±' + db + ' BPM']); }
        else if (db <= 10) s += 0.4;
        else if (db > 30) s -= 1.5;
      }
      if (t.year != null && o.year != null) {
        const dy = Math.abs(t.year - o.year);
        if (dy === 0) { s += 1.3; reasons.push([1.1, 'Mismo año: ' + t.year]); }
        else if (dy <= 2) { s += 0.9; reasons.push([0.8, dy + (dy === 1 ? ' año' : ' años') + ' de diferencia']); }
        else if (dy <= 5) s += 0.3;
      }
      if (s > 2) scored.push({ t: o, s, why: reasons.sort((a, b) => b[0] - a[0]).slice(0, 2).map((r) => r[1]) });
    }
    scored.sort((a, b) => b.s - a.s || a.t.n - b.t.n);
    // diversidad: máximo dos por artista principal
    const out = []; const perArtist = {};
    for (const x of scored) {
      const k = x.t.artists[0];
      if ((perArtist[k] || 0) >= 2) continue;
      perArtist[k] = (perArtist[k] || 0) + 1;
      out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };

  /* Sorpréndeme: salto a otra escena con sentido (cercana en el grafo pero distinta) */
  A.surprise = function (ctx = {}, rnd = Math.random) {
    const recent = new Set(ctx.recent || []);
    const last = ctx.last || null;
    let pool = A.tracks.filter((t) => !recent.has(t.id) && (!last || t.id !== last.id));
    if (!pool.length) pool = A.tracks.slice();
    const weights = pool.map((t) => {
      let w = 1;
      if (t.tags.includes('joya')) w *= 2.2;
      if (t.year != null) w *= 1.2;
      if (last) {
        if (t.genre === last.genre) w *= 0.15;
        if (t.fam !== last.fam) w *= 1.8;
        const d = A.dist(last.genre, t.genre);
        if (d === 1) w *= 1.6; else if (d === 2) w *= 1.3;
      }
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    let pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { pick = pool[i]; break; } }
    let why;
    if (last && last.genre !== pick.genre) why = 'Salto de ' + last.G.name + ' a ' + pick.G.name + (pick.year ? ', ' + pick.year : '');
    else if (pick.tags.includes('joya')) why = 'Joya del archivo' + (pick.year ? ', ' + pick.year : '');
    else why = pick.G.name + (pick.year ? ', ' + pick.year : '');
    return { t: pick, why };
  };

  /* Agrupaciones */
  A.decades = function () {
    const ds = {};
    A.tracks.forEach((t) => { if (t.decade == null) return; (ds[t.decade] = ds[t.decade] || []).push(t); });
    return Object.keys(ds).map(Number).sort((a, b) => a - b).map((d) => {
      const counts = {};
      ds[d].forEach((t) => (counts[t.genre] = (counts[t.genre] || 0) + 1));
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => A.g[g]);
      return { d, tracks: ds[d], top };
    });
  };

  A.genresAt = function (bpm, year) {
    return A.genres.filter((g) => bpm >= g.bpm[0] && bpm <= g.bpm[1] && (year == null || (year >= g.era[0] && year <= (g.era[1] || A.YEARS[1]))))
      .sort((a, b) => a.era[0] - b.era[0]);
  };

  A.facet = function (list, key) {
    const c = {};
    list.forEach((t) => {
      const vals = key === 'genre' ? [t.genre, t.g2].filter(Boolean) : key === 'artist' ? t.artists : [t[key]];
      vals.forEach((v) => { if (v != null) c[v] = (c[v] || 0) + 1; });
    });
    return c;
  };

  A.stats = function () {
    const years = A.tracks.map((t) => t.year).filter((y) => y != null);
    return {
      tracks: A.tracks.length,
      genres: A.genres.length,
      artists: A.artists.filter((a) => a.tracks.length && a.id !== 'various').length,
      labels: A.labels.filter((l) => l.tracks.length).length,
      yearMin: Math.min(...years), yearMax: Math.max(...years),
      bpmMin: Math.min(...A.genres.map((g) => g.bpm[0])), bpmMax: Math.max(...A.genres.map((g) => g.bpm[1])),
      okYear: A.tracks.filter((t) => t.ok.includes('year')).length,
      mb: A.mbStats || { applied: 0, review: 0, missing: 0, conflicts: 0, date: null },
      dc: A.dcStats || { applied: 0, review: 0, missing: 0, conflicts: 0, covers: 0, date: null },
      dz: A.dzStats || { applied: 0, verified: 0, review: 0, date: null }
    };
  };
})();
