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

  const presets = () => (H.data && H.data.presets) || [];

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
      <div class="sq-roll" hidden></div>
      <p class="fine sq-help">Para meter un sonido: «Añadir sonido» al final de la rejilla (en el ordenador también puedes arrastrarlo encima desde la biblioteca o desde tu equipo). Clic: poner o quitar un golpe. Clic derecho, Alt+clic o mantener pulsado: golpe suave (a medio volumen). Con el ratón, arrastra para pintar varios, y arrastra el borde derecho de una nota para alargarla o acortarla (doble clic en el borde: vuelve a sonar entera; en tenue se ve lo que dura el sonido entero). En un pad en modo bucle, una nota larga repite el bucle hasta su final. Los patrones duran 4, 8 o 16 tiempos y se ven de compás en compás (tiempos 1–4, 5–8…); al alargar, los compases nuevos repiten lo que ya había. Cada fila es un pad: el nombre lo escucha; M lo silencia, S lo deja solo y ♪ la pasa a notas (piano roll: cada nota con su altura y su duración, para melodías, acordes o melodías de kicks). Un golpe corta el anterior del mismo pad y los de su grupo de corte. Los cambios de patrón entran al acabar la vuelta.</p>`;
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
        </optgroup>
        <optgroup label="Banco nuevo con un preset de escuela">
          ${presets().map((x) => `<option value="preset:${x.id}">${e(x.name)} · ${x.bpm} BPM, 16 pads y 4 patrones</option>`).join('')}
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
          <p class="fine">Un kit pone cuatro sonidos de la biblioteca de Harmony en los pads libres, ajusta el tempo y deja una base 4×4 en el patrón ${PT().NAMES[p]}.</p>
          ${presets().length ? `<p class="sq-empty-h mono">O un banco entero por escuela</p>
          <div class="sq-presets">${presets().map((x) => `<button class="sq-preset" type="button" data-sq="preset" data-preset="${e(x.id)}"><b>${e(x.name)}</b><span class="mono">${x.bpm} BPM · ${e(x.tonality)}</span><span class="fine">${e(x.desc)}</span></button>`).join('')}</div>
          <p class="fine">Un preset crea un banco nuevo (el que tienes no se toca) con 16 pads, el tempo y cuatro patrones encadenados: intro, subida, drop y break.</p>` : ''}</div>`;
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
            <button class="sq-ms sq-melb${PT().isMel(s, i) ? ' is-on' : ''}" type="button" data-sq="mel" aria-pressed="${PT().isMel(s, i)}" title="Notas: piano roll (melodías y acordes con este sonido)">♪</button>
            ${PT().isMel(s, i) ? `<button class="sq-fill sq-rollopen mono" type="button" data-sq="roll">${rollPad === i ? 'Editando ↓' : 'Editar notas'}</button>` : `<select class="sq-fill" data-sq="fill" aria-label="Rellenar la fila de ${e(name)}">
              <option value="">Rellenar…</option>
              ${Object.entries(PT().FILLS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}
              <option value="left">← Mover un paso</option><option value="right">Mover un paso →</option>
              <option value="whole">Notas enteras (sin duración)</option>
              <option value="clear">Vaciar la fila</option>
            </select>`}
          </div>
          <div class="sq-steps">${PT().isMel(s, i) ? melCells(i, ks) : (() => { const st = rowState(i); return ks.map((k) => cell(name, k, st[k])).join(''); })()}</div>
        </div>`;
      }).join('');
      const free = pads().findIndex((x) => !x.src);
      grid.insertAdjacentHTML('beforeend', `<div class="sq-row sq-add" role="row">
        <div class="sq-rh">${free >= 0 ? `<button class="sq-addbtn" type="button" data-sq="add">${U.icon('plus')}<span>Añadir sonido</span></button>` : '<span class="fine sq-full">16 pads ocupados</span>'}</div>
        <div class="sq-drop fine">${free < 0 ? 'Para otra fila, vacía un pad.' : touch() ? `Pad ${free + 1}: toca «Añadir sonido» y elige con ＋.` : `Arrastra aquí un sonido de la biblioteca o un archivo de audio: entra en el pad ${free + 1}. Encima de una fila, cambia el sonido de ese pad.`}</div>
      </div>`);
      shownNow = -1; paintNow(true);
      renderRoll();
    }
    const VAL = ['', 'golpe', 'golpe suave'];
    /* fila en modo notas: los pasos muestran dónde empieza cada nota (con su nombre) y lo que dura; tocarla abre el piano roll */
    function melCells(i, ks) {
      const s = seq(), list = PT().mel(s, s.pattern, i), root = rootMidi(i);
      return ks.map((k) => {
        const starts = list.filter((n) => n[0] === k), over = list.some((n) => k > n[0] && k < n[0] + n[1]);
        const top = starts.length ? starts.reduce((a, n) => (n[2] > a[2] ? n : a)) : null;
        return `<button class="sq-st sq-melst${starts.length ? ' v' + top[3] : over ? ' v1 is-tail' : ' v0'}${k % 4 === 0 ? ' is-beat' : ''}${k === shownNow ? ' is-now' : ''}" type="button" role="gridcell" data-s="${k}" aria-label="Paso ${k + 1}${starts.length ? ': ' + starts.map((n) => noteName(root + n[2])).join(', ') : ''}">${top ? `<span class="sq-mn">${noteName(root + top[2], true)}${starts.length > 1 ? '+' : ''}</span>` : ''}</button>`;
      }).join('');
    }

    /* ---------- piano roll ---------- */
    const NN = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Si♭', 'Si'];
    const noteName = (m, short) => { const pc = ((m % 12) + 12) % 12, o = Math.floor(m / 12) - 1; return short ? NN[pc] + o : NN[pc] + ' ' + o; };
    const toMidi = (k) => { const m = /^([A-G]#?)(-?\d)$/.exec(k || ''); return m ? 12 * (+m[2] + 1) + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(m[1]) : null; };
    /* la nota en la que suena el pad sin transponer: la de su sonido de Harmony (con el tono del pad) o, si no se sabe, Do 4 */
    function rootMidi(i) {
      const p = pads()[i], x = p && p.src && p.src.type === 'harmony' && H.Lib ? H.Lib.get(p.src.sampleId) : null;
      const m = x && x.key ? toMidi(x.key) : null;
      return (m == null ? 60 : m) + (p ? p.pitch || 0 : 0);
    }
    const RTOP = 24, RBOT = -24, RH = 16;
    let rollPad = null, newLen = 2, rollDrag = null;
    const colW = () => (touch() ? 22 : 24);
    let rollShown = null;   // qué pad y qué patrón enseñaba el piano roll (para no mover el scroll al repintar el mismo)
    function renderRoll() {
      const box = $('.sq-roll'), s = seq();
      const old = box.querySelector('.sq-roll-scroll'), keepPos = old && rollShown === rollPad + ':' + s.pattern ? { top: old.scrollTop, left: old.scrollLeft } : null;
      if (rollPad == null || !PT().isMel(s, rollPad) || !pads()[rollPad] || !pads()[rollPad].src) { rollPad = null; box.hidden = true; box.innerHTML = ''; return; }
      const i = rollPad, pad = pads()[i], len = s.patterns[s.pattern].len, root = rootMidi(i), W = colW(), sc = s.scale, steps = PT().SCALES[sc.mode].steps;
      box.hidden = false;
      box.innerHTML = `
        <div class="sq-roll-h">
          <div class="sq-roll-t"><p class="mono eyebrow">Piano roll · patrón ${PT().NAMES[s.pattern]}</p><b class="cat-${pad.cat}"><i></i>${e(pad.name || 'Pad ' + (i + 1))}</b><span class="fine">Sin transponer suena en ${noteName(root)}</span></div>
          <div class="sq-roll-ctl">
            <div class="sq-roll-len"><span class="mono">Nota nueva</span><div class="seg" role="group" aria-label="Duración de la nota nueva">${[[1, '1/16'], [2, '1/8'], [4, '1/4'], [8, '1/2'], [16, '1']].map(([v, n]) => `<button type="button" data-sq="rlen" data-v="${v}" aria-pressed="${newLen === v}">${n}</button>`).join('')}</div></div>
            <label class="sel mono"><span>Escala</span><select id="sq-sroot">${NN.map((n, k) => `<option value="${k}"${k === sc.root ? ' selected' : ''}>${n}</option>`).join('')}</select><select id="sq-smode">${Object.entries(PT().SCALES).map(([k, x]) => `<option value="${k}"${k === sc.mode ? ' selected' : ''}>${x.name}</option>`).join('')}</select></label>
            <button class="btn btn-sm" type="button" data-sq="rclear">Vaciar notas</button>
            <button class="btn btn-sm" type="button" data-sq="rclose">Cerrar</button>
          </div>
        </div>
        <div class="sq-roll-scroll">
          <div class="sq-roll-body cat-${pad.cat}" style="--cw:${W}px;--rh:${RH}px;--cols:${len};--rows:${RTOP - RBOT + 1}">
            <div class="sq-roll-keys">${Array.from({ length: RTOP - RBOT + 1 }, (_, r) => { const t = RTOP - r, m = root + t, pc = ((m % 12) + 12) % 12, inS = steps.includes((pc - sc.root + 12) % 12); return `<button type="button" class="sq-rk${[1, 3, 6, 8, 10].includes(pc) ? ' is-black' : ''}${inS ? ' in' : ''}${pc === sc.root ? ' is-tonic' : ''}${t === 0 ? ' is-root' : ''}" data-sq="rkey" data-t="${t}">${noteName(m, true)}</button>`; }).join('')}</div>
            <div class="sq-roll-grid">${Array.from({ length: RTOP - RBOT + 1 }, (_, r) => { const t = RTOP - r, pc = (((root + t) % 12) + 12) % 12, inS = steps.includes((pc - sc.root + 12) % 12); return `<i class="sq-rrow${inS ? ' in' : ''}${pc === sc.root ? ' is-tonic' : ''}" style="top:${r * RH}px"></i>`; }).join('')}<div class="sq-rnotes"></div><i class="sq-rhead" hidden></i></div>
          </div>
        </div>
        <p class="fine sq-roll-help">${touch() ? 'Toca un hueco para poner una nota (con la duración elegida arriba) y toca una nota para quitarla. Desliza para moverte por el piano roll.' : 'Clic en un hueco: nota nueva (arrastra a la derecha para alargarla). Arrastra una nota para moverla de tiempo o de altura; su borde derecho la alarga o acorta; un clic sin mover la quita. Alt+clic: nota suave.'} Las teclas de la izquierda la hacen sonar. Varias notas a la vez suenan juntas (acordes). Las filas claras son la escala elegida.</p>`;
      paintRollNotes();
      const sc2 = box.querySelector('.sq-roll-scroll');
      if (keepPos) { sc2.scrollTop = keepPos.top; sc2.scrollLeft = keepPos.left; }
      else {
        // al abrirlo: a la vista, las notas que haya o la nota del sonido
        const list = PT().mel(s, s.pattern, i), mid = list.length ? list.reduce((a, n) => a + n[2], 0) / list.length : 0;
        sc2.scrollTop = Math.max(0, (RTOP - mid) * RH - sc2.clientHeight / 2);
      }
      rollShown = i + ':' + s.pattern;
      bindRoll(box.querySelector('.sq-roll-grid'));
    }
    function paintRollNotes() {
      const box = $('.sq-roll .sq-rnotes'); if (!box || rollPad == null) return;
      const s = seq(), W = colW(), root = rootMidi(rollPad);
      box.innerHTML = PT().mel(s, s.pattern, rollPad).map((n) => `<b class="sq-rn${n[3] === 2 ? ' is-soft' : ''}" style="left:${n[0] * W}px;top:${(RTOP - n[2]) * RH}px;width:${n[1] * W - 1}px" data-s="${n[0]}" data-t="${n[2]}">${n[1] * W > 34 ? noteName(root + n[2], true) : ''}<i></i></b>`).join('');
    }
    function previewNote(t) { if (rollPad != null && api.previewNote) api.previewNote(rollPad, t); }
    function bindRoll(g) {
      const at = (ev) => { const r = g.getBoundingClientRect(), W = colW(); return { s: Math.floor((ev.clientX - r.left) / W), t: RTOP - Math.floor((ev.clientY - r.top) / RH), x: ev.clientX - r.left }; };
      const clampS = (v) => Math.max(0, Math.min(seq().patterns[seq().pattern].len - 1, v));
      const clampT = (v) => Math.max(RBOT, Math.min(RTOP, v));
      g.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        const s = seq(), p = s.pattern, i = rollPad, c = at(ev), n = PT().melAt(s, p, i, c.s, c.t);
        if (ev.pointerType === 'touch') { rollDrag = { touch: true, x: ev.clientX, y: ev.clientY, c }; return; }
        ev.preventDefault(); g.setPointerCapture(ev.pointerId);
        if (n) {
          const endX = (n[0] + n[1]) * colW();
          rollDrag = c.x > endX - 8 ? { mode: 'size', n: [...n] } : { mode: 'move', n: [...n], ds: c.s - n[0], moved: false };
        } else {
          const s0 = clampS(c.s), t0 = clampT(c.t);
          PT().addMel(s, p, i, s0, newLen, t0, ev.altKey ? 2 : 1);
          rollDrag = { mode: 'size', n: [s0, newLen, t0, ev.altKey ? 2 : 1], fresh: true };
          paintRollNotes(); previewNote(t0);
        }
      });
      g.addEventListener('pointermove', (ev) => {
        if (!rollDrag || rollDrag.touch) return;
        const s = seq(), p = s.pattern, i = rollPad, c = at(ev), d = rollDrag, n = d.n;
        if (d.mode === 'size') {
          const l = Math.max(1, Math.min(s.patterns[p].len - n[0], c.s - n[0] + 1));
          if (l === n[1]) return;
          PT().delMel(s, p, i, n[0], n[2]); PT().addMel(s, p, i, n[0], l, n[2], n[3]); n[1] = l;
        } else {
          const ns = clampS(c.s - d.ds), nt = clampT(c.t);
          if (ns === n[0] && nt === n[2]) return;
          PT().delMel(s, p, i, n[0], n[2]); PT().addMel(s, p, i, ns, Math.min(n[1], s.patterns[p].len - ns), nt, n[3]);
          if (nt !== n[2]) previewNote(nt);
          n[0] = ns; n[2] = nt; d.moved = true;
        }
        paintRollNotes();
      });
      const end = (ev) => {
        const d = rollDrag; rollDrag = null; if (!d) return;
        const s = seq(), p = s.pattern, i = rollPad;
        if (d.touch) {
          if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) return;   // era desplazar
          const c = d.c;
          if (!PT().delMel(s, p, i, c.s, c.t, true)) { PT().addMel(s, p, i, clampS(c.s), newLen, clampT(c.t), 1); previewNote(clampT(c.t)); }
        } else if (d.mode === 'move' && !d.moved) PT().delMel(s, p, i, d.n[0], d.n[2]);
        // solo las notas y la fila del pad: el piano roll no se rehace (ni se mueve)
        paintRollNotes(); save(); paintRow(i); renderBar();
      };
      g.addEventListener('pointerup', end);
      g.addEventListener('pointercancel', () => { rollDrag = null; });
    }
    function paintRollHead(k) {
      const h = $('.sq-roll .sq-rhead'); if (!h) return;
      h.hidden = k < 0; if (k >= 0) h.style.left = k * colW() + 'px';
    }
    /* Cómo se ve cada paso de una fila: el golpe y la cola de la nota.
       Con duración, la cola es la nota (sólida); sin ella, se ve en tenue lo que dura el sonido entero.
       El asa (para alargar o acortar con el ratón) va en el último paso de la nota. */
    function rowState(i) {
      const s = seq(), p = s.pattern, len = s.patterns[p].len, row = PT().row(s, p, i), pad = pads()[i];
      const st = Array.from({ length: PT().MAX }, (_, k) => ({ v: +row[k] || 0, tail: 0, of: -1, grip: false }));
      const d = pad && pad.src ? H.PadAudio.duration(pad.src) : null;
      const natural = d ? Math.max(1, Math.ceil((d * (pad.end - pad.start)) / Math.pow(2, (pad.pitch || 0) / 12) / PT().stepDur(s.bpm) - 0.15)) : 1;
      const notes = PT().notes(s, p, i).filter((n) => n.s < len);
      notes.forEach((n, j) => {
        const next = j + 1 < notes.length ? notes[j + 1].s : len;
        const span = Math.max(1, Math.min(n.n || natural, next - n.s, len - n.s));
        for (let k = n.s + 1; k < n.s + span; k++) { st[k].tail = n.n ? 1 : 2; st[k].of = n.s; st[k].v = st[n.s].v; }
        st[n.s + span - 1].grip = true; st[n.s + span - 1].of = n.s; st[n.s + span - 1].timed = !!n.n;
      });
      return st;
    }
    function cellCls(k, c) {
      return `sq-st v${c.v}${k % 4 === 0 ? ' is-beat' : ''}${c.tail === 1 ? ' is-tail' : c.tail === 2 ? ' is-ghost' : ''}${c.grip && c.tail ? ' is-end' : ''}${k === shownNow ? ' is-now' : ''}`;
    }
    function cellLabel(name, k, c) {
      return `${name}, paso ${k + 1}${c.tail ? ': sigue la nota del paso ' + (c.of + 1) : c.v ? ': ' + VAL[c.v] : ''}`;
    }
    const grip = (c) => (c.grip ? `<i class="sq-grip${c.timed ? ' is-timed' : ''}" data-of="${c.of}" title="Arrastra para alargar o acortar la nota · doble clic: que suene entera"></i>` : '');
    function cell(name, k, c) {
      const on = c.v > 0 && !c.tail;
      return `<button class="${cellCls(k, c)}" type="button" role="gridcell" data-s="${k}" aria-pressed="${on}" aria-label="${e(cellLabel(name, k, c))}">${grip(c)}</button>`;
    }
    /* repinta una fila entera (una nota cambia también los pasos de su cola) */
    function paintRow(i) {
      const r = grid.querySelector(`.sq-row[data-i="${i}"]`); if (!r) return;
      if (PT().isMel(seq(), i)) { const a0 = bar * PT().BAR; r.querySelector('.sq-steps').innerHTML = melCells(i, Array.from({ length: PT().BAR }, (_, j) => a0 + j)); return; }
      const st = rowState(i), pad = pads()[i], name = pad.name || 'Pad ' + (i + 1);
      r.querySelectorAll('.sq-st').forEach((b) => {
        const k = +b.dataset.s, c = st[k];
        b.className = cellCls(k, c);
        b.setAttribute('aria-pressed', c.v > 0 && !c.tail);
        b.setAttribute('aria-label', cellLabel(name, k, c));
        b.innerHTML = grip(c);
      });
    }
    const paintCell = (i) => paintRow(i);

    /* ---------- cabezal: la columna que suena y los pads que golpean ---------- */
    function paintNow(force) {
      const pos = H.Seq.position(), s = seq();
      const k = pos && pos.pat === s.pattern ? pos.step : -1;
      if (k !== shownNow || force) {
        grid.querySelectorAll('.sq-st.is-now, .sq-n.is-now').forEach((x) => x.classList.remove('is-now'));
        const j = k - bar * PT().BAR;   // la columna, si ese paso está en el compás a la vista
        if (k >= 0 && j >= 0 && j < PT().BAR) grid.querySelectorAll(`.sq-st[data-s="${k}"], .sq-ruler .sq-n:nth-child(${j + 1})`).forEach((x) => x.classList.add('is-now'));
        shownNow = k;
        paintRollHead(k);
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
        for (const kk of Object.keys(pt.rows)) if (+pt.rows[kk][m.step] && PT().audible(s, +kk) && !PT().isMel(s, +kk)) api.flash(+kk);
        for (const i of s.melodic) if (PT().audible(s, i) && (pt.mel[i] || []).some((n) => n[0] === m.step)) api.flash(i);
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
      paintRow(i);
    }
    /* alargar o acortar una nota con el ratón, arrastrando su asa */
    let sizing = null;
    function sizeTo(ev) {
      const t = document.elementFromPoint(ev.clientX, ev.clientY), b = t && t.closest && t.closest('.sq-st');
      if (!b || !grid.contains(b) || +b.closest('.sq-row').dataset.i !== sizing.i) return;
      const k = +b.dataset.s, n = Math.max(1, k - sizing.s + 1);
      if (n === sizing.n) return;
      sizing.n = PT().setNoteLen(seq(), seq().pattern, sizing.i, sizing.s, n);
      paintRow(sizing.i);
      b.closest('.sq-row').classList.add('is-sizing');
    }
    grid.addEventListener('dblclick', (ev) => {
      const g = ev.target.closest('.sq-grip'); if (!g) return;
      const i = +g.closest('.sq-row').dataset.i, s0 = +g.dataset.of;
      PT().setNoteLen(seq(), seq().pattern, i, s0, 0); paintRow(i); save();
      U.toast('Nota entera: suena el sonido completo');
    });
    grid.addEventListener('contextmenu', (ev) => { if (ev.target.closest('.sq-st')) ev.preventDefault(); });
    /* abrir el piano roll de un pad en modo notas, con el paso k a la vista */
    function openRoll(i, k) {
      const same = rollPad === i;
      rollPad = i; if (!same) rollShown = null;
      renderGrid();
      const sc = $('.sq-roll-scroll'); if (sc && k != null) sc.scrollLeft = Math.max(0, k * colW() - 60);
      const box = $('.sq-roll'); if (box && box.scrollIntoView) box.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
    grid.addEventListener('pointerdown', (ev) => {
      // en una fila en modo notas, los pasos abren su piano roll
      const mc = ev.target.closest('.sq-melst');
      if (mc) { if (ev.pointerType !== 'touch') ev.preventDefault(); openRoll(+mc.closest('.sq-row').dataset.i, +mc.dataset.s); return; }
      const gr = ev.target.closest('.sq-grip');
      if (gr && ev.pointerType !== 'touch' && ev.button === 0) {
        ev.preventDefault();
        const i = +gr.closest('.sq-row').dataset.i;
        sizing = { i, s: +gr.dataset.of, n: PT().noteLen(seq(), seq().pattern, i, +gr.dataset.of) };
        return;
      }
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
      if (sizing) { sizeTo(ev); return; }
      if (!painting) return;
      const t = document.elementFromPoint(ev.clientX, ev.clientY), b = t && t.closest && t.closest('.sq-st');
      if (!b || !grid.contains(b)) return;
      const i = +b.closest('.sq-row').dataset.i, k = +b.dataset.s, id = i + ':' + k;
      if (painting.seen.has(id)) return;
      painting.seen.add(id); edit(i, k, painting.value);
    });
    const endPaint = () => {
      if (sizing) { const r = grid.querySelector(`.sq-row[data-i="${sizing.i}"]`); if (r) r.classList.remove('is-sizing'); sizing = null; save(); }
      if (painting) { painting = null; save(); renderBar(); }
    };
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
      if (b.classList.contains('sq-melst')) { openRoll(+b.closest('.sq-row').dataset.i, +b.dataset.s); return; }
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
      else if (a === 'mel') {
        const on = !PT().isMel(s, i); PT().setMel(s, i, on); save();
        if (on) { openRoll(i, 0); U.toast(`${pads()[i].name || 'Pad ' + (i + 1)} en modo notas: escribe la melodía en el piano roll (sus golpes se guardan)`); }
        else { if (rollPad === i) rollPad = null; renderGrid(); }
        renderBar();
      }
      else if (a === 'roll') openRoll(i, 0);
      else if (a === 'rlen') { newLen = +b.dataset.v; el.querySelectorAll('[data-sq="rlen"]').forEach((x) => x.setAttribute('aria-pressed', +x.dataset.v === newLen)); }
      else if (a === 'rclose') { rollPad = null; renderGrid(); }
      else if (a === 'rclear') { if (rollPad != null) { PT().clearMel(s, s.pattern, rollPad); save(); renderGrid(); renderBar(); U.toast(`Notas del patrón ${PT().NAMES[s.pattern]} vaciadas`); } }
      else if (a === 'rkey') previewNote(+b.dataset.t);
      else if (a === 'mute' || a === 'solo') { PT().flag(s, a, i); save(); renderGrid(); }
      else if (a === 'kit') kit(b.dataset.kit);
      else if (a === 'preset') preset(b.dataset.preset);
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
      else if (t.id === 'sq-sroot' || t.id === 'sq-smode') { s.scale = { root: +$('#sq-sroot').value, mode: $('#sq-smode').value }; save(); renderRoll(); }
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
      else if (v.startsWith('preset:')) preset(v.slice(7));
    }
    function preset(id) { bar = 0; if (api.newBankFromPreset(id)) render(); }
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

    // al cargar un sonido se sabe cuánto dura: su cola tenue ya se puede dibujar
    U.on('pads:load', () => { if (el.isConnected && !painting && !sizing) rowIdx().forEach(paintRow); });
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
