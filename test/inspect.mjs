// Test yardımcıları: PDF'in sayfalarını okur, ZIP'i açar. verify-pdf.mjs ve e2e testi kullanır.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// -> { pages, rows: [{ n, rotate, w, h, text }] }
export async function inspectPdf(bytes, password) {
	const task = getDocument({ data: new Uint8Array(bytes), password, isEvalSupported: false, verbosity: 0 });
	const doc = await task.promise;
	const rows = [];
	for (let n = 1; n <= doc.numPages; n += 1) {
		const page = await doc.getPage(n);
		const text = (await page.getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
		const [x0, y0, x1, y1] = page.view;
		rows.push({ n, rotate: page.rotate, w: Math.round(x1 - x0), h: Math.round(y1 - y0), text });
	}
	const pages = doc.numPages;
	await task.destroy();
	return { pages, rows };
}

// Sayfaların başındaki etiket ("A1", "B5"…): sırayı kısaca karşılaştırmak için
export const labels = info => info.rows.map(r => r.text.split(' ')[0]);

// Saklamalı (store) ZIP'i okur: [{ name, data }] — adlar UTF-8
export function readZip(buf) {
	const bytes = new Uint8Array(buf);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const end = bytes.length - 22;
	if (view.getUint32(end, true) !== 0x06054B50) throw new Error('ZIP sonu bulunamadı');
	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const out = [];
	for (let i = 0; i < count; i += 1) {
		const size = view.getUint32(at + 24, true);
		const nameLen = view.getUint16(at + 28, true);
		const local = view.getUint32(at + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		out.push({ name, data: bytes.subarray(start, start + size) });
		at += 46 + nameLen;
	}
	return out;
}
