/* HARMONY · muestras de 30 s de Deezer
   El importador (tools/dz-import.mjs) solo guarda qué tema de Deezer corresponde a cada registro. Al darle a play:
     1. se pide a la API pública de Deezer la ficha del tema (JSONP: su API no admite otra cosa desde el navegador)
        y, con ella, la URL de la muestra, que caduca a los pocos minutos;
     2. se descarga la muestra (su servidor la sirve con CORS) y se entrega al motor como si fuera un archivo,
        así que pasa por el pitch de vinilo, el ecualizador, el filtro y la medición de BPM.
   El audio vive solo en la memoria de esta pestaña: nunca se guarda (las condiciones de Deezer lo prohíben).
   Uso no comercial y privado, como piden esas condiciones. */
(function () {
  const H = (window.H = window.H || {});
  const API = 'https://api.deezer.com/';
  const mem = new Map();   // id de Deezer → Promise<File>, solo durante la sesión
  // en el artefacto de Claude su política de seguridad no deja pedir nada a Deezer: ni se intenta
  let seq = 0, blocked = window.HMY_EMBED === 'claude-artifact';

  const err = (code, message) => Object.assign(new Error(message), { code });
  const MESSAGES = {
    blocked: 'Este visor no deja pedir audio a otros sitios (el de Claude, por ejemplo). La muestra suena en la versión publicada de Harmony.',
    offline: 'No hay conexión con Deezer. Comprueba la red y vuelve a darle a play.',
    gone: 'Deezer ya no tiene este tema.',
    nopreview: 'Deezer no ofrece muestra de este tema en tu país.',
    network: 'No se ha podido descargar la muestra de Deezer. Vuelve a intentarlo en un momento.',
    decode: 'La muestra de Deezer ha llegado, pero este navegador no la puede leer.'
  };

  function jsonp(path, timeout = 9000) {
    return new Promise((resolve, reject) => {
      const cb = '__hmyDz' + (++seq);
      const s = document.createElement('script');
      let done = false;
      const end = () => { done = true; clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); };
      const timer = setTimeout(() => { if (!done) { end(); reject(err(navigator.onLine === false ? 'offline' : 'network', 'timeout')); } }, timeout);
      window[cb] = (data) => { if (done) return; end(); resolve(data); };
      // un script bloqueado por la política de seguridad del visor también llega aquí
      s.onerror = () => { if (done) return; end(); reject(err(navigator.onLine === false ? 'offline' : 'blocked', 'script')); };
      s.src = API + path + (path.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
      document.head.appendChild(s);
    });
  }

  async function fetchSample(t) {
    if (blocked) throw err('blocked', 'blocked');
    let info;
    try { info = await jsonp('track/' + encodeURIComponent(t.dz.id)); }
    catch (e) { if (e.code === 'blocked') blocked = true; throw e; }
    if (!info || info.error) throw err(info && info.error && info.error.code === 800 ? 'gone' : 'network', 'api');
    if (!info.preview) throw err('nopreview', 'preview');
    let res;
    try { res = await fetch(info.preview, { mode: 'cors', credentials: 'omit' }); }
    catch (e) { throw err(navigator.onLine === false ? 'offline' : 'network', e.message); }
    if (!res.ok) throw err('network', 'HTTP ' + res.status);
    const blob = await res.blob();
    if (!blob.size) throw err('network', 'vacía');
    const name = `${t.dz.artist} — ${t.dz.title}${t.dz.version ? ' ' + t.dz.version : ''} (muestra Deezer).mp3`;
    return new File([blob], name, { type: blob.type || 'audio/mpeg' });
  }

  H.Dz = {
    has: (t) => !!(t && t.dz),
    /* Promise<File> con la muestra; una sola descarga por tema y sesión */
    load(t) {
      if (!H.Dz.has(t)) return Promise.reject(err('none', 'sin muestra'));
      const k = t.dz.id;
      if (!mem.has(k)) mem.set(k, fetchSample(t).catch((e) => { mem.delete(k); throw e; }));
      return mem.get(k);
    },
    ready: (t) => H.Dz.has(t) && mem.has(t.dz.id),
    message: (e) => MESSAGES[(e && e.code) || 'network'] || MESSAGES.network,
    blocked: () => blocked,
    link: (t) => (H.Dz.has(t) ? t.dz.link : null),
    /* texto corto de dónde sale la muestra, para la interfaz */
    origin(t) {
      if (!H.Dz.has(t)) return '';
      const z = t.dz, v = z.version ? ' ' + z.version.replace(/^\((.*)\)$/, '($1)') : '';
      return `«${z.title}${v}» · ${z.album}${z.albumType === 'compile' ? ' (recopilatorio)' : ''}`;
    }
  };
})();
