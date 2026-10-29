/* Conversion engines and PDF operations. Everything runs on-device. */
const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792], Legal: [612, 1008] };
const PX = 0.75; // CSS px -> PDF pt

const Convert = (() => {
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const progress = (p, msg) => Loader.node && Loader.progress(p, msg);

  async function canvasJpegBytes(canvas, q = 0.9) {
    const b = await ImgProc.canvasToBlob(canvas, 'image/jpeg', q);
    return new Uint8Array(await b.arrayBuffer());
  }
  function flatten(canvas) { // draw onto white so transparent PNGs don't turn black in JPEG
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, 0, 0);
    return c;
  }

  /* -------- Image -> PDF -------- */
  async function addImagePage(doc, blobOrCanvas, { pageSize = 'A4', margin = 20, quality = 0.9 } = {}) {
    const canvas = blobOrCanvas instanceof HTMLCanvasElement ? blobOrCanvas : await ImgProc.blobToCanvas(blobOrCanvas, 3000);
    const img = await doc.embedJpg(await canvasJpegBytes(flatten(canvas), quality));
    let pw, ph;
    if (pageSize === 'Fit') { pw = img.width * PX; ph = img.height * PX; margin = 0; }
    else {
      [pw, ph] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
      if (img.width > img.height) [pw, ph] = [ph, pw]; // auto orientation
    }
    const page = doc.addPage([pw, ph]);
    const aw = pw - 2 * margin, ah = ph - 2 * margin;
    const s = Math.min(aw / img.width, ah / img.height);
    const w = img.width * s, h = img.height * s;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  async function imagesToPdf(blobs, opts = {}) {
    const doc = await PDFDocument.create();
    for (let i = 0; i < blobs.length; i++) {
      progress(i / blobs.length, `Adding image ${i + 1} of ${blobs.length}`);
      await addImagePage(doc, blobs[i], opts);
    }
    return PdfCore.saveBlob(doc);
  }

  /* -------- PDF -> Images -------- */
  async function pdfToImages(blob, name, { format = 'jpeg', dpi = 150, pages = null } = {}) {
    const { pdf } = await PdfCore.openJs(blob, { name });
    try {
      const idx = pages || [...Array(pdf.numPages).keys()];
      const out = [];
      for (let k = 0; k < idx.length; k++) {
        progress(k / idx.length, `Rendering page ${idx[k] + 1}`);
        const c = await PdfCore.renderPage(await pdf.getPage(idx[k] + 1), dpi / 72);
        const b = await ImgProc.canvasToBlob(c, format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
        out.push({ blob: b, name: `${baseName(name)}_page${idx[k] + 1}.${format === 'png' ? 'png' : 'jpg'}` });
      }
      return out;
    } finally { pdf.destroy(); }
  }

  /* -------- HTML -> PDF (used by Word and some Excel sheets) -------- */
  function rowIsBlank(ctx, y, w) {
    const d = ctx.getImageData(0, y, w, 1).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false;
    return true;
  }
  async function htmlToPdf(html, { css = '', pageSize = 'A4', landscape = false, marginPx = 64 } = {}) {
    await loadScript('vendor/html2canvas.min.js');
    let [pw, ph] = PAGE_SIZES[pageSize];
    if (landscape) [pw, ph] = [ph, pw];
    const contentW = Math.round(pw / PX) - 2 * marginPx;
    const pageH = Math.round(ph / PX) - 2 * marginPx;
    const host = document.createElement('div');
    host.style.cssText = `position:absolute;left:-20000px;top:0;width:${contentW}px;background:#fff;color:#000;`;
    host.innerHTML = `<style>${css}</style><div class="docx-body">${html}</div>`;
    document.body.appendChild(host);
    try {
      await Promise.all([...host.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
      const total = host.scrollHeight;
      const doc = await PDFDocument.create();
      const scale = 2;
      let y = 0;
      while (y < total - 1) {
        progress(y / total, `Laying out page ${doc.getPageCount() + 1}`);
        const h = Math.min(pageH, total - y);
        const c = await html2canvas(host, { scale, backgroundColor: '#ffffff', y, height: h, width: contentW, windowWidth: contentW + 40, logging: false, useCORS: true });
        let cut = c.height;
        if (y + h < total) { // avoid slicing through a line of text: look for a blank row near the bottom
          const ctx = c.getContext('2d');
          for (let r = c.height - 1; r > c.height * 0.7; r -= 2) if (rowIsBlank(ctx, r, c.width)) { cut = r + 1; break; }
        }
        const slice = document.createElement('canvas'); slice.width = c.width; slice.height = cut;
        slice.getContext('2d').drawImage(c, 0, 0);
        const img = await doc.embedJpg(await canvasJpegBytes(slice, 0.8));
        const page = doc.addPage([pw, ph]);
        const wPt = contentW * PX, hPt = (cut / scale) * PX;
        page.drawImage(img, { x: marginPx * PX, y: ph - marginPx * PX - hPt, width: wPt, height: hPt });
        y += cut / scale;
      }
      if (!doc.getPageCount()) doc.addPage([pw, ph]);
      return PdfCore.saveBlob(doc);
    } finally { host.remove(); }
  }

  const DOC_CSS = `.docx-body{font-family:Calibri,Carlito,Arial,sans-serif;font-size:14.6px;line-height:1.45;color:#000;word-wrap:break-word}
    .docx-body h1{font-size:26px;margin:14px 0 8px}.docx-body h2{font-size:21px;margin:12px 0 6px}.docx-body h3{font-size:17px;margin:10px 0 6px}
    .docx-body p{margin:0 0 9px}.docx-body img{max-width:100%;height:auto}.docx-body table{border-collapse:collapse;width:100%;margin:8px 0}
    .docx-body td,.docx-body th{border:1px solid #888;padding:4px 6px;vertical-align:top;font-size:13px}.docx-body ul,.docx-body ol{margin:0 0 9px;padding-left:26px}`;

  /* -------- Word -> PDF -------- */
  async function wordToPdf(blob) {
    await loadScript('vendor/mammoth.browser.min.js');
    progress(0.05, 'Reading document');
    const res = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    const html = res.value.trim() || '<p></p>';
    return htmlToPdf(html, { css: DOC_CSS });
  }

  /* -------- Excel -> PDF -------- */
  async function excelToPdf(blob) {
    await loadScript('vendor/xlsx.full.min.js');
    progress(0.05, 'Reading spreadsheet');
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellDates: true });
    const sheets = wb.SheetNames.map(n => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false });
      let cols = 0;
      rows.forEach(r => { for (let i = r.length - 1; i >= 0; i--) if (String(r[i]).trim() !== '') { cols = Math.max(cols, i + 1); break; } });
      return { name: n, rows: rows.map(r => Array.from({ length: cols }, (_, i) => r[i] ?? '')).filter(r => r.some(v => String(v).trim() !== '')), cols };
    }).filter(s => s.rows.length);
    if (!sheets.length) throw new Error('The spreadsheet is empty.');
    const nonLatin = sheets.some(s => s.rows.some(r => r.some(v => /[^\u0000-ÿ–-…€]/.test(String(v)))));
    if (nonLatin) { // jsPDF core fonts are Latin-only; render via HTML instead
      const html = sheets.map(s => `<h2>${esc(s.name)}</h2><table>${s.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`).join('<div style="height:24px"></div>');
      return htmlToPdf(html, { css: DOC_CSS, landscape: sheets.some(s => s.cols > 6) });
    }
    const { jsPDF } = window.jspdf;
    let pdf = null;
    sheets.forEach((s, i) => {
      progress(i / sheets.length, `Sheet ${i + 1} of ${sheets.length}`);
      const orientation = s.cols > 6 ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      else pdf.addPage('a4', orientation);
      pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
      pdf.text(s.name, 36, 40);
      const fs = s.cols > 14 ? 6 : s.cols > 10 ? 7 : s.cols > 6 ? 8 : 9.5;
      pdf.autoTable({
        body: s.rows.map(r => r.map(v => String(v))), startY: 52, margin: { left: 30, right: 30, top: 36 },
        theme: 'grid', styles: { fontSize: fs, cellPadding: 3, overflow: 'linebreak', lineColor: [170, 170, 170], lineWidth: 0.4, textColor: [20, 20, 20] },
        didParseCell: d => { if (d.row.index === 0) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [232, 238, 255]; } },
      });
    });
    return pdf.output('blob');
  }

  /* -------- PDF -> Word -------- */
  async function pdfToWord(blob, name, { mode = 'text' } = {}) {
    await loadScript('vendor/docx.umd.js');
    const D = window.docx;
    const { pdf } = await PdfCore.openJs(blob, { name });
    try {
      const sections = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        progress((p - 1) / pdf.numPages, `Converting page ${p} of ${pdf.numPages}`);
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const pageProps = { page: { size: { width: Math.round(vp.width * 20), height: Math.round(vp.height * 20) }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } };
        const tc = await page.getTextContent();
        const items = tc.items.filter(it => it.str && it.str.trim() !== '' || it.str === ' ');
        const textChars = items.reduce((a, it) => a + it.str.trim().length, 0);
        if (mode === 'image' || textChars < 20) {
          const c = await PdfCore.renderPage(page, 2);
          const data = await canvasJpegBytes(c, 0.88);
          const maxW = (vp.width - 72) , s = maxW / vp.width;
          sections.push({ properties: pageProps, children: [new D.Paragraph({ children: [new D.ImageRun({ type: 'jpg', data, transformation: { width: Math.round(vp.width * s * 96 / 72), height: Math.round(vp.height * s * 96 / 72) } })] })] });
          continue;
        }
        // font names → bold/italic flags (fonts are loaded by getOperatorList)
        const fontInfo = {};
        try {
          await page.getOperatorList();
          for (const it of items) if (!(it.fontName in fontInfo)) {
            let fname = '';
            try { fname = (page.commonObjs.get(it.fontName) || {}).name || ''; } catch {}
            fontInfo[it.fontName] = { bold: /bold|black|heavy|semibold/i.test(fname), italic: /italic|oblique/i.test(fname) };
          }
        } catch {}
        // group into lines
        const lines = [];
        for (const it of items) {
          const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
          const x = it.transform[4], y = it.transform[5];
          let line = lines.find(l => Math.abs(l.y - y) < Math.max(2, size * 0.45));
          if (!line) { line = { y, size, items: [] }; lines.push(line); }
          line.items.push({ x, w: it.width, str: it.str, size, font: fontInfo[it.fontName] || {} });
          line.size = Math.max(line.size, size);
        }
        lines.sort((a, b) => b.y - a.y);
        lines.forEach(l => l.right = Math.max(...l.items.map(it => it.x + it.w)));
        const maxRight = Math.max(...lines.map(l => l.right));
        const paras = [];
        let cur = null, prev = null;
        for (const l of lines) {
          l.items.sort((a, b) => a.x - b.x);
          const runs = [];
          let endX = null;
          for (const it of l.items) {
            let s = it.str;
            if (endX !== null && it.x - endX > it.size * 0.2 && !/\s$/.test(runs.length ? runs[runs.length - 1].text : '') && !/^\s/.test(s)) s = ' ' + s;
            const last = runs[runs.length - 1];
            if (last && last.bold === !!it.font.bold && last.italic === !!it.font.italic && Math.abs(last.size - it.size) < 0.5) last.text += s;
            else runs.push({ text: s, bold: !!it.font.bold, italic: !!it.font.italic, size: it.size });
            endX = it.x + it.w;
          }
          const minX = l.items[0].x;
          const gap = prev ? prev.y - l.y : 0;
          // only reflow into the previous paragraph when that line ran (nearly) to the right margin
          const newPara = !cur || gap > Math.max(prev.size, l.size) * 1.75 || Math.abs(prev.size - l.size) > 1.5 || minX - cur.x > l.size * 2 || prev.right < maxRight * 0.85;
          if (newPara) { cur = { x: minX, runs: [], size: l.size, spaceBefore: prev ? Math.max(0, gap - l.size * 1.2) : 0 }; paras.push(cur); }
          else {
            const lastRun = cur.runs[cur.runs.length - 1];
            if (lastRun && /-$/.test(lastRun.text)) lastRun.text = lastRun.text.slice(0, -1);
            else if (lastRun && !/\s$/.test(lastRun.text)) lastRun.text += ' ';
          }
          cur.runs.push(...runs);
          prev = l;
        }
        const children = paras.map(pa => new D.Paragraph({
          spacing: { before: Math.min(600, Math.round(pa.spaceBefore * 10)), after: 60 },
          indent: { left: Math.max(0, Math.round((pa.x - 36) * 20)) > 2000 ? Math.round((pa.x - 36) * 20) : 0 },
          children: pa.runs.map(r => new D.TextRun({ text: r.text, bold: r.bold, italics: r.italic, size: Math.max(12, Math.round(r.size * 2)), font: 'Calibri' })),
        }));
        sections.push({ properties: pageProps, children: children.length ? children : [new D.Paragraph('')] });
      }
      const doc = new D.Document({ creator: 'ProScan', title: baseName(name), sections });
      return await D.Packer.toBlob(doc);
    } finally { pdf.destroy(); }
  }

  return { imagesToPdf, addImagePage, pdfToImages, htmlToPdf, wordToPdf, excelToPdf, pdfToWord, canvasJpegBytes, flatten, DOC_CSS };
})();

