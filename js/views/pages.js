/* HARMONY · artista, sello y tu caja */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;
  H.Views = H.Views || {};

  const statusMark = (obj, f) => (obj[f] == null ? '' : obj.ok.includes(f) ? H.C.mark('ok') : H.C.mark('ed'));

  function relatedArtists(a) {
    const mine = new Set(a.tracks.flatMap((t) => [t.genre, t.g2].filter(Boolean)));
    const myLabels = new Set(a.tracks.map((t) => t.label).filter(Boolean));
    const myYears = a.tracks.map((t) => t.year).filter((y) => y != null);
    return H.A.artists.filter((o) => o !== a && o.tracks.length && o.id !== 'various').map((o) => {
      let s = 0; const why = [];
      const collab = o.tracks.some((t) => t.artists.includes(a.id));
      if (collab) { s += 5; why.push('Colaboración'); }
      const sharedG = U.uniq(o.tracks.flatMap((t) => [t.genre, t.g2].filter((g) => g && mine.has(g))));
      if (sharedG.length) { s += 2 + sharedG.length; why.push(H.A.g[sharedG[0]].name); }
      const sharedL = U.uniq(o.tracks.map((t) => t.label).filter((l) => l && myLabels.has(l)));
      if (sharedL.length) { s += 2.5; why.push('Mismo sello: ' + H.A.l[sharedL[0]].name); }
      const oy = o.tracks.map((t) => t.year).filter((y) => y != null);
      if (myYears.length && oy.length && Math.min(...oy.map((y) => Math.min(...myYears.map((m) => Math.abs(m - y))))) <= 2) s += 0.8;
      return { o, s, why };
    }).filter((x) => x.s >= 2.5).sort((x, y) => y.s - x.s).slice(0, 8);
  }

  H.Views.artist = function (root, id) {
    const a = H.A.a[id];
    if (!a) { root.innerHTML = `<section class="wrap page-head">${H.C.empty('Ese artista no está en el archivo.', '<a href="#catalogo">Ir al catálogo</a>')}</section>`; return; }
    const ts = H.A.sort(a.tracks, 'year-asc');
    const genres = U.uniq(ts.map((t) => t.G));
    const years = ts.map((t) => t.year).filter((y) => y != null);
    const rel = relatedArtists(a);
    const srcs = a.src.map((k) => H.Links.source(k)).filter(Boolean);
    root.innerHTML = `
    <section class="page-head wrap ent-head">
      <p class="mono eyebrow"><a href="#catalogo">Catálogo</a> / Artista</p>
      <h1 class="page-title ent-name">${e(a.name)}</h1>
      <dl class="ent-facts">
        <div><dt class="mono">Origen</dt><dd>${a.origin ? statusMark(a, 'origin') + ' ' + e(a.origin) : '<span class="v v-na">Sin datos</span>'}</dd></div>
        ${a.real ? `<div><dt class="mono">Nombre / miembros</dt><dd>${statusMark(a, 'real')} ${e(a.real)}</dd></div>` : ''}
        <div><dt class="mono">En el archivo</dt><dd>${ts.length} ${ts.length === 1 ? 'registro' : 'registros'}${years.length ? ' · ' + Math.min(...years) + (Math.max(...years) !== Math.min(...years) ? '–' + Math.max(...years) : '') : ''}</dd></div>
        <div><dt class="mono">Géneros</dt><dd>${genres.map((g) => H.C.genre(g)).join(' · ')}</dd></div>
      </dl>
      ${srcs.length ? `<p class="fine">Fuente: ${srcs.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${e(s.name)} ↗</a>`).join(' · ')}</p>` : ''}
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Registros</h2>
        <div class="sec-actions"><button class="btn" type="button" data-enqueue-many="${ts.map((t) => t.id).join(',')}">${U.icon('queue')} Todo a la cola</button></div></header>
      ${H.C.rows(ts)}
    </section>
    <section class="sec wrap">
      <header class="sec-head"><h2 class="sec-title sec-title-sm">Artistas relacionados</h2><p class="sec-intro">Por colaboraciones, géneros compartidos, sellos y época.</p></header>
      ${rel.length ? `<ul class="rel-art">${rel.map((r) => `<li><a href="#a-${r.o.id}"><b>${e(r.o.name)}</b><span class="mono">${r.why.map(e).join(' · ')}</span></a></li>`).join('')}</ul>` : '<p class="fine">Aún no hay suficientes datos para relacionarlo.</p>'}
    </section>`;
  };

  H.Views.label = function (root, id) {
    const l = H.A.l[id];
    if (!l) { root.innerHTML = `<section class="wrap page-head">${H.C.empty('Ese sello no está en el archivo.', '<a href="#catalogo">Ir al catálogo</a>')}</section>`; return; }
    const ts = H.A.sort(l.tracks, 'year-asc');
    const artists = U.uniq(ts.flatMap((t) => t.A));
    const genres = U.uniq(ts.map((t) => t.G));
    const srcs = l.src.map((k) => H.Links.source(k)).filter(Boolean);
    root.innerHTML = `
    <section class="page-head wrap ent-head">
      <p class="mono eyebrow"><a href="#catalogo">Catálogo</a> / Sello</p>
      <h1 class="page-title ent-name">${e(l.name)}</h1>
      <dl class="ent-facts">
        <div><dt class="mono">País</dt><dd>${l.country ? statusMark(l, 'country') + ' ' + e(l.country) : '<span class="v v-na">Sin datos</span>'}</dd></div>
        <div><dt class="mono">Fundado</dt><dd>${l.founded ? statusMark(l, 'founded') + ' ' + l.founded : '<span class="v v-na">Sin datos</span>'}</dd></div>
        ${l.note ? `<div><dt class="mono">Nota</dt><dd>${statusMark(l, 'note')} ${e(l.note)}</dd></div>` : ''}
        <div><dt class="mono">Géneros</dt><dd>${genres.map((g) => H.C.genre(g)).join(' · ')}</dd></div>
      </dl>
      <p class="fine">${srcs.length ? `Fuente: ${srcs.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${e(s.name)} ↗</a>`).join(' · ')} · ` : ''}<a href="https://www.discogs.com/search/?type=label&q=${encodeURIComponent(l.name)}" target="_blank" rel="noopener">Buscar el sello en Discogs ↗</a></p>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Registros del sello</h2>
        <div class="sec-actions"><button class="btn" type="button" data-enqueue-many="${ts.map((t) => t.id).join(',')}">${U.icon('queue')} Todo a la cola</button></div></header>
      ${H.C.rows(ts)}
      <h3 class="mono sub-h">Artistas</h3>
      <div class="chips">${artists.map((a) => `<a class="chip" href="#a-${a.id}">${e(a.name)}</a>`).join('')}</div>
    </section>`;
  };

  H.Views.crate = function (root) {
    const favs = H.App.favs().map((id) => H.A.t[id]).filter(Boolean);
    const played = U.store.get('played', []).map((id) => H.A.t[id]).filter(Boolean).slice(0, 12);
    const viewed = U.store.get('viewed', []).map((id) => H.A.t[id]).filter(Boolean).slice(0, 12);
    root.innerHTML = `
    <section class="page-head wrap">
      <p class="mono eyebrow">Colección personal</p>
      <h1 class="page-title">Tu caja</h1>
      <p class="sec-intro">Lo que guardas con ${U.icon('crate')} se queda en este navegador. No hay cuentas: si borras los datos del sitio o cambias de dispositivo, la caja empieza vacía.</p>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Guardados <span class="mono">${favs.length}</span></h2>
        ${favs.length ? `<div class="sec-actions"><button class="btn" type="button" data-enqueue-many="${favs.map((t) => t.id).join(',')}">${U.icon('queue')} Todo a la cola</button><button class="btn" type="button" data-clear-favs>Vaciar caja</button></div>` : ''}</header>
      ${favs.length ? H.C.rows(favs) : H.C.empty('Tu caja está vacía.', 'Guarda registros desde cualquier lista o ficha y aparecerán aquí, en el orden en que los guardes.')}
    </section>
    <section class="sec wrap crate-hist">
      <div><h2 class="mono sub-h">Puestos en el plato hace poco</h2>${played.length ? `<ol class="mini-list">${played.map((t) => `<li><button type="button" data-open="${t.id}"><b>${e(t.title)}</b> <span>${e(t.artistLine)}</span></button></li>`).join('')}</ol>` : '<p class="fine">Nada todavía.</p>'}</div>
      <div><h2 class="mono sub-h">Fichas vistas hace poco</h2>${viewed.length ? `<ol class="mini-list">${viewed.map((t) => `<li><button type="button" data-open="${t.id}"><b>${e(t.title)}</b> <span>${e(t.artistLine)}</span></button></li>`).join('')}</ol>` : '<p class="fine">Nada todavía.</p>'}</div>
    </section>`;
    const clr = root.querySelector('[data-clear-favs]');
    if (clr) clr.onclick = () => {
      if (clr.dataset.armed) { H.App.clearFavs(); H.Views.crate(root); U.toast('Caja vaciada'); return; }
      clr.dataset.armed = '1'; clr.textContent = 'Pulsa otra vez para vaciar'; clr.classList.add('btn-warn');
      setTimeout(() => { if (clr.isConnected) { delete clr.dataset.armed; clr.textContent = 'Vaciar caja'; clr.classList.remove('btn-warn'); } }, 3500);
    };
  };
})();
