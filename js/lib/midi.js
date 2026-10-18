/* HARMONY · controlador MIDI (Web MIDI) con el mapeo de la Pioneer DDJ-FLX4 (js/lib/flx4.js)
   Lo que hace cada control:
     decks 1 y 2 → platos A y B de la mesa: PLAY/PAUSE, CUE (vuelve al principio), tempo → pitch, jog → empujar/frenar
                   (borde) y arrastrar (plato tocado, con archivos propios), SHIFT + jog → buscar
     mezclador   → EQ de 3 bandas, CFX → filtro, faders de canal y crossfader
     pads        → los 16 pads del Soundpad: deck 1 = pads 1–8, deck 2 = pads 9–16 (en cualquier modo de pads);
                   SHIFT + pad lo para. Los pads con sonido se encienden
     BEAT SYNC   → deck 1: secuenciador (tocar/parar) · deck 2: grabar en el secuenciador
     navegador   → la rueda recorre la cola (o los registros con muestra), LOAD lo carga en el plato, pulsarla abre la mesa
   Luces: PLAY, CUE, BEAT SYNC, pads y vúmetros de los dos canales. Sin sonido por auriculares (CUE de canal) de momento.
   Nada se manda a ningún sitio: la tabla habla con esta pestaña y ya. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const F = () => H.FLX4;
  const CH = (c) => H.Audio.ch[c];
  const D = () => H.Deck;

  const M = (H.Midi = {
    supported: typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess,
    status: 'off',            // off · asking · on · nodevice · denied · error
    device: null, sysex: false, log: [], error: null,
    opts: Object.assign({ auto: false, invertPitch: false, sysex: false }, U.store.get('midi', {}))
  });
  let access = null, input = null, output = null, st = null, ledTimer = 0, keepTimer = 0, bendT = {}, browseIdx = -1, warned = {};
  const sent = new Map();
  const saveOpts = () => U.store.set('midi', M.opts);
  const hex = (b) => [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  /* ---------- conexión ---------- */
  M.connect = async function ({ sysex = M.opts.sysex } = {}) {
    if (!M.supported) { M.status = 'error'; M.error = 'Este navegador no tiene Web MIDI (prueba con Chrome o Edge).'; U.emit('midi'); return false; }
    M.status = 'asking'; U.emit('midi');
    try { access = await navigator.requestMIDIAccess({ sysex }); M.sysex = sysex; }
    catch (e) {
      if (sysex) return M.connect({ sysex: false });   // sin permiso de SysEx, sin mensaje de «programa conectado»
      M.status = 'denied'; M.error = 'No hay permiso para usar dispositivos MIDI. Permítelo en el candado de la barra de direcciones.'; U.emit('midi'); return false;
    }
    access.onstatechange = () => pick();
    M.opts.auto = true; saveOpts();
    pick();
    return true;
  };
  M.disconnect = function () {
    lightsOff();
    if (input) input.onmidimessage = null;
    clearInterval(ledTimer); clearInterval(keepTimer); ledTimer = keepTimer = 0;
    if (access) access.onstatechange = null;
    access = input = output = null; M.device = null; M.status = 'off';
    M.opts.auto = false; saveOpts();
    U.emit('midi');
  };
  M.setOpt = function (k, v) {
    M.opts[k] = v; saveOpts();
    if (k === 'sysex' && access && v && !M.sysex) { const was = M.status; M.disconnect(); M.connect({ sysex: true }).then(() => { if (was === 'off') M.disconnect(); }); return; }
    keepAlive();
    U.emit('midi');
  };
  M.inputs = () => (access ? [...access.inputs.values()].map((p) => p.name) : []);
  /* elegir otra entrada a mano (otro controlador: se ve en el monitor, el mapeo es el de la FLX4) */
  M.use = function (name) { M.opts.device = name; saveOpts(); pick(); };

  function pick() {
    if (!access) return;
    const ins = [...access.inputs.values()], outs = [...access.outputs.values()];
    const want = (p) => (M.opts.device ? p.name === M.opts.device : F().is(p.name));
    const nextIn = ins.find(want) || ins.find((p) => F().is(p.name)) || null;
    if (input && input !== nextIn) input.onmidimessage = null;
    input = nextIn;
    output = input ? outs.find((p) => p.name === input.name) || outs.find((p) => F().is(p.name)) || null : null;
    sent.clear();
    if (input) {
      st = F().state();
      input.onmidimessage = onMessage;
      M.device = input.name; M.status = 'on'; M.error = null;
      if (!ledTimer) ledTimer = setInterval(lights, 70);
      keepAlive();
      // hace falta el Soundpad montado para que los pads suenen desde cualquier sección
      if (H.Sections && H.Sections.ensureSoundpad) H.Sections.ensureSoundpad();
    } else {
      M.device = null; M.status = 'nodevice';
      clearInterval(ledTimer); ledTimer = 0;
    }
    U.emit('midi');
  }
  function keepAlive() {
    clearInterval(keepTimer); keepTimer = 0;
    if (output && M.sysex && M.opts.sysex) { const send = () => { try { output.send(F().KEEPALIVE); } catch (e) { /* sin SysEx */ } }; send(); keepTimer = setInterval(send, 250); }
  }

  /* ---------- mensajes de la tabla ---------- */
  function onMessage(e) {
    const b = e.data;
    if (!b || !b.length || b[0] === 0xF0 || b[0] >= 0xF8) return;   // SysEx y reloj: fuera
    const acts = F().decode(b, st);
    if (acts.length) {
      M.log.unshift({ at: Date.now(), hex: hex(b), text: acts.map((a) => F().describe(a)).join(' · ') });
      M.log.length = Math.min(M.log.length, 60);
      monitor();
    }
    for (const a of acts) { try { apply(a); } catch (err) { /* un control que falla no tumba los demás */ console.error(err); } }
  }
  /* como mucho una vez cada `ms` (la última llamada no se pierde) */
  function throttle(fn, ms) {
    let t = 0, q = 0, last = [];
    return (...args) => { last = args; const n = Date.now(); if (n - t > ms) { t = n; fn(...last); } else if (!q) q = setTimeout(() => { q = 0; t = Date.now(); fn(...last); }, ms); };
  }
  const monitor = throttle(() => U.emit('midi:msg'), 60);

  const syncMesa = throttle(() => { if (H.Mesa && H.Mesa.built) H.Mesa.syncControls(); }, 50);
  const toastOnce = (k, msg) => { if (!warned[k]) { warned[k] = true; U.toast(msg); } };
  const browseToast = throttle((msg) => U.toast(msg), 120);

  function browseList() {
    const q = (D().queue || []).filter((id) => H.A.t[id]);
    return q.length ? q : H.A.tracks.filter((t) => t.dz).map((t) => t.id);
  }

  function apply(a) {
    const ch = a.ch;
    switch (a.t) {
      case 'play': D().togglePlay(ch); break;
      case 'cue': case 'cue-shift': {
        // sin puntos de cue en Harmony: CUE para y vuelve al principio
        const c = CH(ch);
        if (c.S.state === 'playing') D().togglePlay(ch);
        c.seek(0);
        break;
      }
      case 'tempo': {
        const R = (D().range && D().range[ch]) || 8, v = M.opts.invertPitch ? -a.v : a.v;
        D().setPitch(Math.round(v * R * 20) / 20, ch);
        break;
      }
      case 'fader': CH(ch).setFader(a.v); syncMesa(); break;
      case 'eq': CH(ch).setEQ(a.band, a.v); syncMesa(); break;
      case 'filter': CH(ch).setFilter(a.v); syncMesa(); break;
      case 'xf': H.Audio.setCrossfader(a.v); syncMesa(); break;
      case 'jog': jog(ch, a); break;
      case 'pad': {
        if (!a.on || !H.Soundpad) break;
        const i = (ch === 'A' ? 0 : 8) + a.i;
        if (a.shift) H.Soundpad.stopPad(i); else H.Soundpad.hit(i);
        break;
      }
      case 'sync': if (ch === 'A') H.Soundpad.seqToggle(); else H.Soundpad.recToggle(); break;
      case 'browse': case 'browse-shift': {
        const list = browseList(); if (!list.length) break;
        browseIdx = ((browseIdx < 0 ? -1 : browseIdx) + a.d * (a.t === 'browse-shift' ? 10 : 1) + list.length * 100) % list.length;
        const t = H.A.t[list[browseIdx]];
        browseToast(`${browseIdx + 1}/${list.length} · ${t.title} — ${t.artistLine}  (LOAD lo pone en un plato)`);
        break;
      }
      case 'load': {
        const list = browseList(), id = list[browseIdx < 0 ? 0 : browseIdx];
        if (!id) { U.toast('No hay nada que cargar: gira la rueda para elegir un registro'); break; }
        D().loadTo(ch, id);
        U.toast(`Plato ${ch}: ${H.A.t[id].title}`);
        break;
      }
      case 'browse-press': {
        if (!D().open) { D().setView('mesa'); D().openDeck(); } else D().close();
        break;
      }
      case 'headcue': toastOnce('cue', 'La escucha por auriculares (CUE de canal) todavía no está en Harmony.'); break;
      case 'trim': toastOnce('trim', 'El TRIM no tiene función en Harmony: usa el fader o la EQ.'); break;
      default: break;
    }
  }
  /* jog: el borde empuja o frena (vuelve solo al soltar), el plato tocado arrastra el archivo, con SHIFT busca */
  function jog(ch, a) {
    const c = CH(ch), file = c.S.kind === 'file' && c.el && isFinite(c.el.duration);
    if (a.how === 'scratch' && file) { c.el.currentTime = Math.max(0, Math.min(c.el.duration - 0.05, c.el.currentTime + a.d * 0.006)); return; }
    if (a.how === 'search' && file) { c.el.currentTime = Math.max(0, Math.min(c.el.duration - 0.05, c.el.currentTime + a.d * 0.12)); return; }
    c.setBend(Math.max(-0.25, Math.min(0.25, a.d * 0.006)));
    clearTimeout(bendT[ch]);
    bendT[ch] = setTimeout(() => c.setBend(0), 110);
  }

  /* ---------- luces ---------- */
  function send(msg) {
    if (!output) return;
    const k = msg[0] + ':' + msg[1];
    if (sent.get(k) === msg[2]) return;
    sent.set(k, msg[2]);
    try { output.send(msg); } catch (e) { /* desconectada */ }
  }
  function lights() {
    if (!output || !st) return;
    const L = F().led;
    for (const ch of ['A', 'B']) {
      const c = CH(ch), playing = c.S.state === 'playing';
      send(L.play(ch, playing));
      send(L.cue(ch, !!c.S.kind && !playing));
      send(L.vu(ch, playing ? Math.min(1, c.level() * 1.4) : 0));
    }
    send(L.sync('A', H.Seq && H.Seq.playing()));
    send(L.sync('B', H.Seq && H.Seq.recording && H.Seq.recording()));
    const lit = H.Soundpad && H.Soundpad.padsLit ? H.Soundpad.padsLit() : [];
    for (const ch of ['A', 'B']) {
      const mode = st.mode[ch];
      for (let i = 0; i < 8; i++) {
        const k = (ch === 'A' ? 0 : 8) + i, on = !!lit[k] && !(H.Soundpad.padPlaying(k) && Date.now() % 240 < 120);
        send(L.pad(ch, mode, i, on)); send(L.pad(ch, mode, i, on, true));
      }
    }
  }
  function lightsOff() {
    if (!output || !st) return;
    const L = F().led;
    for (const ch of ['A', 'B']) {
      send(L.play(ch, false)); send(L.cue(ch, false)); send(L.vu(ch, 0)); send(L.sync(ch, false));
      for (let i = 0; i < 8; i++) { send(L.pad(ch, st.mode[ch], i, false)); send(L.pad(ch, st.mode[ch], i, false, true)); }
    }
  }
  /* «Probar luces»: recorre los pads de los dos decks */
  M.testLights = function () {
    if (!output) return false;
    const L = F().led;
    let k = 0;
    const step = () => {
      for (const ch of ['A', 'B']) for (let i = 0; i < 8; i++) { const m = L.pad(ch, st.mode[ch], i, i === k % 8); sent.delete(m[0] + ':' + m[1]); send(m); }
      if (++k < 17) setTimeout(step, 90); else sent.clear();
    };
    step();
    return true;
  };

  /* al cargar: si ya tenía permiso y estaba conectada, vuelve sola */
  M.init = function () {
    if (!M.supported || !M.opts.auto) return;
    const q = navigator.permissions && navigator.permissions.query ? navigator.permissions.query({ name: 'midi', sysex: !!M.opts.sysex }).catch(() => null) : Promise.resolve(null);
    q.then((p) => { if (p && p.state === 'granted') M.connect(); });
  };
})();
