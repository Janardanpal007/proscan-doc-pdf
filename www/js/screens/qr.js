/* QR code & barcode scanner (ZXing) with history */
const QR = (() => {
  const Z = window.ZXing;
  const hints = new Map();
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.AZTEC, Z.BarcodeFormat.PDF_417,
    Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E,
    Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR,
  ]);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  function decodeCanvas(c) {
    const src = new Z.HTMLCanvasElementLuminanceSource(c);
    for (const bin of [new Z.HybridBinarizer(src), new Z.GlobalHistogramBinarizer(src)]) {
      try { const r = reader.decode(new Z.BinaryBitmap(bin)); return { text: r.getText(), format: Z.BarcodeFormat[r.getBarcodeFormat()] }; }
      catch { /* not found */ }
    }
    return null;
  }
  async function decodeBlob(blob) {
    const base = await ImgProc.blobToCanvas(blob, 2000);
    for (const dim of [2000, 1200, 800]) {
      const r = decodeCanvas(ImgProc.toCanvas(base, dim));
      if (r) return r;
    }
    return null;
  }
  const History = {
    list() { try { return JSON.parse(localStorage.getItem('ps_qr') || '[]'); } catch { return []; } },
    add(r) { const l = this.list().filter(x => x.text !== r.text); l.unshift({ ...r, at: Date.now() }); localStorage.setItem('ps_qr', JSON.stringify(l.slice(0, 50))); },
    clear() { localStorage.removeItem('ps_qr'); },
  };
  function classify(text) {
    if (/^https?:\/\//i.test(text)) return { kind: 'URL', icon: 'globe' };
    if (/^WIFI:/i.test(text)) return { kind: 'Wi-Fi', icon: 'wifi' };
    if (/^BEGIN:VCARD/i.test(text) || /^MECARD:/i.test(text)) return { kind: 'Contact', icon: 'user' };
    if (/^mailto:/i.test(text)) return { kind: 'Email', icon: 'external' };
    if (/^tel:/i.test(text)) return { kind: 'Phone', icon: 'external' };
    if (/^\d{8,14}$/.test(text)) return { kind: 'Product', icon: 'qr' };
    return { kind: 'Text', icon: 'type' };
  }
  function parseWifi(t) {
    const get = k => { const m = new RegExp(`[;:]${k}:((?:\\\\.|[^;])*)`, 'i').exec(t); return m ? m[1].replace(/\\(.)/g, '$1') : ''; };
    return { ssid: get('S'), password: get('P'), security: get('T') || 'nopass', hidden: get('H') };
  }
  async function showResult(r) {
    History.add(r);
    const c = classify(r.text);
    if (navigator.vibrate) navigator.vibrate(60);
    await openDialog((box, finish) => {
      let details = '';
      if (c.kind === 'Wi-Fi') {
        const w = parseWifi(r.text);
        details = `<div class="kv" style="margin-bottom:10px"><b>Network</b><span>${esc(w.ssid)}</span><b>Password</b><span>${esc(w.password || '—')}</span><b>Security</b><span>${esc(w.security)}</span></div>`;
      }
      box.append(el(`<div><div class="row"><span class="badge">${esc(c.kind)}</span><span class="badge">${esc(r.format)}</span></div>
        <h3 style="margin-top:12px">Scan result</h3>${details}<div class="result-box">${esc(r.text)}</div>
        <div class="btn-row wrap" data-btns></div></div>`));
      const btns = box.querySelector('[data-btns]');
      const add = (label, icon, fn, primary) => { const b = el(`<button class="btn ${primary ? '' : 'secondary'}">${ic(icon)} ${label}</button>`); b.onclick = fn; btns.append(b); };
      if (c.kind === 'URL') add('Open link', 'external', () => Native.openUrl(r.text), true);
      if (c.kind === 'Email' || c.kind === 'Phone') add('Open', 'external', () => Native.openUrl(r.text), true);
      if (c.kind === 'Product') add('Search product', 'search', () => Native.openUrl('https://www.google.com/search?q=' + encodeURIComponent(r.text)), true);
      if (c.kind === 'Wi-Fi') add('Copy password', 'copy', () => copyText(parseWifi(r.text).password), true);
      add('Copy', 'copy', () => copyText(r.text));
      add('Share', 'share', () => Native.shareText(r.text));
      if (c.kind === 'Text') add('Web search', 'search', () => Native.openUrl('https://www.google.com/search?q=' + encodeURIComponent(r.text)));
      add('Close', 'close', () => finish(true));
    });
  }
  return { decodeCanvas, decodeBlob, showResult, History, classify };
})();

