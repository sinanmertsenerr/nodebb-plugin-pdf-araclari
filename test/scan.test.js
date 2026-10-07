'use strict';

// scan.js: homografi, perspektif düzeltme, kenar bulma, filtre ve döndürme
const test = require('node:test');
const assert = require('node:assert/strict');

let scan;
test.before(async () => { scan = await import('../src/scan.js'); });

// w×h RGBA resim; px(x, y) -> [r, g, b]
function image(w, h, px) {
	const data = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			const [r, g, b] = px(x, y);
			const i = (y * w + x) * 4;
			data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
		}
	}
	return { data, width: w, height: h };
}

// Nokta dörtgenin içinde mi (dışbükey, saat yönünde köşeler)
function inQuad(q, x, y) {
	for (let i = 0; i < 4; i += 1) {
		const [ax, ay] = q[i];
		const [bx, by] = q[(i + 1) % 4];
		if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
	}
	return true;
}

test('homography: köşeleri köşelere götürür', () => {
	const from = [[0, 0], [100, 0], [100, 50], [0, 50]];
	const to = [[10, 20], [200, 5], [220, 180], [0, 160]];
	const h = scan.homography(from, to);
	from.forEach((p, i) => {
		const [u, v] = h(p);
		assert.ok(Math.abs(u - to[i][0]) < 1e-6 && Math.abs(v - to[i][1]) < 1e-6);
	});
});

test('detectCorners: koyu zemindeki eğik açık kâğıdın köşelerini bulur', () => {
	const quad = [[60, 40], [250, 70], [230, 300], [40, 270]];
	const img = image(320, 340, (x, y) => (inQuad(quad, x, y) ? [235, 232, 225] : [45, 50, 60]));
	const found = scan.detectCorners(img);
	assert.ok(found, 'köşe bulunmalı');
	found.forEach((p, i) => assert.ok(Math.hypot(p[0] - quad[i][0], p[1] - quad[i][1]) < 6, `köşe ${i}: ${p} ≈ ${quad[i]}`));
});

test('detectCorners: kâğıt yoksa (düz resim) null', () => {
	assert.equal(scan.detectCorners(image(100, 100, () => [128, 128, 128])), null);
});

test('warp + outputSize: eğik kâğıt düz dik dörtgen olur, içi kâğıt rengi', () => {
	const quad = [[60, 40], [250, 70], [230, 300], [40, 270]];
	const img = image(320, 340, (x, y) => (inQuad(quad, x, y) ? [235, 232, 225] : [45, 50, 60]));
	const { w, h } = scan.outputSize(quad);
	const out = scan.warp(img, quad, w, h);
	assert.equal(out.width, w);
	const mid = ((Math.floor(h / 2) * w) + Math.floor(w / 2)) * 4;
	assert.ok(out.data[mid] > 200, 'orta kâğıt rengi');
	const corner = ((3 * w) + 3) * 4;
	assert.ok(out.data[corner] > 150, 'köşe de kâğıt içinde');
});

test('applyFilter: bw yazıyı siyah, kâğıdı beyaz yapar; gölgeli kâğıt da beyazlar', () => {
	// Soldan sağa kararan kâğıt (gölge) üstünde koyu bir çizgi
	const img = image(200, 100, (x, y) => (y > 45 && y < 55 && x > 20 && x < 180 ? [30, 30, 30] : [230 - x * 0.5, 230 - x * 0.5, 225 - x * 0.5]));
	const bw = scan.applyFilter({ ...img, data: img.data.slice() }, 'bw');
	assert.equal(bw.data[(50 * 200 + 100) * 4], 0, 'çizgi siyah');
	assert.equal(bw.data[(10 * 200 + 190) * 4], 255, 'gölgeli kâğıt beyaz');
	const doc = scan.applyFilter({ ...img, data: img.data.slice() }, 'doc');
	assert.ok(doc.data[(10 * 200 + 190) * 4] > 200, 'renkli belge: gölge kalkar');
});

test('rotate: 90° eni boyla değiştirir, piksel doğru yere gider', () => {
	const img = image(3, 2, (x, y) => [x * 10 + y, 0, 0]);
	const r = scan.rotate(img, 90);
	assert.deepEqual([r.width, r.height], [2, 3]);
	// Sol üstteki piksel (0,0) saat yönünde 90° sonra sağ üste (1,0) gider
	assert.equal(r.data[(0 * 2 + 1) * 4], 0);
	assert.equal(r.data[(0 * 2 + 0) * 4], 1);
});