const PdfOps = (() => {
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const progress = (p, msg) => Loader.node && Loader.progress(p, msg);

  async function merge(items) {
    const out = await PDFDocument.create();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      progress(i / items.length, `Adding ${it.name}`);
      if (Store.kindOf(it) === 'image') { await Convert.addImagePage(out, it.blob, { pageSize: 'A4', margin: 20 }); continue; }
      const { doc } = await PdfCore.openLib(it.blob, { name: it.name, key: it.id });
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => out.addPage(p));
    }
    return PdfCore.saveBlob(out);
  }

  const COMPRESS = { low: { dpi: 150, q: 0.75 }, medium: { dpi: 110, q: 0.6 }, high: { dpi: 80, q: 0.45 } };
  async function compress(blob, name, level = 'medium', { grayscale = false } = {}) {
    const before = blob.size;
    // 1) lossless re-save
    const { doc, password } = await PdfCore.openLib(blob, { name });
    const lossless = await PdfCore.saveBlob(doc);
    // 2) rasterize pages to JPEG at reduced resolution
    const { pdf } = await PdfCore.openJs(blob, { name, password });
    const { dpi, q } = COMPRESS[level];
    const out = await PDFDocument.create();
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        progress((p - 1) / pdf.numPages, `Compressing page ${p} of ${pdf.numPages}`);
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        let c = await PdfCore.renderPage(page, dpi / 72);
        if (grayscale) c = ImgProc.applyFilter(c, 'gray');
        const img = await out.embedJpg(await Convert.canvasJpegBytes(c, q));
        const pg = out.addPage([vp.width, vp.height]);
        pg.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
      }
    } finally { pdf.destroy(); }
    const lossy = await PdfCore.saveBlob(out);
    const best = [lossy, lossless].sort((a, b) => a.size - b.size)[0];
    return { blob: best, before, after: best.size, mode: best === lossy ? 'image' : 'lossless', improved: best.size < before };
  }

  async function extract(blob, name, indices, { separate = false } = {}) {
    const { doc } = await PdfCore.openLib(blob, { name });
    if (!separate) {
      const out = await PDFDocument.create();
      (await out.copyPages(doc, indices)).forEach(p => out.addPage(p));
      return [{ blob: await PdfCore.saveBlob(out), name: `${baseName(name)}_pages.pdf` }];
    }
    const res = [];
    for (const i of indices) {
      const out = await PDFDocument.create();
      const [p] = await out.copyPages(doc, [i]); out.addPage(p);
      res.push({ blob: await PdfCore.saveBlob(out), name: `${baseName(name)}_page${i + 1}.pdf` });
    }
    return res;
  }

  /* pages: [{index, rotate}] in the new order; rotate is extra degrees (multiple of 90) */
  async function organize(blob, name, pages) {
    const { doc } = await PdfCore.openLib(blob, { name });
    const out = await PDFDocument.create();
    const copied = await out.copyPages(doc, pages.map(p => p.index));
    copied.forEach((pg, k) => {
      const extra = pages[k].rotate || 0;
      if (extra) pg.setRotation(degrees((pg.getRotation().angle + extra + 360) % 360));
      out.addPage(pg);
    });
    return PdfCore.saveBlob(out);
  }

  /* Text watermark. opts: text, size, color(hex), opacity, angle, position('center'|'tile'|'top'|'bottom'), pages(indices|null) */
  async function watermark(blob, name, opts) {
    const { doc } = await PdfCore.openLib(blob, { name });
    const font = await doc.embedFont(opts.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    const text = sanitizeWinAnsi(opts.text, font);
    const [r, g, b] = hexToRgb01(opts.color);
    const pages = doc.getPages();
    const targets = opts.pages || pages.map((_, i) => i);
    for (const i of targets) {
      const page = pages[i];
      const { width: W, height: H } = page.getSize();
      const box = page.getMediaBox();
      const R = page.getRotation().angle % 360;
      const size = opts.size;
      const tw = font.widthOfTextAtSize(text, size), th = font.heightAtSize(size) * 0.7;
      const ang = (opts.angle + R) * Math.PI / 180;
      const place = (cx, cy) => {
        const ox = (tw / 2) * Math.cos(ang) - (th / 2) * Math.sin(ang);
        const oy = (tw / 2) * Math.sin(ang) + (th / 2) * Math.cos(ang);
        page.drawText(text, { x: cx - ox, y: cy - oy, size, font, color: rgb(r, g, b), opacity: opts.opacity, rotate: degrees(opts.angle + R) });
      };
      // visual top/bottom depend on page rotation
      const cx = box.x + W / 2, cy = box.y + H / 2;
      const vis = (dx, dy) => { // offset in displayed coordinates (dy up) -> PDF space
        switch (R) { case 90: return [cx - dy, cy + dx]; case 180: return [cx - dx, cy - dy]; case 270: return [cx + dy, cy - dx]; default: return [cx + dx, cy + dy]; }
      };
      const dispH = R % 180 ? W : H, dispW = R % 180 ? H : W;
      if (opts.position === 'tile') {
        const stepX = tw * 0.9 + 60, stepY = Math.max(th * 4, 110);
        for (let y = -dispH; y <= dispH; y += stepY)
          for (let x = -dispW; x <= dispW; x += stepX) { const [px, py] = vis(x + ((y / stepY) % 2 ? stepX / 2 : 0), y); place(px, py); }
      } else if (opts.position === 'top') { const [px, py] = vis(0, dispH / 2 - 40 - th); place(px, py); }
      else if (opts.position === 'bottom') { const [px, py] = vis(0, -dispH / 2 + 40 + th); place(px, py); }
      else place(cx, cy);
    }
    return PdfCore.saveBlob(doc);
  }

  async function lock(blob, name, userPassword) {
    const { doc } = await PdfCore.openLib(blob, { name });
    doc.encrypt({ userPassword, ownerPassword: userPassword, permissions: { printing: 'highResolution', modifying: true, copying: true, annotating: true, fillingForms: true, contentAccessibility: true, documentAssembly: true } });
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }
  async function unlock(blob, name, password) {
    const bytes = await PdfCore.toBytes(blob);
    const probe = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (!probe.isEncrypted) throw new Error('This PDF is not password protected.');
    let doc;
    try { doc = await PdfCore.loadWithPassword(bytes, password); }
    catch { throw new Error('Incorrect password.'); }
    return PdfCore.saveBlob(doc);
  }
  return { merge, compress, extract, organize, watermark, lock, unlock };
})();

/* Replace characters a standard PDF font cannot encode */
function sanitizeWinAnsi(text, font) {
  let out = '';
  for (const ch of text) {
    try { font.encodeText(ch); out += ch; } catch { out += '?'; }
  }
  return out;
}
function canEncode(text, font) {
  try { font.encodeText(text.replace(/\n/g, '')); return true; } catch { return false; }
}
