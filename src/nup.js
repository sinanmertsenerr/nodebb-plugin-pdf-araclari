// Çıktıya hazırla dizgisi: bir kâğıda n sayfa. Saf: testleri test/nup.test.js'te.
export const SHEETS = { port: { w: 595.28, h: 841.89 }, land: { w: 841.89, h: 595.28 } };

// Kâğıda n sayfa: sayfa oranına göre en büyük ölçeği veren sütun × satır ve hücreler (pt, sol alttan; okuma sırası soldan sağa, yukarıdan aşağı)
export function nupLayout(n, sheet, page, margin = 24, gap = 12) {
	let best = null;
	for (let cols = 1; cols <= n; cols += 1) {
		if (n % cols === 0) {
			const rows = n / cols;
			const cw = (sheet.w - margin * 2 - gap * (cols - 1)) / cols;
			const ch = (sheet.h - margin * 2 - gap * (rows - 1)) / rows;
			const scale = Math.min(cw / page.w, ch / page.h);
			if (!best || scale > best.scale + 1e-9) best = { cols, rows, cw, ch, scale };
		}
	}
	const cells = [];
	for (let r = 0; r < best.rows; r += 1) {
		for (let c = 0; c < best.cols; c += 1) {
			cells.push({ x: margin + c * (best.cw + gap), y: sheet.h - margin - (r + 1) * best.ch - r * gap, w: best.cw, h: best.ch });
		}
	}
	return { ...best, cells };
}

// Kâğıt yönü: otomatikse sayfaların daha büyük çıktığı yön
export function pickSheet(n, page, orient) {
	if (orient === 'port' || orient === 'land') return SHEETS[orient];
	return nupLayout(n, SHEETS.land, page).scale > nupLayout(n, SHEETS.port, page).scale ? SHEETS.land : SHEETS.port;
}

// Sayfayı hücreye ortalayarak sığdırır
export function fitInto(cell, page) {
	const s = Math.min(cell.w / page.w, cell.h / page.h);
	const w = page.w * s;
	const h = page.h * s;
	return { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h, s };
}

// Koyu zemini açmak için parlaklığı ters çevirir, renk farkını korur (kırmızı yine kırmızımsı kalır). data: RGBA dizisi
export function invertLightness(data) {
	for (let i = 0; i < data.length; i += 4) {
		const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
		const shift = 255 - 2 * y;
		data[i] = Math.max(0, Math.min(255, data[i] + shift));
		data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + shift));
		data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + shift));
	}
	return data;
}

export function toGray(data) {
	for (let i = 0; i < data.length; i += 4) {
		const y = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
		data[i] = y;
		data[i + 1] = y;
		data[i + 2] = y;
	}
	return data;
}

// Ortalama parlaklık (0-255): seyreltilmiş örnek yeter
export function meanLightness(data, step = 16) {
	let sum = 0;
	let count = 0;
	for (let i = 0; i < data.length; i += 4 * step) {
		sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
		count += 1;
	}
	return count ? sum / count : 255;
}
