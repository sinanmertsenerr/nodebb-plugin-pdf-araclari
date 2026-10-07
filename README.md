# PDF Tools for NodeBB (nodebb-plugin-pdf-araclari)

Free PDF tools that run entirely in the browser, inside a NodeBB 4 forum at `/pdf`. Built for [Yaşar Forum](https://yu.uniforum.app), usable by any forum.

- **Files never leave the device.** PDFs are read and written in the browser (pdf.js to read and draw pages, pdf-lib to write). The plugin has no database, no upload route and no API.
- **Nineteen tools.** Basics: merge, split, reorder, compress. Convert: images to PDF, PDF to images, PDF to text, convert image, shrink image, text to PDF. Edit: edit PDF (text, drawing, highlight, white box, frame, image, signature, and filling in form fields), sign, page numbers, watermark. Security: add password (AES-256), remove password. Student: print layout (2/4/6/9 per sheet, dark slides to white), assignment cover (with logo). Scan: photos of documents to a straightened, cleaned PDF (edges found automatically, corners adjustable).
- **One familiar flow.** Pick a tool from the short list, choose a file, adjust it in a workspace (document on the left, settings on the right, main button at the bottom of the panel), download. A 1-2-3 step bar shows where you are.
- **Light.** About 160 KB of script and 32 KB of CSS; pdf-lib (≈580 KB) and the font reader load only when a tool first needs them.
- **Signed-in users only.** The app files are served at `/pdf-araclari/app/<dir>/<file>` with `401` for guests, like `nodebb-plugin-cv-yu`.
- **Turkish and English UI**, light and dark theme (the forum's `data-theme`), keyboard friendly, 44 px touch targets on touch screens.

Requires NodeBB 4.15 or later.

## Installation

    npm install nodebb-plugin-pdf-araclari

Activate the plugin in the ACP, rebuild and restart. Then add `/pdf` to the navigation (ACP → Settings → Navigation).

## Development

    npm install
    npm run build            # src/ → static/dist/
    node test/make-fixtures.mjs   # test PDFs → test/out/
    node test/dev-server.mjs      # http://127.0.0.1:8765/static/dist/harness.html#merge
    npm test
    npm run lint

The harness page opens the app outside NodeBB (`#merge`, `#edit`, `#scan`…; add `&theme=dark`, `&ui=en`, or `&demo=a.pdf` to open a test file from `test/out/`). `node test/forum-shell.mjs` builds `test/out/forum-shell.html`, a local copy of the forum page with the app inside it. Files it downloads are also written to `test/out/downloads/`, and `node test/verify-pdf.mjs <file>` prints their pages, sizes and rotations.

## License

MIT. Icons from [Lucide](https://lucide.dev) (ISC). [pdf.js](https://mozilla.github.io/pdf.js/) under Apache-2.0 and [pdf-lib](https://github.com/cantoo-scribe/pdf-lib) under MIT.
