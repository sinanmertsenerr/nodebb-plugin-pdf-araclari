// PDF'ten düz metin: pdf.js parçalarını satırlara çevirir. Taranmış (resim) sayfada yazı katmanı yoktur; boş döner.

// Parçalar arasına her zaman boşluk koymak "Mühendisli ğ i" gibi kırıklar yaratır: boşluk yalnızca iki parça arasında
// gerçekten mesafe varsa konur, satır değişince alt satıra geçilir.
export function joinItems(items) {
	let out = '';
	let lastEnd = null;
	let lastY = null;
	items.forEach((it) => {
		const str = it.str || '';
		const t = it.transform || [1, 0, 0, 1, 0, 0];
		const size = Math.hypot(t[0], t[1]) || it.height || 10;
		if (str) {
			if (lastEnd !== null) {
				if (Math.abs(t[5] - lastY) >= size * 0.5) {
					if (!out.endsWith('\n')) out += '\n';
				} else if (t[4] - lastEnd > size * 0.15 && !/\s$/.test(out)) {
					out += ' ';
				}
			}
			out += str;
			lastEnd = t[4] + (it.width || 0);
			lastY = t[5];
		}
		if (it.hasEOL) {
			if (!out.endsWith('\n')) out += '\n';
			lastEnd = null;
		}
	});
	return out;
}

// getTextContent() akışı "for await" ile okur; Safari'nin eski motoru bunu desteklemiyor, akışı kendimiz okuruz.
async function pageItems(page) {
	const reader = page.streamTextContent().getReader();
	const items = [];
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		items.push(...value.items);
	}
	return items;
}

// -> sayfa metinlerinin dizisi. onProgress(n, toplam) her sayfada çağrılır.
export async function textOfPages(doc, onProgress) {
	const pages = [];
	for (let n = 1; n <= doc.numPages; n += 1) {
		const page = await doc.getPage(n);
		pages.push(joinItems(await pageItems(page)).replace(/[ \t]+\n/g, '\n').trim());
		page.cleanup();
		if (onProgress) onProgress(n, doc.numPages);
	}
	return pages;
}

export const wordCount = text => (String(text).trim().match(/\S+/g) || []).length;
