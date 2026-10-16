/* HARMONY · medición de BPM y fase de un archivo propio (todo en el navegador)
   1. Decodifica a 11 025 Hz (poca memoria) y filtra por debajo de 150 Hz: queda el bombo.
   2. Envolvente de ataques cada ~5,8 ms (diferencia positiva de la energía).
   3. Tempo por plegado: para cada BPM se pliega la envolvente sobre un golpe; el tempo correcto
      concentra los bombos en una sola franja. Barrido grueso de 70 a 280 BPM y fino a 0,01 BPM.
   4. Octava: si a la mitad de tempo salen dos picos desiguales, el «golpe» era un contratiempo
      y el tempo real es la mitad. Si se conoce un BPM aproximado del registro, desempata.
   5. Fase: la franja ganadora da el instante del primer golpe.
   Devuelve también una onda resumida (para dibujar) y la envolvente (para comparar fases). */
(function () {
  const H = (window.H = window.H || {});

  const SR = 11025, HOP = 64, FR = SR / HOP;

  function fold(sig, rate, bpm, B) {
    const P = (60 / bpm) * rate, h = new Float32Array(B);
    for (let i = 0; i < sig.length; i++) { const v = sig[i]; if (v) h[(((i % P) / P) * B) | 0] += v; }
    return h;
  }
  const argmax = (h) => { let b = 0; for (let i = 1; i < h.length; i++) if (h[i] > h[b]) b = i; return b; };
  const mean = (h) => { let s = 0; for (let i = 0; i < h.length; i++) s += h[i]; return s / h.length; };

  function tempo(on, opts = {}) {
    // señal reducida (×2) para el barrido grueso
    const half = new Float32Array(on.length >> 1);
    for (let i = 0; i < half.length; i++) half[i] = on[2 * i] + on[2 * i + 1];
    const lo = opts.min || 70, hi = opts.max || 280;
    let best = { bpm: 0, s: -1 };
    const scores = [];
    for (let bpm = lo; bpm <= hi; bpm += 0.5) {
      const h = fold(half, FR / 2, bpm, 32), s = h[argmax(h)];
      scores.push([bpm, s]);
      if (s > best.s) best = { bpm, s };
    }
    let T = best.bpm;
    // ¿alterna fuerte/débil a este tempo? entonces los débiles son contratiempos: el tempo es la mitad
    if (T / 2 >= 60) {
      const h = fold(half, FR / 2, T / 2, 64), b1 = argmax(h);
      let h2 = 0; for (let d = -2; d <= 2; d++) h2 = Math.max(h2, h[(b1 + 32 + d + 64) % 64]);
      if (h2 / h[b1] < 0.55) T = T / 2;
    }
    // desempate con el BPM aproximado del registro (solo saltos de octava)
    if (opts.prior) {
      const cands = [T, T * 2, T / 2].filter((x) => x >= 60 && x <= 300);
      const near = cands.reduce((a, b) => (Math.abs(Math.log2(b / opts.prior)) < Math.abs(Math.log2(a / opts.prior)) ? b : a));
      if (Math.abs(Math.log2(T / opts.prior)) > 0.6) T = near;
    }
    // ajuste fino a resolución completa
    let fine = { bpm: T, s: -1, h: null };
    for (let bpm = T - 0.6; bpm <= T + 0.6; bpm += 0.01) {
      const h = fold(on, FR, bpm, 64), s = h[argmax(h)];
      if (s > fine.s) fine = { bpm, s, h };
    }
    const h = fine.h, b = argmax(h);
    const beat = 60 / fine.bpm;
    // segundos hasta el primer golpe (−5 ms: retardo medio del filtro y del ataque del bombo)
    const offset = (((((b + 0.5) / 64) * beat * FR + 0.5) / FR) - 0.005 + beat) % beat;
    const peak = h[b] / (mean(h) || 1);
    return {
      bpm: Math.round(fine.bpm * 100) / 100,
      offset,
      confidence: peak >= 4 ? 'alta' : peak >= 2.2 ? 'media' : 'baja',
      peak: Math.round(peak * 10) / 10
    };
  }

  async function analyze(file, opts = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) throw new Error('Este navegador no puede analizar audio.');
    const buf = await file.arrayBuffer();
    const dec = await new OAC(1, 1, SR).decodeAudioData(buf);
    const len = dec.length;
    // graves: solo el bombo
    const off = new OAC(1, len, SR);
    const src = off.createBufferSource(); src.buffer = dec;
    const lp1 = off.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 150;
    const lp2 = off.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 150;
    src.connect(lp1); lp1.connect(lp2); lp2.connect(off.destination); src.start();
    const low = (await off.startRendering()).getChannelData(0);
    // envolvente y ataques
    const n = Math.floor(len / HOP);
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; const o = i * HOP; for (let j = 0; j < HOP; j++) { const v = low[o + j]; s += v * v; } env[i] = Math.sqrt(s / HOP); }
    const on = new Float32Array(n);
    let mx = 0;
    for (let i = 1; i < n; i++) { const d = env[i] - env[i - 1]; on[i] = d > 0 ? d : 0; if (on[i] > mx) mx = on[i]; }
    if (mx > 0) for (let i = 0; i < n; i++) on[i] /= mx;
    const t = tempo(on, { prior: opts.prior });
    // onda resumida: pico por columna de la mezcla completa
    const cols = 720, ov = new Float32Array(cols), chs = [];
    for (let c = 0; c < dec.numberOfChannels; c++) chs.push(dec.getChannelData(c));
    const per = Math.max(1, Math.floor(len / cols));
    for (let k = 0; k < cols; k++) {
      let p = 0; const o = k * per;
      for (let j = 0; j < per; j += 4) for (const ch of chs) { const v = Math.abs(ch[o + j] || 0); if (v > p) p = v; }
      ov[k] = p;
    }
    return { ...t, env: on, envRate: FR, overview: ov, duration: dec.duration };
  }

  H.Analysis = { analyze, tempo, FR };
})();
