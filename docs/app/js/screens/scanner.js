/* Document scanner: camera with live edge detection, crop with draggable corners, filters, multi-page batch → PDF */

/* Crop editor. Resolves {canvas (rotated original), quad} or null */
function cropDialog(page) {
  return new Promise(resolve => {
    const ov = el(`<div class="full-overlay" style="background:#000">
      <header style="background:#000;color:#fff"><button class="icon-btn" data-a="back">${ic('back')}</button><h2>Adjust corners</h2></header>
      <div class="crop-stage"><div class="cwrap"><canvas></canvas><svg></svg></div></div>
      <div class="dark-bar">
        <button data-a="auto">${ic('wand')}Auto</button><button data-a="full">${ic('crop')}Full</button>
        <button data-a="rl">${ic('rotateL')}Left</button><button data-a="rr">${ic('rotate')}Right</button>
        <button data-a="ok" class="primary">${ic('check')}Next</button></div></div>`);
    let done = false;
    const finish = async v => { if (done) return; done = true; await Overlay.close(); resolve(v); };
    Overlay.open(ov, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    ov.querySelector('[data-a=back]').onclick = () => finish(null);
    let src = page.orig, quad = page.quad ? page.quad.map(p => p.slice()) : null;
    const stage = ov.querySelector('.crop-stage'), wrap = ov.querySelector('.cwrap'), cv = ov.querySelector('.cwrap canvas'), svg = ov.querySelector('.cwrap svg');
    const full = () => [[0, 0], [src.width, 0], [src.width, src.height], [0, src.height]];
    function layout() {
      const pad = 30, sw = stage.clientWidth - pad * 2, sh = stage.clientHeight - pad * 2;
      const s = Math.max(0.02, Math.min(sw / src.width, sh / src.height));
      const prev = ImgProc.toCanvas(src, 1400);
      cv.width = prev.width; cv.height = prev.height; cv.getContext('2d').drawImage(prev, 0, 0);
      cv.style.width = src.width * s + 'px'; cv.style.height = src.height * s + 'px';
      svg.setAttribute('viewBox', `0 0 ${src.width} ${src.height}`);
      wrap._s = s;
      draw();
    }
    function draw() {
      const r = 16 / wrap._s;
      svg.innerHTML = `<defs><mask id="m"><rect width="100%" height="100%" fill="#fff"/><polygon points="${quad.map(p => p.join(',')).join(' ')}" fill="#000"/></mask></defs>
        <rect width="${src.width}" height="${src.height}" fill="rgba(0,0,0,.45)" mask="url(#m)"/>
        <polygon points="${quad.map(p => p.join(',')).join(' ')}" fill="none" stroke="#c6ff3d" stroke-width="${3 / wrap._s}"/>
        ${quad.map((p, i) => `<circle class="handle" data-h="${i}" cx="${p[0]}" cy="${p[1]}" r="${r}" stroke-width="${3 / wrap._s}"/>`).join('')}`;
    }
    let dragging = -1;
    svg.addEventListener('pointerdown', e => {
      const h = e.target.dataset && e.target.dataset.h;
      if (h == null) return;
      dragging = +h; svg.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (dragging < 0) return;
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) / wrap._s, y = (e.clientY - r.top) / wrap._s;
      quad[dragging] = [Math.max(0, Math.min(src.width, x)), Math.max(0, Math.min(src.height, y))];
      draw();
    });
    svg.addEventListener('pointerup', () => dragging = -1);
    const autoDetect = () => { quad = ImgProc.detectQuad(src) || full(); };
    ov.querySelector('[data-a=auto]').onclick = () => { const q = ImgProc.detectQuad(src); if (q) { quad = q; draw(); } else toast('No document edges found — drag the corners'); };
    ov.querySelector('[data-a=full]').onclick = () => { quad = full(); draw(); };
    const rot = d => { src = ImgProc.rotate(src, d); autoDetect(); layout(); };
    ov.querySelector('[data-a=rl]').onclick = () => rot(-90);
    ov.querySelector('[data-a=rr]').onclick = () => rot(90);
    ov.querySelector('[data-a=ok]').onclick = () => finish({ canvas: src, quad });
    if (!quad) autoDetect();
    requestAnimationFrame(layout);
  });
}

