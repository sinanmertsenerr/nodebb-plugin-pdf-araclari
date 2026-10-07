// Ödev kapağının dizgisi: A4 sayfaya üniversite, ders, başlık, hazırlayanlar, öğretim üyesi ve tarih. İki düzen: ortalı ya da sola dayalı.
const W = 595.28;
const H = 841.89;

// fonts: loadFontSet; data: alanlar; style: { layout: 'center' | 'left', color: [r, g, b] }; L: etiket metinleri
// logo: gömülü resim { image, width, height } ya da null; en çok 76 pt yüksekliğinde, 220 pt genişliğinde en üste konur
export function drawCover(page, fonts, rgb, data, style, L, logo) {
	const accent = rgb(...style.color);
	const ink = rgb(0.1, 0.12, 0.14);
	const soft = rgb(0.35, 0.39, 0.43);
	const center = style.layout !== 'left';
	const left = center ? 90 : 84;
	const width = W - left * 2;
	const put = (text, y, size, opts = {}) => {
		if (!text) return;
		const x = center ? (W - fonts.width(text, size, opts.bold)) / 2 : left;
		fonts.draw(page, text, { x, y, size, bold: !!opts.bold, color: opts.color || ink });
	};
	// Uzun başlık küçülerek en fazla dört satıra sığar
	const titleLines = () => {
		for (const size of [28, 24, 21, 18]) {
			const lines = fonts.wrap(data.title, width, size, true);
			if (lines.length <= 4 || size === 18) return { size, lines: lines.slice(0, 5) };
		}
		return { size: 18, lines: [] };
	};

	if (!center) page.drawRectangle({ x: 0, y: 0, width: 14, height: H, color: accent });

	let y = H - 112;
	if (logo) {
		const s = Math.min(76 / logo.height, 220 / logo.width, 1);
		const lw = logo.width * s;
		const lh = logo.height * s;
		page.drawImage(logo.image, { x: center ? (W - lw) / 2 : left, y: H - 64 - lh, width: lw, height: lh });
		y = H - 64 - lh - 34;
	}
	put(data.uni, y, center ? 20 : 17, { bold: true, color: accent });
	y -= center ? 28 : 24;
	put(data.faculty, y, 12.5, { color: soft });
	if (data.faculty) y -= 19;
	put(data.dept, y, 12.5, { color: soft });

	const t = titleLines();
	const lh = t.size * 1.22;
	let ty = H * 0.6 + ((t.lines.length - 1) * lh) / 2;
	if (data.course) { put(data.course, ty + t.size + 10, 13, { color: soft }); }
	t.lines.forEach((line) => { put(line, ty, t.size, { bold: true }); ty -= lh; });
	const ruleW = center ? 72 : 96;
	const rx = center ? (W - ruleW) / 2 : left;
	page.drawRectangle({ x: rx, y: ty + lh - t.size - 18, width: ruleW, height: 2.5, color: accent });

	const people = String(data.students || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
	let py = H * 0.32 + (people.length > 3 ? (people.length - 3) * 9 : 0);
	if (people.length) {
		put(people.length > 1 ? L.byMany : L.by, py, 10.5, { color: soft });
		py -= 19;
		people.forEach((p) => { put(p, py, 13); py -= 18; });
		py -= 14;
	}
	if (data.instructor) {
		put(L.inst, py, 10.5, { color: soft });
		put(data.instructor, py - 19, 13);
	}
	put(data.date, 72, 12, { color: soft });
}

// "2026-10-07" -> "7 Ekim 2026" (arayüz diline göre)
export function formatDate(iso, lang) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
	if (!m) return '';
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}
