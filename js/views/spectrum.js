/* HARMONY · el espectro: BPM (horizontal) × año (vertical).
   Cada género es una zona con el motivo de su familia; cada registro con año y BPM es un punto.
   Punto lleno = año contrastado · punto hueco = año editorial. Un cursor de tempo recorre el plano. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;

  H.Spectrum = {
    /* Dos formas de recorrer los géneros: carriles (una fila por género; por defecto en móvil)
       y mapa BPM × año (por defecto en ordenador). La familia elegida se comparte entre las dos. */
    mount(root) {
      const shared = { fam: null };
      let view = (() => { try { return localStorage.getItem('hmy.specView'); } catch (err) { return null; } })();
      view = view ? JSON.parse(view) : innerWidth < 760 ? 'lanes' : 'map';
      root.innerHTML = `<div class="seg spec-views" role="group" aria-label="Cómo ver los géneros">
          <button type="button" data-v="lanes">${U.icon('list')}<span>Carriles</span></button>
          <button type="button" data-v="map">${U.icon('grid')}<span>Mapa BPM × año</span></button>
        </div><div class="spec-body"></div>`;
      const body = root.querySelector('.spec-body');
      let current = null;
      const show = (v) => {
        view = v;
        U.store.set('specView', v);
        root.querySelectorAll('.spec-views [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
        if (current && current.destroy) current.destroy();
        root.dataset.view = v;
        current = v === 'map' ? H.Spectrum.mountMap(body, shared) : H.Lanes.mount(body, shared);
      };
      root.querySelector('.spec-views').addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b && b.dataset.v !== view) show(b.dataset.v); });
      show(view);
    },

    mountMap(root, opts = {}) {
      const st = { fam: opts.fam || null, bpm: opts.bpm || 150, year: opts.year || 2012, w: 0 };
      root.innerHTML = `
        <div class="spec-fams" role="group" aria-label="Filtrar por familia">
          <button class="chip is-on" type="button" data-fam="">Todas</button>
          ${H.A.families.map((f) => `<button class="chip" type="button" data-fam="${f.id}"><svg class="fam-sw" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" fill="url(#sw-${f.pattern})" class="fam-sw-r"/></svg>${e(f.name)}</button>`).join('')}
        </div>
        <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${H.Art.familyDefs('sw')}</defs></svg>
        <div class="spec-stage"><div class="spec-plot"><div class="spec-tip" hidden></div></div></div><p class="spec-swipe mono" aria-hidden="true">Desliza el mapa → hasta 260 BPM</p>
        <div class="spec-read" aria-live="polite"></div>
        <p class="spec-note mono">● año contrastado · ○ año editorial · ${H.A.tracks.filter((t) => t.year == null || t.bpm == null).length} registros sin año o sin BPM (EP, álbumes, recopilatorios) no aparecen en el mapa · rangos de BPM y épocas orientativos</p>`;
      const plot = root.querySelector('.spec-plot');
      const stage = root.querySelector('.spec-stage');
      const tip = () => root.querySelector('.spec-tip');
      const read = root.querySelector('.spec-read');
      let geo = null;

      function draw() {
        const avail = Math.round(stage.clientWidth);
        if (!avail) return;
        // en pantallas estrechas el plano mantiene 720 px y se desliza en horizontal: el racimo de 135–160 BPM necesita aire
        const narrow = avail < 720;
        const W = narrow ? 720 : avail;
        st.w = avail;
        const mobile = false;
        const Hh = narrow ? 620 : Math.round(U.clamp(W * 0.48, 480, 640));
        const m = { l: 52, r: 14, t: 40, b: 16 };
        const [b0, b1] = H.A.BPM, [y0, y1] = H.A.YEARS;
        const x = (v) => m.l + ((v - b0) / (b1 - b0)) * (W - m.l - m.r);
        const y = (v) => m.t + ((v - y0) / (y1 - y0)) * (Hh - m.t - m.b);
        geo = { W, Hh, m, x, y, mobile };
        let s = `<svg class="spec-svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="group" aria-label="Espectro de géneros: tempo en BPM de ${b0} a ${b1} en horizontal, años de ${y0} a ${y1} en vertical">
          <defs>${H.Art.familyDefs('sp')}</defs>`;
        // rejilla de años
        for (let yr = y0; yr <= y1; yr++) {
          const major = yr % 10 === 0;
          if (major || yr % 5 === 0) s += `<path d="M${m.l} ${y(yr).toFixed(1)}H${W - m.r}" class="${major ? 'gr-major' : 'gr-minor'}"/>`;
          if (major && !narrow) s += `<text x="${m.l - 8}" y="${(y(yr) + 3.5).toFixed(1)}" text-anchor="end" class="ax-t">${yr}</text>`;
        }
        // regla de BPM (como la escala del pitch)
        for (let v = b0; v <= b1; v += 5) {
          const major = v % 20 === 0;
          s += `<path d="M${x(v).toFixed(1)} ${major ? 18 : 25}V${m.t - 6}" class="ax-tick ${major ? 'ax-major' : ''}"/>`;
          if (major && (!mobile || v % 40 === 20 || v === b0 || v === b1)) s += `<text x="${x(v).toFixed(1)}" y="12" text-anchor="middle" class="ax-t">${v}</text>`;
        }
        s += `<text x="${W - m.r}" y="${m.t - 14}" text-anchor="end" class="ax-u" ${mobile ? 'hidden' : ''}>BPM</text>`;
        // zonas de género (las grandes primero, quedan detrás)
        const bands = H.A.genres.map((g) => ({ g, x0: x(g.bpm[0]), x1: x(g.bpm[1]), ya: y(g.era[0]), yb: y(g.era[1] == null ? y1 : g.era[1] + 1) }))
          .sort((a, b) => (b.x1 - b.x0) * (b.yb - b.ya) - (a.x1 - a.x0) * (a.yb - a.ya));
        bands.forEach((b) => {
          const g = b.g;
          const label = `${g.name}: ${g.bpm[0]}–${g.bpm[1]} BPM, ${g.era[0]}–${g.era[1] || 'hoy'}${g.tracks.length ? '' : ', sin registros todavía'}`;
          s += `<a href="#g-${g.id}" class="band fam-${g.family} ${g.tracks.length ? '' : 'band-empty'}" data-g="${g.id}" data-fam="${g.family}" aria-label="${e(label)}">
            <rect x="${b.x0.toFixed(1)}" y="${b.ya.toFixed(1)}" width="${Math.max(3, b.x1 - b.x0).toFixed(1)}" height="${(b.yb - b.ya).toFixed(1)}" class="band-fill" fill="url(#sp-${g.F.pattern})"/>
            <rect x="${b.x0.toFixed(1)}" y="${b.ya.toFixed(1)}" width="${Math.max(3, b.x1 - b.x0).toFixed(1)}" height="${(b.yb - b.ya).toFixed(1)}" class="band-edge ${g.era[1] == null ? 'open' : ''}"/></a>`;
        });
        // etiquetas: dentro de la zona si hay sitio; las del racimo de 135–160 BPM salen a la izquierda,
        // donde el plano está vacío, con una guía hasta la esquina de su zona. Colocación voraz sin choques.
        const placed = [];
        const fs = 10, cw = 6.5, lh = fs + 3;
        H.A.tracks.forEach((t) => { if (t.year != null && t.bpm != null) placed.push({ x: x(t.bpm) - 6, y: y(t.year + 0.5) + 6, w: 12 }); });
        const hit = (x, y, w) => placed.some((p) => x < p.x + p.w && x + w > p.x && y - lh < p.y && y > p.y - lh);
        bands.slice().sort((a, b) => a.ya - b.ya || a.x0 - b.x0).forEach((b) => {
          const g = b.g;
          const txt = g.name.toUpperCase();
          const w = txt.length * cw + 6;
          const outside = g.family !== 'raices' && g.bpm[0] >= 128 && g.bpm[0] < 158 && b.x0 - w - 10 >= m.l;
          let lx = outside ? b.x0 - w - 8 : Math.min(b.x0 + 3, W - m.r - w);
          let ly = b.ya + lh;
          for (let k = 0; k < 10 && hit(lx, ly, w); k++) ly += lh;
          placed.push({ x: lx, y: ly, w });
          const lead = outside ? `<path d="M${(lx + w - 1).toFixed(1)} ${(ly - fs / 2).toFixed(1)}H${(b.x0 - 1).toFixed(1)}V${b.ya.toFixed(1)}" class="lbl-lead"/>` : '';
          s += `<g class="band-lbl fam-${g.family}" data-g="${g.id}" data-fam="${g.family}" aria-hidden="true">${lead}<rect x="${(lx - 2).toFixed(1)}" y="${(ly - fs - 1).toFixed(1)}" width="${w.toFixed(1)}" height="${fs + 4}" class="lbl-bg"/><text x="${lx.toFixed(1)}" y="${(ly - 1).toFixed(1)}" class="lbl-t" font-size="${fs}">${e(txt)}</text></g>`;
        });
        // registros
        const groups = {};
        H.A.tracks.forEach((t) => { if (t.year == null || t.bpm == null) return; const k = t.bpm + ':' + t.year; (groups[k] = groups[k] || []).push(t); });
        const r = mobile ? 3.4 : 4.2;
        Object.values(groups).forEach((list) => list.forEach((t, i) => {
          const off = (i - (list.length - 1) / 2) * (r * 2 + 1.5);
          const cx = x(t.bpm) + off, cy = y(t.year + 0.5);
          const ok = t.ok.includes('year');
          s += `<a href="#t-${t.id}" tabindex="-1" class="dot fam-${t.fam} ${ok ? 'dot-ok' : 'dot-ed'}" data-t="${t.id}" data-fam="${t.fam}" aria-label="${e(t.title + ', ' + t.artistLine + ', ' + t.year)}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r + 6}" class="dot-hit"/></a>`;
        }));
        // cursor de tempo
        s += `<g class="cursor" aria-hidden="true"><path class="cur-line" d=""/><rect class="cur-bg" width="64" height="18" rx="0"/><text class="cur-t" text-anchor="middle"></text></g>`;
        s += `<rect class="cur-focus" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${Hh - m.t - m.b}" tabindex="0" role="slider" aria-label="Cursor de tempo" aria-valuemin="${b0}" aria-valuemax="${b1}"/>`;
        s += '</svg>';
        plot.querySelectorAll('svg, .spec-years').forEach((n) => n.remove());
        plot.insertAdjacentHTML('afterbegin', s);
        // años fijos al borde izquierdo mientras el mapa se desliza
        if (narrow) {
          let rail = '<div class="spec-years" aria-hidden="true">';
          for (let yr = 1990; yr <= y1; yr += 10) rail += `<span class="mono" style="top:${y(yr).toFixed(1)}px">${yr}</span>`;
          plot.insertAdjacentHTML('afterbegin', rail + '</div>');
        }
        plot.style.height = Hh + 'px';
        plot.style.width = W + 'px';
        if (narrow && !stage.dataset.scrolled) { stage.dataset.scrolled = '1'; stage.scrollLeft = Math.max(0, x(122) - m.l); }
        applyFam();
        moveCursor(st.bpm, st.year, false);
        const svg = plot.querySelector('svg');
        svg.addEventListener('pointermove', onMove);
        svg.addEventListener('pointerdown', onMove);
        svg.addEventListener('pointerleave', () => { tip().hidden = true; });
        const foc = svg.querySelector('.cur-focus');
        foc.addEventListener('keydown', (ev) => {
          const d = ev.shiftKey ? 5 : 1;
          if (ev.key === 'ArrowRight') moveCursor(st.bpm + d, st.year, true);
          else if (ev.key === 'ArrowLeft') moveCursor(st.bpm - d, st.year, true);
          else if (ev.key === 'ArrowUp') moveCursor(st.bpm, st.year - d, true);
          else if (ev.key === 'ArrowDown') moveCursor(st.bpm, st.year + d, true);
          else return;
          ev.preventDefault();
        });
        svg.querySelectorAll('.dot').forEach((a) => {
          a.addEventListener('pointerenter', () => showTip(a));
          a.addEventListener('focus', () => showTip(a));
          a.addEventListener('pointerleave', () => (tip().hidden = true));
          a.addEventListener('click', (ev) => { ev.preventDefault(); H.App.openTrack(a.dataset.t); });
        });
        svg.querySelectorAll('.band').forEach((a) => {
          a.addEventListener('pointerenter', () => hiGenre(a.dataset.g, true));
          a.addEventListener('pointerleave', () => hiGenre(a.dataset.g, false));
          a.addEventListener('focus', () => hiGenre(a.dataset.g, true));
          a.addEventListener('blur', () => hiGenre(a.dataset.g, false));
        });
      }

      function hiGenre(id, on) {
        plot.querySelectorAll(`[data-g="${id}"]`).forEach((n) => n.classList.toggle('hi', on));
        plot.classList.toggle('has-hi', on);
      }

      function showTip(a) {
        const t = H.A.t[a.dataset.t]; if (!t) return;
        const c = a.querySelector('circle');
        const tp = tip();
        tp.innerHTML = `<span class="mono">${t.hmy} · ${e(t.G.name)}</span><b>${e(t.title)}</b><span>${e(t.artistLine)}</span><span class="mono">${t.year} · ${H.A.bpmTxt(t)} BPM${t.ok.includes('year') ? '' : ' · año editorial'}</span>`;
        tp.hidden = false;
        const px = +c.getAttribute('cx'), py = +c.getAttribute('cy');
        const tw = tp.offsetWidth;
        tp.style.left = U.clamp(px - tw / 2, 0, geo.W - tw) + 'px';
        tp.style.top = py + 14 + 'px';
      }

      function onMove(ev) {
        if (!geo) return;
        const rect = ev.currentTarget.getBoundingClientRect();
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        if (px < geo.m.l || px > geo.W - geo.m.r) return;
        const [b0, b1] = H.A.BPM, [y0, y1] = H.A.YEARS;
        const bpm = b0 + ((px - geo.m.l) / (geo.W - geo.m.l - geo.m.r)) * (b1 - b0);
        const yr = y0 + ((py - geo.m.t) / (geo.Hh - geo.m.t - geo.m.b)) * (y1 - y0);
        moveCursor(Math.round(bpm), Math.round(U.clamp(yr, y0, y1)), true);
      }

      function moveCursor(bpm, yr, user) {
        const [b0, b1] = H.A.BPM, [y0, y1] = H.A.YEARS;
        st.bpm = U.clamp(Math.round(bpm), b0, b1);
        st.year = U.clamp(Math.round(yr), y0, y1 - 1);
        if (!geo) return;
        const cx = geo.x(st.bpm);
        const svg = plot.querySelector('svg'); if (!svg) return;
        svg.querySelector('.cur-line').setAttribute('d', `M${cx.toFixed(1)} ${geo.m.t - 4}V${geo.Hh - geo.m.b}`);
        const bgx = U.clamp(cx - 32, 0, geo.W - 64);
        const bg = svg.querySelector('.cur-bg'); bg.setAttribute('x', bgx); bg.setAttribute('y', 0);
        const tx = svg.querySelector('.cur-t'); tx.setAttribute('x', bgx + 32); tx.setAttribute('y', 13); tx.textContent = st.bpm + ' BPM';
        const foc = svg.querySelector('.cur-focus'); foc.setAttribute('aria-valuenow', st.bpm); foc.setAttribute('aria-valuetext', st.bpm + ' BPM, ' + st.year);
        renderRead();
      }

      function renderRead() {
        const all = H.A.genresAt(st.bpm).filter((g) => !st.fam || g.family === st.fam);
        const lo = st.bpm - 5, hi = st.bpm + 5;
        const n = H.A.tracks.filter((t) => t.bpm != null && t.bpm >= lo && t.bpm <= hi && (!st.fam || t.fam === st.fam)).length;
        const live = (g) => st.year >= g.era[0] && st.year <= (g.era[1] || 2026);
        read.innerHTML = `
          <div class="read-bpm"><span class="read-num">${st.bpm}</span><span class="mono">BPM<br>en ${st.year}</span></div>
          <div class="read-list">
            <p class="mono">${all.length ? 'Escenas que viven en este tempo' : 'Ninguna escena del archivo vive en este tempo'}${all.some(live) ? ' · en negrita, activas en ' + st.year : ''}</p>
            <ul>${all.map((g) => `<li class="${live(g) ? 'live' : ''}"><a href="#g-${g.id}">${e(g.name)}</a><span class="mono">${g.bpm[0]}–${g.bpm[1]} · ${g.era[0]}–${g.era[1] ? String(g.era[1]).slice(2) : 'hoy'}</span></li>`).join('')}</ul>
          </div>
          <div class="read-go">${n ? `<button class="btn" type="button" data-bpm-go="${lo}-${hi}">Ver ${n} ${n === 1 ? 'registro' : 'registros'} entre ${lo} y ${hi} BPM →</button>` : `<span class="mono">Sin registros entre ${lo} y ${hi} BPM</span>`}</div>`;
        const go = read.querySelector('[data-bpm-go]');
        if (go) go.onclick = () => H.App.goCatalog({ bpm: [lo, hi], genres: [], decades: [], fam: st.fam });
      }

      function applyFam() {
        plot.classList.toggle('fam-filter', !!st.fam);
        plot.querySelectorAll('[data-fam]').forEach((n) => n.classList.toggle('off', !!st.fam && n.dataset.fam !== st.fam));
        root.querySelectorAll('.spec-fams .chip').forEach((c) => { const on = (c.dataset.fam || null) === st.fam; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
        renderRead();
      }

      root.querySelector('.spec-fams').addEventListener('click', (ev) => {
        const c = ev.target.closest('[data-fam]'); if (!c) return;
        st.fam = c.dataset.fam || null; opts.fam = st.fam; applyFam();
      });

      draw();
      let lastW = st.w;
      const ro = new ResizeObserver(() => { const w = Math.round(stage.clientWidth); if (w && Math.abs(w - lastW) > 4) { lastW = w; draw(); } });
      ro.observe(stage);
      return { destroy: () => ro.disconnect() };
    }
  };
})();