/* Filter picker. Resolves filter id or null */
function filterDialog(warped, current) {
  return new Promise(resolve => {
    const ov = el(`<div class="full-overlay" style="background:#000">
      <header style="background:#000;color:#fff"><button class="icon-btn" data-a="back">${ic('back')}</button><h2>Enhance</h2></header>
      <div class="crop-stage"><canvas class="preview-img" style="max-height:100%;max-width:100%;object-fit:contain"></canvas></div>
      <div class="filter-strip"></div>
      <div class="dark-bar"><button data-a="back2">${ic('crop')}Re-crop</button><button data-a="ok" class="primary">${ic('check')}Done</button></div></div>`);
    let done = false;
    const finish = async v => { if (done) return; done = true; await Overlay.close(); resolve(v); };
    Overlay.open(ov, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    ov.querySelector('[data-a=back]').onclick = () => finish(null);
    ov.querySelector('[data-a=back2]').onclick = () => finish('__recrop');
    const prevSrc = ImgProc.toCanvas(warped, 1200);
    const main = ov.querySelector('canvas');
    let cur = current;
    const cache = {};
    function show(id) {
      cur = id;
      const c = cache[id] || (cache[id] = ImgProc.applyFilter(prevSrc, id));
      main.width = c.width; main.height = c.height; main.getContext('2d').drawImage(c, 0, 0);
      strip.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.f === id));
    }
    const strip = ov.querySelector('.filter-strip');
    const tiny = ImgProc.toCanvas(warped, 160);
    ImgProc.FILTERS.forEach(f => {
      const b = el(`<button data-f="${f.id}"><canvas></canvas>${f.label}</button>`);
      const t = ImgProc.applyFilter(tiny, f.id), c = b.querySelector('canvas');
      c.width = t.width; c.height = t.height; c.getContext('2d').drawImage(t, 0, 0);
      b.onclick = () => show(f.id);
      strip.append(b);
    });
    ov.querySelector('[data-a=ok]').onclick = () => finish(cur);
    show(cur);
  });
}

/* Run crop → filter for one page; mutates page. Returns false if cancelled. */
async function processPage(page) {
  for (;;) {
    const c = await cropDialog(page);
    if (!c) return false;
    page.orig = c.canvas; page.quad = c.quad;
    const warped = await withLoader('Correcting perspective…', async () => ImgProc.warp(page.orig, page.quad));
    const f = await filterDialog(warped, page.filter || Settings.get('scanFilter'));
    if (f === '__recrop') continue;
    if (!f) return false;
    page.filter = f;
    page.result = ImgProc.applyFilter(warped, f);
    page.thumb = ImgProc.toCanvas(page.result, 300).toDataURL('image/jpeg', 0.7);
    return true;
  }
}

