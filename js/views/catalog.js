/* HARMONY · catálogo: búsqueda, filtros combinables, orden y tres vistas */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;
  H.Views = H.Views || {};

  const SORTS = [
    ['year-asc', 'Año, antiguos primero'], ['year-desc', 'Año, recientes primero'],
    ['bpm-asc', 'BPM, de menos a más'], ['bpm-desc', 'BPM, de más a menos'],
    ['title', 'Título A–Z'], ['artist', 'Artista A–Z'], ['n', 'N.º de registro'], ['relevance', 'Relevancia de la búsqueda']
  ];
  const VIEWS = [['list', 'Lista', 'list'], ['editorial', 'Editorial', 'grid'], ['vinyl', 'Vinilo', 'disc']];

  H.Views.catalog = function (root) {
    const app = H.App, A = H.A;
    const st = app.cat;
    root.innerHTML = `
    <section class="page-head wrap cat-headline">
      <p class="mono eyebrow">Archivo completo</p>
      <h1 class="page-title">Catálogo</h1>
    </section>
    <section class="wrap cat">
      <div class="cat-bar">
        <label class="search"><span class="search-ic">${U.icon('search')}</span><span class="sr-only">Buscar en el catálogo</span>
          <input id="cat-q" type="search" autocomplete="off" spellcheck="false" placeholder="Título, artista, sello, año, HMY…" value="${e(st.f.q)}"></label>
        <label class="sel mono"><span>Orden</span><select id="cat-sort">${SORTS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <div class="seg" role="group" aria-label="Vista">${VIEWS.map(([k, n, ic]) => `<button type="button" data-view="${k}" aria-pressed="${st.view === k}">${U.icon(ic)}<span>${n}</span></button>`).join('')}</div>
      </div>
      <div class="cat-filters">
        <details class="flt" data-k="genres"><summary>Género <span class="flt-n"></span></summary><div class="flt-body"></div></details>
        <details class="flt" data-k="decades"><summary>Década <span class="flt-n"></span></summary><div class="flt-body"></div></details>
        <details class="flt" data-k="artists"><summary>Artista <span class="flt-n"></span></summary><div class="flt-body"></div></details>
        <details class="flt" data-k="labels"><summary>Sello <span class="flt-n"></span></summary><div class="flt-body"></div></details>
        <details class="flt" data-k="bpm"><summary>BPM <span class="flt-n"></span></summary><div class="flt-body flt-bpm"></div></details>
        <label class="flt-ok mono"><input type="checkbox" id="cat-ok" ${st.f.onlyOk ? 'checked' : ''}> Solo año contrastado</label>
      </div>
      <div class="cat-active" aria-label="Filtros activos"></div>
      <p class="cat-count mono" aria-live="polite"></p>
      <div class="cat-results"></div>
      ${H.C.legend()}
    </section>`;

    const $ = (s) => root.querySelector(s);
    const q = $('#cat-q'), sortSel = $('#cat-sort');
    sortSel.value = st.f.sort;

    const update = () => { renderFilters(); renderActive(); renderResults(); };
    q.addEventListener('input', U.debounce(() => {
      const had = !!st.f.q;
      st.f.q = q.value.trim();
      if (st.f.q && !had && st.f.sort !== 'relevance') { st.prevSort = st.f.sort; st.f.sort = 'relevance'; sortSel.value = 'relevance'; }
      if (!st.f.q && st.f.sort === 'relevance') { st.f.sort = st.prevSort || 'year-asc'; sortSel.value = st.f.sort; }
      renderActive(); renderResults(); renderCounts();
    }, 110));
    sortSel.onchange = () => { st.f.sort = sortSel.value; renderResults(); };
    $('#cat-ok').onchange = (ev) => { st.f.onlyOk = ev.target.checked; update(); };
    root.querySelector('.seg').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-view]'); if (!b) return;
      st.view = b.dataset.view; U.store.set('view', st.view);
      root.querySelectorAll('.seg [data-view]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.view === st.view));
      renderResults();
    });
    // un solo panel abierto a la vez; clic fuera cierra
    root.querySelectorAll('.flt').forEach((d) => d.addEventListener('toggle', () => { if (d.open) root.querySelectorAll('.flt').forEach((o) => { if (o !== d) o.open = false; }); }));
    const outside = (ev) => { if (!root.isConnected) { document.removeEventListener('pointerdown', outside); return; } if (!ev.target.closest('.flt')) root.querySelectorAll('.flt[open]').forEach((d) => (d.open = false)); };
    document.addEventListener('pointerdown', outside);

    root.querySelector('.cat-filters').addEventListener('change', (ev) => {
      const i = ev.target;
      if (!i.dataset.fk) return;
      const k = i.dataset.fk, v = k === 'decades' ? +i.value : i.value;
      const arr = st.f[k];
      if (i.checked) { if (!arr.includes(v)) arr.push(v); } else st.f[k] = arr.filter((x) => x !== v);
      renderActive(); renderResults(); renderCounts();
    });

    function counts(k) { return A.facet(A.filter({ ...st.f, [k]: k === 'bpm' ? A.BPM.slice() : [] }), k === 'genres' ? 'genre' : k === 'artists' ? 'artist' : k === 'labels' ? 'label' : 'decade'); }

    function box(k, v, label, n, sel) {
      return `<label class="opt ${n ? '' : 'opt-zero'}"><input type="checkbox" data-fk="${k}" value="${e(v)}" ${sel ? 'checked' : ''}><span>${label}</span><span class="opt-n mono">${n || 0}</span></label>`;
    }

    function renderFilters() {
      // géneros agrupados por familia
      let c = counts('genres');
      root.querySelector('[data-k="genres"] .flt-body').innerHTML = A.families.map((f) => `<fieldset><legend class="mono">${e(f.name)}</legend>${A.genres.filter((g) => g.family === f.id).sort((a, b) => a.era[0] - b.era[0]).map((g) => box('genres', g.id, e(g.name), c[g.id], st.f.genres.includes(g.id))).join('')}</fieldset>`).join('');
      c = counts('decades');
      root.querySelector('[data-k="decades"] .flt-body').innerHTML = A.decades().map((d) => box('decades', d.d, U.decadeLabel(d.d), c[d.d], st.f.decades.includes(d.d))).join('');
      c = counts('artists');
      const arts = A.artists.filter((a) => a.tracks.length && a.id !== 'various').sort((a, b) => a.name.localeCompare(b.name, 'es'));
      const ab = root.querySelector('[data-k="artists"] .flt-body');
      const prevA = ab.querySelector('input[type=search]');
      const aq = prevA ? prevA.value : '';
      ab.innerHTML = `<input type="search" class="flt-q" placeholder="Filtrar artistas" aria-label="Filtrar la lista de artistas" value="${e(aq)}"><div class="flt-list">${arts.map((a) => `<div data-name="${e(U.norm(a.name))}">${box('artists', a.id, e(a.name), c[a.id], st.f.artists.includes(a.id))}</div>`).join('')}</div>`;
      const fq = ab.querySelector('.flt-q');
      const applyQ = () => { const v = U.norm(fq.value); ab.querySelectorAll('[data-name]').forEach((n) => (n.hidden = !!v && !n.dataset.name.includes(v))); };
      fq.oninput = applyQ; applyQ();
      c = counts('labels');
      const labs = A.labels.filter((l) => l.tracks.length).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      root.querySelector('[data-k="labels"] .flt-body').innerHTML = `<div class="flt-list">${labs.map((l) => box('labels', l.id, e(l.name), c[l.id], st.f.labels.includes(l.id))).join('')}</div>`;
      renderBpm();
      renderCounts();
    }

    function renderBpm() {
      const body = root.querySelector('[data-k="bpm"] .flt-body');
      const [a, b] = A.BPM;
      body.innerHTML = `<div class="dual"><input type="range" id="bpm-lo" min="${a}" max="${b}" step="1" value="${st.f.bpm[0]}" aria-label="BPM mínimo"><input type="range" id="bpm-hi" min="${a}" max="${b}" step="1" value="${st.f.bpm[1]}" aria-label="BPM máximo"><div class="dual-fill"></div></div>
        <p class="dual-read mono"><span id="bpm-read"></span><button type="button" class="link-btn" id="bpm-reset">Todo el rango</button></p>
        <div class="bpm-presets">
          ${[[105, 130, 'Raíces'], [135, 150, 'Hard dance'], [150, 160, 'Hardstyle'], [160, 180, 'Hardcore'], [180, 260, 'Más de 180']].map(([x, y, n]) => `<button type="button" class="chip chip-sm" data-preset="${x}-${y}">${n} · ${x}–${y}</button>`).join('')}</div>`;
      const lo = body.querySelector('#bpm-lo'), hi = body.querySelector('#bpm-hi'), fill = body.querySelector('.dual-fill'), rd = body.querySelector('#bpm-read');
      const paint = () => {
        const L = +lo.value, R = +hi.value;
        fill.style.left = ((L - a) / (b - a)) * 100 + '%'; fill.style.right = (100 - ((R - a) / (b - a)) * 100) + '%';
        rd.textContent = L + '–' + R + ' BPM';
      };
      const commit = U.debounce(() => { renderActive(); renderResults(); renderCounts(); }, 80);
      lo.oninput = () => { if (+lo.value > +hi.value - 2) lo.value = +hi.value - 2; st.f.bpm[0] = +lo.value; paint(); commit(); };
      hi.oninput = () => { if (+hi.value < +lo.value + 2) hi.value = +lo.value + 2; st.f.bpm[1] = +hi.value; paint(); commit(); };
      body.querySelector('#bpm-reset').onclick = () => { st.f.bpm = A.BPM.slice(); renderBpm(); renderActive(); renderResults(); renderCounts(); };
      body.querySelectorAll('[data-preset]').forEach((p) => (p.onclick = () => { const [x, y] = p.dataset.preset.split('-').map(Number); st.f.bpm = [x, y]; renderBpm(); renderActive(); renderResults(); renderCounts(); }));
      paint();
    }

    function renderCounts() {
      const n = { genres: st.f.genres.length, decades: st.f.decades.length, artists: st.f.artists.length, labels: st.f.labels.length, bpm: A.isBpmActive(st.f) ? 1 : 0 };
      root.querySelectorAll('.flt').forEach((d) => { const k = d.dataset.k; d.classList.toggle('is-on', !!n[k]); d.querySelector('.flt-n').textContent = n[k] ? (k === 'bpm' ? st.f.bpm.join('–') : n[k]) : ''; });
    }

    function renderActive() {
      const chips = [];
      if (st.f.q) chips.push(['q', '', `«${e(st.f.q)}»`]);
      st.f.genres.forEach((id) => chips.push(['genres', id, e(A.g[id].name)]));
      st.f.decades.forEach((d) => chips.push(['decades', d, U.decadeLabel(d)]));
      st.f.artists.forEach((id) => chips.push(['artists', id, e(A.a[id].name)]));
      st.f.labels.forEach((id) => chips.push(['labels', id, e(A.l[id].name)]));
      if (A.isBpmActive(st.f)) chips.push(['bpm', '', st.f.bpm.join('–') + ' BPM']);
      if (st.f.onlyOk) chips.push(['onlyOk', '', 'Año contrastado']);
      const box = root.querySelector('.cat-active');
      box.innerHTML = chips.length ? chips.map(([k, v, l]) => `<button type="button" class="chip chip-on" data-rm="${k}" data-v="${e(v)}" aria-label="Quitar filtro ${l.replace(/<[^>]+>/g, '')}">${l} ${U.icon('close')}</button>`).join('') + `<button type="button" class="link-btn mono" data-rm="all">Limpiar todo</button>` : '';
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-rm]'); if (!b) return;
        const k = b.dataset.rm, v = b.dataset.v;
        if (k === 'all') { const keep = { sort: st.f.sort === 'relevance' ? 'year-asc' : st.f.sort }; st.f = { ...A.defaultFilters(), ...keep }; q.value = ''; sortSel.value = st.f.sort; $('#cat-ok').checked = false; }
        else if (k === 'q') { st.f.q = ''; q.value = ''; if (st.f.sort === 'relevance') { st.f.sort = st.prevSort || 'year-asc'; sortSel.value = st.f.sort; } }
        else if (k === 'bpm') st.f.bpm = A.BPM.slice();
        else if (k === 'onlyOk') { st.f.onlyOk = false; $('#cat-ok').checked = false; }
        else st.f[k] = st.f[k].filter((x) => String(x) !== v);
        update();
      };
    }

    function renderResults() {
      const list = A.sort(A.filter(st.f), st.f.sort, st.f.q);
      root.querySelector('.cat-count').textContent = `${list.length} de ${A.tracks.length} registros`;
      const out = root.querySelector('.cat-results');
      if (!list.length) {
        out.innerHTML = H.C.empty('Nada con esos filtros.', 'Quita alguno de los filtros activos o prueba otra búsqueda. El archivo tiene ' + A.tracks.length + ' registros; si buscas algo concreto que falta, es un buen candidato para la próxima tanda.');
        return;
      }
      out.className = 'cat-results view-' + st.view;
      if (st.view === 'editorial') out.innerHTML = editorial(list);
      else if (st.view === 'vinyl') out.innerHTML = vinyl(list);
      else out.innerHTML = H.C.rows(list);
    }

    update();
  };

  /* Vista editorial: jerarquías distintas según la posición */
  function editorial(list) {
    const P = ['L', 'S', 'S', 'S', 'M', 'S', 'S', 'M'];
    return `<div class="ed-grid">${list.map((t, i) => {
      const k = P[i % P.length];
      const acts = `<span class="ed-acts"><button class="ibtn" type="button" data-play="${t.id}" aria-label="Poner en el plato: ${e(t.title)}">${U.icon('play')}</button><button class="ibtn" type="button" data-enqueue="${t.id}" aria-label="Añadir a la cola: ${e(t.title)}">${U.icon('plus')}</button>${H.C.favBtn(t)}</span>`;
      if (k === 'L') return `<article class="ed ed-L">
          <button class="ed-sleeve" type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t)}</button>
          <div class="ed-txt"><span class="ed-year">${t.year != null ? t.year : '—'}</span>
            <p class="mono">${t.hmy} · ${H.C.genre(t.G)} · ${H.C.bpm(t)} BPM</p>
            <h3 class="ed-title"><button type="button" data-open="${t.id}">${e(t.title)}</button></h3>
            <p class="ed-artist">${H.C.artists(t)}</p>
            ${t.note ? `<p class="ed-note">${e(t.note)}</p>` : ''}${acts}</div></article>`;
      if (k === 'M') return `<article class="ed ed-M">
          <button class="ed-sleeve" type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t)}</button>
          <div class="ed-txt"><p class="mono">${t.hmy} · ${H.C.year(t)} · ${H.C.genre(t.G)}</p>
            <h3 class="ed-title"><button type="button" data-open="${t.id}">${e(t.title)}</button></h3>
            <p class="ed-artist">${H.C.artists(t)}</p>
            ${t.note ? `<p class="ed-note">${e(t.note.length > 150 ? t.note.slice(0, 147).replace(/\s+\S*$/, '') + '…' : t.note)}</p>` : ''}${acts}</div></article>`;
      return `<article class="ed ed-S">
          <button class="ed-sleeve" type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t)}</button>
          <div class="ed-txt"><h3 class="ed-title"><button type="button" data-open="${t.id}">${e(t.title)}</button></h3>
            <p class="ed-artist">${e(t.artistLine)}</p><p class="mono">${H.C.year(t)} · ${H.C.bpm(t)}</p>${acts}</div></article>`;
    }).join('')}</div>`;
  }

  /* Vista vinilo: separadores por sello, como en una caja de discos */
  function vinyl(list) {
    const groups = new Map();
    list.forEach((t) => { const k = t.L ? t.L.id : '_none'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const keys = Array.from(groups.keys()).sort((a, b) => (a === '_none') - (b === '_none') || groups.get(b).length - groups.get(a).length || (H.A.l[a] ? H.A.l[a].name : '').localeCompare(H.A.l[b] ? H.A.l[b].name : '', 'es'));
    return keys.map((k) => {
      const L = H.A.l[k], ts = H.A.sort(groups.get(k), 'year-asc');
      const meta = L ? [L.country, L.founded ? 'desde ' + L.founded : null].filter(Boolean).join(' · ') : '';
      const dq = L ? 'https://www.discogs.com/search/?type=label&q=' + encodeURIComponent(L.name) : null;
      return `<section class="crate">
        <header class="crate-tab"><h3>${L ? `<a href="#l-${L.id}">${e(L.name)}</a>` : 'Sin sello contrastado'}</h3>
          <span class="mono">${meta ? e(meta) + ' · ' : ''}${ts.length} ${ts.length === 1 ? 'registro' : 'registros'}</span>
          ${dq ? `<a class="mono crate-out" href="${dq}" target="_blank" rel="noopener">Discogs · búsqueda ↗</a>` : ''}</header>
        <ol class="crate-row">${ts.map((t) => `<li class="vin">
          <button class="vin-sleeve" type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t, { variant: 2 })}</button>
          <p class="vin-t"><b>${e(t.title)}</b><span>${e(t.artistLine)}</span></p>
          <dl class="vin-d mono">
            <div><dt>Año</dt><dd>${H.C.year(t)}</dd></div>
            <div><dt>Formato</dt><dd>${t.format ? H.C.v(H.A.status(t, 'format'), e(t.format)) : H.C.v('na', 'sin datos')}</dd></div>
            <div><dt>Cat.</dt><dd>${t.catno ? H.C.v(H.A.status(t, 'catno'), e(t.catno)) : H.C.v('na', '—')}</dd></div>
            <div><dt>Tipo</dt><dd>${H.C.kind(t)}</dd></div>
          </dl>
          ${(() => { const d = H.Links.physical(t).discogs; return `<a class="mono vin-out ${d.direct ? 'is-direct' : ''}" href="${d.url}" target="_blank" rel="noopener">${d.direct ? (d.scope === 'todas las ediciones' ? 'Discogs · ediciones ↗' : 'Discogs · esta edición ↗') : 'Buscar edición ↗'}</a>`; })()}
        </li>`).join('')}</ol></section>`;
    }).join('');
  }
})();
