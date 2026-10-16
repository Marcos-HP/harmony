/* HARMONY · carriles: una fila por género sobre una escala común (tempo o época)
   Pensado para el dedo: cada fila es un botón grande; al tocarla se despliegan sus temas.
   Las marcas finas sobre cada barra son los registros del archivo en ese género. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;

  const SCALE = {
    tempo: { min: () => H.A.BPM[0], max: () => H.A.BPM[1], ticks: [100, 120, 140, 160, 180, 200, 220, 240, 260], unit: 'BPM', of: (g) => g.bpm, val: (t) => t.bpm },
    era: { min: () => H.A.YEARS[0], max: () => H.A.YEARS[1], ticks: [1990, 2000, 2010, 2020], unit: '', of: (g) => [g.era[0], g.era[1] == null ? H.A.YEARS[1] : g.era[1] + 1], val: (t) => (t.year == null ? null : t.year + 0.5) }
  };

  function mount(root, shared) {
    const st = { sort: U.store.get('lanesSort', 'tempo'), cursor: null, open: null };
    root.innerHTML = `
      <div class="ln-bar">
        <div class="spec-fams" role="group" aria-label="Filtrar por familia">
          <button class="chip" type="button" data-fam="">Todas</button>
          ${H.A.families.map((f) => `<button class="chip" type="button" data-fam="${f.id}"><span class="ln-sw pat-${f.pattern}" aria-hidden="true"></span>${e(f.name)}</button>`).join('')}
        </div>
        <div class="seg ln-sort" role="group" aria-label="Escala">
          <button type="button" data-sort="tempo">Por tempo</button>
          <button type="button" data-sort="era">Por época</button>
        </div>
      </div>
      <div class="ln-head">
        <span class="ln-hint mono"></span>
        <div class="ln-scale" role="slider" tabindex="0"><div class="ln-ticks"></div><span class="ln-cur" hidden><b></b></span></div>
      </div>
      <ol class="ln-list"></ol>
      <p class="spec-note mono">Barras: rango orientativo de cada género · marcas: sus registros en el archivo · trazo discontinuo: género aún sin registros</p>`;
    const scale = root.querySelector('.ln-scale'), list = root.querySelector('.ln-list');
    const cur = root.querySelector('.ln-cur'), hint = root.querySelector('.ln-hint');
    const S = () => SCALE[st.sort];
    const pct = (v) => ((v - S().min()) / (S().max() - S().min())) * 100;

    function renderScale() {
      const s = S();
      root.querySelector('.ln-ticks').innerHTML = s.ticks.map((v) => `<span style="left:${pct(v).toFixed(2)}%">${v}</span>`).join('');
      scale.setAttribute('aria-label', st.sort === 'tempo' ? 'Marcar un tempo' : 'Marcar un año');
      scale.setAttribute('aria-valuemin', s.min());
      scale.setAttribute('aria-valuemax', s.max());
      root.querySelectorAll('.ln-sort [data-sort]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sort === st.sort));
      root.querySelectorAll('.spec-fams [data-fam]').forEach((b) => { const on = (b.dataset.fam || null) === shared.fam; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    }

    function genres() {
      const s = S();
      return H.A.genres.filter((g) => !shared.fam || g.family === shared.fam)
        .slice().sort((a, b) => s.of(a)[0] - s.of(b)[0] || s.of(a)[1] - s.of(b)[1]);
    }

    function row(g) {
      const s = S(), [lo, hi] = s.of(g);
      const ts = H.A.sort(g.tracks, 'year-asc');
      const marks = ts.map((t) => s.val(t)).filter((v) => v != null).map((v) => `<i style="left:${(((v - lo) / (hi - lo || 1)) * 100).toFixed(1)}%"></i>`).join('');
      const range = st.sort === 'tempo' ? `${g.bpm[0]}–${g.bpm[1]} BPM` : `${g.era[0]}–${g.era[1] || 'hoy'}`;
      const n = g.primary.length;
      const open = st.open === g.id;
      return `<li class="ln fam-${g.family} ${n ? '' : 'is-empty'} ${open ? 'is-open' : ''}" data-g="${g.id}" data-lo="${lo}" data-hi="${hi}">
        <button class="ln-row" type="button" aria-expanded="${open}" aria-controls="ln-p-${g.id}">
          <span class="ln-name">${e(g.name)}</span>
          <span class="ln-meta mono">${range} · ${n ? n + (n === 1 ? ' registro' : ' registros') : 'sin registros'}</span>
          <span class="ln-track"><span class="ln-band pat-${g.F.pattern}" style="left:${pct(lo).toFixed(2)}%;width:${Math.max(1.2, pct(hi) - pct(lo)).toFixed(2)}%">${marks}</span></span>
        </button>
        <div class="ln-panel" id="ln-p-${g.id}" ${open ? '' : 'hidden'}>${open ? panel(g, ts) : ''}</div>
      </li>`;
    }

    function panel(g, ts) {
      const first = g.summary.split(/(?<=\.)\s/)[0];
      const prim = ts.filter((t) => t.genre === g.id);
      return `<p class="ln-sum">${e(first)}</p>
        ${prim.length ? `<ul class="ln-tracks">${prim.slice(0, 8).map((t) => `<li><button type="button" data-open="${t.id}"><b>${e(t.title)}</b><span>${e(t.artistLine)}</span><span class="mono">${t.year != null ? t.year : '—'}${t.bpm ? ' · ' + H.A.bpmTxt(t) : ''}</span></button></li>`).join('')}</ul>${prim.length > 8 ? `<p class="fine">Y ${prim.length - 8} más en la página del género.</p>` : ''}` : '<p class="fine">El archivo aún no tiene registros contrastados de este género.</p>'}
        <div class="ln-acts"><a class="btn btn-sm" href="#g-${g.id}">Página del género →</a>${prim.length ? `<button class="btn btn-sm" type="button" data-enqueue-many="${prim.map((t) => t.id).join(',')}">${U.icon('queue')} Todo a la cola</button>` : ''}</div>`;
    }

    function renderList() {
      list.innerHTML = genres().map(row).join('');
      applyCursor();
    }

    function applyCursor() {
      const v = st.cursor;
      cur.hidden = v == null;
      list.classList.toggle('has-cur', v != null);
      if (v == null) {
        hint.textContent = st.sort === 'tempo' ? 'Toca la escala para marcar un tempo' : 'Toca la escala para marcar un año';
        scale.removeAttribute('aria-valuenow'); scale.setAttribute('aria-valuetext', 'Sin marcar');
        list.querySelectorAll('.ln').forEach((li) => li.classList.remove('off', 'hit'));
        return;
      }
      cur.style.left = pct(v).toFixed(2) + '%';
      list.style.setProperty('--cur', pct(v).toFixed(2) + '%');
      const label = st.sort === 'tempo' ? v + ' BPM' : String(v);
      cur.querySelector('b').textContent = label;
      let n = 0;
      list.querySelectorAll('.ln').forEach((li) => {
        const lo = +li.dataset.lo, hi = +li.dataset.hi;
        const hit = st.sort === 'tempo' ? v >= lo && v <= hi : v >= lo && v < hi;
        li.classList.toggle('hit', hit); li.classList.toggle('off', !hit);
        if (hit) n++;
      });
      hint.textContent = `${label}: ${n} ${n === 1 ? 'género' : 'géneros'}`;
      scale.setAttribute('aria-valuenow', v); scale.setAttribute('aria-valuetext', hint.textContent);
    }

    function setCursor(v) {
      const s = S();
      st.cursor = v == null ? null : Math.round(U.clamp(v, s.min(), s.max() - (st.sort === 'era' ? 1 : 0)));
      applyCursor();
    }
    const fromX = (x) => { const r = scale.getBoundingClientRect(); const s = S(); return s.min() + U.clamp((x - r.left) / r.width, 0, 1) * (s.max() - s.min()); };
    scale.addEventListener('pointerdown', (ev) => { scale.setPointerCapture(ev.pointerId); setCursor(fromX(ev.clientX)); });
    scale.addEventListener('pointermove', (ev) => { if (scale.hasPointerCapture(ev.pointerId)) setCursor(fromX(ev.clientX)); });
    scale.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 5 : 1, base = st.cursor == null ? (st.sort === 'tempo' ? 150 : 2000) : st.cursor;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') setCursor(base + step);
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') setCursor(base - step);
      else if (ev.key === 'Escape' || ev.key === 'Delete' || ev.key === 'Backspace') setCursor(null);
      else return;
      ev.preventDefault(); ev.stopPropagation();
    });
    cur.addEventListener('dblclick', () => setCursor(null));

    root.addEventListener('click', (ev) => {
      const f = ev.target.closest('.spec-fams [data-fam]');
      if (f) { shared.fam = f.dataset.fam || null; st.open = null; renderScale(); renderList(); return; }
      const s = ev.target.closest('.ln-sort [data-sort]');
      if (s && s.dataset.sort !== st.sort) { st.sort = s.dataset.sort; U.store.set('lanesSort', st.sort); st.cursor = null; renderScale(); renderList(); return; }
      const r = ev.target.closest('.ln-row');
      if (r) {
        const id = r.parentElement.dataset.g;
        st.open = st.open === id ? null : id;
        renderList();
        const li = list.querySelector(`[data-g="${id}"]`);
        if (li && st.open) { li.querySelector('.ln-row').focus({ preventScroll: true }); if (li.getBoundingClientRect().top < 60) li.scrollIntoView({ block: 'start', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); }
      }
    });

    // la escala se queda pegada bajo la cabecera de la web, que en el móvil es más alta
    const top = () => { const t = document.querySelector('.top'); if (t) root.style.setProperty('--top-off', t.offsetHeight + 'px'); };
    top();
    addEventListener('resize', top);
    renderScale();
    renderList();
    return { destroy() { removeEventListener('resize', top); } };
  }

  H.Lanes = { mount };
})();