Screens.scan = {
  title: 'Scan',
  full: true,
  hideTopbar: true,
  async render(view) {
    const batch = [];
    const root = el(`<div class="scanner">
      <div class="stage"><video playsinline muted autoplay></video><canvas class="overlay"></canvas>
        <div class="topctl"><button class="icon-btn" data-a="close">${ic('close')}</button>
          <div class="row"><button class="icon-btn hidden" data-a="torch">${ic('flash')}</button></div></div>
        <div class="hint">Point the camera at a document</div></div>
      <div class="controls">
        <button class="side-btn" data-a="gallery">${ic('image')}Gallery</button>
        <button class="shutter" data-a="shot" aria-label="Capture"></button>
        <button class="side-btn" data-a="done"><div class="batch-thumb"><b>0</b></div>Done</button>
      </div></div>`);
    view.append(root);
    const video = root.querySelector('video'), overlay = root.querySelector('canvas.overlay'), hint = root.querySelector('.hint');
    let stream = null, timer = null, track = null, torchOn = false, stopped = false;

    root.querySelector('[data-a=close]').onclick = () => history.back();
    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera API not available');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) root.querySelector('[data-a=torch]').classList.remove('hidden');
      timer = setInterval(liveDetect, 450);
    }
    function stopCamera() {
      clearInterval(timer); timer = null;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    function videoRect() { // video content box inside element (object-fit: contain)
      const W = video.clientWidth, H = video.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
      const s = Math.min(W / vw, H / vh);
      return { x: (W - vw * s) / 2, y: (H - vh * s) / 2, s };
    }
    function liveDetect() {
      if (!video.videoWidth) return;
      const W = overlay.clientWidth, H = overlay.clientHeight;
      overlay.width = W; overlay.height = H;
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      const q = ImgProc.detectQuad(video);
      if (!q) { hint.textContent = 'Point the camera at a document'; return; }
      const r = videoRect();
      const pts = q.map(([x, y]) => [r.x + x * r.s, r.y + y * r.s]);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#b26bff'); g.addColorStop(0.5, '#ffe14d'); g.addColorStop(1, '#3dffa2');
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.fillStyle = 'rgba(198,255,61,.14)';
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); ctx.stroke();
      hint.textContent = 'Document detected — tap the shutter';
    }
    root.querySelector('[data-a=torch]').onclick = async () => {
      try { torchOn = !torchOn; await track.applyConstraints({ advanced: [{ torch: torchOn }] }); root.querySelector('[data-a=torch]').classList.toggle('on', torchOn); }
      catch { toast('Flash not supported'); }
    };
    function updateBatch() {
      const t = root.querySelector('.batch-thumb');
      t.innerHTML = (batch.length ? `<img src="${batch[batch.length - 1].thumb}" alt="">` : '') + `<b>${batch.length}</b>`;
    }
    async function addPage(canvas) {
      const page = { orig: canvas, quad: null, filter: Settings.get('scanFilter') };
      if (timer) { clearInterval(timer); timer = null; }
      const ok = await processPage(page);
      if (stream) timer = setInterval(liveDetect, 450);
      if (ok) { batch.push(page); updateBatch(); toast(`Page ${batch.length} added`); }
    }
    root.querySelector('[data-a=shot]').onclick = async () => {
      if (!stream || !video.videoWidth) {
        const [f] = await pickDeviceFiles({ accept: 'image/*', capture: 'environment' });
        if (f) addPage(await ImgProc.blobToCanvas(f, 3000));
        return;
      }
      const c = ImgProc.toCanvas(video);
      root.querySelector('.stage').animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 250 });
      addPage(c);
    };
    root.querySelector('[data-a=gallery]').onclick = async () => {
      const files = await pickDeviceFiles({ accept: 'image/*', multiple: true });
      for (const f of files) await addPage(await ImgProc.blobToCanvas(f, 3000));
    };
    root.querySelector('[data-a=done]').onclick = () => {
      if (!batch.length) return toast('Capture or import at least one page');
      reviewBatch(batch, updateBatch);
    };
    App.setBackGuard(async () => {
      if (!batch.length) return true;
      return confirmDialog('Discard scan?', `You have ${batch.length} unsaved page${batch.length > 1 ? 's' : ''}.`, { okText: 'Discard', danger: true });
    });
    App.scanBatch = batch; // exposed for automation/testing
    App.scanAddPage = addPage;

    try { await startCamera(); }
    catch (e) {
      root.querySelector('.stage').append(el(`<div class="nocam">${ic('camera')}<p>Camera is not available (${esc(e.message || e.name)}).</p>
        <p class="small">Tap the shutter to use your phone's camera app, or import photos from the gallery.</p></div>`));
      hint.textContent = '';
    }
    return () => { stopped = true; stopCamera(); };
  },
};

