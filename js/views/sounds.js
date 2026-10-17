/* HARMONY · Biblioteca › Sonidos
   El punto de acceso a los sonidos: tus bancos del Soundpad, tus archivos (guardados en este navegador)
   y las muestras del catálogo. Cada sonido se puede escuchar aquí mismo y mandar al primer pad libre. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;
  let root = null, q = '', fam = 'all', target = null;

  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const sampled = () => H.A.tracks.filter((t) => t.dz);
  const playBtn = (key, label) => `<button class="ibtn snd-play" type="button" data-snd="prev" data-key="${e(key)}" aria-label="Escuchar ${e(label)}">${U.icon('play')}</button>`;

  H.Views.sounds = function (el) {
    root = el;
    const fams = H.A.families.filter((f) => sampled().some((t) => t.fam === f.id));
    root.innerHTML = `
    <section class="page-head wrap snd">
      <p class="mono eyebrow">Biblioteca</p>
      <h1 class="page-title">Sonidos</h1>
      <p class="sec-intro">Todo lo que puede sonar en el Soundpad: los sonidos originales de Harmony, tus bancos, los archivos que has cargado (privados, en tu navegador) y las muestras del catálogo. Escucha cualquiera aquí y mándalo al primer pad libre del banco que elijas.</p>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Sonidos de Harmony <span class="mono">${H.Lib.all().length}</span></h2>
        <div class="sec-actions"><label class="sel mono snd-target"><span>Añadir a</span><select id="snd-bank"></select></label></div></header>
      <p class="fine snd-lead">Kicks, cajas, percusión, impactos, subidas y efectos hechos por síntesis para Harmony. Suenan sin importar nada y se pueden usar y redistribuir libremente. Arrástralos a un pad en el Soundpad o añádelos desde aquí.</p>
      <div class="snd-lib"></div>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Tus bancos <span class="mono snd-nb"></span></h2>
        <div class="sec-actions"><a class="btn" href="#soundpad">${U.icon('pads')} Abrir el Soundpad</a></div></header>
      <div class="snd-banks"></div>
    </section>
    <section class="sec wrap">
      <header class="sec-head"><h2 class="sec-title sec-title-sm">Tus archivos <span class="mono snd-nf"></span> <i class="mono snd-priv">Privados</i></h2>
        <p class="fine">Guardados en este navegador (IndexedDB), no en ningún servidor. Un archivo se borra cuando ningún pad lo usa.</p></header>
      <div class="snd-files"><p class="fine">Cargando…</p></div>
    </section>
    <section class="sec wrap">
      <header class="sec-head"><h2 class="sec-title sec-title-sm">Muestras del catálogo <span class="mono snd-nc"></span></h2>
        <p class="fine">Muestras de 30 s de Deezer de los registros del archivo que la tienen. Uso privado: suenan en esta pestaña y no se guardan.</p></header>
      <div class="snd-filter">
        <label class="snd-q"><span class="sr-only">Buscar muestras</span>${U.icon('search')}<input type="search" id="snd-q" placeholder="Título, artista, género…" value="${e(q)}" autocomplete="off"></label>
        <div class="chips" role="group" aria-label="Familia">${[{ id: 'all', name: 'Todas' }].concat(fams).map((f) => `<button class="chip${fam === f.id ? ' chip-on' : ''}" type="button" data-snd="fam" data-fam="${f.id}" aria-pressed="${fam === f.id}">${e(f.name)}</button>`).join('')}</div>
      </div>
      <ul class="snd-list snd-cat"></ul>
    </section>`;
    root.querySelector('#snd-q').addEventListener('input', (ev) => { q = ev.target.value; renderCatalog(); });
    root.addEventListener('click', onClick);
    target = H.Banks.current(H.Soundpad.state()).id;
    root.querySelector('#snd-bank').addEventListener('change', (ev) => { target = ev.target.value; });
    H.LibPanel(root.querySelector('.snd-lib'), {
      idPrefix: 'sndlib', addLabel: () => 'A un pad',
      onAdd: (x) => {
        const r = H.Soundpad.addToFreePad({ type: 'harmony', sampleId: x.id }, { name: x.name, cat: x.cat, bankId: target });
        const bk = H.Soundpad.state().banks.find((b) => b.id === target) || H.Banks.current(H.Soundpad.state());
        U.toast(r ? `«${x.name}» en el pad ${r.i + 1} de «${r.bank.name}»` : `«${bk.name}» está lleno: elige otro banco o vacía un pad`);
        if (r) renderBanks();
      }
    });
    renderBanks(); renderFiles(); renderCatalog();
  };

  function mounted() { return root && root.isConnected && root.querySelector('.snd'); }

  function renderBanks() {
    const st = H.Soundpad.state(), cur = st.current;
    root.querySelector('.snd-nb').textContent = st.banks.length;
    if (!st.banks.some((b) => b.id === target)) target = cur;
    root.querySelector('#snd-bank').innerHTML = st.banks.map((b) => `<option value="${e(b.id)}"${b.id === target ? ' selected' : ''}>${e(b.name)} (${16 - b.pads.filter((p) => p.src).length} libres)</option>`).join('');
    root.querySelector('.snd-banks').innerHTML = st.banks.map((b) => {
      const n = b.pads.filter((p) => p.src).length;
      return `<article class="snd-bank${b.id === cur ? ' is-cur' : ''}">
        <div class="snd-mini" aria-hidden="true">${b.pads.map((p) => `<i class="cat-${p.cat}${p.src ? ' on' : ''}"></i>`).join('')}</div>
        <div class="snd-bank-txt">
          <h3>${e(b.name)}</h3>
          <p class="mono">${n} de 16 pads con sonido${b.id === cur ? ' · abierto' : ''}</p>
          <p class="snd-names">${b.pads.filter((p) => p.src).slice(0, 8).map((p) => e(p.name || 'Sin nombre')).join(' · ') || '<span class="fine">Vacío</span>'}</p>
        </div>
        <button class="btn btn-sm" type="button" data-snd="open-bank" data-id="${e(b.id)}">Abrir en el Soundpad</button>
      </article>`;
    }).join('');
  }

  async function renderFiles() {
    const box = root.querySelector('.snd-files');
    const files = await H.PadStore.listFiles();
    if (!mounted()) return;
    const st = H.Soundpad.state(), uses = {};
    st.banks.forEach((b) => b.pads.forEach((p, i) => { if (p.src && p.src.type === 'file') (uses[p.src.fileId] = uses[p.src.fileId] || []).push(`${b.name} · pad ${i + 1}`); }));
    root.querySelector('.snd-nf').textContent = files.length;
    box.innerHTML = files.length ? `<ul class="snd-list">${files.map((f) => {
      const key = 'file:' + f.id;
      return `<li>${playBtn(key, f.name)}
        <span class="snd-main"><b>${e(f.name)}</b><span>${kb(f.size || 0)}${uses[f.id] ? ' · en ' + e(uses[f.id].join(', ')) : ''}</span></span>
        <button class="btn btn-sm" type="button" data-snd="add" data-key="${e(key)}" data-name="${e(f.name.replace(/\.[a-z0-9]{2,5}$/i, ''))}">${U.icon('plus')}<span>A un pad</span></button></li>`;
    }).join('')}</ul>` : `<p class="fine">${H.PadStore.persistent() === false ? 'Este navegador no deja guardar archivos: lo que cargues en el Soundpad dura hasta cerrar la pestaña.' : 'Todavía no has cargado ninguno. En el Soundpad, abre las opciones de un pad y elige «Archivo de tu equipo», o arrastra un audio encima.'}</p>`;
    paintPrev();
  }

  function renderCatalog() {
    const nq = U.norm(q.trim());
    const list = sampled().filter((t) => (fam === 'all' || t.fam === fam) && (!nq || t._idx.includes(nq)));
    root.querySelector('.snd-nc').textContent = list.length + (list.length !== sampled().length ? ' de ' + sampled().length : '');
    root.querySelector('.snd-cat').innerHTML = list.length ? list.map((t) => `<li>${playBtn('dz:' + t.id, t.title)}
      <span class="snd-main"><button class="snd-title" type="button" data-open="${e(t.id)}"><b>${e(t.title)}</b></button><span>${e(t.artistLine)} · ${t.year != null ? t.year : 's. f.'} · ${e(t.G.name)}${t.dz.version ? ' · ' + e(t.dz.version) : ''}</span></span>
      <button class="btn btn-sm" type="button" data-snd="add" data-key="dz:${e(t.id)}" data-name="${e(t.title)}">${U.icon('plus')}<span>A un pad</span></button></li>`).join('')
      : '<li class="fine">Nada coincide.</li>';
    paintPrev();
  }

  const srcOf = (key) => (key.startsWith('file:') ? { type: 'file', fileId: key.slice(5), fileName: '' } : { type: 'catalog', trackId: key.slice(3) });

  function onClick(ev) {
    const b = ev.target.closest('[data-snd]');
    if (!b) return;
    const a = b.dataset.snd;
    if (a === 'prev') {
      const key = b.dataset.key;
      H.PadAudio.preview(key, srcOf(key)).catch((err) => U.toast(H.PadAudio.message(err)));
    } else if (a === 'add') {
      const key = b.dataset.key, src = srcOf(key);
      if (src.type === 'file') src.fileName = b.dataset.name;
      const r = H.Soundpad.addToFreePad(src, { name: b.dataset.name, cat: src.type === 'catalog' ? 'tema' : 'otro' });
      const bk = H.Banks.current(H.Soundpad.state());
      U.toast(r ? `En el pad ${r.i + 1} de «${r.bank.name}»` : `«${bk.name}» está lleno: vacía un pad o crea un banco en el Soundpad`);
      if (r) { renderBanks(); renderFiles(); }
    } else if (a === 'open-bank') { H.Soundpad.openBank(b.dataset.id); H.App.go('soundpad'); }
    else if (a === 'fam') { fam = b.dataset.fam; root.querySelectorAll('[data-snd="fam"]').forEach((x) => { const on = x.dataset.fam === fam; x.classList.toggle('chip-on', on); x.setAttribute('aria-pressed', on); }); renderCatalog(); }
  }

  function paintPrev() {
    if (!mounted()) return;
    root.querySelectorAll('.snd-play').forEach((btn) => {
      const p = H.PadAudio.previewState(btn.dataset.key);
      btn.innerHTML = U.icon(p.playing ? 'stop' : 'play');
      btn.classList.toggle('is-on', p.playing); btn.classList.toggle('is-loading', p.loading);
      btn.closest('li').classList.toggle('is-playing', p.playing);
    });
  }
  U.on('pads:preview', () => paintPrev());
  U.on('pads:voice', (k) => { if (k === 'preview') paintPrev(); });
  U.on('pads:load', () => paintPrev());
  // al volver del Soundpad, los bancos pueden haber cambiado
  U.on('section', (sec) => { if (sec === 'biblioteca' && mounted()) { renderBanks(); renderFiles(); } else if (sec !== 'biblioteca') H.PadAudio.stopPreview(); });
})();
