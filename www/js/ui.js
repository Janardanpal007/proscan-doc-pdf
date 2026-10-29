/* UI helpers: icons, elements, overlays (back-button aware), dialogs, toast, loader */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2.5h7.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  folderPlus: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2.5h7.5A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M12 10.5v6M9 13.5h6"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  filePlus: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
  sign: '<path d="M3 20c2.5-.5 4.5-5 7-5s1.5 3.5 4 3.5 3-2.5 7-2.5"/><path d="M15 3.5 18.5 7 11 14.5H7.5V11z"/>',
  drop: '<path d="M12 2.7 17.7 8.4a8 8 0 1 1-11.4 0z"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  highlight: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  pen: '<path d="M12 19c-4 1-7-1-8-4M4 15c3-6 6-9 9-9s1 5-2 7 4 2 9-4"/>',
  square: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  circle: '<ellipse cx="12" cy="12" rx="9" ry="7.5"/>',
  line: '<path d="M5 19 19 5"/>',
  arrow: '<path d="M5 19 19 5M9 5h10v10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  rotateL: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>',
  flash: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  pointer: '<path d="m4 3 7 17 2.5-7.5L21 10z"/>',
  sort: '<path d="M3 6h13M3 12h9M3 18h5M17 10V20M14 17l3 3 3-3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  wand: '<path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM5 21 16 10l-2-2L3 19z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pages: '<rect x="7" y="3" width="13" height="15" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
  move: '<path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  zip: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M10 3v2M10 7v2M10 11v2M9 15h2v3H9z"/>',
  eraser: '<path d="m7 21-4-4 10-10 7 7-7 7zM21 21H7M9 11l7 7"/>',
};
function ic(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ic(e.dataset.ic); e.removeAttribute('data-ic'); });
}
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const node = t.content.firstElementChild;
  hydrateIcons(node);
  return node;
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}
function fmtDate(t) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// rAF never fires while the app is in the background, so fall back to a timer
const nextFrame = () => new Promise(r => { requestAnimationFrame(() => r()); setTimeout(r, 60); });
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function baseName(name) { return name.replace(/\.[^.]+$/, ''); }
function extOf(name) { const m = /\.([^.]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; }

const loadedScripts = {};
function loadScript(src) {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  return loadedScripts[src];
}

/* ---- Overlay stack integrated with history so the Android back button closes dialogs ---- */
const Overlay = {
  stack: [],
  open(node, { onClose, dismissable = true } = {}) {
    const entry = { node, onClose, dismissable };
    this.stack.push(entry);
    document.getElementById('overlays').appendChild(node);
    history.pushState({ ov: this.stack.length, d: (history.state && history.state.d) || 0 }, '', location.href);
    return entry;
  },
  // Close the top overlay via history so state stays consistent.
  close() {
    if (!this.stack.length) return Promise.resolve();
    return new Promise(res => { this._pending = res; history.back(); });
  },
  async closeAll() { while (this.stack.length) await this.close(); },
  _onPop(state) {
    const depth = (state && state.ov) || 0;
    let closed = false;
    while (this.stack.length > depth) {
      const e = this.stack.pop();
      e.node.remove();
      e.onClose && e.onClose();
      closed = true;
    }
    if (this._pending) { const r = this._pending; this._pending = null; r(); }
    return closed;
  },
  get top() { return this.stack[this.stack.length - 1]; },
};

function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

/* Loader is not part of history (cannot be dismissed with back). */
const Loader = {
  node: null,
  show(msg = 'Working…') {
    if (!this.node) {
      this.node = el(`<div class="loader"><div class="box"><div class="spinner"></div><div class="lmsg"></div><div class="progress hidden"><div></div></div></div></div>`);
      document.getElementById('overlays').appendChild(this.node);
    }
    this.node.querySelector('.lmsg').textContent = msg;
    this.node.querySelector('.progress').classList.add('hidden');
  },
  progress(frac, msg) {
    if (!this.node) this.show(msg);
    if (msg) this.node.querySelector('.lmsg').textContent = msg;
    const p = this.node.querySelector('.progress');
    p.classList.remove('hidden');
    p.firstElementChild.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  },
  hide() { if (this.node) { this.node.remove(); this.node = null; } },
};
async function withLoader(msg, fn) {
  Loader.show(msg);
  await nextFrame();
  try { return await fn(); } finally { Loader.hide(); }
}

/* Generic modal dialog. Resolves with value or null when dismissed. */
function openDialog(buildFn, { centered = true, sheet = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const scrim = el(`<div class="scrim ${centered && !sheet ? 'centered' : ''}"></div>`);
    const box = el(sheet ? `<div class="sheet"><div class="grip"></div></div>` : `<div class="dialog"></div>`);
    scrim.appendChild(box);
    const finish = async (val) => {
      if (done) return; done = true;
      // Wait for the history pop before resolving so callers can safely open the next overlay.
      if (Overlay.stack.some(e => e.node === scrim)) await Overlay.close();
      resolve(val);
    };
    buildFn(box, finish);
    scrim.addEventListener('click', e => { if (e.target === scrim) finish(null); });
    Overlay.open(scrim, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    const f = box.querySelector('[autofocus]');
    if (f) setTimeout(() => { f.focus(); f.select && f.select(); }, 60);
  });
}

function promptText(title, value = '', { placeholder = '', okText = 'OK', type = 'text', label = '' } = {}) {
  return openDialog((box, finish) => {
    box.append(el(`<div><h3>${esc(title)}</h3>${label ? `<label>${esc(label)}</label>` : ''}
      <input type="${type}" autofocus placeholder="${esc(placeholder)}" value="${esc(value)}">
      <div class="btn-row"><button class="btn ghost" data-a="c">Cancel</button><button class="btn" data-a="o">${esc(okText)}</button></div></div>`));
    const inp = box.querySelector('input');
    box.querySelector('[data-a=c]').onclick = () => finish(null);
    const ok = () => finish(inp.value);
    box.querySelector('[data-a=o]').onclick = ok;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
function confirmDialog(title, msg, { okText = 'OK', danger = false } = {}) {
  return openDialog((box, finish) => {
    box.append(el(`<div><h3>${esc(title)}</h3><p class="muted">${esc(msg)}</p>
      <div class="btn-row"><button class="btn ghost" data-a="c">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-a="o">${esc(okText)}</button></div></div>`));
    box.querySelector('[data-a=c]').onclick = () => finish(false);
    box.querySelector('[data-a=o]').onclick = () => finish(true);
  }).then(v => !!v);
}
function alertDialog(title, msg) {
  return openDialog((box, finish) => {
    box.append(el(`<div><h3>${esc(title)}</h3><p class="muted" style="white-space:pre-wrap">${esc(msg)}</p>
      <div class="btn-row"><button class="btn">OK</button></div></div>`));
    box.querySelector('button').onclick = () => finish(true);
  });
}
/* Bottom sheet with options: [{icon,label,value,danger}] */
function actionSheet(title, options) {
  return openDialog((box, finish) => {
    if (title) box.append(el(`<h3>${esc(title)}</h3>`));
    options.forEach(o => {
      const b = el(`<button class="opt ${o.danger ? 'danger' : ''}">${ic(o.icon || 'right')}<span class="grow">${esc(o.label)}</span></button>`);
      b.onclick = () => finish(o.value);
      box.append(b);
    });
  }, { sheet: true });
}
function passwordPrompt(name, retry) {
  return promptText(retry ? 'Wrong password, try again' : 'Password required', '', {
    type: 'password', okText: 'Unlock', label: `"${name}" is password protected`, placeholder: 'Enter password',
  });
}

/* Full screen overlay page with header. Returns {node, body, header, close} */
function fullOverlay(title, { actions = '' } = {}) {
  const node = el(`<div class="full-overlay"><header><button class="icon-btn" data-a="back">${ic('back')}</button><h2>${esc(title)}</h2><div class="row hdr-actions">${actions}</div></header><div class="body"></div></div>`);
  let closedResolve;
  const closed = new Promise(r => (closedResolve = r));
  const entry = Overlay.open(node, { onClose: () => closedResolve() });
  node.querySelector('[data-a=back]').onclick = () => Overlay.close();
  return { node, entry, body: node.querySelector('.body'), header: node.querySelector('header'), close: () => Overlay.close(), closed };
}

function pickColorRow(colors, current, onPick) {
  const row = el(`<div class="row wrap"></div>`);
  colors.forEach(c => {
    const s = el(`<button class="swatch ${c === current ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`);
    s.onclick = () => { row.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); s.classList.add('on'); onPick(c); };
    row.append(s);
  });
  return row;
}
const PALETTE = ['#111111', '#e5383b', '#2f5bea', '#1f9d55', '#f5a524', '#8e44ad', '#ffffff'];

function hexToRgb01(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast('Copied to clipboard');
}
/* Pick files from the device through a hidden input */
function pickDeviceFiles({ accept = '*/*', multiple = false, capture = null } = {}) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
    if (capture) inp.setAttribute('capture', capture);
    inp.style.display = 'none';
    let settled = false;
    inp.onchange = () => { settled = true; resolve([...inp.files]); inp.remove(); };
    // "cancel" event exists on modern Chromium; otherwise the promise simply waits for the next pick.
    inp.addEventListener('cancel', () => { if (!settled) resolve([]); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

const Screens = {};
