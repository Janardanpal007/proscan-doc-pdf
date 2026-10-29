/* Tool screens: converters and PDF tools. Route: #/tool/<name>?file=<libraryId> */

function chipGroup(options, value, onChange) {
  const row = el(`<div class="chips"></div>`);
  options.forEach(([v, label]) => {
    const c = el(`<button class="chip ${v === value ? 'active' : ''}">${esc(label)}</button>`);
    c.onclick = () => { row.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c)); onChange(v); };
    row.append(c);
  });
  return row;
}
async function renderThumbs(container, pdf, decorate) {
  const items = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const t = el(`<div class="pthumb"><div class="check">${ic('check')}</div><canvas></canvas><div>${i}</div></div>`);
    container.append(t);
    items.push(t);
    decorate && decorate(t, i - 1);
  }
  for (let i = 0; i < items.length; i++) { // render progressively
    try { await PdfCore.renderToWidth(await pdf.getPage(i + 1), 180, items[i].querySelector('canvas')); } catch {}
  }
  return items;
}
function fileCard(f) {
  return el(`<div class="file-item">${thumbHtml({ name: f.name, thumb: null })}<div class="meta"><div class="name">${esc(f.name)}</div><div class="sub">${fmtSize(f.blob.size)}</div></div></div>`);
}

/* rotated thumbnails shrink so a portrait page still fits its tile */
const rotCss = r => `rotate(${r}deg)` + (r % 180 ? ' scale(0.72)' : '');

