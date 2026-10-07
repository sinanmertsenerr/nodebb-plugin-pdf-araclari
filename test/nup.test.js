'use strict';

// nup.js: bir kâğıda birden çok sayfa yerleşimi ve renk işlemleri
const test = require('node:test');
const assert = require('node:assert/strict');

let nup;
test.before(async () => { nup = await import('../src/nup.js'); });

const slide = { w: 960, h: 540 }; // 16:9 slayt
const a4 = { w: 595, h: 842 };

test('pickSheet + nupLayout: 2 slayt dikey kâğıtta alt alta, 6 slayt 2 × 3', () => {
	const sheet2 = nup.pickSheet(2, slide, 'auto');
	assert.equal(sheet2, nup.SHEETS.port);
	assert.deepEqual([nup.nupLayout(2, sheet2, slide).cols, nup.nupLayout(2, sheet2, slide).rows], [1, 2]);
	const l6 = nup.nupLayout(6, nup.pickSheet(6, slide, 'auto'), slide);
	assert.deepEqual([l6.cols, l6.rows], [2, 3]);
	const l9 = nup.nupLayout(9, nup.SHEETS.port, slide);
	assert.deepEqual([l9.cols, l9.rows], [3, 3]);
});

test('nupLayout: hücreler okuma sırasında ve kâğıdın içinde, çakışmıyor', () => {
	const sheet = nup.SHEETS.port;
	const l = nup.nupLayout(4, sheet, a4);
	assert.equal(l.cells.length, 4);
	assert.ok(l.cells[0].y > l.cells[2].y, 'birinci satır üstte');
	assert.ok(l.cells[0].x < l.cells[1].x, 'soldan sağa');
	l.cells.forEach((c) => {
		assert.ok(c.x >= 24 - 1e-9 && c.y >= 24 - 1e-9 && c.x + c.w <= sheet.w - 24 + 1e-9 && c.y + c.h <= sheet.h - 24 + 1e-9);
	});
	assert.ok(l.cells[0].x + l.cells[0].w <= l.cells[1].x);
});

test('fitInto: oran korunur, hücreye ortalanır', () => {
	const f = nup.fitInto({ x: 0, y: 0, w: 200, h: 200 }, slide);
	assert.ok(Math.abs(f.w / f.h - 960 / 540) < 1e-9);
	assert.equal(f.w, 200);
	assert.ok(Math.abs(f.y - (200 - f.h) / 2) < 1e-9);
});

test('invertLightness: siyah beyaz olur, beyaz siyah; toGray ve meanLightness', () => {
	const px = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
	nup.invertLightness(px);
	assert.deepEqual([...px.slice(0, 3)], [255, 255, 255]);
	assert.deepEqual([...px.slice(4, 7)], [0, 0, 0]);
	const g = nup.toGray(new Uint8ClampedArray([255, 0, 0, 255]));
	assert.equal(g[0], g[1]);
	assert.ok(Math.abs(nup.meanLightness(new Uint8ClampedArray([10, 10, 10, 255]), 1) - 10) < 1e-9);
});
