/* Home: document "balance" card, quick tools, library stats, recent files, search */
const NEON = ['#c6ff3d', '#38bdf8', '#ff4fd8', '#ffd23f', '#3dffa2', '#a855f7', '#ff9f1c', '#ff4d5e'];
const QUICK = [
  { label: 'Scan', icon: 'scan', route: 'scan' },
  { label: 'QR / Barcode', icon: 'qr', route: 'qr' },
  { label: 'Image to PDF', icon: 'image', route: 'tool/img2pdf' },
  { label: 'Word to PDF', icon: 'file', route: 'tool/word2pdf' },
  { label: 'PDF to Word', icon: 'file', route: 'tool/pdf2word' },
  { label: 'Edit PDF', icon: 'edit', route: 'tool/edit' },
  { label: 'Sign PDF', icon: 'sign', route: 'tool/sign' },
  { label: 'All Tools', icon: 'grid', route: 'tools' },
];

Screens.home = {
  title: '<span class="brand">ProScan</span>',
  nav: 'home',
  actions: [{ icon: 'qr', label: 'Scan QR', run: () => App.go('qr') }],
  render(view) {
    view.append(el(`<div>
      <div class="search">${ic('search')}<input type="search" placeholder="Search documents" data-q></div>
      <div data-searchres class="hidden"></div>
      <div data-main>
        <div class="hero">
          <div class="label">Documents in ProScan</div>
          <div class="big"><span data-count>0</span><small>files</small></div>
          <div class="pill-chip"><span class="toggle"></span><span data-usage>0 KB · on this device</span></div>
          <div class="actions"><button class="neon-border" data-a="scan">${ic('camera')} Scan</button><button class="neon-border" data-a="imp">${ic('upload')} Import</button></div>
        </div>
        <div class="banner" data-a="qr"><div class="grow"><b>Scan QR codes & barcodes</b><span>Instant results — links, Wi-Fi, products, contacts</span></div><div class="bic">${ic('qr')}</div></div>
        <div class="section-title">Quick tools <a data-a="tools">See all</a></div>
        <div class="qgrid" data-q-grid></div>
        <div class="stat-tiles" data-stats></div>
        <div class="section-title">Recents <a data-a="all">See all</a></div>
        <div class="file-list" data-recents></div>
      </div></div>`));
    const grid = view.querySelector('[data-q-grid]');
    QUICK.forEach((q, i) => {
      const b = el(`<button class="qitem"><span class="qi" style="--c:${NEON[i % NEON.length]}">${ic(q.icon)}</span>${q.label}</button>`);
      b.onclick = () => App.go(q.route);
      grid.append(b);
    });
    view.querySelector('[data-a=scan]').onclick = () => App.go('scan');
    view.querySelector('[data-a=imp]').onclick = () => App.importFiles();
    view.querySelector('[data-a=qr]').onclick = () => App.go('qr');
    view.querySelector('[data-a=tools]').onclick = () => App.go('tools');
    view.querySelector('[data-a=all]').onclick = () => App.go('files');
    const recents = view.querySelector('[data-recents]');
    const q = view.querySelector('[data-q]'), res = view.querySelector('[data-searchres]'), main = view.querySelector('[data-main]');

    async function draw() {
      const files = (await Store.listFiles()).sort((a, b) => Math.max(b.opened, b.modified) - Math.max(a.opened, a.modified));
      const folders = await Store.listFolders();
      const bytes = files.reduce((a, f) => a + f.size, 0);
      animateNumber(view.querySelector('[data-count]'), files.length);
      view.querySelector('[data-usage]').textContent = `${fmtSize(bytes)} · on this device`;
      const pdfs = files.filter(f => Store.kindOf(f) === 'pdf').length, imgs = files.filter(f => Store.kindOf(f) === 'image').length;
      const favs = files.filter(f => f.favorite).length;
      const pct = n => files.length ? Math.round(n / files.length * 100) : 0;
      const stats = view.querySelector('[data-stats]');
      stats.innerHTML = '';
      [
        { t: 'PDF documents', v: pdfs, s: `${pct(pdfs)}%`, bar: pct(pdfs), icon: 'file', c: '#ff4d5e', go: 'files' },
        { t: 'Images', v: imgs, s: `${pct(imgs)}%`, bar: pct(imgs), icon: 'image', c: '#3dffa2', go: 'files' },
        { t: 'Folders', v: folders.length, s: '', icon: 'folder', c: '#ffd23f', go: 'files?tab=folders' },
        { t: 'Favorites', v: favs, s: '', icon: 'star', c: '#a855f7', go: 'files?tab=fav' },
      ].forEach(x => {
        const tile = el(`<button class="stile"><span class="glow-ic" style="--c:${x.c};color:${x.c}">${ic(x.icon)}</span><div class="t">${x.t}</div>
          <div class="v">${x.v}<small>${x.s}</small></div>${x.bar !== undefined ? `<div class="bar"><div style="width:${x.bar}%"></div></div>` : ''}</button>`);
        tile.onclick = () => App.go(x.go);
        stats.append(tile);
      });
      recents.innerHTML = '';
      if (!files.length) {
        recents.append(el(`<div class="empty">${ic('file')}<div>No documents yet</div><div class="small">Scan, import or convert a file to get started.</div></div>`));
      }
      files.slice(0, 12).forEach(f => recents.append(App.fileRow(f)));
      if (q.value.trim()) search();
    }
    async function search() {
      const term = q.value.trim().toLowerCase();
      main.classList.toggle('hidden', !!term); res.classList.toggle('hidden', !term);
      if (!term) return;
      const files = (await Store.listFiles()).filter(f => f.name.toLowerCase().includes(term)).sort((a, b) => b.modified - a.modified);
      res.innerHTML = '';
      res.append(el(`<div class="section-title">${files.length} result${files.length === 1 ? '' : 's'}</div>`));
      const list = el(`<div class="file-list"></div>`);
      files.forEach(f => list.append(App.fileRow(f)));
      if (!files.length) list.append(el(`<div class="empty">${ic('search')}<div>No documents match “${esc(q.value.trim())}”</div></div>`));
      res.append(list);
    }
    q.addEventListener('input', search);
    draw();
    return Store.onChange(draw);
  },
};

function animateNumber(node, to) {
  const from = +node.textContent || 0;
  if (from === to) { node.textContent = to; return; }
  const t0 = performance.now(), dur = 500;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    node.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
