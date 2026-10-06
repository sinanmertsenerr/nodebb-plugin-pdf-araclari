// Küçük, saf yardımcılar: sayfa aralığı, dosya adı, boyut. Testleri test/util.test.js'te.

// "1-3, 5, 8-10" -> [1,2,3,5,8,9,10]. Geçersizse null. Sayfa sayısını aşan ya da 0 olan sayı geçersizdir.
export function parseRanges(text, max) {
	const source = String(text || '').trim();
	if (!source) return [];
	const out = new Set();
	for (const part of source.split(/[,;\s]+/).filter(Boolean)) {
		const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
		if (!m) return null;
		const a = parseInt(m[1], 10);
		const b = m[2] === undefined ? a : parseInt(m[2], 10);
		if (a < 1 || b < 1 || a > max || b > max) return null;
		const [from, to] = a <= b ? [a, b] : [b, a];
		for (let n = from; n <= to; n += 1) out.add(n);
	}
	return [...out].sort((x, y) => x - y);
}

// [1,2,3,5,8,9,10] -> "1-3, 5, 8-10"
export function formatRanges(pages) {
	const list = [...new Set(pages)].sort((x, y) => x - y);
	const parts = [];
	for (let i = 0; i < list.length;) {
		let j = i;
		while (j + 1 < list.length && list[j + 1] === list[j] + 1) j += 1;
		parts.push(j - i >= 1 ? `${list[i]}-${list[j]}` : `${list[i]}`);
		i = j + 1;
	}
	return parts.join(', ');
}

// Bayt -> "1,2 MB" (Türkçe ondalık virgülü)
export function fmtSize(bytes) {
	const n = Number(bytes) || 0;
	const fmt = (v, d) => v.toFixed(d).replace('.', ',').replace(/,0+$/, '');
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${fmt(n / 1024, n < 10 * 1024 ? 1 : 0)} KB`;
	return `${fmt(n / 1024 / 1024, n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// "Ödev Final (1).pdf" -> "Ödev Final (1)"
export function baseName(name) {
	return String(name || 'dosya').replace(/\.[^./\\]+$/, '').trim() || 'dosya';
}

// Dosya adı olarak güvenli: yol ayracı ve denetim karakterleri gider, Türkçe harfler kalır
export function safeName(name) {
	return String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'dosya';
}

// Aynı ada sahip dosyalar ZIP'te üst üste yazılmasın: "a.pdf", "a (2).pdf"
export function uniqueNames(names) {
	const seen = new Map();
	return names.map((name) => {
		const count = (seen.get(name) || 0) + 1;
		seen.set(name, count);
		if (count === 1) return name;
		const dot = name.lastIndexOf('.');
		return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
	});
}
