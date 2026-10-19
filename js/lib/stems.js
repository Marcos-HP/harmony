/* HARMONY · separación en partes (el motor del Extractor, sin interfaz)
   Prepara el audio (estéreo a 44,1 kHz, que es lo que espera el modelo), habla con el worker de workers/demucs/ y
   devuelve las cuatro partes como AudioBuffer listos para sonar: voz, batería, bajo y resto (sintes, leads, pads…).
   Todo en el navegador: la canción no se sube a ningún sitio.
   Para las pruebas se puede sustituir el worker por un motor falso: window.__HMY_STEMS_ENGINE__ = { run(msg, emit) }. */
(function () {
  const H = (window.H = window.H || {});
  const RATE = 44100;
  // el orden y los nombres de Harmony para las cuatro salidas del modelo
  const PARTS = [
    { id: 'voz', key: 'vocals', name: 'Voz', cat: 'voz' },
    { id: 'bateria', key: 'drums', name: 'Batería', cat: 'perc' },
    { id: 'bajo', key: 'bass', name: 'Bajo', cat: 'bajo' },
    { id: 'resto', key: 'other', name: 'Instrumentos', cat: 'fx' }
  ];
  let worker = null, ready = false, pending = null;

  function why() {
    if (!window.Worker || !window.OfflineAudioContext) return 'Este navegador no puede separar canciones (le falta Web Workers o Web Audio).';
    if (window.HMY_EMBED) return 'En esta versión incrustada no está el Extractor (necesita su motor aparte): ábrelo en la web publicada.';
    if (location.protocol === 'file:') return 'El Extractor necesita la web servida (GitHub Pages o un servidor local): abierto desde el disco, el navegador no deja arrancar su motor.';
    return null;
  }

  /* un canal de mensajes con el motor: el worker de verdad o el falso de las pruebas */
  let listen = () => {};   // quién escucha ahora al worker (el último que le ha hablado)
  function engine(onMsg) {
    const fake = window.__HMY_STEMS_ENGINE__;
    if (fake) return { post: (m) => setTimeout(() => fake.run(m, onMsg), 0), stop() {} };
    listen = onMsg;
    if (!worker) {
      worker = new Worker(new URL('workers/demucs/worker.js', location.href), { type: 'module' });
      worker.onmessage = (ev) => listen(ev.data);
      // si el worker no llega a arrancar, el siguiente intento lo vuelve a crear
      worker.onerror = (e) => { if (e.preventDefault) e.preventDefault(); const l = listen; worker.terminate(); worker = null; ready = false; l({ type: 'error', where: 'worker', message: e.message || 'No arranca el worker' }); };
    }
    return { post: (m, t) => worker && worker.postMessage(m, t || []), stop() { if (worker) worker.terminate(); worker = null; ready = false; } };
  }

  /* estéreo a 44,1 kHz del tramo [a, b] (segundos) */
  async function prepare(buf, a, b) {
    const dur = Math.max(0.1, b - a), n = Math.ceil(dur * RATE);
    const off = new OfflineAudioContext(2, n, RATE);
    const s = off.createBufferSource();
    s.buffer = buf; s.connect(off.destination); s.start(0, a, dur);
    const r = await off.startRendering();
    return { left: r.getChannelData(0).slice(), right: r.getChannelData(1).slice() };
  }

  const S = (H.Stems = {
    RATE, PARTS,
    unsupported: why,
    gpu: () => !!navigator.gpu,
    busy: () => !!pending,
    /* ¿está el modelo ya guardado en este navegador? */
    modelCached() {
      if (why()) return Promise.resolve(false);
      return new Promise((res) => {
        const e = engine((m) => { if (m.type === 'cached') res(!!m.value); else if (m.type === 'error') res(false); });
        e.post({ type: 'cached' });
      });
    },
    forgetModel() {
      return new Promise((res) => { const e = engine((m) => { if (m.type === 'forgotten' || m.type === 'error') res(m.type === 'forgotten'); }); e.post({ type: 'forget' }); });
    },
    /* Separa el tramo [a, b] de un AudioBuffer. onEvent recibe lo que va pasando:
         { stage: 'prepare' | 'engine' | 'cached' | 'download' | 'compile' | 'separate', loaded, total, progress, backend }
       Devuelve { a, b, rate, parts: { voz: AudioBuffer, … } } */
    separate(buf, a, b, onEvent = () => {}) {
      if (pending) return Promise.reject(new Error('Ya hay una separación en marcha'));
      const no = why(); if (no) return Promise.reject(Object.assign(new Error(no), { where: 'support' }));
      return (pending = new Promise((resolve, reject) => {
        let backend = null, sent = false;
        const fail = (m) => { pending = null; reject(Object.assign(new Error(m.message || 'error'), { where: m.where })); };
        const eng = engine(async (m) => {
          if (m.type === 'stage') { if (m.backend) backend = m.backend; onEvent({ stage: m.stage, backend }); }
          else if (m.type === 'download') onEvent({ stage: 'download', loaded: m.loaded, total: m.total });
          else if (m.type === 'nocache') onEvent({ stage: 'nocache' });
          else if (m.type === 'ready') { ready = true; backend = m.backend; go(); }
          else if (m.type === 'progress') onEvent({ stage: 'separate', progress: m.progress, segment: m.segment, segments: m.segments, backend });
          else if (m.type === 'done') {
            const ctx = H.Audio.context(), parts = {};
            for (const p of PARTS) {
              const s = m.stems[p.key], ab = ctx.createBuffer(2, s.left.length, RATE);
              ab.copyToChannel(s.left, 0); ab.copyToChannel(s.right, 1);
              parts[p.id] = ab;
            }
            pending = null;
            resolve({ a, b, rate: RATE, backend, parts });
          } else if (m.type === 'error') fail(m);
        });
        S._stop = () => { eng.stop(); pending = null; reject(Object.assign(new Error('Cancelado'), { where: 'cancel' })); };
        let audio = null;
        async function go() {
          if (sent) return; sent = true;
          try {
            if (!audio) { onEvent({ stage: 'prepare' }); audio = await prepare(buf, a, b); }
            onEvent({ stage: 'separate', progress: 0, backend });
            eng.post({ type: 'separate', left: audio.left, right: audio.right }, [audio.left.buffer, audio.right.buffer]);
          } catch (e) { fail({ where: 'prepare', message: e.message }); }
        }
        // el audio se prepara mientras arranca el motor
        onEvent({ stage: 'prepare' });
        prepare(buf, a, b).then((x) => { audio = x; if (ready) go(); else eng.post({ type: 'init' }); }, (e) => fail({ where: 'prepare', message: e.message }));
      }));
    },
    cancel() { if (S._stop) S._stop(); S._stop = null; },

    /* WAV de 16 bits de un tramo [a, b] (segundos) de uno o varios AudioBuffer sumados, con fundidos de 4 ms (sin clic) */
    wav(bufs, a, b, gains) {
      const list = Array.isArray(bufs) ? bufs : [bufs], rate = list[0].sampleRate;
      const i0 = Math.max(0, Math.floor(a * rate)), i1 = Math.min(list[0].length, Math.ceil(b * rate)), n = Math.max(1, i1 - i0);
      const L = new Float32Array(n), R = new Float32Array(n);
      list.forEach((ab, k) => {
        const g = gains ? gains[k] : 1, l = ab.getChannelData(0), r = ab.numberOfChannels > 1 ? ab.getChannelData(1) : l;
        for (let i = 0; i < n; i++) { L[i] += l[i0 + i] * g; R[i] += r[i0 + i] * g; }
      });
      const f = Math.min(Math.floor(n / 2), Math.round(0.004 * rate));
      for (let i = 0; i < f; i++) { const w = i / f; L[i] *= w; R[i] *= w; L[n - 1 - i] *= w; R[n - 1 - i] *= w; }
      const out = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, s) => [...s].forEach((c, j) => out.setUint8(o + j, c.charCodeAt(0)));
      str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
      out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, rate, true);
      out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
      const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      for (let i = 0, o = 44; i < n; i++, o += 4) { out.setInt16(o, q(L[i]), true); out.setInt16(o + 2, q(R[i]), true); }
      return new Blob([out.buffer], { type: 'audio/wav' });
    },
    /* picos (máximo por columna) para dibujar la forma de onda */
    peaks(ab, cols) {
      const out = new Float32Array(cols), step = ab.length / cols;
      for (let c = 0; c < ab.numberOfChannels; c++) {
        const d = ab.getChannelData(c);
        for (let i = 0; i < cols; i++) {
          let m = 0; const s0 = Math.floor(i * step), s1 = Math.min(d.length, Math.floor((i + 1) * step));
          for (let j = s0; j < s1; j += 3) { const v = d[j] < 0 ? -d[j] : d[j]; if (v > m) m = v; }
          if (m > out[i]) out[i] = m;
        }
      }
      return out;
    }
  });
})();
