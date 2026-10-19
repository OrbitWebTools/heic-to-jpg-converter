// HEIC -> JPG converter. All decoding happens locally in the browser; there is no upload code.
(() => {
  // Pinned library versions, loaded lazily so the initial page stays light.
  const HEIC_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
  const ZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  // Single source of truth: the same numbers fill every [data-limit] element in the page.
  const LIMITS = { files: 50, fileMB: 50, totalMB: 300 };
  const MB = 1048576;
  const $ = (s) => document.querySelector(s);
  document.querySelectorAll('[data-limit]').forEach((el) => { el.textContent = LIMITS[el.dataset.limit]; });
  const drop = $('#drop'), input = $('#file'), queue = $('#queue'), msg = $('#msg');
  const quality = $('#quality'), qv = $('#qv'), zipBtn = $('#zip'), clearBtn = $('#clear'), redo = $('#reconvert');
  let items = [], nextId = 0, busy = false, notice = null;
  const loading = {};

  const loadScript = (src) => loading[src] || (loading[src] = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok;
    s.onerror = () => { delete loading[src]; fail(new Error('Could not load the conversion library. Check your connection (or ad/content blockers) and try again.')); };
    document.head.appendChild(s);
  }));
  const fmt = (b) => b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const isHeicName = (f) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type);
  const jpgName = (f) => f.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
  const el = (tag, props) => Object.assign(document.createElement(tag), props);

  // Browsers without WebAssembly or Workers cannot run the decoder.
  if (!window.WebAssembly || !window.Worker) {
    notice = { text: 'This browser cannot run the converter (WebAssembly/Web Workers missing). Please use a current version of Chrome, Edge, Firefox or Safari.', err: true };
    input.disabled = true; drop.setAttribute('aria-disabled', 'true');
  }

  function freeItem(i) { if (i.url) URL.revokeObjectURL(i.url); i.url = i.blob = null; }

  function addFiles(fileList) {
    if (input.disabled) return;
    const problems = [];
    let total = items.reduce((n, i) => n + i.file.size, 0);
    for (const f of fileList) {
      if (!isHeicName(f)) problems.push(`${f.name}: not a .heic/.heif file`);
      else if (f.size > LIMITS.fileMB * MB) problems.push(`${f.name}: larger than ${LIMITS.fileMB} MB`);
      else if (items.some((i) => i.file.name === f.name && i.file.size === f.size && i.file.lastModified === f.lastModified)) problems.push(`${f.name}: already added`);
      else if (items.length >= LIMITS.files) { problems.push(`Limit of ${LIMITS.files} files reached`); break; }
      else if (total + f.size > LIMITS.totalMB * MB) problems.push(`${f.name}: would exceed the ${LIMITS.totalMB} MB session limit`);
      else { total += f.size; const it = { id: nextId++, file: f, status: 'queued' }; items.push(it); makeRow(it); }
    }
    notice = problems.length ? { text: 'Skipped: ' + problems.join('; '), err: true } : null;
    refresh(); run();
  }

  async function run() {
    if (busy) return; // prevents two loops processing the queue at once
    busy = true;
    try {
      let item;
      while ((item = items.find((i) => i.status === 'queued'))) {
        item.status = 'working'; refresh(item);
        try {
          await loadScript(HEIC_URL);
          const lib = window.HeicTo;
          const convert = typeof lib === 'function' ? lib : lib && lib.heicTo;
          if (!convert) throw new Error('The decoder did not initialise in this browser.');
          const out = await convert({ blob: item.file, type: 'image/jpeg', quality: quality.value / 100 });
          if (item.removed) continue; // removed while converting: do not create an orphan URL
          item.blob = out.type === 'image/jpeg' ? out : new Blob([out], { type: 'image/jpeg' });
          item.url = URL.createObjectURL(item.blob);
          item.status = 'done';
        } catch (e) {
          item.status = 'error';
          item.error = (e && e.message) || 'Conversion failed.';
          if (!/library|decoder/.test(item.error)) item.error += ' The file may be corrupted, already a JPG/PNG, or an unsupported HEIC variant.';
        }
        refresh(item);
      }
    } finally { busy = false; }
  }

  // Rows are created once and updated in place, so keyboard focus is never lost during conversion.
  function makeRow(item) {
    const li = el('li'), img = el('img', { hidden: true, alt: '' }), ph = el('div', { className: 'ph' });
    const info = el('div', { className: 'info' }), name = el('b', { textContent: item.file.name }), st = el('span');
    const dl = el('a', { className: 'btn sm', textContent: 'Download', hidden: true });
    const rm = el('button', { type: 'button', className: 'btn ghost sm', textContent: 'Remove' });
    rm.setAttribute('aria-label', 'Remove ' + item.file.name);
    rm.onclick = () => {
      item.removed = true; freeItem(item); items = items.filter((x) => x !== item); li.remove();
      notice = null; refresh();
    };
    info.append(name, st); li.append(img, ph, info, dl, rm); queue.append(li);
    item.ui = { img, ph, st, dl };
  }

  function refresh(item) {
    if (item) {
      const { img, ph, st, dl } = item.ui;
      const label = { queued: 'Waiting…', working: 'Converting…', done: `Done · JPG ${fmt(item.blob ? item.blob.size : 0)}`, error: item.error }[item.status];
      st.className = 'st ' + item.status; st.textContent = `${fmt(item.file.size)} · ${label}`;
      const done = item.status === 'done';
      img.hidden = ph.hidden = false; img.hidden = !done; ph.hidden = done;
      if (done) {
        img.src = item.url; img.alt = 'Preview of ' + jpgName(item.file);
        dl.href = item.url; dl.download = jpgName(item.file); dl.setAttribute('aria-label', 'Download ' + jpgName(item.file));
      } else img.removeAttribute('src');
      dl.hidden = !done;
    }
    const done = items.filter((i) => i.status === 'done').length;
    zipBtn.disabled = done === 0 || busyZip; clearBtn.disabled = items.length === 0; redo.hidden = done === 0;
    const text = notice ? notice.text : items.length ? `${done} of ${items.length} converted` : '';
    msg.textContent = text; msg.className = 'msg' + (notice && notice.err ? ' err' : '');
  }

  let busyZip = false;
  async function downloadZip() {
    if (busyZip) return;
    busyZip = true; notice = { text: 'Building ZIP…' }; refresh();
    try {
      await loadScript(ZIP_URL);
      const zip = new JSZip(), used = new Set();
      for (const i of items.filter((x) => x.status === 'done')) {
        let n = jpgName(i.file), k = 1;
        while (used.has(n.toLowerCase())) n = jpgName(i.file).replace(/\.jpg$/, `-${k++}.jpg`); // unique names inside the archive
        used.add(n.toLowerCase()); zip.file(n, i.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); // JPGs are already compressed
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'heic-to-jpg.zip' });
      document.body.append(a); a.click(); a.remove(); // anchor must be in the DOM for older Firefox
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notice = { text: 'ZIP downloaded.' };
    } catch (e) { notice = { text: 'ZIP failed: ' + e.message, err: true }; }
    busyZip = false; refresh();
  }

  input.onchange = () => { addFiles([...input.files]); input.value = ''; };
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  quality.oninput = () => { qv.textContent = quality.value; };
  redo.onclick = () => { items.forEach((i) => { if (i.status === 'done') { freeItem(i); i.status = 'queued'; refresh(i); } }); run(); };
  clearBtn.onclick = () => { items.forEach((i) => { i.removed = true; freeItem(i); }); items = []; queue.replaceChildren(); notice = null; refresh(); };
  zipBtn.onclick = downloadZip;
  refresh();
})();
