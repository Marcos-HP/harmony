/* HARMONY · portada */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, C = () => H.C;
  const e = U.esc;
  H.Views = H.Views || {};

  H.Views.home = function (root) {
    const s = H.A.stats();
    const decs = H.A.decades();
    const noYear = H.A.tracks.filter((t) => t.year == null).length;
    const offMap = H.A.tracks.filter((t) => t.year == null || t.bpm == null).length;
    const date = ((H.A.mbStats && H.A.mbStats.date) || H.data.checkedOn).split('-').reverse().join('·');

    root.innerHTML = `
    <section class="hero wrap">
      <p class="hero-kicker mono"><span>Archivo n.º 01</span><span>Edición 0.4 · ${date}</span><span class="hide-sm">Lado A</span></p>
      <h1 class="wordmark" aria-label="Harmony"><svg viewBox="0 0 1000 150" preserveAspectRatio="xMinYMin meet" aria-hidden="true"><text x="0" y="132" class="wm-t">HARMONY</text></svg></h1>
      <p class="hero-credits mono">
        <span>${s.tracks} registros</span><span>${s.genres} géneros</span><span>${s.artists} artistas</span><span>${s.labels} sellos</span><span>${s.yearMin}—${s.yearMax}</span><span>${s.bpmMin}—${s.bpmMax} BPM</span>${s.mb.applied ? `<span>${s.mb.applied} contrastados con MusicBrainz</span>` : ''}${s.dz.applied ? `<span>${s.dz.applied} con muestra de 30 s</span>` : ''}
      </p>
      <div class="hero-lead">
        <p class="lead">Un archivo para escuchar con lupa la música electrónica dura, del ácido de Chicago al uptempo. Elige un tempo, una década o un sello y tira del hilo.</p>
        <div class="hero-cta">
          <a class="btn btn-solid" href="#espectro">Recorrer el espectro ↓</a>
          <button class="btn" type="button" data-surprise>${U.icon('shuffle')} Sorpréndeme</button>
          <a class="btn" href="#catalogo">Abrir el catálogo</a>
        </div>
      </div>
    </section>

    <section class="sec wrap" id="sec-espectro" aria-labelledby="h-espectro">
      <header class="sec-head sec-head-stack">
        <p class="mono eyebrow">Géneros · tempo y época</p>
        <h2 class="sec-title" id="h-espectro">Espectro</h2>
        <div class="sec-sub"><p class="sec-intro">Cada género con su rango de tempo y su época. En carriles, una fila por género: toca la escala para marcar un tempo y toca una fila para ver sus temas. En el mapa, los géneros son zonas y cada registro es un punto.</p></div>
      </header>
      <div class="spectrum" id="spectrum"></div>
    </section>

    ${H.A.routes.map((route, ri) => `
    <section class="sec wrap route" aria-labelledby="h-ruta-${ri + 1}">
      <header class="sec-head sec-head-stack">
        <p class="mono eyebrow">Ruta ${U.pad(ri + 1, 2)} · ${route.span} · ${route.steps.length} discos</p>
        <h2 class="sec-title" id="h-ruta-${ri + 1}">${e(route.title)}</h2>
        <div class="sec-sub">
          <p class="sec-intro">${e(route.intro)}</p>
          <button class="btn" type="button" data-route="${route.id}" aria-label="Añadir a la cola los ${route.steps.length} discos de «${e(route.title)}»">${U.icon('queue')} ${U.cap(U.numES(route.steps.length))} discos a la cola</button>
        </div>
      </header>
      <ol class="route-strip" tabindex="0" aria-label="${e(route.title)}, en orden cronológico">
        ${route.steps.map(([id, cap], i) => {
          const t = H.A.t[id];
          return `<li class="stop">
            <div class="stop-top"><span class="stop-n mono">${U.pad(i + 1, 2)}</span><span class="stop-year">${t.year != null ? t.year : '—'}</span></div>
            <button class="stop-sleeve" type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t)}</button>
            <p class="stop-t"><b>${e(t.title)}</b><span>${e(t.artistLine)}</span></p>
            <p class="stop-cap">${e(cap)}</p>
            <a class="stop-g mono" href="#g-${t.G.id}">${e(t.G.name)} · ${H.A.bpmTxt(t)}</a>
          </li>`;
        }).join('')}
      </ol>
    </section>`).join('')}

    <section class="sec wrap" aria-labelledby="h-decadas">
      <header class="sec-head">
        <p class="mono eyebrow">Viaje en el tiempo</p>
        <h2 class="sec-title" id="h-decadas">Décadas</h2>
        <p class="sec-intro">Cuantos más registros tiene una década en el archivo, más ancha es su columna. ${noYear} registros sin año contrastado quedan fuera de la cuenta.</p>
      </header>
      <div class="decades">
        ${decs.map((d) => `<button class="dec" type="button" data-decade="${d.d}" style="--n:${d.tracks.length};--p:${(d.tracks.length / Math.max(...decs.map((x) => x.tracks.length))).toFixed(3)}">
          <span class="dec-big" aria-hidden="true">${U.decadeShort(d.d)}</span>
          <span class="dec-meta mono"><span>${U.decadeLabel(d.d)}</span><span class="dec-sep"> · </span><span class="dec-n">${d.tracks.length} ${d.tracks.length === 1 ? 'registro' : 'registros'}</span></span>
          <span class="dec-top">${d.top.map((g) => e(g.name)).join(' · ')}</span>
        </button>`).join('')}
      </div>
    </section>

    <section class="sec wrap" aria-labelledby="h-indice">
      <header class="sec-head sec-head-stack">
        <p class="mono eyebrow">${H.A.genres.length} géneros · ${H.A.families.length} familias</p><h2 class="sec-title" id="h-indice">Índice de géneros</h2>
        <div class="sec-sub"><p class="sec-intro">Ordenados por el año en que aparecen. La barra marca su tempo sobre la escala completa del archivo, de ${H.A.BPM[0]} a ${H.A.BPM[1]} BPM.</p><a class="btn" href="#generos">Ver linajes →</a></div>
      </header>
      ${H.Views.genreIndex()}
    </section>`;

    H.Spectrum.mount(root.querySelector('#spectrum'));
    fitWordmark(root.querySelector('.wordmark svg'));
  };

  // Ajusta el viewBox al ancho real de la palabra cuando la fuente ya está cargada
  function fitWordmark(svg) {
    if (!svg) return;
    const fit = () => {
      try {
        const t = svg.querySelector('text');
        const bb = t.getBBox();
        if (bb.width > 0) svg.setAttribute('viewBox', `${bb.x.toFixed(1)} ${(bb.y + bb.height * 0.06).toFixed(1)} ${bb.width.toFixed(1)} ${(bb.height * 0.86).toFixed(1)}`);
      } catch (err) { /* sin medidas: se queda el viewBox por defecto */ }
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  H.Views.genreIndex = function () {
    return `<div class="gindex">${H.A.families.map((f) => {
      const gs = H.A.genres.filter((g) => g.family === f.id).sort((a, b) => a.era[0] - b.era[0] || a.bpm[0] - b.bpm[0]);
      return `<section class="gfam">
        <h3 class="gfam-h"><span class="mono">${e(f.name)}</span><span class="gfam-b">${e(f.blurb)}</span></h3>
        <ul class="gi-list">${gs.map((g) => `<li><a class="gi ${g.tracks.length ? '' : 'gi-empty'}" href="#g-${g.id}">
          <span class="gi-name">${e(g.name)}</span>
          <span class="gi-ruler">${H.Art.bpmRuler(g.bpm[0], g.bpm[1])}</span>
          <span class="gi-meta mono">${g.bpm[0]}–${g.bpm[1]} BPM · ${g.era[0]}–${g.era[1] || 'hoy'}</span>
          <span class="gi-n mono" ${g.tracks.length > g.primary.length ? `title="${g.tracks.length - g.primary.length} más lo tienen como segundo género"` : ''}>${g.primary.length ? g.primary.length + (g.primary.length === 1 ? ' registro' : ' registros') : g.tracks.length ? 'solo cruces' : 'sin registros'}</span>
        </a></li>`).join('')}</ul>
      </section>`;
    }).join('')}</div>`;
  };
})();
