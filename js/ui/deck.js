/* HARMONY · el plato (y la mesa)
   Vista «Plato»: un tocadiscos (canal A) con su panel. Vista «Mesa»: dos tocadiscos (A y B) con el
   mezclador en medio (js/ui/mesa.js). La barra mínima está siempre accesible.
   Todo lo que se mueve depende del estado real de cada canal de H.Audio:
   - el disco solo acelera si su canal está en 'playing' y frena con inercia al parar;
   - el pitch y los empujones cambian la velocidad real del disco y del audio;
   - el brazo vuelve a su apoyo cuando no hay fuente y se levanta en pausa;
   - los puntos estroboscópicos se quedan quietos cuando la velocidad coincide con su fila. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const AU = () => H.Audio;
  const CH = (c) => H.Audio.ch[c];

  const D = (H.Deck = {
    queue: [], idx: -1, current: null, files: {}, pitch: 0, mode: null, open: false, view: 'plato',
    B: { current: null, pitch: 0 }, range: { A: 8, B: 8 }, running: false, last: 0
  });
  const P = {}; // tocadiscos A y B
  Object.defineProperty(D, 'vel', { get: () => (P.A ? P.A.vel : 0) });
  D.plinth = (ch) => P[ch];
  D.recOf = (ch) => (ch === 'B' ? D.B.current : D.current);
  D.pitchOf = (ch) => (ch === 'B' ? D.B.pitch : D.pitch);

  const NOMINAL = 200; // 33⅓ rpm = 200°/s
  const ARM = { rest: 0, outer: 37.5, inner: 52 };
  const analysisCache = new WeakMap();
  let els = {};

  /* ---------- montaje ---------- */
  D.init = function () {
    const saved = U.store.get('queue', null);
    if (saved && Array.isArray(saved.q)) {
      D.queue = saved.q.filter((id) => H.A.t[id]);
      D.idx = U.clamp(saved.i == null ? -1 : saved.i, -1, D.queue.length - 1);
      D.current = D.idx >= 0 ? H.A.t[D.queue[D.idx]] : null;
    }
    D.pitch = 0;
    buildMini();
    buildDeck();
    U.on('audio', (S) => onAudio(S && S.ch ? S.ch : 'A'));
    U.on('audio:ended', (e) => { if ((!e || e.ch === 'A') && D.view !== 'mesa' && D.idx < D.queue.length - 1) D.next(true); });
    U.on('audio:time', (e) => { if (!e || e.ch === 'A') updateTime(); });
    U.on('fav', () => { renderNow(); });
    U.on('mix:reset', () => { renderSource(); if (H.Mesa) H.Mesa.syncControls(); });
    const redraw = () => Object.values(P).forEach((o) => drawRecord(o, true));
    U.on('theme', () => requestAnimationFrame(redraw));
    D.setView(U.store.get('deckView', 'plato') === 'mesa' ? 'mesa' : 'plato', true);
    renderAll();
  };

  function persist() { U.store.set('queue', { q: D.queue, i: D.idx }); }

  /* ---------- barra mínima ---------- */
  function buildMini() {
    const bar = document.createElement('div');
    bar.id = 'minibar';
    bar.className = 'minibar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Reproductor');
    bar.innerHTML = `
      <button class="mb-disc" type="button" aria-label="Abrir el plato">
        <span class="mb-record"><span class="mb-rot"><span class="mb-label"></span></span></span>
      </button>
      <div class="mb-info">
        <span class="mb-status mono"></span>
        <button class="mb-title" type="button"></button>
      </div>
      <div class="mb-quick"></div>
      <div class="mb-ctrl">
        <button class="ibtn mb-prev" type="button" aria-label="Anterior">${U.icon('prev')}</button>
        <button class="ibtn ibtn-solid mb-play" type="button" aria-label="Reproducir">${U.icon('play')}</button>
        <button class="ibtn mb-next" type="button" aria-label="Siguiente">${U.icon('next')}</button>
      </div>
      <button class="mb-open mono" type="button" aria-label="Abrir el plato">Plato <span class="mb-count"></span></button>
      <span class="sr-only" aria-live="polite" id="deck-live"></span>`;
    document.body.appendChild(bar);
    els.mini = bar;
    els.miniRot = bar.querySelector('.mb-rot');
    bar.querySelector('.mb-disc').onclick = () => D.toggleOpen();
    bar.querySelector('.mb-open').onclick = () => D.toggleOpen();
    bar.querySelector('.mb-title').onclick = () => { if (D.current) H.App.openTrack(D.current.id); else D.toggleOpen(); };
    bar.querySelector('.mb-play').onclick = () => D.togglePlay();
    bar.querySelector('.mb-prev').onclick = () => D.prev();
    bar.querySelector('.mb-next').onclick = () => D.next();
  }

  /* ---------- un tocadiscos ---------- */
  function strobeRows() {
    let s = '';
    [[191, 124], [184, 120], [177, 116]].forEach(([r, n], i) => {
      s += `<g class="st-row" data-row="${i}">`;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        s += `<rect x="${(200 + Math.cos(a) * r - 1.4).toFixed(1)}" y="${(200 + Math.sin(a) * r - 1.4).toFixed(1)}" width="2.8" height="2.8" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${(200 + Math.cos(a) * r).toFixed(1)} ${(200 + Math.sin(a) * r).toFixed(1)})"/>`;
      }
      s += '</g>';
    });
    return s;
  }
  const STROBE_SVG = strobeRows();
  const ticksFor = (R) => {
    const step = R === 8 ? 2 : 4, out = [];
    for (let v = -R; v <= R; v += step) out.push(`<span style="top:${((v + R) / (2 * R)) * 100}%">${v > 0 ? '+' + v : v}</span>`);
    return out.join('');
  };

  function makePlinth(ch) {
    const el = document.createElement('div');
    el.className = 'plinth';
    el.dataset.ch = ch;
    el.dataset.state = 'empty';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Tocadiscos ' + ch);
    el.innerHTML = `
      <div class="platter">
        <svg class="strobe" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="197" class="platter-rim"/>${STROBE_SVG}</svg>
        <div class="record" aria-hidden="false">
          <div class="rec-rot"><canvas class="rec-canvas"></canvas><div class="rec-label"></div></div>
          <div class="rec-sheen"></div>
          <span class="spindle"></span>
        </div>
      </div>
      <svg class="tonearm" viewBox="0 0 1000 780" aria-hidden="true">
        <text x="30" y="30" class="plinth-brand">HARMONY</text>
        <text x="30" y="46" class="plinth-sub">ARCHIVO · DIRECT DRIVE</text>
        <text x="970" y="760" text-anchor="end" class="plinth-ch">${ch}</text>
        <rect x="842" y="584" width="36" height="22" class="arm-rest"/>
        <g class="arm" style="transform-origin:860px 110px">
          <path d="M860 70 V110" class="arm-tube"/>
          <rect x="840" y="8" width="40" height="62" class="arm-weight"/>
          <path d="M860 110 V640" class="arm-tube"/>
          <g transform="rotate(22 860 650)"><rect x="846" y="630" width="28" height="70" class="arm-head"/><rect x="852" y="688" width="16" height="18" class="arm-cart"/></g>
        </g>
        <circle cx="860" cy="110" r="44" class="arm-base"/><circle cx="860" cy="110" r="13" class="arm-pivot"/>
      </svg>
      <span class="strobe-lamp" aria-hidden="true"></span>
      <span class="rpm mono" aria-hidden="true"><b>33</b> 45</span>
      <button class="startstop mono" type="button" aria-label="Start · Stop ${ch}"><span>Start</span><span class="ss-dot" aria-hidden="true">·</span><span>Stop</span></button>
      <div class="pitch">
        <div class="pitch-track" role="slider" tabindex="0" aria-label="Pitch ${ch}" aria-valuemin="-8" aria-valuemax="8" aria-valuenow="0" aria-valuetext="0 %">
          <div class="pitch-ticks mono">${ticksFor(8)}</div>
          <div class="pitch-thumb"></div>
        </div>
        <button class="pitch-range mono" type="button" title="Cambiar el rango del pitch">±8</button>
        <span class="pitch-read mono">±0,0 %</span>
      </div>`;
    const q = (s) => el.querySelector(s);
    const o = {
      ch, el, angle: ch === 'B' ? 140 : 0, vel: 0, strobe: [0, 0, 0], drawnFor: null,
      recRot: q('.rec-rot'), canvas: q('.rec-canvas'), label: q('.rec-label'), record: q('.record'), arm: q('.arm'),
      rows: Array.from(el.querySelectorAll('.st-row')), lamp: q('.strobe-lamp'),
      pitchTrack: q('.pitch-track'), pitchThumb: q('.pitch-thumb'), pitchRead: q('.pitch-read'), rangeBtn: q('.pitch-range'), ticks: q('.pitch-ticks')
    };
    q('.startstop').onclick = () => D.togglePlay(ch);

    // disco: clic = bajar la aguja · arrastrar girando = empujar (hacia delante) o frenar (hacia atrás)
    let drag = null;
    const angleOf = (e) => (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180) / Math.PI;
    o.record.addEventListener('pointerdown', (e) => {
      const r = o.record.getBoundingClientRect();
      drag = { x0: e.clientX, y0: e.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2, moved: false, t: performance.now(), w: 0 };
      drag.a = angleOf(e);
      try { o.record.setPointerCapture(e.pointerId); } catch (err) {}
    });
    o.record.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; el.classList.add('is-touch'); }
      if (!drag.moved) return;
      const a = angleOf(e);
      let d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
      const now = performance.now(), dt = Math.max(8, now - drag.t) / 1000;
      drag.w = drag.w * 0.6 + (d / dt) * 0.4; drag.a = a; drag.t = now;
      CH(ch).setBend(U.clamp((drag.w / NOMINAL) * 0.06, -0.08, 0.08));
      kick();
    });
    const release = (e) => {
      if (!drag) return;
      if (!drag.moved && e.type === 'pointerup') needleDrop(o, e, drag);
      else { CH(ch).setBend(0); el.classList.remove('is-touch'); }
      drag = null;
    };
    o.record.addEventListener('pointerup', release);
    o.record.addEventListener('pointercancel', release);

    // pitch: arriba −, abajo + (como en un Technics)
    const setFromY = (clientY) => {
      const r = o.pitchTrack.getBoundingClientRect(), R = D.range[ch];
      const f = U.clamp((clientY - r.top) / r.height, 0, 1);
      D.setPitch(Math.round((f * 2 * R - R) * 20) / 20, ch);
    };
    o.pitchTrack.addEventListener('pointerdown', (e) => { o.pitchTrack.setPointerCapture(e.pointerId); setFromY(e.clientY); });
    o.pitchTrack.addEventListener('pointermove', (e) => { if (o.pitchTrack.hasPointerCapture(e.pointerId)) setFromY(e.clientY); });
    o.pitchTrack.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 1 : 0.05, p = D.pitchOf(ch);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { D.setPitch(p - step, ch); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { D.setPitch(p + step, ch); e.preventDefault(); }
      if (e.key === 'Home' || e.key === '0') { D.setPitch(0, ch); e.preventDefault(); }
      e.stopPropagation();
    });
    o.pitchTrack.addEventListener('dblclick', () => D.setPitch(0, ch));
    o.rangeBtn.onclick = () => {
      D.range[ch] = D.range[ch] === 8 ? 16 : 8;
      o.ticks.innerHTML = ticksFor(D.range[ch]);
      o.rangeBtn.textContent = '±' + D.range[ch];
      o.pitchTrack.setAttribute('aria-valuemin', -D.range[ch]);
      o.pitchTrack.setAttribute('aria-valuemax', D.range[ch]);
      D.setPitch(D.pitchOf(ch), ch);
    };
    return o;
  }

  function needleDrop(o, e, drag) {
    const d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) / drag.R;
    if (d < 0.42 || d > 0.97) return;
    const c = CH(o.ch);
    if (c.S.kind === 'file') { c.seek((0.96 - d) / (0.96 - 0.42)); U.toast('Aguja al ' + Math.round(((0.96 - d) / 0.54) * 100) + ' % del surco'); }
    else U.toast('Bajar la aguja solo funciona con un archivo propio');
  }

  /* ---------- vista abierta ---------- */
  function buildDeck() {
    const dk = document.createElement('div');
    dk.id = 'deck';
    dk.className = 'deck';
    dk.hidden = true;
    dk.setAttribute('role', 'dialog');
    dk.setAttribute('aria-modal', 'true');
    dk.setAttribute('aria-label', 'Plato');
    dk.innerHTML = `
      <div class="deck-inner">
        <header class="deck-head">
          <span class="mono">Harmony</span>
          <div class="seg deck-views" role="group" aria-label="Vista">
            <button type="button" data-view="plato" aria-pressed="true">${U.icon('disc')}<span>Plato</span></button>
            <button type="button" data-view="mesa" aria-pressed="false">${U.icon('grid')}<span>Mesa</span></button>
          </div>
          <span class="deck-legend mono">El disco solo gira si suena audio real</span>
          <button class="ibtn deck-close" type="button" aria-label="Cerrar el plato">${U.icon('close')}</button>
        </header>
        <div class="deck-grid">
          <div class="slot-single"></div>
          <div class="deck-side">
            <div class="now"></div>
            <div class="source"></div>
            <div class="transport">
              <button class="ibtn t-prev" type="button" aria-label="Anterior">${U.icon('prev')}</button>
              <button class="ibtn ibtn-solid ibtn-lg t-play" type="button" aria-label="Reproducir">${U.icon('play')}</button>
              <button class="ibtn t-next" type="button" aria-label="Siguiente">${U.icon('next')}</button>
              <label class="vol mono"><span>Vol</span><input type="range" id="deck-vol" min="0" max="1" step="0.01" aria-label="Volumen"></label>
              <span class="t-time mono" aria-live="off"></span>
            </div>
            <input type="range" id="deck-seek" class="seek" min="0" max="1000" step="1" value="0" aria-label="Posición" hidden>
            <div class="queue"></div>
          </div>
        </div>
        <div class="mesa"></div>
        <input type="file" id="deck-file" accept="audio/*" hidden>
        <input type="file" id="deck-file-b" accept="audio/*" hidden>
      </div>`;
    document.body.appendChild(dk);
    els.deck = dk;
    els.slotSingle = dk.querySelector('.slot-single');
    els.mesa = dk.querySelector('.mesa');
    els.now = dk.querySelector('.now');
    els.source = dk.querySelector('.source');
    els.queue = dk.querySelector('.queue');
    els.time = dk.querySelector('.t-time');
    els.seek = dk.querySelector('#deck-seek');
    els.vol = dk.querySelector('#deck-vol');
    els.file = { A: dk.querySelector('#deck-file'), B: dk.querySelector('#deck-file-b') };

    P.A = makePlinth('A');
    P.B = makePlinth('B');
    els.slotSingle.appendChild(P.A.el);
    if (H.Mesa) H.Mesa.build(els.mesa, { P });

    dk.querySelector('.deck-close').onclick = () => D.close();
    dk.querySelector('.deck-views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) D.setView(b.dataset.view); });
    dk.addEventListener('click', (e) => { if (e.target === dk) D.close(); });
    dk.querySelector('.t-play').onclick = () => D.togglePlay();
    dk.querySelector('.t-prev').onclick = () => D.prev();
    dk.querySelector('.t-next').onclick = () => D.next();
    els.vol.value = AU().volume();
    els.vol.oninput = () => { AU().setVolume(+els.vol.value); if (H.Mesa) H.Mesa.syncControls(); };
    els.seek.oninput = () => AU().seek(+els.seek.value / 1000);
    ['A', 'B'].forEach((ch) => {
      els.file[ch].onchange = () => { const f = els.file[ch].files && els.file[ch].files[0]; if (f) D.useFile(f, ch); els.file[ch].value = ''; };
    });

    // delegación de botones de fuente y cola
    dk.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, id = b.dataset.id, i = +b.dataset.i, ch = b.dataset.ch || 'A';
      if (act === 'sample') D.playSample(ch);
      else if (act === 'pulse') D.startPulse(ch);
      else if (act === 'file') D.pickFile(ch);
      else if (act === 'stop-src') { CH(ch).stop(); if (ch === 'A') D.mode = null; }
      else if (act === 'q-play') D.loadIndex(i, true);
      else if (act === 'q-to') D.loadTo(ch, D.queue[i]);
      else if (act === 'q-del') D.removeAt(i);
      else if (act === 'q-clear') D.clear();
      else if (act === 'mix-reset') AU().resetMix();
      else if (act === 'to-mesa') D.setView('mesa');
      else if (act === 'track') { D.close(); H.App.openTrack(id); }
      else if (act === 'go') { D.close(); location.hash = b.dataset.href; }
    });
  }

  D.setView = function (v, quiet) {
    D.view = v === 'mesa' ? 'mesa' : 'plato';
    els.deck.dataset.view = D.view;
    els.deck.setAttribute('aria-label', D.view === 'mesa' ? 'Mesa de mezclas' : 'Plato');
    els.deck.querySelectorAll('.deck-views [data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === D.view));
    if (D.view === 'mesa' && H.Mesa) H.Mesa.mount(P);
    else els.slotSingle.appendChild(P.A.el);
    U.store.set('deckView', D.view);
    if (!quiet) {
      requestAnimationFrame(() => Object.values(P).forEach((o) => drawRecord(o, true)));
      renderAll();
      kick();
    }
  };

  /* ---------- dibujo del vinilo (canvas, una vez por tema y tamaño) ---------- */
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#000'; }
  function drawRecord(o, force) {
    if (!o) return;
    const c = o.canvas;
    const w = Math.round(c.getBoundingClientRect().width);
    if (!w) return; // no visible: se dibujará al mostrarse
    const t = D.recOf(o.ch);
    const key = (t ? t.id : '-') + ':' + w + ':' + cssVar('--wax');
    if (!force && key === o.drawnFor) return;
    o.drawnFor = key;
    const size = Math.max(160, w);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    const R = c.width / 2;
    const wax = cssVar('--wax'), groove = cssVar('--groove');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = wax; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
    const rnd = U.rng(U.hash(t ? t.id : 'harmony-' + o.ch));
    const gaps = [0.62 + rnd() * 0.06, 0.78 + rnd() * 0.06];
    g.strokeStyle = groove;
    for (let r = 0.965; r > 0.42; r -= 0.0042) {
      const isGap = gaps.some((x) => Math.abs(r - x) < 0.006);
      g.globalAlpha = isGap ? 0.05 : 0.18 + rnd() * 0.5;
      g.lineWidth = Math.max(0.6, dpr * (0.5 + rnd() * 0.7));
      g.beginPath(); g.arc(R, R, r * R, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    g.lineWidth = 2 * dpr; g.globalAlpha = 0.6;
    g.beginPath(); g.arc(R, R, R * 0.985, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.35; g.beginPath(); g.arc(R, R, R * 0.405, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.55; g.fillStyle = groove;
    g.font = `${Math.round(R * 0.032)}px "IBM Plex Mono", monospace`;
    const txt = t ? `${t.hmy.replace('·', '-')} ${o.ch}   ·   ${(t.L ? t.L.name : 'HARMONY').toUpperCase()}   ·   ${t.year || '—'}` : `HARMONY  ·  ARCHIVO  ·  LADO ${o.ch}`;
    const rr = R * 0.372;
    g.save(); g.translate(R, R); g.rotate(-Math.PI / 2);
    let ang = 0;
    for (const chr of txt) {
      const cw = g.measureText(chr).width;
      g.save(); g.rotate(ang); g.translate(rr, 0); g.rotate(Math.PI / 2); g.fillText(chr, 0, 0); g.restore();
      ang += (cw + R * 0.004) / rr;
      if (ang > Math.PI * 1.7) break;
    }
    g.restore();
    g.globalAlpha = 0.25; g.lineWidth = dpr; g.beginPath();
    const a0 = rnd() * Math.PI * 2; g.arc(R, R, R * (0.55 + rnd() * 0.3), a0, a0 + 0.35); g.stroke();
    g.globalAlpha = 1;
  }
  D.drawRecord = (ch) => drawRecord(P[ch || 'A'], true);

  /* ---------- análisis de BPM ---------- */
  function analyzeFile(ch, file, rec) {
    const c = CH(ch);
    const done = (r) => { if (c.file !== file) return; c.S.grid = r; c.S.analysis = 'done'; c.emit(); U.emit('audio:grid', { ch }); };
    if (analysisCache.has(file)) { done(analysisCache.get(file)); return; }
    if (!H.Analysis) return;
    c.S.analysis = 'running'; c.emit();
    H.Analysis.analyze(file, { prior: rec && rec.bpm }).then((r) => { analysisCache.set(file, r); done(r); }).catch(() => {
      if (c.file !== file) return;
      c.S.analysis = 'error'; c.emit();
    });
  }
  D.fixOctave = function (ch, factor) {
    const g = CH(ch).S.grid; if (!g) return;
    g.bpm = Math.round(g.bpm * factor * 100) / 100;
    g.fixed = (g.fixed || 1) * factor;
    CH(ch).emit();
  };

  /* ---------- muestras de Deezer ----------
     Por plato: { id, state: 'loading' | 'error', msg, code } mientras se pide o si ha fallado. */
  const SMP = { A: null, B: null };
  D.sampleState = (ch = 'A') => SMP[ch];
  const canSample = (t) => !!(H.Dz && H.Dz.has(t) && !H.Dz.blocked());
  function loadSample(ch, t, { autoplay }) {
    const c = CH(ch);
    if (!H.Dz || !H.Dz.has(t)) return false;
    AU().ensure();   // el contexto de audio se reanuda dentro del gesto
    if (c.S.kind) c.stop();
    SMP[ch] = { id: t.id, state: 'loading' };
    renderAll();
    H.Dz.load(t).then((file) => {
      if (D.recOf(ch) !== t || !SMP[ch] || SMP[ch].id !== t.id) return;   // ya se ha cambiado de disco
      SMP[ch] = null;
      c.loadFile(file, { autoplay, origin: 'deezer' });
      analyzeFile(ch, file, t);
      renderAll();
    }).catch((e) => {
      if (D.recOf(ch) !== t) return;
      SMP[ch] = { id: t.id, state: 'error', msg: H.Dz.message(e), code: e.code };
      renderAll();
    });
    return true;
  }
  D.playSample = function (ch = 'A') {
    const t = D.recOf(ch);
    if (!t) return;
    if (ch === 'A') D.mode = null;
    loadSample(ch, t, { autoplay: D.view !== 'mesa' });
  };

  /* ---------- cola y carga ---------- */
  D.loadIndex = function (i, intent) {
    if (i < 0 || i >= D.queue.length) return;
    D.idx = i;
    setCurrent(H.A.t[D.queue[i]], intent);
  };

  function setCurrent(t, intent) {
    const A = CH('A');
    const prevKind = A.S.kind;
    const wasPlaying = A.S.state === 'playing';
    D.current = t;
    SMP.A = null;
    persist();
    if (t && D.files[t.id]) { A.loadFile(D.files[t.id], { autoplay: D.view !== 'mesa' }); analyzeFile('A', D.files[t.id], t); }
    // muestra de Deezer: suena si ya sonaba algo o se ha pedido; en la mesa se carga parada, lista para mezclar
    else if (t && canSample(t) && D.mode !== 'pulse' && (wasPlaying || intent || D.view === 'mesa')) loadSample('A', t, { autoplay: D.view !== 'mesa' });
    else if (t && D.mode === 'pulse' && t.bpm && (wasPlaying || intent) && D.view !== 'mesa') { A.startPulse(t.bpm, t.genre, t.fam); }
    else if (prevKind) { A.stop(); }
    if (t) H.App.remember(t.id, 'played');
    drawRecord(P.A, true);
    renderAll();
    announce(t ? 'En el plato A: ' + t.title + ', de ' + t.artistLine : 'Plato vacío');
  }

  // cargar un registro de la cola en un plato concreto (mesa)
  D.loadTo = function (ch, id) {
    const t = H.A.t[id]; if (!t) return;
    if (ch === 'A') { D.idx = D.queue.indexOf(id); setCurrent(t, false); return; }
    const B = CH('B');
    D.B.current = t;
    SMP.B = null;
    if (D.files[t.id]) { B.loadFile(D.files[t.id], { autoplay: false }); analyzeFile('B', D.files[t.id], t); }
    else if (canSample(t)) loadSample('B', t, { autoplay: false });
    else if (B.S.kind) B.stop();
    H.App.remember(t.id, 'played');
    drawRecord(P.B, true);
    renderAll();
    announce('En el plato B: ' + t.title);
  };

  D.cue = function (id, opts = {}) {
    const t = H.A.t[id]; if (!t) return;
    let i = D.queue.indexOf(id);
    if (i === -1) { D.queue.splice(D.idx + 1, 0, id); i = D.idx + 1; }
    D.loadIndex(i, true);
    if (opts.open) D.openDeck();
  };

  D.enqueue = function (ids, opts = {}) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => H.A.t[id]);
    let added = 0;
    list.forEach((id) => {
      if (D.queue.includes(id)) return;
      if (opts.next) D.queue.splice(D.idx + 1 + added, 0, id); else D.queue.push(id);
      added++;
    });
    if (D.idx === -1 && D.queue.length) { D.idx = 0; D.current = H.A.t[D.queue[0]]; drawRecord(P.A, true); }
    persist();
    renderAll();
    // con nombre (una ruta, por ejemplo), el aviso dice qué se ha añadido y cuántos ya estaban
    const L = opts.label, n = list.length;
    U.toast(L
      ? (added === n ? `${L}: ${added} discos en la cola` : added ? `${L}: ${added} discos más en la cola (${n - added} ya estaban)` : `${L} ya estaba en la cola`)
      : added ? (added === 1 ? 'Añadido a la cola' : added + ' registros añadidos a la cola') : 'Ya estaba en la cola');
  };

  D.removeAt = function (i) {
    if (i < 0 || i >= D.queue.length) return;
    D.queue.splice(i, 1);
    if (i < D.idx) D.idx--;
    else if (i === D.idx) {
      if (!D.queue.length) { D.idx = -1; setCurrent(null); return; }
      D.idx = Math.min(D.idx, D.queue.length - 1);
      setCurrent(H.A.t[D.queue[D.idx]]);
      return;
    }
    persist(); renderAll();
  };
  D.clear = function () { D.queue = []; D.idx = -1; setCurrent(null); };
  D.next = function (auto) { if (D.idx < D.queue.length - 1) D.loadIndex(D.idx + 1, !!auto || CH('A').S.state === 'playing'); else U.toast('Fin de la cola'); };
  D.prev = function () {
    const tm = CH('A').time();
    if (CH('A').S.kind === 'file' && tm.cur > 4) { CH('A').seek(0); return; }
    if (D.idx > 0) D.loadIndex(D.idx - 1, CH('A').S.state === 'playing'); else U.toast('Principio de la cola');
  };

  D.togglePlay = function (ch = 'A') {
    const c = CH(ch), rec = D.recOf(ch);
    if (!c.S.kind) {
      if (SMP[ch] && SMP[ch].state === 'loading') return;
      if (rec && canSample(rec) && !(ch === 'A' && D.mode === 'pulse')) { if (ch === 'A') D.mode = null; loadSample(ch, rec, { autoplay: true }); return; }
      if (D.view === 'mesa') { if (rec && rec.bpm) D.startPulse(ch); else U.toast('Plato ' + ch + ': carga un archivo o pon un pulso'); return; }
      if (!rec) { D.openDeck(); return; }
      if (rec.bpm) { D.startPulse(ch); return; }
      D.openDeck(); return;
    }
    c.toggle();
  };

  D.startPulse = function (ch = 'A') {
    const t = D.recOf(ch);
    const other = CH(ch === 'A' ? 'B' : 'A').S;
    const bpm = t && t.bpm ? t.bpm : other.grid ? Math.round(other.grid.bpm) : other.bpm || (D.view === 'mesa' ? 150 : null);
    if (!bpm) { U.toast('Este registro no tiene BPM: no hay pulso de referencia'); return; }
    if (ch === 'A') D.mode = 'pulse';
    CH(ch).startPulse(bpm, t ? t.genre : null, t ? t.fam : 'hardstyle');
  };

  D.pickFile = (ch = 'A') => els.file[ch].click();
  D.useFile = function (file, ch = 'A') {
    if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|webm)$/i.test(file.name)) { U.toast('Ese archivo no parece de audio'); return; }
    const rec = D.recOf(ch);
    if (ch === 'A') D.mode = null;
    if (rec) D.files[rec.id] = file;
    CH(ch).loadFile(file, { autoplay: D.view !== 'mesa' });
    analyzeFile(ch, file, rec);
    renderAll();
  };

  const fmtPitch = (p) => (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p).toFixed(Math.round(p * 100) % 10 ? 2 : 1).replace('.', ',') + ' %';
  D.fmtPitch = fmtPitch;
  function paintPitch(o) {
    const p = D.pitchOf(o.ch), R = D.range[o.ch];
    o.pitchThumb.style.top = ((p + R) / (2 * R)) * 100 + '%';
    const txt = fmtPitch(p);
    o.pitchRead.textContent = txt;
    o.pitchTrack.setAttribute('aria-valuenow', p);
    o.pitchTrack.setAttribute('aria-valuetext', txt);
    o.el.classList.toggle('pitch-zero', p === 0);
  }
  D.setPitch = function (p, ch = 'A') {
    const R = D.range[ch];
    const v = Math.round(U.clamp(p, -R, R) * 100) / 100;
    if (ch === 'B') D.B.pitch = v; else D.pitch = v;
    CH(ch).setRate(1 + v / 100);
    paintPitch(P[ch]);
    if (ch === 'A') renderSource();
    if (H.Mesa) H.Mesa.render(ch);
    kick();
  };

  /* ---------- abrir / cerrar ---------- */
  let lastFocus = null;
  D.openDeck = function () {
    if (D.open) return;
    D.open = true; lastFocus = document.activeElement;
    els.deck.hidden = false;
    document.documentElement.classList.add('deck-open');
    requestAnimationFrame(() => { els.deck.classList.add('in'); Object.values(P).forEach((o) => drawRecord(o)); if (H.Mesa) H.Mesa.render(); });
    els.deck.querySelector(D.view === 'mesa' ? '.deck-views [data-view="mesa"]' : '.t-play').focus({ preventScroll: true });
    kick();
  };
  D.close = function () {
    if (!D.open) return;
    D.open = false;
    els.deck.classList.remove('in');
    document.documentElement.classList.remove('deck-open');
    setTimeout(() => { if (!D.open) els.deck.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  D.toggleOpen = () => (D.open ? D.close() : D.openDeck());

  /* ---------- render ---------- */
  function announce(msg) { const n = document.getElementById('deck-live'); if (n) n.textContent = msg; }

  function statusText() {
    const S = CH('A').S, t = D.current, B = CH('B').S;
    const b = B.state === 'playing' ? ' · B suena' : '';
    if (S.state === 'error') return 'Error de audio' + b;
    if (S.kind === 'pulse') return (S.state === 'playing' ? 'Pulso ' : 'Pulso en pausa · ') + Math.round(S.bpm * (1 + D.pitch / 100)) + ' BPM' + b;
    if (S.kind === 'file' && S.origin === 'deezer') return (S.state === 'playing' ? 'Muestra de Deezer' : S.state === 'loading' ? 'Cargando…' : S.state === 'ended' ? 'Muestra terminada' : 'Muestra · pausa') + b;
    if (S.kind === 'file') return (S.state === 'playing' ? 'Tu archivo' : S.state === 'loading' ? 'Cargando…' : 'Tu archivo · pausa') + b;
    if (SMP.A && SMP.A.state === 'loading') return 'Cargando la muestra…' + b;
    if (B.kind) return 'Mesa' + (b || ' · B en pausa');
    if (!t) return 'Plato vacío';
    return 'Sin audio en Harmony';
  }

  function renderMini() {
    const S = CH('A').S, t = D.current;
    const bar = els.mini;
    bar.dataset.state = S.kind ? S.state : t ? 'nosrc' : 'empty';
    bar.querySelector('.mb-status').textContent = statusText();
    const title = bar.querySelector('.mb-title');
    title.innerHTML = t ? `<b>${U.esc(t.title)}</b><span>${U.esc(t.artistLine)}</span>` : '<b>Elige un tema</b><span>Pulsa ▶ en cualquier registro</span>';
    const playing = S.state === 'playing' || S.state === 'loading';
    const pb = bar.querySelector('.mb-play');
    pb.innerHTML = U.icon(playing ? 'pause' : 'play');
    pb.setAttribute('aria-label', playing ? 'Pausa' : S.kind ? 'Reproducir' : t && canSample(t) ? 'Escuchar la muestra de Deezer' : t && t.bpm ? 'Reproducir pulso de referencia' : 'Abrir el plato');
    bar.querySelector('.mb-count').textContent = D.queue.length ? D.idx + 1 + '/' + D.queue.length : '';
    bar.querySelector('.mb-label').className = 'mb-label' + (t ? ' on' : '');
    const quick = bar.querySelector('.mb-quick');
    if (t && !S.kind) {
      const L = H.Links.listen(t);
      const smp = canSample(t) && !(SMP.A && SMP.A.state === 'loading');
      quick.innerHTML = `${smp ? `<button class="chip chip-sm" type="button" data-q="sample">${U.icon('play')} Muestra</button>` : ''}${t.bpm ? `<button class="chip chip-sm${smp ? ' hide-sm' : ''}" type="button" data-q="pulse">${U.icon('pulse')} Pulso ${H.A.bpmTxt(t)}</button>` : ''}<a class="chip chip-sm" href="${L.spotify.url}" target="_blank" rel="noopener">Spotify ↗</a><a class="chip chip-sm hide-sm" href="${L.youtube.url}" target="_blank" rel="noopener">YouTube ↗</a>`;
      const pbtn = quick.querySelector('[data-q="pulse"]'); if (pbtn) pbtn.onclick = () => D.startPulse();
      const sbtn = quick.querySelector('[data-q="sample"]'); if (sbtn) sbtn.onclick = () => D.playSample('A');
    } else quick.innerHTML = '';
  }

  function sourceShort(ch = 'A') {
    const S = CH(ch).S;
    if (S.kind === 'pulse') return 'PULSO DE REFERENCIA';
    if (S.kind === 'file') return S.grid ? (S.grid.bpm.toFixed(2).replace('.', ',') + ' BPM MEDIDOS') : S.origin === 'deezer' ? 'MUESTRA DEEZER' : 'ARCHIVO PROPIO';
    if (SMP[ch] && SMP[ch].state === 'loading') return 'CARGANDO MUESTRA';
    return D.recOf(ch) ? 'SIN AUDIO' : '';
  }
  function paintLabel(ch) {
    const o = P[ch]; if (!o) return;
    o.label.innerHTML = H.C.discLabel(D.recOf(ch), { empty: 'PLATO ' + ch, source: sourceShort(ch) });
  }

  function renderNow() {
    const t = D.current;
    paintLabel('A'); paintLabel('B');
    const lbl = els.mini.querySelector('.mb-label');
    if (lbl) lbl.innerHTML = t ? H.C.discLabel(t) : '';
    if (!t) {
      els.now.innerHTML = `<p class="mono eyebrow">Plato vacío</p><h2 class="now-title">Elige un registro</h2><p class="now-sub">Pulsa ▶ en cualquier tema del archivo o carga un archivo de audio tuyo.</p>`;
      return;
    }
    const fav = H.App.isFav(t.id);
    els.now.innerHTML = `
      <p class="mono eyebrow">${t.hmy} · ${U.esc(t.G.name)} · ${t.year != null ? t.year : 'año —'}</p>
      <h2 class="now-title"><button type="button" data-act="track" data-id="${t.id}">${U.esc(t.title)}</button></h2>
      <p class="now-sub">${t.A.map((a) => `<a href="#a-${a.id}" data-act="go" data-href="a-${a.id}">${U.esc(a.name)}</a>`).join(' & ')}${t.L ? ` · <a href="#l-${t.L.id}" data-act="go" data-href="l-${t.L.id}">${U.esc(t.L.name)}</a>` : ''}</p>
      <div class="now-actions">
        <button class="chip" type="button" data-fav="${t.id}" aria-pressed="${fav}">${U.icon(fav ? 'crateOn' : 'crate')} ${fav ? 'En tu caja' : 'Guardar en tu caja'}</button>
        <button class="chip" type="button" data-act="track" data-id="${t.id}">Ficha completa</button>
      </div>
      ${leaning(t)}`;
  }

  /* La funda apoyada junto al plato: la de vinilo si existe; si el original es un CD, su caja.
     Si no gira su galleta real, se dice por qué. */
  function leaning(t) {
    const F = H.A.FORMAT_ES;
    const src = t.vinylSleeve || t.cover;
    const kind = t.vinylSleeve ? 'vinyl' : t.fmtKind;
    let cap = '';
    if (t.fmtKind === 'vinyl') cap = t.labelArt ? 'Funda y galleta del vinilo original.' : t.cover ? 'Funda del vinilo original. Sin foto de su galleta: gira el disco de Harmony.' : '';
    else if (t.vinylEd) cap = t.labelFromVinylEd ? `Según MusicBrainz, el original salió en ${F[t.fmtKind]}; gira su edición en vinilo.` : `Según MusicBrainz, el original salió en ${F[t.fmtKind]}. Su edición en vinilo no tiene foto de la galleta: gira el disco de Harmony.`;
    else if (t.noVinyl) cap = `Salió en ${F[t.fmtKind]} y no consta en vinilo: gira el disco de Harmony.`;
    if (!src && !cap) return '';
    return `<figure class="now-sleeve${src ? '' : ' is-text'}">${src ? H.C.cover(t, { src, kind }) : ''}<figcaption class="mono">${cap}</figcaption></figure>`;
  }

  function gridLine(S) {
    const what = S.origin === 'deezer' ? 'la muestra' : 'tu archivo';
    if (S.analysis === 'running') return `<p class="src-note">Midiendo el BPM de ${what}…</p>`;
    if (S.analysis === 'error') return `<p class="src-note">No se ha podido medir el BPM de ${what}.</p>`;
    if (!S.grid) return '';
    return `<p class="src-note"><b>${S.grid.bpm.toFixed(2).replace('.', ',')} BPM medidos</b> (fiabilidad ${S.grid.confidence})${D.pitch ? ' · con el pitch, ' + (S.grid.bpm * (1 + D.pitch / 100)).toFixed(2).replace('.', ',') + ' BPM' : ''}.</p>`;
  }

  function renderSource() {
    const S = CH('A').S, t = D.current;
    if (!els.source) return;
    let h = '';
    const L = t ? H.Links.listen(t) : null;
    const outside = t ? `<div class="src-out"><span class="mono">Escuchar fuera · búsquedas</span><div class="chips">${['spotify', 'ytmusic', 'youtube', 'soundcloud'].map((k) => `<a class="chip" href="${L[k].url}" target="_blank" rel="noopener">${L[k].name} ↗</a>`).join('')}</div></div>` : '';
    if (S.state === 'error') {
      h = `<p class="src-state src-err"><b>No suena.</b> ${U.esc(S.error || 'Error de audio.')}</p>${outside}`;
    } else if (S.kind === 'pulse') {
      const eff = Math.round(S.bpm * (1 + D.pitch / 100) * 10) / 10;
      h = `<p class="src-state"><b>Pulso de referencia</b> · ${S.bpm} BPM${D.pitch ? ' × ' + (1 + D.pitch / 100).toFixed(3).replace('.', ',') + ' = ' + String(eff).replace('.', ',') + ' BPM' : ''}</p>
        <p class="src-note">Sintetizado en tu navegador con el patrón rítmico típico de ${t ? U.esc(t.G.name.toLowerCase()) : 'la escena'}. <b>No es el tema</b>: sirve para sentir el tempo y comparar escenas.</p>
        <div class="chips"><button class="chip" type="button" data-act="stop-src">${U.icon('close')} Parar pulso</button><button class="chip" type="button" data-act="file">${U.icon('file')} Usar un archivo tuyo</button></div>${outside}`;
    } else if (S.kind === 'file' && S.origin === 'deezer' && t && t.dz) {
      h = `<p class="src-state"><b>Muestra de 30 s · Deezer</b> · ${U.esc(H.Dz.origin(t))}</p>
        ${gridLine(S)}
        <p class="src-note">${t.dz.verified ? 'Es la misma grabación que registra MusicBrainz (mismo ISRC).' : t.dz.pinned ? 'Elegida a mano en el archivo.' : 'Emparejada por título y artista.'} Fragmento gratuito de Deezer, para uso privado: Harmony no lo guarda. <a href="${t.dz.link}" target="_blank" rel="noopener">Escúchalo entero en Deezer ↗</a></p>
        <div class="chips"><button class="chip" type="button" data-act="to-mesa">${U.icon('grid')} Mezclar en la mesa</button><button class="chip" type="button" data-act="file">${U.icon('file')} Usar un archivo tuyo</button>${t.bpm ? `<button class="chip" type="button" data-act="pulse">${U.icon('pulse')} Pulso</button>` : ''}</div>`;
    } else if (SMP.A && SMP.A.state === 'loading' && t && t.dz) {
      h = `<p class="src-state"><b>Cargando la muestra de Deezer…</b> ${U.esc(H.Dz.origin(t))}</p>`;
    } else if (S.kind === 'file') {
      h = `<p class="src-state"><b>Tu archivo</b> · ${U.esc(S.fileName || '')}</p>
        ${gridLine(S)}
        <p class="src-note">Se reproduce en local y no sale de tu dispositivo. Haz clic en el surco del disco para bajar la aguja en otro punto.</p>
        <div class="chips"><button class="chip" type="button" data-act="stop-src">${U.icon('close')} Quitar archivo</button><button class="chip" type="button" data-act="to-mesa">${U.icon('grid')} Mezclar en la mesa</button></div>`;
    } else if (t && t.dz && H.Dz) {
      const er = SMP.A && SMP.A.state === 'error' ? SMP.A : H.Dz.blocked() ? { code: 'blocked', msg: H.Dz.message({ code: 'blocked' }) } : null;
      const retry = er && !['blocked', 'nopreview', 'gone'].includes(er.code);
      h = (er ? `<p class="src-state src-err"><b>${er.code === 'blocked' ? 'Aquí no suena la muestra.' : 'La muestra no ha cargado.'}</b> ${U.esc(er.msg)}</p>`
        : `<p class="src-state"><b>Muestra de 30 s de Deezer</b> · ${U.esc(H.Dz.origin(t))}. Suena con el pitch, el ecualizador y la medición de BPM de Harmony.</p>`) + `
        <div class="chips">
          ${!er || retry ? `<button class="chip chip-solid" type="button" data-act="sample">${U.icon('play')} ${er ? 'Reintentar' : 'Escuchar la muestra'}</button>` : ''}
          ${t.bpm ? `<button class="chip${er && !retry ? ' chip-solid' : ''}" type="button" data-act="pulse">${U.icon('pulse')} Pulso · ${H.A.bpmTxt(t)} BPM</button>` : ''}
          <button class="chip" type="button" data-act="file">${U.icon('file')} Cargar un archivo tuyo</button>
        </div>${outside}`;
    } else if (t) {
      h = `<p class="src-state"><b>Sin audio en Harmony.</b> Este registro aún no tiene una fuente reproducible integrada, así que el disco no gira.</p>
        <div class="chips">
          ${t.bpm ? `<button class="chip chip-solid" type="button" data-act="pulse">${U.icon('pulse')} Pulso de referencia · ${H.A.bpmTxt(t)} BPM</button>` : `<span class="chip chip-off">Sin BPM: no hay pulso</span>`}
          <button class="chip" type="button" data-act="file">${U.icon('file')} Cargar un archivo tuyo</button>
        </div>${outside}`;
    } else {
      h = `<div class="chips"><button class="chip" type="button" data-act="file">${U.icon('file')} Cargar un archivo de audio</button><button class="chip" type="button" data-act="go" data-href="catalogo">Ir al catálogo</button></div>`;
    }
    if (AU().mixTouched()) h += `<p class="mix-note">La mesa está cambiando cómo suena A (crossfader, ecualizador, filtro o fader). <button class="link-btn" type="button" data-act="mix-reset">Restablecer la mesa</button></p>`;
    els.source.innerHTML = h;
    els.seek.hidden = S.kind !== 'file';
  }

  function renderQueue() {
    if (!D.queue.length) { els.queue.innerHTML = `<p class="mono q-head">Cola · vacía</p><p class="q-empty">Añade registros con <b>+</b> desde cualquier lista, o una ruta entera desde la portada.</p>`; return; }
    els.queue.innerHTML = `<div class="q-head"><span class="mono">Cola · ${D.queue.length}</span><button class="link-btn mono" type="button" data-act="q-clear">Vaciar</button></div>
      <ol class="q-list">${D.queue.map((id, i) => {
        const t = H.A.t[id];
        return `<li class="${i === D.idx ? 'is-cur' : ''}"><button class="q-main" type="button" data-act="q-play" data-i="${i}"><span class="mono q-n">${U.pad(i + 1, 2)}</span><span class="q-t"><b>${U.esc(t.title)}</b> <span>${U.esc(t.artistLine)}</span></span><span class="mono q-bpm">${H.A.bpmTxt(t)}</span></button><button class="ibtn ibtn-sm" type="button" data-act="q-del" data-i="${i}" aria-label="Quitar ${U.esc(t.title)} de la cola">${U.icon('close')}</button></li>`;
      }).join('')}</ol>`;
  }

  function renderTransport() {
    const S = CH('A').S;
    const playing = S.state === 'playing' || S.state === 'loading';
    const b = els.deck.querySelector('.t-play');
    b.innerHTML = U.icon(playing ? 'pause' : 'play');
    b.setAttribute('aria-label', playing ? 'Pausa' : 'Reproducir');
    updateTime();
  }

  function updateTime() {
    const A = CH('A'), S = A.S;
    const tm = A.time();
    if (S.kind === 'file') {
      els.time.textContent = U.fmtTime(tm.cur) + ' / ' + U.fmtTime(tm.dur);
      if (tm.dur) els.seek.value = Math.round((tm.cur / tm.dur) * 1000);
    } else if (S.kind === 'pulse') els.time.textContent = U.fmtTime(tm.cur);
    else els.time.textContent = '';
  }

  function renderAll() {
    renderMini(); renderNow(); renderSource(); renderQueue(); renderTransport();
    ['A', 'B'].forEach((ch) => { P[ch].el.dataset.state = CH(ch).S.kind ? CH(ch).S.state : 'empty'; paintPitch(P[ch]); });
    if (H.Mesa) H.Mesa.render();
  }
  D.render = renderAll;
  D.renderSource = renderSource;

  function onAudio(ch) {
    P[ch].el.dataset.state = CH(ch).S.kind ? CH(ch).S.state : 'empty';
    paintLabel(ch);
    renderMini();
    if (ch === 'A') { renderSource(); renderTransport(); }
    if (H.Mesa) H.Mesa.render(ch);
    kick();
  }

  /* ---------- animación ---------- */
  function kick() { if (!D.running) { D.running = true; D.last = performance.now(); requestAnimationFrame(frame); } }
  D.kick = kick;

  function stepPlinth(o, dt) {
    const c = CH(o.ch), S = c.S;
    const playing = S.state === 'playing';
    const target = playing ? NOMINAL * c.effRate() : 0;
    const near = playing && Math.abs(target - o.vel) < NOMINAL * 0.2;
    const k = near ? 10 : target > o.vel ? 2.6 : 3.2; // arranque ~0,8 s, frenada ~1 s; empujones al instante
    o.vel += (target - o.vel) * Math.min(1, dt * k);
    if (!playing && o.vel < 0.8) o.vel = 0;
    const still = U.reducedMotion();
    o.angle = (o.angle + o.vel * dt) % 360;
    o.recRot.style.transform = `rotate(${still ? 0 : o.angle}deg)`;
    const rows = [NOMINAL * 0.967, NOMINAL, NOMINAL * 1.033];
    rows.forEach((s, i) => {
      const app = o.vel ? o.vel - Math.round(o.vel / s) * s : 0;
      o.strobe[i] = (o.strobe[i] + app * dt * 0.15) % 360;
      if (o.rows[i]) o.rows[i].style.transform = still ? '' : `rotate(${o.strobe[i]}deg)`;
    });
    let armA = ARM.rest;
    if (S.kind) {
      const tm = c.time();
      const prog = tm.dur ? U.clamp(tm.cur / tm.dur, 0, 1) : S.kind === 'pulse' ? (tm.cur % 360) / 360 : 0;
      armA = ['playing', 'loading', 'paused', 'ended'].includes(S.state) ? ARM.outer + prog * (ARM.inner - ARM.outer) : ARM.rest;
    }
    o.arm.style.transform = `rotate(${armA}deg)`;
    o.el.classList.toggle('lifted', S.state === 'paused');
    o.el.style.setProperty('--kick', (playing ? c.lows() : 0).toFixed(3));
    o.lamp.classList.toggle('on', o.vel > 1 || playing);
    return playing || o.vel > 0;
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - D.last) / 1000); D.last = ts;
    let active = stepPlinth(P.A, dt);
    if (D.view === 'mesa' || CH('B').S.kind || P.B.vel > 0) active = stepPlinth(P.B, dt) || active;
    els.miniRot.style.transform = `rotate(${U.reducedMotion() ? 0 : P.A.angle}deg)`;
    const lv = AU().level();
    document.documentElement.style.setProperty('--kick', lv.toFixed(3));
    if (CH('A').S.state === 'playing' && CH('A').S.kind) updateTime();
    let mesaBusy = false;
    if (D.open && D.view === 'mesa' && H.Mesa) mesaBusy = H.Mesa.frame(dt);
    if (active || mesaBusy) requestAnimationFrame(frame);
    else { D.running = false; document.documentElement.style.setProperty('--kick', 0); }
  }
})();