Screens.qr = {
  title: 'QR & Barcode',
  full: true,
  hideTopbar: true,
  async render(view) {
    const root = el(`<div class="scanner">
      <div class="stage"><video playsinline muted autoplay></video>
        <div class="topctl"><button class="icon-btn" data-a="close">${ic('close')}</button><div class="row">
          <button class="icon-btn hidden" data-a="torch">${ic('flash')}</button><button class="icon-btn" data-a="hist">${ic('history')}</button></div></div>
        <div style="position:absolute;width:64%;max-width:300px;aspect-ratio:1;border-radius:26px;box-shadow:0 0 0 2000px rgba(0,0,0,.45);border:3px solid #c6ff3d;pointer-events:none"></div>
        <div class="hint">Align a QR code or barcode inside the frame</div></div>
      <div class="controls">
        <button class="side-btn" data-a="img">${ic('image')}Scan image</button>
        <div style="width:70px"></div>
        <button class="side-btn" data-a="hist2">${ic('history')}History</button></div></div>`);
    view.append(root);
    const video = root.querySelector('video');
    let stream, track, timer, paused = false, stopped = false, lastText = null, lastAt = 0;
    root.querySelector('[data-a=close]').onclick = () => history.back();
    const work = document.createElement('canvas');
    async function tick() {
      if (paused || !video.videoWidth) return;
      // decode the central square region for speed
      const s = Math.min(video.videoWidth, video.videoHeight) * 0.8;
      const sx = (video.videoWidth - s) / 2, sy = (video.videoHeight - s) / 2, d = Math.min(800, s);
      work.width = d; work.height = d;
      work.getContext('2d').drawImage(video, sx, sy, s, s, 0, 0, d, d);
      const r = QR.decodeCanvas(work) || QR.decodeCanvas(ImgProc.toCanvas(video, 1000));
      // don't re-open the same code right after the user dismissed it
      if (r && !(r.text === lastText && Date.now() - lastAt < 4000)) {
        paused = true; await QR.showResult(r); paused = false;
        lastText = r.text; lastAt = Date.now();
      } else if (r && r.text === lastText) lastAt = Date.now();
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (stopped) stream.getTracks().forEach(t => t.stop());
      else {
        video.srcObject = stream; await video.play().catch(() => {});
        track = stream.getVideoTracks()[0];
        if (track.getCapabilities && track.getCapabilities().torch) root.querySelector('[data-a=torch]').classList.remove('hidden');
        timer = setInterval(tick, 300);
      }
    } catch (e) {
      root.querySelector('.hint').textContent = 'Camera not available — use “Scan image” to read a code from a photo.';
    }
    let torch = false;
    root.querySelector('[data-a=torch]').onclick = async () => { try { torch = !torch; await track.applyConstraints({ advanced: [{ torch }] }); } catch { toast('Flash not supported'); } };
    root.querySelector('[data-a=img]').onclick = async () => {
      const [f] = await pickDeviceFiles({ accept: 'image/*' });
      if (!f) return;
      paused = true;
      const r = await withLoader('Reading code…', () => QR.decodeBlob(f));
      if (r) await QR.showResult(r); else await alertDialog('No code found', 'Could not find a QR code or barcode in that image. Try a sharper, closer photo.');
      paused = false;
    };
    const showHistory = async () => {
      paused = true;
      const o = fullOverlay('Scan history', { actions: `<button class="icon-btn" data-a="clr">${ic('trash')}</button>` });
      const draw = () => {
        o.body.innerHTML = '';
        const l = QR.History.list();
        if (!l.length) o.body.append(el(`<div class="empty">${ic('qr')}<div>No scans yet</div></div>`));
        const list = el(`<div class="file-list"></div>`);
        l.forEach(r => {
          const c = QR.classify(r.text);
          const it = el(`<div class="file-item"><div class="thumb ring">${ic(c.icon)}</div><div class="meta"><div class="name">${esc(r.text)}</div><div class="sub">${c.kind} · ${esc(r.format)} · ${fmtDate(r.at)}</div></div></div>`);
          it.onclick = () => QR.showResult(r);
          list.append(it);
        });
        o.body.append(list);
      };
      o.header.querySelector('[data-a=clr]').onclick = async () => { if (await confirmDialog('Clear history?', 'Remove all saved scan results?', { okText: 'Clear', danger: true })) { QR.History.clear(); draw(); } };
      draw();
      await o.closed; paused = false;
    };
    root.querySelector('[data-a=hist]').onclick = showHistory;
    root.querySelector('[data-a=hist2]').onclick = showHistory;
    return () => { stopped = true; clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); };
  },
};
