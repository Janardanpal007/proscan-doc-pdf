/* App shell: hash router, top bar, shared file actions */
const App = {
  cleanup: null,
  current: null,
  backGuard: null,
  depth: 0,
  skipGuard: false,

  parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    const [path, qs] = h.split('?');
    const [name, ...params] = path.split('/');
    return { name, params: params.map(decodeURIComponent), query: Object.fromEntries(new URLSearchParams(qs || '')), key: h };
  },
  get depth() { return (history.state && history.state.d) || 0; },
  async go(path, { replace = false } = {}) {
    await Overlay.closeAll();
    this.skipGuard = true; // programmatic navigation already handled any confirmation
    const d = this.depth;
    if (replace) history.replaceState({ d }, '', '#/' + path);
    else history.pushState({ d: d + 1 }, '', '#/' + path);
    return this.onRoute();
  },
  back() {
    if (this.depth > 0) history.back();
    else this.go('home', { replace: true });
  },
  setTitle(t) { document.getElementById('title').innerHTML = t; },
  setActions(actions = []) {
    const box = document.getElementById('topActions');
    box.innerHTML = '';
    actions.forEach(a => {
      const b = el(`<button class="icon-btn" aria-label="${esc(a.label)}" title="${esc(a.label)}" ${a.id ? `data-id="${a.id}"` : ''}>${ic(a.icon)}</button>`);
      b.onclick = a.run;
      box.append(b);
    });
  },
  setBackGuard(fn) { this.backGuard = fn; },

  async onRoute() {
    const r = this.parse();
    if (this.current && r.key === this.current.key) return;
    if (this.backGuard && !this.skipGuard && this.current) {
      const prev = this.current;
      const guard = this.backGuard;
      this.backGuard = null;
      const d = this.depth;
      history.pushState({ d: d + 1 }, '', '#/' + prev.key); // stay put while asking
      const ok = await guard();
      if (!ok) { this.backGuard = guard; return; }
      this.skipGuard = true;
      history.back();
      return;
    }
    this.skipGuard = false;
    return this.render(r);
  },
  async render(r = this.parse()) {
    if (this.cleanup) { try { this.cleanup(); } catch (e) { console.error(e); } this.cleanup = null; }
    this.backGuard = null;
    const scr = Screens[r.name] || Screens.home;
    this.current = r;
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.className = scr.full ? 'full' : '';
    view.scrollTop = 0;
    document.body.classList.toggle('hide-nav', !scr.nav);
    document.getElementById('topbar').classList.toggle('hidden', !!scr.hideTopbar);
    document.querySelectorAll('#bottomnav [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === scr.nav));
    const back = document.getElementById('backBtn');
    const isTab = !!scr.nav && !(r.name === 'files' && r.query.folder);
    back.hidden = isTab;
    this.setTitle(scr.title);
    this.setActions(scr.actions || []);
    view.classList.add('enter');
    setTimeout(() => view.classList.remove('enter'), 400);
    try {
      const c = await scr.render(view, r.params, r.query);
      if (this.current === r) this.cleanup = typeof c === 'function' ? c : null;
      else if (typeof c === 'function') c();
    } catch (e) {
      console.error(e);
      view.append(el(`<div class="card">Something went wrong: ${esc(e.message)}</div>`));
    }
  },

  applyTheme() {
    const t = Settings.get('theme');
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]').content = dark ? '#0b0b0f' : '#f6f6f8';
  },

  /* ---------- shared file UI ---------- */
  fileRow(f) {
    const row = el(`<div class="file-item">${thumbHtml(f)}<div class="meta"><div class="name">${esc(f.name)}</div>
      <div class="sub">${fmtDate(f.modified)}</div></div>
      <div class="amount"><b>${fmtSize(f.size)}</b>${f.favorite ? `<span class="fav">${ic('star')}</span>` : ''}</div>
      <button class="icon-btn" data-m aria-label="More">${ic('more')}</button></div>`);
    row.onclick = e => { if (!e.target.closest('[data-m]')) App.openFile(f); };
    row.querySelector('[data-m]').onclick = () => App.fileMenu(f);
    return row;
  },
  openFile(f) { this.go(`viewer/${f.id}`); },

  async fileMenu(f) {
    f = await Store.getFile(f.id) || f;
    const k = Store.kindOf(f);
    const opts = [{ value: 'open', label: 'Open', icon: 'eye' }];
    if (k === 'pdf') opts.push({ value: 'edit', label: 'Edit / annotate', icon: 'edit' }, { value: 'sign', label: 'Sign', icon: 'sign' });
    if (k === 'pdf') opts.push({ value: 'convert', label: 'Convert…', icon: 'file' }, { value: 'tools', label: 'PDF tools…', icon: 'grid' });
    if (['image', 'word', 'excel', 'ppt'].includes(k)) opts.push({ value: 'topdf', label: 'Convert to PDF', icon: 'file' });
    opts.push(
      { value: 'fav', label: f.favorite ? 'Remove from favorites' : 'Add to favorites', icon: 'star' },
      { value: 'rename', label: 'Rename', icon: 'edit' },
      { value: 'move', label: 'Move to folder', icon: 'folder' },
      { value: 'share', label: 'Share', icon: 'share' },
      { value: 'save', label: 'Save to device', icon: 'download' });
    if (k === 'pdf' || k === 'image') opts.push({ value: 'print', label: 'Print', icon: 'printer' });
    opts.push({ value: 'info', label: 'Details', icon: 'info' }, { value: 'del', label: 'Delete', icon: 'trash', danger: true });
    const v = await actionSheet(f.name, opts);
    if (!v) return;
    const blob = () => Store.getBlob(f.id);
    try {
      switch (v) {
        case 'open': return this.openFile(f);
        case 'edit': return this.go(`editor/${f.id}`);
        case 'sign': return this.go(`editor/${f.id}?tool=sign`);
        case 'topdf': return this.go(`tool/${{ image: 'img2pdf', word: 'word2pdf', excel: 'excel2pdf', ppt: 'ppt2pdf' }[k]}?file=${f.id}`);
        case 'convert': {
          const c = await actionSheet('Convert PDF', [{ value: 'pdf2word', label: 'PDF to Word (.docx)', icon: 'file' }, { value: 'pdf2img', label: 'PDF to Images', icon: 'image' }]);
          if (c) this.go(`tool/${c}?file=${f.id}`); return;
        }
        case 'tools': {
          const c = await actionSheet('PDF tools', [
            { value: 'compress', label: 'Compress', icon: 'compress' }, { value: 'extract', label: 'Extract pages', icon: 'scissors' },
            { value: 'organize', label: 'Organize pages', icon: 'pages' }, { value: 'merge', label: 'Merge with other files', icon: 'layers' },
            { value: 'watermark', label: 'Add watermark', icon: 'drop' }, { value: 'lock', label: 'Lock with password', icon: 'lock' },
            { value: 'unlock', label: 'Remove password', icon: 'unlock' }]);
          if (c) this.go(`tool/${c}?file=${f.id}`); return;
        }
        case 'fav': await Store.updateFile(f.id, { favorite: !f.favorite }, true); toast(f.favorite ? 'Removed from favorites' : 'Added to favorites'); return;
        case 'rename': {
          const n = await promptText('Rename', baseName(f.name));
          if (n && n.trim()) { const m = await Store.renameFile(f.id, n.trim().replace(/[\\/:*?"<>|]/g, '_')); toast('Renamed'); if (this.current.name === 'viewer') this.setTitle(esc(m.name)); }
          return;
        }
        case 'move': {
          const folders = await Store.listFolders();
          const target = await actionSheet('Move to', [
            { value: '__root', label: 'Main library (no folder)', icon: 'home' },
            ...folders.map(x => ({ value: x.id, label: x.name, icon: x.id === f.folderId ? 'check' : 'folder' })),
            { value: '__new', label: 'New folder…', icon: 'folderPlus' }]);
          if (!target) return;
          let id = target === '__root' ? null : target;
          if (target === '__new') { const nf = await this.newFolder(); if (!nf) return; id = nf.id; }
          await Store.updateFile(f.id, { folderId: id }); toast('Moved'); return;
        }
        case 'share': return Native.share(await blob(), f.name);
        case 'save': return Native.saveToDevice(await blob(), f.name);
        case 'print': return Native.print(await blob(), f.name);
        case 'info': {
          const folders = await Store.listFolders();
          const folder = folders.find(x => x.id === f.folderId);
          let pages = '';
          if (k === 'pdf') { try { const enc = await PdfCore.isEncrypted(await blob()); pages = enc ? 'Password protected' : (await PDFLib.PDFDocument.load(await (await blob()).arrayBuffer())).getPageCount() + ' pages'; } catch {} }
          return alertDialog(f.name, `Size: ${fmtSize(f.size)}\nType: ${f.type}${pages ? '\n' + pages : ''}\nFolder: ${folder ? folder.name : 'Main library'}\nCreated: ${fmtDate(f.created)}\nModified: ${fmtDate(f.modified)}`);
        }
        case 'del':
          if (await confirmDialog('Delete file?', `"${f.name}" will be permanently deleted.`, { okText: 'Delete', danger: true })) {
            await Store.deleteFile(f.id); toast('Deleted');
            if (['viewer', 'editor'].includes(this.current.name)) this.back();
          }
      }
    } catch (e) { alertDialog('Error', e.message); }
  },

  async newFolder() {
    const n = await promptText('New folder', '', { placeholder: 'Folder name', okText: 'Create' });
    if (!n || !n.trim()) return null;
    const f = await Store.addFolder(n.trim());
    toast('Folder created');
    return f;
  },

  async importFiles() {
    const files = await pickDeviceFiles({ multiple: true, accept: '.pdf,image/*,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt' });
    if (!files.length) return;
    const folder = this.current && this.current.name === 'files' ? this.current.query.folder || null : null;
    await withLoader('Importing…', async () => { for (const f of files) await Store.addFile(f, f.name, { folderId: folder }); });
    toast(`${files.length} file${files.length > 1 ? 's' : ''} imported`);
  },

  /* Save tool outputs into the library and show what to do next */
  async saveResults(results, { title = 'Done', note = '' } = {}) {
    const metas = [];
    await withLoader('Saving…', async () => { for (const r of results) metas.push(await Store.addFile(r.blob, r.name)); });
    const single = metas.length === 1 ? metas[0] : null;
    const v = await openDialog((box, finish) => {
      box.append(el(`<div class="center"><div class="success-ring">${ic('check')}</div>
        <h3>${esc(title)} complete</h3>${note ? `<p class="muted">${esc(note)}</p>` : ''}
        <p class="muted small">${metas.length} file${metas.length > 1 ? 's' : ''} saved to ProScan</p>
        <div class="file-list" style="text-align:left;max-height:30vh;overflow:auto">${metas.map(m => `<div class="file-item" data-id="${m.id}">${thumbHtml(m)}<div class="meta"><div class="name">${esc(m.name)}</div><div class="sub">${fmtSize(m.size)}</div></div></div>`).join('')}</div>
        <div class="btn-row wrap">${single ? `<button class="btn" data-v="open">${ic('eye')} Open</button>` : `<button class="btn" data-v="files">${ic('folder')} View files</button>`}
          <button class="btn secondary" data-v="share">${ic('share')} Share</button><button class="btn secondary" data-v="save">${ic('download')} Save${single ? '' : ' ZIP'}</button></div></div>`));
      box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => finish(b.dataset.v));
      box.querySelectorAll('[data-id]').forEach(r => r.onclick = () => finish('open:' + r.dataset.id));
    });
    if (!v) return;
    const zip = async () => {
      const z = new JSZip();
      for (let i = 0; i < results.length; i++) z.file(metas[i].name, results[i].blob);
      return z.generateAsync({ type: 'blob' });
    };
    try {
      if (v === 'open') this.go(`viewer/${single.id}`);
      else if (v.startsWith('open:')) this.go(`viewer/${v.slice(5)}`);
      else if (v === 'files') this.go('files');
      else if (v === 'share') single ? await Native.share(results[0].blob, single.name) : await Native.share(await zip(), `ProScan_${stamp()}.zip`);
      else if (v === 'save') single ? await Native.saveToDevice(results[0].blob, single.name) : await Native.saveToDevice(await zip(), `ProScan_${stamp()}.zip`);
    } catch (e) { alertDialog('Error', e.message); }
  },

  init() {
    hydrateIcons();
    document.getElementById('backBtn').innerHTML = ic('back');
    document.getElementById('backBtn').onclick = () => this.back();
    document.querySelectorAll('#bottomnav [data-nav]').forEach(b => b.onclick = () => {
      const n = b.dataset.nav;
      if (n === 'scan' || n === 'qr') return this.go(n);
      this.go(n === 'home' ? 'home' : n, { replace: this.current && !!(Screens[this.current.name] || {}).nav });
    });
    window.addEventListener('popstate', e => {
      if (Overlay._onPop(e.state)) return;
      this.onRoute();
    });
    if (!history.state) history.replaceState({ d: 0 }, '', location.hash || '#/home');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());
    this.applyTheme();
    this.render();
  },
};
window.addEventListener('DOMContentLoaded', () => App.init());
