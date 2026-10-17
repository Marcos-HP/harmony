/* HARMONY · panel de la biblioteca de samples originales
   Un mismo componente para el Soundpad (pestaña «Biblioteca») y para Biblioteca › Sonidos:
   buscar, filtrar por estilo y tipo, escuchar (una sola voz de escucha para toda la web) y usar.
   Cada fila se puede arrastrar a un pad. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;

  const src = (id) => ({ type: 'harmony', sampleId: id });
  const key = (id) => 'hmy:' + id;

  /* «Harmony 01 · …; Harmony 02 · Voces (voz de base: eSpeak NG). Sonidos originales…»: una frase por licencia */
  function licence(packs) {
    const by = new Map();
    packs.forEach((p) => { if (!by.has(p.license)) by.set(p.license, []); by.get(p.license).push(p); });
    return [...by.values()].map((ps) => `${ps.map((p) => `<b>${e(p.name)}</b> · ${e(p.title)}${p.note ? ` (${e(p.note)})` : ''}`).join('; ')}: sonidos originales de Harmony, hechos por síntesis con licencia <a href="${e(ps[0].licenseUrl)}" target="_blank" rel="noopener">${e(ps[0].licenseName)}</a>.${ps[0].license === 'CC0-1.0' ? ' Se pueden usar y redistribuir sin pedir permiso.' : ''}`).join(' ');
  }

  /* opts: { onAdd(sample), addLabel(sample) → texto del botón, empty → texto si no hay nada, idPrefix } */
  H.LibPanel = function (el, opts = {}) {
    const st = { q: '', style: 'all', type: 'all' };
    const pre = opts.idPrefix || 'lib';
    const packs = H.Lib.packs();
    el.innerHTML = `<div class="lib">
      <div class="lib-filter">
        <label class="snd-q lib-q"><span class="sr-only">Buscar en la biblioteca de Harmony</span>${U.icon('search')}<input type="search" id="${pre}-q" placeholder="Nombre, etiqueta, nota…" autocomplete="off"></label>
        <div class="chips lib-styles" role="group" aria-label="Estilo"></div>
        <label class="sel mono lib-type"><span>Tipo</span><select id="${pre}-type"></select></label>
      </div>
      <p class="mono lib-n" aria-live="polite"></p>
      <ul class="lib-list"></ul>
      <p class="fine lib-lic">${licence(packs)}</p>
    </div>`;
    const $ = (s) => el.querySelector(s);

    function renderFilters(list) {
      const all = H.Lib.all();
      $('.lib-styles').innerHTML = [{ id: 'all', name: 'Todos', n: all.length }].concat(H.Lib.facets('style'))
        .map((f) => `<button class="chip chip-sm${st.style === f.id ? ' chip-on' : ''}" type="button" data-lib="style" data-v="${f.id}" aria-pressed="${st.style === f.id}">${e(f.name)} <span class="mono">${f.n}</span></button>`).join('');
      const forTypes = H.Lib.filter({ style: st.style });
      $('select').innerHTML = [{ id: 'all', name: 'Todos', n: forTypes.length }].concat(H.Lib.facets('type', forTypes))
        .map((f) => `<option value="${f.id}"${st.type === f.id ? ' selected' : ''}>${e(f.name)} (${f.n})</option>`).join('');
    }
    function renderList() {
      const list = H.Lib.filter(st);
      $('.lib-n').textContent = `${list.length} ${list.length === 1 ? 'sonido' : 'sonidos'} de Harmony`;
      $('.lib-list').innerHTML = list.length ? list.map((s) => `<li class="lib-item cat-${s.cat}" draggable="true" data-id="${e(s.id)}">
          <button class="ibtn lib-play" type="button" data-lib="prev" aria-label="Escuchar ${e(s.name)}">${U.icon('play')}</button>
          <span class="lib-main"><b>${e(s.name)} <i class="lib-badge mono">Harmony</i></b><span class="lib-meta">${e(H.Lib.meta(s))}</span><span class="lib-tags mono">${s.tags.map(e).join(' · ')}</span></span>
          <button class="btn btn-sm lib-add" type="button" data-lib="add" title="${e(s.notes)}">${U.icon('plus')}<span>${e(opts.addLabel ? opts.addLabel(s) : 'A un pad')}</span></button>
        </li>`).join('')
        : `<li class="fine">${e(opts.empty || 'Nada coincide con la búsqueda.')}</li>`;
      paint();
    }
    function paint() {
      if (!el.isConnected) return;
      el.querySelectorAll('.lib-item').forEach((li) => {
        const p = H.PadAudio.previewState(key(li.dataset.id)), b = li.querySelector('.lib-play');
        b.innerHTML = U.icon(p.playing ? 'stop' : 'play');
        b.classList.toggle('is-on', p.playing); b.classList.toggle('is-loading', p.loading);
        b.setAttribute('aria-label', (p.playing ? 'Parar ' : 'Escuchar ') + li.querySelector('b').firstChild.textContent.trim());
        li.classList.toggle('is-playing', p.playing);
      });
    }

    el.addEventListener('input', (ev) => { if (ev.target.id === pre + '-q') { st.q = ev.target.value; renderList(); } });
    el.addEventListener('change', (ev) => { if (ev.target.id === pre + '-type') { st.type = ev.target.value; renderList(); } });
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-lib]'); if (!b) return;
      const a = b.dataset.lib, li = b.closest('.lib-item'), s = li && H.Lib.get(li.dataset.id);
      if (a === 'style') { st.style = b.dataset.v; st.type = 'all'; renderFilters(); renderList(); }
      else if (a === 'prev') H.PadAudio.preview(key(s.id), src(s.id)).catch((err) => U.toast(H.PadAudio.message(err)));
      else if (a === 'add' && opts.onAdd) opts.onAdd(s);
    });
    el.addEventListener('dragstart', (ev) => {
      const li = ev.target.closest && ev.target.closest('.lib-item'); if (!li) return;
      ev.dataTransfer.setData('text/x-harmony-sample', li.dataset.id);
      ev.dataTransfer.setData('text/plain', H.Lib.get(li.dataset.id).name);
      ev.dataTransfer.effectAllowed = 'copy';
    });
    const offs = [U.on('pads:preview', paint), U.on('pads:voice', (k) => { if (k === 'preview') paint(); }), U.on('pads:load', paint)];
    // si el panel desaparece del documento, deja de escuchar
    const guard = setInterval(() => { if (!el.isConnected) { offs.forEach((f) => f()); clearInterval(guard); } }, 5000);

    renderFilters(); renderList();
    return { refresh: renderList, focus: () => $('input').focus() };
  };
})();
