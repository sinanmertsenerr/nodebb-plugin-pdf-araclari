// Test PDF'leri üretir: test/out/ altına yazar (git'e girmez). Kullanım: node test/make-fixtures.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';

const out = new URL('./out/', import.meta.url);
await mkdir(out, { recursive: true });
const save = (name, data) => writeFile(new URL(name, out), data);

// Her sayfada büyük bir etiket: sayfa sırası gözle de doğrulanır
async function labelled(prefix, count, size = [595, 842]) {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.HelveticaBold);
	for (let i = 1; i <= count; i += 1) {
		const page = doc.addPage(size);
		page.drawRectangle({ x: 0, y: 0, width: size[0], height: 14, color: rgb(0.43, 0.16, 0.85) });
		page.drawText(`${prefix}${i}`, { x: 60, y: size[1] / 2, size: 110, font, color: rgb(0.1, 0.1, 0.12) });
		page.drawText(`Sayfa ${i} / ${count} (${prefix})`, { x: 60, y: size[1] / 2 - 40, size: 18, font });
	}
	return doc;
}

await save('a.pdf', await (await labelled('A', 3)).save());
await save('b.pdf', await (await labelled('B', 5)).save());
await save('landscape.pdf', await (await labelled('L', 2, [842, 595])).save());
await save('buyuk-12-sayfa.pdf', await (await labelled('P', 12)).save());
await save('Ödev Final (1).pdf', await (await labelled('O', 2)).save());

// Şifreli (şifre: 1234)
const locked = await labelled('S', 2);
locked.encrypt({ userPassword: '1234', ownerPassword: '1234', permissions: { documentAssembly: true, modifying: true, copying: true, printing: true, annotating: true, fillingForms: true, contentAccessibility: true } });
await save('sifreli-1234.pdf', await locked.save());

// "Taranmış" gibi: büyük, sıkıştırılması zor resim sayfaları (PNG gürültü)
function noisePng(w, h) {
	const row = w * 3 + 1;
	const raw = Buffer.alloc(row * h);
	let seed = 12345;
	for (let y = 0; y < h; y += 1) {
		raw[y * row] = 0;
		for (let x = 0; x < w * 3; x += 1) {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			const base = 160 + Math.round(60 * Math.sin((x / 3) / 40 + y / 90));
			raw[y * row + 1 + x] = Math.max(0, Math.min(255, base + ((seed >>> 24) % 40) - 20));
		}
	}
	const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
	const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
	const chunk = (type, data) => {
		const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
		return Buffer.concat([len, body, sum]);
	};
	const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}
const scan = await PDFDocument.create();
const png = await scan.embedPng(noisePng(1240, 1754));
for (let i = 0; i < 3; i += 1) {
	const page = scan.addPage([595, 842]);
	page.drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
}
await save('taranmis-gibi.pdf', await scan.save());

// Döndürülmüş sayfalar (/Rotate 90, 180, 270) ve kırpma kutusu kaymış sayfa: yazı yerleştiren araçlar görünen yöne göre çalışmalı
const turned = await labelled('R', 4);
turned.getPage(0).setCropBox(30, 40, 535, 762);
turned.getPage(1).setRotation(degrees(90));
turned.getPage(2).setRotation(degrees(180));
turned.getPage(3).setRotation(degrees(270));
await save('donuk.pdf', await turned.save());

// Koyu zeminli slaytlar (16:9): Çıktıya hazırla'nın "koyu slaytları beyaza çevir" seçeneği için
const dark = await PDFDocument.create();
const darkFont = await dark.embedFont(StandardFonts.HelveticaBold);
for (let i = 1; i <= 3; i += 1) {
	const page = dark.addPage([960, 540]);
	page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.08, 0.09, 0.12) });
	page.drawText(`D${i}`, { x: 80, y: 260, size: 120, font: darkFont, color: rgb(0.95, 0.95, 0.95) });
}
await save('koyu-slaytlar.pdf', await dark.save());

// PDF olmayan dosyalar
await save('not-pdf.txt', 'bu bir PDF degil\n');
await save('bozuk.pdf', '%PDF-1.4\nbu dosya bozuk\n');
console.log('test/out/ hazır');

