// HEIC -> JPG converter. All decoding happens locally; no upload code exists.
(() => {
  // Pinned versions; libraries load lazily so the initial page stays light.
  const HEIC_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
  const ZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const MAX_FILES = 50, MAX_BYTES = 100 * 1024 * 1024; // guards against browser memory exhaustion
  const $ = (s) => document.querySelector(s);
  const drop = $('#drop'), input = $('#file'), queue = $('#queue'), msg = $('#msg');
  const quality = $('#quality'), qv = $('#qv'), zipBtn = $('#zip'), clearBtn = $('#clear'), redo = $('#reconvert');
  let items = [], nextId = 0, busy = false;
  const loading = {};

  const loadScript = (src) => loading[src] || (loading[src] = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok;
    s.onerror = () => { delete loading[src]; fail(new Error('Could not load a required library. Check your connection and try again.')); };
    document.head.appendChild(s);
  }));
  const fmt = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const say = (t, err) => { msg.textContent = t; msg.className = 'msg' + (err ? ' err' : ''); };
  const isHeicName = (f) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type);

  function addFiles(fileList) {
    const problems = [];
    for (const f of fileList) {
      if (!isHeicName(f)) { problems.push(`${f.name}: not a .heic/.heif file`); continue; }
      if (f.size > MAX_BYTES) { problems.push(`${f.name}: over ${MAX_BYTES / 1048576} MB limit (memory safeguard)`); continue; }
      if (items.some((i) => i.file.name === f.name && i.file.size === f.size && i.file.lastModified === f.lastModified)) { problems.push(`${f.name}: already added`); continue; }
      if (items.length >= MAX_FILES) { problems.push(`Limit of ${MAX_FILES} files per session reached`); break; }
      items.push({ id: nextId++, file: f, status: 'queued' });
    }
    say(problems.join('. '), problems.length > 0);
    render(); run();
  }

  async function run() {
    if (busy) return;
    busy = true;
    try {
      let item;
      while ((item = items.find((i) => i.status === 'queued'))) {
        item.status = 'working'; render();
        try {
          await loadScript(HEIC_URL);
          const lib = window.HeicTo;
          if (!lib) throw new Error('Decoder unavailable in this browser.');
          const convert = typeof lib === 'function' ? lib : lib.heicTo;
          if (lib.isHeic && !(await lib.isHeic(item.file))) throw new Error('This file is not a valid HEIC/HEIF image.');
          item.blob = await convert({ blob: item.file, type: 'image/jpeg', quality: quality.value / 100 });
          item.url = URL.createObjectURL(item.blob);
          item.status = 'done';
        } catch (e) {
          item.status = 'error';
          item.error = (e && e.message) || 'Conversion failed. The file may be corrupted or use an unsupported HEIC variant.';
        }
        render();
      }
    } finally { busy = false; }
  }

  const jpgName = (f) => f.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
  function freeItem(i) { if (i.url) URL.revokeObjectURL(i.url); i.url = i.blob = null; }

  function render() {
    queue.replaceChildren(...items.map((i) => {
      const li = document.createElement('li');
      const thumb = i.url ? Object.assign(document.createElement('img'), { src: i.url, alt: 'Preview of ' + jpgName(i.file) }) : Object.assign(document.createElement('div'), { className: 'ph' });
      const info = document.createElement('div'); info.className = 'info';
      const name = document.createElement('b'); name.textContent = i.file.name;
      const st = document.createElement('span'); st.className = 'st ' + i.status;
      const label = { queued: 'Waiting…', working: 'Converting…', done: `Done · ${fmt(i.blob ? i.blob.size : 0)} JPG`, error: i.error }[i.status];
      st.textContent = `${fmt(i.file.size)} · ${label}`;
      info.append(name, st);
      li.append(thumb, info);
      if (i.status === 'done') {
        const a = Object.assign(document.createElement('a'), { href: i.url, download: jpgName(i.file), className: 'btn sm', textContent: 'Download' });
        a.setAttribute('aria-label', 'Download ' + jpgName(i.file));
        li.append(a);
      }
      const rm = Object.assign(document.createElement('button'), { type: 'button', className: 'btn ghost sm', textContent: 'Remove' });
      rm.setAttribute('aria-label', 'Remove ' + i.file.name);
      rm.onclick = () => { freeItem(i); items = items.filter((x) => x !== i); render(); };
      li.append(rm);
      return li;
    }));
    const done = items.filter((i) => i.status === 'done').length;
    zipBtn.disabled = done === 0; clearBtn.disabled = items.length === 0;
    redo.hidden = done === 0;
    if (items.length && !msg.classList.contains('err')) say(`${done} of ${items.length} converted`);
  }

  async function downloadZip() {
    zipBtn.disabled = true; say('Building ZIP…');
    try {
      await loadScript(ZIP_URL);
      const zip = new JSZip(), used = new Set();
      for (const i of items.filter((x) => x.status === 'done')) {
        let n = jpgName(i.file), k = 1;
        while (used.has(n.toLowerCase())) n = jpgName(i.file).replace(/\.jpg$/, `-${k++}.jpg`); // unique names in the archive
        used.add(n.toLowerCase()); zip.file(n, i.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); // JPGs are already compressed
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: 'heic-to-jpg.zip' }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      say('ZIP downloaded.');
    } catch (e) { say(e.message, true); }
    zipBtn.disabled = false;
  }

  input.onchange = () => { addFiles([...input.files]); input.value = ''; };
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  quality.oninput = () => { qv.textContent = quality.value; };
  redo.onclick = () => { items.forEach((i) => { if (i.status === 'done') { freeItem(i); i.status = 'queued'; } }); render(); run(); };
  clearBtn.onclick = () => { items.forEach(freeItem); items = []; say(''); render(); };
  zipBtn.onclick = downloadZip;
  window.addEventListener('pagehide', () => items.forEach(freeItem));
})();
