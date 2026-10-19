/* HARMONY · Biblioteca › Extractor
   Subes una canción, eliges el tramo y se separa en voz, batería, bajo e instrumentos (js/lib/stems.js, en un worker).
   Luego se escuchan juntas (con solo y silencio por parte), se marca un trozo sobre la onda y se lleva a un pad del
   Soundpad (como archivo tuyo, privado) o se descarga en WAV. La canción y sus partes no salen del navegador; las
   partes viven en memoria hasta recargar la página (lo que mandas a un pad sí se guarda). */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc, X = () => H.Stems;
  const MAX_RANGE = 8 * 60;
  const st = { file: null, buf: null, peaks: null, range: null, job: null, res: null, lanePeaks: {}, sel: null, cursor: 0, loop: true, solo: new Set(), mute: new Set(), cached: null };
  let root = null, play = null, raf = 0;

  const mmss = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t - m * 60); return m + ':' + String(s).padStart(2, '0'); };
  const prec = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2).replace('.', ','); };
  const secs = (t) => t.toFixed(t < 10 ? 2 : 1).replace('.', ',') + ' s';
  const mb = (b) => Math.round(b / 1048576);
  const baseName = () => (st.file ? st.file.name.replace(/\.[a-z0-9]{2,5}$/i, '') : 'cancion').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'cancion';

  H.Views.extractor = function (el) {
    stop();
    root = el;
    root.innerHTML = `
    <section class="page-head wrap xt">
      <p class="mono eyebrow">Biblioteca</p>
      <h1 class="page-title">Extractor</h1>
      <p class="sec-intro">Sube una canción y la separa con IA en <b>voz</b>, <b>batería</b>, <b>bajo</b> e <b>instrumentos</b> (sintes, leads, pads…). Luego marcas un trozo de cualquier parte y te lo llevas a un pad. Todo pasa en tu navegador: la canción no se sube a ningún sitio.</p>
    </section>
    <section class="sec wrap"><div class="xt-song"></div><div class="xt-job" hidden></div></section>
    <section class="sec wrap xt-res" hidden></section>
    <section class="sec wrap"><p class="fine xt-legal">Para practicar y hacerte samples para ti. Lo que saques de una canción sigue siendo de sus autores: publicarlo o repartirlo (o un tema hecho con ello) necesita sus derechos. Por eso las partes se quedan en tu navegador, como tus archivos, y nunca entran en la biblioteca de Harmony. Separación: modelo HTDemucs de Meta (licencia MIT) sobre ONNX Runtime Web, con demucs-web (MIT).</p></section>`;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    // #view es el mismo para todas las vistas: los manejadores son siempre las mismas funciones (no se duplican)
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('drop', onDrop);
    renderSong(); renderJob(); renderRes();
    if (st.cached === null && !X().unsupported()) X().modelCached().then((v) => { st.cached = v; renderSong(); });
  };
  const live = () => root && root.isConnected;
  // al irse de la página, lo que suena se para
  window.addEventListener('hashchange', () => setTimeout(() => { if (!live() || location.hash !== '#extractor') stop(); }, 0));
  function onDragOver(ev) { const d = ev.target.closest && ev.target.closest('.xt-drop'); if (d) { ev.preventDefault(); d.classList.add('is-drop'); } }
  function onDragLeave(ev) { const d = ev.target.closest && ev.target.closest('.xt-drop'); if (d && !d.contains(ev.relatedTarget)) d.classList.remove('is-drop'); }
  function onDrop(ev) { const d = ev.target.closest && ev.target.closest('.xt-drop'); if (!d) return; ev.preventDefault(); d.classList.remove('is-drop'); const f = [...(ev.dataTransfer.files || [])][0]; if (f) load(f); }

  /* ---------- 1. la canción y el tramo ---------- */
  function renderSong() {
    if (!live()) return;
    const box = root.querySelector('.xt-song'), no = X().unsupported(), busy = !!st.job;
    if (!st.buf) {
      box.innerHTML = `<label class="xt-drop${no ? ' is-off' : ''}">
          <input type="file" id="xt-file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus" hidden${no ? ' disabled' : ''}>
          <span class="xt-drop-ic" aria-hidden="true">${U.icon('plus')}</span>
          <b>Elige una canción</b><span class="fine">o arrástrala aquí: MP3, WAV, FLAC, M4A… lo que lea tu navegador</span>
        </label>${no ? `<p class="xt-warn">${e(no)}</p>` : engineLine()}`;
      return;
    }
    const [a, b] = st.range, len = b - a, tooLong = len > MAX_RANGE;
    box.innerHTML = `<div class="xt-card">
        <div class="xt-card-h"><div><p class="mono eyebrow">Canción</p><p class="xt-name">${e(st.file.name)}</p><p class="fine">${mmss(st.buf.duration)} · ${st.buf.numberOfChannels === 1 ? 'mono' : 'estéreo'} · ${Math.round(st.buf.sampleRate / 100) / 10} kHz</p></div>
          <button class="btn btn-sm" type="button" data-xt="other"${busy ? ' disabled' : ''}>Otra canción</button></div>
        <div class="xt-ov" data-lane="ov"><canvas aria-hidden="true"></canvas><i class="xt-sel"></i></div>
        <p class="fine xt-range">Se separa ${a <= 0.01 && b >= st.buf.duration - 0.01 ? 'la canción entera' : 'el tramo marcado'}: de ${mmss(a)} a ${mmss(b)} (${mmss(len)}). Arrastra sobre la onda para quedarte con un trozo; doble clic, entera.${tooLong ? ' <b>Es demasiado largo: marca 8 minutos como mucho.</b>' : ''}</p>
        <div class="xt-acts"><button class="btn btn-solid" type="button" data-xt="go"${busy || tooLong || no ? ' disabled' : ''}>${U.icon('play')}<span>${st.res ? 'Separar otra vez' : 'Separar'}</span></button></div>
        ${st.err ? `<p class="xt-warn" role="alert">${e(st.err)}</p>` : ''}
        ${no ? `<p class="xt-warn">${e(no)}</p>` : engineLine()}
      </div>`;
    drawOv();
    bindSelect(box.querySelector('.xt-ov'), () => st.buf.duration, (r) => { st.range = r; drawOv(); }, () => { st.range = [0, st.buf.duration]; renderSong(); }, true);
  }
  function engineLine() {
    const gpu = X().gpu();
    return `<p class="fine xt-engine">${gpu ? 'Tu navegador tiene <b>WebGPU</b>: separa con la tarjeta gráfica, normalmente bastante más rápido que lo que dura el tramo.' : 'Tu navegador <b>no tiene WebGPU</b>: separará con el procesador, y puede tardar varias veces lo que dura el tramo. En Chrome o Edge de ordenador va mucho más rápido.'}
      ${st.cached ? 'El modelo ya está guardado en este navegador. <button class="link-btn" type="button" data-xt="forget">Borrarlo (172 MB)</button>' : 'La primera vez descarga el modelo (unos 172 MB) y lo guarda para las siguientes.'}</p>`;
  }
  function paintRange() {
    const ov = root.querySelector('.xt-ov'); if (!ov) return;
    const [a, b] = st.range, d = st.buf.duration;
    ov.style.setProperty('--a', a / d); ov.style.setProperty('--b', b / d);
    const p = root.querySelector('.xt-range');
    if (p) p.innerHTML = `Se separa ${a <= 0.01 && b >= d - 0.01 ? 'la canción entera' : 'el tramo marcado'}: de ${mmss(a)} a ${mmss(b)} (${mmss(b - a)}). Arrastra sobre la onda para quedarte con un trozo; doble clic, entera.${b - a > MAX_RANGE ? ' <b>Es demasiado largo: marca 8 minutos como mucho.</b>' : ''}`;
    const go = root.querySelector('[data-xt="go"]'); if (go) go.disabled = !!st.job || b - a > MAX_RANGE || !!X().unsupported();
  }
  async function load(f) {
    if (st.job) return;
    if (!(f.type && f.type.startsWith('audio/')) && !/\.(mp3|wav|wave|ogg|oga|opus|flac|m4a|aac|webm|aif|aiff)$/i.test(f.name || '')) { U.toast('Eso no parece un archivo de audio'); return; }
    stop();
    U.toast('Leyendo «' + f.name + '»…');
    try {
      const buf = await H.Audio.decode(await f.arrayBuffer());
      Object.assign(st, { file: { name: f.name }, buf, peaks: X().peaks(buf, 1600), range: [0, buf.duration], res: null, lanePeaks: {}, sel: null, cursor: 0 });
      renderSong(); renderRes();
    } catch (err) { U.toast('Tu navegador no puede leer ese archivo de audio'); }
  }

  /* ---------- 2. separar ---------- */
  function renderJob() {
    if (!live()) return;
    const box = root.querySelector('.xt-job'), j = st.job;
    box.hidden = !j; if (!j) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="xt-prog"><p class="xt-stage"></p><div class="xt-bar"><i></i></div><p class="fine xt-eta"></p>
      <button class="btn btn-sm" type="button" data-xt="cancel">Cancelar</button></div>`;
    paintJob();
  }
  function paintJob() {
    const j = st.job; if (!j || !live()) return;
    const box = root.querySelector('.xt-job'); if (!box || !box.firstChild) return;
    const how = j.backend === 'webgpu' ? 'la tarjeta gráfica (WebGPU)' : j.backend === 'wasm' ? 'el procesador' : '';
    const T = {
      prepare: 'Preparando el audio…',
      engine: 'Cargando el motor de IA…',
      cached: 'Cargando el modelo guardado en este navegador…',
      download: j.total ? `Descargando el modelo: ${mb(j.loaded || 0)} de ${mb(j.total)} MB (solo la primera vez)` : `Descargando el modelo: ${mb(j.loaded || 0)} MB (solo la primera vez)`,
      compile: `Preparando el modelo para ${how || 'este equipo'}…`,
      separate: `Separando${how ? ' con ' + how : ''}: ${Math.round((j.progress || 0) * 100)} %`
    };
    box.querySelector('.xt-stage').textContent = T[j.stage] || 'Trabajando…';
    const frac = j.stage === 'download' ? (j.total ? j.loaded / j.total : 0) : j.stage === 'separate' ? j.progress || 0 : 0;
    const bar = box.querySelector('.xt-bar'); bar.classList.toggle('is-busy', !(frac > 0)); bar.querySelector('i').style.width = (frac * 100).toFixed(1) + '%';
    let eta = '';
    if (j.stage === 'separate' && j.progress > 0.02 && j.t0) {
      const el = (performance.now() - j.t0) / 1000, left = (el / j.progress) * (1 - j.progress);
      eta = `Quedan unos ${left < 60 ? Math.max(1, Math.round(left)) + ' s' : Math.round(left / 60) + ' min'} · tramo de ${mmss(j.len)}`;
    } else if (j.stage === 'separate') eta = 'Calculando cuánto queda…';
    box.querySelector('.xt-eta').textContent = eta;
  }
  async function go() {
    if (!st.buf || st.job) return;
    const [a, b] = st.range;
    stop();
    st.job = { stage: 'prepare', len: b - a }; st.err = null;
    renderJob(); renderSong();
    try {
      const res = await X().separate(st.buf, a, b, (ev) => {
        const j = st.job; if (!j) return;
        if (ev.stage === 'nocache') { U.toast('No hay sitio para guardar el modelo: la próxima vez se volverá a descargar'); return; }
        if (ev.stage === 'separate' && j.stage !== 'separate') j.t0 = performance.now();
        Object.assign(j, ev);
        if (ev.stage === 'cached' || ev.stage === 'download') st.cached = ev.stage === 'cached' ? true : st.cached;
        paintJob();
      });
      st.cached = true;
      Object.assign(st, { res, job: null, lanePeaks: {}, sel: null, cursor: 0, solo: new Set(), mute: new Set() });
      X().PARTS.forEach((p) => { st.lanePeaks[p.id] = X().peaks(res.parts[p.id], 1600); });
      U.toast(`Separado: ${mmss(b - a)} en voz, batería, bajo e instrumentos`);
    } catch (err) {
      st.job = null;
      if (err.where !== 'cancel') { st.err = errText(err); U.toast('No se ha podido separar: mira el aviso'); }
    }
    renderJob(); renderSong(); renderRes();
    if (st.res && live()) root.querySelector('.xt-res').scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function errText(err) {
    const w = err.where, m = err.message || '';
    if (w === 'download') return 'No se ha podido descargar el modelo de Hugging Face (¿sin conexión, o lo bloquea algo?). ' + m;
    if (w === 'engine') return 'No se ha podido cargar el motor de IA (ONNX Runtime) desde jsDelivr. Comprueba la conexión.';
    if (w === 'compile') return 'El modelo no arranca en este navegador: ' + m;
    if (w === 'worker') return 'Este navegador no deja arrancar el motor del Extractor. Prueba con Chrome o Edge de ordenador.';
    if (w === 'support') return m;
    if (w === 'prepare') return 'No se ha podido preparar el audio: ' + m;
    return 'La separación ha fallado' + (m ? ': ' + m : '') + '. Si el tramo es largo, puede que falte memoria: prueba con uno más corto.';
  }

  /* ---------- 3. las partes ---------- */
  const audible = (id) => (st.solo.size ? st.solo.has(id) : !st.mute.has(id));
  function renderRes() {
    if (!live()) return;
    const box = root.querySelector('.xt-res'), r = st.res;
    box.hidden = !r; if (!r) { box.innerHTML = ''; return; }
    const bank = H.Banks.current(H.PadStore.loadState());
    box.innerHTML = `
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Partes</h2><p class="fine">De ${mmss(r.a)} a ${mmss(r.b)} de «${e(st.file.name)}» · ${r.backend === 'webgpu' ? 'separado con WebGPU' : r.backend === 'wasm' ? 'separado con el procesador' : ''}</p></header>
      <div class="xt-tr">
        <button class="btn btn-solid xt-play" type="button" data-xt="play"></button>
        <span class="mono xt-time"></span>
        <label class="mono xt-loop"><input type="checkbox" id="xt-loop"${st.loop ? ' checked' : ''}><span>Bucle en la selección</span></label>
        <span class="mono xt-seltxt"></span>
      </div>
      <div class="xt-lanes">${X().PARTS.map((p) => `
        <div class="xt-lane cat-${p.cat}" data-part="${p.id}">
          <div class="xt-lh"><b>${p.name}</b>
            <button class="sq-ms" type="button" data-xt="solo" aria-pressed="false" title="Solo">S</button>
            <button class="sq-ms" type="button" data-xt="mute" aria-pressed="false" title="Silenciar">M</button></div>
          <div class="xt-wave" data-lane="${p.id}"><canvas aria-hidden="true"></canvas><i class="xt-sel"></i><i class="xt-head"></i></div>
          <div class="xt-la">
            <button class="btn btn-sm" type="button" data-xt="pad" title="Al primer pad libre de «${e(bank.name)}»">${U.icon('pads')}<span>Al pad</span></button>
            <button class="btn btn-sm" type="button" data-xt="wav" title="Descargar en WAV">WAV</button></div>
        </div>`).join('')}
        <div class="xt-lane xt-mixlane">
          <div class="xt-lh"><b>Lo que suena</b><span class="fine">las partes que no estén silenciadas, juntas</span></div>
          <div class="xt-la">
            <button class="btn btn-sm" type="button" data-xt="pad" title="Al primer pad libre de «${e(bank.name)}»">${U.icon('pads')}<span>Al pad</span></button>
            <button class="btn btn-sm" type="button" data-xt="wav" title="Descargar en WAV">WAV</button></div>
        </div>
      </div>
      <p class="fine">Arrastra sobre cualquier onda para marcar un trozo (vale para todas las partes); un clic mueve el cabezal y quita la marca. «Al pad» lo manda al primer pad libre del banco abierto en el Soundpad («${e(bank.name)}»), como archivo tuyo. Las partes se pierden al recargar la página; lo que mandes a un pad, no.</p>`;
    box.querySelectorAll('.xt-wave').forEach((w) => bindSelect(w, () => st.res.parts.voz.duration, (sel) => { st.sel = sel; paintSel(); }, (t) => { st.sel = null; st.cursor = t; paintSel(); if (play) start(); else paintHead(); }));
    drawLanes(); paintMix(); paintSel(); paintTransport();
  }
  function paintMix() {
    if (!live()) return;
    root.querySelectorAll('.xt-lane[data-part]').forEach((l) => {
      const id = l.dataset.part;
      l.querySelector('[data-xt="solo"]').setAttribute('aria-pressed', st.solo.has(id));
      l.querySelector('[data-xt="solo"]').classList.toggle('is-on', st.solo.has(id));
      l.querySelector('[data-xt="mute"]').setAttribute('aria-pressed', st.mute.has(id));
      l.querySelector('[data-xt="mute"]').classList.toggle('is-on', st.mute.has(id));
      l.classList.toggle('is-off', !audible(id));
      if (play && play.g[id]) play.g[id].gain.setTargetAtTime(audible(id) ? 1 : 0, H.Audio.ctx().currentTime, 0.01);
    });
  }
  function paintSel() {
    if (!live() || !st.res) return;
    const d = st.res.parts.voz.duration;
    root.querySelectorAll('.xt-wave').forEach((w) => { w.classList.toggle('has-sel', !!st.sel); if (st.sel) { w.style.setProperty('--a', st.sel[0] / d); w.style.setProperty('--b', st.sel[1] / d); } });
    const t = root.querySelector('.xt-seltxt');
    if (t) t.textContent = st.sel ? `Selección ${prec(st.sel[0] + st.res.a)} – ${prec(st.sel[1] + st.res.a)} · ${secs(st.sel[1] - st.sel[0])}` : 'Sin selección: arrastra sobre una onda';
    paintHead();
  }
  function paintTransport() {
    const b = root && root.querySelector('.xt-play'); if (!b) return;
    b.innerHTML = play ? `${U.icon('stop')}<span>Parar</span>` : `${U.icon('play')}<span>${st.sel ? 'Escuchar la selección' : 'Escuchar'}</span>`;
    b.setAttribute('aria-pressed', !!play);
  }
  function pos() {
    if (!play) return st.cursor;
    const t = H.Audio.ctx().currentTime - play.t0;
    if (play.loop) { const L = play.b - play.a; return play.a + (t % L); }
    return play.a + t;
  }
  function paintHead() {
    if (!live() || !st.res) return;
    const d = st.res.parts.voz.duration, p = Math.min(d, pos());
    root.querySelectorAll('.xt-wave').forEach((w) => w.style.setProperty('--h', p / d));
    const t = root.querySelector('.xt-time'); if (t) t.textContent = `${prec(p + st.res.a)}`;
  }

  /* ---------- escuchar ---------- */
  function start() {
    stop(true);
    const ctx = H.Audio.ensure(); if (!ctx || !st.res) return;
    const d = st.res.parts.voz.duration, loop = !!(st.sel && st.loop);
    const a = st.sel ? st.sel[0] : Math.min(st.cursor, d - 0.05), b = st.sel ? st.sel[1] : d;
    const out = H.Audio.bus('extractor'), when = ctx.currentTime + 0.03, g = {}, src = [];
    X().PARTS.forEach((p) => {
      const s = ctx.createBufferSource(), gn = ctx.createGain();
      s.buffer = st.res.parts[p.id]; gn.gain.value = audible(p.id) ? 1 : 0;
      s.connect(gn); gn.connect(out);
      if (loop) { s.loop = true; s.loopStart = a; s.loopEnd = b; s.start(when, a); } else s.start(when, a, b - a);
      g[p.id] = gn; src.push(s);
    });
    src[0].onended = () => { if (play && play.src === src) { st.cursor = st.sel ? st.sel[0] : 0; stop(); } };
    play = { src, g, t0: when, a, b, loop };
    paintTransport();
    const tick = () => { raf = 0; if (!play || !live()) return; paintHead(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }
  function stop(quiet) {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (play) {
      if (!quiet) st.cursor = st.sel ? st.sel[0] : Math.min(pos(), st.res ? st.res.parts.voz.duration : 0);
      const ctx = H.Audio.ctx();
      play.src.forEach((s) => { try { s.onended = null; s.stop(ctx.currentTime + 0.02); } catch (e2) { /* ya parada */ } });
      Object.values(play.g).forEach((gn) => { try { gn.gain.setTargetAtTime(0, ctx.currentTime, 0.005); } catch (e2) { /* nada */ } });
      play = null;
    }
    if (!quiet) { paintTransport(); paintHead(); }
  }

  /* ---------- llevarse un trozo ---------- */
  function clip(partId) {
    const r = st.res, ids = partId ? [partId] : X().PARTS.map((p) => p.id).filter(audible);
    if (!ids.length) { U.toast('Todas las partes están silenciadas'); return null; }
    const [a, b] = st.sel || [0, r.parts.voz.duration];
    const p = partId ? X().PARTS.find((x) => x.id === partId) : null;
    const label = p ? p.name : ids.length === 4 ? 'Todo' : ids.map((i) => X().PARTS.find((x) => x.id === i).name).join(' + ');
    const tt = (t) => { const m = Math.floor(t / 60); return m + 'm' + (t - m * 60).toFixed(1).padStart(4, '0') + 's'; };
    const t0 = tt(a + r.a), t1 = tt(b + r.a);
    return { blob: X().wav(ids.map((i) => r.parts[i]), a, b), file: `${baseName()} - ${label} ${t0}-${t1}.wav`, name: `${label} · ${baseName()}`.slice(0, 40), cat: p ? p.cat : 'loop', len: b - a };
  }
  async function toPad(partId) {
    if (!st.sel) { U.toast('Marca primero un trozo arrastrando sobre la onda'); return; }
    if (st.sel[1] - st.sel[0] > 60) { U.toast('Para un pad, mejor un trozo de un minuto como mucho'); return; }
    const c = clip(partId); if (!c) return;
    let id;
    try { id = await H.PadStore.putFile(new File([c.blob], c.file, { type: 'audio/wav' })); }
    catch (err) { U.toast('No se ha podido guardar el trozo en este navegador'); return; }
    const r = H.Soundpad.addToFreePad({ type: 'file', fileId: id, fileName: c.file }, { name: c.name, cat: c.cat });
    if (!r) { U.toast('No quedan pads libres en el banco abierto: vacía alguno o crea un banco nuevo en el Soundpad'); return; }
    U.toast(`«${c.name}» (${secs(c.len)}) en el pad ${r.i + 1} de «${r.bank.name}»`);
  }
  function download(partId) {
    const c = clip(partId); if (!c) return;
    const url = URL.createObjectURL(c.blob), a = document.createElement('a');
    a.href = url; a.download = c.file; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- ondas y selección ---------- */
  function drawWave(box, peaks, range) {
    const cv = box.querySelector('canvas'), dpr = window.devicePixelRatio || 1, W = box.clientWidth || 600, Hh = box.clientHeight || 64;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    if (!peaks) return;
    const css = getComputedStyle(box), col = css.getPropertyValue('--c').trim() || getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#000';
    const n = peaks.length, mx = Math.max(0.05, peaks.reduce((m, v) => (v > m ? v : m), 0));
    const faint = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#999';
    for (let x = 0; x < W; x++) {
      const i = Math.min(n - 1, Math.floor((x / W) * n)), h = Math.max(1, (peaks[i] / mx) * (Hh - 4)), f = x / W;
      g.fillStyle = !range || (f >= range[0] && f <= range[1]) ? col : faint;   // fuera del tramo, en gris
      g.fillRect(x, (Hh - h) / 2, 1, h);
    }
  }
  function drawOv() { const b = root && root.querySelector('.xt-ov'); if (b) { drawWave(b, st.peaks, [st.range[0] / st.buf.duration, st.range[1] / st.buf.duration]); paintRange(); } }
  function drawLanes() { if (!live()) return; root.querySelectorAll('.xt-wave').forEach((w) => drawWave(w, st.lanePeaks[w.dataset.lane])); }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (live()) { drawOv(); drawLanes(); } }, 120); });

  /* arrastrar marca un tramo [a, b] (segundos); un clic sin arrastrar llama a onClick(t); doble clic (en la de la canción), entera */
  function bindSelect(el, dur, onSel, onClick, isOv) {
    if (!el) return;
    let drag = null;
    const tAt = (x) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * dur(); };
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || st.job) return;
      ev.preventDefault(); el.setPointerCapture(ev.pointerId);
      drag = { x: ev.clientX, t: tAt(ev.clientX), moved: false };
    });
    el.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(ev.clientX - drag.x) < 4) return;
      drag.moved = true;
      const t = tAt(ev.clientX), a = Math.min(drag.t, t), b = Math.max(drag.t, t);
      if (b - a > 0.02) onSel([a, b]);
    });
    const end = (ev) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved) { if (isOv) return; onClick(d.t); return; }
      if (play) start();
      if (isOv) renderSong();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { drag = null; });
    if (isOv) el.addEventListener('dblclick', () => onClick());
  }

  /* ---------- eventos ---------- */
  function onClick(ev) {
    const b = ev.target.closest('[data-xt]'); if (!b) return;
    const a = b.dataset.xt, lane = b.closest('.xt-lane'), part = lane && lane.dataset.part ? lane.dataset.part : null;
    if (a === 'go') go();
    else if (a === 'cancel') { X().cancel(); st.job = null; renderJob(); renderSong(); U.toast('Separación cancelada'); }
    else if (a === 'other') { if (st.job) return; stop(); Object.assign(st, { file: null, buf: null, peaks: null, range: null, res: null, sel: null }); renderSong(); renderRes(); }
    else if (a === 'forget') { X().forgetModel().then((ok) => { st.cached = !ok; renderSong(); U.toast(ok ? 'Modelo borrado de este navegador' : 'No se ha podido borrar'); }); }
    else if (a === 'play') { if (play) stop(); else start(); }
    else if (a === 'solo' || a === 'mute') { const s = a === 'solo' ? st.solo : st.mute; if (s.has(part)) s.delete(part); else s.add(part); paintMix(); }
    else if (a === 'pad') toPad(part);
    else if (a === 'wav') download(part);
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.id === 'xt-file' && t.files && t.files[0]) { load(t.files[0]); t.value = ''; }
    else if (t.id === 'xt-loop') { st.loop = t.checked; if (play) start(); }
  }
})();
