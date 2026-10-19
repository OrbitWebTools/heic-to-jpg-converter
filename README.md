# HEIC to JPG Converter

Static, client-side HEIC/HEIF to JPG converter (HTML, CSS, vanilla JS). Photos never leave the browser. Decoder: [heic-to](https://github.com/hoppergee/heic-to) 1.5.2 (LGPL-3.0); ZIP: JSZip 3.10.1. Both load lazily from CDNs.

## Deploy on GitHub Pages
1. Copy these files to the repository root and push to `main`.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", Branch `main`, folder `/ (root)`.
3. Open `https://orbitwebtools.github.io/heic-to-jpg-converter/`.
4. If you use a custom domain, replace that URL in `index.html` (canonical, og:url), `robots.txt` and `sitemap.xml`.

## Optional: self-host libraries
Download `heic-to.js` and `jszip.min.js`, put them in `/vendor`, and update `HEIC_URL`/`ZIP_URL` in `app.js` to `./vendor/...`. This removes all third-party requests.

## Limits
50 files, 50 MB per file, 300 MB per session (constants `LIMITS` in `app.js`; the page text reads them from there). Files convert one at a time to limit memory use.

## Before launch, test in a real browser
Single file, several files plus ZIP, a renamed non-HEIC file, keyboard-only use, a phone, and the console for errors. No SRI hashes are set on the CDN scripts; add them if you want stricter integrity checks.
