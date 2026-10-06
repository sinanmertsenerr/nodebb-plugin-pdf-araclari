'use strict';

// stamp.js: döndürülmüş sayfada görünen konumun gerçek koordinata çevrilmesi, numara ve filigran yerleşimi
const test = require('node:test');
const assert = require('node:assert/strict');

let CAP; let centeredStart; let hexToRgb; let numberSpot; let pageFrame; let rectToPdf; let watermarkSpots;
test.before(async () => {
	({ CAP, centeredStart, hexToRgb, numberSpot, pageFrame, rectToPdf, watermarkSpots } = await import('../src/stamp.js'));
});

const fakePage = (w, h, angle, x = 0, y = 0) => ({ getCropBox: () => ({ x, y, width: w, height: h }), getRotation: () => ({ angle }) });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('pageFrame: dönüşsüz sayfa olduğu gibi, kırpma kutusu kayması eklenir', () => {
	const f = pageFrame(fakePage(595, 842, 0, 10, 20));
	assert.deepEqual([f.w, f.h, f.rot], [595, 842, 0]);
	assert.deepEqual(f.toPdf(0, 0), { x: 10, y: 20 });
});

test('pageFrame: 90° dönük sayfada görünen sol alt köşe gerçek sağ alt köşedir', () => {
	// 595x842 sayfa saat yönünde 90° döner: ekranda 842x595 yatay görünür
	const f = pageFrame(fakePage(595, 842, 90));
	assert.deepEqual([f.w, f.h], [842, 595]);
	assert.deepEqual(f.toPdf(0, 0), { x: 595, y: 0 });
	assert.deepEqual(f.toPdf(842, 595), { x: 0, y: 842 });
	// Görünen sol üst köşe -> gerçek sol alt köşe
	assert.deepEqual(f.toPdf(0, 595), { x: 0, y: 0 });
});

test('pageFrame: 180° ve 270° (ve -90°)', () => {
	const f180 = pageFrame(fakePage(100, 200, 180));
	assert.deepEqual(f180.toPdf(0, 0), { x: 100, y: 200 });
	const f270 = pageFrame(fakePage(100, 200, 270));
	assert.deepEqual([f270.w, f270.h], [200, 100]);
	assert.deepEqual(f270.toPdf(0, 0), { x: 0, y: 200 });
	assert.equal(pageFrame(fakePage(100, 200, -90)).rot, 270);
});

test('rectToPdf: dönük sayfada da eksenlere paralel dik dörtgen', () => {
	const f = pageFrame(fakePage(595, 842, 90));
	assert.deepEqual(rectToPdf(f, 10, 20, 100, 50), { x: 595 - 70, y: 10, width: 50, height: 100 });
});

test('numberSpot: altta ortada, sağ üstte', () => {
	const bc = numberSpot('bc', 600, 800, 20, 10, 28);
	assert.deepEqual(bc, { x: 290, y: 28 });
	const tr = numberSpot('tr', 600, 800, 20, 10, 28);
	near(tr.x, 552);
	near(tr.y, 800 - 28 - 10 * CAP);
});

test('centeredStart: düz yazı ortası verilen noktaya düşer', () => {
	const s = centeredStart(300, 400, 100, 20, 0);
	near(s.x, 250);
	near(s.y, 400 - 10 * CAP);
	// 90°: yazı yukarı doğru akar; başlangıç ortanın altında ve sağında kalır
	const r = centeredStart(300, 400, 100, 20, 90);
	near(r.x, 300 + 10 * CAP);
	near(r.y, 350);
});

test('watermarkSpots: ortada tek; döşeyince sayfayı kaplar ve sayfanın içindedir', () => {
	assert.deepEqual(watermarkSpots(600, 800, 200, 40, 45, false), [{ x: 300, y: 400 }]);
	const spots = watermarkSpots(600, 800, 200, 40, 45, true);
	assert.ok(spots.length >= 6 && spots.length < 80, `${spots.length}`);
	assert.ok(spots.every(p => p.x > -100 && p.x < 700 && p.y > -40 && p.y < 840));
	assert.ok(spots.some(p => p.y < 200) && spots.some(p => p.y > 600));
});

test('hexToRgb', () => {
	assert.deepEqual(hexToRgb('#ff0000'), [1, 0, 0]);
	assert.deepEqual(hexToRgb('bogus'), [0, 0, 0]);
});
