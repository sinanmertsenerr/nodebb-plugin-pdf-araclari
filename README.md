# PDF Tools for NodeBB (nodebb-plugin-pdf-araclari)

Free PDF tools that run entirely in the browser, inside a NodeBB 4 forum at `/pdf`. Built for [Yaşar Forum](https://yu.uniforum.app), usable by any forum.

- **Files never leave the device.** PDFs are read and written in the browser (pdf.js to read and draw pages, pdf-lib to write). The plugin has no database, no upload route and no API.
- **Tools in this version:** Merge, Split (pick pages from thumbnails or type a range; one PDF or one file per page as ZIP), Reorder (drag or arrows, rotate, delete) and Compress (keep text, or rebuild pages as JPEG at two strengths; if the result is not smaller the original is returned). Password-protected PDFs ask for the password; the output is not password-protected. Other tools in the menu are marked "Soon".
- **Light.** About 46 KB of script and 11 KB of CSS; pdf-lib (≈580 KB) loads only when a tool is first used.
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

The harness page opens the app outside NodeBB (`#merge`, `#split`, `#organize`, `#compress`; add `&theme=dark` or `&ui=en`). Files it downloads are also written to `test/out/downloads/`, and `node test/verify-pdf.mjs <file>` prints their pages, sizes and rotations.

## License

MIT. Icons from [Lucide](https://lucide.dev) (ISC). [pdf.js](https://mozilla.github.io/pdf.js/) under Apache-2.0 and [pdf-lib](https://github.com/cantoo-scribe/pdf-lib) under MIT.
