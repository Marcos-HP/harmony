/* HARMONY · géneros: mapa de linajes + página de cada género */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;
  H.Views = H.Views || {};

  const REL = { origen: 'evoluciona hacia', influencia: 'influye en', paralelo: 'convive con' };

  /* Mapa de linajes: x = año de aparición, carriles = familias, flechas = relaciones */
  function lineageMap() {
    const y0 = 1986, y1 = 2016, PX = 36, ML = 128, MT = 36, ROW = 36, NH = 26;
    const X = (yr) => ML + (yr - y0) * PX;
    const nodes = {};
    let top = MT;
    const lanes = H.A.families.map((f) => {
      const gs = H.A.genres.filter((g) => g.family === f.id).sort((a, b) => a.era[0] - b.era[0]);
      const rows = [];
      gs.forEach((g) => {
        const w = g.name.length * 7.4 + 22, x = X(g.era[0]);
        let r = 0;
        while (rows[r] && rows[r].some((b) => x < b.x + b.w + 10 && x + w + 10 > b.x)) r++;
        (rows[r] = rows[r] || []).push({ x, w });
        nodes[g.id] = { g, x, w, r };
      });
      const lane = { f, top, h: Math.max(1, rows.length) * ROW + 18 };
      gs.forEach((g) => { nodes[g.id].y = top + 12 + nodes[g.id].r * ROW; });
      top += lane.h;
      return lane;
    });
    const W = X(y1) + 200, Hh = top + 10;
    let s = `<svg class="lin-svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="group" aria-label="Mapa de linajes entre géneros">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arr"/></marker></defs>`;
    for (let yr = 1990; yr <= y1; yr += 5) s += `<path d="M${X(yr)} ${MT - 14}V${Hh}" class="gr-minor"/><text x="${X(yr) + 3}" y="${MT - 18}" class="ax-t">${yr}</text>`;
    lanes.forEach((l, i) => {
      s += `<rect x="0" y="${l.top}" width="${W}" height="${l.h}" class="lane ${i % 2 ? 'lane-alt' : ''}"/>`;
      s += `<text x="10" y="${l.top + 26}" class="lane-t">${e(l.f.name.toUpperCase())}</text>`;
    });
    H.data.relations.forEach(([a, b, type]) => {
      const A = nodes[a], B = nodes[b]; if (!A || !B) return;
      const sx = A.x + A.w, sy = A.y + NH / 2;
      let ex = B.x, ey = B.y + NH / 2;
      if (ex < sx - 4) { ex = B.x + B.w / 2; ey = B.y + (B.y > A.y ? 0 : NH); }
      const dx = Math.max(40, Math.abs(ex - sx));
      s += `<path d="M${sx} ${sy} C${sx + dx / 2} ${sy}, ${ex - dx / 2} ${ey}, ${ex} ${ey}" class="edge e-${type}" data-a="${a}" data-b="${b}" ${type !== 'paralelo' ? 'marker-end="url(#arr)"' : ''}/>`;
    });
    Object.values(nodes).forEach((n) => {
      const g = n.g;
      s += `<a href="#g-${g.id}" class="node fam-${g.family} ${g.tracks.length ? '' : 'node-empty'}" data-g="${g.id}" aria-label="${e(g.name)}, desde ${g.era[0]}">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${NH}" class="node-r"/>
        <text x="${n.x + 10}" y="${n.y + 17}" class="node-t">${e(g.name)}</text></a>`;
    });
    return s + '</svg>';
  }

  H.Views.genres = function (root) {
    let view = U.store.get('genView', 'explore');
    root.innerHTML = `
    <section class="page-head wrap">
      <p class="mono eyebrow">Taxonomía</p>
      <h1 class="page-title">Géneros</h1>
      <p class="sec-intro">${H.A.genres.length} géneros en ${H.A.families.length} familias. Elige uno y mira de dónde viene y hacia dónde va; toca cualquier género del árbol para ponerlo en el centro y seguir el hilo. Línea continua: evolución directa. Discontinua: influencia. Punteada: escenas que conviven. Son lecturas editoriales; donde las fuentes discrepan, la página del género lo dice.</p>
    </section>
    <section class="sec wrap gen-sec">
      <div class="seg gen-views" role="group" aria-label="Cómo ver los linajes">
        <button type="button" data-v="explore">${U.icon('branch')}<span>Explorar</span></button>
        <button type="button" data-v="map">${U.icon('grid')}<span>Mapa completo</span></button>
      </div>
      <div class="gen-body"></div>
    </section>
    <section class="sec wrap"><header class="sec-head"><h2 class="sec-title">Índice</h2></header>${H.Views.genreIndex()}</section>`;
    const body = root.querySelector('.gen-body');
    let cur = null;
    const show = (v) => {
      view = v;
      U.store.set('genView', v);
      root.querySelectorAll('.gen-views [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
      if (cur && cur.destroy) cur.destroy();
      cur = v === 'map' ? mountMap(body) : H.Lineage.mount(body);
    };
    root.querySelector('.gen-views').addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b && b.dataset.v !== view) show(b.dataset.v); });
    show(view);
  };

  /* Mapa completo: todos los géneros y todas las relaciones a la vez */
  function mountMap(body) {
    body.innerHTML = `
      <div class="lin-legend mono"><span><i class="lg lg-origen"></i>Evolución</span><span><i class="lg lg-influencia"></i>Influencia</span><span><i class="lg lg-paralelo"></i>Conviven</span><span><i class="lg lg-empty"></i>Sin registros todavía</span></div>
      <div class="lin-scroll" tabindex="0" aria-label="Mapa de linajes, desplazable">${lineageMap()}</div>
      <p class="spec-swipe mono lin-swipe" aria-hidden="true">Desliza el mapa → hasta hoy</p>`;
    const svg = body.querySelector('.lin-svg');
    const hi = (id, on) => {
      svg.classList.toggle('has-hi', on);
      svg.querySelectorAll('.edge').forEach((p) => p.classList.toggle('hi', on && (p.dataset.a === id || p.dataset.b === id)));
      const linked = new Set([id]);
      if (on) svg.querySelectorAll('.edge.hi').forEach((p) => { linked.add(p.dataset.a); linked.add(p.dataset.b); });
      svg.querySelectorAll('.node').forEach((n) => n.classList.toggle('hi', on && linked.has(n.dataset.g)));
    };
    svg.querySelectorAll('.node').forEach((n) => {
      n.addEventListener('pointerenter', () => hi(n.dataset.g, true));
      n.addEventListener('pointerleave', () => hi(n.dataset.g, false));
      n.addEventListener('focus', () => hi(n.dataset.g, true));
      n.addEventListener('blur', () => hi(n.dataset.g, false));
    });
    return null;
  }

  /* Página de género */
  H.Views.genre = function (root, id) {
    const g = H.A.g[id];
    if (!g) { root.innerHTML = `<section class="wrap page-head">${H.C.empty('Ese género no está en el archivo.', '<a href="#generos">Ver todos los géneros</a>')}</section>`; return; }
    const lin = H.A.lineage(g.id);
    const prim = H.A.sort(g.primary, 'year-asc');
    const sec = H.A.sort(g.tracks.filter((t) => t.genre !== g.id), 'year-asc');
    const artists = U.uniq(g.tracks.flatMap((t) => t.A)).filter((a) => a.id !== 'various');
    const labels = U.uniq(g.tracks.map((t) => t.L).filter(Boolean));
    const known = new Set(artists.map((a) => U.norm(a.name)));
    const refsOut = g.refs.filter((r) => !known.has(U.norm(r)));
    const srcs = g.src.map((k) => H.Links.source(k)).filter(Boolean);
    const GL = H.Links.genre(g);
    const famGs = H.A.genres.filter((x) => x.family === g.family).sort((a, b) => a.era[0] - b.era[0]);
    const pos = famGs.indexOf(g);
    const prevG = famGs[pos - 1], nextG = famGs[pos + 1];
    const relList = (arr, empty) => arr.length ? `<ul>${arr.map((x) => `<li><a href="#g-${x.g.id}">${e(x.g.name)}</a><span class="mono">${x.type === 'origen' ? 'evolución' : x.type === 'influencia' ? 'influencia' : 'conviven'} · ${x.g.era[0]}</span></li>`).join('')}</ul>` : `<p class="fine">${empty}</p>`;

    root.innerHTML = `
    <section class="g-hero wrap fam-${g.family}">
      <p class="mono crumbs"><a href="#generos">Géneros</a> / ${e(g.F.name)}</p>
      <h1 class="g-name">${e(g.name)}</h1>
      <div class="g-meta">
        <div class="gm"><span class="mono">Tempo orientativo</span><b>${g.bpm[0]}–${g.bpm[1]} BPM</b>${H.Art.bpmRuler(g.bpm[0], g.bpm[1], { big: true })}<span class="gm-scale mono"><span>${H.A.BPM[0]}</span><span>${H.A.BPM[1]}</span></span></div>
        <div class="gm"><span class="mono">Época</span><b>${g.era[0]}–${g.era[1] || 'hoy'}</b>${H.Art.eraBar(g.era[0], g.era[1], { big: true })}<span class="gm-scale mono"><span>${H.A.YEARS[0]}</span><span>${H.A.YEARS[1]}</span></span></div>
        <div class="gm"><span class="mono">Origen</span><b class="gm-places">${e(g.places)}</b></div>
      </div>
    </section>
    <section class="g-body wrap">
      <div class="g-text">
        <p class="lead">${e(g.summary)}</p>
        ${g.disputed ? `<aside class="disputed"><p class="mono">Clasificación discutible</p><p>${e(g.disputed)}</p></aside>` : ''}
        ${srcs.length ? `<p class="fine">Fuentes: ${srcs.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${e(s.name)} ↗</a>`).join(' · ')}. El resumen es editorial.</p>` : '<p class="fine">Sin fuente citada todavía: resumen editorial.</p>'}
      </div>
      <aside class="g-lin">
        <button class="btn btn-sm g-explore" type="button" data-explore="${g.id}">${U.icon('branch')} Explorar su linaje</button>
        <div><h3 class="mono">Viene de</h3>${relList(lin.from, 'Es una de las raíces del archivo.')}</div>
        <div><h3 class="mono">Convive con</h3>${relList(lin.with, 'Sin escenas paralelas registradas.')}</div>
        <div><h3 class="mono">Lleva a</h3>${relList(lin.to, 'Ninguna escena del archivo sale de aquí todavía.')}</div>
      </aside>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row">
        <h2 class="sec-title sec-title-sm">Registros <span class="mono">${prim.length}</span></h2>
        <div class="sec-actions">${prim.length ? `<button class="btn" type="button" data-enqueue-many="${prim.map((t) => t.id).join(',')}">${U.icon('queue')} Todo a la cola</button><button class="btn" type="button" data-cat-genre="${g.id}">Filtrar en el catálogo →</button>` : ''}</div>
      </header>
      ${prim.length ? H.C.rows(prim) : `<div class="uncharted">
          <p class="mono">Zona sin catalogar</p>
          <p class="uncharted-t">El archivo todavía no tiene registros contrastados de ${e(g.name.toLowerCase())}.</p>
          <p class="fine">Preferimos dejar el hueco a rellenarlo con datos sin verificar. Mientras tanto, puedes explorarlo fuera:</p>
          <div class="chips">${Object.values(GL).map((l) => `<a class="chip" href="${l.url}" target="_blank" rel="noopener">${l.name} <span class="mono">búsqueda ↗</span></a>`).join('')}</div>
        </div>`}
      ${sec.length ? `<h3 class="mono sub-h">También se archivan aquí, como segundo género</h3>${H.C.rows(sec)}` : ''}
    </section>
    <section class="sec wrap g-people">
      <div><h3 class="mono">Artistas en el archivo</h3>${artists.length ? `<div class="chips">${artists.map((a) => `<a class="chip" href="#a-${a.id}">${e(a.name)}</a>`).join('')}</div>` : '<p class="fine">Ninguno todavía.</p>'}</div>
      <div><h3 class="mono">Sellos</h3>${labels.length ? `<div class="chips">${labels.map((l) => `<a class="chip" href="#l-${l.id}">${e(l.name)}</a>`).join('')}</div>` : '<p class="fine">Sin sellos contrastados.</p>'}</div>
      <div><h3 class="mono">Nombres de referencia sin registros en este género</h3>${refsOut.length ? `<p class="refs">${refsOut.map((r) => { const a = H.A.artists.find((x) => U.norm(x.name) === U.norm(r) && x.tracks.length); return a ? `<a href="#a-${a.id}">${e(r)}</a>` : e(r); }).join(' · ')}</p>` : '<p class="fine">Todos los nombres de referencia tienen registros.</p>'}</div>
    </section>
    <nav class="sec wrap g-pager mono" aria-label="Géneros de la misma familia">
      ${prevG ? `<a href="#g-${prevG.id}">← ${e(prevG.name)}</a>` : '<span></span>'}
      ${nextG ? `<a href="#g-${nextG.id}">${e(nextG.name)} →</a>` : '<span></span>'}
    </nav>`;
    root.querySelector('[data-explore]').addEventListener('click', () => {
      U.store.set('egFocus', g.id);
      U.store.set('genView', 'explore');
      H.App.go('generos');
    });
  };
})();
