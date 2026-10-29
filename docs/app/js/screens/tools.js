/* All tools grid */
const TOOL_CATS = [
  { title: 'Scan', items: [
    { label: 'Scan to PDF', icon: 'scan', color: '#2f5bea', route: 'scan' },
    { label: 'QR & Barcode', icon: 'qr', color: '#0ea5e9', route: 'qr' },
    { label: 'Import Files', icon: 'upload', color: '#64748b', run: () => App.importFiles() },
  ] },
  { title: 'Convert', items: [
    { label: 'Word to PDF', icon: 'file', color: '#2b579a', route: 'tool/word2pdf' },
    { label: 'PDF to Word', icon: 'file', color: '#5b7bd5', route: 'tool/pdf2word' },
    { label: 'Image to PDF', icon: 'image', color: '#1f9d55', route: 'tool/img2pdf' },
    { label: 'PDF to Image', icon: 'image', color: '#16a34a', route: 'tool/pdf2img' },
    { label: 'Excel to PDF', icon: 'grid', color: '#217346', route: 'tool/excel2pdf' },
    { label: 'PPT to PDF', icon: 'pages', color: '#d24726', route: 'tool/ppt2pdf' },
  ] },
  { title: 'Edit', items: [
    { label: 'Edit PDF', icon: 'edit', color: '#e5383b', route: 'tool/edit' },
    { label: 'Sign PDF', icon: 'sign', color: '#8e44ad', route: 'tool/sign' },
    { label: 'Watermark', icon: 'drop', color: '#0891b2', route: 'tool/watermark' },
  ] },
  { title: 'PDF Tools', items: [
    { label: 'Merge PDF', icon: 'layers', color: '#f59e0b', route: 'tool/merge' },
    { label: 'Compress PDF', icon: 'compress', color: '#10b981', route: 'tool/compress' },
    { label: 'Extract Pages', icon: 'scissors', color: '#ef4444', route: 'tool/extract' },
    { label: 'Organize Pages', icon: 'pages', color: '#6366f1', route: 'tool/organize' },
    { label: 'Lock PDF', icon: 'lock', color: '#334155', route: 'tool/lock' },
    { label: 'Unlock PDF', icon: 'unlock', color: '#475569', route: 'tool/unlock' },
    { label: 'Print', icon: 'printer', color: '#0f766e', route: 'tool/print' },
  ] },
];
Screens.tools = {
  title: 'All Tools',
  nav: 'tools',
  render(view) {
    let n = 0;
    TOOL_CATS.forEach(cat => {
      const sec = el(`<div class="tool-cat"><div class="section-title">${cat.title}</div><div class="tool-grid"></div></div>`);
      cat.items.forEach(t => {
        const b = el(`<button class="qitem"><span class="qi" style="--c:${NEON[(n++) % NEON.length]}">${ic(t.icon)}</span>${t.label}</button>`);
        b.onclick = () => t.run ? t.run() : App.go(t.route);
        sec.querySelector('.tool-grid').append(b);
      });
      view.append(sec);
    });
  },
};
