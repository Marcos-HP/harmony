/* HARMONY · utilidades sin dependencias */
(function () {
  const H = (window.H = window.H || {});
  const U = (H.U = {});

  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* entre comillas latinas, salvo que el texto ya las lleve («¡Vamos!») */
  U.q = (s) => (/^[«"“]/.test(String(s)) ? String(s) : '«' + s + '»');
  U.norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.pad = (n, w = 3) => String(n).padStart(w, '0');
  // número en letra para el texto corrido (las rutas tienen 10–11 discos); a partir de veinte, en cifra
  const NUM_ES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
  U.numES = (n) => NUM_ES[n] || String(n);
  U.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  U.hmy = (t) => 'HMY·' + U.pad(t.n);
  U.decade = (y) => (y == null ? null : Math.floor(y / 10) * 10);
  U.decadeLabel = (d) => (d == null ? 'Sin año' : d < 2000 ? 'Años ' + String(d).slice(2) : d + '–' + String(d + 9).slice(2));
  U.decadeShort = (d) => (d == null ? '—' : String(d).slice(2));
  U.uniq = (a) => Array.from(new Set(a));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.fmtTime = (s) => { if (!isFinite(s) || s < 0) return '–:––'; const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

  // Hash estable para patrones generativos
  U.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // Almacenamiento por navegador: comodidad, nunca imprescindible
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('hmy.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hmy.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: seguimos en memoria */ } }
  };

  // Eventos internos
  const bus = {};
  U.on = (ev, fn) => { (bus[ev] = bus[ev] || []).push(fn); return () => { bus[ev] = bus[ev].filter((f) => f !== fn); }; };
  U.emit = (ev, data) => { (bus[ev] || []).slice().forEach((fn) => fn(data)); };

  // Iconos (trazos simples, heredan currentColor)
  const P = {
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
    next: '<path d="M5 6l9 6-9 6z" fill="currentColor" stroke="none"/><path d="M17 6v12"/>',
    prev: '<path d="M19 6l-9 6 9 6z" fill="currentColor" stroke="none"/><path d="M7 6v12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    queue: '<path d="M4 7h11M4 12h11M4 17h7M17 14v6M14 17h6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    crate: '<path d="M4 9h16v10H4zM7 9V5M11 9V4M15 9V5"/>',
    crateOn: '<path d="M4 9h16v10H4z" fill="currentColor"/><path d="M7 9V5M11 9V4M15 9V5"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    out: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M4 17h3c1.5 0 2.5-.8 3.3-2M17 4l3 3-3 3M13.7 9c.8-1.2 1.8-2 3.3-2h3"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    disc: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
    sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    branch: '<path d="M7 3v18M7 8c0 5 10 3 10 9v4"/><circle cx="7" cy="8" r="1.6" fill="currentColor"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    stop: '<path d="M6 6h12v12H6z" fill="currentColor" stroke="none"/>',
    rec: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    midi: '<circle cx="12" cy="12" r="8.5"/><circle cx="7.6" cy="12.6" r="1" fill="currentColor" stroke="none"/><circle cx="8.9" cy="9.2" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none"/><circle cx="15.1" cy="9.2" r="1" fill="currentColor" stroke="none"/><circle cx="16.4" cy="12.6" r="1" fill="currentColor" stroke="none"/><path d="M10.4 17.2h3.2"/>',
    dots: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    library: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 2.5 15.5-3.5 1z"/>',
    mixer: '<path d="M6 4v16M12 4v16M18 4v16"/><path d="M4 14h4M10 8h4M16 12h4" stroke-width="2.6"/>',
    pads: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z"/><path d="M13 13h7v7h-7z" fill="currentColor"/>'
  };
  U.icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${P[name] || ''}</svg>`;

  // Avisos breves
  U.toast = (msg) => {
    let box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  };

  U.reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
})();
