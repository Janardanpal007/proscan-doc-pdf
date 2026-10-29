// Test-only helpers (not shipped in the APK)
window.makePhoto = (quad, W = 1600, H = 1200) => {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#4a3424'); g.addColorStop(1, '#2a1d14'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${100 + Math.random() * 60},${70 + Math.random() * 40},40,.25)`; x.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
  x.save(); x.beginPath(); quad.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fillStyle = '#f3f1ea'; x.fill(); x.clip();
  const ang = Math.atan2(quad[1][1] - quad[0][1], quad[1][0] - quad[0][0]);
  x.translate(...quad[0]); x.rotate(ang); x.fillStyle = '#222'; x.font = 'bold 46px Arial'; x.fillText('INVOICE #2041', 80, 110); x.font = '24px Arial';
  for (let i = 0; i < 18; i++) x.fillText('Line item ' + (i + 1) + '  $' + (i * 7 + 3) + '.00', 80, 180 + i * 36);
  x.restore();
  return c;
};
window.fx = async n => new File([await (await fetch('_fixtures/' + n)).blob()], n);
window.wait = ms => new Promise(r => setTimeout(r, ms));
// Replace the device file picker with a queue of files for automated tests
window.queueDeviceFiles = files => { window._queued = files; };
const _origPick = window.pickDeviceFiles;
window.pickDeviceFiles = async opts => { if (window._queued) { const f = window._queued; window._queued = null; return f; } return _origPick(opts); };
window.waitFor = async (fn, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(150); } throw new Error('timeout waiting'); };
window.ready = () => waitFor(() => { const b = document.querySelector('#view [data-go]'); return b && !b.disabled && b; });
window.lastOut = async () => { await waitFor(() => document.querySelector('.dialog .file-item .name')); await wait(100); const n = document.querySelector('.dialog .file-item .name').textContent; const f = (await Store.listFiles()).find(x => x.name === n); return { n, f }; };
window.byName = async n => (await Store.listFiles()).find(f => f.name === n);
window.setupFixtures = async () => { for (const n of ['report.docx', 'sales.xlsx', 'deck.pptx', 'sample.pdf']) if (!await byName(n)) await Store.addFile(await fx(n), n); };
