/* Bridge to Android (custom Capacitor plugin "ProScanNative") with browser fallbacks */
const Native = (() => {
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const plugin = () => cap && cap.Plugins && cap.Plugins.ProScanNative;

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function browserDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function saveToDevice(blob, name) {
    if (isNative && plugin()) {
      const r = await plugin().saveFile({ data: await blobToBase64(blob), name, mime: blob.type || Store.mimeFor(name) });
      toast(`Saved to ${r.location || 'Downloads/ProScan'}`);
      return;
    }
    browserDownload(blob, name);
    toast('Download started');
  }
  async function share(blob, name) {
    if (isNative && plugin()) {
      await plugin().shareFile({ data: await blobToBase64(blob), name, mime: blob.type || Store.mimeFor(name) });
      return;
    }
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      browserDownload(blob, name);
      toast('Sharing not supported here — file downloaded instead');
    }
  }
  async function shareText(text) {
    if (isNative && plugin()) return plugin().shareText({ text });
    if (navigator.share) { try { await navigator.share({ text }); } catch {} return; }
    copyText(text);
  }
  async function print(blob, name) {
    let pdf = blob;
    if (!/pdf/.test(blob.type)) {
      if (/^image\//.test(blob.type)) pdf = await Convert.imagesToPdf([blob], { pageSize: 'A4', margin: 20 });
      else throw new Error('Only PDF and image files can be printed. Convert this file to PDF first.');
    }
    if (isNative && plugin()) {
      await plugin().printPdf({ data: await blobToBase64(pdf), name: baseName(name) });
      return;
    }
    const url = URL.createObjectURL(pdf);
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.src = url;
    document.body.appendChild(frame);
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { window.open(url, '_blank'); }
      setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
    };
  }
  async function openUrl(url) {
    if (isNative && plugin()) return plugin().openUrl({ url });
    window.open(url, '_blank', 'noopener');
  }
  return { isNative, saveToDevice, share, shareText, print, openUrl, blobToBase64 };
})();
