/* HARMONY · tema claro / oscuro
   Por defecto sigue al dispositivo. Si eliges claro u oscuro, se guarda en este navegador.
   Dentro de un visor que fija su propio data-theme (el de Claude, por ejemplo), «según el dispositivo»
   respeta lo que diga el visor; si eliges uno, manda el tuyo.
   Un script mínimo en el <head> aplica la elección guardada antes de pintar, para que no parpadee. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const root = document.documentElement;
  const MODES = ['auto', 'light', 'dark'];

  let mode = U.store.get('theme', 'auto');
  if (!MODES.includes(mode)) mode = 'auto';
  // lo que había puesto el visor antes que nosotros (el script del <head> lo deja anotado)
  let host = root.getAttribute('data-host-theme') || (mode === 'auto' ? root.getAttribute('data-theme') : null);
  let mq = null;
  try { mq = matchMedia('(prefers-color-scheme: dark)'); } catch (e) { /* sin media queries: claro */ }

  const T = (H.Theme = {
    MODES,
    get mode() { return mode; },
    effective() {
      const a = root.getAttribute('data-theme');
      return a === 'dark' || a === 'light' ? a : mq && mq.matches ? 'dark' : 'light';
    },
    set(m) {
      if (!MODES.includes(m)) return;
      mode = m;
      U.store.set('theme', m);
      apply();
    },
    toggle() { T.set(T.effective() === 'dark' ? 'light' : 'dark'); }
  });

  function apply() {
    if (mode === 'auto') { if (host) root.setAttribute('data-theme', host); else root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', mode);
    U.emit('theme', T.effective());
  }

  // si el visor cambia su tema: en automático lo seguimos; si mandas tú, volvemos a poner el tuyo
  new MutationObserver(() => {
    const a = root.getAttribute('data-theme');
    if (mode === 'auto') { if (a !== host) { host = a; U.emit('theme', T.effective()); } }
    else if (a !== mode) { host = a; apply(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  if (mq) {
    const onSys = () => { if (mode === 'auto' && !host) U.emit('theme', T.effective()); };
    try { mq.addEventListener('change', onSys); } catch (e) { try { mq.addListener(onSys); } catch (err) { /* nada */ } }
  }

  apply();
})();
