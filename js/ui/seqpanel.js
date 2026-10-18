/* HARMONY · secuenciador del Soundpad: el panel
   Una fila por pad con sonido. Patrones de 4, 8 o 16 tiempos (uno, dos o cuatro compases de 16 semicorcheas): se ve un
   compás cada vez, con el selector de tiempos 1–4 · 5–8 · 9–12 · 13–16. Clic: golpe sí o no; clic derecho, Alt+clic o mantener
   pulsado (en pantallas táctiles): golpe suave. Con el ratón se puede arrastrar para pintar varios pasos.
   Modelo en js/lib/patterns.js (guardado dentro del banco) y reloj en js/audio/sequencer.js. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;
  const PT = () => H.Patterns;

  /* Kits para empezar: sonidos de la biblioteca de Harmony que van a los pads libres, con su tempo */
  const KITS = {
    hardcore: { name: 'Hardcore', bpm: 180, ids: ['harmony-01/hc-kick-gabber', 'harmony-01/clap-hardcore', 'harmony-01/hat-closed', 'harmony-01/hat-open'] },
    newstyle: { name: 'Newstyle', bpm: 150, ids: ['harmony-01/ns-kick-punch', 'harmony-01/ns-bass-offbeat', 'harmony-01/snare-clap', 'harmony-01/hat-open'] },
    uptempo: { name: 'Uptempo', bpm: 200, ids: ['harmony-01/ut-kick-raw', 'harmony-01/clap-room', 'harmony-01/hat-closed', 'harmony-01/hat-open'] }
  };

  /* Qué papel tiene un pad en una base 4×4, por su sonido de Harmony, su categoría o su nombre */
  function role(p) {
    if (!p.src) return null;
    const x = p.src.type === 'harmony' && H.Lib ? H.Lib.get(p.src.sampleId) : null, t = x && x.type;
    const txt = U.norm([p.name, x ? x.name : '', x ? x.tags.join(' ') : ''].join(' '));
    if (t === 'redoble') return null;
    if (t === 'kick' || (!t && p.cat === 'kick') || /\bkick\b|bombo/.test(txt)) return 'kick';
    if (t === 'bajo' || (!t && p.cat === 'bajo')) return 'bass';
    if (t === 'palma' || t === 'caja' || /clap|palma|snare|caja/.test(txt)) return 'clap';
    if (t === 'charles' || /hat|charles/.test(txt)) return /abierto|open/.test(txt) ? 'ohat' : 'hat';
    return null;
  }

  /* api: { bank(), save(), fire(i), flash(i), addToFreePad(src, opts), refreshPads(),
            assignSample(i, id), assignFile(i, file), openLibrary(i) } */
  H.SeqPanel = function (el, api) {
    let painting = null, press = null, raf = 0, shownNow = -1, lastMark = 0, tapT = [], bar = 0, liveBar = -1;
    const seq = () => api.bank().seq;
    const pads = () => api.bank().pads;
    // pantalla táctil sin ratón: ahí no se puede arrastrar desde la biblioteca
    const touch = () => window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    H.Seq.source(api.bank);

    el.innerHTML = `
      <div class="sq-head">
        <div class="sq-title"><p class="mono eyebrow">Ritmo en bucle</p><h2 class="sq-h">Secuenciador</h2></div>
        <div class="sq-transport">
          <button class="btn btn-solid sq-play" type="button" data-sq="play"></button>
          <button class="btn sq-rec" type="button" data-sq="rec" aria-pressed="false" title="Lo que toques con los pads mientras suena entra en el paso más cercano">${U.icon('rec')}<span>Grabar</span></button>
          <label class="sel mono sq-bpm"><span>BPM</span><button class="sq-nudge" type="button" data-sq="bpm-" aria-label="Un BPM menos">−</button><input type="number" id="sq-bpm" min="${PT().BPM_MIN}" max="${PT().BPM_MAX}" step="1" inputmode="numeric"><button class="sq-nudge" type="button" data-sq="bpm+" aria-label="Un BPM más">+</button></label>
          <button class="btn btn-sm sq-tap" type="button" data-sq="tap" title="Pulsa al ritmo varias veces">Tap</button>
          <label class="mono sq-swing"><span>Swing <output id="sq-swing-o"></output></span><input type="range" id="sq-swing" min="0" max="100" step="1"></label>
        </div>
      </div>
      <div class="sq-bar">
        <div class="seg sq-pats" role="group" aria-label="Patrón que se edita"></div>
        <div class="sq-lenbox"><span class="mono">Tiempos</span>
          <div class="seg sq-len" role="group" aria-label="Largo del patrón en tiempos">
            <button type="button" data-sq="len" data-len="16" title="Un compás">4</button><button type="button" data-sq="len" data-len="32" title="Dos compases">8</button><button type="button" data-sq="len" data-len="64" title="Cuatro compases">16</button>
          </div>
        </div>
        <label class="sel mono sq-act"><span>Patrón</span><select id="sq-act"></select></label>
        <div class="sq-chain">
          <label class="mono sq-chain-on"><input type="checkbox" id="sq-chain-on"><span>Cadena</span></label>
          <input type="text" id="sq-chain" maxlength="16" placeholder="AABA" autocomplete="off" spellcheck="false" aria-label="Orden de los patrones (letras A–D)">
        </div>
      </div>
      <div class="seg sq-bars" role="group" aria-label="Compás a la vista" hidden></div>
      <div class="sq-scroll"><div class="sq-grid" role="grid" aria-label="Pasos del patrón"></div></div>
      <p class="fine sq-help">Para meter un sonido: «Añadir sonido» al final de la rejilla (en el ordenador también puedes arrastrarlo encima desde la biblioteca o desde tu equipo). Clic: poner o quitar un golpe. Clic derecho, Alt+clic o mantener pulsado: golpe suave (a medio volumen). Con el ratón, arrastra para pintar varios. Los patrones duran 4, 8 o 16 tiempos y se ven de compás en compás (tiempos 1–4, 5–8…); al alargar, los compases nuevos repiten lo que ya había. Cada fila es un pad: el nombre lo escucha; M lo silencia y S lo deja solo. Un golpe corta el anterior del mismo pad y los de su grupo de corte. Los cambios de patrón entran al acabar la vuelta.</p>`;
    const $ = (s) => el.querySelector(s);
    const grid = $('.sq-grid');

    /* ---------- pintado ---------- */
    function render() { renderHead(); renderBar(); renderGrid(); }
    function renderHead() {
      const s = seq(), on = H.Seq.playing();
      const play = $('.sq-play');
      play.innerHTML = on ? `${U.icon('stop')}<span>Parar</span>` : `${U.icon('play')}<span>Tocar</span>`;
      play.setAttribute('aria-pressed', on);
      const rec = $('.sq-rec'), r = H.Seq.recording();
      rec.setAttribute('aria-pressed', r); rec.classList.toggle('is-on', r);
      if (document.activeElement !== $('#sq-bpm')) $('#sq-bpm').value = s.bpm;
      $('#sq-swing').value = s.swing;
      $('#sq-swing-o').textContent = s.swing + ' %';
    }
    function renderBar() {
      const s = seq(), pos = H.Seq.position();
      $('.sq-pats').innerHTML = PT().NAMES.split('').map((n, k) => {
        const has = PT().hasNotes(s.patterns[k]), playing = pos && pos.pat === k;
        return `<button type="button" data-sq="pat" data-p="${k}" aria-pressed="${s.pattern === k}" class="${has ? 'has-notes' : ''}${playing ? ' is-live' : ''}" title="Patrón ${n}${has ? '' : ' (vacío)'}">${n}<i aria-hidden="true"></i></button>`;
      }).join('');
      el.querySelectorAll('[data-sq="len"]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.len === s.patterns[s.pattern].len));
      const cur = PT().NAMES[s.pattern];
      $('#sq-act').innerHTML = `<option value="">Acciones…</option>
        <optgroup label="Patrón ${cur}">
          <option value="base">Base 4×4 con los sonidos de los pads</option>
          <option value="clear">Vaciar el patrón ${cur}</option>
          ${PT().NAMES.split('').filter((n) => n !== cur).map((n) => `<option value="copy:${PT().NAMES.indexOf(n)}">Copiar ${cur} en ${n}${PT().hasNotes(s.patterns[PT().NAMES.indexOf(n)]) ? ' (lo sustituye)' : ''}</option>`).join('')}
        </optgroup>
        <optgroup label="Kits de Harmony en los pads libres">
          ${Object.entries(KITS).map(([k, x]) => `<option value="kit:${k}">${x.name} · ${x.bpm} BPM, con su base</option>`).join('')}
        </optgroup>`;
      renderBars();
      $('#sq-chain-on').checked = s.chainOn;
      if (document.activeElement !== $('#sq-chain')) $('#sq-chain').value = PT().chainText(s.chain);
      $('.sq-chain').classList.toggle('is-on', s.chainOn && s.chain.length > 0);
    }
    /* compases del patrón: «Tiempos 1–4», «5–8»… con un punto si tienen golpes */
    function renderBars() {
      const s = seq(), pat = s.patterns[s.pattern], n = pat.len / PT().BAR, box = $('.sq-bars');
      bar = Math.min(bar, n - 1);
      box.hidden = n < 2;
      box.innerHTML = n < 2 ? '' : Array.from({ length: n }, (_, b) => {
        const a = b * PT().BAR, has = Object.values(pat.rows).some((r) => /[12]/.test(r.slice(a, a + PT().BAR)));
        return `<button type="button" data-sq="bar" data-b="${b}" aria-pressed="${b === bar}" class="${has ? 'has-notes' : ''}${b === liveBar ? ' is-live' : ''}"><span class="mono">Tiempos</span> ${b * 4 + 1}–${b * 4 + 4}<i aria-hidden="true"></i></button>`;
      }).join('');
    }
    function rowIdx() { return pads().map((p, i) => (p.src ? i : -1)).filter((i) => i >= 0); }
    function renderGrid() {
      const s = seq(), p = s.pattern, len = s.patterns[p].len, rows = rowIdx();
      bar = Math.min(bar, len / PT().BAR - 1);
      const a = bar * PT().BAR, ks = Array.from({ length: PT().BAR }, (_, j) => a + j);
      if (!rows.length) {
        grid.innerHTML = `<div class="sq-empty"><p>Pon sonidos en los pads y cada uno será una fila del secuenciador.</p>
          <div class="chips">${Object.entries(KITS).map(([k, x]) => `<button class="chip" type="button" data-sq="kit" data-kit="${k}">${U.icon('plus')} Kit ${x.name} (${x.bpm} BPM)</button>`).join('')}</div>
          <p class="fine">Un kit pone cuatro sonidos de la biblioteca de Harmony en los pads libres, ajusta el tempo y deja una base 4×4 en el patrón ${PT().NAMES[p]}.</p></div>`;
        shownNow = -1;
        return;
      }
      const head = `<div class="sq-row sq-ruler" role="row" aria-hidden="true"><div class="sq-rh"></div><div class="sq-steps">${ks.map((k) => `<span class="sq-n${k % 4 === 0 ? ' is-beat' : ''}">${k % 4 === 0 ? k / 4 + 1 : '·'}</span>`).join('')}</div></div>`;
      grid.innerHTML = head + rows.map((i) => {
        const pad = pads()[i], name = pad.name || 'Pad ' + (i + 1), row = PT().row(s, p, i);
        const mute = s.mute.includes(i), solo = s.solo.includes(i), heard = PT().audible(s, i);
        return `<div class="sq-row cat-${pad.cat}${heard ? '' : ' is-off'}" role="row" data-i="${i}">
          <div class="sq-rh" role="rowheader">
            <button class="sq-name" type="button" data-sq="hear" title="Escuchar ${e(name)}"><span class="mono">${String(i + 1).padStart(2, '0')}</span> ${e(name)}</button>
            <button class="sq-ms${mute ? ' is-on' : ''}" type="button" data-sq="mute" aria-pressed="${mute}" title="Silenciar">M</button>
            <button class="sq-ms${solo ? ' is-on' : ''}" type="button" data-sq="solo" aria-pressed="${solo}" title="Solo">S</button>
            <select class="sq-fill" data-sq="fill" aria-label="Rellenar la fila de ${e(name)}">
              <option value="">Rellenar…</option>
              ${Object.entries(PT().FILLS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}
              <option value="left">← Mover un paso</option><option value="right">Mover un paso →</option>
              <option value="clear">Vaciar la fila</option>
            </select>
          </div>
          <div class="sq-steps">${ks.map((k) => cell(name, k, +row[k])).join('')}</div>
        </div>`;
      }).join('');
      const free = pads().findIndex((x) => !x.src);
      grid.insertAdjacentHTML('beforeend', `<div class="sq-row sq-add" role="row">
        <div class="sq-rh">${free >= 0 ? `<button class="sq-addbtn" type="button" data-sq="add">${U.icon('plus')}<span>Añadir sonido</span></button>` : '<span class="fine sq-full">16 pads ocupados</span>'}</div>
        <div class="sq-drop fine">${free < 0 ? 'Para otra fila, vacía un pad.' : touch() ? `Pad ${free + 1}: toca «Añadir sonido» y elige con ＋.` : `Arrastra aquí un sonido de la biblioteca o un archivo de audio: entra en el pad ${free + 1}. Encima de una fila, cambia el sonido de ese pad.`}</div>
      </div>`);
      shownNow = -1; paintNow(true);
    }
    const VAL = ['', 'golpe', 'golpe suave'];
    function cell(name, k, v) {
      return `<button class="sq-st v${v}${k % 4 === 0 ? ' is-beat' : ''}" type="button" role="gridcell" data-s="${k}" aria-pressed="${v > 0}" aria-label="${e(name)}, paso ${k + 1}${v ? ': ' + VAL[v] : ''}"></button>`;
    }
    function paintCell(i, k) {
      const b = grid.querySelector(`.sq-row[data-i="${i}"] .sq-st[data-s="${k}"]`); if (!b) return;
      const v = PT().get(seq(), seq().pattern, i, k);
      b.className = `sq-st v${v}${k % 4 === 0 ? ' is-beat' : ''}${k === shownNow ? ' is-now' : ''}`;
      b.setAttribute('aria-pressed', v > 0);
      const name = b.getAttribute('aria-label').replace(/, paso \d+.*$/, '');
      b.setAttribute('aria-label', `${name}, paso ${k + 1}${v ? ': ' + VAL[v] : ''}`);
    }

    /* ---------- cabezal: la columna que suena y los pads que golpean ---------- */
    function paintNow(force) {
      const pos = H.Seq.position(), s = seq();
      const k = pos && pos.pat === s.pattern ? pos.step : -1;
      if (k !== shownNow || force) {
        grid.querySelectorAll('.sq-st.is-now, .sq-n.is-now').forEach((x) => x.classList.remove('is-now'));
        const j = k - bar * PT().BAR;   // la columna, si ese paso está en el compás a la vista
        if (k >= 0 && j >= 0 && j < PT().BAR) grid.querySelectorAll(`.sq-st[data-s="${k}"], .sq-ruler .sq-n:nth-child(${j + 1})`).forEach((x) => x.classList.add('is-now'));
        shownNow = k;
        // qué compás está sonando
        const lb = k >= 0 ? Math.floor(k / PT().BAR) : -1;
        if (lb !== liveBar) { liveBar = lb; el.querySelectorAll('.sq-bars button').forEach((b) => b.classList.toggle('is-live', +b.dataset.b === lb)); }
      }
    }
    function loop() {
      raf = 0;
      if (!H.Seq.playing()) { paintNow(true); return; }
      const ctx = H.Audio.ctx(), now = ctx ? ctx.currentTime : 0;
      paintNow();
      // pads que suenan en este paso: se iluminan en el Soundpad
      for (const m of H.Seq.marksSince(lastMark)) {
        if (m.t > now) break;
        lastMark = m.t;
        const s = seq(), pt = s.patterns[m.pat];
        for (const kk of Object.keys(pt.rows)) if (+pt.rows[kk][m.step] && PT().audible(s, +kk)) api.flash(+kk);
        if (m.step === 0) paintLive(m.pat);
      }
      raf = requestAnimationFrame(loop);
    }
    function startLoop() { if (!raf) { const ctx = H.Audio.ctx(); lastMark = ctx ? ctx.currentTime - 0.01 : 0; raf = requestAnimationFrame(loop); } }
    /* qué patrón suena (sin rehacer los controles: un desplegable abierto no se cierra) */
    function paintLive(k) { el.querySelectorAll('.sq-pats button').forEach((b) => b.classList.toggle('is-live', H.Seq.playing() && +b.dataset.p === k)); }

    /* ---------- edición ---------- */
    const save = () => api.save();
    function edit(i, k, value) {
      const s = seq();
      PT().set(s, s.pattern, i, k, value);
      paintCell(i, k);
    }
    grid.addEventListener('contextmenu', (ev) => { if (ev.target.closest('.sq-st')) ev.preventDefault(); });
    grid.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('.sq-st'); if (!b || ev.button > 2) return;
      const i = +b.closest('.sq-row').dataset.i, k = +b.dataset.s, cur = PT().get(seq(), seq().pattern, i, k);
      const soft = ev.button === 2 || ev.altKey;
      if (ev.pointerType === 'touch') {
        // dedo: tocar pone o quita; mantener, golpe suave. Sin arrastre, para que la rejilla se pueda desplazar
        press = { i, k, x: ev.clientX, y: ev.clientY, timer: setTimeout(() => { press.done = true; edit(i, k, cur === 2 ? 0 : 2); save(); if (navigator.vibrate) navigator.vibrate(12); }, 450) };
        return;
      }
      ev.preventDefault();
      const value = soft ? (cur === 2 ? 0 : 2) : cur ? 0 : 1;
      painting = { value, seen: new Set([i + ':' + k]) };
      edit(i, k, value);
    });
    grid.addEventListener('pointermove', (ev) => {
      // un dedo siempre tiembla un poco: solo es desplazar (y no tocar) si se mueve de verdad
      if (press && ev.pointerType === 'touch') { if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; } return; }
      if (!painting) return;
      const t = document.elementFromPoint(ev.clientX, ev.clientY), b = t && t.closest && t.closest('.sq-st');
      if (!b || !grid.contains(b)) return;
      const i = +b.closest('.sq-row').dataset.i, k = +b.dataset.s, id = i + ':' + k;
      if (painting.seen.has(id)) return;
      painting.seen.add(id); edit(i, k, painting.value);
    });
    const endPaint = () => { if (painting) { painting = null; save(); renderBar(); } };
    window.addEventListener('pointerup', (ev) => {
      if (press) {
        clearTimeout(press.timer);
        if (!press.done && ev.pointerType === 'touch') { const { i, k } = press; edit(i, k, PT().get(seq(), seq().pattern, i, k) ? 0 : 1); save(); renderBar(); }
        press = null;
      }
      endPaint();
    });
    window.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; endPaint(); });
    // teclado: Intro o espacio en un paso lo pone o lo quita (con Alt, suave)
    grid.addEventListener('click', (ev) => {
      const b = ev.target.closest('.sq-st');
      if (!b || ev.detail !== 0) return;
      const i = +b.closest('.sq-row').dataset.i, k = +b.dataset.s;
      PT().toggle(seq(), seq().pattern, i, k, ev.altKey); paintCell(i, k); save(); renderBar();
    });

    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-sq]'); if (!b || b.tagName === 'SELECT') return;
      const a = b.dataset.sq, s = seq(), row = b.closest('.sq-row'), i = row ? +row.dataset.i : -1;
      if (a === 'play') toggle();
      else if (a === 'rec') rec();
      else if (a === 'bpm-' || a === 'bpm+') { setBpm(s.bpm + (a === 'bpm+' ? 1 : -1)); }
      else if (a === 'tap') tap();
      else if (a === 'pat') { s.pattern = +b.dataset.p; bar = 0; save(); renderBar(); renderGrid(); }
      else if (a === 'len') { PT().setLen(s, s.pattern, +b.dataset.len); save(); renderBar(); renderGrid(); }
      else if (a === 'bar') { bar = +b.dataset.b; renderBars(); renderGrid(); }
      else if (a === 'hear') api.fire(i);
      else if (a === 'mute' || a === 'solo') { PT().flag(s, a, i); save(); renderGrid(); }
      else if (a === 'kit') kit(b.dataset.kit);
      else if (a === 'add') { const f = pads().findIndex((x) => !x.src); if (f >= 0) api.openLibrary(f); }
    });

    /* soltar un sonido de la biblioteca (o un archivo) encima: en una fila cambia su pad; fuera, va a un pad libre */
    const AUDIO = /\.(mp3|wav|wave|ogg|oga|opus|flac|m4a|aac|webm|aif|aiff)$/i;
    const dropKind = (dt) => (dt && [...dt.types].includes('text/x-harmony-sample') ? 'sample' : dt && [...dt.types].includes('Files') ? 'file' : null);
    let dropEl = null;
    const mark = (x) => { if (dropEl !== x) { if (dropEl) dropEl.classList.remove('is-drop'); dropEl = x; if (x) x.classList.add('is-drop'); } };
    el.addEventListener('dragover', (ev) => {
      if (!dropKind(ev.dataTransfer) || !ev.target.closest('.sq-scroll')) return;
      ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
      mark(ev.target.closest('.sq-row[data-i]') || ev.target.closest('.sq-add') || grid);
    });
    el.addEventListener('dragleave', (ev) => { if (!el.contains(ev.relatedTarget)) mark(null); });
    el.addEventListener('drop', (ev) => {
      const kind = dropKind(ev.dataTransfer);
      if (!kind || !ev.target.closest('.sq-scroll')) return;
      ev.preventDefault(); mark(null);
      const row = ev.target.closest('.sq-row[data-i]');
      const i = row ? +row.dataset.i : pads().findIndex((x) => !x.src);
      if (i < 0) { U.toast('Los 16 pads están ocupados: suéltalo encima de una fila para cambiar su sonido'); return; }
      if (kind === 'sample') { api.assignSample(i, ev.dataTransfer.getData('text/x-harmony-sample')); return; }
      const f = [...ev.dataTransfer.files].find((x) => (x.type && x.type.startsWith('audio/')) || AUDIO.test(x.name || ''));
      if (f) api.assignFile(i, f); else U.toast('Eso no parece un archivo de audio');
    });
    el.addEventListener('change', (ev) => {
      const t = ev.target, s = seq();
      if (t.id === 'sq-bpm') setBpm(+t.value);
      else if (t.id === 'sq-chain-on') { s.chainOn = t.checked; if (t.checked && !s.chain.length) U.toast('Escribe la cadena con las letras de los patrones: AABA, ABAC…'); save(); renderBar(); }
      else if (t.id === 'sq-chain') { s.chain = PT().parseChain(t.value); t.value = PT().chainText(s.chain); if (s.chain.length && !s.chainOn) s.chainOn = true; save(); renderBar(); }
      else if (t.id === 'sq-act') { const v = t.value; t.value = ''; action(v); }
      else if (t.matches('.sq-fill')) { const i = +t.closest('.sq-row').dataset.i, v = t.value; t.value = ''; if (v) { PT().fill(s, s.pattern, i, v); save(); renderGrid(); renderBar(); } }
    });
    el.addEventListener('input', (ev) => {
      if (ev.target.id === 'sq-swing') { seq().swing = +ev.target.value; $('#sq-swing-o').textContent = seq().swing + ' %'; save(); }
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.target.id === 'sq-bpm' && ev.key === 'Enter') { ev.preventDefault(); setBpm(+ev.target.value); ev.target.blur(); }
      if (ev.target.id === 'sq-chain' && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
    });

    function setBpm(v) {
      const s = seq();
      if (!Number.isFinite(v)) { renderHead(); return; }
      s.bpm = Math.min(PT().BPM_MAX, Math.max(PT().BPM_MIN, Math.round(v)));
      $('#sq-bpm').value = s.bpm; save();
    }
    function tap() {
      const now = performance.now();
      tapT = tapT.filter((t) => now - t < 2500); tapT.push(now);
      if (tapT.length < 3) { U.toast('Sigue pulsando Tap al ritmo…'); return; }
      const d = (tapT[tapT.length - 1] - tapT[0]) / (tapT.length - 1);
      setBpm(60000 / d);
    }
    function rec() {
      if (!H.Seq.playing() && (!rowIdx().length || !H.Seq.start())) { if (!rowIdx().length) U.toast('Primero pon sonidos en los pads (o elige un kit)'); return; }
      H.Seq.setRecording(!H.Seq.recording());
      if (H.Seq.recording()) U.toast('Grabando: toca los pads (o sus teclas) y cada golpe entra en el paso más cercano');
      startLoop(); renderHead();
    }
    function toggle() {
      if (H.Seq.playing()) H.Seq.stop();
      else if (!rowIdx().length) { U.toast('Primero pon sonidos en los pads (o elige un kit)'); return; }
      else if (!H.Seq.start()) { U.toast(H.PadAudio.message({ code: 'noaudio' })); return; }
      renderHead(); renderBar(); startLoop();
    }
    function base() {
      const s = seq(), roles = pads().map((p, i) => ({ i, role: role(p) })).filter((r) => r.role);
      if (!roles.length) { U.toast('No encuentro kicks, palmas, cajas, charles ni bajos en los pads: usa «Rellenar…» en cada fila.'); return false; }
      const used = PT().base(s, s.pattern, roles);
      save(); renderGrid(); renderBar();
      U.toast(`Base 4×4 en el patrón ${PT().NAMES[s.pattern]} con ${used.map((i) => pads()[i].name || 'pad ' + (i + 1)).join(', ')}`);
      return true;
    }
    function action(v) {
      const s = seq();
      if (v === 'base') base();
      else if (v === 'clear') { PT().clearPattern(s, s.pattern); save(); renderGrid(); renderBar(); U.toast(`Patrón ${PT().NAMES[s.pattern]} vacío`); }
      else if (v.startsWith('copy:')) { const to = +v.slice(5); PT().copy(s, s.pattern, to); save(); renderBar(); U.toast(`${PT().NAMES[s.pattern]} copiado en ${PT().NAMES[to]}`); }
      else if (v.startsWith('kit:')) kit(v.slice(4));
    }
    function kit(k) {
      const x = KITS[k]; if (!x) return;
      const got = [];
      for (const id of x.ids) {
        const smp = H.Lib && H.Lib.get(id); if (!smp) continue;
        const r = api.addToFreePad({ type: 'harmony', sampleId: id }, { name: smp.name, cat: smp.cat });
        if (!r) break;
        got.push(r.i);
      }
      if (!got.length) { U.toast('No quedan pads libres en este banco: vacía alguno o crea un banco nuevo'); return; }
      // los dos charles del kit se cortan entre sí, como en una caja de ritmos
      const hats = got.filter((i) => /hat-/.test(pads()[i].src.sampleId));
      if (hats.length === 2) hats.forEach((i) => { pads()[i].choke = 1; });
      const s = seq();
      s.bpm = x.bpm;
      if (!PT().hasNotes(s.patterns[s.pattern])) base(); else { save(); render(); }
      api.refreshPads();
      U.toast(`Kit ${x.name}: ${got.length} sonidos en los pads ${got.map((i) => i + 1).join(', ')} · ${x.bpm} BPM`);
    }

    U.on('seq', () => { renderHead(); renderBar(); if (H.Seq.playing()) startLoop(); else paintNow(true); });
    U.on('seq:rec', renderHead);

    render();
    return {
      render,
      /* un golpe grabado en directo: pinta esa casilla */
      recorded(n, i) { if (n && n.pat === seq().pattern) paintCell(i, n.step); renderBar(); },
      toggle, rec
    };
  };
})();
