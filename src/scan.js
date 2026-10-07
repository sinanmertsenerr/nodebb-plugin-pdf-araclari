// Tara'nın hesapları: belge kenarlarını bulma, eğikliği düzeltme (perspektif), aydınlatmayı düzleştirme ve filtreler.
// Saf: { data, width, height } (RGBA) üstünde çalışır, tarayıcı gerekmez. Testleri test/scan.test.js'te.

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

// 8×8 doğrusal sistem (Gauss, kısmi pivot)
function solve(A, b) {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c += 1) {
		let p = c;
		for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
		[M[c], M[p]] = [M[p], M[c]];
		if (Math.abs(M[c][c]) < 1e-12) return null;
		for (let r = 0; r < n; r += 1) {
			if (r !== c) {
				const f = M[r][c] / M[c][c];
				for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
			}
		}
	}
	return M.map((row, i) => row[n] / row[i]);
}

// Kaynak dörtgenden hedef dörtgene homografi: [x, y] -> [u, v]. from/to: dört köşe [[x, y] ...]
export function homography(from, to) {
	const A = [];
	const b = [];
	for (let i = 0; i < 4; i += 1) {
		const [x, y] = from[i];
		const [u, v] = to[i];
		A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
		b.push(u);
		A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
		b.push(v);
	}
	const h = solve(A, b);
	if (!h) return null;
	return ([x, y]) => {
		const w = h[6] * x + h[7] * y + 1;
		return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
	};
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Düzeltilmiş belgenin ölçüsü: karşılıklı kenarların uzunu, en uzun kenar maxSide'ı geçmez
export function outputSize(corners, maxSide = 2200) {
	const [tl, tr, br, bl] = corners;
	let w = Math.max(dist(tl, tr), dist(bl, br));
	let h = Math.max(dist(tl, bl), dist(tr, br));
	const s = Math.min(1, maxSide / Math.max(w, h));
	w = Math.max(1, Math.round(w * s));
	h = Math.max(1, Math.round(h * s));
	return { w, h };
}

// Perspektif düzeltme: corners (tl, tr, br, bl, kaynak piksel) içindeki alanı w×h dik dörtgene çeker (çift doğrusal örnekleme)
export function warp(src, corners, w, h) {
	const map = homography([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], corners);
	const out = new Uint8ClampedArray(w * h * 4);
	const { data, width, height } = src;
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			const [u, v] = map([x, y]);
			const x0 = Math.max(0, Math.min(width - 1, Math.floor(u)));
			const y0 = Math.max(0, Math.min(height - 1, Math.floor(v)));
			const x1 = Math.min(width - 1, x0 + 1);
			const y1 = Math.min(height - 1, y0 + 1);
			const fx = Math.max(0, Math.min(1, u - x0));
			const fy = Math.max(0, Math.min(1, v - y0));
			const o = (y * w + x) * 4;
			for (let c = 0; c < 3; c += 1) {
				const a = data[(y0 * width + x0) * 4 + c];
				const bb = data[(y0 * width + x1) * 4 + c];
				const cc = data[(y1 * width + x0) * 4 + c];
				const d = data[(y1 * width + x1) * 4 + c];
				out[o + c] = (a * (1 - fx) + bb * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
			}
			out[o + 3] = 255;
		}
	}
	return { data: out, width: w, height: h };
}

// Otsu eşiği (0-255) parlaklık histogramından
export function otsu(gray) {
	const hist = new Array(256).fill(0);
	gray.forEach((v) => { hist[v] += 1; });
	const total = gray.length;
	let sum = 0;
	for (let i = 0; i < 256; i += 1) sum += i * hist[i];
	let sumB = 0;
	let wB = 0;
	let best = 0;
	let threshold = 127;
	for (let i = 0; i < 256; i += 1) {
		wB += hist[i];
		if (wB && wB !== total) {
			sumB += i * hist[i];
			const mB = sumB / wB;
			const mF = (sum - sumB) / (total - wB);
			const between = wB * (total - wB) * (mB - mF) ** 2;
			if (between > best) { best = between; threshold = i; }
		}
	}
	return threshold;
}

