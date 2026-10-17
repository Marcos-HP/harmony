/* HARMONY · secciones: Biblioteca · Mixer · Soundpad
   Una sola página: cambiar de sección no recarga nada ni vuelve a pintar la biblioteca (conserva filtros, vista y scroll).
   - Biblioteca: las vistas del archivo (#inicio, #catalogo, #g-…), en #view.
   - Mixer: el plato y la mesa de siempre (js/ui/deck.js), abiertos debajo de la cabecera (#mixer).
   - Soundpad: los pads (js/ui/soundpad.js), en su propio contenedor (#soundpad).
   Cambiar de sección nunca arranca audio: lo que ya suena sigue sonando. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;

  const S = (H.Sections = { current: 'biblioteca', lastLib: '' });
  let pad, view, foot, built = false, applying = false, libScroll = 0, libTitle = 'Harmony';

  S.init = function () {
    pad = document.getElementById('sp-root');
    view = document.getElementById('view');
    foot = document.querySelector('.foot');
    // alto real de la cabecera (cambia en el móvil): el mixer se abre justo debajo
    const top = document.querySelector('.top');
    const set = () => document.documentElement.style.setProperty('--top-off', top.offsetHeight + 'px');
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(top); else window.addEventListener('resize', set);
    // el plato también se abre y se cierra desde la barra inferior, la tecla D o «Poner en el plato»
    U.on('deck', (open) => {
      if (applying) return;
      if (open && S.current !== 'mixer') location.hash = 'mixer';
      else if (!open && S.current === 'mixer') location.hash = S.lastLib;
    });
    document.documentElement.dataset.section = S.current;
    paint();
  };

  S.apply = function (sec) {
    const prev = S.current;
    if (sec === prev) { if (sec === 'mixer' && !H.Deck.open) { applying = true; H.Deck.openDeck(); applying = false; } paint(); return; }
    applying = true;
    if (prev === 'biblioteca') { libScroll = window.scrollY; libTitle = document.title; }
    if (prev === 'soundpad') { H.Soundpad.hide(); pad.hidden = true; view.hidden = false; foot.hidden = false; }
    if (sec !== 'mixer' && H.Deck.open) H.Deck.close();
    if (sec === 'mixer') {
      if (!H.Deck.open) H.Deck.openDeck();
      document.title = 'Mixer · Harmony';
    } else if (sec === 'soundpad') {
      view.hidden = true; foot.hidden = true; pad.hidden = false;
      if (!built) { H.Soundpad.build(pad); built = true; }
      H.Soundpad.show();
      window.scrollTo(0, 0);
      document.title = 'Soundpad · Harmony';
    } else {
      document.title = libTitle;
      if (prev === 'soundpad') requestAnimationFrame(() => window.scrollTo(0, libScroll));
    }
    S.current = sec;
    applying = false;
    document.documentElement.dataset.section = sec;
    paint();
    U.emit('section', sec);
  };

  function paint() {
    U.$$('.sections a').forEach((a) => {
      a.setAttribute('aria-current', a.dataset.section === S.current ? 'page' : 'false');
      if (a.dataset.section === 'biblioteca') a.setAttribute('href', '#' + (S.lastLib || 'inicio'));
    });
  }
})();