// Sahibi düzenlemeyi kapatmış (sayfa işlemleri yasak) ve sahibi şifre koymuş ama her şeye izin vermiş PDF'ler
const closed = await labelled('K', 2);
closed.encrypt({ ownerPassword: 'sahip', userPassword: '', permissions: { documentAssembly: false, modifying: false, copying: false, printing: true } });
await save('kisitli.pdf', await closed.save());
const openOwner = await labelled('I', 2);
openOwner.encrypt({ ownerPassword: 'sahip', userPassword: '', permissions: { documentAssembly: true, modifying: true, copying: true, printing: true, annotating: true, fillingForms: true, contentAccessibility: true } });
await save('sahipsifreli-izinli.pdf', await openOwner.save());
console.log('kisitli.pdf ve sahipsifreli-izinli.pdf hazır');

// ---------- Resim dosyaları (macOS `sips` ile JPEG/WebP'e çevrilir; yoksa atlanır) ----------
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

function pngRaw(w, h, pixel, alpha = false) {
	const ch = alpha ? 4 : 3;
	const row = w * ch + 1;
	const raw = Buffer.alloc(row * h);
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			const p = pixel(x, y);
			for (let c = 0; c < ch; c += 1) raw[y * row + 1 + x * ch + c] = p[c];
		}
	}
	const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
	const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
	const chunk = (type, data) => {
		const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
		return Buffer.concat([len, body, sum]);
	};
	const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = alpha ? 6 : 2;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// Dört renkli çeyrek: sol üst kırmızı, sağ üst yeşil, sol alt mavi, sağ alt sarı. Yön buradan okunur.
const quadrant = (w, h) => (x, y) => {
	const left = x < w / 2;
	const top = y < h / 2;
	const noise = ((x * 7 + y * 13) % 17) * 2;
	if (top && left) return [220 - noise, 40, 40];
	if (top) return [40, 180 - noise, 60];
	if (left) return [40, 70, 220 - noise];
	return [235 - noise, 200, 40];
};

try {
	const tmp = new URL('./', out).pathname;
	await save('yatay.png', pngRaw(600, 400, quadrant(600, 400)));
	await save('seffaf.png', pngRaw(300, 200, (x, y) => ((x - 150) ** 2 + (y - 100) ** 2 < 60 * 60 ? [0, 0, 0, 0] : [30, 90, 200, 255]), true));
	await save('buyuk-foto.png', pngRaw(3000, 2000, (x, y) => [(x * 255 / 3000 + ((x * y) % 29)) % 256, (y * 255 / 2000 + ((x + y) % 31)) % 256, ((x + y) * 255 / 5000 + ((x ^ y) % 23)) % 256]));
	execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', `${tmp}yatay.png`, '--out', `${tmp}foto-yatay.jpg`], { stdio: 'ignore' });
	execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', `${tmp}buyuk-foto.png`, '--out', `${tmp}buyuk-foto.jpg`], { stdio: 'ignore' });
	rmSync(`${tmp}buyuk-foto.png`);
	// EXIF yönü 6 ("sağa 90° çevir"): telefonun dik tuttuğu fotoğraf böyle kaydedilir. Ekranda 400x600 görünmeli.
	const jpg = readFileSync(`${tmp}foto-yatay.jpg`);
	const exif = Buffer.from('FFE1002245786966000049492A00080000000100120103000100000006000000000000000000', 'hex');
	const noApp = jpg[2] === 0xFF && jpg[3] === 0xE0 ? 4 + jpg.readUInt16BE(4) : 2; // JFIF varsa onun ardına
	writeFileSync(`${tmp}foto-exif6.jpg`, Buffer.concat([jpg.subarray(0, noApp), exif, jpg.subarray(noApp)]));
	try { execFileSync('sips', ['-s', 'format', 'webp', `${tmp}yatay.png`, '--out', `${tmp}resim.webp`], { stdio: 'ignore' }); } catch (e) { /* bu sips WebP yazamıyor */ }
	console.log('resim dosyaları hazır');
} catch (err) {
	console.log('resim dosyaları atlandı:', err.message.split('\n')[0]);
}
