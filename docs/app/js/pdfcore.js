/* Shared PDF helpers on top of pdf.js (rendering) and pdf-lib (editing) */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

const PdfCore = (() => {
  const passwords = new Map(); // remembered per session: key -> password

  async function toBytes(src) {
    if (src instanceof Uint8Array) return src;
    if (src instanceof ArrayBuffer) return new Uint8Array(src);
    return new Uint8Array(await src.arrayBuffer());
  }

  /* Open with pdf.js, asking for a password if needed. key identifies the file for password reuse. */
  async function openJs(src, { name = 'PDF', key = null, password = null } = {}) {
    const bytes = await toBytes(src);
    let pw = password ?? (key && passwords.get(key)) ?? undefined;
    let retry = false;
    for (;;) {
      try {
        const task = pdfjsLib.getDocument({ data: bytes.slice(), password: pw, isEvalSupported: false });
        const pdf = await task.promise;
        if (key && pw) passwords.set(key, pw);
        return { pdf, password: pw || null };
      } catch (e) {
        if (e && e.name === 'PasswordException') {
          const p = await passwordPrompt(name, retry || pw !== undefined);
          if (p == null) throw new Error('cancelled');
          pw = p; retry = true; continue;
        }
        throw e;
      }
    }
  }

  async function isEncrypted(src) {
    const doc = await PDFLib.PDFDocument.load(await toBytes(src), { ignoreEncryption: true, updateMetadata: false });
    return doc.isEncrypted;
  }

  /* A decrypted pdf-lib document still carries its /Encrypt entry when saved; copy pages into a clean one. */
  async function cleanCopy(doc) {
    const out = await PDFLib.PDFDocument.create();
    (await out.copyPages(doc, doc.getPageIndices())).forEach(p => out.addPage(p));
    return out;
  }
  async function loadWithPassword(bytes, p) {
    return cleanCopy(await PDFLib.PDFDocument.load(bytes, { password: p, updateMetadata: false }));
  }

  /* Open with pdf-lib, decrypting if necessary. */
  async function openLib(src, { name = 'PDF', key = null, password = null } = {}) {
    const bytes = await toBytes(src);
    const probe = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (!probe.isEncrypted) return { doc: probe, password: null };
    const tries = [password ?? (key && passwords.get(key)), ''].filter(p => p != null);
    for (const p of tries) {
      try { const doc = await loadWithPassword(bytes, p); if (key && p) passwords.set(key, p); return { doc, password: p }; } catch {}
    }
    let retry = false;
    for (;;) {
      const p = await passwordPrompt(name, retry);
      if (p == null) throw new Error('cancelled');
      try {
        const doc = await loadWithPassword(bytes, p);
        if (key) passwords.set(key, p);
        return { doc, password: p };
      } catch { retry = true; }
    }
  }

  async function renderPage(page, scale, canvas = document.createElement('canvas')) {
    const vp = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas;
  }
  async function renderToWidth(page, width, canvas) {
    const vp = page.getViewport({ scale: 1 });
    return renderPage(page, width / vp.width, canvas);
  }

  async function thumbnail(blob, width = 120) {
    const bytes = await toBytes(blob);
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    try {
      const c = await renderToWidth(await pdf.getPage(1), width);
      return c.toDataURL('image/jpeg', 0.7);
    } finally { pdf.destroy(); }
  }

  /* "1-3, 5, 8-" -> zero-based indices (sorted, unique) */
  function parseRanges(text, count) {
    const out = new Set();
    for (const part of String(text).split(',').map(s => s.trim()).filter(Boolean)) {
      const m = /^(\d*)\s*-\s*(\d*)$/.exec(part);
      if (m) {
        const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : count;
        if (a < 1 || b > count || a > b) throw new Error(`Invalid range "${part}" (document has ${count} pages)`);
        for (let i = a; i <= b; i++) out.add(i - 1);
      } else if (/^\d+$/.test(part)) {
        const n = +part;
        if (n < 1 || n > count) throw new Error(`Page ${n} does not exist (document has ${count} pages)`);
        out.add(n - 1);
      } else throw new Error(`Cannot understand "${part}"`);
    }
    return [...out].sort((a, b) => a - b);
  }

  async function saveBlob(doc) {
    const bytes = await doc.save({ useObjectStreams: true });
    return new Blob([bytes], { type: 'application/pdf' });
  }

  return { toBytes, openJs, openLib, loadWithPassword, isEncrypted, renderPage, renderToWidth, thumbnail, parseRanges, saveBlob, passwords };
})();
