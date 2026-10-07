// Belgeye metin yazmak için yazı yöneticisi: Inter (normal, kalın), Latin + Latin-Ext. Türkçe harfler (ğ ı İ ş ₺) dahil.
// pdf-lib'in hazır yazı tipleri Türkçe harfleri bilmez; bu yüzden gerçek yazı tipi gömülür (yalnızca kullanılan harfler).
import { assetUrl, getFontkit, getLib } from './pdf.js';

const FILES = {
	regular: ['inter-latin-400.ttf', 'inter-ext-400.ttf'],
	bold: ['inter-latin-700.ttf', 'inter-ext-700.ttf'],
};

const cache = new Map();
function fontBytes(name) {
	if (!cache.has(name)) {
		cache.set(name, fetch(assetUrl(`../fonts/${name}`)).then((res) => {
			if (!res.ok) throw new Error(`yazı tipi inmedi: ${name}`);
			return res.arrayBuffer();
		}).then(buf => new Uint8Array(buf)).catch((err) => { cache.delete(name); throw err; }));
	}
	return cache.get(name);
}

// Metni, harfi taşıyan yazı tipine göre parçalara böler. Hiçbirinde olmayan harf "?" olur; denetim karakterleri atılır.
export function splitRuns(text, sets) {
	const runs = [];
	let cur = null;
	for (const raw of String(text).replace(/\t/g, '    ').replace(/\r\n?/g, '\n')) {
		if (raw === '\n') continue;
		let ch = raw;
		let cp = ch.codePointAt(0);
		if (cp < 0x20 || (cp >= 0x7F && cp < 0xA0)) continue;
		let idx = sets.findIndex(set => set.has(cp));
		if (idx < 0) {
			ch = '?';
			cp = 63;
			idx = sets.findIndex(set => set.has(cp));
			if (idx < 0) continue;
		}
		if (cur && cur.font === idx) cur.text += ch;
		else { cur = { font: idx, text: ch }; runs.push(cur); }
	}
	return runs;
}

// Metni verilen genişliğe sığacak satırlara böler (kelime kelime; sığmayan uzun kelime harf harf kırılır). \n satır sonudur.
export function wrapLines(text, maxWidth, measure) {
	const out = [];
	String(text).replace(/\r\n?/g, '\n').split('\n').forEach((para) => {
		if (!para.trim()) { out.push(''); return; }
		let line = '';
		para.split(/(\s+)/).forEach((token) => {
			if (!token) return;
			const test = line + token;
			if (measure(test) <= maxWidth || !line.trim()) {
				if (measure(token) > maxWidth && !/^\s+$/.test(token)) {
					// Tek başına sığmayan uzun kelime: harf harf kır
					let piece = line;
					for (const ch of token) {
						if (measure(piece + ch) > maxWidth && piece.trim()) { out.push(piece.trimEnd()); piece = ''; }
						piece += ch;
					}
					line = piece;
				} else {
					line = test;
				}
			} else {
				out.push(line.trimEnd());
				line = /^\s+$/.test(token) ? '' : token;
			}
		});
		out.push(line.trimEnd());
	});
	return out;
}

// doc'a yazı tiplerini gömer ve metin ölçen/çizen bir takım döndürür
export async function loadFontSet(doc) {
	const [{ degrees }, kit] = await Promise.all([getLib(), getFontkit()]);
	doc.registerFontkit(kit);
	const weights = {};
	for (const [weight, names] of Object.entries(FILES)) {
		const fonts = [];
		for (const name of names) fonts.push(await doc.embedFont(await fontBytes(name), { subset: true }));
		weights[weight] = { fonts, sets: fonts.map(f => new Set(f.getCharacterSet())) };
	}
	const pick = bold => weights[bold ? 'bold' : 'regular'];

	const set = {
		// Tek satırın genişliği (pt)
		width(text, size, bold) {
			const w = pick(bold);
			return splitRuns(text, w.sets).reduce((sum, run) => sum + w.fonts[run.font].widthOfTextAtSize(run.text, size), 0);
		},
		// Tek satır çizer. (x, y) satırın sol alt köşesi (taban çizgisi); rotate derece, saat yönünün tersine.
		draw(page, text, { x, y, size, color, bold, opacity, rotate = 0 }) {
			const w = pick(bold);
			const rad = (rotate * Math.PI) / 180;
			let offset = 0;
			splitRuns(text, w.sets).forEach((run) => {
				const font = w.fonts[run.font];
				page.drawText(run.text, {
					x: x + offset * Math.cos(rad),
					y: y + offset * Math.sin(rad),
					size,
					font,
					color,
					opacity,
					rotate: degrees(rotate),
				});
				offset += font.widthOfTextAtSize(run.text, size);
			});
		},
		wrap: (text, maxWidth, size, bold) => wrapLines(text, maxWidth, line => set.width(line, size, bold)),
		// Metnin bütün harflerini tek başına taşıyan yazı tipi (form alanının görünümü tek yazı tipiyle çizilir); yoksa null
		covering(text, bold) {
			const w = pick(bold);
			const i = w.sets.findIndex(s => [...String(text)].every(ch => ch === '\n' || s.has(ch.codePointAt(0))));
			return i >= 0 ? w.fonts[i] : null;
		},
	};
	return set;
}
