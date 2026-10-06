// Resim yardımcıları: açma (EXIF yönü dahil), küçültme, kodlama. Hepsi tarayıcıda, canvas ile.

export const MAX_IMAGE_MB = 60;
const MAX_CANVAS_SIDE = 8192;

export const isImageFile = file => !!file && (/^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(file.name));

// -> { source, width, height, close() }. source: ImageBitmap ya da HTMLImageElement (drawImage'e verilir)
export async function loadImage(file) {
	if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error('big');
	if (typeof createImageBitmap === 'function' && file.type !== 'image/svg+xml') {
		try {
			// imageOrientation: telefon fotoğraflarının yan dönmesini önler (EXIF yönü uygulanır)
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
			return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
		} catch (err) { /* aşağıdaki Image yoluna düş */ }
	}
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const width = img.naturalWidth || 1024;
		const height = img.naturalHeight || 768;
		return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
	} catch (err) {
		URL.revokeObjectURL(url);
		throw new Error('decode');
	}
}

// Resmi (en uzun kenarı maxSide'ı geçmeyecek biçimde) canvas'a çizer. background verilirse önce o renkle boyanır (JPG için beyaz).
export function drawToCanvas(img, { maxSide = 0, background = null } = {}) {
	let scale = 1;
	const limit = Math.min(maxSide || MAX_CANVAS_SIDE, MAX_CANVAS_SIDE);
	if (Math.max(img.width, img.height) > limit) scale = limit / Math.max(img.width, img.height);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(img.width * scale));
	canvas.height = Math.max(1, Math.round(img.height * scale));
	const ctx = canvas.getContext('2d');
	if (background) {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
	return canvas;
}

export function canvasBlob(canvas, type, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality);
	});
}

export async function canvasBytes(canvas, type, quality) {
	return new Uint8Array(await (await canvasBlob(canvas, type, quality)).arrayBuffer());
}

let webp = null;
// Bu tarayıcı WebP yazabiliyor mu? (Safari'nin eski sürümleri PNG'ye düşer)
export async function webpSupported() {
	if (webp === null) {
		const c = document.createElement('canvas');
		c.width = 2;
		c.height = 2;
		try { webp = (await canvasBlob(c, 'image/webp', 0.8)).type === 'image/webp'; } catch (err) { webp = false; }
	}
	return webp;
}

// Çıktı biçimleri: uzantı ve MIME
export const FORMATS = {
	jpg: { type: 'image/jpeg', ext: 'jpg' },
	png: { type: 'image/png', ext: 'png' },
	webp: { type: 'image/webp', ext: 'webp' },
};

// Resmin yüklenirken küçük resmi için nesne adresi
export const previewUrl = file => URL.createObjectURL(file);
