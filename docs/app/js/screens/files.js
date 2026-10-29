/* File manager: All / Folders / Favorites, sorting, folder contents */
Screens.files = {
  title: 'My Files',
  nav: 'files',
  actions: [{ icon: 'upload', label: 'Import', run: () => App.importFiles() }, { icon: 'folderPlus', label: 'New folder', run: () => App.newFolder() }],
  render(view, params, query) {
    const folderId = query.folder || null;
    let tab = query.tab || (folderId ? 'folder' : 'all');
    let sort = localStorage.getItem('ps_sort') || 'date';
    view.append(el(`<div>
      <div class="tabs ${folderId ? 'hidden' : ''}"><button data-t="all">All</button><button data-t="folders">Folders</button><button data-t="fav">Favorites</button></div>
      <div class="row" style="margin-bottom:10px"><div class="grow muted small" data-count></div>
        <button class="chip" data-a="sort">${ic('sort')} <span data-sortl></span></button></div>
      <div class="file-list" data-list></div></div>`));
    const list = view.querySelector('[data-list]');
    view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const SORTS = { date: 'Date modified', name: 'Name', size: 'Size' };
    view.querySelector('[data-a=sort]').onclick = async () => {
      const v = await actionSheet('Sort by', Object.entries(SORTS).map(([value, label]) => ({ value, label, icon: value === sort ? 'check' : 'sort' })));
      if (v) { sort = v; localStorage.setItem('ps_sort', v); draw(); }
    };
    if (folderId) Store.listFolders().then(fs => { const f = fs.find(x => x.id === folderId); if (f) App.setTitle(f.name); });

    function sorted(files) {
      const s = files.slice();
      if (sort === 'name') s.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      else if (sort === 'size') s.sort((a, b) => b.size - a.size);
      else s.sort((a, b) => b.modified - a.modified);
      return s;
    }
    async function draw() {
      view.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === tab));
      view.querySelector('[data-sortl]').textContent = SORTS[sort];
      const files = await Store.listFiles();
      list.innerHTML = '';
      let shown = [];
      if (tab === 'folders') {
        const folders = (await Store.listFolders()).sort((a, b) => a.name.localeCompare(b.name));
        view.querySelector('[data-count]').textContent = `${folders.length} folder${folders.length === 1 ? '' : 's'}`;
        const add = el(`<div class="file-item folder-item"><div class="thumb" style="background:var(--primary-soft);color:var(--primary)">${ic('plus')}</div><div class="meta"><div class="name">New folder</div></div></div>`);
        add.onclick = () => App.newFolder();
        list.append(add);
        folders.forEach(f => {
          const n = files.filter(x => x.folderId === f.id).length;
          const row = el(`<div class="file-item folder-item"><div class="thumb">${ic('folder')}</div><div class="meta"><div class="name">${esc(f.name)}</div><div class="sub">${n} file${n === 1 ? '' : 's'}</div></div><button class="icon-btn" data-m>${ic('more')}</button></div>`);
          row.onclick = e => { if (!e.target.closest('[data-m]')) App.go(`files?folder=${f.id}`); };
          row.querySelector('[data-m]').onclick = () => folderMenu(f);
          list.append(row);
        });
        return;
      }
      if (tab === 'fav') shown = files.filter(f => f.favorite);
      else if (tab === 'folder') shown = files.filter(f => f.folderId === folderId);
      else shown = files;
      shown = sorted(shown);
      view.querySelector('[data-count]').textContent = `${shown.length} file${shown.length === 1 ? '' : 's'}`;
      if (!shown.length) list.append(el(`<div class="empty">${ic(tab === 'fav' ? 'star' : 'folder')}<div>${tab === 'fav' ? 'No favorites yet. Use ★ in a file menu.' : 'No files here yet.'}</div></div>`));
      shown.forEach(f => list.append(App.fileRow(f)));
    }
    async function folderMenu(f) {
      const v = await actionSheet(f.name, [
        { value: 'open', label: 'Open', icon: 'folder' }, { value: 'rename', label: 'Rename', icon: 'edit' },
        { value: 'del', label: 'Delete folder (keep files)', icon: 'trash', danger: true },
        { value: 'delall', label: 'Delete folder and its files', icon: 'trash', danger: true },
      ]);
      if (v === 'open') App.go(`files?folder=${f.id}`);
      if (v === 'rename') { const n = await promptText('Rename folder', f.name); if (n && n.trim()) await Store.renameFolder(f.id, n.trim()); }
      if (v === 'del' && await confirmDialog('Delete folder?', 'Files inside will move to the main library.', { okText: 'Delete', danger: true })) await Store.deleteFolder(f.id, false);
      if (v === 'delall' && await confirmDialog('Delete folder and files?', 'This permanently deletes the folder and every file in it.', { okText: 'Delete', danger: true })) await Store.deleteFolder(f.id, true);
    }
    draw();
    return Store.onChange(draw);
  },
};
