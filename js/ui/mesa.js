/* HARMONY · la mesa: dos platos, mezclador y ayuda para cuadrar a oído
   Vinilo puro: no hay botón de sincronizar. Harmony mide el BPM de tus archivos y te enseña
   cuánto se separan los tempos y los golpes; el pitch y los empujones los pones tú. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const AU = () => H.Audio;
  const CH = (c) => H.Audio.ch[c];
  const D = () => H.Deck;
  const e = U.esc;
  const num = (v, d = 2) => v.toFixed(d).replace('.', ',');

  const M = (H.Mesa = { built: false });
  let root, els = { info: {}, ctl: { A: {}, B: {} } };
  const NUDGE = 0.04;   // empujón: ±4 % mientras se mantiene
  const held = {};      // teclas de empujón pulsadas
  let colors = null;

  /* ---------- formato de los controles ---------- */
  const eqText = (v) => (v <= -0.999 ? '−∞ dB' : (20 * Math.log10(v < 0 ? Math.pow(1 + v, 2) : 1 + v)).toFixed(1).replace('.', ',') + ' dB');
  const filterText = (v) => {
    if (v < -0.02) { const f = 20000 * Math.pow(70 / 20000, Math.min(1, -v)); return 'Paso bajo · ' + (f >= 1000 ? num(f / 1000, 1) + ' kHz' : Math.round(f) + ' Hz'); }
    if (v > 0.02) { const f = 15 * Math.pow(9000 / 15, Math.min(1, v)); return 'Paso alto · ' + (f >= 1000 ? num(f / 1000, 1) + ' kHz' : Math.round(f) + ' Hz'); }
    return 'Sin filtro';
  };

  /* ---------- montaje ---------- */
  M.build = function (container) {
    root = container;
    root.innerHTML = `
      <div class="mesa-grid">
        <div class="slot-a"></div>
        <div class="mixer" role="group" aria-label="Mezclador"></div>
        <div class="slot-b"></div>
        ${['A', 'B'].map((ch) => `<section class="dinfo" data-ch="${ch}" aria-label="Plato ${ch}"></section>`).join('')}
        <section class="phase" aria-label="Fase entre A y B">
          <header class="ph-head"><span class="mono">Fase · A arriba, B abajo</span><span class="ph-state mono">—</span></header>
          <canvas class="ph-canvas" aria-hidden="true"></canvas>
          <div class="ph-meter" aria-hidden="true"><span class="ph-zone"></span><span class="ph-mark"></span><span class="ph-scale mono"><span>B detrás</span><span>en fase</span><span>B delante</span></span></div>
          <div class="ph-read">
            <div><span class="mono">Tempo B − A</span><b class="ph-tempo">—</b></div>
            <div><span class="mono">Desfase de B</span><b class="ph-off">—</b></div>
          </div>
          <p class="ph-hint" aria-live="polite"></p>
        </section>
        <section class="mesa-queue"></section>
        <p class="mesa-keys mono">Teclas: 1 · 2 arrancan A · B · Z / X frenan / empujan A · , / . frenan / empujan B · [ ] mueven el crossfader · M cambia de vista</p>
      </div>`;
    els.slotA = root.querySelector('.slot-a');
    els.slotB = root.querySelector('.slot-b');
    els.mixer = root.querySelector('.mixer');
    els.phase = root.querySelector('.phase');
    els.canvas = root.querySelector('.ph-canvas');
    els.mark = root.querySelector('.ph-mark');
    els.state = root.querySelector('.ph-state');
    els.tempo = root.querySelector('.ph-tempo');
    els.off = root.querySelector('.ph-off');
    els.hint = root.querySelector('.ph-hint');
    els.queue = root.querySelector('.mesa-queue');
    ['A', 'B'].forEach(buildInfo);
    buildMixer();
    root.addEventListener('click', onClick);
    // empujones con botón mantenido
    root.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('[data-nudge]'); if (!b) return;
      nudge(b.dataset.ch, +b.dataset.nudge);
      const up = () => { nudge(b.dataset.ch, 0); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    U.on('audio:grid', (x) => drawWave(x.ch));
    U.on('theme', () => requestAnimationFrame(() => { colors = null; ['A', 'B'].forEach(drawWave); }));
    M.built = true;
  };

  M.mount = function (P) {
    els.slotA.appendChild(P.A.el);
    els.slotB.appendChild(P.B.el);
    M.render();
  };

  function buildInfo(ch) {
    const s = root.querySelector(`.dinfo[data-ch="${ch}"]`);
    s.innerHTML = `
      <header class="di-head"><span class="di-ch">${ch}</span><div class="di-t"><b class="di-title"></b><span class="di-sub"></span></div><span class="di-time mono"></span></header>
      <div class="di-bpm">
        <div><span class="mono">BPM</span><b class="di-bpmv">—</b><span class="di-bpmn mono"></span></div>
        <div><span class="mono">Suena a</span><b class="di-effv">—</b><span class="di-pitch mono"></span></div>
        <div class="di-oct" hidden><button class="chip chip-sm" type="button" data-oct="0.5" data-ch="${ch}" title="El BPM medido es el doble del real">÷2</button><button class="chip chip-sm" type="button" data-oct="2" data-ch="${ch}" title="El BPM medido es la mitad del real">×2</button></div>
      </div>
      <div class="di-wave"><canvas aria-hidden="true"></canvas><span class="di-head-pos"></span><button class="di-seek" type="button" aria-label="Mover la aguja en el plato ${ch}"></button></div>
      <div class="di-ctrl">
        <button class="ibtn ibtn-solid di-play" type="button" data-play-ch="${ch}" aria-label="Start · Stop ${ch}">${U.icon('play')}</button>
        <button class="btn btn-sm di-nudge" type="button" data-nudge="-1" data-ch="${ch}" aria-label="Frenar ${ch} mientras se mantiene">‹‹ Frenar</button>
        <button class="btn btn-sm di-nudge" type="button" data-nudge="1" data-ch="${ch}" aria-label="Empujar ${ch} mientras se mantiene">Empujar ››</button>
        <span class="di-fine" role="group" aria-label="Pitch fino ${ch}"><button class="ibtn ibtn-sm" type="button" data-fine="-0.05" data-ch="${ch}" aria-label="Pitch −0,05 %">−</button><span class="mono">Pitch</span><button class="ibtn ibtn-sm" type="button" data-fine="0.05" data-ch="${ch}" aria-label="Pitch +0,05 %">+</button><button class="link-btn mono" type="button" data-fine="0" data-ch="${ch}">0</button></span>
      </div>
      <div class="di-src chips"></div>`;
    const q = (x) => s.querySelector(x);
    els.info[ch] = { s, title: q('.di-title'), sub: q('.di-sub'), time: q('.di-time'), bpm: q('.di-bpmv'), bpmn: q('.di-bpmn'), eff: q('.di-effv'), pitch: q('.di-pitch'), oct: q('.di-oct'), wave: q('.di-wave canvas'), pos: q('.di-head-pos'), seek: q('.di-seek'), play: q('.di-play'), src: q('.di-src') };
    els.info[ch].seek.addEventListener('click', (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      CH(ch).seek((ev.clientX - r.left) / r.width);
    });
  }

  function buildMixer() {
    const box = els.mixer;
    box.innerHTML = '<div class="mx-chs"></div><div class="mx-x"></div>';
    const chs = box.querySelector('.mx-chs');
    ['A', 'B'].forEach((ch) => {
      const c = CH(ch), strip = document.createElement('div');
      strip.className = 'mx-ch';
      strip.dataset.ch = ch;
      strip.innerHTML = `<span class="mx-name">${ch}</span>`;
      const ctl = els.ctl[ch];
      [['high', 'Agudos', 'Ag'], ['mid', 'Medios', 'Med'], ['low', 'Graves', 'Gr']].forEach(([band, label, short]) => {
        const cell = document.createElement('div');
        cell.className = 'mx-eq mx-' + band;
        const k = H.Ctl.knob({ label: label + ' ' + ch, short, fmt: eqText, onInput: (v) => { c.setEQ(band, v); mixChanged(); } });
        const kill = document.createElement('button');
        kill.type = 'button'; kill.className = 'mx-kill mono'; kill.textContent = 'Corte';
        kill.setAttribute('aria-pressed', 'false'); kill.setAttribute('aria-label', 'Cortar ' + label.toLowerCase() + ' ' + ch);
        kill.onclick = () => { const on = kill.getAttribute('aria-pressed') !== 'true'; kill.setAttribute('aria-pressed', on); c.setKill(band, on); mixChanged(); };
        cell.append(k.el, kill);
        strip.appendChild(cell);
        ctl[band] = k; ctl['kill-' + band] = kill;
      });
      const fcell = document.createElement('div'); fcell.className = 'mx-eq mx-flt';
      ctl.filter = H.Ctl.knob({ label: 'Filtro ' + ch, short: 'Filtro', fmt: filterText, cls: 'knob-bi', onInput: (v) => { c.setFilter(v); mixChanged(); } });
      fcell.appendChild(ctl.filter.el);
      strip.appendChild(fcell);
      const vu = document.createElement('div'); vu.className = 'mx-vu'; vu.setAttribute('aria-hidden', 'true'); vu.innerHTML = '<i></i>';
      ctl.vu = vu;
      ctl.fader = H.Ctl.slider({ label: 'Volumen del canal ' + ch, orient: 'v', value: 1, def: 1, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { c.setFader(v); mixChanged(); }, cls: 'mx-fader' });
      const fwrap = document.createElement('div'); fwrap.className = 'mx-fad';
      fwrap.append(vu, ctl.fader.el);
      strip.appendChild(fwrap);
      chs.appendChild(strip);
    });
    const x = box.querySelector('.mx-x');
    x.innerHTML = `<div class="mx-xf"><span class="mono">A</span><span class="mx-xslot"></span><span class="mono">B</span></div>
      <div class="mx-xrow"><div class="seg mx-curve" role="group" aria-label="Curva del crossfader"><button type="button" data-curve="suave" aria-pressed="true">Suave</button><button type="button" data-curve="corte" aria-pressed="false">Corte</button></div><span class="mx-master"></span></div>`;
    els.xf = H.Ctl.slider({ label: 'Crossfader', orient: 'h', value: 0, min: -1, max: 1, def: 0, step: 0.01, fmt: (v) => (Math.abs(v) < 0.01 ? 'Centro' : v < 0 ? 'Hacia A ' + Math.round(-v * 100) + ' %' : 'Hacia B ' + Math.round(v * 100) + ' %'), onInput: (v) => { AU().setCrossfader(v); mixChanged(); }, cls: 'mx-xfader' });
    x.querySelector('.mx-xslot').appendChild(els.xf.el);
    els.master = H.Ctl.knob({ label: 'Volumen general', short: 'Master', min: 0, max: 1, def: 0.75, value: AU().volume(), step: 0.01, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { AU().setVolume(v); const vol = document.getElementById('deck-vol'); if (vol) vol.value = v; } });
    x.querySelector('.mx-master').appendChild(els.master.el);
    x.querySelector('.mx-curve').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-curve]'); if (!b) return;
      AU().setCurve(b.dataset.curve);
      x.querySelectorAll('[data-curve]').forEach((y) => y.setAttribute('aria-pressed', y === b));
    });
  }

  M.syncControls = function () {
    if (!M.built) return;
    ['A', 'B'].forEach((ch) => {
      const m = CH(ch).mix, ctl = els.ctl[ch];
      ['high', 'mid', 'low'].forEach((b) => { ctl[b].set(m.eq[b], true); ctl['kill-' + b].setAttribute('aria-pressed', m.kill[b]); });
      ctl.filter.set(m.filter, true);
      ctl.fader.set(m.fader, true);
    });
    els.xf.set(AU().xf.pos, true);
    els.master.set(AU().volume(), true);
  };

  // el aviso «la mesa está cambiando A» del plato simple, sin repintar todo en cada giro
  const mixChanged = U.debounce(() => D().renderSource(), 120);

  /* ---------- acciones ---------- */
  function nudge(ch, dir) {
    CH(ch).setBend(dir * NUDGE);
    const b = root.querySelectorAll(`[data-nudge][data-ch="${ch}"]`);
    b.forEach((x) => x.classList.toggle('is-on', +x.dataset.nudge === dir && dir !== 0));
    D().kick();
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-oct],[data-fine],[data-play-ch],[data-src]');
    if (!b) return;
    const ch = b.dataset.ch || b.dataset.playCh;
    if (b.dataset.oct) D().fixOctave(ch, +b.dataset.oct);
    else if (b.dataset.fine != null) { const v = +b.dataset.fine; D().setPitch(v === 0 ? 0 : D().pitchOf(ch) + v, ch); }
    else if (b.dataset.playCh) D().togglePlay(ch);
  }

  M.key = function (ev, down) {
    const k = ev.key.toLowerCase();
    const map = { z: ['A', -1], x: ['A', 1], ',': ['B', -1], '.': ['B', 1] };
    if (map[k]) {
      const [ch, dir] = map[k];
      if (down && !held[k]) { held[k] = true; nudge(ch, dir); }
      if (!down) { held[k] = false; nudge(ch, 0); }
      return true;
    }
    if (!down) return false;
    if (k === '1' || k === '2') { D().togglePlay(k === '1' ? 'A' : 'B'); return true; }
    if (k === '[' || k === ']') { const v = U.clamp(AU().xf.pos + (k === '[' ? -0.1 : 0.1), -1, 1); AU().setCrossfader(v); els.xf.set(v, true); mixChanged(); return true; }
    return false;
  };

  /* ---------- render ---------- */
  function bpmInfo(ch) {
    const S = CH(ch).S, rec = D().recOf(ch);
    if (S.kind === 'pulse') return { v: S.bpm, note: 'pulso', measured: true };
    if (S.kind === 'file') {
      if (S.analysis === 'running') return { v: null, note: 'midiendo…' };
      if (S.grid) return { v: S.grid.bpm, note: 'medido · fiabilidad ' + S.grid.confidence, measured: true, grid: true };
      if (S.analysis === 'error') return { v: null, note: 'no se pudo medir' };
    }
    if (rec && rec.bpm) return rec.ok.includes('bpm') ? { v: rec.bpm, note: 'según la fuente', approx: false } : { v: rec.bpm, note: 'estimado', approx: true };
    return { v: null, note: '' };
  }

  function renderInfo(ch) {
    const i = els.info[ch], c = CH(ch), S = c.S, rec = D().recOf(ch);
    i.title.textContent = rec ? rec.title : S.fileName || (S.kind === 'pulse' ? 'Pulso de referencia' : 'Sin disco');
    const smp = D().sampleState(ch);
    const what = S.kind === 'file' && S.origin === 'deezer' ? ' · muestra de 30 s · Deezer' : smp && smp.state === 'loading' ? ' · cargando la muestra…' : S.fileName ? ' · ' + S.fileName : '';
    i.sub.textContent = rec ? rec.artistLine + what : S.kind === 'pulse' ? 'Sintetizado: no es un tema' : S.fileName ? 'Archivo suelto' : 'Carga un tema de la cola o un archivo tuyo';
    const b = bpmInfo(ch);
    i.bpm.textContent = b.v == null ? '—' : (b.approx ? '≈' : '') + num(b.v, b.measured ? 2 : 0);
    i.bpmn.textContent = b.note;
    const p = D().pitchOf(ch);
    i.eff.textContent = b.v == null ? '—' : (b.approx ? '≈' : '') + num(b.v * c.effRate(), 2);
    i.pitch.textContent = D().fmtPitch(p);
    i.oct.hidden = !b.grid;
    const playing = S.state === 'playing' || S.state === 'loading';
    i.play.innerHTML = U.icon(playing ? 'pause' : 'play');
    i.play.setAttribute('aria-label', (playing ? 'Pausa ' : 'Arrancar ') + ch);
    const hasRec = !!rec;
    const canSmp = hasRec && H.Dz && H.Dz.has(rec) && !H.Dz.blocked() && !(S.kind === 'file' && S.origin === 'deezer') && !(smp && smp.state === 'loading');
    i.src.innerHTML = `
      ${canSmp ? `<button class="chip chip-sm" type="button" data-act="sample" data-ch="${ch}">${U.icon('play')} Muestra 30 s</button>` : ''}
      ${smp && smp.state === 'error' ? `<span class="chip chip-sm chip-off">${e(smp.msg)}</span>` : ''}
      <button class="chip chip-sm" type="button" data-act="file" data-ch="${ch}">${U.icon('file')} ${S.kind === 'file' ? 'Otro archivo' : 'Cargar archivo'}</button>
      <button class="chip chip-sm" type="button" data-act="pulse" data-ch="${ch}">${U.icon('pulse')} Pulso${hasRec && rec.bpm ? ' ' + H.A.bpmTxt(rec) : ''}</button>
      ${S.kind ? `<button class="chip chip-sm" type="button" data-act="stop-src" data-ch="${ch}">${U.icon('close')} Quitar</button>` : ''}
      ${S.state === 'error' ? `<span class="chip chip-sm chip-off">${e(S.error || 'Error de audio')}</span>` : ''}`;
    i.s.dataset.state = S.kind ? S.state : 'empty';
    i.s.querySelector('.di-wave').classList.toggle('has-wave', !!S.grid);
  }

  function renderQueue() {
    const d = D();
    if (!d.queue.length) { els.queue.innerHTML = `<p class="mono q-head">Cola · vacía</p><p class="q-empty">Añade registros con <b>+</b> desde el catálogo y cárgalos aquí en el plato A o en el B.</p>`; return; }
    const onA = d.current && d.current.id, onB = d.B.current && d.B.current.id;
    els.queue.innerHTML = `<div class="q-head"><span class="mono">Cola · ${d.queue.length} · carga cada tema en un plato</span></div>
      <ol class="q-list mq-list">${d.queue.map((id, i) => {
        const t = H.A.t[id], has = d.files[id];
        return `<li class="${id === onA ? 'on-a' : ''} ${id === onB ? 'on-b' : ''}">
          <span class="mono q-n">${U.pad(i + 1, 2)}</span>
          <span class="q-t"><b>${e(t.title)}</b> <span>${e(t.artistLine)}</span></span>
          <span class="mono q-bpm">${H.A.bpmTxt(t)}${has ? ' · archivo' : ''}</span>
          <button class="mq-to mono" type="button" data-act="q-to" data-ch="A" data-i="${i}" aria-pressed="${id === onA}" aria-label="Cargar ${e(t.title)} en el plato A">A</button>
          <button class="mq-to mono" type="button" data-act="q-to" data-ch="B" data-i="${i}" aria-pressed="${id === onB}" aria-label="Cargar ${e(t.title)} en el plato B">B</button>
        </li>`;
      }).join('')}</ol>`;
  }

  M.render = function (ch) {
    if (!M.built) return;
    (ch ? [ch] : ['A', 'B']).forEach(renderInfo);
    if (!ch) renderQueue();
  };

  /* ---------- onda resumida ---------- */
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = { ink: cs.getPropertyValue('--ink').trim(), ink3: cs.getPropertyValue('--ink-3').trim(), line: cs.getPropertyValue('--line').trim(), paper: cs.getPropertyValue('--paper').trim() };
    return colors;
  }
  function sizeCanvas(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w, h, dpr };
  }
  function drawWave(ch) {
    const i = els.info[ch]; if (!i) return;
    const g = CH(ch).S.grid, cv = i.wave;
    const { w, h } = sizeCanvas(cv);
    const x = cv.getContext('2d');
    x.clearRect(0, 0, w, h);
    cv.dataset.w = w;
    if (!g) return;
    const C = colors || readColors();
    const ov = g.overview, n = ov.length;
    let mx = 0; for (let k = 0; k < n; k++) mx = Math.max(mx, ov[k]);
    x.fillStyle = C.ink;
    for (let px = 0; px < w; px++) {
      const k = Math.floor((px / w) * n), v = (ov[k] || 0) / (mx || 1);
      const bh = Math.max(1, v * h * 0.92);
      x.fillRect(px, (h - bh) / 2, 1, bh);
    }
  }

  /* ---------- fase ---------- */
  function beat(ch) {
    const c = CH(ch), S = c.S;
    if (S.state !== 'playing') return null;
    if (S.kind === 'pulse') {
      const pb = c.pulseBeats(); if (!pb) return null;
      return { frac: pb.frac, bpm: S.bpm * c.effRate(), pulse: pb };
    }
    if (S.kind === 'file' && S.grid) {
      const t = c.time().cur, b = ((t - S.grid.offset) * S.grid.bpm) / 60;
      return { frac: ((b % 1) + 1) % 1, bpm: S.grid.bpm * c.effRate(), t };
    }
    return null;
  }
  let sm = null; // desfase suavizado
  function wrap(d) { return ((((d + 0.5) % 1) + 1) % 1) - 0.5; }

  function drawLanes(bA, bB) {
    const cv = els.canvas, { w, h, dpr } = sizeCanvas(cv);
    const x = cv.getContext('2d');
    const C = colors || readColors();
    x.clearRect(0, 0, w, h);
    const ref = bA || bB;
    const win = ref ? (60 / ref.bpm) * 1.25 : 0.6; // ± segundos reales
    const laneH = (h - 6 * dpr) / 2;
    ['A', 'B'].forEach((ch, li) => {
      const y0 = li * (laneH + 6 * dpr), c = CH(ch), S = c.S;
      x.fillStyle = C.line; x.fillRect(0, y0 + laneH - 1, w, 1);
      x.fillStyle = C.ink3; x.font = `${10 * dpr}px "IBM Plex Mono", monospace`; x.fillText(ch, 4 * dpr, y0 + 12 * dpr);
      const now = li === 0 ? bA : bB;
      if (!now) return;
      x.fillStyle = C.ink;
      if (S.kind === 'pulse') {
        const pb = now.pulse, ctxT = AU().ctx().currentTime, len = pb.len;
        for (let k = -4; k <= 4; k++) {
          const tb = pb.last + k * len, dx = ((tb - ctxT) / win) * (w / 2) + w / 2;
          if (dx < -4 || dx > w + 4) continue;
          x.fillRect(dx - 1.5 * dpr, y0 + 4 * dpr, 3 * dpr, laneH - 6 * dpr);
        }
        return;
      }
      const g = S.grid, env = g.env, er = g.envRate, rate = c.effRate(), t = now.t;
      for (let px = 0; px < w; px++) {
        const t0 = t + ((px - w / 2) / (w / 2)) * win * rate, t1 = t + ((px + 1 - w / 2) / (w / 2)) * win * rate;
        let v = 0;
        for (let i0 = Math.max(0, Math.floor(t0 * er)), i1 = Math.min(env.length - 1, Math.floor(t1 * er)); i0 <= i1; i0++) if (env[i0] > v) v = env[i0];
        if (v > 0.12) { const bh = Math.min(1, v * 1.2) * (laneH - 6 * dpr); x.fillRect(px, y0 + laneH - 2 - bh, Math.max(1, dpr), bh); }
      }
      // rejilla de golpes medida (marcas arriba)
      const beatLen = 60 / g.bpm;
      const k0 = Math.ceil((t - win * rate - g.offset) / beatLen), k1 = Math.floor((t + win * rate - g.offset) / beatLen);
      x.fillStyle = C.ink3;
      for (let k = k0; k <= k1; k++) { const tb = g.offset + k * beatLen, dx = ((tb - t) / rate / win) * (w / 2) + w / 2; x.fillRect(dx - 0.5 * dpr, y0, 1 * dpr, 4 * dpr); }
    });
    x.fillStyle = C.ink;
    x.fillRect(w / 2 - 0.5 * dpr, 0, 1 * dpr, h);
  }

  function phaseRead(bA, bB) {
    if (!bA || !bB) {
      sm = null;
      els.state.textContent = '—';
      els.phase.dataset.lock = 'off';
      els.tempo.textContent = '—';
      els.off.textContent = '—';
      els.mark.style.left = '50%';
      const missing = ['A', 'B'].filter((ch) => !beat(ch)).map((ch) => {
        const S = CH(ch).S;
        if (!S.kind) return ch + ' sin fuente';
        if (S.state !== 'playing') return ch + ' parado';
        if (S.kind === 'file' && S.analysis === 'running') return ch + ' midiendo el BPM';
        if (S.kind === 'file' && !S.grid) return ch + ' sin BPM medido';
        return ch + ' sin golpes todavía';
      });
      els.hint.textContent = missing.length ? 'Para comparar hacen falta los dos platos sonando con el BPM medido: ' + missing.join(' · ') + '.' : '';
      return;
    }
    const d = wrap(bB.frac - bA.frac);
    sm = sm == null ? d : wrap(sm + wrap(d - sm) * 0.25);
    const dt = bB.bpm - bA.bpm;
    els.tempo.textContent = (dt > 0 ? '+' : dt < 0 ? '−' : '±') + num(Math.abs(dt), 2) + ' BPM';
    els.off.textContent = (sm > 0 ? '+' : sm < 0 ? '−' : '±') + num(Math.abs(sm), 2) + ' golpes';
    els.mark.style.left = (50 + sm * 100).toFixed(1) + '%';
    const tempoOk = Math.abs(dt) < 0.05, phaseOk = Math.abs(sm) < 0.04;
    els.phase.dataset.lock = tempoOk && phaseOk ? 'on' : tempoOk ? 'tempo' : 'off';
    els.state.textContent = tempoOk && phaseOk ? 'En fase' : tempoOk ? 'Tempo igualado' : 'Tempos distintos';
    const gap = Math.abs(dt) / bA.bpm * 100;
    els.hint.textContent = !tempoOk && gap > 16
      ? `Los tempos se separan un ${num(gap, 1)} %: ni con el pitch a ±16 se igualan. Elige un tema más cercano o mezcla a medio tempo.`
      : !tempoOk && gap > D().range.B && gap > D().range.A
        ? `Los tempos se separan un ${num(gap, 1)} %, más que el ±${D().range.B} % del pitch: pulsa «±${D().range.B}» en un plato para pasar a ±16.`
        : !tempoOk
      ? `B va ${num(Math.abs(dt), 2)} BPM más ${dt > 0 ? 'rápido' : 'lento'} que A: ${dt > 0 ? 'baja el pitch de B (fader hacia arriba)' : 'sube el pitch de B (fader hacia abajo)'} o haz lo contrario con A.`
      : !phaseOk
        ? `Mismo tempo. Los golpes de B van ${num(Math.abs(sm), 2)} ${sm > 0 ? 'por delante' : 'por detrás'}: ${sm > 0 ? 'frena' : 'empuja'} B un momento.`
        : 'Los golpes de A y B caen juntos. Mueve el crossfader.';
  }

  M.frame = function () {
    if (!M.built) return false;
    const bA = beat('A'), bB = beat('B');
    drawLanes(bA, bB);
    phaseRead(bA, bB);
    let busy = false;
    ['A', 'B'].forEach((ch) => {
      const c = CH(ch), S = c.S, i = els.info[ch], tm = c.time();
      i.time.textContent = S.kind === 'file' ? U.fmtTime(tm.cur) + ' / ' + U.fmtTime(tm.dur) : S.kind === 'pulse' ? U.fmtTime(tm.cur) : '';
      i.pos.style.left = S.kind === 'file' && tm.dur ? ((tm.cur / tm.dur) * 100).toFixed(2) + '%' : '-10px';
      const b = bpmInfo(ch);
      if (b.v != null) i.eff.textContent = (b.approx ? '≈' : '') + num(b.v * c.effRate(), 2);
      if (i.wave.dataset.w != String(Math.round(i.wave.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1)))) drawWave(ch);
      const lv = c.level();
      els.ctl[ch].vu.style.setProperty('--lv', lv.toFixed(3));
      if (S.state === 'playing') busy = true;
    });
    return busy;
  };
})();
