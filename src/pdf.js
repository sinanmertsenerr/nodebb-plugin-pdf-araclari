// PDF'i açma, sayfa küçük resmi çizme, indirme. Her şey tarayıcıda olur; dosya hiçbir yere yüklenmez.
/* global PDFJS_DIR, PDFLIB_FILE, PDFFONT_FILE */

// Betik değerlendirilirken kendi adresi: pdf.js ve pdf-lib dosyaları onun yanındadır
const SCRIPT_URL = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
const base = () => SCRIPT_URL || window.location.href;

// Eklentinin kendi dosyalarının adresi (betiğin yanından): ör. assetUrl('../fonts/inter-latin-400.ttf')
export const assetUrl = rel => new URL(rel, base()).href;

export const MAX_MB = 80;

let pdfjs = null;
let lib = null;

export async function getPdfjs() {
	if (pdfjs) return pdfjs;
	const dir = new URL(`../${PDFJS_DIR}/`, base());
	pdfjs = await import(/* @vite-ignore */ new URL('pdf.min.js', dir).href);
	pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', dir).href;
	return pdfjs;
}

export async function getLib() {
	if (lib) return lib;
	if (!window.YuPdfLib) {
		const url = new URL(PDFLIB_FILE, base()).href;
		await new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = url;
			s.onload = resolve;
			s.onerror = () => reject(new Error('pdf-lib'));
			document.head.appendChild(s);
		});
	}
	lib = window.YuPdfLib;
	return lib;
}

function loadScript(url) {
	return new Promise((resolve, reject) => {
		const s = document.createElement('script');
		s.src = url;
		s.onload = resolve;
		s.onerror = () => reject(new Error(url));
		document.head.appendChild(s);
	});
}

let kit = null;
// Yazı tipi okuyucu: yalnızca metin yazan araçlar ister
export async function getFontkit() {
	if (kit) return kit;
	if (!window.YuPdfFontkit) await loadScript(assetUrl(PDFFONT_FILE));
	kit = window.YuPdfFontkit;
	return kit;
}

export const isPdf = file => !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

// Dosyayı açar. Sonuç: { ok: true, bytes, doc, pages } | { ok: false, reason: 'password' | 'wrong-password' | 'restricted' | 'broken' | 'big' }
export async function openPdf(file, password) {
	if (file.size > MAX_MB * 1024 * 1024) return { ok: false, reason: 'big' };
	const bytes = new Uint8Array(await file.arrayBuffer());
	const { getDocument } = await getPdfjs();
	const task = getDocument({ data: bytes.slice(), password: password || undefined, isEvalSupported: false });
	try {
		const doc = await task.promise;
		// Dosyanın sahibi sayfa işlemlerini (birleştirme, ayırma, silme) kapatmışsa bu koruma aşılmaz
		const permissions = await doc.getPermissions();
		if (permissions && !permissions.has(pdfjs.PermissionFlag.ASSEMBLE)) {
			task.destroy();
			return { ok: false, reason: 'restricted' };
		}
		return { ok: true, bytes, doc, task, pages: doc.numPages, password: password || '' };
	} catch (err) {
		if (err && err.name === 'PasswordException') {
			return { ok: false, reason: err.code === 2 ? 'wrong-password' : 'password' };
		}
		return { ok: false, reason: 'broken' };
	}
}

// Dosya şifreli mi (açma şifresi ya da sahip şifresi)? pdf-lib şifreli dosyayı yalnızca bu seçenekle yoklar.
export async function isEncryptedBytes(bytes) {
	const { PDFDocument } = await getLib();
	return (await PDFDocument.load(bytes, { ignoreEncryption: true })).isEncrypted;
}

// Şifresi çözülmüş belgede kalan kalıntılar: şifre sözlüğü, kaynağın eski xref akışı (pdf-lib okuyamaz ve olduğu gibi geri yazar,
// içinde /Encrypt vardır) ve nesne akışı kapları. Bunlar yazılırsa çıktı yeniden "şifreli" sanılır ve açılmaz.
export function stripEncryption(doc, { PDFName, PDFInvalidObject }) {
	const ctx = doc.context;
	delete ctx.trailerInfo.Encrypt;
	const name = (dict, key) => {
		const v = dict && typeof dict.get === 'function' ? dict.get(PDFName.of(key)) : null;
		return v ? v.toString() : '';
	};
	for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
		const dict = obj && (obj.dict || obj);
		const type = name(dict, 'Type');
		const cipher = name(dict, 'Filter') === '/Standard' && name(dict, 'O');
		if (obj instanceof PDFInvalidObject || type === '/XRef' || type === '/ObjStm' || cipher) ctx.delete(ref);
	}
	return doc;
}

// Şifre kaydı kalmamış, düzenlenebilir pdf-lib belgesi (şifreli kaynakta kalıntılar temizlenir)
export async function loadClean(opened) {
	const lib = await getLib();
	const doc = await loadForEdit(opened);
	if (!(await isEncryptedBytes(opened.bytes))) return doc;
	return stripEncryption(doc, lib);
}

// Açılmış belgeyi kapatır (pdf.js'te belge değil yükleme görevi yok edilir)
export function closePdf(opened) {
	if (opened && opened.task) {
		try { opened.task.destroy(); } catch (e) { /* zaten kapanmışsa önemli değil */ }
	}
}

// pdf-lib'e verilecek hâli: şifreliyse şifreyle açılır, çıktıda şifre olmaz.
// Boş şifre, yalnızca sahip şifresi olan (açmak için şifre istemeyen) dosyaları da açar.
export async function loadForEdit(opened) {
	const { PDFDocument } = await getLib();
	return PDFDocument.load(opened.bytes, { password: opened.password || '' });
}

// Küçük resim çizimleri sırayla yapılır: yüzlerce sayfalık dosyada tarayıcı donmasın
let queue = Promise.resolve();
export function renderPage(doc, pageNumber, canvas, targetWidth) {
	const job = queue.then(async () => {
		const page = await doc.getPage(pageNumber);
		const first = page.getViewport({ scale: 1 });
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		const viewport = page.getViewport({ scale: (targetWidth * ratio) / first.width });
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const ctx = canvas.getContext('2d');
		await page.render({ canvas, canvasContext: ctx, viewport }).promise;
		page.cleanup();
		return { width: first.width, height: first.height };
	});
	queue = job.catch(() => {});
	return job;
}

// Bir sayfayı verilen dpi'da canvas'a çizer (72 dpi = 1 pt = 1 px). Çok büyük sayfalar maxSide ile sınırlanır.
export async function renderToCanvas(doc, pageNumber, { dpi = 150, maxSide = 8000, background = '#ffffff' } = {}) {
	const page = await doc.getPage(pageNumber);
	const base = page.getViewport({ scale: 1 });
	const scale = Math.min(dpi / 72, maxSide / Math.max(base.width, base.height));
	const viewport = page.getViewport({ scale });
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(viewport.width));
	canvas.height = Math.max(1, Math.round(viewport.height));
	const ctx = canvas.getContext('2d');
	if (background) {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	await page.render({ canvas, canvasContext: ctx, viewport }).promise;
	page.cleanup();
	return canvas;
}

export function download(data, name, type) {
	const blob = data instanceof Blob ? data : new Blob([data], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60000);
}
