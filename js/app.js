/* HARMONY · aplicación: rutas, ficha, caja, historial, atajos y arranque */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const e = U.esc;

  const App = (H.App = {
    cat: { f: null, view: 'list' },
    viewKey: null,
    lastView: ''
  });

  /* ---------- caja (favoritos) e historial ---------- */
  let favs = [];
  App.favs = () => favs.slice();
  App.isFav = (id) => favs.includes(id);
  App.toggleFav = (id) => {
    const t = H.A.t[id]; if (!t) return;
    if (favs.includes(id)) { favs = favs.filter((x) => x !== id); U.toast('Fuera de tu caja: ' + t.title); }
    else { favs.unshift(id); U.toast('En tu caja: ' + t.title); }
    U.store.set('fav', favs);
    U.emit('fav', id);
  };
  App.clearFavs = () => { favs = []; U.store.set('fav', favs); U.emit('fav'); };
  App.remember = (id, key) => {
    const list = U.store.get(key, []).filter((x) => x !== id);
    list.unshift(id); U.store.set(key, list.slice(0, 30));
  };

  /* ---------- rutas ---------- */
  const TITLES = { '': 'Archivo', inicio: 'Archivo', espectro: 'Espectro', generos: 'Géneros', catalogo: 'Catálogo', caja: 'Tu caja', sonidos: 'Sonidos', extractor: 'Extractor', controlador: 'Controlador' };

  function parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = h.match(/^([gatl])-(.+)$/);
    if (m) return { kind: m[1], id: m[2], raw: h };
    return { kind: 'page', id: h, raw: h };
  }

  function route() {
    const r = parse();
    if (r.kind === 't') {
      if (App.viewKey == null) render({ kind: 'page', id: '' }, '');
      openSheet(r.id);
      return;
    }
    closeSheet(true);
    // Mixer y Soundpad: la biblioteca se queda como estaba, debajo
    if (r.kind === 'page' && (r.id === 'mixer' || r.id === 'soundpad')) {
      if (App.viewKey == null) render({ kind: 'page', id: '' }, '');
      App.lastView = r.raw;
      H.Sections.apply(r.id);
      return;
    }
    H.Sections.lastLib = r.raw;
    H.Sections.apply('biblioteca');
    const key = r.kind + ':' + (r.kind === 'page' && (r.id === 'inicio' || r.id === 'espectro') ? '' : r.id);
    const scrollToSpec = r.id === 'espectro';
    if (key !== App.viewKey) render(r, key);
    App.lastView = r.raw;
    if (r.kind === 'page' && (r.id === '' || r.id === 'inicio' || r.id === 'espectro')) U.$$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === r.id ? 'page' : 'false'));
    if (scrollToSpec) {
      const n = document.getElementById('sec-espectro');
      if (n) requestAnimationFrame(() => n.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' }));
    }
  }

  function render(r, key) {
    const main = document.getElementById('view');
    main.classList.remove('enter');
    let title = 'Harmony';
    if (r.kind === 'g') { H.Views.genre(main, r.id); const g = H.A.g[r.id]; title = (g ? g.name : 'Género') + ' · Harmony'; }
    else if (r.kind === 'a') { H.Views.artist(main, r.id); const a = H.A.a[r.id]; title = (a ? a.name : 'Artista') + ' · Harmony'; }
    else if (r.kind === 'l') { H.Views.label(main, r.id); const l = H.A.l[r.id]; title = (l ? l.name : 'Sello') + ' · Harmony'; }
    else if (r.id === 'generos') { H.Views.genres(main); title = 'Géneros · Harmony'; }
    else if (r.id === 'catalogo') { H.Views.catalog(main); title = 'Catálogo · Harmony'; }
    else if (r.id === 'caja') { H.Views.crate(main); title = 'Tu caja · Harmony'; }
    else if (r.id === 'sonidos') { H.Views.sounds(main); title = 'Sonidos · Harmony'; }
    else if (r.id === 'controlador') { H.Views.controller(main); title = 'Controlador · Harmony'; }
    else if (r.id === 'extractor') { H.Views.extractor(main); title = 'Extractor · Harmony'; }
    else { H.Views.home(main); title = 'Harmony · ' + (TITLES[r.id] || 'Archivo'); }
    document.title = title;
    App.viewKey = key;
    void main.offsetWidth;
    main.classList.add('enter');
    if (r.id !== 'espectro') window.scrollTo(0, 0);
    // navegación activa
    const navKey = r.kind === 'g' ? 'generos' : r.kind === 'a' || r.kind === 'l' ? 'catalogo' : r.id === 'inicio' ? '' : r.id;
    U.$$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === navKey ? 'page' : 'false'));
  }

  App.go = (hash) => { if (location.hash === '#' + hash) route(); else location.hash = hash; };

  App.goCatalog = (patch = {}) => {
    const f = { ...H.A.defaultFilters(), sort: App.cat.f.sort === 'relevance' ? 'year-asc' : App.cat.f.sort };
    if (patch.bpm) f.bpm = patch.bpm;
    if (patch.genres) f.genres = patch.genres;
    if (patch.decades) f.decades = patch.decades;
    if (patch.fam) f.genres = H.A.genres.filter((g) => g.family === patch.fam).map((g) => g.id);
    if (patch.q) { f.q = patch.q; f.sort = 'relevance'; }
    App.cat.f = f;
    App.viewKey = null;
    App.go('catalogo');
  };

  /* ---------- ficha ---------- */
  let sheetEl, sheetOpenId = null, sheetFocus = null;
  function openSheet(id) {
    const t = H.A.t[id];
    if (!t) { U.toast('Ese registro no existe'); App.go(App.lastView || ''); return; }
    if (!sheetOpenId) sheetFocus = document.activeElement;
    sheetOpenId = id;
    const panel = sheetEl.querySelector('.sheet-panel');
    panel.innerHTML = H.C.sheet(t);
    panel.scrollTop = 0;
    sheetEl.hidden = false;
    document.documentElement.classList.add('sheet-open');
    requestAnimationFrame(() => sheetEl.classList.add('in'));
    panel.querySelector('.sh-close').focus({ preventScroll: true });
    App.remember(id, 'viewed');
    document.title = t.title + ' · Harmony';
  }
  function closeSheet(fromRoute) {
    if (!sheetOpenId) return;
    sheetOpenId = null;
    sheetEl.classList.remove('in');
    document.documentElement.classList.remove('sheet-open');
    setTimeout(() => { if (!sheetOpenId) sheetEl.hidden = true; }, 240);
    if (sheetFocus && sheetFocus.isConnected && sheetFocus.focus) sheetFocus.focus({ preventScroll: true });
    if (!fromRoute) App.go(App.lastView || '');
  }
  App.openTrack = (id) => App.go('t-' + id);
  App.closeSheet = () => closeSheet(false);

  /* ---------- sorpréndeme ---------- */
  App.surprise = () => {
    const recent = U.store.get('viewed', []).slice(0, 12).concat(U.store.get('played', []).slice(0, 6));
    const lastId = (H.Deck && H.Deck.current && H.Deck.current.id) || recent[0];
    const pick = H.A.surprise({ last: lastId ? H.A.t[lastId] : null, recent });
    U.toast('Sorpréndeme · ' + pick.why);
    App.openTrack(pick.t.id);
  };

  /* ---------- delegación de acciones ---------- */
  function onClick(ev) {
    const b = ev.target.closest('[data-play],[data-enqueue],[data-enqueue-many],[data-fav],[data-open],[data-surprise],[data-route],[data-decade],[data-cat-genre],[data-shortcuts]');
    if (!b) return;
    const d = b.dataset;
    if (d.play) {
      H.Deck.cue(d.play, { open: !!d.openDeck });
      const t = H.A.t[d.play];
      const smp = H.Deck.sampleState ? H.Deck.sampleState('A') : null;
      if (!d.openDeck && smp && smp.state === 'loading') U.toast('En el plato: ' + t.title + ' · muestra de 30 s de Deezer');
      else if (!d.openDeck && H.Audio.S.kind == null) U.toast('En el plato: ' + t.title + '. Sin audio en Harmony: usa el pulso, un archivo tuyo o escúchalo fuera.');
      if (d.openDeck) closeSheet(false);
    }
    else if (d.enqueue) H.Deck.enqueue(d.enqueue);
    else if (d.enqueueMany) H.Deck.enqueue(d.enqueueMany.split(','));
    else if (d.fav) {
      App.toggleFav(d.fav);
      const on = App.isFav(d.fav);
      U.$$(`[data-fav="${d.fav}"]`).forEach((x) => {
        x.setAttribute('aria-pressed', on);
        if (x.classList.contains('btn') || x.classList.contains('chip')) x.innerHTML = U.icon(on ? 'crateOn' : 'crate') + (x.classList.contains('chip') ? (on ? ' En tu caja' : ' Guardar en tu caja') : on ? ' En tu caja' : ' Caja');
        else x.innerHTML = U.icon(on ? 'crateOn' : 'crate');
      });
    }
    else if (d.open) { ev.preventDefault(); App.openTrack(d.open); }
    else if (b.hasAttribute('data-surprise')) App.surprise();
    else if (d.route) { const r = H.A.routes.find((x) => x.id === d.route); if (r) H.Deck.enqueue(r.steps.map((s) => s[0]), { label: '«' + r.title + '»' }); }
    else if (d.decade) App.goCatalog({ decades: [+d.decade] });
    else if (d.catGenre) App.goCatalog({ genres: [d.catGenre] });
    else if (b.hasAttribute('data-shortcuts')) toggleHelp(true);
  }

  /* ---------- atajos de teclado ---------- */
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const a = document.activeElement;
    // Soundpad a la vista: sus teclas mandan (y Esc cancela el cambio de tecla de un pad)
    const pads = H.Sections.current === 'soundpad' && !sheetOpenId && help.hidden;
    if (pads && H.Soundpad.capturing() && H.Soundpad.key(ev)) { ev.preventDefault(); return; }
    if (ev.key === 'Escape') {
      if (!help.hidden) { toggleHelp(false); return; }
      if (sheetOpenId) { closeSheet(false); return; }
      if (H.Deck.open) { H.Deck.close(); return; }
      return;
    }
    if (typing(a)) return;
    if (pads && H.Soundpad.key(ev)) { ev.preventDefault(); return; }
    const k = ev.key.toLowerCase();
    // en la mesa: arrancar platos, empujar/frenar y crossfader
    if (H.Deck.open && H.Deck.view === 'mesa' && H.Mesa && H.Mesa.key(ev, true)) { ev.preventDefault(); return; }
    if (H.Deck.open && k === 'm') { H.Deck.setView(H.Deck.view === 'mesa' ? 'plato' : 'mesa'); return; }
    if (k === '/') { ev.preventDefault(); App.focusSearch(); }
    else if (k === ' ' && (!a || a === document.body || !a.closest('button,a,[role=slider],summary,label'))) { ev.preventDefault(); H.Deck.togglePlay(); }
    else if (k === 's') App.surprise();
    else if (k === 'n') H.Deck.next();
    else if (k === 'p') H.Deck.prev();
    else if (k === 'd') H.Deck.toggleOpen();
    else if (k === 'f') { const id = sheetOpenId || (H.Deck.current && H.Deck.current.id); if (id) App.toggleFav(id); }
    else if (k === '?') toggleHelp();
    else if (k === 't') { App.setTheme(H.Theme.effective() === 'dark' ? 'light' : 'dark'); U.toast(H.Theme.effective() === 'dark' ? 'Tema oscuro' : 'Tema claro'); }
    else return;
  }
  App.focusSearch = () => {
    const go = () => { const i = document.getElementById('cat-q'); if (i) { i.focus(); i.select(); } };
    if (App.viewKey !== 'page:catalogo') { App.go('catalogo'); setTimeout(go, 30); } else go();
  };

  /* ---------- tema: según el dispositivo, claro u oscuro ---------- */
  const THEME_NAME = { auto: 'según el dispositivo', light: 'claro', dark: 'oscuro' };
  App.setTheme = (m) => {
    const root = document.documentElement;
    if (!U.reducedMotion()) { root.classList.add('theme-fade'); clearTimeout(App._tf); App._tf = setTimeout(() => root.classList.remove('theme-fade'), 450); }
    H.Theme.set(m);
  };
  function themeUI() {
    const btn = document.getElementById('top-theme'), menu = document.getElementById('theme-menu');
    const items = () => [...menu.querySelectorAll('[data-theme-set]')];
    const paint = () => {
      const m = H.Theme.mode, eff = H.Theme.effective();
      btn.innerHTML = U.icon(m === 'auto' ? 'auto' : m === 'dark' ? 'moon' : 'sun');
      const label = `Tema: ${THEME_NAME[m]}${m === 'auto' ? ', ahora ' + THEME_NAME[eff] : ''} (tecla T)`;
      btn.setAttribute('aria-label', label);
      btn.title = label;
      items().forEach((b) => b.setAttribute('aria-checked', b.dataset.themeSet === m));
      menu.querySelector('small').textContent = 'Ahora ' + THEME_NAME[eff];
    };
    const open = (on) => {
      menu.hidden = !on;
      btn.setAttribute('aria-expanded', on);
      if (on) (menu.querySelector('[aria-checked="true"]') || items()[0]).focus();
    };
    btn.addEventListener('click', () => open(menu.hidden));
    menu.addEventListener('click', (ev) => { const b = ev.target.closest('[data-theme-set]'); if (!b) return; App.setTheme(b.dataset.themeSet); open(false); btn.focus(); });
    menu.addEventListener('keydown', (ev) => {
      const list = items(), i = list.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); list[(i + (ev.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus(); }
      else if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); list[ev.key === 'Home' ? 0 : list.length - 1].focus(); }
      else if (ev.key === 'Escape') { ev.stopPropagation(); open(false); btn.focus(); }
      else if (ev.key === 'Tab') open(false);
      ev.stopPropagation();
    });
    document.addEventListener('pointerdown', (ev) => { if (!menu.hidden && !ev.target.closest('.theme-pick')) open(false); });
    U.on('theme', paint);
    paint();
  }

  let help;
  function toggleHelp(force) {
    const on = force != null ? force : help.hidden;
    help.hidden = !on;
    if (on) help.querySelector('button').focus();
  }

  /* ---------- estructura fija ---------- */
  function shell() {
    document.body.insertAdjacentHTML('afterbegin', `
      <button class="skip" type="button" id="skip">Saltar al contenido</button>
      <header class="top">
        <div class="top-in wrap">
          <a class="brand" href="#inicio" aria-label="Harmony, inicio"><span class="brand-w">HARMONY</span><span class="brand-s mono">Archivo de música dura</span></a>
          <nav class="sections mono" aria-label="Secciones de Harmony">
            <a href="#inicio" data-section="biblioteca">${U.icon('library')}<span>Biblioteca</span></a><a href="#mixer" data-section="mixer">${U.icon('mixer')}<span>Mixer</span></a><a href="#soundpad" data-section="soundpad">${U.icon('pads')}<span>Soundpad</span></a>
          </nav>
          <nav class="nav mono" aria-label="Biblioteca">
            <a href="#espectro" data-nav="espectro">Espectro</a><a href="#generos" data-nav="generos">Géneros</a><a href="#catalogo" data-nav="catalogo">Catálogo</a><a href="#sonidos" data-nav="sonidos">Sonidos</a><a href="#extractor" data-nav="extractor">Extractor</a><a href="#caja" data-nav="caja">Caja <span class="nav-n"></span></a>
          </nav>
          <div class="top-tools">
            <button class="ibtn" type="button" id="top-search" aria-label="Buscar (tecla /)">${U.icon('search')}</button>
            <a class="ibtn top-midi" href="#controlador" id="top-midi" aria-label="Controlador MIDI" title="Controlador MIDI (DDJ-FLX4)">${U.icon('midi')}<i aria-hidden="true"></i></a>
            <div class="theme-pick">
              <button class="ibtn" type="button" id="top-theme" aria-haspopup="menu" aria-expanded="false" aria-controls="theme-menu"></button>
              <div class="theme-menu" id="theme-menu" role="menu" aria-label="Tema" hidden>
                <button type="button" role="menuitemradio" data-theme-set="auto">${U.icon('auto')}<span>Según el dispositivo<small class="mono"></small></span></button>
                <button type="button" role="menuitemradio" data-theme-set="light">${U.icon('sun')}<span>Claro</span></button>
                <button type="button" role="menuitemradio" data-theme-set="dark">${U.icon('moon')}<span>Oscuro</span></button>
              </div>
            </div>
            <button class="btn btn-sm" type="button" data-surprise>${U.icon('shuffle')}<span>Sorpréndeme</span></button>
          </div>
        </div>
      </header>
      <main id="view" tabindex="-1"></main>
      <section id="sp-root" class="soundpad" aria-label="Soundpad" hidden></section>
      <footer class="foot wrap">
        <div class="foot-grid">
          <div><p class="foot-w">HARMONY</p><p class="fine">Edición 0.4 · prototipo. ${H.A.tracks.length} registros; cada ficha cita sus fuentes y la fecha de consulta${H.A.mbStats.applied ? ` y ${H.A.mbStats.applied} con MusicBrainz el ${H.A.mbStats.date.split('-').reverse().join('/')}. Datos de MusicBrainz bajo licencia CC0; portadas y galletas del Cover Art Archive, con los derechos de sus autores.` : '. Importación de MusicBrainz pendiente.'}${H.A.dcStats && H.A.dcStats.applied ? ` ${H.A.dcStats.applied} contrastados también con Discogs el ${H.A.dcStats.date.split('-').reverse().join('/')}: datos proporcionados por Discogs; sus imágenes, con los derechos de sus autores.` : ''}${H.Lib && H.Lib.all().length ? ` ${H.Lib.all().length} sonidos originales de Harmony con licencia CC0; la voz de base de las frases es de eSpeak NG.` : ''}</p></div>
          <div><p class="mono">Cómo leer los datos</p>${H.C.legend()}<p class="fine">Las portadas y galletas reales salen tal cual del Cover Art Archive; cuando no hay imagen, la funda es generativa y no imita la original. El número HMY es el registro del archivo, no el número de catálogo del sello.</p></div>
          <div><p class="mono">Atajos</p><button class="link-btn" type="button" data-shortcuts>Ver atajos de teclado (?)</button><p class="fine">Harmony no muestra precios ni disponibilidad, y no inventa enlaces: lo que no está verificado abre una búsqueda.${H.A.dzStats && H.A.dzStats.applied ? ' Las muestras de 30 s son de Deezer, para uso privado y no comercial; no se guardan.' : ''}</p></div>
        </div>
      </footer>
      <div id="sheet" class="sheet" hidden role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-scrim"></div><div class="sheet-panel"></div></div>
      <div id="help" class="help" hidden role="dialog" aria-modal="true" aria-label="Atajos de teclado"><div class="help-box">
        <p class="mono">Atajos de teclado</p>
        <dl>${[['/', 'Buscar en el catálogo'], ['Espacio', 'Reproducir o pausar el plato'], ['S', 'Sorpréndeme'], ['N · P', 'Siguiente · anterior de la cola'], ['D', 'Abrir o cerrar el mixer'], ['M', 'Plato o mesa (en el mixer)'], ['1 · 2', 'Mesa: arrancar o parar A · B'], ['Z · X', 'Mesa: frenar · empujar A (mantén)'], [', · .', 'Mesa: frenar · empujar B (mantén)'], ['[ · ]', 'Mesa: crossfader hacia A · B'], ['F', 'Guardar en tu caja lo que está abierto'], ['T', 'Cambiar entre tema claro y oscuro'], ['1–4 · Q–R · A–F · Z–V', 'Soundpad: disparar los pads (configurables; mandan sobre los demás atajos)'], ['Esc', 'Cerrar ficha, mixer o esta ayuda']].map(([k, v]) => `<div><dt><kbd>${k}</kbd></dt><dd>${v}</dd></div>`).join('')}</dl>
        <button class="btn" type="button">Cerrar</button></div></div>
      <div id="toasts" class="toasts" aria-live="polite"></div>`);
    sheetEl = document.getElementById('sheet');
    sheetEl.addEventListener('click', (ev) => { if (ev.target.classList.contains('sheet-scrim') || ev.target.closest('.sh-close')) closeSheet(false); });
    help = document.getElementById('help');
    help.addEventListener('click', (ev) => { if (ev.target === help || ev.target.closest('button')) toggleHelp(false); });
    document.getElementById('top-search').onclick = () => App.focusSearch();
    themeUI();
    document.getElementById('skip').onclick = () => document.getElementById('view').focus();
    const navN = () => { const n = document.querySelector('.nav-n'); if (n) n.textContent = favs.length ? favs.length : ''; };
    U.on('fav', navN); navN();
  }

  /* ---------- arranque ---------- */
  App.start = function () {
    document.documentElement.lang = 'es';
    H.A.init();
    favs = U.store.get('fav', []).filter((id) => H.A.t[id]);
    App.cat.f = H.A.defaultFilters();
    App.cat.view = U.store.get('view', 'list');
    shell();
    H.Deck.init();
    H.Sections.init();
    // controlador MIDI: el punto de la cabecera dice si hay una tabla conectada; si ya tenía permiso, se reconecta solo
    const midiDot = () => { const b = document.getElementById('top-midi'); if (b) { b.classList.toggle('is-on', H.Midi.status === 'on'); b.title = H.Midi.status === 'on' ? 'Controlador conectado: ' + H.Midi.device : 'Controlador MIDI (DDJ-FLX4)'; } };
    U.on('midi', midiDot); midiDot();
    H.Midi.init();
    document.addEventListener('click', onClick);
    // portadas reales: se muestran al cargar; si fallan (sin portada, sin red, bloqueadas) queda la funda generativa
    document.addEventListener('load', (ev) => { const i = ev.target; if (i && i.classList && i.classList.contains('cv-img')) { i.classList.add('is-loaded'); const f = i.closest('figure'); if (f) f.classList.add('has-cover'); } }, true);
    document.addEventListener('error', (ev) => { const i = ev.target; if (i && i.classList && i.classList.contains('cv-img')) (i.closest('.sh-labelart') || i.closest('.lb-real') || i).remove(); }, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', (ev) => { if (H.Deck.open && H.Deck.view === 'mesa' && H.Mesa) H.Mesa.key(ev, false); });
    window.addEventListener('hashchange', route);
    route();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.start);
  else App.start();
})();
