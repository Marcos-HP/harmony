/* HARMONY · controles de mesa: potenciómetros y faders
   Accesibles (role=slider, teclado), con ratón y táctil. Doble clic o Inicio: vuelve al valor por defecto. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const C = (H.Ctl = {});

  function aria(el, label, min, max) {
    el.setAttribute('role', 'slider');
    el.tabIndex = 0;
    el.setAttribute('aria-label', label);
    el.setAttribute('aria-valuemin', min);
    el.setAttribute('aria-valuemax', max);
  }
  function keys(el, get, set, step, def, min, max, dirUp = 1) {
    el.addEventListener('keydown', (e) => {
      const big = e.shiftKey ? 5 : 1;
      let v = get();
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v += step * big * dirUp;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v -= step * big * dirUp;
      else if (e.key === 'PageUp') v += step * 10;
      else if (e.key === 'PageDown') v -= step * 10;
      else if (e.key === 'Home') v = def;
      else return;
      e.preventDefault();
      e.stopPropagation();
      set(U.clamp(v, min, max));
    });
  }

  /* Potenciómetro giratorio: arrastra en vertical (arriba sube) */
  C.knob = function ({ label, short, value = 0, min = -1, max = 1, def = 0, step = 0.02, fmt = (v) => v.toFixed(2), onInput = () => {}, cls = '' }) {
    const wrap = document.createElement('div');
    wrap.className = 'knob-wrap ' + cls;
    wrap.innerHTML = `<div class="knob"><span class="knob-dial"></span></div><span class="knob-l mono">${U.esc(short || label)}</span>`;
    const k = wrap.querySelector('.knob');
    aria(k, label, min, max);
    let v = value;
    const paint = () => {
      const f = (v - min) / (max - min);
      k.style.setProperty('--a', (-135 + f * 270).toFixed(1) + 'deg');
      k.classList.toggle('is-def', Math.abs(v - def) < 1e-6);
      k.setAttribute('aria-valuenow', v.toFixed(3));
      k.setAttribute('aria-valuetext', fmt(v));
      k.title = label + ': ' + fmt(v);
    };
    const set = (nv, silent) => { v = Math.round(U.clamp(nv, min, max) / step) * step; if (Math.abs(v - def) < step / 2) v = def; paint(); if (!silent) onInput(v); };
    let y0 = 0, v0 = 0;
    k.addEventListener('pointerdown', (e) => { y0 = e.clientY; v0 = v; k.setPointerCapture(e.pointerId); k.classList.add('is-drag'); e.preventDefault(); });
    k.addEventListener('pointermove', (e) => { if (!k.hasPointerCapture(e.pointerId)) return; set(v0 + ((y0 - e.clientY) / 160) * (max - min)); });
    const end = () => k.classList.remove('is-drag');
    k.addEventListener('pointerup', end); k.addEventListener('pointercancel', end);
    k.addEventListener('dblclick', () => set(def));
    k.addEventListener('wheel', (e) => { e.preventDefault(); set(v - Math.sign(e.deltaY) * step * 2); }, { passive: false });
    keys(k, () => v, set, step, def, min, max);
    paint();
    return { el: wrap, set, get: () => v };
  };

  /* Fader lineal: vertical (arriba = máximo) u horizontal (izquierda = mínimo) */
  C.slider = function ({ label, orient = 'v', value = 0, min = 0, max = 1, def = value, step = 0.01, fmt = (v) => v.toFixed(2), onInput = () => {}, cls = '' }) {
    const el = document.createElement('div');
    el.className = `fdr fdr-${orient} ${cls}`;
    el.innerHTML = '<span class="fdr-track"></span><span class="fdr-cap"></span>';
    aria(el, label, min, max);
    el.setAttribute('aria-orientation', orient === 'v' ? 'vertical' : 'horizontal');
    let v = value;
    const paint = () => {
      const f = (v - min) / (max - min);
      el.style.setProperty('--f', f.toFixed(4));
      el.setAttribute('aria-valuenow', v.toFixed(3));
      el.setAttribute('aria-valuetext', fmt(v));
      el.title = label + ': ' + fmt(v);
    };
    const set = (nv, silent) => { v = Math.round(U.clamp(nv, min, max) / step) * step; paint(); if (!silent) onInput(v); };
    const fromPointer = (e) => {
      const r = el.getBoundingClientRect();
      const f = orient === 'v' ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      set(min + U.clamp(f, 0, 1) * (max - min));
    };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); fromPointer(e); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) fromPointer(e); });
    el.addEventListener('dblclick', () => set(def));
    keys(el, () => v, set, step, def, min, max);
    paint();
    return { el, set, get: () => v };
  };
})();