const TOOLS = {
  img2pdf: { title: 'Image to PDF', kinds: ['image'], multiple: true, pickLabel: 'Select images',
    async setup(ui, files) {
      let size = Settings.get('pageSize'), margin = 20;
      const list = el(`<div class="thumb-grid"></div>`);
      const draw = () => {
        list.innerHTML = '';
        files.forEach((f, i) => {
          const url = f._url || (f._url = URL.createObjectURL(f.blob));
          const t = el(`<div class="pthumb"><img src="${url}" alt="" style="height:110px;object-fit:cover"><div class="small">${i + 1}</div>
            <div class="pactions"><button data-x="l">${ic('left')}</button><button data-x="d">${ic('trash')}</button><button data-x="r">${ic('right')}</button></div></div>`);
          t.querySelector('[data-x=l]').onclick = () => { if (i) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; draw(); } };
          t.querySelector('[data-x=r]').onclick = () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; draw(); } };
          t.querySelector('[data-x=d]').onclick = () => { files.splice(i, 1); draw(); };
          list.append(t);
        });
        const add = el(`<div class="pthumb" style="display:flex;align-items:center;justify-content:center;min-height:140px">${ic('plus')}</div>`);
        add.onclick = async () => { files.push(...await pickFiles({ kinds: ['image'], multiple: true, title: 'Add images' })); draw(); };
        list.append(add);
      };
      draw();
      ui.options.append(list,
        el(`<label class="lbl">Page size</label>`), chipGroup([['A4', 'A4'], ['Letter', 'Letter'], ['Legal', 'Legal'], ['Fit', 'Fit image']], size, v => size = v),
        el(`<label class="lbl">Margin</label>`), chipGroup([[0, 'None'], [20, 'Small'], [48, 'Large']], margin, v => margin = v));
      ui.name(`Images_${stamp()}`);
      return async () => {
        if (!files.length) throw new Error('Add at least one image.');
        return [{ blob: await Convert.imagesToPdf(files.map(f => f.blob), { pageSize: size, margin }), name: ui.name() + '.pdf' }];
      };
    } },

  pdf2img: { title: 'PDF to Image', kinds: ['pdf'],
    async setup(ui, [f]) {
      let fmt = 'jpeg', dpi = 150, range = '';
      ui.options.append(el(`<label class="lbl">Format</label>`), chipGroup([['jpeg', 'JPG'], ['png', 'PNG']], fmt, v => fmt = v),
        el(`<label class="lbl">Quality</label>`), chipGroup([[96, 'Standard (96 dpi)'], [150, 'High (150 dpi)'], [300, 'Print (300 dpi)']], dpi, v => dpi = v),
        el(`<label class="lbl">Pages (leave empty for all)</label>`));
      const inp = el(`<input placeholder="e.g. 1-3, 5">`); inp.oninput = () => range = inp.value; ui.options.append(inp);
      return async () => {
        let pages = null;
        if (range.trim()) { const { pdf } = await PdfCore.openJs(f.blob, { name: f.name, key: f.id }); pages = PdfCore.parseRanges(range, pdf.numPages); pdf.destroy(); }
        return Convert.pdfToImages(f.blob, f.name, { format: fmt, dpi, pages });
      };
    } },

  word2pdf: { title: 'Word to PDF', kinds: ['word'],
    async setup(ui, [f]) {
      if (extOf(f.name) === 'doc') throw new Error('Old .doc files are not supported. Open it in Word or Google Docs and save as .docx first.');
      ui.name(baseName(f.name));
      return async () => [{ blob: await Convert.wordToPdf(f.blob), name: ui.name() + '.pdf' }];
    } },

  pdf2word: { title: 'PDF to Word', kinds: ['pdf'],
    async setup(ui, [f]) {
      let mode = 'text';
      ui.options.append(el(`<label class="lbl">Conversion mode</label>`), chipGroup([['text', 'Editable text'], ['image', 'Exact layout']], mode, v => mode = v),
        el(`<p class="muted small">Editable text extracts paragraphs you can edit in Word. Scanned pages are inserted as images automatically. Exact layout keeps every page as an image.</p>`));
      ui.name(baseName(f.name));
      return async () => [{ blob: await Convert.pdfToWord(f.blob, f.name, { mode }), name: ui.name() + '.docx' }];
    } },

  excel2pdf: { title: 'Excel to PDF', kinds: ['excel'],
    async setup(ui, [f]) { ui.name(baseName(f.name)); return async () => [{ blob: await Convert.excelToPdf(f.blob), name: ui.name() + '.pdf' }]; } },

  ppt2pdf: { title: 'PPT to PDF', kinds: ['ppt'],
    async setup(ui, [f]) {
      if (extOf(f.name) === 'ppt') throw new Error('Old .ppt files are not supported. Save the presentation as .pptx first.');
      ui.name(baseName(f.name));
      return async () => [{ blob: await Pptx.pptxToPdf(f.blob), name: ui.name() + '.pdf' }];
    } },

  merge: { title: 'Merge PDF', kinds: ['pdf', 'image'], multiple: true, pickLabel: 'Select PDFs to merge',
    async setup(ui, files) {
      const list = el(`<div class="file-list"></div>`);
      const draw = () => {
        list.innerHTML = '';
        files.forEach((f, i) => {
          const r = el(`<div class="file-item">${thumbHtml({ name: f.name })}<div class="meta"><div class="name">${i + 1}. ${esc(f.name)}</div><div class="sub">${fmtSize(f.blob.size)}</div></div>
            <button class="icon-btn" data-x="u">${ic('up')}</button><button class="icon-btn" data-x="d">${ic('down')}</button><button class="icon-btn" data-x="x">${ic('close')}</button></div>`);
          r.querySelector('[data-x=u]').onclick = () => { if (i) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; draw(); } };
          r.querySelector('[data-x=d]').onclick = () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; draw(); } };
          r.querySelector('[data-x=x]').onclick = () => { files.splice(i, 1); draw(); };
          list.append(r);
        });
      };
      draw();
      const add = el(`<button class="btn secondary block" style="margin-top:10px">${ic('plus')} Add more files</button>`);
      add.onclick = async () => { files.push(...await pickFiles({ kinds: ['pdf', 'image'], multiple: true, title: 'Add files' })); draw(); };
      ui.options.append(list, add);
      ui.name(`Merged_${stamp()}`);
      return async () => {
        if (files.length < 2) throw new Error('Select at least two files to merge.');
        return [{ blob: await PdfOps.merge(files), name: ui.name() + '.pdf' }];
      };
    } },

  compress: { title: 'Compress PDF', kinds: ['pdf'],
    async setup(ui, [f]) {
      let level = 'medium', gray = false;
      ui.options.append(el(`<label class="lbl">Compression level</label>`),
        chipGroup([['low', 'Low (best quality)'], ['medium', 'Recommended'], ['high', 'Extreme (smallest)']], level, v => level = v),
        el(`<label class="row small" style="margin-top:14px"><input type="checkbox" data-g> Convert to grayscale</label>`),
        el(`<p class="muted small">Original size: <b>${fmtSize(f.blob.size)}</b></p>`));
      ui.options.querySelector('[data-g]').onchange = e => gray = e.target.checked;
      ui.name(`${baseName(f.name)}_compressed`);
      return async () => {
        const r = await PdfOps.compress(f.blob, f.name, level, { grayscale: gray });
        if (!r.improved) throw new Error(`This PDF is already well optimized (${fmtSize(r.before)}). Try the "Extreme" level.`);
        return Object.assign([{ blob: r.blob, name: ui.name() + '.pdf' }], { note: `${fmtSize(r.before)} → ${fmtSize(r.after)} (${Math.round((1 - r.after / r.before) * 100)}% smaller)` });
      };
    } },

  extract: { title: 'Extract Pages', kinds: ['pdf'],
    async setup(ui, [f]) {
      const { pdf } = await PdfCore.openJs(f.blob, { name: f.name, key: f.id });
      const sel = new Set();
      let separate = false;
      const range = el(`<input placeholder="Type pages, e.g. 1-3, 5 — or tap pages below">`);
      const grid = el(`<div class="thumb-grid" style="margin-top:12px"></div>`);
      const sync = () => grid.querySelectorAll('.pthumb').forEach((t, i) => t.classList.toggle('sel', sel.has(i)));
      range.oninput = () => { try { sel.clear(); PdfCore.parseRanges(range.value, pdf.numPages).forEach(i => sel.add(i)); } catch {} sync(); };
      ui.options.append(el(`<label class="lbl">Output</label>`), chipGroup([[false, 'One PDF'], [true, 'Separate PDF per page']], separate, v => separate = v),
        el(`<label class="lbl">Pages (${pdf.numPages} total)</label>`), range, grid);
      renderThumbs(grid, pdf, (t, i) => t.onclick = () => {
        sel.has(i) ? sel.delete(i) : sel.add(i); sync();
        range.value = [...sel].sort((a, b) => a - b).map(x => x + 1).join(', ');
      });
      ui.cleanup(() => pdf.destroy());
      return async () => {
        if (!sel.size) throw new Error('Select at least one page.');
        return PdfOps.extract(f.blob, f.name, [...sel].sort((a, b) => a - b), { separate });
      };
    } },

  organize: { title: 'Organize Pages', kinds: ['pdf'],
    async setup(ui, [f]) {
      const { pdf } = await PdfCore.openJs(f.blob, { name: f.name, key: f.id });
      const order = [...Array(pdf.numPages).keys()].map(index => ({ index, rotate: 0 }));
      const grid = el(`<div class="thumb-grid"></div>`);
      const canvases = [];
      ui.options.append(el(`<p class="muted small">Reorder, rotate or delete pages, then save.</p>`), grid);
      async function draw() {
        grid.innerHTML = '';
        order.forEach((p, k) => {
          const t = el(`<div class="pthumb" data-idx="${p.index}"><div style="overflow:hidden"><canvas style="transform:${rotCss(p.rotate)};transition:transform .2s"></canvas></div><div>Page ${p.index + 1}</div>
            <div class="pactions"><button data-x="l">${ic('left')}</button><button data-x="rot">${ic('rotate')}</button><button data-x="d">${ic('trash')}</button><button data-x="r">${ic('right')}</button></div></div>`);
          const c = t.querySelector('canvas');
          if (canvases[p.index]) { c.width = canvases[p.index].width; c.height = canvases[p.index].height; c.getContext('2d').drawImage(canvases[p.index], 0, 0); }
          t.querySelector('[data-x=l]').onclick = () => { if (k) { [order[k - 1], order[k]] = [order[k], order[k - 1]]; draw(); } };
          t.querySelector('[data-x=r]').onclick = () => { if (k < order.length - 1) { [order[k + 1], order[k]] = [order[k], order[k + 1]]; draw(); } };
          t.querySelector('[data-x=rot]').onclick = () => { p.rotate = (p.rotate + 90) % 360; c.style.transform = rotCss(p.rotate); };
          t.querySelector('[data-x=d]').onclick = () => { if (order.length === 1) return toast('A PDF needs at least one page'); order.splice(k, 1); draw(); };
          grid.append(t);
        });
      }
      draw();
      (async () => { // fill thumbnails progressively
        for (let i = 0; i < pdf.numPages; i++) {
          canvases[i] = await PdfCore.renderToWidth(await pdf.getPage(i + 1), 180);
          grid.querySelectorAll(`[data-idx="${i}"] canvas`).forEach(c => { c.width = canvases[i].width; c.height = canvases[i].height; c.getContext('2d').drawImage(canvases[i], 0, 0); });
        }
      })().catch(() => {});
      ui.cleanup(() => pdf.destroy());
      ui.name(`${baseName(f.name)}_organized`);
      return async () => [{ blob: await PdfOps.organize(f.blob, f.name, order), name: ui.name() + '.pdf' }];
    } },

  watermark: { title: 'Add Watermark', kinds: ['pdf'],
    async setup(ui, [f]) {
      const o = { text: 'CONFIDENTIAL', size: 48, color: '#e5383b', opacity: 0.3, angle: 45, position: 'center', bold: true, pages: null };
      const prev = el(`<canvas class="preview-img" style="max-height:340px;margin-bottom:12px"></canvas>`);
      const text = el(`<input value="${o.text}" maxlength="60">`);
      const size = el(`<input type="range" min="12" max="120" value="${o.size}">`);
      const op = el(`<input type="range" min="5" max="100" value="${o.opacity * 100}">`);
      const ang = el(`<input type="range" min="-90" max="90" value="${o.angle}">`);
      const range = el(`<input placeholder="All pages (or e.g. 1-2, 4)">`);
      ui.options.append(prev, el(`<label class="lbl">Watermark text</label>`), text,
        el(`<label class="lbl">Color</label>`), pickColorRow(['#e5383b', '#2f5bea', '#111111', '#1f9d55', '#8e8e8e', '#f5a524'], o.color, c => { o.color = c; refresh(); }),
        el(`<label class="lbl">Position</label>`), chipGroup([['center', 'Center'], ['tile', 'Tiled'], ['top', 'Top'], ['bottom', 'Bottom']], o.position, v => { o.position = v; refresh(); }),
        el(`<label class="lbl">Size</label>`), size, el(`<label class="lbl">Opacity</label>`), op, el(`<label class="lbl">Rotation</label>`), ang,
        el(`<label class="lbl">Pages</label>`), range);
      let t = null, busy = false, again = false;
      async function preview() {
        if (busy) { again = true; return; }
        busy = true;
        try {
          if (!o.text.trim()) return;
          const { doc } = await PdfCore.openLib(f.blob, { name: f.name, key: f.id });
          const one = await PDFLib.PDFDocument.create();
          const [pg] = await one.copyPages(doc, [0]); one.addPage(pg);
          const wm = await PdfOps.watermark(await PdfCore.saveBlob(one), 'p', { ...o, pages: [0] });
          const pdf = await pdfjsLib.getDocument({ data: await PdfCore.toBytes(wm) }).promise;
          await PdfCore.renderToWidth(await pdf.getPage(1), 500, prev); pdf.destroy();
        } catch (e) { console.warn(e); }
        finally { busy = false; if (again) { again = false; preview(); } }
      }
      const refresh = () => { clearTimeout(t); t = setTimeout(preview, 300); };
      text.oninput = () => { o.text = text.value; refresh(); };
      size.oninput = () => { o.size = +size.value; refresh(); };
      op.oninput = () => { o.opacity = +op.value / 100; refresh(); };
      ang.oninput = () => { o.angle = +ang.value; refresh(); };
      preview();
      ui.name(`${baseName(f.name)}_watermarked`);
      return async () => {
        if (!o.text.trim()) throw new Error('Enter watermark text.');
        let pages = null;
        if (range.value.trim()) { const { doc } = await PdfCore.openLib(f.blob, { name: f.name, key: f.id }); pages = PdfCore.parseRanges(range.value, doc.getPageCount()); }
        return [{ blob: await PdfOps.watermark(f.blob, f.name, { ...o, pages }), name: ui.name() + '.pdf' }];
      };
    } },

  lock: { title: 'Lock PDF', kinds: ['pdf'],
    async setup(ui, [f]) {
      if (await PdfCore.isEncrypted(f.blob)) throw new Error('This PDF is already password protected. Unlock it first to change the password.');
      const p1 = el(`<input type="password" placeholder="Password" autocomplete="new-password">`), p2 = el(`<input type="password" placeholder="Confirm password" autocomplete="new-password">`);
      ui.options.append(el(`<label class="lbl">Set a password</label>`), p1, el(`<div style="height:10px"></div>`), p2,
        el(`<p class="muted small">Protected with AES-256 encryption. Anyone opening the file will need this password — don't forget it.</p>`));
      ui.name(`${baseName(f.name)}_locked`);
      return async () => {
        if (p1.value.length < 4) throw new Error('Use at least 4 characters.');
        if (p1.value !== p2.value) throw new Error('Passwords do not match.');
        return [{ blob: await PdfOps.lock(f.blob, f.name, p1.value), name: ui.name() + '.pdf' }];
      };
    } },

  unlock: { title: 'Unlock PDF', kinds: ['pdf'],
    async setup(ui, [f]) {
      if (!await PdfCore.isEncrypted(f.blob)) throw new Error('This PDF is not password protected.');
      const p = el(`<input type="password" placeholder="Current password">`);
      ui.options.append(el(`<label class="lbl">Enter the PDF password</label>`), p, el(`<p class="muted small">The unlocked copy opens without a password.</p>`));
      ui.name(`${baseName(f.name)}_unlocked`);
      return async () => [{ blob: await PdfOps.unlock(f.blob, f.name, p.value), name: ui.name() + '.pdf' }];
    } },
};

