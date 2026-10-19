# HEIC to JPG Converter

Static, client-side HEIC/HEIF to JPG converter (HTML, CSS, vanilla JS). Photos never leave the browser. Decoder: [heic-to](https://github.com/hoppergee/heic-to) 1.5.2 (LGPL-3.0); ZIP: JSZip 3.10.1. Both load lazily from CDNs.



## Limits
50 files, 50 MB per file, 300 MB per session (constants `LIMITS` in `app.js`; the page text reads them from there). Files convert one at a time to limit memory use.

## Before launch, test in a real browser
Single file, several files plus ZIP, a renamed non-HEIC file, keyboard-only use, a phone, and the console for errors. No SRI hashes are set on the CDN scripts; add them if you want stricter integrity checks.
