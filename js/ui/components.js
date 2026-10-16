/* HARMONY · piezas reutilizables de interfaz (HTML en texto) */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const C = (H.C = {});
  const e = U.esc;

  const STATUS = {
    ok: ['Contrastado', 'Contrastado con la fuente citada'],
    src: ['Con fuente', 'Aparece en la fuente citada'],
    ed: ['Editorial', 'Dato de la redacción, pendiente de contrastar'],
    est: ['Estimado', 'Estimado por la redacción según género y época; pendiente de medir'],
    na: ['Sin datos', 'Sin datos fiables por ahora'],
    cf: ['En desacuerdo', 'Las fuentes no coinciden: se muestra el dato contrastado primero']
  };
  C.STATUS = STATUS;

  C.v = (st, text) => `<span class="v v-${st}" title="${STATUS[st][1]}">${text}</span>`;
  C.year = (t) => C.v(H.A.status(t, 'year'), t.year != null ? t.year : '—');
  C.bpm = (t) => C.v(H.A.status(t, 'bpm'), H.A.bpmTxt(t));
  C.genre = (g, cls = '') => `<a class="g-link ${cls}" href="#g-${g.id}">${e(g.name)}</a>`;
  C.artists = (t) => t.A.map((a) => (a.id === 'various' ? e(a.name) : `<a href="#a-${a.id}">${e(a.name)}</a>`)).join(t.A.length > 2 ? ', ' : ' & ');
  C.label = (t) => (t.L ? C.v(H.A.status(t, 'label'), `<a href="#l-${t.L.id}">${e(t.L.name)}</a>`) : C.v('na', '—'));
  C.kind = (t) => ({ tema: 'Tema', ep: 'EP', album: 'Álbum', recopilatorio: 'Recopilatorio', lanzamiento: 'Lanzamiento' }[t.kind] || 'Tema');

  C.mark = (st) => `<span class="mk mk-${st}" aria-hidden="true"></span>`;

  /* Diseño real del disco (Cover Art Archive, vía MusicBrainz), en color y tal cual, sobre la funda generativa.
     Si la imagen no carga (sin portada, sin red o bloqueada), se retira y queda la funda. */
  const realImg = (src, cls) => `<img class="${cls}" src="${e(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  /* Un CD se ve como un CD: su portada dentro de una caja con bisagra, no estirada a funda de vinilo */
  C.cover = (t, o = {}) => {
    // sin imagen del original (un CD, por ejemplo) pero con la de su edición en vinilo: se ve el vinilo
    const src = o.src || t.cover || t.vinylSleeve, kind = o.kind || (!t.cover && t.vinylSleeve ? 'vinyl' : t.fmtKind);
    return `<span class="cv${o.cls ? ' ' + o.cls : ''}${src && kind === 'cd' ? ' cv-cd' : ''}">${H.Art.sleeve(t, { variant: o.variant })}${src ? realImg(src, 'cv-img') : ''}</span>`;
  };
  /* Galleta real del disco sobre la generada (plato, mini reproductor, ficha) */
  C.discLabel = (t, opts = {}) => H.Art.label(t, opts) + (t && t.labelArt ? `<span class="lb-real">${realImg(t.labelArt, 'cv-img lb-img')}<i class="lb-real-hole"></i></span>` : '');

  C.legend = () => `<ul class="legend mono">
      <li>${C.mark('ok')} Contrastado con fuente</li>
      ${H.A.tracks.some((t) => t.conflicts && t.conflicts.length) ? `<li>${C.mark('cf')} Fuentes en desacuerdo</li>` : ''}
      <li>${C.mark('ed')} Editorial, sin contrastar</li>
      <li><span class="mk-t">≈</span> BPM estimado por la redacción</li>
      <li><span class="mk-t">—</span> Sin datos</li>
      <li><span class="mk-t">↗</span> Búsqueda externa</li>
    </ul>`;

  C.favBtn = (t, cls = 'ibtn') => {
    const on = H.App.isFav(t.id);
    return `<button class="${cls} r-fav" type="button" data-fav="${t.id}" aria-pressed="${on}" aria-label="${on ? 'Quitar de tu caja' : 'Guardar en tu caja'}: ${e(t.title)}">${U.icon(on ? 'crateOn' : 'crate')}</button>`;
  };

  /* Fila compacta */
  C.row = (t, opts = {}) => `
    <li class="row ${H.Deck && H.Deck.current === t ? 'is-cur' : ''}" data-id="${t.id}">
      <span class="r-n mono">${opts.n != null ? U.pad(opts.n, 2) : t.hmy}</span>
      <button class="ibtn r-play" type="button" data-play="${t.id}" aria-label="Poner en el plato: ${e(t.title)}">${U.icon('play')}</button>
      <button class="r-main" type="button" data-open="${t.id}"><b class="r-title">${e(t.title)}</b><span class="r-artist">${e(t.artistLine)}</span></button>
      <span class="r-genre mono">${C.genre(t.G)}</span>
      <span class="r-year mono">${C.year(t)}</span>
      <span class="r-bpm mono">${C.bpm(t)}</span>
      <span class="r-label">${t.L ? C.label(t) : '<span class="v v-na">—</span>'}</span>
      <span class="r-act">
        <button class="ibtn" type="button" data-enqueue="${t.id}" aria-label="Añadir a la cola: ${e(t.title)}">${U.icon('plus')}</button>
        ${C.favBtn(t)}
      </span>
    </li>`;

  C.rows = (list, opts = {}) => list.length
    ? `<div class="rows-wrap"><div class="rows-head mono" aria-hidden="true"><span>${opts.numbered ? 'N.º' : 'Registro'}</span><span></span><span>Título · artista</span><span class="r-genre">Género</span><span class="r-year">Año</span><span class="r-bpm">BPM</span><span class="r-label">Sello</span><span></span></div>
       <ol class="rows">${list.map((t, i) => C.row(t, opts.numbered ? { n: i + 1 } : {})).join('')}</ol></div>`
    : '';

  C.empty = (title, body) => `<div class="empty"><p class="empty-t">${title}</p>${body ? `<p class="empty-b">${body}</p>` : ''}</div>`;

  /* Lo que gira en el plato. Si el original no es un vinilo, su primera edición en vinilo; si no hay, el disco de Harmony. */
  function vinylBlock(t) {
    const V = t.vinylEd, yr = V && V.date ? ', ' + V.date.slice(0, 4) : '';
    // «original» es lo que dice MusicBrainz; si el vinilo es del mismo año, no sabemos cuál salió antes
    const orig = `Según MusicBrainz, el original salió en ${e(H.A.FORMAT_ES[t.fmtKind] || 'otro formato')}${V && V.date && V.date.slice(0, 4) === String(t.year) ? ', y ese mismo año también en vinilo' : ''}.`;
    if (V && (t.labelFromVinylEd || (t.vinylSleeve && t.cover))) {
      return `<figure class="sh-labelart sh-vined">
        <span class="sh-vin-pics">${t.vinylSleeve && t.cover ? `<span class="sh-vs">${C.cover(t, { src: t.vinylSleeve, kind: 'vinyl' })}</span>` : ''}${t.labelFromVinylEd ? `<span class="sh-lb">${C.discLabel(t)}</span>` : ''}</span>
        <figcaption class="mono">${orig} ${t.labelFromVinylEd ? 'En el plato gira su edición en vinilo' : 'Funda de su edición en vinilo'}: <a href="${V.url}" target="_blank" rel="noopener">«${e(V.title)}»${yr} ↗</a>${t.labelFromVinylEd ? '' : '. Sin foto de su galleta, en el plato gira el disco de Harmony'}.</figcaption></figure>`;
    }
    if (t.labelArt) return `<figure class="sh-labelart"><span class="sh-lb">${C.discLabel(t)}</span><figcaption class="mono">Galleta del vinilo original${t.artFrom ? ` · <a href="${t.artFrom}" target="_blank" rel="noopener">Cover Art Archive ↗</a>` : ''}</figcaption></figure>`;
    if (V) return `<p class="fine sh-vinote">${orig} Hay edición en vinilo, <a href="${V.url}" target="_blank" rel="noopener">«${e(V.title)}»${yr} ↗</a>, pero sin foto de su galleta: en el plato gira el disco de Harmony.</p>`;
    if (t.noVinyl) return `<p class="fine sh-vinote">MusicBrainz no registra ninguna edición en vinilo de este tema: salió en ${e(H.A.FORMAT_ES[t.fmtKind])}. En el plato gira el disco de Harmony.</p>`;
    return '';
  }

  /* Ficha de un registro (panel lateral) */
  C.sheet = (t) => {
    const L = H.Links.listen(t), P = H.Links.physical(t), more = H.Links.more(t);
    const rel = H.A.related(t, 6);
    const st = (f) => H.A.status(t, f);
    const ri = t.releaseInfo;
    const relSub = ri ? [ri.type, ri.country, ri.date && ri.date !== String(t.year) ? ri.date : null].filter(Boolean).join(' · ') : '';
    const dl = [
      ['year', 'Año', C.year(t), st('year')],
      ['genre', 'Género', C.genre(t.G) + (t.G2 ? ` <span class="sub">también ${C.genre(t.G2)}</span>` : ''), t.src.length ? 'src' : 'ed'],
      ['bpm', 'BPM', H.A.bpmTxt(t), st('bpm')],
      ['label', 'Sello', t.L ? `<a href="#l-${t.L.id}">${e(t.L.name)}</a>` : ri && ri.selfReleased ? 'Autoeditado' : '—', t.L ? st('label') : ri && ri.selfReleased ? 'ok' : 'na'],
      ['release', 'Lanzamiento', t.release ? e(t.release) + (relSub ? ` <span class="sub">${e(relSub)}</span>` : '') : '—', st('release')],
      ['kind', 'Tipo', C.kind(t), t.src.length ? 'src' : 'ed'],
      ['format', 'Formato', t.format ? e(t.format) : '—', st('format')],
      ['catno', 'N.º de catálogo', t.catno ? e(t.catno) : '—', st('catno')],
      ['hmy', 'Registro', t.hmy, 'hmy']
    ];
    const by = (f) => (t.okBy && t.okBy[f]) || (f === 'label' && t.MB ? 'MusicBrainz' : '');
    const statusCell = (f, s) => (s === 'hmy' ? '<span class="st mono">Número del archivo Harmony</span>' : `<span class="st mono">${C.mark(s)} ${STATUS[s][0]}${s === 'ok' && by(f) ? ' · ' + by(f) : ''}</span>`);
    const srcs = t.src.map((k) => H.Links.source(k)).filter(Boolean);
    const fav = H.App.isFav(t.id);
    const FIELD = { year: 'Año', label: 'Sello', release: 'Lanzamiento', catno: 'N.º de catálogo', format: 'Formato', bpm: 'BPM' };
    const anyDirect = ['spotify', 'ytmusic', 'youtube'].some((k) => L[k].direct) || more.length;
    const mbDate = H.A.mbStats && H.A.mbStats.date;
    const fmtD = (d) => d.split('-').reverse().join('/');
    return `
    <header class="sh-head">
      <span class="mono">${t.hmy} · Ficha</span>
      <button class="ibtn sh-close" type="button" aria-label="Cerrar ficha">${U.icon('close')}</button>
    </header>
    <div class="sh-top">
      <figure class="sh-sleeve">${C.cover(t)}<figcaption class="mono"><span class="cap-gen">Funda generada por Harmony a partir del género y el registro. No es la carátula original.</span><span class="cap-cov">${t.cover ? `Portada de la edición original${t.fmtKind && t.fmtKind !== 'vinyl' ? ' (' + H.A.FORMAT_ES[t.fmtKind] + ')' : ''}${t.artFrom ? ` · <a href="${t.artFrom}" target="_blank" rel="noopener">Cover Art Archive ↗</a>` : ''}` : t.vinylSleeve && t.vinylEd ? `Funda de su edición en vinilo · <a href="${t.vinylEd.artUrl}" target="_blank" rel="noopener">Cover Art Archive ↗</a>` : ''}</span></figcaption></figure>
      <div class="sh-id">
        <p class="mono eyebrow">${e(t.G.F.name)} · ${C.kind(t)}</p>
        <h2 class="sh-title" id="sheet-title">${e(t.title)}</h2>
        <p class="sh-artists">${C.artists(t)}</p>
        <div class="sh-actions">
          <button class="btn btn-solid" type="button" data-play="${t.id}" data-open-deck="1">${U.icon('play')} Poner en el plato</button>
          <button class="btn" type="button" data-enqueue="${t.id}">${U.icon('plus')} Cola</button>
          <button class="btn" type="button" data-fav="${t.id}" aria-pressed="${fav}">${U.icon(fav ? 'crateOn' : 'crate')} ${fav ? 'En tu caja' : 'Caja'}</button>
        </div>
      </div>
    </div>
    ${t.note ? `<p class="sh-note">${e(t.note)}</p>` : ''}
    <dl class="sh-data">${dl.map(([f, k, v, s]) => `<div class="${s === 'na' ? 'is-na' : ''}"><dt class="mono">${k}</dt><dd>${v}</dd><dd>${statusCell(f, s)}</dd></div>`).join('')}</dl>
    ${t.conflicts && t.conflicts.length ? `<div class="sh-conflict"><p class="mono">${C.mark('cf')} Fuentes en desacuerdo</p>${t.conflicts.map((c) => `<p>${FIELD[c.field] || c.field}: ${e(c.by || 'la fuente anterior')} dice <b>${e(c.ed)}</b>; ${e(c.otherBy)}, <b>${e(c.other)}</b>. Se muestra el primero hasta revisarlo.</p>`).join('')}</div>` : ''}
    ${vinylBlock(t)}
    ${t.dz ? `<section class="sh-sec sh-listen">
      <h3 class="mono">Escuchar en Harmony</h3>
      <p class="fine"><b>Muestra de 30 s de Deezer</b>: ${e(H.Dz ? H.Dz.origin(t) : t.dz.title)}. ${t.dz.verified ? 'Es la misma grabación que registra MusicBrainz (mismo ISRC).' : t.dz.pinned ? '' : 'Emparejada por título y artista.'} ${e(t.dz.notes.filter((n) => !/^Misma grabación/.test(n)).join(' '))} Suena en el plato y en la mesa con pitch, ecualizador y BPM medido; uso privado, Harmony no la guarda.</p>
      ${H.Dz && H.Dz.blocked() ? `<p class="fine">${e(H.Dz.message({ code: 'blocked' }))}</p>` : `<div class="chips"><button class="chip chip-solid" type="button" data-play="${t.id}">${U.icon('play')} Escuchar la muestra</button></div>`}
    </section>` : ''}
    <section class="sh-sec">
      <h3 class="mono">Escuchar fuera de Harmony</h3>
      <div class="chips">${['spotify', 'ytmusic', 'youtube'].map((k) => `<a class="chip ${L[k].direct ? 'chip-direct' : ''}" href="${L[k].url}" target="_blank" rel="noopener">${L[k].name} <span class="mono">${L[k].direct ? (L[k].scope || 'enlace') + ' ↗' : 'búsqueda ↗'}</span></a>`).join('')}
        ${more.map((l) => `<a class="chip chip-direct" href="${l.url}" target="_blank" rel="noopener">${l.name} <span class="mono">${l.scope || 'enlace'} ↗</span></a>`).join('')}</div>
      <p class="fine">${anyDirect ? `Los enlaces directos vienen de MusicBrainz${t.dz ? ' y, el de Deezer, del emparejado de su muestra' : ''}; los marcados como «búsqueda» abren el buscador del servicio.` : 'Sin enlaces directos verificados todavía: cada botón abre una búsqueda en el servicio.'}</p>
    </section>
    <section class="sh-sec">
      <h3 class="mono">Edición física</h3>
      <p class="fine">${t.format || t.catno ? `${t.format ? e(t.format) : 'Formato sin datos'}${t.catno ? ' · ' + e(t.catno) : ' · sin n.º de catálogo contrastado'}${ri && ri.country ? ' · ' + e(ri.country) : ''}.` : 'Sin datos contrastados de formato ni número de catálogo.'} Harmony no muestra precios ni disponibilidad.</p>
      <div class="chips">${['discogs', 'amazon'].map((k) => `<a class="chip ${P[k].direct ? 'chip-direct' : ''}" href="${P[k].url}" target="_blank" rel="noopener">${P[k].name} <span class="mono">${P[k].direct ? (P[k].scope === 'todas las ediciones' ? 'todas las ediciones' : 'esta edición') + ' ↗' : 'búsqueda ↗'}</span></a>`).join('')}</div>
    </section>
    <section class="sh-sec">
      <h3 class="mono">Fuentes</h3>
      ${srcs.length ? `<ul class="src-list">${srcs.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${e(s.name)} ↗</a> <span class="mono src-date">${/^MusicBrainz/.test(s.name) ? (mbDate ? 'importado el ' + fmtD(mbDate) : '') : 'consultada el ' + fmtD(s.date || H.data.checkedOn)}</span></li>`).join('')}</ul><p class="fine">Lo marcado como editorial no aparece en ellas.</p>` : '<p class="fine">Todavía sin fuente: todos los datos de este registro son editoriales.</p>'}
    </section>
    <section class="sh-sec">
      <h3 class="mono">Si te gusta, sigue por aquí</h3>
      <ol class="rel">${rel.map((r) => `<li><button type="button" data-open="${r.t.id}" class="rel-main">${C.cover(r.t, { cls: 'rel-sleeve' })}<span class="rel-txt"><b>${e(r.t.title)}</b><span>${e(r.t.artistLine)} · ${r.t.year != null ? r.t.year : 'año —'}</span><span class="rel-why mono">${r.why.map(e).join(' · ')}</span></span></button></li>`).join('')}</ol>
    </section>`;
  };
})();