async function reviewBatch(batch, onChange) {
  const o = fullOverlay('Review scan', { actions: `<button class="icon-btn" data-a="add" title="Add page">${ic('plus')}</button>` });
  o.body.append(el(`<div><div class="thumb-grid" data-g></div>
    <div class="field" style="margin-top:16px"><label>File name</label><input data-name value="Scan_${stamp()}"></div>
    <div class="btn-row"><button class="btn ghost" data-a="jpg">${ic('image')} Save JPG</button><button class="btn" data-a="pdf">${ic('file')} Save PDF</button></div></div>`));
  const grid = o.body.querySelector('[data-g]');
  function draw() {
    grid.innerHTML = '';
    batch.forEach((p, i) => {
      const t = el(`<div class="pthumb"><img src="${p.thumb}" alt=""><div>Page ${i + 1}</div>
        <div class="pactions"><button data-x="l">${ic('left')}</button><button data-x="e">${ic('edit')}</button><button data-x="d">${ic('trash')}</button><button data-x="r">${ic('right')}</button></div></div>`);
      t.querySelector('[data-x=l]').onclick = () => { if (i > 0) { [batch[i - 1], batch[i]] = [batch[i], batch[i - 1]]; draw(); } };
      t.querySelector('[data-x=r]').onclick = () => { if (i < batch.length - 1) { [batch[i + 1], batch[i]] = [batch[i], batch[i + 1]]; draw(); } };
      t.querySelector('[data-x=d]').onclick = async () => { if (await confirmDialog('Delete page?', `Remove page ${i + 1} from this scan?`, { okText: 'Delete', danger: true })) { batch.splice(i, 1); draw(); onChange(); if (!batch.length) o.close(); } };
      t.querySelector('[data-x=e]').onclick = async () => { const copy = { ...p }; if (await processPage(copy)) { batch[i] = copy; draw(); onChange(); } };
      grid.append(t);
    });
  }
  draw();
  o.header.querySelector('[data-a=add]').onclick = () => o.close();
  const nameOf = () => (o.body.querySelector('[data-name]').value.trim() || `Scan_${stamp()}`).replace(/[\\/:*?"<>|]/g, '_');
  o.body.querySelector('[data-a=pdf]').onclick = async () => {
    const q = Settings.get('scanQuality');
    const ps = Settings.get('pageSize');
    const name = nameOf();
    const blob = await withLoader('Creating PDF…', async () => {
      const doc = await PDFLib.PDFDocument.create();
      for (const p of batch) await Convert.addImagePage(doc, p.result, { pageSize: ps, margin: ps === 'Fit' ? 0 : 0, quality: q });
      return PdfCore.saveBlob(doc);
    });
    const meta = await Store.addFile(blob, name + '.pdf');
    await ScanStats.record(batch.length);
    batch.length = 0; onChange();
    await Overlay.closeAll();
    App.go(`viewer/${meta.id}`, { replace: true });
    toast('Scan saved as PDF');
  };
  o.body.querySelector('[data-a=jpg]').onclick = async () => {
    const name = nameOf();
    const metas = await withLoader('Saving images…', async () => {
      const out = [];
      for (let i = 0; i < batch.length; i++) {
        const b = await ImgProc.canvasToBlob(batch[i].result, 'image/jpeg', Settings.get('scanQuality'));
        out.push(await Store.addFile(b, batch.length > 1 ? `${name}_${i + 1}.jpg` : `${name}.jpg`));
      }
      return out;
    });
    await ScanStats.record(batch.length);
    batch.length = 0; onChange();
    await Overlay.closeAll();
    App.go('files', { replace: true });
    toast(`${metas.length} image${metas.length > 1 ? 's' : ''} saved`);
  };
}