// Belge kenarları: koyu zemin üstündeki açık renkli en büyük parça; köşeleri x+y ve x−y uç noktaları.
// img küçültülmüş olmalı (≈320 px). Bulamazsa null; kişi köşeleri elle düzeltir.
export function detectCorners(img) {
	const { data, width, height } = img;
	const n = width * height;
	const gray = new Uint8Array(n);
	for (let i = 0; i < n; i += 1) gray[i] = Math.round(lum(data, i * 4));
	const th = otsu(gray);
	const seen = new Uint8Array(n);
	let bestPixels = null;
	const stack = new Int32Array(n);
	for (let start = 0; start < n; start += 1) {
		if (gray[start] > th && !seen[start]) {
			let top = 0;
			stack[top++] = start;
			seen[start] = 1;
			const pixels = [];
			while (top) {
				const p = stack[--top];
				pixels.push(p);
				const x = p % width;
				if (x > 0 && !seen[p - 1] && gray[p - 1] > th) { seen[p - 1] = 1; stack[top++] = p - 1; }
				if (x < width - 1 && !seen[p + 1] && gray[p + 1] > th) { seen[p + 1] = 1; stack[top++] = p + 1; }
				if (p >= width && !seen[p - width] && gray[p - width] > th) { seen[p - width] = 1; stack[top++] = p - width; }
				if (p < n - width && !seen[p + width] && gray[p + width] > th) { seen[p + width] = 1; stack[top++] = p + width; }
			}
			if (!bestPixels || pixels.length > bestPixels.length) bestPixels = pixels;
		}
	}
	if (!bestPixels) return null;
	const share = bestPixels.length / n;
	if (share < 0.12 || share > 0.97) return null;
	let tl = null; let tr = null; let br = null; let bl = null;
	let sMin = Infinity; let sMax = -Infinity; let dMin = Infinity; let dMax = -Infinity;
	bestPixels.forEach((p) => {
		const x = p % width;
		const y = (p - x) / width;
		const s = x + y;
		const d = x - y;
		if (s < sMin) { sMin = s; tl = [x, y]; }
		if (s > sMax) { sMax = s; br = [x, y]; }
		if (d > dMax) { dMax = d; tr = [x, y]; }
		if (d < dMin) { dMin = d; bl = [x, y]; }
	});
	return [tl, tr, br, bl];
}

// Kutu bulanıklığı için toplam tablosu (parlaklık)
function boxBlurLum(img, radius) {
	const { data, width, height } = img;
	const sat = new Float64Array((width + 1) * (height + 1));
	for (let y = 0; y < height; y += 1) {
		let row = 0;
		for (let x = 0; x < width; x += 1) {
			row += lum(data, (y * width + x) * 4);
			sat[(y + 1) * (width + 1) + x + 1] = sat[y * (width + 1) + x + 1] + row;
		}
	}
	const out = new Float32Array(width * height);
	for (let y = 0; y < height; y += 1) {
		const y0 = Math.max(0, y - radius);
		const y1 = Math.min(height, y + radius + 1);
		for (let x = 0; x < width; x += 1) {
			const x0 = Math.max(0, x - radius);
			const x1 = Math.min(width, x + radius + 1);
			const sum = sat[y1 * (width + 1) + x1] - sat[y0 * (width + 1) + x1] - sat[y1 * (width + 1) + x0] + sat[y0 * (width + 1) + x0];
			out[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
		}
	}
	return out;
}

// Filtre: 'original' | 'doc' (renkli belge: kâğıt beyazlar, gölge gider) | 'gray' | 'bw' (siyah-beyaz, uyarlamalı eşik)
export function applyFilter(img, filter) {
	if (filter === 'original') return img;
	const { data, width, height } = img;
	const radius = Math.max(8, Math.round(Math.min(width, height) / 18));
	const bg = boxBlurLum(img, radius);
	for (let p = 0, i = 0; p < width * height; p += 1, i += 4) {
		const y = lum(data, i);
		const b = Math.max(bg[p], 1);
		if (filter === 'bw') {
			const v = y < b * 0.86 ? 0 : 255;
			data[i] = v; data[i + 1] = v; data[i + 2] = v;
		} else {
			// Kâğıdın yerel parlaklığına bölünür: aydınlatma düzleşir, sonra biraz koyulaştırılır (mürekkep belirginleşir)
			const k = 242 / b;
			const curve = v => 255 * ((Math.max(0, Math.min(255, v * k)) / 255) ** 1.6);
			if (filter === 'gray') {
				const g = curve(y);
				data[i] = g; data[i + 1] = g; data[i + 2] = g;
			} else {
				data[i] = curve(data[i]); data[i + 1] = curve(data[i + 1]); data[i + 2] = curve(data[i + 2]);
			}
		}
	}
	return img;
}

// 90 derecelik adımlarla döndürme. turn: 0 | 90 | 180 | 270 (saat yönünde)
export function rotate(img, turn) {
	const t = ((turn % 360) + 360) % 360;
	if (!t) return img;
	const { data, width, height } = img;
	const w = t === 180 ? width : height;
	const h = t === 180 ? height : width;
	const out = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let nx;
			let ny;
			if (t === 90) { nx = height - 1 - y; ny = x; } else if (t === 180) { nx = width - 1 - x; ny = height - 1 - y; } else { nx = y; ny = width - 1 - x; }
			const s = (y * width + x) * 4;
			const d = (ny * w + nx) * 4;
			out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
		}
	}
	return { data: out, width: w, height: h };
}

// Varsayılan köşeler: resmin kenarından biraz içeride
export const insetCorners = (w, h, f = 0.04) => [[w * f, h * f], [w * (1 - f), h * f], [w * (1 - f), h * (1 - f)], [w * f, h * (1 - f)]];
