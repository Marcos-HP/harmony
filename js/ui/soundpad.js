/* HARMONY · Soundpad: interfaz de los pads
   Modelo en js/lib/banks.js, guardado en js/lib/padstore.js y audio en js/audio/pads.js: aquí solo se pinta y se escucha.
   Los pads se disparan al apretar (pointerdown), no al soltar: es lo que da sensación de instrumento. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;
  const B = () => H.Banks;

  const SP = (H.Soundpad = { visible: false });
  let backToSeq = -1, root, st, sel = 0, capture = null, armDelete = null, armClear = null, renaming = false, catOpen = false, catQ = '', raf = 0, tab = 'pad', libPanel = null, seqPanel = null;
  const els = {};

  /* El estado se carga la primera vez que alguien lo pide (el Soundpad o la página de sonidos) */
  function state() {
    if (!st) { st = H.PadStore.loadState(); H.PadAudio.setVolume(st.master); }
    return st;
  }
  const bank = () => B().current(state());
  const vkey = (i) => bank().id + ':' + i;
  const keyLabel = (k) => (k ? k.toUpperCase() : '—');
  const catName = (id) => (B().CATS.find((c) => c.id === id) || {}).name || 'Otro';
  const save = () => H.PadStore.saveState(st);
  const AUDIO_EXT = /\.(mp3|wav|wave|ogg|oga|opus|flac|m4a|aac|webm|aif|aiff|caf)$/i;
  const isAudio = (f) => f && ((f.type && f.type.startsWith('audio/')) || AUDIO_EXT.test(f.name || ''));

  function srcText(p) {
    if (!p.src) return 'Sin sonido';
    if (p.src.type === 'file') return 'Archivo tuyo · ' + p.src.fileName;
    if (p.src.type === 'harmony') { const x = H.Lib.get(p.src.sampleId); return x ? `Harmony · ${x.name} · ${x.pack.name}, ${x.pack.license === 'CC0-1.0' ? 'CC0' : x.pack.licenseName}` : 'Harmony · sonido desaparecido'; }
    const t = H.A.t[p.src.trackId];
    return t ? 'Catálogo · ' + t.title + ' — ' + t.artistLine + ' (muestra de Deezer)' : 'Catálogo · registro desaparecido';
  }
  const semis = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n) + ' st';
  const fxShort = (p) => [p.pitch ? semis(p.pitch) : '', p.start > 0 || p.end < 1 ? 'recorte' : '', p.reverse ? 'al revés' : '', p.choke ? 'g' + p.choke : ''].filter(Boolean).map((x) => ' · ' + x).join('');
  const srcShort = (p) => (!p.src ? '' : p.src.type === 'file' ? 'tuyo' : p.src.type === 'harmony' ? 'harmony' : 'catálogo');
  const SRC_BADGE = { file: 'Tuyo', harmony: 'Harmony', catalog: 'Deezer' };

  /* ---------- estructura ---------- */
  SP.build = function (container) {
    root = container;
    state();
    root.innerHTML = `
      <div class="sp wrap">
        <header class="sp-head">
          <div class="sp-title">
            <p class="mono eyebrow"><span class="sp-bname"></span> <span class="sp-pers"></span></p>
            <h1 class="sp-h">Soundpad</h1>
          </div>
          <div class="sp-ctl">
          <div class="sp-bank">
            <div class="sp-bank-pick"></div>
            <div class="sp-bank-acts">
              <button class="btn btn-sm" type="button" data-sp="bank-new">${U.icon('plus')}<span>Nuevo</span></button>
              <button class="btn btn-sm" type="button" data-sp="bank-dup">Duplicar</button>
              <button class="btn btn-sm" type="button" data-sp="bank-ren">Renombrar</button>
              <button class="btn btn-sm" type="button" data-sp="bank-clear" title="Quita el sonido de los 16 pads">${U.icon('grid')}<span>Vaciar</span></button>
              <button class="btn btn-sm" type="button" data-sp="bank-del">${U.icon('trash')}<span>Eliminar</span></button>
            </div>
          </div>
          <div class="sp-master">
            <div class="sp-file-acts">
              <button class="btn btn-sm" type="button" data-sp="export" title="Descarga el banco con tus archivos para llevarlo a otro navegador">Exportar</button>
              <button class="btn btn-sm" type="button" data-sp="export-all" title="Descarga todos tus bancos">Exportar todos</button>
              <button class="btn btn-sm" type="button" data-sp="import">Importar</button>
            </div>
            <label class="sp-vol mono"><span>Volumen</span><input type="range" id="sp-vol" min="0" max="1" step="0.01" aria-label="Volumen del Soundpad"></label>
            <button class="btn btn-solid" type="button" data-sp="stop-all">${U.icon('stop')}<span>Detener todo</span></button>
          </div>
          </div>
        </header>
        <div class="sp-body">
          <div class="sp-grid" role="group"></div>
          <aside class="sp-side">
            <div class="seg sp-tabs" role="tablist" aria-label="Panel">
              <button type="button" role="tab" data-sp="tab" data-tab="pad" aria-selected="true">Pad</button>
              <button type="button" role="tab" data-sp="tab" data-tab="lib" aria-selected="false">Biblioteca de Harmony</button>
            </div>
            <div class="sp-edit" role="tabpanel" aria-label="Opciones del pad"></div>
            <div class="sp-lib" role="tabpanel" aria-label="Biblioteca de Harmony" hidden></div>
          </aside>
        </div>
        <section class="sq" aria-label="Secuenciador"></section>
        <p class="fine sp-note"></p>
        <input type="file" id="sp-file" accept="audio/*,.mp3,.wav,.ogg,.opus,.flac,.m4a,.aac,.webm" hidden>
        <input type="file" id="sp-import" accept=".json,application/json" hidden>
      </div>`;
    els.grid = root.querySelector('.sp-grid');
    els.edit = root.querySelector('.sp-edit');
    els.lib = root.querySelector('.sp-lib');
    els.side = root.querySelector('.sp-side');
    els.pick = root.querySelector('.sp-bank-pick');
    els.pers = root.querySelector('.sp-pers');
    els.note = root.querySelector('.sp-note');
    els.vol = root.querySelector('#sp-vol');
    els.file = root.querySelector('#sp-file');
    els.vol.value = st.master;
    els.vol.oninput = () => { st.master = +els.vol.value; H.PadAudio.setVolume(st.master); save(); };
    els.file.onchange = () => { const f = els.file.files && els.file.files[0]; els.file.value = ''; if (f) assignFile(sel, f); };
    els.imp = root.querySelector('#sp-import');
    els.imp.onchange = () => { const f = els.imp.files && els.imp.files[0]; els.imp.value = ''; if (f) importFile(f); };

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onFieldKey);
    // disparo al apretar: ratón, lápiz o dedo
    els.grid.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const hit = ev.target.closest('.pad-hit');
      if (!hit) return;
      const i = +hit.closest('.pad').dataset.i;
      if (!bank().pads[i].src) return;   // vacío: el click abre sus opciones
      ev.preventDefault();
      hit.focus({ preventScroll: true });
      fire(i);
    });
    els.grid.addEventListener('contextmenu', (ev) => { if (ev.target.closest('.pad-hit')) ev.preventDefault(); });
    // arrastrar un archivo de audio a un pad
    els.grid.addEventListener('dragover', (ev) => { const p = ev.target.closest('.pad'); if (!p) return; ev.preventDefault(); p.classList.add('is-drop'); });
    els.grid.addEventListener('dragleave', (ev) => { const p = ev.target.closest('.pad'); if (p && !p.contains(ev.relatedTarget)) p.classList.remove('is-drop'); });
    els.grid.addEventListener('drop', (ev) => {
      const p = ev.target.closest('.pad'); if (!p) return;
      ev.preventDefault(); p.classList.remove('is-drop');
      const sid = ev.dataTransfer.getData('text/x-harmony-sample');
      if (sid) { assignSample(+p.dataset.i, sid); return; }
      const f = [...(ev.dataTransfer.files || [])].find(isAudio);
      if (f) { sel = +p.dataset.i; assignFile(sel, f); } else U.toast('Eso no parece un archivo de audio');
    });

    // secuenciador: una fila por pad con sonido (js/ui/seqpanel.js)
    seqPanel = H.SeqPanel(root.querySelector('.sq'), {
      bank, save: () => save(), fire, flash,
      addToFreePad: (src, o) => SP.addToFreePad(src, o),
      refreshPads: () => render(),
      assignSample: (i, id) => assignSample(i, id),
      assignFile: (i, f) => { sel = i; assignFile(i, f); },
      // abre la biblioteca de Harmony apuntando a ese pad (lo que se añada desde ahí va a él)
      openLibrary: (i) => {
        select(i, { toPad: false }); setTab('lib');
        backToSeq = i;   // al elegir el sonido, de vuelta a su fila del secuenciador
        els.side.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        if (libPanel) setTimeout(() => libPanel.focus(), 350);
        U.toast(`Elige un sonido: irá al pad ${i + 1}`);
      }
    });

    U.on('pads:voice', paintStates);
    U.on('pads:load', () => { paintStates(); if (SP.visible) { renderEditSource(); drawWave(); } });
    H.PadStore.ready().then(renderNote);
    render();
  };

  /* ---------- mostrar / ocultar (lo gestiona H.Sections) ---------- */
  SP.show = function () {
    SP.visible = true;
    preload();
    render();
    tick();
  };
  SP.hide = function () { SP.visible = false; capture = null; renderKeyRow(); };

  function preload() { bank().pads.forEach((p) => { if (p.src) H.PadAudio.load(p.src).catch(() => {}); }); }

  /* ---------- disparo ---------- */
  function fire(i) {
    const p = bank().pads[i];
    if (!p.src) { select(i); return; }
    const el = padEl(i);
    if (el) { el.classList.remove('is-hit'); void el.offsetWidth; el.classList.add('is-hit'); }
    H.PadAudio.trigger(vkey(i), p, { choke: B().chokeMates(bank(), i).map(vkey) }).catch((err) => { paintStates(); U.toast(`${p.name || 'Pad ' + (i + 1)}: ${H.PadAudio.message(err)}`); });
    tick();
    // grabando con el secuenciador en marcha: el golpe entra en el paso más cercano
    if (H.Seq.recording()) { const n = H.Seq.record(i); if (n) { save(); seqPanel.recorded(n, i); } }
  }
  /* el secuenciador ilumina el pad cuando suena su golpe */
  function flash(i) {
    if (!SP.visible) return;
    const el = padEl(i); if (!el) return;
    el.classList.remove('is-hit'); void el.offsetWidth; el.classList.add('is-hit');
  }
  function tick() {
    if (raf) return;
    const loop = () => {
      raf = 0;
      if (!SP.visible) return;
      bank().pads.forEach((p, i) => { const el = padEl(i); if (el) el.style.setProperty('--p', H.PadAudio.progress(vkey(i)).toFixed(3)); });
      if (H.PadAudio.anyPlaying()) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  /* Teclado (lo llama app.js antes que los atajos globales mientras el Soundpad está a la vista). true = atendida */
  SP.key = function (ev) {
    if (!SP.visible) return false;
    if (capture != null) {
      if (ev.key === 'Escape') { capture = null; renderKeyRow('Cambio de tecla cancelado.'); return true; }
      const k = B().keyOf(ev.key);
      if (!k) { renderKeyRow('Esa tecla no se puede usar: elige una letra, un número o un signo.'); return true; }
      const i = capture; capture = null;
      const r = B().setKey(bank(), i, k);
      save(); renderGrid(); renderEdit();
      renderKeyRow(r.from != null ? `La tecla ${keyLabel(k)} era del pad ${r.from + 1}, que se queda sin tecla.` : `Tecla ${keyLabel(k)} asignada.`);
      return true;
    }
    const i = B().padByKey(bank(), ev.key);
    if (i < 0) return false;
    if (!ev.repeat) fire(i);
    return true;
  };
  SP.capturing = () => capture != null;

  /* ---------- asignaciones ---------- */
  async function assignFile(i, f) {
    if (!isAudio(f)) { U.toast('Eso no parece un archivo de audio (MP3, WAV, OGG, FLAC, M4A…)'); return; }
    const b = bank(), p = b.pads[i];
    H.PadAudio.stop(vkey(i));
    let id;
    try { id = await H.PadStore.putFile(f); }
    catch (err) { U.toast('No se ha podido guardar el archivo en este navegador.'); return; }
    const old = p.src;
    p.src = { type: 'file', fileId: id, fileName: f.name || 'archivo' };
    B().setTrim(p, 0, 1);   // el recorte era del sonido anterior
    if (!p.name || (old && autoName(old) === p.name)) p.name = autoName(p.src);
    save(); render();
    H.PadAudio.load(p.src).catch(() => {});
    tidy();
    renderNote();
  }
  function assignTrack(i, id) {
    const t = H.A.t[id]; if (!t) return;
    const p = bank().pads[i], old = p.src;
    H.PadAudio.stop(vkey(i));
    p.src = { type: 'catalog', trackId: id };
    B().setTrim(p, 0, 1);
    if (!p.name || (old && autoName(old) === p.name)) p.name = autoName(p.src);
    if (p.cat === 'otro') p.cat = 'tema';
    catOpen = false;
    save(); render();
    H.PadAudio.load(p.src).catch(() => {});
    tidy();
  }
  function autoName(src) {
    if (!src) return '';
    if (src.type === 'file') return src.fileName.replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 40);
    if (src.type === 'harmony') { const x = H.Lib.get(src.sampleId); return x ? x.name.slice(0, 40) : ''; }
    const t = H.A.t[src.trackId]; return t ? t.title.slice(0, 40) : '';
  }
  /* Borra del navegador los archivos que ya no usa ningún pad de ningún banco */
  const tidy = U.debounce(() => { H.PadStore.saveNow(st); H.PadStore.prune(B().fileIds(st)); }, 600);

  /* ---------- acciones ---------- */
  /* Elegir un pad. Desde la biblioteca (pestaña abierta), elegir un pad vacío lo hace destino sin cambiar de pestaña */
  function select(i, { toPad = true } = {}) {
    sel = i; capture = null; catOpen = false; catQ = '';
    renderGrid(); renderEdit();
    if (toPad) setTab('pad'); else paintTabs();
    if (libPanel) libPanel.refresh();
    if (window.matchMedia('(max-width: 900px)').matches) els.side.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function setTab(t) {
    tab = t === 'lib' ? 'lib' : 'pad';
    if (tab === 'lib' && !libPanel) {
      libPanel = H.LibPanel(els.lib, { idPrefix: 'splib', addLabel: () => 'Al pad ' + (sel + 1), onAdd: (x) => assignSample(sel, x.id), empty: 'Nada coincide con la búsqueda.' });
    }
    els.edit.hidden = tab !== 'pad'; els.lib.hidden = tab !== 'lib';
    paintTabs();
  }
  function paintTabs() {
    els.side.querySelectorAll('[data-sp="tab"][role="tab"]').forEach((b) => {
      b.setAttribute('aria-selected', b.dataset.tab === tab);
      if (b.dataset.tab === 'pad') b.textContent = 'Pad ' + (sel + 1);
    });
  }
  function assignSample(i, id) {
    const x = H.Lib.get(id); if (!x) return;
    const p = bank().pads[i];
    H.PadAudio.stop(vkey(i));
    p.src = { type: 'harmony', sampleId: id };
    p.name = x.name.slice(0, 40); p.cat = x.cat;
    p.mode = x.loop ? 'loop' : 'shot';   // un bucle de la biblioteca entra en modo bucle
    B().setTrim(p, 0, 1);
    sel = i;
    save(); renderGrid(); renderEdit(); paintTabs();
    if (libPanel) libPanel.refresh();
    H.PadAudio.load(p.src).catch(() => {});
    tidy();
    U.toast(`${U.q(x.name)} en el pad ${i + 1}${p.key ? ' (tecla ' + keyLabel(p.key) + ')' : ''}`);
    if (backToSeq === i) {
      backToSeq = -1;
      requestAnimationFrame(() => { const r = root.querySelector(`.sq-row[data-i="${i}"]`); if (r) r.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'center' }); });
    }
  }

  function onClick(ev) {
    const opt = ev.target.closest('.pad-opt');
    if (opt) { select(+opt.closest('.pad').dataset.i); return; }
    const hit = ev.target.closest('.pad-hit');
    if (hit) {
      const i = +hit.closest('.pad').dataset.i;
      if (!bank().pads[i].src) select(i, { toPad: tab !== 'lib' });
      else if (ev.detail === 0) fire(i);   // Intro o espacio con el foco en el pad (el ratón ya disparó al apretar)
      return;
    }
    const b = ev.target.closest('[data-sp]');
    if (!b) return;
    const a = b.dataset.sp, p = bank().pads[sel];
    if (a === 'stop-all') { H.Seq.stop(); H.PadAudio.stopAll(); U.toast('Soundpad en silencio'); }
    else if (a === 'bank-new') { H.Seq.stop(); const nb = B().add(st); save(); preload(); sel = 0; render(); U.toast('Banco nuevo: ' + nb.name); }
    else if (a === 'bank-dup') { H.Seq.stop(); const nb = B().duplicate(st, st.current); save(); sel = 0; render(); U.toast('Copia: ' + nb.name); }
    else if (a === 'bank-ren') { renaming = true; renderBank(); const i = els.pick.querySelector('input'); i.focus(); i.select(); }
    else if (a === 'bank-ren-ok') finishRename(true);
    else if (a === 'bank-ren-cancel') finishRename(false);
    else if (a === 'bank-clear') {
      const bk = bank();
      if (!bk.pads.some((p) => p.src)) { U.toast('Este banco ya está vacío'); return; }
      // como al eliminar: el primer toque pregunta y el segundo vacía
      if (armClear !== bk.id) { armClear = bk.id; armDelete = null; renderBank(); setTimeout(() => { if (armClear) { armClear = null; renderBank(); } }, 4000); return; }
      armClear = null;
      H.Seq.stop();
      bk.pads.forEach((_, i) => H.PadAudio.stop(bk.id + ':' + i));
      const n = B().clearBank(bk);
      save(); tidy(); sel = 0; catOpen = false; render(); renderNote();
      U.toast(`«${bk.name}» vacío: ${n} ${n === 1 ? 'pad' : 'pads'} sin sonido. Las teclas y el tempo se quedan.`);
    }
    else if (a === 'bank-del') {
      if (st.banks.length < 2) { U.toast('Tiene que quedar al menos un banco'); return; }
      if (armDelete !== st.current) { armDelete = st.current; armClear = null; renderBank(); setTimeout(() => { if (armDelete) { armDelete = null; renderBank(); } }, 4000); return; }
      const gone = bank();
      H.Seq.stop();
      gone.pads.forEach((_, i) => H.PadAudio.stop(gone.id + ':' + i));
      B().remove(st, gone.id); armDelete = null;
      save(); tidy(); preload(); sel = 0; render(); U.toast('Banco eliminado: ' + gone.name);
    }
    else if (a === 'file') els.file.click();
    else if (a === 'cat-toggle') { catOpen = !catOpen; renderEditSource(); if (catOpen) { const q = els.edit.querySelector('#sp-q'); if (q) q.focus(); } }
    else if (a === 'cat-pick') assignTrack(sel, b.dataset.id);
    else if (a === 'cat') { p.cat = b.dataset.cat; save(); renderGrid(); renderEdit(); }
    else if (a === 'mode') { p.mode = b.dataset.mode; H.PadAudio.stop(vkey(sel)); save(); renderGrid(); renderEdit(); }
    else if (a === 'key') { capture = sel; renderKeyRow(); }
    else if (a === 'key-clear') { B().setKey(bank(), sel, null); capture = null; save(); renderGrid(); renderEdit(); renderKeyRow('El pad se queda sin tecla.'); }
    else if (a === 'play') fire(sel);
    else if (a === 'stop') H.PadAudio.stop(vkey(sel));
    else if (a === 'clear') { H.PadAudio.stop(vkey(sel)); B().clearPad(bank(), sel); save(); tidy(); render(); }
    else if (a === 'tab') setTab(b.dataset.tab);
    else if (a === 'rev') { p.reverse = !p.reverse; H.PadAudio.stop(vkey(sel)); save(); renderGrid(); renderFx(); }
    else if (a === 'choke') { p.choke = +b.dataset.g; save(); renderGrid(); renderFx(); }
    else if (a === 'fx-reset') { B().resetFx(p); H.PadAudio.stop(vkey(sel)); save(); renderGrid(); renderFx(); }
    else if (a === 'export') exportBanks([bank()]);
    else if (a === 'export-all') exportBanks(st.banks);
    else if (a === 'import') els.imp.click();
    else if (a === 'retry') { H.PadAudio.forget(p.src); H.PadAudio.load(p.src).catch(() => {}); }
  }
  function onChange(ev) {
    if (ev.target.id === 'sp-bank') { H.Seq.stop(); capture = null; armDelete = null; armClear = null; B().select(st, ev.target.value); save(); preload(); sel = 0; render(); }
  }
  function onInput(ev) {
    const t = ev.target, p = bank().pads[sel];
    if (t.id === 'sp-name') { p.name = t.value.slice(0, 40); save(); renderGrid(); }
    else if (t.id === 'sp-pvol') { p.volume = +t.value; H.PadAudio.setVoiceVolume(vkey(sel), p.volume); els.edit.querySelector('#sp-pvol-o').textContent = Math.round(p.volume * 100) + ' %'; save(); }
    else if (t.id === 'sp-q') { catQ = t.value; renderCatList(); }
    else if (t.id === 'sp-start' || t.id === 'sp-end') {
      const a = +els.edit.querySelector('#sp-start').value, z = +els.edit.querySelector('#sp-end').value;
      if (t.id === 'sp-start') B().setTrim(p, Math.min(a, p.end - 0.01), p.end); else B().setTrim(p, p.start, Math.max(z, p.start + 0.01));
      save(); paintFx(); renderGrid();
    }
    else if (t.id === 'sp-pitch') { p.pitch = +t.value; H.PadAudio.setVoiceRate(vkey(sel), p.pitch); save(); paintFx(); renderGrid(); }
  }
  function onFieldKey(ev) {
    if (ev.target.id === 'sp-bank-name') { if (ev.key === 'Enter') { ev.preventDefault(); finishRename(true); } else if (ev.key === 'Escape') { ev.stopPropagation(); finishRename(false); } }
  }
  function finishRename(ok) {
    const i = els.pick.querySelector('input');
    if (ok && i) B().rename(st, st.current, i.value);
    renaming = false; save(); renderBank(); renderGridLabel();
  }

  /* ---------- pintado ---------- */
  function render() { if (!root) return; renderBank(); renderGrid(); renderEdit(); paintTabs(); }

  function renderBank() {
    const bk = bank();
    els.pick.innerHTML = renaming
      ? `<label class="sel mono sp-ren"><span>Nombre</span><input id="sp-bank-name" value="${e(bk.name)}" maxlength="40" autocomplete="off"></label>
         <button class="btn btn-sm btn-solid" type="button" data-sp="bank-ren-ok">Guardar</button><button class="btn btn-sm" type="button" data-sp="bank-ren-cancel">Cancelar</button>`
      : `<label class="sel mono"><span>Banco</span><select id="sp-bank">${st.banks.map((b) => `<option value="${e(b.id)}"${b.id === bk.id ? ' selected' : ''}>${e(b.name)}</option>`).join('')}</select></label>`;
    root.querySelector('.sp-bank-acts').hidden = renaming;
    root.querySelector('.sp-bname').textContent = bk.name + ' · ' + bk.pads.filter((p) => p.src).length + ' de 16 pads con sonido';
    const clr = root.querySelector('[data-sp="bank-clear"]'), used = bk.pads.some((p) => p.src);
    clr.innerHTML = armClear === bk.id ? `${U.icon('grid')}<span>¿Vaciar los 16 pads?</span>` : `${U.icon('grid')}<span>Vaciar</span>`;
    clr.classList.toggle('btn-warn', armClear === bk.id);
    clr.disabled = !used;
    clr.title = used ? 'Quita el sonido de los 16 pads (las teclas y el tempo se quedan)' : 'El banco ya está vacío';
    const del = root.querySelector('[data-sp="bank-del"]');
    del.innerHTML = armDelete === bk.id ? `${U.icon('trash')}<span>¿Eliminar «${e(bk.name)}»?</span>` : `${U.icon('trash')}<span>Eliminar</span>`;
    del.classList.toggle('btn-warn', armDelete === bk.id);
    del.disabled = st.banks.length < 2;
    del.title = st.banks.length < 2 ? 'Tiene que quedar al menos un banco' : '';
  }
  function renderGridLabel() { els.grid.setAttribute('aria-label', 'Pads del banco ' + bank().name); }

  function padEl(i) { return els.grid.children[i]; }
  function renderGrid() {
    renderGridLabel();
    if (seqPanel) seqPanel.render();
    els.grid.innerHTML = bank().pads.map((p, i) => {
      const empty = !p.src, name = p.name || (empty ? 'Vacío' : autoName(p.src) || 'Pad ' + (i + 1));
      const label = empty ? `Pad ${i + 1} vacío: asignar un sonido` : `Disparar ${name}${p.key ? ', tecla ' + keyLabel(p.key) : ''}${p.mode === 'loop' ? ', en bucle' : ''}`;
      return `<div class="pad cat-${p.cat}${empty ? ' is-empty' : ' src-' + p.src.type}${i === sel ? ' is-sel' : ''}" data-i="${i}">
        <button class="pad-hit" type="button" aria-label="${e(label)}">
          <span class="pad-top"><kbd class="pad-key">${e(keyLabel(p.key))}</kbd><span class="pad-n mono">${String(i + 1).padStart(2, '0')}</span>${p.src ? `<span class="pad-src mono src-${p.src.type}">${SRC_BADGE[p.src.type]}</span>` : ''}</span>
          <span class="pad-name">${e(name)}</span>
          <span class="pad-meta mono">${empty ? 'Toca para asignar' : e(catName(p.cat)) + ' · ' + srcShort(p) + (p.mode === 'loop' ? ' · bucle' : '') + fxShort(p)}</span>
          <span class="pad-bar" aria-hidden="true"></span>
          <span class="pad-spin" aria-hidden="true"></span>
        </button>
        <button class="pad-opt" type="button" aria-label="Opciones del pad ${i + 1}" title="Opciones">${U.icon('dots')}</button>
      </div>`;
    }).join('');
    paintStates();
  }
  function paintStates() {
    if (!els.grid || !els.grid.children.length) return;
    bank().pads.forEach((p, i) => {
      const el = padEl(i); if (!el) return;
      const s = p.src ? H.PadAudio.status(p.src) : null;
      const on = H.PadAudio.isPlaying(vkey(i));
      el.classList.toggle('is-playing', on);
      el.classList.toggle('is-loading', s === 'loading');
      el.classList.toggle('is-error', s === 'error');
      el.title = s === 'error' ? H.PadAudio.error(p.src) : '';
      if (!on) el.style.setProperty('--p', 0);
    });
    if (H.PadAudio.anyPlaying()) tick();
  }

  function renderEdit() {
    const p = bank().pads[sel];
    els.edit.innerHTML = `
      <p class="mono eyebrow">Pad ${sel + 1} · ${e(bank().name)}</p>
      <label class="sp-f"><span class="mono">Nombre</span><input id="sp-name" type="text" maxlength="40" value="${e(p.name)}" placeholder="${e(autoName(p.src) || 'Sin nombre')}" autocomplete="off"></label>
      <div class="sp-f sp-src-f"></div>
      <div class="sp-f"><span class="mono">Categoría</span>
        <div class="sp-cats" role="radiogroup" aria-label="Categoría">${B().CATS.map((c) => `<button type="button" role="radio" class="chip chip-sm sp-cat-b cat-${c.id}" aria-checked="${p.cat === c.id}" data-sp="cat" data-cat="${c.id}"><i></i>${c.name}</button>`).join('')}</div></div>
      <label class="sp-f"><span class="mono">Volumen del pad <output id="sp-pvol-o">${Math.round(p.volume * 100)} %</output></span><input type="range" id="sp-pvol" min="0" max="1" step="0.01" value="${p.volume}"></label>
      <div class="sp-f"><span class="mono">Modo</span>
        <div class="seg sp-modes" role="group" aria-label="Modo de disparo">
          <button type="button" data-sp="mode" data-mode="shot" aria-pressed="${p.mode === 'shot'}">Disparo</button>
          <button type="button" data-sp="mode" data-mode="loop" aria-pressed="${p.mode === 'loop'}">Bucle</button>
        </div>
        <p class="fine">${p.mode === 'loop' ? 'Pulsa para arrancar el bucle y otra vez para pararlo.' : 'Suena entero; si vuelves a pulsar, empieza de nuevo.'}</p></div>
      <div class="sp-f sp-fx"></div>
      <div class="sp-f sp-key-f"></div>
      <div class="sp-acts">
        <button class="btn btn-solid" type="button" data-sp="play"${p.src ? '' : ' disabled'}>${U.icon('play')}<span>${p.mode === 'loop' ? 'Bucle' : 'Probar'}</span></button>
        <button class="btn" type="button" data-sp="stop"${p.src ? '' : ' disabled'}>${U.icon('stop')}<span>Detener</span></button>
        <button class="btn" type="button" data-sp="clear"${p.src ? '' : ' disabled'}>Vaciar pad</button>
      </div>`;
    renderEditSource();
    renderFx();
    renderKeyRow();
  }
  /* ---------- efectos: recorte sobre la forma de onda, tono, al revés y grupo de corte ---------- */
  function renderFx() {
    const box = els.edit && els.edit.querySelector('.sp-fx'); if (!box) return;
    const p = bank().pads[sel], on = !!p.src;
    box.innerHTML = `<span class="mono">Efectos ${B().hasFx(p) ? '<button class="link-btn" type="button" data-sp="fx-reset">Quitar todos</button>' : ''}</span>
      <div class="sp-wave${on ? '' : ' is-off'}"><canvas aria-hidden="true"></canvas><span class="sp-wave-msg mono"></span></div>
      <div class="sp-trimrow">
        <label><span class="mono">Inicio <output id="sp-start-o"></output></span><input type="range" id="sp-start" min="0" max="0.99" step="0.001" value="${p.start}"${on ? '' : ' disabled'}></label>
        <label><span class="mono">Fin <output id="sp-end-o"></output></span><input type="range" id="sp-end" min="0.01" max="1" step="0.001" value="${p.end}"${on ? '' : ' disabled'}></label>
      </div>
      <label class="sp-pitch"><span class="mono">Tono <output id="sp-pitch-o"></output></span><input type="range" id="sp-pitch" min="-12" max="12" step="1" value="${p.pitch}"${on ? '' : ' disabled'} list="sp-pitch-marks"></label>
      <datalist id="sp-pitch-marks"><option value="-12"></option><option value="0"></option><option value="12"></option></datalist>
      <div class="sp-fx-row">
        <button class="chip chip-sm${p.reverse ? ' chip-on' : ''}" type="button" data-sp="rev" aria-pressed="${p.reverse}"${on ? '' : ' disabled'}>Al revés</button>
        <span class="mono sp-choke-l">Grupo de corte</span>
        <div class="seg sp-choke" role="group" aria-label="Grupo de corte">${[0, 1, 2, 3, 4].map((g) => `<button type="button" data-sp="choke" data-g="${g}" aria-pressed="${p.choke === g}" title="${g ? 'Grupo ' + g : 'Sin grupo'}">${g || '—'}</button>`).join('')}</div>
      </div>
      <p class="fine">El tono cambia también la velocidad, como en un sampler. Los pads de un mismo grupo de corte se paran entre sí: el clásico charles abierto y cerrado, o dos voces que no deben pisarse.</p>`;
    paintFx();
  }
  function paintFx() {
    const box = els.edit && els.edit.querySelector('.sp-fx'); if (!box) return;
    const p = bank().pads[sel], dur = p.src ? H.PadAudio.duration(p.src) : null;
    const t = (f) => (dur ? (f * dur).toFixed(2).replace('.', ',') + ' s' : Math.round(f * 100) + ' %');
    box.querySelector('#sp-start-o').textContent = t(p.start);
    box.querySelector('#sp-end-o').textContent = t(p.end);
    box.querySelector('#sp-pitch-o').textContent = semis(p.pitch);
    const w = box.querySelector('.sp-wave');
    w.style.setProperty('--a', p.start); w.style.setProperty('--z', p.end);
    drawWave();
  }
  function drawWave() {
    const box = els.edit && els.edit.querySelector('.sp-wave'); if (!box) return;
    const p = bank().pads[sel], cv = box.querySelector('canvas'), msg = box.querySelector('.sp-wave-msg');
    const s = p.src ? H.PadAudio.status(p.src) : null;
    const pk = s === 'ready' ? H.PadAudio.peaks(p.src, 200, p.reverse) : null;
    msg.textContent = !p.src ? 'Sin sonido' : s === 'loading' ? 'Cargando…' : s === 'error' ? 'No carga' : pk ? '' : '';
    const dpr = window.devicePixelRatio || 1, W = box.clientWidth || 300, Hh = 64;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); cv.style.height = Hh + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    if (!pk) return;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#000', faint = css.getPropertyValue('--ink-3').trim() || '#999';
    const n = pk.length, bw = W / n;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, h = Math.max(1, pk[i] * (Hh - 6));
      g.fillStyle = f >= p.start && f <= p.end ? ink : faint;
      g.fillRect(i * bw, (Hh - h) / 2, Math.max(1, bw - 1), h);
    }
  }

  /* ---------- exportar / importar ---------- */
  async function exportBanks(banks) {
    U.toast('Preparando la exportación…');
    try {
      const r = await H.PadStore.exportBanks(banks);
      const name = 'harmony-' + (banks.length === 1 ? U.norm(banks[0].name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banco' : 'bancos') + '.json';
      const url = URL.createObjectURL(r.blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      U.toast(`${banks.length === 1 ? 'Banco exportado' : banks.length + ' bancos exportados'}: ${r.files} ${r.files === 1 ? 'archivo' : 'archivos'} (${(r.blob.size / 1048576).toFixed(1).replace('.', ',')} MB)${r.missing ? ` · ${r.missing} sin archivo en este navegador` : ''}. Las muestras del catálogo van como referencia.`);
    } catch (err) { U.toast('No se ha podido exportar: ' + err.message); }
  }
  async function importFile(f) {
    U.toast('Importando…');
    try {
      const r = await H.PadStore.importBanks(await f.text());
      const got = B().adopt(st, r.banks, r.fileMap);
      if (!got.length) { U.toast('El archivo no trae ningún banco.'); return; }
      H.Seq.stop(); H.PadStore.saveNow(st); sel = 0; preload(); render(); renderNote();
      U.toast(`${got.length === 1 ? 'Importado: ' + got[0].name : got.length + ' bancos importados'}${r.bad ? ` · ${r.bad} archivos dañados, sus pads quedan vacíos` : ''}`);
    } catch (err) { U.toast(err.message || 'No se ha podido importar.'); }
  }

  /* ---------- para un controlador MIDI (js/lib/midi.js) ---------- */
  SP.hit = (i) => { const p = bank().pads[i]; if (p && p.src) fire(i); };   // un pad vacío en la tabla no hace nada
  SP.stopPad = (i) => H.PadAudio.stop(vkey(i));
  SP.seqToggle = () => seqPanel && seqPanel.toggle();
  SP.recToggle = () => seqPanel && seqPanel.rec();
  SP.padsLit = () => bank().pads.map((p) => !!p.src);
  SP.padPlaying = (i) => H.PadAudio.isPlaying(vkey(i));

  /* ---------- para la página de sonidos de la biblioteca ---------- */
  SP.state = state;
  SP.vkey = (bankId, i) => bankId + ':' + i;
  /* Pone un sonido en el primer pad libre del banco actual. Devuelve { bank, i } o null si está lleno. */
  SP.addToFreePad = function (src, { name = '', cat = 'otro', bankId = null, mode = null } = {}) {
    const b = (bankId && state().banks.find((x) => x.id === bankId)) || bank(), i = b.pads.findIndex((p) => !p.src);
    if (i < 0) return null;
    const p = b.pads[i];
    // un bucle de la biblioteca de Harmony entra en modo bucle
    const smp = src.type === 'harmony' && H.Lib ? H.Lib.get(src.sampleId) : null;
    p.src = src; p.name = name.slice(0, 40); p.cat = cat; p.mode = mode || (smp && smp.loop ? 'loop' : 'shot'); B().setTrim(p, 0, 1);
    H.PadStore.saveNow(st);
    if (root && b === bank()) { sel = i; render(); }
    H.PadAudio.load(src).catch(() => {});
    return { bank: b, i };
  };
  SP.openBank = function (id) { B().select(state(), id); H.PadStore.saveNow(st); sel = 0; if (root) render(); };
  function renderEditSource() {
    const box = els.edit && els.edit.querySelector('.sp-src-f'); if (!box) return;
    const p = bank().pads[sel], s = p.src ? H.PadAudio.status(p.src) : null, dur = p.src ? H.PadAudio.duration(p.src) : null;
    const state = !p.src ? '' : s === 'loading' ? ' · cargando…' : s === 'error' ? '' : dur ? ' · ' + (dur < 60 ? dur.toFixed(1).replace('.', ',') + ' s' : U.fmtTime(dur)) : '';
    const keep = !p.src ? '' : p.src.type === 'harmony' ? 'Sonido original de Harmony: viene con la web, no ocupa espacio en tu navegador.' : p.src.type === 'catalog' ? 'No se guarda: se vuelve a pedir a Deezer en cada sesión.' : H.PadStore.persistent() === false ? 'Solo en esta sesión: este navegador no deja guardar archivos.' : 'Guardado en este navegador; no se sube a ningún sitio.';
    const hadQ = box.querySelector('#sp-q') === document.activeElement;
    box.innerHTML = `<span class="mono">Sonido</span>
      <p class="sp-src">${e(srcText(p))}${state}</p>
      ${s === 'error' ? `<p class="fine sp-err">${e(H.PadAudio.error(p.src))} <button class="link-btn" type="button" data-sp="retry">Reintentar</button></p>` : p.src ? `<p class="fine">${keep}</p>` : ''}
      <div class="chips">
        <button class="chip" type="button" data-sp="file">${U.icon('file')} Archivo de tu equipo</button>
        <button class="chip" type="button" data-sp="tab" data-tab="lib">${U.icon('pads')} Biblioteca de Harmony</button>
        <button class="chip${catOpen ? ' chip-on' : ''}" type="button" data-sp="cat-toggle" aria-expanded="${catOpen}">${U.icon('search')} Muestras del catálogo</button>
      </div>
      ${catOpen ? `<div class="sp-catpick">
        <input type="search" id="sp-q" value="${e(catQ)}" placeholder="Buscar registros con muestra" aria-label="Buscar en el catálogo" autocomplete="off">
        <ul class="sp-list"></ul>
        <p class="fine">Muestras de 30 s de Deezer de los registros que la tienen. Suenan en esta pestaña y no se guardan.</p></div>` : ''}
      <p class="fine sp-drop">También puedes arrastrar un archivo de audio encima del pad.</p>`;
    if (catOpen) { renderCatList(); if (hadQ) { const q = box.querySelector('#sp-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
  function renderCatList() {
    const ul = els.edit.querySelector('.sp-list'); if (!ul) return;
    const q = U.norm(catQ.trim());
    const list = H.A.tracks.filter((t) => t.dz && (!q || t._idx.includes(q))).slice(0, 40);
    ul.innerHTML = list.length ? list.map((t) => `<li><button type="button" data-sp="cat-pick" data-id="${e(t.id)}"><b>${e(t.title)}</b><span>${e(t.artistLine)} · ${t.year != null ? t.year : 's. f.'} · ${e(t.G.name)}</span></button></li>`).join('')
      : `<li class="fine">${H.A.tracks.some((t) => t.dz) ? 'Nada con muestra que coincida.' : 'Ningún registro tiene muestra todavía.'}</li>`;
  }
  function renderKeyRow(msg) {
    const box = els.edit && els.edit.querySelector('.sp-key-f'); if (!box) return;
    const p = bank().pads[sel];
    box.innerHTML = `<span class="mono">Tecla</span>
      <div class="sp-keyrow"><kbd class="sp-kbd">${e(keyLabel(p.key))}</kbd>
        <button class="btn btn-sm${capture === sel ? ' btn-solid' : ''}" type="button" data-sp="key" aria-live="polite">${capture === sel ? 'Pulsa una tecla… (Esc cancela)' : 'Cambiar tecla'}</button>
        <button class="btn btn-sm" type="button" data-sp="key-clear"${p.key ? '' : ' disabled'}>Sin tecla</button></div>
      <p class="fine sp-keymsg" aria-live="polite">${e(msg || '')}</p>`;
  }
  function renderNote() {
    const p = H.PadStore.persistent();
    els.pers.textContent = p === false ? '· solo en esta sesión' : p ? '· se guarda en este navegador' : '';
    els.note.innerHTML = `Teclas por defecto: 1–4, Q–R, A–F y Z–V. Con el Soundpad a la vista, las teclas de los pads mandan sobre los atajos de Harmony.
      Los bancos se guardan en este navegador${p === false ? '; tus archivos, no: este navegador no deja guardarlos y duran hasta que cierres la pestaña' : ', y tus archivos también (IndexedDB): no se suben a ningún sitio'}.
      Las muestras del catálogo son de Deezer, para uso privado: no se guardan y se vuelven a pedir en cada sesión.`;
  }
})();