/* Tools that hand off to another screen */
const HANDOFF = {
  edit: { title: 'Edit PDF', kinds: ['pdf'], go: id => `editor/${id}` },
  sign: { title: 'Sign PDF', kinds: ['pdf'], go: id => `editor/${id}?tool=sign` },
  print: { title: 'Print', kinds: ['pdf', 'image'] },
};

Screens.tool = {
  title: 'Tool',
  async render(view, [name], query) {
    const tool = TOOLS[name], hand = HANDOFF[name];
    const def = tool || hand;
    if (!def) { view.append(el(`<div class="empty">Unknown tool</div>`)); return; }
    App.setTitle(def.title);
    const cleanups = [];
    const pick = async () => pickFiles({ kinds: def.kinds, multiple: !!def.multiple, title: def.pickLabel || 'Select file' });
    let files = [];
    if (query.file) { const m = await Store.getFile(query.file); if (m) files = [{ blob: await Store.getBlob(m.id), name: m.name, id: m.id }]; }

    const intro = el(`<div><button class="drop-hint" style="width:100%">${ic('upload')}<div style="font-weight:700;color:var(--text);margin-top:6px">${esc(def.pickLabel || 'Select file')}</div>
      <div class="small">${def.kinds.map(k => k.toUpperCase()).join(', ')}${def.multiple ? ' · multiple allowed' : ''}</div></button></div>`);
    view.append(intro);
    intro.querySelector('button').onclick = async () => { const f = await pick(); if (f.length) { files = f; start(); } };

    async function start() {
      if (hand) {
        const f = files[0];
        if (name === 'print') { try { await Native.print(f.blob, f.name); } catch (e) { alertDialog('Cannot print', e.message); } return; }
        const id = f.id || (await Store.addFile(f.blob, f.name)).id;
        App.go(def.go(id), { replace: true });
        return;
      }
      intro.remove();
      view.querySelectorAll('[data-run]').forEach(n => n.remove());
      let nameVal = '';
      const panel = el(`<div data-run><div class="file-list" data-files></div><div class="card" style="margin-top:14px" data-opts></div>
        <div class="card hidden" data-namebox><label class="lbl" style="margin-top:0">Output name</label><input data-name></div>
        <button class="btn block glow" data-go disabled>${ic('check')} ${esc(def.title)}</button>
        <button class="btn ghost block" style="margin-top:10px" data-change>Choose different file${def.multiple ? 's' : ''}</button></div>`);
      view.append(panel);
      if (!def.multiple) panel.querySelector('[data-files]').append(fileCard(files[0]));
      const nameInp = panel.querySelector('[data-name]');
      const ui = {
        options: panel.querySelector('[data-opts]'),
        name: v => { if (v !== undefined) { panel.querySelector('[data-namebox]').classList.remove('hidden'); nameInp.value = v; } return (nameInp.value.trim() || 'output').replace(/[\\/:*?"<>|]/g, '_'); },
        cleanup: fn => cleanups.push(fn),
      };
      panel.querySelector('[data-change]').onclick = async () => { const f = await pick(); if (f.length) { files = f; start(); } };
      let run;
      try { run = await tool.setup(ui, files); }
      catch (e) {
        if (e.message === 'cancelled') return;
        panel.remove(); view.append(intro);
        return alertDialog(def.title, e.message);
      }
      if (!ui.options.children.length) ui.options.classList.add('hidden');
      panel.querySelector('[data-go]').disabled = false;
      panel.querySelector('[data-go]').onclick = async () => {
        try {
          Loader.show('Processing…'); await nextFrame();
          const results = await run();
          Loader.hide();
          App.saveResults(results, { title: def.title, note: results.note });
        } catch (e) {
          Loader.hide();
          if (e.message !== 'cancelled') alertDialog(def.title, e.message || String(e));
        }
      };
    }
    if (files.length) start();
    return () => cleanups.forEach(f => f());
  },
};
