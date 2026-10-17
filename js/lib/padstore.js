/* HARMONY · persistencia del Soundpad, solo en este navegador (sin servidor ni cuentas)
   - La configuración (bancos, nombres, colores, volúmenes, teclas) va en localStorage: es pequeña.
   - Los archivos de audio del usuario van en IndexedDB, como Blob: sobreviven a la recarga y no salen del equipo.
     Si IndexedDB no está disponible (navegación privada en algunos navegadores, almacenamiento bloqueado),
     se guardan solo en memoria y la interfaz lo dice: duran hasta cerrar la pestaña.
   - Las muestras del catálogo (Deezer) nunca se guardan: sus condiciones lo prohíben. Solo se guarda la referencia. */
(function () {
  const H = (window.H = window.H || {});
  const U = H.U;
  const KEY = 'pads';
  const DB = 'harmony', STORE = 'padfiles';

  const mem = new Map();          // id → { id, name, type, size, blob }: respaldo en memoria
  let dbp = null, persistent = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      let req;
      try { req = window.indexedDB && indexedDB.open(DB, 1); } catch (e) { req = null; }
      if (!req) { persistent = false; resolve(null); return; }
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => { persistent = true; resolve(req.result); };
      req.onerror = req.onblocked = () => { persistent = false; resolve(null); };
    });
    return dbp;
  }
  const tx = (db, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(st, (v) => { out = v; })).catch(reject);
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error || new Error('IndexedDB'));
  });

  const S = (H.PadStore = {
    /* true · false · null (aún no se sabe) */
    persistent: () => persistent,
    ready: () => open().then(() => persistent),

    loadState() { return H.Banks.normalize(U.store.get(KEY, null)); },
    saveState: U.debounce((s) => U.store.set(KEY, s), 150),
    saveNow(s) { U.store.set(KEY, s); },

    /* Guarda un archivo del usuario y devuelve su id */
    async putFile(file) {
      const rec = { id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: file.name || 'archivo', type: file.type || '', size: file.size || 0, blob: file, added: Date.now() };
      mem.set(rec.id, rec);
      const db = await open();
      if (db) {
        try {
          await tx(db, 'readwrite', (st) => { st.put(rec); });
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        } catch (e) { persistent = false; }   // sin espacio o bloqueado: queda en memoria
      }
      return rec.id;
    },
    async getFile(id) {
      if (mem.has(id)) return mem.get(id);
      const db = await open();
      if (!db) return null;
      try {
        const rec = await tx(db, 'readonly', (st, done) => { const r = st.get(id); r.onsuccess = () => done(r.result || null); });
        if (rec) mem.set(id, rec);
        return rec || null;
      } catch (e) { return null; }
    },
    /* Borra del navegador los archivos que ya no usa ningún pad */
    async prune(keep) {
      [...mem.keys()].forEach((id) => { if (!keep.has(id)) mem.delete(id); });
      const db = await open();
      if (!db) return 0;
      try {
        const ids = await tx(db, 'readonly', (st, done) => { const r = st.getAllKeys(); r.onsuccess = () => done(r.result || []); });
        const gone = ids.filter((id) => !keep.has(id));
        if (gone.length) await tx(db, 'readwrite', (st) => { gone.forEach((id) => st.delete(id)); });
        return gone.length;
      } catch (e) { return 0; }
    }
  });
})();
