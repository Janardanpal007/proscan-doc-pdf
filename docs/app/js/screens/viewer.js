/* Document viewer for PDFs, images, Word, Excel, PowerPoint and text files */

/* Lazily renders all pages of a pdf.js document into container. Returns [{wrap, page, vp}] */
async function renderPdfPages(container, pdf, { widthFn, overlay = false } = {}) {
  const list = [];
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); draw(e.target._idx); }
  }, { root: container.closest('.viewer-bg') || null, rootMargin: '600px 0px' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  async function draw(i) {
    const it = list[i];
    if (it.drawn) return; it.drawn = true;
    const w = it.wrap.clientWidth || widthFn();
    try { await PdfCore.renderPage(it.page, (w * dpr) / it.vp.width, it.canvas); }
    catch (e) { console.error(e); }
  }
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const w = widthFn();
    const wrap = el(`<div class="page-wrap" style="width:${w}px;height:${(w * vp.height / vp.width).toFixed(1)}px"><canvas class="pdfc"></canvas><span class="pnum">${i} / ${pdf.numPages}</span></div>`);
    wrap._idx = i - 1;
    container.append(wrap);
    const it = { wrap, page, vp, canvas: wrap.querySelector('canvas'), drawn: false };
    list.push(it);
    io.observe(wrap);
  }
  list.resize = (w) => list.forEach(it => {
    it.wrap.style.width = w + 'px'; it.wrap.style.height = (w * it.vp.height / it.vp.width).toFixed(1) + 'px';
    it.drawn = false; io.observe(it.wrap);
  });
  list.destroy = () => io.disconnect();
  return list;
}

Screens.viewer = {
  title: 'Viewer',
  full: true,
  async render(view, [id]) {
    const meta = await Store.getFile(id);
    if (!meta) { view.append(el(`<div class="empty">${ic('file')}<div>File not found</div></div>`)); return; }
    App.setTitle(meta.name);
    Store.touch(id);
    const blob = await Store.getBlob(id);
    const kind = Store.kindOf(meta);
    const bg = el(`<div class="viewer-bg"><div class="pages"></div></div>`);
    const pagesEl = bg.querySelector('.pages');
    const bar = el(`<div class="toolbar"></div>`);
    view.append(bg, bar);
    const btn = (icon, label, fn) => { const b = el(`<button>${ic(icon)}${label}</button>`); b.onclick = fn; bar.append(b); return b; };
    let cleanup = null;

    if (kind === 'pdf') {
      let zoom = 1, pdf;
      try { ({ pdf } = await PdfCore.openJs(blob, { name: meta.name, key: id })); }
      catch (e) {
        if (e.message === 'cancelled') { history.back(); return; }
        pagesEl.append(el(`<div class="card">Could not open this PDF: ${esc(e.message)}</div>`)); return;
      }
      const widthFn = () => Math.min(900, bg.clientWidth - 24) * zoom;
      const pages = await renderPdfPages(pagesEl, pdf, { widthFn });
      App.setActions([
        { icon: 'search', label: 'Zoom', run: () => { zoom = zoom >= 2 ? 1 : zoom + 0.5; pages.resize(widthFn()); toast(`Zoom ${Math.round(zoom * 100)}%`); } },
        { icon: 'more', label: 'More', run: () => App.fileMenu(meta) },
      ]);
      btn('edit', 'Edit', () => App.go(`editor/${id}`));
      btn('sign', 'Sign', () => App.go(`editor/${id}?tool=sign`));
      btn('drop', 'Watermark', () => App.go(`tool/watermark?file=${id}`));
      btn('share', 'Share', () => Native.share(blob, meta.name).catch(e => alertDialog('Share failed', e.message)));
      btn('printer', 'Print', () => Native.print(blob, meta.name).catch(e => alertDialog('Print failed', e.message)));
      btn('compress', 'Compress', () => App.go(`tool/compress?file=${id}`));
      btn('file', 'To Word', () => App.go(`tool/pdf2word?file=${id}`));
      btn('scissors', 'Extract', () => App.go(`tool/extract?file=${id}`));
      cleanup = () => { pages.destroy(); pdf.destroy(); };
    } else if (kind === 'image') {
      const url = URL.createObjectURL(blob);
      pagesEl.append(el(`<img class="preview-img" src="${url}" alt="">`));
      App.setActions([{ icon: 'more', label: 'More', run: () => App.fileMenu(meta) }]);
      btn('file', 'To PDF', () => App.go(`tool/img2pdf?file=${id}`));
      btn('share', 'Share', () => Native.share(blob, meta.name));
      btn('printer', 'Print', () => Native.print(blob, meta.name));
      btn('download', 'Save', () => Native.saveToDevice(blob, meta.name));
      cleanup = () => URL.revokeObjectURL(url);
    } else {
      App.setActions([{ icon: 'more', label: 'More', run: () => App.fileMenu(meta) }]);
      const card = el(`<div class="card" style="width:100%;max-width:820px;overflow:auto;color:#000;background:#fff"><div class="muted center">Loading preview…</div></div>`);
      pagesEl.append(card);
      const convertRoute = { word: 'word2pdf', excel: 'excel2pdf', ppt: 'ppt2pdf' }[kind];
      if (convertRoute) btn('file', 'Convert to PDF', () => App.go(`tool/${convertRoute}?file=${id}`));
      btn('share', 'Share', () => Native.share(blob, meta.name));
      btn('download', 'Save', () => Native.saveToDevice(blob, meta.name));
      try {
        if (kind === 'word' && extOf(meta.name) === 'docx') {
          await loadScript('vendor/mammoth.browser.min.js');
          const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          card.innerHTML = `<style>${Convert.DOC_CSS}</style><div class="docx-body">${r.value || '<p><i>Empty document</i></p>'}</div>`;
        } else if (kind === 'excel') {
          await loadScript('vendor/xlsx.full.min.js');
          const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
          card.innerHTML = `<style>.xl table{border-collapse:collapse;font-size:13px}.xl td{border:1px solid #ccc;padding:3px 6px;white-space:nowrap}</style>` +
            wb.SheetNames.map(n => `<h3>${esc(n)}</h3><div class="xl">${XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}</div>`).join('');
        } else if (kind === 'ppt' && extOf(meta.name) === 'pptx') {
          card.innerHTML = `<div class="center" style="padding:20px"><div style="font-size:40px">📊</div><b>${esc(meta.name)}</b><p class="muted">Tap “Convert to PDF” to view and share the slides as a PDF.</p></div>`;
        } else if (kind === 'text') {
          card.innerHTML = `<pre style="white-space:pre-wrap;margin:0">${esc(await blob.text())}</pre>`;
        } else {
          card.innerHTML = `<div class="center" style="padding:20px"><b>${esc(meta.name)}</b><p class="muted">${fmtSize(meta.size)} · Preview is not available for this file type.</p></div>`;
        }
      } catch (e) { card.innerHTML = `<div class="muted">Preview failed: ${esc(e.message)}</div>`; }
    }
    return cleanup;
  },
};
