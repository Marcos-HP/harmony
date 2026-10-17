/* HARMONY · motor de audio de dos canales
   Fuentes (sin servidor ni claves):
   - 'file'  : audio en memoria: un archivo del propio usuario (origin 'own', no sale de su dispositivo)
               o la muestra de 30 s de Deezer de un registro (origin 'deezer', ver js/audio/deezer.js).
   - 'pulse' : pulso de referencia sintetizado al BPM indicado. No es el tema.
   Cada canal (A, B) pasa por su propia tira de mesa:
     fuente → aislador de 3 bandas (graves/medios/agudos, con corte total) → filtro (paso bajo/alto)
            → fader de canal → crossfader → master → compresor → salida
   El estado de cada canal (ch.S.state) es la única verdad sobre si suena algo.
   H.Audio.S, play(), pause()… siguen apuntando al canal A: el plato simple no cambia. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;

  let ctx = null, master = null, comp = null, masterAn = null, masterBins = null, noiseBuf = null;
  const MASTER = { volume: 0.75 };
  const XF = { pos: 0, curve: 'suave' }; // pos: −1 = todo A · 0 = los dos · 1 = todo B
  const CROSS = [250, 2500];             // cortes del aislador (Hz)

  function makeCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = MASTER.volume;
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6;
      masterAn = ctx.createAnalyser(); masterAn.fftSize = 512; masterAn.smoothingTimeConstant = 0.55;
      master.connect(comp); comp.connect(masterAn); masterAn.connect(ctx.destination);
      masterBins = new Uint8Array(masterAn.frequencyBinCount);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      Object.values(CH).forEach((c) => c.build());
      applyXF();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function ensureCtx() { const c = makeCtx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); return c; }

  /* ---------- síntesis del pulso ---------- */
  const STYLE = {
    core:       { f0: 210, f1: 50, sweep: 0.11, dec: 0.32, drive: 90, off: null },
    happy:      { f0: 190, f1: 52, sweep: 0.09, dec: 0.26, drive: 40, off: 'hat' },
    industrial: { f0: 170, f1: 45, sweep: 0.12, dec: 0.38, drive: 70, off: 'metal' },
    french:     { f0: 220, f1: 52, sweep: 0.1, dec: 0.28, drive: 95, off: 'bass' },
    style:      { f0: 170, f1: 54, sweep: 0.08, dec: 0.36, drive: 45, off: 'rbass' },
    techno:     { f0: 130, f1: 48, sweep: 0.07, dec: 0.28, drive: 6, off: 'hat' },
    acid:       { f0: 130, f1: 48, sweep: 0.07, dec: 0.26, drive: 4, off: 'hat', acid: true },
    newbeat:    { f0: 120, f1: 46, sweep: 0.08, dec: 0.34, drive: 10, off: 'hat' },
    house:      { f0: 140, f1: 50, sweep: 0.07, dec: 0.26, drive: 12, off: 'bass+hat' },
    trance:     { f0: 140, f1: 50, sweep: 0.07, dec: 0.26, drive: 10, off: 'hat', acid: true }
  };
  const styleFor = (gid, fam) => ({
    'early-hardcore': 'core', 'gabber': 'core', 'millennium': 'core', 'mainstream': 'core', 'uptempo': 'core',
    'happy-hardcore': 'happy', 'industrial': 'industrial', 'frenchcore': 'french',
    'acid-house': 'acid', 'acid-techno': 'acid', 'new-beat': 'newbeat',
    'hard-techno': 'techno', 'schranz': 'techno', 'techno-raiz': 'techno',
    'hard-house': 'house', 'hard-trance': 'trance', 'us-hard-house': 'house', 'newstyle': 'house',
    'makina': 'happy', 'nu-style': 'core'
  }[gid] || (fam === 'hardstyle' ? 'style' : 'techno'));

  const curves = {};
  function curve(k) {
    if (curves[k]) return curves[k];
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return (curves[k] = c);
  }
  function kick(t, p, out) {
    const o = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper(), post = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(p.f0, t);
    o.frequency.exponentialRampToValueAtTime(p.f1, t + p.sweep);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.dec);
    sh.curve = curve(p.drive); sh.oversample = '2x';
    post.gain.value = p.drive > 30 ? 0.42 : 0.8;
    o.connect(g); g.connect(sh); sh.connect(post); post.connect(out);
    o.start(t); o.stop(t + p.dec + 0.02);
  }
  function hat(t, metal, out) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = metal ? 'bandpass' : 'highpass'; f.frequency.value = metal ? 3200 : 7500; f.Q.value = metal ? 8 : 0.7;
    g.gain.setValueAtTime(metal ? 0.5 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + (metal ? 0.09 : 0.05));
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.12);
  }
  function bass(t, len, freq, drive, out) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), sh = ctx.createWaveShaper();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    sh.curve = curve(drive);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f); f.connect(sh); sh.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  function rbass(t, len, out) {
    const o = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper();
    o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(52, t + len);
    sh.curve = curve(30);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + len * 0.85); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(sh); sh.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  const ACID = [0, 0, 12, 0, 3, 0, 15, 7, 0, 12, 0, 3, 10, 0, 12, 5];
  function acid(t, step, len, out) {
    if ((step * 7) % 5 === 3) return;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55 * Math.pow(2, ACID[step] / 12);
    f.type = 'lowpass'; f.Q.value = 14;
    const acc = step % 4 === 2;
    f.frequency.setValueAtTime(acc ? 2600 : 1500, t); f.frequency.exponentialRampToValueAtTime(260, t + len * 0.9);
    g.gain.setValueAtTime(acc ? 0.16 : 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + len * 0.95);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + len);
  }

  /* ---------- un canal de la mesa ---------- */
  function Channel(id) {
    const c = this;
    c.id = id;
    c.el = new Audio();
    c.el.preload = 'auto';
    c.url = null;
    c.media = null;
    c.n = null;
    c.S = { ch: id, kind: null, origin: null, state: 'empty', rate: 1, bend: 0, volume: MASTER.volume, bpm: null, style: null, fileName: null, error: null, startedAt: 0, grid: null, analysis: 'idle' };
    c.mix = { eq: { low: 0, mid: 0, high: 0 }, kill: { low: false, mid: false, high: false }, filter: 0, fader: 1 };
    c.P = { timer: null, next: 0, step: 0, beats: [] };
    const emit = () => { U.emit('audio', c.S); };
    c.emit = emit;
    const el = c.el;
    el.addEventListener('playing', () => { if (c.S.kind === 'file') { c.S.state = 'playing'; emit(); } });
    el.addEventListener('pause', () => { if (c.S.kind === 'file' && c.S.state !== 'ended' && c.S.state !== 'empty') { c.S.state = 'paused'; emit(); } });
    el.addEventListener('waiting', () => { if (c.S.kind === 'file' && !el.paused) { c.S.state = 'loading'; emit(); } });
    el.addEventListener('ended', () => { if (c.S.kind === 'file') { c.S.state = 'ended'; emit(); U.emit('audio:ended', { ch: id }); } });
    el.addEventListener('timeupdate', () => { if (c.S.kind === 'file') U.emit('audio:time', { ch: id }); });
    el.addEventListener('error', () => {
      if (c.S.kind !== 'file' || !el.getAttribute('src')) return;
      c.S.state = 'error';
      c.S.error = c.S.origin === 'deezer' ? 'Este navegador no puede reproducir la muestra de Deezer.' : 'Este navegador no puede reproducir ese archivo aquí. Prueba con MP3, AAC u OGG, o abre la versión local de Harmony.';
      emit();
    });
  }
  const CP = Channel.prototype;

  CP.build = function () {
    if (this.n || !ctx) return;
    const bq = (type, f, q = Math.SQRT1_2) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const n = (this.n = {});
    n.input = ctx.createGain();
    // aislador: tres bandas separadas por cruces de 24 dB/oct (dos biquads de Butterworth en serie)
    n.lowG = ctx.createGain(); n.midG = ctx.createGain(); n.highG = ctx.createGain();
    n.sum = ctx.createGain();
    const chain = (nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); };
    chain([n.input, bq('lowpass', CROSS[0]), bq('lowpass', CROSS[0]), n.lowG, n.sum]);
    chain([n.input, bq('highpass', CROSS[0]), bq('highpass', CROSS[0]), bq('lowpass', CROSS[1]), bq('lowpass', CROSS[1]), n.midG, n.sum]);
    chain([n.input, bq('highpass', CROSS[1]), bq('highpass', CROSS[1]), n.highG, n.sum]);
    n.lp = bq('lowpass', 22000, 1.1); n.hp = bq('highpass', 10, 1.1);
    n.fader = ctx.createGain(); n.xf = ctx.createGain();
    n.an = ctx.createAnalyser(); n.an.fftSize = 256; n.an.smoothingTimeConstant = 0.3;
    n.bins = new Uint8Array(n.an.fftSize);
    chain([n.sum, n.lp, n.hp, n.fader, n.xf, master]);
    n.fader.connect(n.an);
    try { this.media = ctx.createMediaElementSource(this.el); this.media.connect(n.input); this.el.volume = 1; } catch (e) { this.media = null; }
    this.applyMix();
  };

  const bandGain = (v, kill) => (kill ? 0 : v < 0 ? Math.pow(1 + v, 2) : 1 + v);
  CP.applyMix = function () {
    const n = this.n, m = this.mix;
    if (!n) return;
    const t = ctx.currentTime;
    n.lowG.gain.setTargetAtTime(bandGain(m.eq.low, m.kill.low), t, 0.01);
    n.midG.gain.setTargetAtTime(bandGain(m.eq.mid, m.kill.mid), t, 0.01);
    n.highG.gain.setTargetAtTime(bandGain(m.eq.high, m.kill.high), t, 0.01);
    const f = m.filter;
    const lpF = f < -0.02 ? 20000 * Math.pow(70 / 20000, Math.min(1, -f)) : 22000;
    const hpF = f > 0.02 ? 15 * Math.pow(9000 / 15, Math.min(1, f)) : 10;
    n.lp.frequency.setTargetAtTime(lpF, t, 0.015);
    n.hp.frequency.setTargetAtTime(hpF, t, 0.015);
    n.fader.gain.setTargetAtTime(m.fader * m.fader, t, 0.01);
  };
  CP.setEQ = function (band, v) { this.mix.eq[band] = U.clamp(v, -1, 1); this.applyMix(); };
  CP.setKill = function (band, on) { this.mix.kill[band] = !!on; this.applyMix(); };
  CP.setFilter = function (v) { this.mix.filter = U.clamp(v, -1, 1); this.applyMix(); };
  CP.setFader = function (v) { this.mix.fader = U.clamp(v, 0, 1); this.applyMix(); };

  CP.effRate = function () { return this.S.rate * (1 + this.S.bend); };
  function setPreservePitch(el, v) { el.preservesPitch = v; el.mozPreservesPitch = v; el.webkitPreservesPitch = v; }

  CP.loadFile = function (file, opts = {}) {
    this.stopPulse();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(file);
    const S = this.S;
    S.kind = 'file'; S.origin = opts.origin || 'own'; S.fileName = file.name; S.state = 'loading'; S.error = null; S.grid = null; S.analysis = 'idle';
    this.file = file;
    this.el.src = this.url;
    setPreservePitch(this.el, false); // como un tocadiscos: el pitch cambia tempo y tono
    this.el.playbackRate = this.effRate();
    ensureCtx();
    if (!this.media) this.el.volume = MASTER.volume;
    if (opts.autoplay === false) { S.state = 'paused'; this.emit(); return Promise.resolve(); }
    this.emit();
    return this.play();
  };

  /* pulso: cada canal programa sus golpes y recuerda cuándo sonaron (para la fase) */
  CP.sixteenth = function () { return 60 / (this.S.bpm * this.effRate()) / 4; };
  CP.schedule = function () {
    const p = STYLE[this.S.style] || STYLE.techno, P = this.P, out = this.n.input;
    while (P.next < ctx.currentTime + 0.12) {
      const t = P.next, st = P.step, six = this.sixteenth();
      if (st % 4 === 0) { kick(t, p, out); P.beats.push(t); if (P.beats.length > 8) P.beats.shift(); }
      if (st % 4 === 2 && p.off) {
        if (p.off === 'hat') hat(t, false, out);
        else if (p.off === 'metal') hat(t, true, out);
        else if (p.off === 'bass') bass(t, six * 1.6, 55, 60, out);
        else if (p.off === 'rbass') rbass(t, six * 1.8, out);
        else if (p.off === 'bass+hat') { bass(t, six * 1.4, 49, 8, out); hat(t, false, out); }
      }
      if (p.acid) acid(t, st, six, out);
      P.next += six; P.step = (P.step + 1) % 16;
    }
  };
  CP.stopPulse = function () { if (this.P.timer) clearInterval(this.P.timer); this.P.timer = null; };
  CP.runPulse = function () {
    this.stopPulse();
    this.P.next = ctx.currentTime + 0.06; this.P.step = 0; this.P.beats = [];
    this.P.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  };
  CP.startPulse = function (bpm, genreId, fam) {
    const S = this.S;
    if (!ensureCtx()) { S.kind = 'pulse'; S.state = 'error'; S.error = 'Este navegador no tiene Web Audio.'; this.emit(); return; }
    if (S.kind === 'file') this.el.pause();
    S.kind = 'pulse'; S.origin = null; S.bpm = bpm; S.style = styleFor(genreId, fam); S.error = null; S.fileName = null; S.grid = null; S.analysis = 'idle';
    S.state = 'playing'; S.startedAt = ctx.currentTime;
    this.runPulse();
    this.emit();
  };
  // posición en golpes del pulso: n.º de golpe + fracción, en el instante actual
  CP.pulseBeats = function () {
    const b = this.P.beats, now = ctx ? ctx.currentTime : 0;
    let last = null, idx = 0;
    for (let i = 0; i < b.length; i++) if (b[i] <= now) { last = b[i]; idx = i; }
    if (last == null) return null;
    const len = 60 / (this.S.bpm * this.effRate());
    return { frac: U.clamp((now - last) / len, 0, 0.999), last, len, next: b.slice(idx + 1) };
  };

  CP.play = function () {
    const S = this.S;
    if (S.kind === 'file') {
      ensureCtx();
      const pr = this.el.play();
      if (pr && pr.catch) pr.catch(() => { if (S.state !== 'error') { S.state = 'paused'; S.error = 'El navegador ha bloqueado la reproducción. Pulsa play otra vez.'; this.emit(); } });
      return pr;
    }
    if (S.kind === 'pulse') { if (!ensureCtx()) return; S.state = 'playing'; this.runPulse(); this.emit(); }
  };
  CP.pause = function () {
    if (this.S.kind === 'file') this.el.pause();
    else if (this.S.kind === 'pulse') { this.stopPulse(); this.S.state = 'paused'; this.emit(); }
  };
  CP.stop = function () {
    this.stopPulse();
    if (this.S.kind === 'file') { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    Object.assign(this.S, { kind: null, origin: null, state: 'empty', fileName: null, error: null, bpm: null, grid: null, analysis: 'idle' });
    this.file = null;
    this.emit();
  };
  CP.toggle = function () { if (this.S.state === 'playing' || this.S.state === 'loading') this.pause(); else this.play(); };
  CP.applyRate = function () { if (this.S.kind === 'file') this.el.playbackRate = this.effRate(); };
  CP.setRate = function (r) { this.S.rate = r; this.applyRate(); U.emit('audio:rate', { ch: this.id, rate: r }); };
  CP.setBend = function (b) { this.S.bend = U.clamp(b, -0.25, 0.25); this.applyRate(); };
  CP.seek = function (frac) { if (this.S.kind === 'file' && isFinite(this.el.duration)) this.el.currentTime = U.clamp(frac, 0, 0.999) * this.el.duration; };
  CP.time = function () {
    if (this.S.kind === 'file') return { cur: this.el.currentTime || 0, dur: isFinite(this.el.duration) ? this.el.duration : null };
    if (this.S.kind === 'pulse' && ctx) return { cur: ctx.currentTime - this.S.startedAt, dur: null };
    return { cur: 0, dur: null };
  };
  // nivel de pico del canal (0–1), tras el fader
  CP.level = function () {
    const n = this.n;
    if (!n || this.S.state !== 'playing') return 0;
    n.an.getByteTimeDomainData(n.bins);
    let pk = 0; for (let i = 0; i < n.bins.length; i++) { const v = Math.abs(n.bins[i] - 128); if (v > pk) pk = v; }
    return pk / 128;
  };

  // energía de graves del canal (0–1): hace latir el piloto de su plato
  CP.lows = function () {
    const n = this.n;
    if (!n || this.S.state !== 'playing') return 0;
    if (!n.fb) n.fb = new Uint8Array(n.an.frequencyBinCount);
    n.an.getByteFrequencyData(n.fb);
    return (n.fb[0] + n.fb[1] + n.fb[2]) / (3 * 255);
  };

  /* ---------- crossfader ---------- */
  function xfGains() {
    const t = (XF.pos + 1) / 2;
    if (XF.curve === 'corte') return [t < 0.96 ? 1 : (1 - t) / 0.04, t > 0.04 ? 1 : t / 0.04];
    return [Math.min(1, (1 - t) * 2), Math.min(1, t * 2)]; // suave: en el centro, los dos al máximo
  }
  function applyXF() {
    if (!ctx) return;
    const [a, b] = xfGains();
    CH.A.n && CH.A.n.xf.gain.setTargetAtTime(a, ctx.currentTime, 0.008);
    CH.B.n && CH.B.n.xf.gain.setTargetAtTime(b, ctx.currentTime, 0.008);
  }

  const BUS = {};
  const CH = { A: new Channel('A'), B: new Channel('B') };
  const A = CH.A;

  H.Audio = {
    ch: CH,
    get S() { return A.S; },
    loadFile: (f) => A.loadFile(f),
    startPulse: (bpm, g, fam) => A.startPulse(bpm, g, fam),
    play: () => A.play(), pause: () => A.pause(), stop: () => A.stop(), toggle: () => A.toggle(),
    setRate: (r) => A.setRate(r), seek: (f) => A.seek(f), time: () => A.time(),
    setVolume(v) {
      MASTER.volume = v; A.S.volume = v;
      if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
      Object.values(CH).forEach((c) => { if (!c.media) c.el.volume = v; });
      U.emit('audio:volume', v);
    },
    volume: () => MASTER.volume,
    level() {
      if (!masterAn || !Object.values(CH).some((c) => c.S.state === 'playing')) return 0;
      masterAn.getByteFrequencyData(masterBins);
      let s = 0; for (let i = 1; i < 7; i++) s += masterBins[i];
      return s / (6 * 255);
    },
    xf: XF,
    setCrossfader(v) { XF.pos = U.clamp(v, -1, 1); applyXF(); },
    setCurve(c) { XF.curve = c === 'corte' ? 'corte' : 'suave'; applyXF(); },
    // ¿la mesa está alterando lo que suena en A? (para avisar en el plato simple)
    mixTouched() {
      const m = A.mix, [ga] = xfGains();
      return ga < 0.999 || m.fader < 0.999 || m.filter !== 0 || Object.values(m.eq).some((v) => v !== 0) || Object.values(m.kill).some(Boolean);
    },
    resetMix() {
      Object.values(CH).forEach((c) => { c.mix = { eq: { low: 0, mid: 0, high: 0 }, kill: { low: false, mid: false, high: false }, filter: 0, fader: 1 }; c.applyMix(); });
      XF.pos = 0; applyXF();
      U.emit('mix:reset');
    },
    ctx: () => ctx,
    ensure: ensureCtx,
    /* Para otros instrumentos de Harmony (el Soundpad): crea el contexto si hace falta (puede nacer suspendido:
       el navegador solo deja sonar tras un gesto, y ensure() lo reanuda), una salida propia que entra en el máster
       (mismo volumen general y mismo compresor que la mesa) y decodificación a AudioBuffer para disparar sin espera. */
    context: makeCtx,
    bus(name) {
      if (!makeCtx()) return null;
      BUS[name] = BUS[name] || (() => { const g = ctx.createGain(); g.connect(master); return g; })();
      return BUS[name];
    },
    decode(arrayBuffer) {
      const c = makeCtx();
      if (!c) return Promise.reject(new Error('Sin Web Audio'));
      // Safari antiguo solo admite la versión con callbacks
      return new Promise((res, rej) => { const p = c.decodeAudioData(arrayBuffer, res, rej); if (p && p.then) p.then(res, rej); });
    },
    styleFor,
    hasWebAudio: () => !!(window.AudioContext || window.webkitAudioContext)
  };
})();
