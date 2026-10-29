/* PDF editor: text, freehand, highlight, shapes, arrows, signatures and images, saved into the PDF with pdf-lib */
const SVGNS = 'http://www.w3.org/2000/svg';
const TEXT_ASC = 0.86, TEXT_LH = 1.2;
const FONT_CSS = 'Helvetica, Arial, sans-serif';

/* ---------- signature pad dialog: resolves to PNG dataURL (transparent, trimmed) ---------- */
function trimCanvas(c) {
  const ctx = c.getContext('2d'), d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const pad = 6, o = document.createElement('canvas');
  o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
  o.getContext('2d').drawImage(c, x0 - pad, y0 - pad, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
const SigStore = {
  list() { try { return JSON.parse(localStorage.getItem('ps_sigs') || '[]'); } catch { return []; } },
  add(d) { const l = this.list(); l.unshift(d); localStorage.setItem('ps_sigs', JSON.stringify(l.slice(0, 6))); },
  remove(i) { const l = this.list(); l.splice(i, 1); localStorage.setItem('ps_sigs', JSON.stringify(l)); },
};
function signatureDialog() {
  return openDialog((box, finish) => {
    box.append(el(`<div><h3>Signature</h3>
      <div class="tabs"><button data-t="draw" class="active">Draw</button><button data-t="type">Type</button><button data-t="saved">Saved</button></div>
      <div data-p="draw"><canvas class="sigpad"></canvas>
        <div class="row" style="margin-top:10px"><div class="grow" data-colors></div><button class="btn ghost" data-a="clear">Clear</button></div></div>
      <div data-p="type" class="hidden"><input data-name placeholder="Type your name" maxlength="40">
        <div class="chips" style="margin:10px 0" data-fonts></div><canvas class="sigpad" data-tprev style="height:120px"></canvas></div>
      <div data-p="saved" class="hidden"><div class="sig-list" data-saved></div></div>
      <label class="row small" style="margin-top:10px;color:var(--muted)"><input type="checkbox" data-keep checked> Save this signature for later</label>
      <div class="btn-row"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn" data-a="ok">Use signature</button></div></div>`));
    let tab = 'draw', color = '#111111', font = 0;
    const FONTS = ['italic 64px "Brush Script MT", "Segoe Script", "Dancing Script", cursive', '64px "Segoe Script", "Lucida Handwriting", cursive', 'italic 600 60px Georgia, serif'];
    const pad = box.querySelector('[data-p=draw] canvas');
    const tprev = box.querySelector('[data-tprev]');
    const name = box.querySelector('[data-name]');
    let drawn = false;
    function setupCanvas(c) {
      const r = c.getBoundingClientRect(), dpr = 2;
      c.width = Math.max(300, r.width) * dpr; c.height = Math.max(100, r.height) * dpr;
      const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); return ctx;
    }
    let pctx;
    requestAnimationFrame(() => { pctx = setupCanvas(pad); });
    let last = null;
    pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); last = [e.clientX - r.left, e.clientY - r.top]; });
    pad.addEventListener('pointermove', e => {
      if (!last) return;
      const r = pad.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top];
      pctx.strokeStyle = color; pctx.lineWidth = 3; pctx.lineCap = 'round'; pctx.lineJoin = 'round';
      pctx.beginPath(); pctx.moveTo(...last); pctx.lineTo(...p); pctx.stroke(); last = p; drawn = true;
    });
    pad.addEventListener('pointerup', () => last = null);
    box.querySelector('[data-colors]').append(pickColorRow(['#111111', '#1d3fbf', '#c0392b'], color, c => { color = c; drawTyped(); }));
    box.querySelector('[data-a=clear]').onclick = () => { pctx.clearRect(0, 0, pad.width, pad.height); drawn = false; };
    const fontsEl = box.querySelector('[data-fonts]');
    FONTS.forEach((f, i) => {
      const b = el(`<button class="chip ${i === 0 ? 'active' : ''}" style="font:${f.replace(/\d+px/, '18px')}">Signature</button>`);
      b.onclick = () => { font = i; fontsEl.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b)); drawTyped(); };
      fontsEl.append(b);
    });
    let tctx;
    function drawTyped() {
      if (!tctx) return;
      tctx.clearRect(0, 0, tprev.width, tprev.height);
      tctx.fillStyle = color; tctx.font = FONTS[font].replace(/\d+px/, '44px'); tctx.textBaseline = 'middle';
      tctx.fillText(name.value, 12, tprev.height / 4);
    }
    name.addEventListener('input', drawTyped);
    const saved = box.querySelector('[data-saved]');
    function drawSaved() {
      saved.innerHTML = '';
      const l = SigStore.list();
      if (!l.length) saved.append(el(`<div class="muted small">No saved signatures yet.</div>`));
      l.forEach((d, i) => {
        const s = el(`<div class="s"><img src="${d}" alt="signature"><button aria-label="Delete">✕</button></div>`);
        s.querySelector('img').onclick = () => finish(d);
        s.querySelector('button').onclick = e => { e.stopPropagation(); SigStore.remove(i); drawSaved(); };
        saved.append(s);
      });
    }
    box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      tab = b.dataset.t;
      box.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b));
      box.querySelectorAll('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p !== tab));
      box.querySelector('[data-a=ok]').classList.toggle('hidden', tab === 'saved');
      if (tab === 'type' && !tctx) { tctx = setupCanvas(tprev); drawTyped(); }
      if (tab === 'saved') drawSaved();
    });
    box.querySelector('[data-a=cancel]').onclick = () => finish(null);
    box.querySelector('[data-a=ok]').onclick = () => {
      let c;
      if (tab === 'draw') { if (!drawn) return toast('Draw your signature first'); c = trimCanvas(pad); }
      else {
        if (!name.value.trim()) return toast('Type your name first');
        const big = document.createElement('canvas'); big.width = 1400; big.height = 200;
        const x = big.getContext('2d'); x.fillStyle = color; x.font = FONTS[font].replace(/\d+px/, '110px'); x.textBaseline = 'middle';
        x.fillText(name.value, 20, 100); c = trimCanvas(big);
      }
      if (!c) return toast('Signature is empty');
      const d = c.toDataURL('image/png');
      if (box.querySelector('[data-keep]').checked) SigStore.add(d);
      finish(d);
    };
  });
}

