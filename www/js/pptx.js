/* PowerPoint (.pptx) -> PDF: parses slide XML (text boxes, placeholders, pictures, tables, fills) and paints each slide */
const Pptx = (() => {
  const NS = {
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  };
  const EMU = 914400; // per inch
  const parse = s => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (n, ns, name) => n ? [...n.childNodes].filter(c => c.nodeType === 1 && c.namespaceURI === NS[ns] && c.localName === name) : [];
  const kid = (n, ns, name) => kids(n, ns, name)[0] || null;
  const desc = (n, ns, name) => n ? [...n.getElementsByTagNameNS(NS[ns], name)] : [];
  const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = (dirOf(base) + target).split('/'), out = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
    return out.join('/');
  }

  async function pptxToPdf(blob) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const read = async p => { const f = zip.file(p); return f ? f.async('string') : null; };
    async function rels(part) {
      const p = dirOf(part) + '_rels/' + part.slice(part.lastIndexOf('/') + 1) + '.rels';
      const x = await read(p); const m = {};
      if (x) for (const r of parse(x).getElementsByTagName('Relationship')) m[r.getAttribute('Id')] = { target: resolve(part, r.getAttribute('Target')), type: r.getAttribute('Type'), external: r.getAttribute('TargetMode') === 'External' };
      return m;
    }
    const presXml = await read('ppt/presentation.xml');
    if (!presXml) throw new Error('This is not a valid .pptx file. Old .ppt files must be saved as .pptx first.');
    const pres = parse(presXml);
    const sz = desc(pres, 'p', 'sldSz')[0];
    const SW = sz ? +sz.getAttribute('cx') : 9144000, SH = sz ? +sz.getAttribute('cy') : 6858000;
    const presRels = await rels('ppt/presentation.xml');
    const slideIds = desc(pres, 'p', 'sldId').map(n => n.getAttributeNS(NS.r, 'id'));
    const slidePaths = slideIds.map(id => presRels[id] && presRels[id].target).filter(Boolean);

    // theme colours
    const theme = {};
    const themeRel = Object.values(presRels).find(r => /theme$/.test(r.type));
    const themeXml = themeRel && await read(themeRel.target);
    if (themeXml) {
      const cs = desc(parse(themeXml), 'a', 'clrScheme')[0];
      if (cs) for (const c of [...cs.children]) {
        const v = c.querySelector('*'); if (!v) continue;
        theme[c.localName] = v.localName === 'sysClr' ? (v.getAttribute('lastClr') || '000000') : v.getAttribute('val');
      }
    }
    const schemeMap = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
    function colorOf(fillParent) {
      if (!fillParent) return null;
      const s = kid(fillParent, 'a', 'srgbClr') || kid(fillParent, 'a', 'schemeClr') || kid(fillParent, 'a', 'sysClr') || kid(fillParent, 'a', 'prstClr');
      if (!s) return null;
      let hex = null;
      if (s.localName === 'srgbClr') hex = s.getAttribute('val');
      else if (s.localName === 'sysClr') hex = s.getAttribute('lastClr') || '000000';
      else if (s.localName === 'schemeClr') { const v = s.getAttribute('val'); hex = theme[schemeMap[v] || v]; }
      else hex = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000' }[s.getAttribute('val')];
      if (!hex) return null;
      let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
      const lm = kid(s, 'a', 'lumMod'), lo = kid(s, 'a', 'lumOff'), tint = kid(s, 'a', 'tint'), shade = kid(s, 'a', 'shade');
      const f = (n, d) => n ? +n.getAttribute('val') / 100000 : d;
      if (lm || lo) { const m = f(lm, 1), o = f(lo, 0); [r, g, b] = [r, g, b].map(v => Math.min(255, v * m + 255 * o)); }
      if (tint) { const t = f(tint, 1); [r, g, b] = [r, g, b].map(v => v + (255 - v) * (1 - t)); }
      if (shade) { const t = f(shade, 1); [r, g, b] = [r, g, b].map(v => v * t); }
      const alpha = kid(s, 'a', 'alpha');
      return `rgba(${r | 0},${g | 0},${b | 0},${alpha ? +alpha.getAttribute('val') / 100000 : 1})`;
    }

    const layoutCache = {};
    async function partInfo(path) {
      if (layoutCache[path]) return layoutCache[path];
      const xml = await read(path);
      const info = { doc: xml ? parse(xml) : null, rels: await rels(path) };
      layoutCache[path] = info; return info;
    }
    function placeholders(doc) {
      const out = [];
      for (const sp of desc(doc, 'p', 'sp')) {
        const ph = desc(sp, 'p', 'ph')[0];
        if (ph) out.push({ type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx'), sp });
      }
      return out;
    }
    function findPh(list, type, idx) {
      return list.find(p => idx != null && p.idx === idx) || list.find(p => p.type === type) ||
        (type === 'ctrTitle' && list.find(p => p.type === 'title')) || (type === 'subTitle' && list.find(p => p.type === 'body')) || null;
    }
    function xfrmOf(sp) {
      const x = desc(sp, 'a', 'xfrm')[0];
      if (!x) return null;
      const off = kid(x, 'a', 'off'), ext = kid(x, 'a', 'ext');
      if (!off || !ext) return null;
      return { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx'), h: +ext.getAttribute('cy') };
    }
    async function imageFor(rel) {
      if (!rel || rel.external) return null;
      const f = zip.file(rel.target); if (!f) return null;
      const ext = extOf(rel.target);
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) return null;
      try { return await ImgProc.loadBitmap(new Blob([await f.async('uint8array')], { type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) })); } catch { return null; }
    }
    function bgFill(doc) {
      const bg = desc(doc, 'p', 'bg')[0]; if (!bg) return null;
      const pr = kid(bg, 'p', 'bgPr');
      if (pr) { const sf = kid(pr, 'a', 'solidFill'); if (sf) return { color: colorOf(sf) }; const bf = kid(pr, 'a', 'blipFill'); if (bf) return { blip: desc(bf, 'a', 'blip')[0] }; }
      const ref = kid(bg, 'p', 'bgRef'); if (ref) return { color: colorOf(ref) };
      return null;
    }

    const { jsPDF } = window.jspdf;
    const pageW = SW / EMU * 72, pageH = SH / EMU * 72;
    const pdf = new jsPDF({ orientation: pageW > pageH ? 'landscape' : 'portrait', unit: 'pt', format: [pageW, pageH] });
    const scale = 1600 / SW; // canvas px per EMU
    for (let si = 0; si < slidePaths.length; si++) {
      Loader.node && Loader.progress(si / slidePaths.length, `Rendering slide ${si + 1} of ${slidePaths.length}`);
      const path = slidePaths[si];
      const slide = await partInfo(path);
      const layoutPath = Object.values(slide.rels).find(r => /slideLayout$/.test(r.type))?.target;
      const layout = layoutPath ? await partInfo(layoutPath) : { doc: null, rels: {} };
      const masterPath = Object.values(layout.rels).find(r => /slideMaster$/.test(r.type))?.target;
      const master = masterPath ? await partInfo(masterPath) : { doc: null, rels: {} };
      const lph = layout.doc ? placeholders(layout.doc) : [], mph = master.doc ? placeholders(master.doc) : [];

      const c = document.createElement('canvas');
      c.width = Math.round(SW * scale); c.height = Math.round(SH * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      for (const [doc, rl] of [[master.doc, master.rels], [layout.doc, layout.rels], [slide.doc, slide.rels]]) {
        const bg = doc && bgFill(doc);
        if (!bg) continue;
        if (bg.color) { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, c.width, c.height); }
        if (bg.blip) { const im = await imageFor(rl[bg.blip.getAttributeNS(NS.r, 'embed')]); if (im) ctx.drawImage(im, 0, 0, c.width, c.height); }
      }
      // decorative pictures on layout/master (logos, bars) – non-placeholder only
      for (const part of [master, layout]) {
        if (!part.doc) continue;
        const tree = desc(part.doc, 'p', 'spTree')[0];
        if (tree) await drawTree(tree, part, true);
      }
      const tree = desc(slide.doc, 'p', 'spTree')[0];
      if (tree) await drawTree(tree, slide, false);
      pdf.addImage(c, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
      if (si < slidePaths.length - 1) pdf.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');

      async function drawTree(tree, part, decorOnly, tf = v => v) {
        for (const n of [...tree.children]) {
          const name = n.localName;
          if (name === 'grpSp') {
            const gx = desc(kid(n, 'p', 'grpSpPr'), 'a', 'xfrm')[0];
            let inner = tf;
            if (gx) {
              const off = kid(gx, 'a', 'off'), ext = kid(gx, 'a', 'ext'), co = kid(gx, 'a', 'chOff'), ce = kid(gx, 'a', 'chExt');
              if (off && ext && co && ce) {
                const g = { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx'), h: +ext.getAttribute('cy') };
                const ch = { x: +co.getAttribute('x'), y: +co.getAttribute('y'), w: +ce.getAttribute('cx') || 1, h: +ce.getAttribute('cy') || 1 };
                inner = v => tf({ x: g.x + (v.x - ch.x) * g.w / ch.w, y: g.y + (v.y - ch.y) * g.h / ch.h, w: v.w * g.w / ch.w, h: v.h * g.h / ch.h });
              }
            }
            await drawTree(n, part, decorOnly, inner);
          } else if (name === 'sp' || name === 'cxnSp') {
            const ph = desc(n, 'p', 'ph')[0];
            if (decorOnly && ph) continue;
            let xf = xfrmOf(n);
            let inherit = null;
            if (ph) {
              const type = ph.getAttribute('type') || 'body', idx = ph.getAttribute('idx');
              inherit = findPh(lph, type, idx) || findPh(mph, type, idx);
              if (!xf && inherit) xf = xfrmOf(inherit.sp) || (findPh(mph, type, idx) && xfrmOf(findPh(mph, type, idx).sp));
            }
            if (!xf) continue;
            const r = tf(xf);
            const box = { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale };
            const spPr = kid(n, 'p', 'spPr');
            const sf = spPr && kid(spPr, 'a', 'solidFill');
            const geom = spPr && desc(spPr, 'a', 'prstGeom')[0]?.getAttribute('prst');
            if (sf) {
              ctx.fillStyle = colorOf(sf) || 'transparent';
              if (geom === 'ellipse') { ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
              else if (geom === 'roundRect') { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(box.x, box.y, box.w, box.h, Math.min(box.w, box.h) * 0.16) : ctx.rect(box.x, box.y, box.w, box.h); ctx.fill(); }
              else ctx.fillRect(box.x, box.y, box.w, box.h);
            }
            const ln = spPr && kid(spPr, 'a', 'ln');
            if (ln && !kid(ln, 'a', 'noFill')) {
              const lc = colorOf(kid(ln, 'a', 'solidFill'));
              if (lc) {
                ctx.strokeStyle = lc; ctx.lineWidth = Math.max(1, (+ln.getAttribute('w') || 12700) * scale);
                if (name === 'cxnSp' || geom === 'line') { ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke(); }
                else if (geom === 'ellipse') { ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
                else ctx.strokeRect(box.x, box.y, box.w, box.h);
              }
            }
            const tx = kid(n, 'p', 'txBody');
            if (tx && !decorOnly) drawText(tx, box, ph ? (ph.getAttribute('type') || 'body') : null, inherit);
          } else if (name === 'pic') {
            if (decorOnly && desc(n, 'p', 'ph')[0]) continue;
            const xf = xfrmOf(n); if (!xf) continue;
            const blip = desc(n, 'a', 'blip')[0]; if (!blip) continue;
            const im = await imageFor(part.rels[blip.getAttributeNS(NS.r, 'embed')]);
            const r = tf(xf);
            if (im) ctx.drawImage(im, r.x * scale, r.y * scale, r.w * scale, r.h * scale);
          } else if (name === 'graphicFrame' && !decorOnly) {
            const tbl = desc(n, 'a', 'tbl')[0];
            const xfn = kid(n, 'p', 'xfrm');
            if (!tbl || !xfn) continue;
            const off = kid(xfn, 'a', 'off');
            const r = tf({ x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: 0, h: 0 });
            const colW = desc(tbl, 'a', 'gridCol').map(g => +g.getAttribute('w') * scale);
            let y = r.y * scale;
            for (const tr of kids(tbl, 'a', 'tr')) {
              const h = +tr.getAttribute('h') * scale;
              let x = r.x * scale;
              const cells = kids(tr, 'a', 'tc');
              let rowH = h;
              cells.forEach((tc, i) => { // rows are auto-sized in PowerPoint: measure the text
                const tb = kid(tc, 'a', 'txBody');
                if (tb) rowH = Math.max(rowH, drawText(tb, { x: 0, y: 0, w: colW[i] || 100, h: 0 }, 'table', null, 14, true));
              });
              cells.forEach((tc, i) => {
                const w = colW[i] || 100;
                const tcPr = kid(tc, 'a', 'tcPr');
                const fill = tcPr && kid(tcPr, 'a', 'solidFill');
                if (fill) { ctx.fillStyle = colorOf(fill); ctx.fillRect(x, y, w, rowH); }
                ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, rowH);
                const tb = kid(tc, 'a', 'txBody');
                if (tb) drawText(tb, { x, y, w, h: rowH }, 'table', null, 14);
                x += w;
              });
              y += rowH;
            }
          }
        }
      }

      function drawText(txBody, box, phType, inherit, defaultPt, measureOnly = false) {
        const bodyPr = kid(txBody, 'a', 'bodyPr');
        const ins = (a, d) => (bodyPr && bodyPr.getAttribute(a) != null ? +bodyPr.getAttribute(a) : d) * scale;
        const L = ins('lIns', 91440), R = ins('rIns', 91440), T = ins('tIns', 45720), B = ins('bIns', 45720);
        const anchor = bodyPr && bodyPr.getAttribute('anchor') || (phType === 'ctrTitle' || phType === 'title' ? 'ctr' : 't');
        const fontScale = bodyPr && desc(bodyPr, 'a', 'normAutofit')[0]?.getAttribute('fontScale');
        const fscale = fontScale ? +fontScale / 100000 : 1;
        const defSize = defaultPt || ({ ctrTitle: 44, title: 36, subTitle: 22, body: 20 }[phType] || 18);
        const inheritRPr = inherit ? desc(inherit.sp, 'a', 'defRPr')[0] : null;
        const lines = []; // {runs:[{text,font,color}], align, height}
        const maxW = box.w - L - R;
        for (const p of kids(txBody, 'a', 'p')) {
          const pPr = kid(p, 'a', 'pPr');
          const align = pPr && pPr.getAttribute('algn') || (phType === 'ctrTitle' || phType === 'subTitle' ? 'ctr' : 'l');
          const lvl = pPr ? +(pPr.getAttribute('lvl') || 0) : 0;
          const bulletNone = pPr && kid(pPr, 'a', 'buNone');
          const buChar = pPr && kid(pPr, 'a', 'buChar');
          const runs = [];
          for (const r of [...p.children]) {
            if (r.localName === 'br') { runs.push({ br: true }); continue; }
            if (r.localName !== 'r' && r.localName !== 'fld') continue;
            const t = kid(r, 'a', 't'); if (!t) continue;
            const rPr = kid(r, 'a', 'rPr') || kid(p, 'a', 'endParaRPr');
            const pick = (a) => rPr && rPr.getAttribute(a) != null ? rPr.getAttribute(a) : (inheritRPr && inheritRPr.getAttribute(a));
            const szv = pick('sz');
            const pt = (szv ? +szv / 100 : defSize) * fscale;
            const px = pt / 72 * EMU * scale;
            const bold = pick('b') === '1' || (phType === 'title' || phType === 'ctrTitle') && pick('b') !== '0';
            const italic = pick('i') === '1';
            const latin = rPr && kid(rPr, 'a', 'latin');
            const face = latin && !/^\+/.test(latin.getAttribute('typeface')) ? `"${latin.getAttribute('typeface')}", ` : '';
            const color = colorOf(rPr && kid(rPr, 'a', 'solidFill')) || colorOf(inheritRPr && kid(inheritRPr, 'a', 'solidFill')) || (theme.dk1 ? '#' + theme.dk1 : '#000');
            runs.push({ text: t.textContent, font: `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${px.toFixed(1)}px ${face}Calibri, Carlito, Arial, sans-serif`, px, color, underline: rPr && rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none' });
          }
          const hasText = runs.some(r => r.text && r.text.trim());
          const bullet = hasText && !bulletNone && (buChar || (phType === 'body' && !lvl === false) || phType === 'body') ? (buChar ? buChar.getAttribute('char') : '•') : '';
          const indent = lvl * 0.4 * EMU * scale + (bullet ? (runs[0]?.px || 20) * 1.1 : 0);
          // word-wrap the runs
          let line = { runs: [], w: 0, h: 0, align, indent, bullet: bullet && runs[0] ? { ch: bullet, font: runs.find(r => r.font)?.font, color: runs.find(r => r.color)?.color } : null };
          const pushLine = () => { if (!line.h) line.h = (runs.find(r => r.px)?.px || defSize / 72 * EMU * scale); lines.push(line); line = { runs: [], w: 0, h: 0, align, indent, bullet: null }; };
          for (const run of runs) {
            if (run.br) { pushLine(); continue; }
            ctx.font = run.font;
            for (const word of run.text.split(/(\s+)/)) {
              if (!word) continue;
              const ww = ctx.measureText(word).width;
              if (line.w + ww > maxW - indent && line.runs.length && word.trim()) pushLine();
              if (!line.runs.length && !word.trim()) continue;
              line.runs.push({ ...run, text: word, w: ww }); line.w += ww; line.h = Math.max(line.h, run.px);
            }
          }
          pushLine();
          if (lines.length) lines[lines.length - 1].after = (runs[0]?.px || 20) * 0.3;
        }
        const totalH = lines.reduce((a, l) => a + l.h * 1.2 + (l.after || 0), 0);
        if (measureOnly) return totalH + T + B;
        let y = box.y + T;
        if (anchor === 'ctr') y = box.y + (box.h - totalH) / 2;
        else if (anchor === 'b') y = box.y + box.h - B - totalH;
        ctx.textBaseline = 'alphabetic';
        for (const l of lines) {
          const lh = l.h * 1.2;
          const base = y + l.h * 0.95;
          let x = box.x + L + l.indent;
          if (l.align === 'ctr') x = box.x + L + (maxW - l.w) / 2;
          else if (l.align === 'r') x = box.x + box.w - R - l.w;
          if (l.bullet) { ctx.font = l.bullet.font; ctx.fillStyle = l.bullet.color; ctx.fillText(l.bullet.ch, x - l.h * 1.1, base); }
          for (const r of l.runs) {
            ctx.font = r.font; ctx.fillStyle = r.color; ctx.fillText(r.text, x, base);
            if (r.underline) ctx.fillRect(x, base + 2, r.w, Math.max(1, r.px / 16));
            x += r.w;
          }
          y += lh + (l.after || 0);
        }
      }
    }
    if (!slidePaths.length) throw new Error('No slides found in this presentation.');
    return pdf.output('blob');
  }
  return { pptxToPdf };
})();
