/* HARMONY · Biblioteca › Laboratorio de kicks
   Mandos sobre el motor de kicks duros (tools/samples/hard.mjs, en workers/kick/): cada cambio recalcula el kick en un
   worker y lo deja sonando. Se puede oír en bucle a un tempo (con palma y charles), mandar a un pad del Soundpad (como
   archivo tuyo) o descargar en WAV. Los últimos ajustes se recuerdan en este navegador. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;
  const STORE = 'kicklab';
  const NOTES = ['A1', 'A#1', 'B1', 'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2'];
  const NOTE_ES = { C: 'Do', 'C#': 'Do#', D: 'Re', 'D#': 'Re#', E: 'Mi', F: 'Fa', 'F#': 'Fa#', G: 'Sol', 'G#': 'Sol#', A: 'La', 'A#': 'Si♭', B: 'Si' };
  const es = (n) => { const m = /^([A-G]#?)(-?\d)$/.exec(n || ''); return m ? NOTE_ES[m[1]] + ' ' + m[2] : '—'; };

  /* puntos de partida: uptempo (el kick del himno), sus variantes, raw, gabber, hardstyle y frenchcore */
  const BASE = { type: 'hard', note: 'D2', len: 300, semis: 34, drop: 130, saw: 0.3, refl: 0.35, mids: 11, res: 4, drive1: 11, drive2: 5, low: 0.45, scoop: -2, move: 'down', tok: 0.8, tick: 0.5, ott: 0.45, seed: 11, bpm: 200, at: 70, per: 3, decay: 0.6 };
  const PRESETS = {
    uptempo: { name: 'Uptempo', p: {} },
    chillon: { name: 'Uptempo que se abre', p: { move: 'up' } },
    vaiven: { name: 'Uptempo con vaivén', p: { move: 'wobble' } },
    raw: { name: 'Raw corto', p: { len: 210, saw: 0.5, mids: 13, drive1: 16, drive2: 9, move: 'hold', low: 0.6, ott: 0.6 } },
    gabber: { name: 'Gabber zumbón', p: { note: 'F2', len: 450, semis: 30, drop: 60, saw: 0.1, refl: 0.1, mids: 6, res: 8, drive1: 14, drive2: 3, low: 1, scoop: -6, move: 'hold', tok: 1, bpm: 180 } },
    hardstyle: { name: 'Hardstyle', p: { note: 'F2', len: 420, semis: 36, drop: 160, saw: 0.2, mids: 8, res: 5, drive1: 7, drive2: 3, low: 1, scoop: -6, move: 'down', bpm: 150 } },
    frenchcore: { name: 'Frenchcore', p: { type: 'french', seed: 21 } }
  };
  /* los mandos: [clave, nombre, mín, máx, paso, cómo se lee, ayuda] */
  const KNOBS = [
    ['Golpe', [
      ['len', 'Largo', 120, 700, 10, (v) => v + ' ms', 'Lo que dura el kick. Un tiempo dura 60 000 / BPM ms (300 ms a 200 BPM).'],
      ['semis', 'Caída de tono', 12, 48, 1, (v) => v + ' st', 'Desde cuántos semitonos por encima de la nota cae.'],
      ['drop', 'Tiempo de caída', 20, 300, 5, (v) => v + ' ms', 'Rápido: más golpe. Lento: más «piuuu».'],
      ['tok', 'Tok', 0, 1.6, 0.05, (v) => Math.round(v * 100) + ' %', 'El golpe limpio de delante, sin graves.'],
      ['tick', 'Tick', 0, 1.6, 0.05, (v) => Math.round(v * 100) + ' %', 'El clic de ruido del principio.']
    ]],
    ['Cola', [
      ['saw', 'Sierra en la fuente', 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', 'Más sierra: la cola zumba más.'],
      ['refl', 'Reflexiones', 0, 0.8, 0.05, (v) => Math.round(v * 100) + ' %', 'Antes de distorsionar: textura y estéreo en la cola.'],
      ['mids', 'Medios', 0, 16, 0.5, (v) => '+' + v + ' dB', 'Realce de medios antes de la primera distorsión.'],
      ['res', 'Resonancia', 0, 12, 0.5, (v) => '+' + v + ' dB', 'La banda resonante (el armónico de la nota más cercano a 900 Hz).'],
      ['drive1', 'Distorsión 1', 1, 24, 0.5, (v) => '×' + v, 'Saturación suave.'],
      ['drive2', 'Distorsión 2', 1, 14, 0.5, (v) => '×' + v, 'Recorte duro, después de la resonancia.']
    ]],
    ['Equilibrio', [
      ['low', 'Sub', 0, 1.6, 0.05, (v) => Math.round(v * 100) + ' %', 'Cuánto se realza la nota (los graves).'],
      ['scoop', 'Hueco en 300 Hz', -12, 0, 0.5, (v) => v + ' dB', 'Quitar en 300 Hz deja sitio al resto (y lo vacía si te pasas).'],
      ['ott', 'OTT', 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', 'Compresión en tres bandas: lo flojo sube.']
    ]]
  ];
  const FRENCH = [
    ['per', 'Repeticiones por negra', 1, 6, 1, (v) => v + '×', 'Cuántas veces cabe el trozo repetido en un tiempo.'],
    ['at', 'Trozo desde', 20, 150, 5, (v) => v + ' ms', 'Cuanto más pegado al ataque, más zumba.'],
    ['decay', 'Caída de la cola', 0.1, 2, 0.05, (v) => v.toFixed(2), 'Más alto: la cola se apaga antes.']
  ];
  const MOVES = { down: 'Se cierra', up: 'Se abre', wobble: 'Vaivén', hold: 'Fijo' };

  let p = load(), root = null, worker = null, seq = 0, last = null, buf = null, timer = 0, busy = false, looping = false, loopSrc = null, extras = null;

  function load() { try { return { ...BASE, ...(JSON.parse(localStorage.getItem(STORE)) || {}) }; } catch (err) { return { ...BASE }; } }
  function keep() { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch (err) { /* sin almacenamiento */ } }

  H.Views.kicklab = function (el) {
    root = el;
    root.innerHTML = `
    <section class="page-head wrap kl">
      <p class="mono eyebrow">Biblioteca</p>
      <h1 class="page-title">Laboratorio de kicks</h1>
      <p class="sec-intro">El motor con el que se hacen los kicks de Harmony, con sus mandos a la vista. Cada cambio se recalcula y suena al momento. Cuando te guste, mándalo a un pad o descárgalo.</p>
    </section>
    <section class="sec wrap kl-main">
      <div class="kl-top">
        <div class="kl-presets" role="group" aria-label="Puntos de partida">${Object.entries(PRESETS).map(([k, x]) => `<button class="chip" type="button" data-kl="preset" data-k="${k}">${e(x.name)}</button>`).join('')}<button class="chip" type="button" data-kl="random">${U.icon('shuffle')} Al azar</button></div>
      </div>
      <div class="kl-grid">
        <div class="kl-out">
          <div class="kl-wave"><canvas aria-hidden="true"></canvas><span class="mono kl-busy" hidden>Calculando…</span></div>
          <p class="mono kl-meta"></p>
          <div class="kl-acts">
            <button class="btn btn-solid" type="button" data-kl="play">${U.icon('play')}<span>Escuchar</span></button>
            <button class="btn" type="button" data-kl="loop" aria-pressed="false">${U.icon('pulse')}<span>En bucle</span></button>
            <label class="sel mono kl-bpm"><span>BPM</span><input type="number" id="kl-bpm" min="120" max="260" step="1"></label>
            <label class="mono kl-chk"><input type="checkbox" id="kl-perc" checked><span>Palma y charles</span></label>
          </div>
          <div class="kl-acts">
            <button class="btn" type="button" data-kl="pad">${U.icon('pads')}<span>Al pad</span></button>
            <button class="btn" type="button" data-kl="wav">WAV</button>
            <button class="btn" type="button" data-kl="seed" title="La misma receta con otra semilla (cambian los detalles de las reflexiones)">Otra variación</button>
          </div>
          <p class="fine">«Al pad» lo manda al primer pad libre del banco abierto en el Soundpad, como archivo tuyo. Los ajustes se recuerdan en este navegador.</p>
        </div>
        <div class="kl-knobs"></div>
      </div>
    </section>`;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    renderKnobs(); paintMeta(); draw();
    root.querySelector('#kl-bpm').value = p.bpm;
    render(true);
  };
  const live = () => root && root.isConnected && root.querySelector('.kl-main');
  window.addEventListener('hashchange', () => setTimeout(() => { if (!live()) stopLoop(); }, 0));

  /* ---------- mandos ---------- */
  function knob([k, name, min, max, step, fmt, help]) {
    return `<label class="kl-k" title="${e(help)}"><span class="mono">${e(name)} <output data-o="${k}">${e(fmt(p[k]))}</output></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${p[k]}"></label>`;
  }
  function renderKnobs() {
    const box = root.querySelector('.kl-knobs');
    box.innerHTML = `
      <div class="kl-sec"><p class="mono eyebrow">Tipo y nota</p>
        <div class="seg" role="group" aria-label="Tipo">${[['hard', 'Duro'], ['french', 'Frenchcore']].map(([v, n]) => `<button type="button" data-kl="type" data-v="${v}" aria-pressed="${p.type === v}">${n}</button>`).join('')}</div>
        <label class="sel mono kl-note"><span>Nota de la cola</span><select id="kl-note">${NOTES.map((n) => `<option value="${n}"${n === p.note ? ' selected' : ''}>${es(n)} (${n.replace('#', '♯')})</option>`).join('')}</select></label>
        <div class="kl-move${p.type === 'french' ? ' is-off' : ''}"><span class="mono">Movimiento de la cola</span>
          <div class="seg" role="group" aria-label="Movimiento">${Object.entries(MOVES).map(([v, n]) => `<button type="button" data-kl="move" data-v="${v}" aria-pressed="${p.move === v}"${p.type === 'french' ? ' disabled' : ''}>${n}</button>`).join('')}</div></div>
        ${p.type === 'french' ? `<div class="kl-ks">${FRENCH.map(knob).join('')}</div>` : ''}
      </div>
      ${KNOBS.map(([title, list]) => `<div class="kl-sec"><p class="mono eyebrow">${title}</p><div class="kl-ks">${list.map(knob).join('')}</div></div>`).join('')}`;
  }
  function allKnobs() { return [...KNOBS.flatMap(([, l]) => l), ...FRENCH]; }
  function onInput(ev) {
    const t = ev.target;
    if (t.dataset && t.dataset.k) {
      const k = t.dataset.k, d = allKnobs().find((x) => x[0] === k);
      p[k] = +t.value;
      const o = root.querySelector(`[data-o="${k}"]`); if (o && d) o.textContent = d[5](p[k]);
      keep(); render();
    }
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.id === 'kl-note') { p.note = t.value; keep(); render(true); }
    else if (t.id === 'kl-bpm') { const v = Math.max(120, Math.min(260, Math.round(+t.value) || p.bpm)); p.bpm = v; t.value = v; keep(); if (p.type === 'french') render(true); else if (looping) startLoop(); }
    else if (t.id === 'kl-perc') { if (looping) startLoop(); }
  }
  function onClick(ev) {
    const b = ev.target.closest('[data-kl]'); if (!b) return;
    const a = b.dataset.kl;
    if (a === 'preset') { p = { ...BASE, ...PRESETS[b.dataset.k].p }; keep(); renderKnobs(); root.querySelector('#kl-bpm').value = p.bpm; render(true); U.toast('Punto de partida: ' + PRESETS[b.dataset.k].name); }
    else if (a === 'random') { randomize(); keep(); renderKnobs(); render(true); }
    else if (a === 'type') { p.type = b.dataset.v; keep(); renderKnobs(); render(true); }
    else if (a === 'move') { p.move = b.dataset.v; keep(); renderKnobs(); render(true); }
    else if (a === 'seed') { p.seed = 1 + Math.floor(Math.random() * 9999); keep(); render(true); }
    else if (a === 'play') play();
    else if (a === 'loop') { if (looping) stopLoop(); else startLoop(); }
    else if (a === 'pad') toPad();
    else if (a === 'wav') download();
  }
  /* al azar, pero dentro de lo que suena a kick duro */
  function randomize() {
    const r = Math.random, pick = (a) => a[Math.floor(r() * a.length)], rr = (a, b, s) => Math.round((a + r() * (b - a)) / s) * s;
    const t = r() < 0.2 ? 'french' : 'hard';
    p = { ...p, type: t, note: pick(['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2']), len: rr(200, 420, 10), semis: rr(24, 40, 1), drop: rr(60, 200, 5), saw: rr(0, 0.6, 0.05),
      refl: rr(0.1, 0.6, 0.05), mids: rr(5, 14, 0.5), res: rr(2, 9, 0.5), drive1: rr(6, 18, 0.5), drive2: rr(2, 10, 0.5), low: rr(0.55, 1.1, 0.05),
      scoop: rr(-8, -1, 0.5), move: pick(['down', 'up', 'wobble', 'hold']), tok: rr(0.4, 1.2, 0.05), tick: rr(0.2, 0.9, 0.05), ott: rr(0.2, 0.7, 0.05), seed: 1 + Math.floor(r() * 9999) };
  }

  /* ---------- calcular ---------- */
  function engine() {
    if (worker) return worker;
    worker = new Worker(new URL('workers/kick/worker.js', location.href), { type: 'module' });
    worker.onmessage = (ev) => done(ev.data);
    worker.onerror = (ev) => { if (ev.preventDefault) ev.preventDefault(); worker = null; busy = false; paintBusy(); U.toast('No arranca el motor de kicks en este navegador'); };
    return worker;
  }
  /* cada cambio pide un kick nuevo; si ya hay uno calculándose, el último ajuste espera a que acabe */
  let wanted = false, autoplay = false;
  function render(now) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (busy) { wanted = true; return; }
      busy = true; wanted = false; autoplay = true; paintBusy();
      try { engine().postMessage({ id: ++seq, p: { ...p } }); } catch (err) { busy = false; paintBusy(); }
    }, now ? 0 : 90);
  }
  function done(m) {
    busy = false; paintBusy();
    if (m.error) { U.toast('El kick no ha salido: ' + m.error); return; }
    last = m;
    const ctx = H.Audio.context();
    if (ctx) { buf = ctx.createBuffer(2, m.L.length, 44100); buf.copyToChannel(m.L, 0); buf.copyToChannel(m.R, 1); }
    paintMeta(); draw();
    if (wanted) { render(true); return; }
    if (looping) startLoop(); else if (autoplay && live() && H.Audio.ctx() && H.Audio.ctx().state === 'running') play();
  }
  function paintBusy() { const b = root && root.querySelector('.kl-busy'); if (b) b.hidden = !busy; }
  function paintMeta() {
    const el = root && root.querySelector('.kl-meta'); if (!el) return;
    if (!last) { el.textContent = 'Calculando el primer kick…'; return; }
    const want = p.note, ok = last.note === want;
    el.innerHTML = `Cola en <b>${es(last.note)}</b>${last.hz ? ` (${last.hz.toFixed(1).replace('.', ',')} Hz)` : ''}${ok ? '' : ` · pedida en ${es(want)}`} · ${(last.L.length / 44.1).toFixed(0)} ms · RMS ${last.rmsDb.toFixed(1).replace('.', ',')} dB · calculado en ${last.ms} ms`;
  }
  function draw() {
    const box = root && root.querySelector('.kl-wave'); if (!box) return;
    const cv = box.querySelector('canvas'), dpr = window.devicePixelRatio || 1, W = box.clientWidth || 600, Hh = box.clientHeight || 160;
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    if (!last) return;
    const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--c-kick').trim() || css.getPropertyValue('--ink').trim() || '#000';
    const x = last.L, n = x.length, mid = Hh / 2;
    g.fillStyle = ink;
    for (let px = 0; px < W; px++) {
      const a = Math.floor((px / W) * n), b = Math.max(a + 1, Math.floor(((px + 1) / W) * n));
      let lo = 1, hi = -1;
      for (let i = a; i < b; i++) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; }
      g.fillRect(px, mid - hi * (mid - 4), 1, Math.max(1, (hi - lo) * (mid - 4)));
    }
  }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (live()) draw(); }, 120); });

  /* ---------- escuchar ---------- */
  function out() { return H.Audio.bus('kicklab'); }
  function play() {
    const ctx = H.Audio.ensure(); if (!ctx || !buf) return;
    if (looping) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(out()); s.start();
  }
  /* un compás en bucle: el kick en cada tiempo (cortado al tiempo si dura más) y, si se quiere, palma y charles */
  async function startLoop() {
    const ctx = H.Audio.ensure(); if (!ctx || !buf) return;
    if (!extras) {
      extras = {};
      try { extras.clap = await H.PadAudio.load({ type: 'harmony', sampleId: 'harmony-08/himno-palma' }); } catch (err) { /* sin palma */ }
      try { extras.hat = await H.PadAudio.load({ type: 'harmony', sampleId: 'harmony-08/himno-charles' }); } catch (err) { /* sin charles */ }
    }
    stopLoop(true);
    const beat = 60 / p.bpm, n = Math.round(beat * 4 * 44100), bar = ctx.createBuffer(2, n, 44100), withPerc = root.querySelector('#kl-perc').checked;
    const add = (src, at, gain, cut) => {
      if (!src) return;
      const o = Math.round(at * 44100), len = Math.min(src.length, cut ? Math.round(cut * 44100) : src.length), f = Math.round(0.004 * 44100);
      for (let c = 0; c < 2; c++) {
        const d = bar.getChannelData(c), s = src.getChannelData(Math.min(c, src.numberOfChannels - 1));
        for (let i = 0; i < len; i++) { const j = (o + i) % n, w = cut && i > len - f && len < src.length ? (len - i) / f : 1; d[j] += s[i] * gain * w; }
      }
    };
    for (let k = 0; k < 4; k++) add(buf, k * beat, 0.85, beat);
    if (withPerc) { add(extras.clap, beat, 0.5); add(extras.clap, beat * 3, 0.5); for (let k = 0; k < 4; k++) add(extras.hat, k * beat + beat / 2, 0.35); }
    const s = ctx.createBufferSource(); s.buffer = bar; s.loop = true; s.connect(out()); s.start();
    loopSrc = s; looping = true; paintLoop();
  }
  function stopLoop(quiet) {
    if (loopSrc) { try { loopSrc.stop(); } catch (err) { /* ya parado */ } loopSrc = null; }
    looping = false; if (!quiet) paintLoop();
  }
  function paintLoop() {
    const b = root && root.querySelector('[data-kl="loop"]'); if (!b) return;
    b.setAttribute('aria-pressed', looping); b.classList.toggle('btn-solid', looping);
    b.querySelector('span').textContent = looping ? 'Parar el bucle' : 'En bucle';
  }

  /* ---------- llevárselo ---------- */
  const fileName = () => `kick-${p.type === 'french' ? 'frenchcore' : 'duro'}-${(last && last.note ? last.note : p.note).replace('#', 's')}-${p.seed}.wav`;
  async function toPad() {
    if (!buf) return;
    const blob = H.Stems.wav(buf, 0, buf.duration), name = fileName();
    let id;
    try { id = await H.PadStore.putFile(new File([blob], name, { type: 'audio/wav' })); }
    catch (err) { U.toast('No se ha podido guardar el kick en este navegador'); return; }
    const label = `Kick ${p.type === 'french' ? 'frenchcore' : 'lab'} ${es(last && last.note ? last.note : p.note)}`;
    const r = H.Soundpad.addToFreePad({ type: 'file', fileId: id, fileName: name }, { name: label, cat: 'kick' });
    if (!r) { U.toast('No quedan pads libres en el banco abierto: vacía alguno o crea un banco nuevo en el Soundpad'); return; }
    U.toast(`«${label}» en el pad ${r.i + 1} de «${r.bank.name}»`);
  }
  function download() {
    if (!buf) return;
    const url = URL.createObjectURL(H.Stems.wav(buf, 0, buf.duration)), a = document.createElement('a');
    a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
})();
