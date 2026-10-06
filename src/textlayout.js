// Metinden PDF'in dizgisi: metni bloklara ayırır (isteğe bağlı kısa Markdown: # başlık, - madde, 1. madde, ---),
// satırlara kırar ve sayfalara yerleştirir. Saf: ölçü fonksiyonu dışarıdan gelir. Testleri test/textlayout.test.js'te.

// **kalın**, __kalın__, `kod` ve [ad](adres) işaretleri düz yazıya çevrilir (tek yazı tipiyle satır içi biçim yok)
const plain = s => String(s)
	.replace(/\*\*(.+?)\*\*/g, '$1')
	.replace(/__(.+?)__/g, '$1')
	.replace(/`([^`]+)`/g, '$1')
	.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');

// -> [{ kind: 'h1'|'h2'|'h3'|'p'|'li'|'hr'|'blank', text, marker, indent }]
export function parseBlocks(text, markdown) {
	return String(text || '').replace(/\r\n?/g, '\n').split('\n').map((line) => {
		if (!line.trim()) return { kind: 'blank' };
		if (!markdown) return { kind: 'p', text: line.replace(/\s+$/, '') };
		const h = /^(#{1,3})\s+(.*)$/.exec(line);
		if (h) return { kind: `h${h[1].length}`, text: plain(h[2].trim()) };
		if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return { kind: 'hr' };
		const li = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/.exec(line);
		if (li) {
			return { kind: 'li', marker: /\d/.test(li[2]) ? li[2] : '•', text: plain(li[3]), indent: Math.min(3, Math.floor(li[1].replace(/\t/g, '  ').length / 2)) };
		}
		return { kind: 'p', text: plain(line.replace(/\s+$/, '')) };
	});
}

const HEADING = { h1: 1.8, h2: 1.45, h3: 1.2 };
const LINE = 1.45; // satır yüksekliği / yazı boyutu
const INDENT = 16; // madde girintisi (pt)

// -> { pages: [[{ type: 'text', text, x, y, size, bold } | { type: 'rule', x1, x2, y }]] }  (y: taban çizgisi, sol alttan)
// measure(text, size, bold) genişlik, wrap(text, maxWidth, size, bold) satırlar döndürür.
export function layoutText(blocks, { pageW, pageH, margin, size, measure, wrap, bottomReserve = 0 }) {
	const pages = [];
	let items = [];
	let y = pageH - margin;
	const bottom = margin + bottomReserve;
	const atTop = () => items.length === 0;
	const newPage = () => { pages.push(items); items = []; y = pageH - margin; };
	const room = need => y - need >= bottom;

	// Satırları yerleştirir; ilk satırı ve onun düştüğü sayfayı döndürür (madde işareti oraya konur)
	const lines = (text, x, width, sz, bold, keepWithNext) => {
		const out = wrap(text, width, sz, bold);
		let first = null;
		out.forEach((line, i) => {
			const lh = sz * LINE;
			// Başlık sayfa sonunda yalnız kalmasın: ardından en az iki satır sığmalı
			const need = lh + (keepWithNext && i === out.length - 1 ? size * LINE * 2 : 0);
			if (!room(need) && !atTop()) newPage();
			const item = { type: 'text', text: line, x, y: y - sz, size: sz, bold };
			items.push(item);
			if (!first) first = { item, page: items };
			y -= lh;
		});
		return first;
	};

	blocks.forEach((b) => {
		const width = pageW - margin * 2;
		if (b.kind === 'blank') {
			if (!atTop()) y -= size * 0.7;
			return;
		}
		if (b.kind === 'hr') {
			if (!room(size * 1.2) && !atTop()) newPage();
			y -= size * 0.6;
			items.push({ type: 'rule', x1: margin, x2: pageW - margin, y });
			y -= size * 0.6;
			return;
		}
		if (HEADING[b.kind]) {
			const sz = Math.round(size * HEADING[b.kind] * 10) / 10;
			if (!atTop()) y -= size * 0.8;
			lines(b.text, margin, width, sz, true, true);
			y -= size * 0.25;
			return;
		}
		if (b.kind === 'li') {
			const x = margin + b.indent * INDENT;
			const markW = Math.max(measure(b.marker, size, false) + 6, INDENT);
			// İşaret, maddenin ilk satırıyla aynı sayfaya ve aynı tabana
			const first = lines(b.text || ' ', x + markW, width - b.indent * INDENT - markW, size, false, false);
			if (first) first.page.push({ type: 'text', text: b.marker, x, y: first.item.y, size, bold: false });
			return;
		}
		lines(b.text, margin, width, size, false, false);
	});
	pages.push(items);
	return { pages: pages.filter((p, i) => p.length || i === 0) };
}
