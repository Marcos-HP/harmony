/* HARMONY · Biblioteca › Controlador
   Conectar un controlador MIDI (de momento, la Pioneer DDJ-FLX4), ver qué hace cada control y un monitor con lo que
   llega de la tabla, para comprobar el mapeo. La conexión es de la pestaña: sigue al cambiar de sección. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U, e = U.esc;
  let root = null, offs = [];

  const MAP = [
    ['PLAY/PAUSE', 'Arranca o para el plato A (deck 1) o B (deck 2).'],
    ['CUE', 'Para y vuelve al principio (Harmony no tiene puntos de cue).'],
    ['TEMPO', 'Pitch del plato, con su rango (±8 o ±16 %). Si va al revés, cambia «Invertir el tempo».'],
    ['JOG', 'Borde: empujar o frenar mientras gira. Plato tocado: arrastrar tu archivo. SHIFT + jog: buscar.'],
    ['EQ · CFX · faders', 'Agudos, medios y graves; CFX es el filtro (izquierda paso bajo, derecha paso alto); faders de canal y crossfader.'],
    ['PADS', 'Los 16 pads del Soundpad: deck 1 = pads 1–8, deck 2 = pads 9–16, en cualquier modo de pads. SHIFT + pad lo para. Los que tienen sonido se encienden.'],
    ['BEAT SYNC', 'Deck 1: tocar o parar el secuenciador. Deck 2: grabar en el secuenciador lo que toques con los pads.'],
    ['Rueda del navegador', 'Recorre la cola del plato (o, si está vacía, los registros con muestra); con SHIFT, de 10 en 10. LOAD lo carga en el plato de ese lado. Pulsar la rueda abre o cierra la mesa.'],
    ['Sin función todavía', 'CUE de auriculares, TRIM, LOOP, BEAT FX y SMART CFX. Salen en el monitor, así se ve que llegan.']
  ];

  H.Views.controller = function (el) {
    root = el;
    offs.forEach((f) => f()); offs = [];
    root.innerHTML = `
    <section class="page-head wrap ctl">
      <p class="mono eyebrow">Biblioteca</p>
      <h1 class="page-title">Controlador</h1>
      <p class="sec-intro">Toca Harmony con una <b>Pioneer DDJ-FLX4</b>: los dos decks llevan los platos de la mesa, el mezclador la EQ, el filtro y los faders, y los pads disparan el Soundpad. Conéctala por USB y pulsa «Conectar». Funciona en Chrome y Edge (también en Chrome para Android); Safari no tiene MIDI.</p>
    </section>
    <section class="sec wrap ctl-main">
      <div class="ctl-card"></div>
      <div class="ctl-opts"></div>
    </section>
    <section class="sec wrap">
      <header class="sec-head"><h2 class="sec-title sec-title-sm">Qué hace cada control</h2></header>
      <dl class="ctl-map">${MAP.map(([k, v]) => `<div><dt class="mono">${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>
      <p class="fine ctl-note">El sonido sale por la salida de audio del navegador. Para oírlo por la FLX4, elígela como salida de audio del equipo. Harmony no ha podido probarse con la tabla en la mano: si algo no responde como dice aquí, el monitor de abajo enseña qué manda cada control.</p>
    </section>
    <section class="sec wrap">
      <header class="sec-head sec-head-row"><h2 class="sec-title sec-title-sm">Monitor</h2>
        <div class="sec-actions"><button class="btn btn-sm" type="button" data-ctl="clear-log">Vaciar</button></div></header>
      <ol class="ctl-log mono" aria-live="off"></ol>
    </section>`;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    offs.push(U.on('midi', render), U.on('midi:msg', renderLog));
    render();
  };

  function render() {
    if (!root || !root.isConnected) return;
    const M = H.Midi, card = root.querySelector('.ctl-card');
    const msg = {
      off: 'Sin conectar.',
      asking: 'Esperando el permiso del navegador…',
      on: `Conectada: <b>${e(M.device || '')}</b>.${M.sysex && M.opts.sysex ? ' Con el mensaje de «programa conectado» (SysEx).' : ''}`,
      nodevice: 'MIDI listo, pero no veo la DDJ-FLX4. Comprueba el cable USB y que esté encendida; aparecerá sola.',
      denied: e(M.error || 'Sin permiso.'),
      error: e(M.error || 'No se ha podido conectar.')
    }[M.supported ? M.status : 'error'] || '';
    const on = M.status === 'on' || M.status === 'nodevice';
    card.innerHTML = `
      <p class="mono eyebrow">Pioneer DDJ-FLX4</p>
      <p class="ctl-state ${M.status === 'on' ? 'is-on' : ''}"><i aria-hidden="true"></i><span>${M.supported ? msg : 'Este navegador no tiene Web MIDI: prueba con Chrome o Edge en el ordenador, o con Chrome en Android.'}</span></p>
      <div class="ctl-acts">
        ${M.supported ? (on ? `<button class="btn" type="button" data-ctl="off">Desconectar</button>` : `<button class="btn btn-solid" type="button" data-ctl="on"${M.status === 'asking' ? ' disabled' : ''}>Conectar</button>`) : ''}
        ${M.status === 'on' ? `<button class="btn" type="button" data-ctl="lights">Probar luces</button><a class="btn" href="#mixer">${U.icon('mixer')} Ir a la mesa</a><a class="btn" href="#soundpad">${U.icon('pads')} Ir al Soundpad</a>` : ''}
      </div>
      ${on && M.inputs().length > 1 ? `<label class="sel mono ctl-dev"><span>Entrada</span><select id="ctl-dev">${M.inputs().map((n) => `<option${n === M.device ? ' selected' : ''}>${e(n)}</option>`).join('')}</select></label>` : ''}`;
    root.querySelector('.ctl-opts').innerHTML = `
      <label class="ctl-opt"><input type="checkbox" id="ctl-inv"${M.opts.invertPitch ? ' checked' : ''}><span><b>Invertir el tempo</b><br><span class="fine">Si al subir el fader de tempo el plato va más rápido y lo quieres al revés (o al contrario).</span></span></label>
      <label class="ctl-opt"><input type="checkbox" id="ctl-sysex"${M.opts.sysex ? ' checked' : ''}><span><b>Avisar a la tabla de que hay un programa</b><br><span class="fine">Manda cada 250 ms el mensaje que usan los programas de DJ. Prueba a activarlo si las luces o los vúmetros no responden. El navegador pedirá un permiso más (SysEx).</span></span></label>`;
    renderLog();
  }
  function renderLog() {
    if (!root || !root.isConnected) return;
    const ol = root.querySelector('.ctl-log'), L = H.Midi.log;
    ol.innerHTML = L.length ? L.slice(0, 40).map((m) => `<li><span class="ctl-hex">${e(m.hex)}</span><span>${e(m.text)}</span></li>`).join('') : '<li class="fine">Aquí aparece lo que mande la tabla al tocarla.</li>';
  }
  function onClick(ev) {
    const b = ev.target.closest('[data-ctl]'); if (!b) return;
    const a = b.dataset.ctl;
    if (a === 'on') H.Midi.connect();
    else if (a === 'off') H.Midi.disconnect();
    else if (a === 'lights') H.Midi.testLights();
    else if (a === 'clear-log') { H.Midi.log.length = 0; renderLog(); }
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.id === 'ctl-inv') H.Midi.setOpt('invertPitch', t.checked);
    else if (t.id === 'ctl-sysex') H.Midi.setOpt('sysex', t.checked);
    else if (t.id === 'ctl-dev') H.Midi.use(t.value);
  }
})();
