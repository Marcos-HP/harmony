/* HARMONY · audio del Soundpad
   Cada sonido se decodifica una vez a AudioBuffer (precarga) y cada disparo crea un AudioBufferSourceNode:
   arranca al instante, varios pads suenan a la vez y uno no corta a otro.
     pad → ganancia del pad → bus «pads» (volumen del Soundpad) → máster de Harmony (mismo compresor que la mesa)
   Modos: «shot» (disparo: volver a pulsar lo relanza desde el principio) y «loop» (bucle: pulsar arranca o para).
   Efectos por pad: tono (playbackRate, como un sampler), recorte (offset y duración, o loopStart/loopEnd), reverso
   (copia al revés del buffer) y grupos de corte (disparar un pad para los de su grupo).
   Fuentes: archivos del usuario (H.PadStore) y muestras de 30 s del catálogo (H.Dz, se piden a Deezer y no se guardan). */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;

  const buf = new Map();     // clave de fuente → { state: 'loading'|'ready'|'error', buffer, error, promise }
  const voices = new Map();  // clave de voz (banco:pad) → { node, gain, t0, dur, loop }
  let bus = null, busVol = 0.85;
  const revCache = new Map(), peakCache = new Map();
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
      if (playing) P.stop(vkey, 0.004);
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
    stop(vkey, fade = 0.012) {
      const v = voices.get(vkey);
      if (!v) return;
      voices.delete(vkey);
      const ctx = H.Audio.ctx();
      try {
        v.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        v.node.stop(ctx.currentTime + fade);
      } catch (e) { try { v.node.stop(); } catch (e2) { /* ya parada */ } }
      U.emit('pads:voice', vkey);
    },
    stopAll() { [...voices.keys()].forEach((k) => P.stop(k)); },
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
