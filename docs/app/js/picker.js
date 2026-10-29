/* File picker: choose from the ProScan library or browse the device. Resolves to [{blob, name, id?}] */
const KIND_ACCEPT = {
  pdf: '.pdf,application/pdf',
  image: 'image/*',
  word: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel: '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv',
  ppt: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const KIND_STYLE = {
  pdf: ['#ff4d5e', 'PDF'], image: ['#3dffa2', 'IMG'], word: ['#38bdf8', 'DOC'], excel: ['#c6ff3d', 'XLS'],
  ppt: ['#ff9f1c', 'PPT'], text: ['#a1a1aa', 'TXT'], zip: ['#a855f7', 'ZIP'], other: ['#a1a1aa', 'FILE'],
};
function thumbHtml(meta) {
  if (meta.thumb) return `<div class="thumb"><img src="${meta.thumb}" alt=""></div>`;
  const [c, t] = KIND_STYLE[Store.kindOf(meta)] || KIND_STYLE.other;
  return `<div class="thumb" style="--c:${c}">${t}</div>`;
}

async function pickFiles({ kinds = ['pdf'], multiple = false, title = 'Select file' } = {}) {
  const all = (await Store.listFiles()).filter(f => kinds.includes(Store.kindOf(f))).sort((a, b) => b.modified - a.modified);
  const accept = kinds.map(k => KIND_ACCEPT[k]).join(',');
  const choice = await openDialog((box, finish) => {
    box.append(el(`<div><h3>${esc(title)}</h3>
      <button class="drop-hint" style="width:100%" data-a="dev">${ic('upload')}<div style="font-weight:700;color:var(--text);margin-top:6px">Browse device</div>
      <div class="small">Pick ${multiple ? 'one or more files' : 'a file'} from your phone</div></button>
      <div class="section-title">From ProScan library</div>
      <div class="file-list" data-list></div>
      ${multiple ? `<div class="btn-row"><button class="btn" data-a="ok" disabled>Use selected</button></div>` : ''}</div>`));
    const list = box.querySelector('[data-list]');
    const sel = new Set();
    if (!all.length) list.append(el(`<div class="muted small center" style="padding:12px">No matching files in your library yet.</div>`));
    all.forEach(f => {
      const it = el(`<div class="file-item">${thumbHtml(f)}<div class="meta"><div class="name">${esc(f.name)}</div><div class="sub">${fmtSize(f.size)} · ${fmtDate(f.modified)}</div></div></div>`);
      it.onclick = () => {
        if (!multiple) return finish({ lib: [f] });
        sel.has(f) ? sel.delete(f) : sel.add(f);
        it.classList.toggle('selected', sel.has(f));
        box.querySelector('[data-a=ok]').disabled = !sel.size;
        box.querySelector('[data-a=ok]').textContent = sel.size ? `Use selected (${sel.size})` : 'Use selected';
      };
      list.append(it);
    });
    box.querySelector('[data-a=dev]').onclick = () => finish({ device: true });
    if (multiple) box.querySelector('[data-a=ok]').onclick = () => finish({ lib: [...sel] });
  }, { sheet: true });
  if (!choice) return [];
  if (choice.device) {
    const files = await pickDeviceFiles({ accept, multiple });
    return files.map(f => ({ blob: f, name: f.name }));
  }
  const out = [];
  for (const m of choice.lib) out.push({ blob: await Store.getBlob(m.id), name: m.name, id: m.id });
  return out;
}
