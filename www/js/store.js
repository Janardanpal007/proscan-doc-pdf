/* Local document library backed by IndexedDB: file metadata, blobs and folders */
const Store = (() => {
  let dbp;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('proscan', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('files', { keyPath: 'id' });
        d.createObjectStore('blobs');
        d.createObjectStore('folders', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function tx(stores, mode, fn) {
    const d = await db();
    const t = d.transaction(stores, mode);
    const out = await fn(...[].concat(stores).map(s => t.objectStore(s)));
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted')); });
    return out;
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  function mimeFor(name, fallback) {
    const e = extOf(name);
    return ({
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', csv: 'text/csv',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
      txt: 'text/plain', zip: 'application/zip',
    })[e] || fallback || 'application/octet-stream';
  }
  function kindOf(f) {
    const e = extOf(f.name);
    if (e === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(e)) return 'image';
    if (['docx', 'doc'].includes(e)) return 'word';
    if (['xlsx', 'xls', 'csv'].includes(e)) return 'excel';
    if (['pptx', 'ppt'].includes(e)) return 'ppt';
    if (e === 'txt') return 'text';
    if (e === 'zip') return 'zip';
    return 'other';
  }

  async function uniqueName(name, folderId) {
    const all = await listFiles();
    const names = new Set(all.filter(f => (f.folderId || null) === (folderId || null)).map(f => f.name.toLowerCase()));
    if (!names.has(name.toLowerCase())) return name;
    const b = baseName(name), e = extOf(name);
    for (let i = 1; ; i++) { const n = `${b} (${i})${e ? '.' + e : ''}`; if (!names.has(n.toLowerCase())) return n; }
  }

  async function addFile(blob, name, { folderId = null, thumb = null } = {}) {
    name = await uniqueName(name, folderId);
    const type = mimeFor(name, blob.type);
    if (blob.type !== type) blob = new Blob([blob], { type });
    const now = Date.now();
    const meta = { id: uid(), name, type, size: blob.size, folderId, favorite: false, created: now, modified: now, opened: now, thumb };
    await tx(['files', 'blobs'], 'readwrite', (f, b) => { f.put(meta); b.put(blob, meta.id); });
    emit();
    makeThumb(meta, blob); // async, fills in later
    return meta;
  }
  async function makeThumb(meta, blob) {
    if (meta.thumb) return;
    try {
      const k = kindOf(meta);
      let thumb = null;
      if (k === 'pdf') thumb = await PdfCore.thumbnail(blob, 120);
      else if (k === 'image') thumb = await ImgProc.thumbFromBlob(blob, 120);
      if (thumb) await updateFile(meta.id, { thumb }, true);
    } catch (e) { /* encrypted or unreadable: keep icon */ }
  }
  async function replaceBlob(id, blob, { keepThumb = false } = {}) {
    const meta = await getFile(id);
    blob = new Blob([blob], { type: meta.type });
    meta.size = blob.size; meta.modified = Date.now();
    if (!keepThumb) meta.thumb = null;
    await tx(['files', 'blobs'], 'readwrite', (f, b) => { f.put(meta); b.put(blob, id); });
    emit();
    if (!keepThumb) makeThumb(meta, blob);
    return meta;
  }
  async function getFile(id) { return tx('files', 'readonly', s => req(s.get(id))); }
  async function getBlob(id) { return tx('blobs', 'readonly', s => req(s.get(id))); }
  async function listFiles() { return tx('files', 'readonly', s => req(s.getAll())); }
  async function updateFile(id, patch, silentModified = false) {
    const r = await tx('files', 'readwrite', async s => {
      const m = await req(s.get(id));
      if (!m) return null;
      Object.assign(m, patch);
      if (!silentModified && !('opened' in patch) && !('thumb' in patch)) m.modified = Date.now();
      s.put(m); return m;
    });
    emit(); return r;
  }
  async function renameFile(id, newName) {
    const m = await getFile(id);
    const e = extOf(m.name);
    if (e && extOf(newName) !== e) newName += '.' + e;
    newName = await uniqueName(newName, m.folderId);
    return updateFile(id, { name: newName });
  }
  async function deleteFile(id) {
    await tx(['files', 'blobs'], 'readwrite', (f, b) => { f.delete(id); b.delete(id); });
    emit();
  }
  async function touch(id) { return updateFile(id, { opened: Date.now() }); }

  async function listFolders() { return tx('folders', 'readonly', s => req(s.getAll())); }
  async function addFolder(name) {
    const f = { id: uid(), name, created: Date.now() };
    await tx('folders', 'readwrite', s => s.put(f)); emit(); return f;
  }
  async function renameFolder(id, name) {
    await tx('folders', 'readwrite', async s => { const f = await req(s.get(id)); f.name = name; s.put(f); }); emit();
  }
  async function deleteFolder(id, deleteContents) {
    const files = (await listFiles()).filter(f => f.folderId === id);
    for (const f of files) deleteContents ? await deleteFile(f.id) : await updateFile(f.id, { folderId: null });
    await tx('folders', 'readwrite', s => s.delete(id)); emit();
  }
  async function clearAll() {
    await tx(['files', 'blobs', 'folders'], 'readwrite', (a, b, c) => { a.clear(); b.clear(); c.clear(); }); emit();
  }
  async function usage() {
    const files = await listFiles();
    return { count: files.length, bytes: files.reduce((a, f) => a + f.size, 0) };
  }
  return { addFile, getFile, getBlob, listFiles, updateFile, renameFile, deleteFile, replaceBlob, touch, listFolders, addFolder,
    renameFolder, deleteFolder, clearAll, usage, kindOf, mimeFor, onChange: f => { listeners.add(f); return () => listeners.delete(f); } };
})();

const Settings = {
  defaults: { theme: 'dark', scanFilter: 'magic', pageSize: 'A4', scanQuality: 0.85 },
  get(k) {
    try { const v = JSON.parse(localStorage.getItem('ps_settings') || '{}'); return k in v ? v[k] : this.defaults[k]; }
    catch { return this.defaults[k]; }
  },
  set(k, val) {
    let v = {};
    try { v = JSON.parse(localStorage.getItem('ps_settings') || '{}'); } catch {}
    v[k] = val; localStorage.setItem('ps_settings', JSON.stringify(v));
  },
};

/* Lifetime scan counter shown in Settings → About */
const ScanStats = {
  async get() {
    try { const s = JSON.parse(localStorage.getItem('ps_stats')); if (s) return s; } catch {}
    // first run after this feature shipped: count scans already in the library
    const files = await Store.listFiles();
    const docs = files.filter(f => /^Scan_/.test(f.name) && !/_edited/.test(f.name)).length;
    const s = { docs, pages: docs, since: Date.now() };
    localStorage.setItem('ps_stats', JSON.stringify(s));
    return s;
  },
  async record(pages) {
    const s = await this.get();
    s.docs += 1; s.pages += pages;
    localStorage.setItem('ps_stats', JSON.stringify(s));
  },
};
