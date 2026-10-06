'use strict';

// textlayout.js: kısa Markdown ayrıştırma ve sayfalara yerleştirme (ölçü: her harf yarım em)
const test = require('node:test');
const assert = require('node:assert/strict');

let parseBlocks; let layoutText; let wrapLines;
test.before(async () => {
	({ parseBlocks, layoutText } = await import('../src/textlayout.js'));
	({ wrapLines } = await import('../src/fonts.js'));
});

const measure = (text, size) => [...String(text)].length * size * 0.5;
const wrap = (text, width, size) => wrapLines(text, width, line => measure(line, size));
const opts = { pageW: 300, pageH: 200, margin: 20, size: 10, measure, wrap };

test('parseBlocks: başlık, madde, numaralı madde, çizgi, boş satır, satır içi işaretler', () => {
	const b = parseBlocks('# Başlık\n- **kalın** madde\n  2. alt madde\n---\n\n[site](https://x.y) ve `kod`', true);
	assert.deepEqual(b.map(x => x.kind), ['h1', 'li', 'li', 'hr', 'blank', 'p']);
	assert.equal(b[1].text, 'kalın madde');
	assert.equal(b[1].marker, '•');
	assert.deepEqual([b[2].marker, b[2].indent], ['2.', 1]);
	assert.equal(b[5].text, 'site (https://x.y) ve kod');
});

test('parseBlocks: Markdown kapalıyken her satır olduğu gibi kalır', () => {
	const b = parseBlocks('# değil\n- bu da', false);
	assert.deepEqual(b.map(x => [x.kind, x.text]), [['p', '# değil'], ['p', '- bu da']]);
});

test('layoutText: uzun metin sayfalara bölünür, satırlar kenar boşluğunun içinde kalır', () => {
	const text = Array.from({ length: 30 }, (_, i) => `Satır ${i + 1}`).join('\n');
	const { pages } = layoutText(parseBlocks(text, false), opts);
	assert.ok(pages.length >= 3, `${pages.length} sayfa`);
	pages.flat().forEach((it) => {
		assert.ok(it.y >= 20 && it.y <= 200 - 20, `y=${it.y}`);
		assert.ok(it.x >= 20);
	});
	assert.equal(pages.flat().filter(it => it.type === 'text').length, 30);
});

test('layoutText: başlık sayfa sonunda yalnız kalmaz', () => {
	const filler = Array.from({ length: 7 }, () => 'dolgu').join('\n');
	const { pages } = layoutText(parseBlocks(`${filler}\n# Başlık\nmetin`, true), opts);
	const page = pages.findIndex(p => p.some(it => it.text === 'Başlık'));
	assert.ok(pages[page].some(it => it.text === 'metin'), 'başlık ve ardındaki satır aynı sayfada');
});

test('layoutText: madde işareti ilk satırla aynı tabanda, metin girintili', () => {
	const { pages } = layoutText(parseBlocks('- birinci madde çok uzun bir metin olsun ki iki satıra kırılsın tamam mı', true), opts);
	const items = pages[0];
	const mark = items.find(it => it.text === '•');
	const lines = items.filter(it => it.text !== '•');
	assert.ok(lines.length >= 2);
	assert.equal(mark.y, lines[0].y);
	assert.ok(lines.every(l => l.x > mark.x));
});
