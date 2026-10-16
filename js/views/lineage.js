/* HARMONY · explorador de linajes
   Un género en el centro. Arriba, de dónde viene; abajo, hacia dónde va y con qué convive.
   Cada fila es un género sobre la misma línea del tiempo (1985–hoy). Las ramas bajan en vertical
   desde el año en que aparece el género nuevo, como en un árbol de versiones.
   Toca una fila y pasa al centro: las filas que siguen en pantalla se desplazan a su nuevo sitio. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;

  const AX = 30, HEAD = 28, ROW = 44, FOCUS = 64, BAR = 6;
  const KIND = { origen: 'evolución', influencia: 'influencia', paralelo: 'conviven' };

  function mount(root) {
    const A = H.A;
    const hub = A.genres.slice().sort((a, b) => (A.adj[b.id] || []).length - (A.adj[a.id] || []).length)[0];
    const saved = U.store.get('egFocus', null);
    const st = { focus: A.g[saved] ? saved : hub.id, trail: [], rows: new Map(), w: 0, t: 0 };
    st.trail = [st.focus];

    const fams = A.families.map((f) => {
      const gs = A.genres.filter((g) => g.family === f.id).sort((a, b) => a.era[0] - b.era[0]);
      return `<optgroup label="${e(f.name)}">${gs.map((g) => `<option value="${g.id}">${e(g.name)} · ${g.era[0]}</option>`).join('')}</optgroup>`;
    }).join('');

    root.innerHTML = `
      <div class="eg">
        <div class="eg-tools">
          <label class="eg-pick"><span class="mono">Ir a</span><select class="eg-select" aria-label="Elegir un género">${fams}</select></label>
          <button class="btn btn-sm" type="button" data-eg="random">${U.icon('shuffle')} Al azar</button>
          <p class="eg-legend mono" aria-hidden="true"><span><i class="lg"></i>Evolución</span><span><i class="lg lg-influencia"></i>Influencia</span><span><i class="lg lg-paralelo"></i>Conviven</span><span><i class="lg lg-dash"></i>Sin registros</span></p>
        </div>
        <nav class="eg-trail" aria-label="Tu recorrido"><span class="mono">Recorrido</span><ol></ol></nav>
        <div class="eg-main">
          <div class="eg-stage">
            <div class="eg-rows"></div>
            <svg class="eg-svg" aria-hidden="true"></svg>
          </div>
          <aside class="eg-panel"></aside>
        </div>
        <p class="sr-only" aria-live="polite"></p>
      </div>`;

    const stage = root.querySelector('.eg-stage'), rowsEl = root.querySelector('.eg-rows'), svg = root.querySelector('.eg-svg');
    const panel = root.querySelector('.eg-panel'), trail = root.querySelector('.eg-trail ol'), sel = root.querySelector('.eg-select');
    const live = root.querySelector('[aria-live]');
    const end = (g) => (g.era[1] == null ? A.YEARS[1] : g.era[1] + 1);

    /* Qué filas hay y a qué altura van */
    function plan() {
      const L = A.lineage(st.focus);
      const byYear = (a, b) => a.g.era[0] - b.g.era[0] || a.g.name.localeCompare(b.g.name);
      const seen = new Set([st.focus]);
      const keep = (arr) => arr.slice().sort(byYear).filter((x) => !seen.has(x.g.id) && seen.add(x.g.id));
      const from = keep(L.from), to = keep(L.to), wi = keep(L.with);
      const items = [];
      items.push({ key: 'h-from', kind: 'head', text: from.length ? 'Viene de' : 'Viene de · es una raíz del archivo' });
      from.forEach((x) => items.push({ key: x.g.id, kind: 'from', g: x.g, type: x.type }));
      items.push({ key: st.focus, kind: 'focus', g: A.g[st.focus] });
      items.push({ key: 'h-to', kind: 'head', text: to.length ? 'Lleva a' : 'Lleva a · nada todavía en el archivo' });
      to.forEach((x) => items.push({ key: x.g.id, kind: 'to', g: x.g, type: x.type }));
      if (wi.length) {
        items.push({ key: 'h-with', kind: 'head', text: 'Convive con' });
        wi.forEach((x) => items.push({ key: x.g.id, kind: 'with', g: x.g, type: x.type }));
      }
      let y = AX;
      items.forEach((it) => { it.h = it.kind === 'head' ? HEAD : it.kind === 'focus' ? FOCUS : ROW; it.y = y; y += it.h; });
      return { items, height: y + 8, from, to, wi };
    }

    /* Contenido de cada fila. La barra y el punto se conservan entre focos para que se deslicen. */
    function paintRow(el, it, X, R) {
      if (it.kind === 'head') { el.innerHTML = `<p class="eg-h mono">${e(it.text)}</p>`; return; }
      let btn = el.querySelector('.eg-name'), era = el.querySelector('.eg-era'), dot = el.querySelector('.eg-dot');
      if (!btn) {
        el.innerHTML = '<button class="eg-name" type="button"></button><span class="eg-era"></span><i class="eg-dot"></i>';
        btn = el.firstChild; era = btn.nextSibling; dot = era.nextSibling;
      }
      const g = it.g, x0 = X(g.era[0]), x1 = Math.min(X(end(g)), R);
      era.className = `eg-era${g.era[1] == null || X(end(g)) > R ? ' is-open' : ''}${it.kind === 'focus' ? ' pat-' + g.F.pattern : ''}`;
      era.style.left = x0.toFixed(1) + 'px';
      era.style.width = Math.max(2, x1 - x0).toFixed(1) + 'px';
      dot.style.left = x0.toFixed(1) + 'px';
      btn.className = 'eg-name' + (it.kind === 'focus' ? ' eg-fname' : '');
      if (it.kind === 'focus') {
        btn.removeAttribute('data-go');
        btn.dataset.page = g.id;
        btn.setAttribute('aria-label', `${g.name}: abrir la página del género`);
        btn.innerHTML = `<b>${e(g.name)}</b><span class="mono">${g.era[0]}–${g.era[1] || 'hoy'}<span class="eg-fbpm"> · ${g.bpm[0]}–${g.bpm[1]} BPM</span></span>`;
        return;
      }
      const rel = KIND[it.type], F = A.g[st.focus].name;
      const label = it.kind === 'from' ? `${rel} hacia ${F}` : it.kind === 'to' ? `${rel} desde ${F}` : `convive con ${F}`;
      btn.removeAttribute('data-page');
      btn.dataset.go = g.id;
      btn.setAttribute('aria-label', `${g.name}, desde ${g.era[0]}, ${label}${g.tracks.length ? '' : ', sin registros todavía'}. Ponerlo en el centro`);
      btn.innerHTML = `<b>${e(g.name)}</b><span class="mono">${g.era[0]} · ${rel}</span>`;
    }

    /* Escala local: del primer año a la vista a unos años después del último que empieza.
       Lo que sigue vivo hoy se sale por la derecha con un degradado. */
    function range(P) {
      const gs = P.items.filter((it) => it.g).map((it) => it.g);
      const starts = gs.map((g) => g.era[0]);
      const F = A.g[st.focus];
      let lo = Math.min(...starts) - 2;
      let hi = Math.max(Math.max(...starts) + 7, (F.era[1] == null ? Math.max(...starts) : F.era[1]) + 3);
      if (hi - lo < 18) hi = lo + 18;
      return [lo, Math.min(hi, A.YEARS[1] + 1)];
    }

    function render(anim) {
      const P = plan();
      const W = Math.round(stage.clientWidth);
      if (!W) return;
      st.w = W;
      const LW = Math.round(U.clamp(W * 0.42, 142, 214));
      const T0 = LW + 18, T1 = W - 10;
      const [lo, hi] = range(P);
      const X = (yr) => T0 + ((yr - lo) / (hi - lo)) * (T1 - T0);
      stage.style.height = P.height + 'px';
      stage.style.setProperty('--lw', LW + 'px');
      stage.style.setProperty('--t0', T0 + 'px');
      stage.classList.toggle('no-anim', !anim || U.reducedMotion());

      // el foco del teclado sigue a la fila, aunque cambie de sitio
      const act = document.activeElement && document.activeElement.closest && document.activeElement.closest('.eg-row');
      const actKey = act ? act.dataset.k : null;

      const keys = new Set(P.items.map((it) => it.key));
      st.rows.forEach((el, k) => {
        if (keys.has(k)) return;
        st.rows.delete(k);
        el.classList.add('is-out');
        setTimeout(() => el.remove(), anim ? 380 : 0);
      });
      P.items.forEach((it) => {
        let el = st.rows.get(it.key);
        const fresh = !el;
        if (fresh) {
          el = document.createElement('div');
          el.dataset.k = it.key;
          el.style.transform = `translateY(${it.y}px)`;
          rowsEl.appendChild(el);
          st.rows.set(it.key, el);
        }
        el.className = `eg-row eg-${it.kind}${it.g && !it.g.tracks.length ? ' is-empty' : ''}${fresh && anim ? ' is-new' : ''}${it.type ? ' t-' + it.type : ''}`;
        el.style.height = it.h + 'px';
        el.style.transform = `translateY(${it.y}px)`;
        paintRow(el, it, X, T1);
        if (fresh && anim) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-new')));
      });
      if (actKey && st.rows.get(actKey)) { const b = st.rows.get(actKey).querySelector('button'); if (b && document.activeElement !== b) b.focus({ preventScroll: true }); }

      drawLinks(P, W, X, lo, hi);
      svg.classList.remove('is-in');
      clearTimeout(st.t);
      st.t = setTimeout(() => svg.classList.add('is-in'), anim && !U.reducedMotion() ? 380 : 0);

      sel.value = st.focus;
      renderTrail();
      panel.innerHTML = panelHTML();
      const g = A.g[st.focus];
      live.textContent = `${g.name}. ${P.from.length ? 'Viene de ' + P.from.map((x) => x.g.name).join(', ') + '. ' : ''}${P.to.length ? 'Lleva a ' + P.to.map((x) => x.g.name).join(', ') + '.' : ''}`;
    }

    /* Ramas: verticales desde el año en que nace el género nuevo, con un borde de papel
       para que, al cruzar otra barra, se vea que pasan por encima y no se unen a ella */
    function drawLinks(P, W, X, lo, hi) {
      const Hh = P.height;
      const F = P.items.find((it) => it.kind === 'focus');
      const yc = (it) => it.y + it.h / 2;
      const fx0 = X(F.g.era[0]), fx1 = X(end(F.g)), fy = yc(F);
      const links = [];
      P.items.filter((it) => it.kind === 'from').forEach((it, i) => {
        const tx = Math.min(fx0 + 2 + i * 6, fx1 - 1);
        const sx = U.clamp(tx, X(it.g.era[0]), X(end(it.g)));
        const sy = yc(it), ty = fy - BAR - 1;
        const d = Math.abs(sx - tx) < 0.5 ? `M${sx} ${sy}V${ty}` : `M${sx} ${sy}V${ty - 12}H${tx}V${ty}`;
        links.push({ d, type: it.type, k: it.key, src: [sx, sy] });
      });
      const used = [];
      P.items.filter((it) => it.kind === 'to' || it.kind === 'with').forEach((it) => {
        const cx = X(it.g.era[0]), cy = yc(it);
        let sx = U.clamp(cx, fx0 + 2, fx1 - 2);
        while (used.some((u) => Math.abs(u - sx) < 5)) sx += 5;
        used.push(sx);
        const sy = fy + BAR + 1, ty = cy - 5;
        const d = Math.abs(sx - cx) < 0.5 ? `M${sx} ${sy}V${ty}` : `M${sx} ${sy}V${cy - 14}H${cx}V${ty}`;
        links.push({ d, type: it.type, k: it.key, src: [sx, sy] });
      });

      let s = `<defs><marker id="eg-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="eg-arrow"/></marker></defs>`;
      // marcas cada 5 años si cabe la etiqueta; si no, cada 10 con la de 5 sin número
      const px5 = X(5) - X(0), lab = px5 >= 46 ? 5 : 10;
      for (let yr = Math.ceil(lo / 5) * 5; yr <= hi; yr += 5) {
        const x = X(yr).toFixed(1), major = yr % lab === 0;
        s += `<path d="M${x} ${AX - (major ? 8 : 4)}V${Hh}" class="eg-grid${major ? '' : ' eg-grid-minor'}"/>`;
        if (major && X(yr) < W - 14) s += `<text x="${x}" y="${AX - 13}" text-anchor="middle" class="eg-ax">${yr}</text>`;
      }
      links.forEach((l) => { s += `<path d="${l.d}" class="eg-case" data-k="${l.k}"/>`; });
      links.forEach((l) => { s += `<path d="${l.d}" class="eg-link l-${l.type}" data-k="${l.k}"${l.type === 'paralelo' ? '' : ' marker-end="url(#eg-arr)"'}/>`; });
      links.forEach((l) => { s += `<circle cx="${l.src[0]}" cy="${l.src[1]}" r="3.2" class="eg-src" data-k="${l.k}"/>`; });
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.setAttribute('width', W);
      svg.setAttribute('height', Hh);
      svg.innerHTML = s;
    }

    function panelHTML() {
      const g = A.g[st.focus];
      const prim = A.sort(g.primary, 'year-asc');
      const mid = Math.round((g.bpm[0] + g.bpm[1]) / 2);
      const sum = g.summary.split(/(?<=\.)\s/).slice(0, 2).join(' ');
      return `<p class="mono eyebrow">${e(g.F.name)}</p>
        <h2 class="eg-p-title">${e(g.name)}</h2>
        <p class="eg-p-meta mono"><span>${g.era[0]}–${g.era[1] || 'hoy'}</span><span>${g.bpm[0]}–${g.bpm[1]} BPM</span>
          <span class="eg-beat" style="--bpm:${mid}" title="El punto late a ${mid} BPM, el centro de su rango"><i></i>${mid}</span></p>
        <p class="eg-p-sum">${e(sum)}</p>
        ${g.disputed ? `<p class="eg-p-disp mono">Clasificación discutible · <a href="#g-${g.id}">por qué</a></p>` : ''}
        ${prim.length
          ? `<ul class="eg-recs">${prim.slice(0, 6).map((t) => `<li><button type="button" data-open="${t.id}" aria-label="Ficha de ${e(t.title)}">${H.C.cover(t)}<b>${e(t.title)}</b><span>${e(t.artistLine)} · ${t.year != null ? t.year : '—'}</span></button></li>`).join('')}</ul>`
          : '<p class="fine">El archivo aún no tiene registros contrastados de este género.</p>'}
        <div class="eg-acts"><a class="btn btn-sm btn-solid" href="#g-${g.id}">Página del género →</a>${prim.length ? `<button class="btn btn-sm" type="button" data-enqueue-many="${prim.map((t) => t.id).join(',')}">${U.icon('queue')} ${prim.length} a la cola</button>` : ''}</div>`;
    }

    function renderTrail() {
      trail.innerHTML = st.trail.map((id) => `<li><button type="button" data-trail="${id}"${id === st.focus ? ' aria-current="step"' : ''}>${e(A.g[id].name)}</button></li>`).join('');
      trail.scrollLeft = trail.scrollWidth;
    }

    function setFocus(id) {
      if (!A.g[id] || id === st.focus) return;
      const i = st.trail.indexOf(id);
      if (i >= 0) st.trail.splice(i + 1);
      else { st.trail.push(id); if (st.trail.length > 16) st.trail.shift(); }
      st.focus = id;
      U.store.set('egFocus', id);
      render(true);
      // en el móvil, que el nuevo centro quede a la vista
      const top = stage.getBoundingClientRect().top, bar = (document.querySelector('.top') || {}).offsetHeight || 0;
      if (top < bar) window.scrollBy({ top: top - bar - 8, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
    }

    root.addEventListener('click', (ev) => {
      const go = ev.target.closest('[data-go]');
      if (go) { setFocus(go.dataset.go); return; }
      const pg = ev.target.closest('[data-page]');
      if (pg) { H.App.go('g-' + pg.dataset.page); return; }
      const tr = ev.target.closest('[data-trail]');
      if (tr) { setFocus(tr.dataset.trail); return; }
      if (ev.target.closest('[data-eg="random"]')) {
        const pool = A.genres.filter((g) => g.id !== st.focus);
        setFocus(pool[Math.floor(Math.random() * pool.length)].id);
      }
    });
    sel.addEventListener('change', () => setFocus(sel.value));

    // al pasar por una fila, se resalta su rama
    const hi = (k) => {
      svg.classList.toggle('has-hi', !!k);
      svg.querySelectorAll('[data-k]').forEach((p) => p.classList.toggle('hi', !!k && (k === st.focus || p.dataset.k === k)));
    };
    // solo con ratón: en pantallas táctiles el resaltado se quedaría pegado tras tocar
    rowsEl.addEventListener('pointerover', (ev) => { if (ev.pointerType !== 'mouse') return; const r = ev.target.closest('.eg-row'); hi(r && !r.dataset.k.startsWith('h-') ? r.dataset.k : null); });
    rowsEl.addEventListener('pointerleave', () => hi(null));
    rowsEl.addEventListener('focusin', (ev) => { const r = ev.target.closest('.eg-row'); if (r && ev.target.matches(':focus-visible')) hi(r.dataset.k); });
    rowsEl.addEventListener('focusout', () => hi(null));

    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (Math.round(stage.clientWidth) !== st.w) render(false); }) : null;
    if (ro) ro.observe(stage);
    render(false);
    return { destroy() { if (ro) ro.disconnect(); clearTimeout(st.t); }, focus: setFocus };
  }

  H.Lineage = { mount };
})();
