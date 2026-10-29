/* Settings & about */
Screens.settings = {
  title: 'Settings',
  nav: 'settings',
  async render(view) {
    const u = await Store.usage();
    const st = await ScanStats.get();
    view.append(el(`<div>
      <div class="card">
        <div class="field"><label>Appearance</label><select data-k="theme"><option value="system">System default</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        <div class="field"><label>Default scan filter</label><select data-k="scanFilter">${ImgProc.FILTERS.map(f => `<option value="${f.id}">${f.label}</option>`).join('')}</select></div>
        <div class="field"><label>Page size for Image → PDF and scans</label><select data-k="pageSize"><option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Fit">Fit to image</option></select></div>
        <div class="field"><label>Scan image quality</label><select data-k="scanQuality"><option value="0.95">High</option><option value="0.85">Standard</option><option value="0.7">Small file</option></select></div>
      </div>
      <div class="card"><div class="row"><div class="grow"><b>Storage</b><div class="muted small">${u.count} files · ${fmtSize(u.bytes)} on this device</div></div>
        <button class="btn danger" data-a="clear">${ic('trash')} Clear</button></div></div>
      <div class="card"><div class="row"><div class="qi" style="width:44px;height:44px;border-radius:12px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center">${ic('scan')}</div>
        <div class="grow"><b>ProScan : Doc, PDF</b><div class="muted small">Version 1.0.0 · All processing happens on your device. No account, no uploads.</div>
        <div class="row" style="gap:18px;margin-top:10px">
          <div><div style="font-size:24px;font-weight:800">${st.docs}</div><div class="muted small">Documents scanned</div></div>
          <div><div style="font-size:24px;font-weight:800">${st.pages}</div><div class="muted small">Pages scanned</div></div></div>
        <div class="small" style="margin-top:8px">Built by <b style="color:var(--accent-text)">Janardan / TSE</b></div></div></div></div>
    </div>`));
    view.querySelectorAll('[data-k]').forEach(s => {
      s.value = String(Settings.get(s.dataset.k));
      s.onchange = () => {
        const v = s.dataset.k === 'scanQuality' ? +s.value : s.value;
        Settings.set(s.dataset.k, v);
        if (s.dataset.k === 'theme') App.applyTheme();
        toast('Saved');
      };
    });
    view.querySelector('[data-a=clear]').onclick = async () => {
      if (await confirmDialog('Delete all files?', 'Every document and folder stored in ProScan will be permanently deleted.', { okText: 'Delete all', danger: true })) {
        await Store.clearAll(); toast('All files deleted'); App.render();
      }
    };
  },
};
