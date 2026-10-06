// src/ altındaki uygulamayı static/dist/ altına derler: JS (esbuild, Preact), pdf-lib (ayrı dosya), CSS (sass) ve pdf.js.
// Dosya adlarına içerik özeti eklenir; library.js bunları static/dist/manifest.json'dan okur.
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as esbuild from 'esbuild';
import * as sass from 'sass';
import subsetFont from 'subset-font';

const watch = process.argv.includes('--watch');
const dist = 'static/dist';
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);

// PDF'i okumak ve küçük resim çizmek için pdf.js (Apache-2.0). Yalnızca kişi PDF seçtiğinde, kendi tarayıcısında açılır;
// klasör adı sürümü taşır, sürüm değişince 60 günlük önbellek sorun olmaz. .js uzantısı: her sunucu doğru türle sunar.
const pdfjsVersion = JSON.parse(await readFile('node_modules/pdfjs-dist/package.json', 'utf8')).version;
const pdfDir = `pdf-${pdfjsVersion}`;

async function copyPdfjs() {
	for (const f of await readdir('static')) {
		if (/^pdf-[\d.]+$/.test(f) && f !== pdfDir) await rm(path.join('static', f), { recursive: true });
	}
	const out = path.join('static', pdfDir);
	await mkdir(out, { recursive: true });
	const src = 'node_modules/pdfjs-dist/legacy/build';
	await copyFile(path.join(src, 'pdf.min.mjs'), path.join(out, 'pdf.min.js'));
	await copyFile(path.join(src, 'pdf.worker.min.mjs'), path.join(out, 'pdf.worker.min.js'));
	await copyFile('node_modules/pdfjs-dist/LICENSE', path.join(out, 'LICENSE.txt'));
}

// Belgeye gömülen yazı tipi (OFL): Inter, normal ve kalın, Latin + Latin-Ext (Türkçe ğ ı İ ş ve ₺ dahil).
// Değişken yazı tipi her ağırlık için tek örneğe sabitlenir; PDF'e yalnızca kullanılan harfler gömülür.
// Yazı tipi dosyaları yalnızca metin yazan bir araç ilk kullanıldığında inidiği için sayfa açılışını ağırlaştırmaz.
const FONT_RANGES = {
	latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
	ext: 'U+0100-017F, U+018F, U+0192, U+0218-021B, U+0259, U+20A0-20C0',
};
const rangeText = (ranges) => {
	let out = '';
	ranges.split(',').map(r => r.trim().replace(/^U\+/i, '')).forEach((r) => {
		const [a, b] = r.split('-').map(x => parseInt(x, 16));
		for (let c = a; c <= (b || a); c += 1) out += String.fromCodePoint(c);
	});
	return out;
};

async function buildFonts() {
	const out = 'static/fonts';
	await mkdir(out, { recursive: true });
	const sources = { latin: 'inter-latin-wght-normal.woff2', ext: 'inter-latin-ext-wght-normal.woff2' };
	for (const [subset, file] of Object.entries(sources)) {
		const source = await readFile(path.join('node_modules/@fontsource-variable/inter/files', file));
		for (const weight of [400, 700]) {
			const ttf = await subsetFont(source, rangeText(FONT_RANGES[subset]), { targetFormat: 'truetype', variationAxes: { wght: weight } });
			await writeFile(path.join(out, `inter-${subset}-${weight}.ttf`), ttf);
		}
	}
	await copyFile('node_modules/@fontsource-variable/inter/LICENSE', path.join(out, 'LICENSE-inter.txt'));
}

async function bundle(entry, define = {}) {
	const res = await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		minify: true,
		sourcemap: false,
		format: 'iife',
		target: ['es2020'],
		jsx: 'automatic',
		jsxImportSource: 'preact',
		write: false,
		legalComments: 'none',
		define: { 'process.env.NODE_ENV': '"production"', ...define },
	});
	return res.outputFiles[0].text;
}

async function buildOnce() {
	await mkdir(dist, { recursive: true });
	for (const f of await readdir(dist)) {
		if (/^(pdf|pdflib|pdffont)\.[0-9a-f]{10}\.(js|css)$/.test(f)) await rm(path.join(dist, f));
	}

	const libText = await bundle('src/pdflib-entry.js');
	const libName = `pdflib.${hash(libText)}.js`;
	const kitText = await bundle('src/pdffont-entry.js');
	const kitName = `pdffont.${hash(kitText)}.js`;
	const jsText = await bundle('src/main.jsx', { PDFJS_DIR: JSON.stringify(pdfDir), PDFLIB_FILE: JSON.stringify(libName), PDFFONT_FILE: JSON.stringify(kitName) });
	const css = sass.compile('src/styles/app.scss', { style: 'compressed', loadPaths: ['node_modules'] }).css;

	const jsName = `pdf.${hash(jsText)}.js`;
	const cssName = `pdf.${hash(css)}.css`;
	await writeFile(path.join(dist, libName), libText);
	await writeFile(path.join(dist, kitName), kitText);
	await writeFile(path.join(dist, jsName), jsText);
	await writeFile(path.join(dist, cssName), css);
	await writeFile(path.join(dist, 'manifest.json'), `${JSON.stringify({ js: jsName, css: cssName, lib: libName, fontkit: kitName }, null, '\t')}\n`);

	// NodeBB dışında açılan test sayfası (Search tarayıcısı ve testler bunu kullanır)
	const harness = (await readFile('test/harness.template.html', 'utf8')).replace('{{css}}', cssName).replace('{{js}}', jsName);
	await writeFile(path.join(dist, 'harness.html'), harness);
	console.log(`${jsName} ${(jsText.length / 1024).toFixed(0)} KB, ${libName} ${(libText.length / 1024).toFixed(0)} KB, ${kitName} ${(kitText.length / 1024).toFixed(0)} KB, ${cssName} ${(css.length / 1024).toFixed(0)} KB`);
}

await copyPdfjs();
await buildFonts();
await buildOnce();

if (watch) {
	const { watch: fsWatch } = await import('node:fs');
	let timer = null;
	fsWatch('src', { recursive: true }, () => {
		clearTimeout(timer);
		timer = setTimeout(() => buildOnce().catch(err => console.error(err.message)), 150);
	});
	console.log('watching src/');
}