function textDialog(init = {}) {
  return openDialog((box, finish) => {
    box.append(el(`<div><h3>${init.text ? 'Edit text' : 'Add text'}</h3>
      <textarea rows="3" autofocus placeholder="Type text">${esc(init.text || '')}</textarea>
      <label>Size</label><input type="range" min="8" max="72" value="${init.size || 16}" data-size>
      <label>Color</label><div data-colors></div>
      <label class="row small" style="margin-top:10px"><input type="checkbox" data-bold ${init.bold ? 'checked' : ''}> Bold</label>
      <div class="btn-row"><button class="btn ghost" data-a="c">Cancel</button><button class="btn" data-a="o">Done</button></div></div>`));
    let color = init.color || '#111111';
    box.querySelector('[data-colors]').append(pickColorRow(PALETTE, color, c => color = c));
    box.querySelector('[data-a=c]').onclick = () => finish(null);
    box.querySelector('[data-a=o]').onclick = () => {
      const text = box.querySelector('textarea').value.replace(/\s+$/, '');
      if (!text) return finish(null);
      finish({ text, size: +box.querySelector('[data-size]').value, color, bold: box.querySelector('[data-bold]').checked });
    };
  });
}

Screens.editor = {
  title: 'Edit PDF',
  full: true,
  async render(view, [id], query) {
    const meta = await Store.getFile(id);
    if (!meta) { view.append(el(`<div class="empty">File not found</div>`)); return; }
    App.setTitle(meta.name);
    const blob = await Store.getBlob(id);
    let pdf;
    try { ({ pdf } = await PdfCore.openJs(blob, { name: meta.name, key: id })); }
    catch (e) { if (e.message === 'cancelled') history.back(); else view.append(el(`<div class="card">Cannot open: ${esc(e.message)}</div>`)); return; }

    const bg = el(`<div class="viewer-bg"><div class="pages"></div></div>`);
    const sub = el(`<div class="subbar"></div>`);
    const bar = el(`<div class="toolbar"></div>`);
    view.append(bg, sub, bar);
    const widthFn = () => Math.min(900, bg.clientWidth - 24);
    const pages = await renderPdfPages(bg.querySelector('.pages'), pdf, { widthFn });

    const anns = pages.map(() => []);
    const imgs = {};
    let undo = [], redo = [], dirty = false, sel = null; // sel: {page, id}
    let tool = query.tool === 'sign' ? 'sign' : 'select';
    const style = { color: '#e5383b', width: 3, hlColor: '#ffe066' };
    const nid = () => Math.random().toString(36).slice(2, 9);
    const snapshot = () => JSON.stringify(anns);
    function commit(before) { undo.push(before); redo = []; dirty = true; updateUndo(); }
    function restore(s) { const v = JSON.parse(s); v.forEach((a, i) => anns[i] = a); sel = null; pages.forEach((_, i) => drawPage(i)); updateSub(); }

    /* ----- toolbar ----- */
    const TOOLS = [
      ['select', 'pointer', 'Select'], ['text', 'type', 'Text'], ['pen', 'pen', 'Draw'], ['highlight', 'highlight', 'Highlight'],
      ['rect', 'square', 'Rectangle'], ['ellipse', 'circle', 'Circle'], ['line', 'line', 'Line'], ['arrow', 'arrow', 'Arrow'],
      ['sign', 'sign', 'Sign'], ['image', 'image', 'Image'], ['eraser', 'eraser', 'Eraser'],
    ];
    TOOLS.forEach(([t, icon, label]) => {
      const b = el(`<button data-tool="${t}">${ic(icon)}${label}</button>`);
      b.onclick = () => setTool(t);
      bar.append(b);
    });
    function setTool(t) {
      tool = t; sel = null;
      bar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
      pages.forEach((p, i) => { p.svg.style.touchAction = t === 'select' ? 'pan-x pan-y' : 'none'; drawPage(i); });
      updateSub();
      if (t === 'sign') toast('Tap on the page where you want to sign');
      if (t === 'image') toast('Tap on the page to place an image');
      if (t === 'text') toast('Tap on the page to add text');
    }
    App.setActions([
      { icon: 'undo', label: 'Undo', id: 'undo', run: () => { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); dirty = true; updateUndo(); } },
      { icon: 'redo', label: 'Redo', id: 'redo', run: () => { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); dirty = true; updateUndo(); } },
      { icon: 'save', label: 'Save', run: () => save() },
    ]);
    function updateUndo() {
      const u = document.querySelector('#topActions [data-id=undo]'), r = document.querySelector('#topActions [data-id=redo]');
      if (u) u.style.opacity = undo.length ? 1 : .35;
      if (r) r.style.opacity = redo.length ? 1 : .35;
    }
    updateUndo();

    function updateSub() {
      sub.innerHTML = '';
      const item = sel && anns[sel.page].find(a => a.id === sel.id);
      if (item) {
        const del = el(`<button class="btn danger" style="min-height:36px;padding:6px 12px">${ic('trash')} Delete</button>`);
        del.onclick = () => { const b = snapshot(); anns[sel.page] = anns[sel.page].filter(a => a.id !== sel.id); const p = sel.page; sel = null; commit(b); drawPage(p); updateSub(); };
        sub.append(del);
        if (item.type === 'text') {
          const ed = el(`<button class="btn secondary" style="min-height:36px;padding:6px 12px">${ic('edit')} Edit text</button>`);
          ed.onclick = async () => { const r = await textDialog(item); if (r) { const b = snapshot(); Object.assign(item, r); measureText(item); commit(b); drawPage(sel.page); } };
          sub.append(ed);
        }
        if (item.type !== 'image') sub.append(pickColorRow(PALETTE.slice(0, 6), item.color, c => { const b = snapshot(); item.color = c; commit(b); drawPage(sel.page); }));
        sub.append(el(`<span class="muted small">Drag to move · corner to resize</span>`));
        return;
      }
      if (['pen', 'rect', 'ellipse', 'line', 'arrow', 'text'].includes(tool)) {
        sub.append(pickColorRow(PALETTE.slice(0, 6), style.color, c => style.color = c));
        if (tool !== 'text') {
          const r = el(`<input type="range" min="1" max="14" value="${style.width}" style="width:110px">`);
          r.oninput = () => style.width = +r.value;
          sub.append(r);
        }
      } else if (tool === 'highlight') {
        sub.append(pickColorRow(['#ffe066', '#8ce99a', '#74c0fc', '#ffa8a8'], style.hlColor, c => style.hlColor = c));
        sub.append(el(`<span class="muted small">Drag over text to highlight</span>`));
      } else if (tool === 'select') sub.append(el(`<span class="muted small">Tap an item to select it. Scroll to move between pages.</span>`));
      else if (tool === 'eraser') sub.append(el(`<span class="muted small">Tap an item to remove it</span>`));
      else sub.append(el(`<span class="muted small">Tap on the page to place it</span>`));
    }

    /* ----- geometry ----- */
    const mctx = document.createElement('canvas').getContext('2d');
    function measureText(a) {
      mctx.font = `${a.bold ? 'bold ' : ''}${a.size}px ${FONT_CSS}`;
      const lines = a.text.split('\n');
      a.w = Math.max(...lines.map(l => mctx.measureText(l).width), 4);
      a.h = a.size * TEXT_LH * (lines.length - 1) + a.size * 1.1;
    }
    function bbox(a) {
      switch (a.type) {
        case 'line': case 'arrow': return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) };
        case 'pen': { const xs = a.pts.map(p => p[0]), ys = a.pts.map(p => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
        default: return { x: a.x, y: a.y, w: a.w, h: a.h };
      }
    }
    function moveBy(a, dx, dy) {
      if (a.type === 'line' || a.type === 'arrow') { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; }
      else if (a.type === 'pen') a.pts = a.pts.map(([x, y]) => [x + dx, y + dy]);
      else { a.x += dx; a.y += dy; }
    }
    function resizeTo(a, orig, px, py) {
      const b = bbox(orig);
      if (a.type === 'line' || a.type === 'arrow') { a.x2 = px; a.y2 = py; return; }
      let nw = Math.max(8, px - b.x), nh = Math.max(8, py - b.y);
      if (a.type === 'image') { nh = nw * (orig.h / orig.w); a.w = nw; a.h = nh; }
      else if (a.type === 'text') { a.size = Math.max(6, Math.min(160, orig.size * nw / orig.w)); measureText(a); }
      else if (a.type === 'pen') { const sx = nw / Math.max(1, b.w), sy = nh / Math.max(1, b.h); a.pts = orig.pts.map(([x, y]) => [b.x + (x - b.x) * sx, b.y + (y - b.y) * sy]); }
      else { a.w = nw; a.h = nh; }
    }
    function arrowWings(a, scale = 1) {
      const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(10, a.width * 4) * scale;
      return [[a.x2 - L * Math.cos(ang - 0.45), a.y2 - L * Math.sin(ang - 0.45)], [a.x2 - L * Math.cos(ang + 0.45), a.y2 - L * Math.sin(ang + 0.45)]];
    }

    /* ----- SVG overlay per page ----- */
    pages.forEach((p, i) => {
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'anno');
      svg.setAttribute('viewBox', `0 0 ${p.vp.width} ${p.vp.height}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      p.wrap.append(svg);
      p.svg = svg;
      attachPointer(i, svg);
    });
    const S = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
    function drawPage(i) {
      const svg = pages[i].svg;
      svg.innerHTML = '';
      // Android WebView ignores touch-action on SVG children, so lock panning on the page holding the selection
      svg.style.touchAction = tool !== 'select' || (sel && sel.page === i) ? 'none' : 'pan-x pan-y';
      for (const a of anns[i]) {
        const g = S('g', { 'data-aid': a.id });
        if (tool === 'select' || tool === 'eraser') g.style.touchAction = 'none';
        g.style.cursor = tool === 'select' ? 'move' : tool === 'eraser' ? 'not-allowed' : '';
        if (a.type === 'text') {
          const t = S('text', { x: a.x, y: a.y + a.size * TEXT_ASC, fill: a.color, 'font-size': a.size, 'font-family': FONT_CSS, 'font-weight': a.bold ? 'bold' : 'normal' });
          a.text.split('\n').forEach((line, k) => { const ts = S('tspan', { x: a.x, dy: k ? a.size * TEXT_LH : 0 }); ts.textContent = line || ' '; t.append(ts); });
          g.append(S('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: 'transparent' }), t);
        } else if (a.type === 'image') {
          const im = S('image', { x: a.x, y: a.y, width: a.w, height: a.h, preserveAspectRatio: 'none' });
          im.setAttribute('href', imgs[a.img]);
          g.append(im);
        } else if (a.type === 'highlight') g.append(S('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: a.color, opacity: 0.4, style: 'mix-blend-mode:multiply' }));
        else if (a.type === 'rect') g.append(S('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: 'none', stroke: a.color, 'stroke-width': a.width }));
        else if (a.type === 'ellipse') g.append(S('ellipse', { cx: a.x + a.w / 2, cy: a.y + a.h / 2, rx: a.w / 2, ry: a.h / 2, fill: 'none', stroke: a.color, 'stroke-width': a.width }));
        else if (a.type === 'line' || a.type === 'arrow') {
          g.append(S('line', { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, stroke: 'transparent', 'stroke-width': Math.max(14, a.width + 10) }));
          g.append(S('line', { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round' }));
          if (a.type === 'arrow') { const [w1, w2] = arrowWings(a); g.append(S('polyline', { points: `${w1} ${a.x2},${a.y2} ${w2}`, fill: 'none', stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); }
        } else if (a.type === 'pen') {
          const pts = a.pts.map(p => p.join(',')).join(' ');
          g.append(S('polyline', { points: pts, fill: 'none', stroke: 'transparent', 'stroke-width': a.width + 12 }));
          g.append(S('polyline', { points: pts, fill: 'none', stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        }
        svg.append(g);
        if (sel && sel.page === i && sel.id === a.id) {
          const b = bbox(a), pad = 4;
          svg.append(S('rect', { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, fill: 'none', stroke: '#2f5bea', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }));
          const hx = a.type === 'line' || a.type === 'arrow' ? a.x2 : b.x + b.w + pad, hy = a.type === 'line' || a.type === 'arrow' ? a.y2 : b.y + b.h + pad;
          const h = S('circle', { cx: hx, cy: hy, r: 11, fill: '#2f5bea', stroke: '#fff', 'stroke-width': 3, 'data-handle': 1 });
          h.style.touchAction = 'none'; h.style.cursor = 'nwse-resize';
          svg.append(h);
        }
      }
    }
    function toSvg(svg, e) {
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      return [(e.clientX - r.left) * vb.width / r.width, (e.clientY - r.top) * vb.height / r.height];
    }

    function attachPointer(i, svg) {
      let drag = null;
      svg.addEventListener('pointerdown', async e => {
        const pt = toSvg(svg, e);
        const g = e.target.closest('[data-aid]');
        const item = g && anns[i].find(a => a.id === g.dataset.aid);
        if (tool === 'select') {
          if (e.target.dataset && e.target.dataset.handle && sel && sel.page === i) {
            const a = anns[i].find(x => x.id === sel.id);
            drag = { mode: 'resize', a, orig: JSON.parse(JSON.stringify(a)), before: snapshot() };
          } else if (item) {
            const prev = sel; sel = { page: i, id: item.id };
            if (prev && prev.page !== i) drawPage(prev.page);
            drag = { mode: 'move', a: item, last: pt, before: snapshot(), moved: false };
            drawPage(i); updateSub();
          } else {
            if (sel) { const p = sel.page; sel = null; drawPage(p); updateSub(); }
            return;
          }
          svg.setPointerCapture(e.pointerId); e.preventDefault();
          return;
        }
        if (tool === 'eraser') {
          if (item) { const b = snapshot(); anns[i] = anns[i].filter(a => a !== item); commit(b); drawPage(i); }
          return;
        }
        if (tool === 'text') {
          const r = await textDialog({ size: Math.max(12, Math.min(48, Math.round(pages[i].vp.width / 30))), color: style.color });
          if (!r) return;
          const b = snapshot();
          const a = { id: nid(), type: 'text', x: pt[0], y: pt[1] - r.size * 0.6, ...r };
          measureText(a); anns[i].push(a); commit(b);
          sel = { page: i, id: a.id }; setToolKeepSel('select'); drawPage(i); updateSub();
          return;
        }
        if (tool === 'sign' || tool === 'image') {
          let dataUrl;
          if (tool === 'sign') dataUrl = await signatureDialog();
          else {
            const [f] = await pickDeviceFiles({ accept: 'image/*' });
            if (f) { const c = await ImgProc.blobToCanvas(f, 1600); dataUrl = c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9); }
          }
          if (!dataUrl) return;
          const im = await new Promise(res => { const x = new Image(); x.onload = () => res(x); x.src = dataUrl; });
          const key = nid(); imgs[key] = dataUrl;
          const vpw = pages[i].vp.width;
          const w = tool === 'sign' ? Math.min(vpw * 0.3, 180) : Math.min(vpw * 0.5, im.width);
          const h = w * im.height / im.width;
          const b = snapshot();
          const a = { id: nid(), type: 'image', img: key, x: pt[0] - w / 2, y: pt[1] - h / 2, w, h };
          anns[i].push(a); commit(b);
          sel = { page: i, id: a.id }; setToolKeepSel('select'); drawPage(i); updateSub();
          return;
        }
        // drawing tools
        svg.setPointerCapture(e.pointerId); e.preventDefault();
        const before = snapshot();
        let a;
        if (tool === 'pen') a = { id: nid(), type: 'pen', pts: [pt], color: style.color, width: style.width };
        else if (tool === 'line' || tool === 'arrow') a = { id: nid(), type: tool, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: style.color, width: style.width };
        else a = { id: nid(), type: tool, x: pt[0], y: pt[1], w: 0, h: 0, color: tool === 'highlight' ? style.hlColor : style.color, width: style.width };
        anns[i].push(a);
        drag = { mode: 'draw', a, start: pt, before };
      });
      svg.addEventListener('pointermove', e => {
        if (!drag) return;
        const pt = toSvg(svg, e), a = drag.a;
        if (drag.mode === 'move') { moveBy(a, pt[0] - drag.last[0], pt[1] - drag.last[1]); drag.last = pt; drag.moved = true; }
        else if (drag.mode === 'resize') resizeTo(a, drag.orig, pt[0], pt[1]);
        else if (a.type === 'pen') { const l = a.pts[a.pts.length - 1]; if (Math.hypot(pt[0] - l[0], pt[1] - l[1]) > 1.2) a.pts.push(pt); }
        else if (a.type === 'line' || a.type === 'arrow') { a.x2 = pt[0]; a.y2 = pt[1]; }
        else { a.x = Math.min(drag.start[0], pt[0]); a.y = Math.min(drag.start[1], pt[1]); a.w = Math.abs(pt[0] - drag.start[0]); a.h = Math.abs(pt[1] - drag.start[1]); }
        drawPage(i);
      });
      const end = () => {
        if (!drag) return;
        const a = drag.a;
        if (drag.mode === 'draw') {
          const b = bbox(a);
          const tiny = a.type === 'pen' ? a.pts.length < 2 : (a.type === 'line' || a.type === 'arrow') ? Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 4 : b.w < 4 || b.h < 4;
          if (tiny) anns[i] = anns[i].filter(x => x !== a); else commit(drag.before);
        } else if (drag.mode === 'resize' || drag.moved) commit(drag.before);
        drag = null; drawPage(i);
      };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    }
    function setToolKeepSel(t) {
      const keep = sel; setTool(t); sel = keep;
    }

    /* ----- save into PDF ----- */
    async function exportPdf() {
      const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, BlendMode } = PDFLib;
      const { doc } = await PdfCore.openLib(blob, { name: meta.name, key: id });
      const fonts = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold) };
      const embedded = {};
      const embed = async key => {
        if (!embedded[key]) embedded[key] = imgs[key].startsWith('data:image/png') ? await doc.embedPng(imgs[key]) : await doc.embedJpg(imgs[key]);
        return embedded[key];
      };
      const docPages = doc.getPages();
      for (let i = 0; i < anns.length; i++) {
        if (!anns[i].length) continue;
        const page = docPages[i], vp = pages[i].vp;
        const R = ((vp.rotation % 360) + 360) % 360;
        const P = (x, y) => vp.convertToPdfPoint(x, y);
        const rot = degrees(R);
        for (const a of anns[i]) {
          const col = rgb(...hexToRgb01(a.color || '#000000'));
          if (a.type === 'text') {
            const font = a.bold ? fonts.b : fonts.n;
            if (canEncode(a.text, font)) {
              a.text.split('\n').forEach((line, k) => {
                const [x, y] = P(a.x, a.y + a.size * TEXT_ASC + k * a.size * TEXT_LH);
                page.drawText(line, { x, y, size: a.size, font, color: col, rotate: rot });
              });
            } else { // non-Latin text: rasterize at high resolution
              const c = document.createElement('canvas'), s = 4;
              c.width = Math.ceil(a.w * s) + 4; c.height = Math.ceil(a.h * s) + 4;
              const x = c.getContext('2d'); x.scale(s, s); x.fillStyle = a.color; x.font = `${a.bold ? 'bold ' : ''}${a.size}px ${FONT_CSS}`;
              a.text.split('\n').forEach((line, k) => x.fillText(line, 0, a.size * TEXT_ASC + k * a.size * TEXT_LH));
              const img = await doc.embedPng(c.toDataURL('image/png'));
              const [px, py] = P(a.x, a.y + c.height / s);
              page.drawImage(img, { x: px, y: py, width: c.width / s, height: c.height / s, rotate: rot });
            }
          } else if (a.type === 'image') {
            const img = await embed(a.img);
            const [x, y] = P(a.x, a.y + a.h);
            page.drawImage(img, { x, y, width: a.w, height: a.h, rotate: rot });
          } else if (a.type === 'rect' || a.type === 'highlight') {
            const [x, y] = P(a.x, a.y + a.h);
            if (a.type === 'rect') page.drawRectangle({ x, y, width: a.w, height: a.h, rotate: rot, borderColor: col, borderWidth: a.width });
            else page.drawRectangle({ x, y, width: a.w, height: a.h, rotate: rot, color: col, opacity: 0.4, blendMode: BlendMode.Multiply });
          } else if (a.type === 'ellipse') {
            const [x, y] = P(a.x + a.w / 2, a.y + a.h / 2);
            const swap = R % 180 !== 0;
            page.drawEllipse({ x, y, xScale: (swap ? a.h : a.w) / 2, yScale: (swap ? a.w : a.h) / 2, borderColor: col, borderWidth: a.width });
          } else if (a.type === 'line' || a.type === 'arrow') {
            const segs = [[[a.x1, a.y1], [a.x2, a.y2]]];
            if (a.type === 'arrow') arrowWings(a).forEach(w => segs.push([w, [a.x2, a.y2]]));
            for (const [s, t] of segs) {
              const [x1, y1] = P(...s), [x2, y2] = P(...t);
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: a.width, color: col, lineCap: LineCapStyle.Round });
            }
          } else if (a.type === 'pen') {
            for (let k = 1; k < a.pts.length; k++) {
              const [x1, y1] = P(...a.pts[k - 1]), [x2, y2] = P(...a.pts[k]);
              page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: a.width, color: col, lineCap: LineCapStyle.Round });
            }
          }
        }
      }
      return PdfCore.saveBlob(doc);
    }
    async function save() {
      if (!anns.some(a => a.length)) return toast('Nothing to save yet — add something first');
      const how = await actionSheet('Save changes', [
        { value: 'copy', label: 'Save as new file', icon: 'filePlus' },
        { value: 'replace', label: 'Overwrite original', icon: 'save' },
      ]);
      if (!how) return;
      try {
        const out = await withLoader('Saving PDF…', exportPdf);
        let m;
        if (how === 'replace') m = await Store.replaceBlob(id, out);
        else m = await Store.addFile(out, `${baseName(meta.name)}_edited.pdf`, { folderId: meta.folderId });
        dirty = false;
        toast('Saved');
        App.go(`viewer/${m.id}`, { replace: true });
      } catch (e) { if (e.message !== 'cancelled') alertDialog('Save failed', e.message); }
    }
    App.setBackGuard(async () => {
      if (!dirty) return true;
      return confirmDialog('Discard changes?', 'You have unsaved edits on this PDF.', { okText: 'Discard', danger: true });
    });
    setTool(tool);
    if (tool === 'sign') updateSub();
    return () => { pages.destroy(); pdf.destroy(); };
  },
};
