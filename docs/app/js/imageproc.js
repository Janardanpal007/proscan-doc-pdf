/* Image processing for the scanner: document edge detection, perspective warp, filters */
const ImgProc = (() => {
  async function loadBitmap(blob) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch {
      return new Promise((res, rej) => {
        const img = new Image(); const url = URL.createObjectURL(blob);
        img.onload = () => { URL.revokeObjectURL(url); res(img); };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Cannot read image')); };
        img.src = url;
      });
    }
  }
  function toCanvas(src, maxDim = 0) {
    const w0 = src.width || src.videoWidth, h0 = src.height || src.videoHeight;
    const s = maxDim && Math.max(w0, h0) > maxDim ? maxDim / Math.max(w0, h0) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  async function blobToCanvas(blob, maxDim = 3000) { return toCanvas(await loadBitmap(blob), maxDim); }
  function canvasToBlob(c, type = 'image/jpeg', q = 0.9) {
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Encoding failed')), type, q));
  }
  async function thumbFromBlob(blob, w = 120) {
    const c = toCanvas(await loadBitmap(blob), w * 2);
    return c.toDataURL('image/jpeg', 0.7);
  }

  /* ---------- edge detection ---------- */
  function grayOf(c) {
    const { width: w, height: h } = c;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
    return g;
  }
  function boxBlur(g, w, h, r) {
    const t = new Float32Array(g.length), o = new Float32Array(g.length), n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += g[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        t[y * w + x] = acc / n;
        acc += g[y * w + Math.min(w - 1, x + r + 1)] - g[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        o[y * w + x] = acc / n;
        acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x];
      }
    }
    return o;
  }
  function otsu(g) {
    const hist = new Float64Array(256);
    for (const v of g) hist[v | 0]++;
    const total = g.length;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, th = 127;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; th = i; }
    }
    return th;
  }
  function components(mask, w, h) {
    const labels = new Int32Array(w * h), comps = [];
    const stack = new Int32Array(w * h);
    let next = 1;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || labels[i]) continue;
      let sp = 0, area = 0, border = 0;
      stack[sp++] = i; labels[i] = next;
      while (sp) {
        const p = stack[--sp]; area++;
        const x = p % w, y = (p / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
        if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[sp++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = next; stack[sp++] = p - w; }
        if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = next; stack[sp++] = p + w; }
      }
      comps.push({ label: next, area, border });
      next++;
    }
    return { labels, comps };
  }
  function hull(points) {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of points) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = points.length - 1; i >= 0; i--) { const p = points[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  const triArea = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function reduceTo4(poly) {
    poly = poly.slice();
    while (poly.length > 4) {
      let mi = 0, ma = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const a = triArea(poly[(i - 1 + poly.length) % poly.length], poly[i], poly[(i + 1) % poly.length]);
        if (a < ma) { ma = a; mi = i; }
      }
      poly.splice(mi, 1);
    }
    return poly;
  }
  function orderQuad(q) {
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    q = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let tl = 0; q.forEach((p, i) => { if (p[0] + p[1] < q[tl][0] + q[tl][1]) tl = i; });
    return q.slice(tl).concat(q.slice(0, tl));
  }
  /* Returns [[x,y] TL, TR, BR, BL] in source pixel coords, or null */
  function detectQuad(src) {
    const small = toCanvas(src, 360);
    const w = small.width, h = small.height, total = w * h;
    const g = boxBlur(boxBlur(grayOf(small), w, h, 2), w, h, 2);
    const th = otsu(g);
    let best = null;
    for (const bright of [true, false]) {
      const mask = new Uint8Array(total);
      for (let i = 0; i < total; i++) mask[i] = bright ? g[i] > th : g[i] <= th;
      const { labels, comps } = components(mask, w, h);
      for (const c of comps) {
        const frac = c.area / total;
        if (frac < 0.08 || frac > 0.985) continue;
        const borderFrac = c.border / (2 * (w + h));
        const score = frac - borderFrac * 0.8 + (bright ? 0.05 : 0);
        if (!best || score > best.score) best = { score, labels, label: c.label };
      }
    }
    if (!best) return null;
    const pts = [];
    for (let y = 0; y < h; y++) {
      let minX = -1, maxX = -1;
      for (let x = 0; x < w; x++) if (best.labels[y * w + x] === best.label) { if (minX < 0) minX = x; maxX = x; }
      if (minX >= 0) { pts.push([minX, y]); pts.push([maxX, y]); }
    }
    if (pts.length < 8) return null;
    const hl = hull(pts);
    if (hl.length < 4) return null;
    let quad = orderQuad(reduceTo4(hl));
    if (polyArea(quad) < 0.06 * total) return null;
    quad = refineQuad(quad, pts);
    const sx = (src.width || src.videoWidth) / w, sy = (src.height || src.videoHeight) / h;
    return quad.map(([x, y]) => [Math.min(w, Math.max(0, x)) * sx, Math.min(h, Math.max(0, y)) * sy]);
  }
  /* Fit a line to the boundary points along each side (ignoring rounded corners) and intersect neighbours */
  function refineQuad(q, pts) {
    const lines = [];
    for (let s = 0; s < 4; s++) {
      const a = q[s], b = q[(s + 1) % 4];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const near = pts.filter(p => {
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
        const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
        return t > 0.12 && t < 0.88 && d < Math.max(3, len * 0.04);
      });
      if (near.length < 5) return q;
      const mx = near.reduce((s2, p) => s2 + p[0], 0) / near.length, my = near.reduce((s2, p) => s2 + p[1], 0) / near.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const [x, y] of near) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); // principal direction
      lines.push({ p: [mx, my], d: [Math.cos(ang), Math.sin(ang)] });
    }
    const out = [];
    for (let i = 0; i < 4; i++) {
      const L1 = lines[(i + 3) % 4], L2 = lines[i]; // corner i joins side i-1 and side i
      const den = L1.d[0] * L2.d[1] - L1.d[1] * L2.d[0];
      if (Math.abs(den) < 1e-6) return q;
      const t = ((L2.p[0] - L1.p[0]) * L2.d[1] - (L2.p[1] - L1.p[1]) * L2.d[0]) / den;
      const c = [L1.p[0] + t * L1.d[0], L1.p[1] + t * L1.d[1]];
      if (Math.hypot(c[0] - q[i][0], c[1] - q[i][1]) > 25) return q; // refinement went wild: keep coarse quad
      out.push(c);
    }
    return out;
  }

  /* ---------- perspective warp ---------- */
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  function homography(from, to) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = from[i], [u, v] = to[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    return solve(A, b);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function warp(srcCanvas, quad, maxDim = 2400) {
    const [tl, tr, br, bl] = quad;
    let W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br));
    const s = Math.max(W, H) > maxDim ? maxDim / Math.max(W, H) : 1;
    W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s));
    const hm = homography([[0, 0], [W, 0], [W, H], [0, H]], quad);
    const sw = srcCanvas.width, sh = srcCanvas.height;
    const sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const octx = out.getContext('2d');
    const od = octx.createImageData(W, H), o = od.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const den = hm[6] * x + hm[7] * y + 1;
        let fx = (hm[0] * x + hm[1] * y + hm[2]) / den, fy = (hm[3] * x + hm[4] * y + hm[5]) / den;
        fx = Math.min(sw - 1.001, Math.max(0, fx)); fy = Math.min(sh - 1.001, Math.max(0, fy));
        const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        const k = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          o[k + ch] = (sd[i00 + ch] * (1 - ax) + sd[i10 + ch] * ax) * (1 - ay) + (sd[i01 + ch] * (1 - ax) + sd[i11 + ch] * ax) * ay;
        }
        o[k + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  /* ---------- filters ---------- */
  const FILTERS = [
    { id: 'original', label: 'Original' }, { id: 'magic', label: 'Magic' }, { id: 'lighten', label: 'Lighten' },
    { id: 'gray', label: 'Grayscale' }, { id: 'bw', label: 'B & W' },
  ];
  function levels(d) {
    const hist = new Uint32Array(256), n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
    acc = 0;
    for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.05) { hi = i; break; } }
    if (hi - lo < 30) { lo = 0; hi = 255; }
    return [lo, hi];
  }
  function applyFilter(src, id) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
    if (id === 'original') return c;
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    if (id === 'magic' || id === 'gray') {
      const [lo, hi] = levels(d), k = 255 / (hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        let r = (d[i] - lo) * k, g = (d[i + 1] - lo) * k, b = (d[i + 2] - lo) * k;
        if (id === 'gray') { const y = r * 0.299 + g * 0.587 + b * 0.114; r = g = b = y; }
        else { const y = r * 0.299 + g * 0.587 + b * 0.114; r = y + (r - y) * 1.25; g = y + (g - y) * 1.25; b = y + (b - y) * 1.25; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    } else if (id === 'lighten') {
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) lut[i] = Math.min(255, 255 * Math.pow(i / 255, 0.7) + 12);
      for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    } else if (id === 'bw') {
      const w = c.width, h = c.height, gray = new Float32Array(w * h);
      for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
      const integ = new Float64Array((w + 1) * (h + 1));
      for (let y = 1; y <= h; y++) {
        let row = 0;
        for (let x = 1; x <= w; x++) { row += gray[(y - 1) * w + x - 1]; integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + row; }
      }
      const s = Math.max(8, Math.round(Math.max(w, h) / 16)) >> 1, T = 0.13;
      for (let y = 0; y < h; y++) {
        const y1 = Math.max(0, y - s), y2 = Math.min(h, y + s + 1);
        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x - s), x2 = Math.min(w, x + s + 1);
          const count = (x2 - x1) * (y2 - y1);
          const sum = integ[y2 * (w + 1) + x2] - integ[y1 * (w + 1) + x2] - integ[y2 * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
          const v = gray[y * w + x] * count < sum * (1 - T) ? 0 : 255;
          const k = (y * w + x) * 4; d[k] = d[k + 1] = d[k + 2] = v;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function rotate(src, deg) {
    const c = document.createElement('canvas');
    const swap = Math.abs(deg) % 180 === 90;
    c.width = swap ? src.height : src.width; c.height = swap ? src.width : src.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  return { loadBitmap, toCanvas, blobToCanvas, canvasToBlob, thumbFromBlob, detectQuad, warp, applyFilter, rotate, FILTERS };
})();
