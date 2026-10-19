# HEIC to JPG Converter

Static, client-side HEIC/HEIF to JPG converter (HTML, CSS, vanilla JS). Photos never leave the browser. Decoder: [heic-to](https://github.com/hoppergee/heic-to) 1.5.2 (LGPL-3.0); ZIP: JSZip 3.10.1. Both load lazily from CDNs.

## Deploy on GitHub Pages
1. Copy these files to the repository root and push to `main`.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", Branch `main`, folder `/ (root)`.
3. Open `https://orbitwebtools.github.io/heic-to-jpg-converter/`.
4. If you use a custom domain, replace that URL in `index.html` (canonical, og:url), `robots.txt` and `sitemap.xml`.

## Optional: self-host libraries
Download `heic-to.js` and `jszip.min.js`, put them in `/vendor`, and update `HEIC_URL`/`ZIP_URL` in `app.js` to `./vendor/...`. This removes all third-party requests.

## Notes
Not tested in a browser by the author of this scaffold; run the checklist below before launch: single file, multiple files + ZIP, a renamed non-HEIC file, keyboard-only use, mobile layout, console errors.
