// Sayfaya görünen yönüyle yazı ve şekil yerleştirme. pdf-lib döndürülmemiş sayfa uzayında çizer; burada görünen
// (ekrandaki) konum, sayfanın /Rotate değerine ve kırpma kutusuna göre gerçek koordinata çevrilir. Saf: testleri test/stamp.test.js'te.

// Inter'in büyük harf yüksekliği (em'e oranı): yazıyı dikeyde ortalamak ve üst kenardan uzaklık için
export const CAP = 0.727;

// -> { w, h: görünen boyut (pt), rot: 0/90/180/270 (saat yönünde), toPdf(vx, vy) }
// vx, vy görünen sayfada sol alt köşeden ölçülür (y yukarı).
export function pageFrame(page) {
	const box = page.getCropBox();
	const rot = (((page.getRotation().angle || 0) % 360) + 360) % 360;
	const W = box.width;
	const H = box.height;
	const toPdf = (vx, vy) => {
		if (rot === 90) return { x: box.x + W - vy, y: box.y + vx };
		if (rot === 180) return { x: box.x + W - vx, y: box.y + H - vy };
		if (rot === 270) return { x: box.x + vy, y: box.y + H - vx };
		return { x: box.x + vx, y: box.y + vy };
	};
	// Tersi: pdf-lib koordinatı -> görünen sayfa (sol alttan)
	const fromPdf = (x, y) => {
		const dx = x - box.x;
		const dy = y - box.y;
		if (rot === 90) return { x: dy, y: W - dx };
		if (rot === 180) return { x: W - dx, y: H - dy };
		if (rot === 270) return { x: H - dy, y: dx };
		return { x: dx, y: dy };
	};
	const sideways = rot === 90 || rot === 270;
	return { w: sideways ? H : W, h: sideways ? W : H, rot, toPdf, fromPdf };
}

// pdf-lib dik dörtgeni -> görünen sayfada sol üstten (y aşağı) kutu: form alanını önizlemede doğru yere koymak için
export function rectFromPdf(frame, r) {
	const a = frame.fromPdf(r.x, r.y);
	const b = frame.fromPdf(r.x + r.width, r.y + r.height);
	const x = Math.min(a.x, b.x);
	const w = Math.abs(b.x - a.x);
	const h = Math.abs(b.y - a.y);
	return { x, y: frame.h - Math.max(a.y, b.y), w, h };
}

// Görünen sayfadaki dik dörtgen -> pdf-lib dik dörtgeni (dönüş 90'ın katı olduğu için kenarlar yine eksenlere paralel)
export function rectToPdf(frame, vx, vy, w, h) {
	const a = frame.toPdf(vx, vy);
	const b = frame.toPdf(vx + w, vy + h);
	return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

// Ortası (cx, cy) olacak, angle derece (saat yönünün tersine) dönük yazının başlangıç noktası (taban çizgisinin solu)
export function centeredStart(cx, cy, textWidth, size, angle) {
	const rad = (angle * Math.PI) / 180;
	const hw = textWidth / 2;
	const hh = (size * CAP) / 2;
	return { x: cx - (hw * Math.cos(rad) - hh * Math.sin(rad)), y: cy - (hw * Math.sin(rad) + hh * Math.cos(rad)) };
}

// Sayfa numarasının yeri. pos: 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br' (üst/alt + sol/orta/sağ). margin: kenardan uzaklık (pt)
export function numberSpot(pos, w, h, textWidth, size, margin) {
	const col = pos[1];
	const x = col === 'l' ? margin : (col === 'r' ? w - margin - textWidth : (w - textWidth) / 2);
	const y = pos[0] === 't' ? h - margin - size * CAP : margin;
	return { x, y };
}

// Filigranın yazı ortaları. tiled değilse sayfanın ortası; döşenince yazı yönünde sıralar, her sıra yarım adım kayar.
export function watermarkSpots(w, h, textWidth, size, angle, tiled) {
	if (!tiled) return [{ x: w / 2, y: h / 2 }];
	const rad = (angle * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const stepU = textWidth + size * 2;
	const stepV = size * 2.6;
	const reach = Math.hypot(w, h) / 2 + textWidth;
	const rows = Math.ceil(reach / stepV);
	const cols = Math.ceil(reach / stepU) + 1;
	const spots = [];
	for (let r = -rows; r <= rows; r += 1) {
		const shift = Math.abs(r) % 2 ? stepU / 2 : 0;
		for (let c = -cols; c <= cols; c += 1) {
			const u = c * stepU + shift;
			const v = r * stepV;
			const x = w / 2 + u * cos - v * sin;
			const y = h / 2 + u * sin + v * cos;
			if (x > -textWidth / 2 && x < w + textWidth / 2 && y > -size && y < h + size) spots.push({ x, y });
		}
	}
	return spots;
}

// "#rrggbb" -> [r, g, b] (0-1), pdf-lib rgb() için
export function hexToRgb(hex) {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
	const n = m ? parseInt(m[1], 16) : 0;
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
