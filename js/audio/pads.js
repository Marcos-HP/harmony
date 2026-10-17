/* HARMONY · audio del Soundpad
   Cada sonido se decodifica una vez a AudioBuffer (precarga) y cada disparo crea un AudioBufferSourceNode:
   arranca al instante, varios pads suenan a la vez y uno no corta a otro.
     pad → ganancia del pad → bus «pads» (volumen del Soundpad) → máster de Harmony (mismo compresor que la mesa)
   Modos: «shot» (disparo: volver a pulsar lo relanza desde el principio) y «loop» (bucle: pulsar arranca o para).
   Efectos por pad: tono (playbackRate, como un sampler), recorte (offset y duración, o loopStart/loopEnd), reverso
   (copia al revés del buffer) y grupos de corte (disparar un pad para los de su grupo).
   Fuentes: archivos del usuario (H.PadStore) y muestras de 30 s del catálogo (H.Dz, se piden a Deezer y no se guardan).
   El secuenciador (js/audio/sequencer.js) programa golpes con antelación con P.at(…, when): suenan en el instante exacto. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;

  const buf = new Map();     // clave de fuente → { state: 'loading'|'ready'|'error', buffer, error, promise }
  const voices = new Map();  // clave de voz (banco:pad) → { node, gain, t0, dur, loop }
  let bus = null, busVol = 0.85, prevKey = null, prevSrc = null;
  const PREV = 'preview';
  // cuando la escucha previa acaba sola, deja de estar «puesta»
  U.on('pads:voice', (k) => { if (k === PREV && !voices.has(PREV) && prevKey && P.status(prevSrc) !== 'loading') { prevKey = null; U.emit('pads:preview', null); } });
  const revCache = new Map(), peakCache = new Map();
  const seqV = new Map();    // voces del secuenciador (banco:pad) → { node, gain, t0, dur }: van aparte de las de los pads
  /* corta una voz del secuenciador en un instante del reloj de audio, con un fundido de ~3 ms (sin chasquido) */
  function cutAt(k, when) {
    const v = seqV.get(k); if (!v) return;
    seqV.delete(k);
    try { v.gain.gain.setTargetAtTime(0, when, 0.001); v.node.stop(when + 0.012); } catch (e) { /* ya parada */ }
  }
  /* Copia al revés de un buffer (una vez por sonido) */
  function reversed(k, b) {
    if (revCache.has(k) && revCache.get(k).src === b) return revCache.get(k).buf;
    const ctx = H.Audio.ctx(), r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c), o = r.getChannelData(c); for (let i = 0, n = d.length; i < n; i++) o[i] = d[n - 1 - i]; }
    revCache.set(k, { src: b, buf: r });
    return r;
  }

  const err = (code, message) => Object.assign(new Error(message), { code });
  const MESSAGES = {
    nofile: 'El archivo ya no está guardado en este navegador. Vuelve a cargarlo en el pad.',
    nosample: 'Ese sonido ya no está en la biblioteca de Harmony.',
    local: 'Los sonidos de Harmony se cargan desde la web: abre la versión publicada (o sírvela con un servidor local). Con el archivo abierto desde el disco, el navegador no deja leerlos.',
    fetch: 'No se ha podido descargar el sonido de Harmony. Comprueba la conexión y vuelve a intentarlo.',
    notrack: 'Ese registro ya no está en el catálogo.',
    decode: 'Este navegador no puede leer ese archivo de audio.',
    noaudio: 'Este navegador no tiene Web Audio: el Soundpad no puede sonar aquí.'
  };
  const message = (e) => (e && MESSAGES[e.code]) || (e && e.code && H.Dz ? H.Dz.message(e) : 'No se ha podido cargar el sonido.');

  function out() {
    if (!bus) { bus = H.Audio.bus('pads'); if (bus) bus.gain.value = busVol; }
    return bus;
  }

  async function bytesOf(src) {
    if (src.type === 'file') {
      const rec = await H.PadStore.getFile(src.fileId);
      if (!rec || !rec.blob) throw err('nofile', 'sin archivo');
      return rec.blob.arrayBuffer();
    }
    if (src.type === 'harmony') {
      const s = H.Lib && H.Lib.get(src.sampleId);
      if (!s) throw err('nosample', 'sin sample');
      let res;
      try { res = await fetch(H.Lib.url(s)); }
      catch (e) { throw err(location.protocol === 'file:' ? 'local' : 'fetch', e.message); }
      if (!res.ok) throw err('fetch', 'HTTP ' + res.status);
      return res.arrayBuffer();
    }
    const t = H.A.t[src.trackId];
    if (!t || !t.dz) throw err('notrack', 'sin registro');
    const f = await H.Dz.load(t);
    return f.arrayBuffer();
  }

  const P = (H.PadAudio = {
    message,
    /* Precarga: decodifica una vez y guarda el AudioBuffer en memoria. Devuelve la promesa del buffer. */
    load(src) {
      const k = H.Banks.srcKey(src);
      if (!k) return Promise.reject(err('none', 'pad vacío'));
      const cur = buf.get(k);
      if (cur && cur.state !== 'error') return cur.promise;
      if (!H.Audio.hasWebAudio()) { const e = err('noaudio', 'sin web audio'); buf.set(k, { state: 'error', error: e, promise: Promise.reject(e) }); buf.get(k).promise.catch(() => {}); return buf.get(k).promise; }
      const entry = { state: 'loading', buffer: null, error: null };
      entry.promise = bytesOf(src)
        .then((ab) => H.Audio.decode(ab).catch(() => { throw err('decode', 'decode'); }))
        .then((b) => { entry.state = 'ready'; entry.buffer = b; U.emit('pads:load', k); return b; })
        .catch((e) => { entry.state = 'error'; entry.error = e; U.emit('pads:load', k); throw e; });
      buf.set(k, entry);
      U.emit('pads:load', k);
      return entry.promise;
    },
    status(src) { const e = buf.get(H.Banks.srcKey(src)); return e ? e.state : null; },
    error(src) { const e = buf.get(H.Banks.srcKey(src)); return e && e.error ? message(e.error) : null; },
    duration(src) { const e = buf.get(H.Banks.srcKey(src)); return e && e.buffer ? e.buffer.duration : null; },
    forget(src) { const k = H.Banks.srcKey(src); if (k) { buf.delete(k); revCache.delete(k); [...peakCache.keys()].forEach((x) => { if (x.startsWith(k + '|')) peakCache.delete(x); }); } },

    /* Dispara un pad. vkey identifica la voz (banco:pad) para pararla o relanzarla sin tocar las demás.
       choke: voces de su grupo de corte, que se paran al disparar este. */
    async trigger(vkey, pad, { choke = [] } = {}) {
      if (!pad || !pad.src) return;
      const ctx = H.Audio.ensure();   // el gesto del usuario despierta el contexto
      if (!ctx || !out()) throw err('noaudio', 'sin web audio');
      const playing = voices.get(vkey);
      if (playing && pad.mode === 'loop') { P.stop(vkey); return; }
      let b;
      const e = buf.get(H.Banks.srcKey(pad.src));
      if (e && e.state === 'ready') b = e.buffer;
      else b = await P.load(pad.src);
      if (pad.reverse) b = reversed(H.Banks.srcKey(pad.src), b);
      choke.forEach((k) => P.stop(k, 0.004));
      if (playing) P.stop(vkey, 0.004, true);   // se relanza: sin avisar de que «ha parado»
      const rate = Math.pow(2, (pad.pitch || 0) / 12);
      // el recorte se mide sobre el sonido tal y como suena (al revés, si va al revés)
      const a = (pad.start || 0) * b.duration, z = (pad.end == null ? 1 : pad.end) * b.duration;
      const len = Math.max(0.005, z - a);
      const g = ctx.createGain();
      g.gain.value = pad.volume;
      const n = ctx.createBufferSource();
      n.buffer = b; n.loop = pad.mode === 'loop'; n.playbackRate.value = rate;
      if (n.loop) { n.loopStart = a; n.loopEnd = z; }
      n.connect(g); g.connect(out());
      const v = { node: n, gain: g, t0: ctx.currentTime, dur: len / rate, loop: n.loop };
      n.onended = () => { if (voices.get(vkey) === v) { voices.delete(vkey); U.emit('pads:voice', vkey); } };
      voices.set(vkey, v);
      if (n.loop) n.start(0, a); else n.start(0, a, len);
      U.emit('pads:voice', vkey);
    },
    /* Disparo programado (secuenciador): suena exactamente en `when` (reloj de audio). Solo si el sonido ya está
       decodificado: si no, lo pide y devuelve false (ese golpe se pierde; el siguiente ya suena).
       Cada pad del secuenciador es monofónico: un golpe corta el anterior del mismo pad y los de su grupo de corte,
       justo en `when`. El modo bucle no aplica: cada paso suena una vez (con su recorte). vel: 0…1 */
    at(vkey, pad, when, { vel = 1, choke = [] } = {}) {
      if (!pad || !pad.src) return false;
      const ctx = H.Audio.ctx();
      if (!ctx || !out()) return false;
      const k = H.Banks.srcKey(pad.src), e = buf.get(k);
      if (!e || e.state !== 'ready') { if (!e) P.load(pad.src).catch(() => {}); return false; }
      let b = e.buffer;
      if (pad.reverse) b = reversed(k, b);
      [vkey, ...choke].forEach((c) => cutAt(c, when));
      const rate = Math.pow(2, (pad.pitch || 0) / 12);
      const a = (pad.start || 0) * b.duration, z = (pad.end == null ? 1 : pad.end) * b.duration, len = Math.max(0.005, z - a);
      const g = ctx.createGain(), n = ctx.createBufferSource();
      g.gain.value = pad.volume * vel;
      n.buffer = b; n.playbackRate.value = rate;
      n.connect(g); g.connect(out());
      const v = { node: n, gain: g, t0: when, dur: len / rate };
      n.onended = () => { if (seqV.get(vkey) === v) seqV.delete(vkey); };
      seqV.set(vkey, v);
      n.start(Math.max(when, ctx.currentTime), a, len);
      return true;
    },
    /* Para todo lo del secuenciador, también lo ya programado */
    seqStop() {
      const ctx = H.Audio.ctx(); if (!ctx) return;
      seqV.forEach((v) => { try { v.gain.gain.cancelScheduledValues(ctx.currentTime); v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.004); v.node.stop(ctx.currentTime + 0.03); } catch (e) { /* ya parada */ } });
      seqV.clear();
    },
    /* Picos para dibujar la forma de onda (n columnas, 0…1), calculados una vez por sonido */
    peaks(src, n = 240, reverse = false) {
      const k = H.Banks.srcKey(src), e = buf.get(k);
      if (!e || !e.buffer) return null;
      const ck = k + '|' + n + (reverse ? '|r' : '');
      if (peakCache.has(ck)) return peakCache.get(ck);
      const b = e.buffer, out = new Float32Array(n), step = b.length / n;
      for (let c = 0; c < b.numberOfChannels; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) {
          let m = 0; const s0 = Math.floor(i * step), s1 = Math.min(d.length, Math.floor((i + 1) * step));
          for (let j = s0; j < s1; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; }
          if (m > out[i]) out[i] = m;
        }
      }
      if (reverse) out.reverse();
      peakCache.set(ck, out);
      return out;
    },
    /* Para una voz con un fundido muy corto (sin chasquido) */
    stop(vkey, fade = 0.012, quiet = false) {
      const v = voices.get(vkey);
      if (!v) return;
      voices.delete(vkey);
      const ctx = H.Audio.ctx();
      try {
        v.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        v.node.stop(ctx.currentTime + fade);
      } catch (e) { try { v.node.stop(); } catch (e2) { /* ya parada */ } }
      if (!quiet) U.emit('pads:voice', vkey);
    },
    stopAll() { [...voices.keys()].forEach((k) => P.stop(k)); },
    /* Escucha previa compartida por toda la web (biblioteca, sonidos): una sola voz, así nunca se acumulan.
       Volver a pedir la misma la para. */
    preview(key, src) {
      if (prevKey === key && (voices.has(PREV) || P.status(src) === 'loading')) { P.stop(PREV); prevKey = null; U.emit('pads:preview', null); return Promise.resolve(); }
      prevKey = key; prevSrc = src; U.emit('pads:preview', key);
      return P.trigger(PREV, { src, volume: 0.9, mode: 'shot', pitch: 0, start: 0, end: 1 }).catch((e) => { if (prevKey === key) { prevKey = null; U.emit('pads:preview', null); } throw e; });
    },
    stopPreview() { if (prevKey) { P.stop(PREV); prevKey = null; U.emit('pads:preview', null); } },
    /* qué se está escuchando ahora: { key, playing, loading } */
    previewState(key) { const mine = key === prevKey; return { mine, playing: mine && voices.has(PREV), loading: mine && !voices.has(PREV) }; },
    isPlaying: (vkey) => voices.has(vkey),
    anyPlaying: () => voices.size > 0,
    /* 0…1 de lo que lleva sonando (en bucle, vuelve a empezar) */
    progress(vkey) {
      const v = voices.get(vkey), ctx = H.Audio.ctx();
      if (!v || !ctx || !v.dur) return 0;
      const t = ctx.currentTime - v.t0;
      return v.loop ? (t % v.dur) / v.dur : Math.min(1, t / v.dur);
    },
    setVoiceRate(vkey, semis) { const v = voices.get(vkey), ctx = H.Audio.ctx(); if (v && ctx) v.node.playbackRate.setTargetAtTime(Math.pow(2, semis / 12), ctx.currentTime, 0.01); },
    setVoiceVolume(vkey, vol) { const v = voices.get(vkey), ctx = H.Audio.ctx(); if (v && ctx) v.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.01); },
    setVolume(v) { busVol = v; if (bus) bus.gain.setTargetAtTime(v, H.Audio.ctx().currentTime, 0.02); },
    volume: () => busVol
  });
})();
