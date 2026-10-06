// Resimden PDF: resimleri seçilen sırayla tek PDF yapar. Resimler EXIF yönüne göre düzeltilir; telefon fotoğrafları yan dönmez.
import { useState } from 'preact/hooks';
import { download, getLib } from '../pdf.js';
import { canvasBytes, drawToCanvas, loadImage } from '../images.js';
import { fmtSize } from '../util.js';
import { Dropzone, ErrorLine, Radios, ResultBand } from '../ui/common.jsx';
import { ImageRows, useImageList } from '../ui/ImageRows.jsx';

const A4 = { w: 595.28, h: 841.89 };
const MARGINS = { m0: 0, m1: 18, m2: 36 };

// Saydamlık taşıyabilecek türler PNG, diğerleri (fotoğraf) JPEG olarak gömülür
const keepsAlpha = file => /png|gif|webp|svg|avif/i.test(file.type) || /\.(png|gif|webp|svg|avif)$/i.test(file.name);

// Sayfa ve resim yerleşimi (pt): fit = sayfa resme göre, a4 = resim A4'e sığar (resim yataysa sayfa da yatay)
export function layoutImage(width, height, size, margin) {
	if (size === 'fit') {
		const scale = A4.h / Math.max(width, height);
		const w = width * scale;
		const h = height * scale;
		return { page: [w + margin * 2, h + margin * 2], x: margin, y: margin, w, h };
	}
	const landscape = width > height;
	const page = landscape ? [A4.h, A4.w] : [A4.w, A4.h];
	const scale = Math.min((page[0] - margin * 2) / width, (page[1] - margin * 2) / height);
	const w = width * scale;
	const h = height * scale;
	return { page, x: (page[0] - w) / 2, y: (page[1] - h) / 2, w, h };
}

export function ImgToPdf({ t }) {
	const list = useImageList(t);
	const [size, setSize] = useState('a4');
	const [margin, setMargin] = useState('m1');
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const { items } = list;

	const run = async () => {
		setError('');
		try {
			const { PDFDocument } = await getLib();
			const doc = await PDFDocument.create();
			for (const [i, it] of items.entries()) {
				setBusy(t('busy.page', i + 1, items.length));
				const img = await loadImage(it.file);
				const alpha = keepsAlpha(it.file);
				const canvas = drawToCanvas(img, { maxSide: 4000, background: alpha ? null : '#ffffff' });
				const bytes = await canvasBytes(canvas, alpha ? 'image/png' : 'image/jpeg', 0.9);
				const embedded = alpha ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
				const lay = layoutImage(img.width, img.height, size, MARGINS[margin]);
				const page = doc.addPage(lay.page);
				page.drawImage(embedded, { x: lay.x, y: lay.y, width: lay.w, height: lay.h });
				img.close();
				canvas.width = 1;
				canvas.height = 1;
			}
			const bytes = await doc.save({ useObjectStreams: true });
			setResult({ bytes, pages: items.length });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy('');
		}
	};

	if (!items.length) {
		return (
			<div>
				<Dropzone t={t} many kind="image" onFiles={list.add} />
				<ErrorLine>{list.errors}</ErrorLine>
			</div>
		);
	}
	const edit = fn => (v) => { fn(v); setResult(null); };
	return (
		<div>
			<ImageRows t={t} items={items} setItems={list.setItems} onChange={() => setResult(null)} />
			<Dropzone t={t} many compact kind="image" onFiles={(f) => { setResult(null); list.add(f); }} />
			<div class="pdf-opts pdf-opts--spaced">
				<Radios name="pdf-i2p-size" legend={t('i2p.size')} value={size} onChange={edit(setSize)} options={[{ value: 'a4', label: t('i2p.a4') }, { value: 'fit', label: t('i2p.fit') }]} />
				<Radios name="pdf-i2p-margin" legend={t('i2p.margin')} value={margin} onChange={edit(setMargin)} options={[{ value: 'm0', label: t('i2p.m0') }, { value: 'm1', label: t('i2p.m1') }, { value: 'm2', label: t('i2p.m2') }]} />
			</div>
			<ErrorLine>{[...list.errors, error]}</ErrorLine>
			{result
				? <ResultBand t={t} meta={`${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`} onDownload={() => download(result.bytes, 'resimler.pdf', 'application/pdf')} onAgain={() => { list.clear(); setResult(null); }} />
				: (
					<div class="pdf-actions">
						<p class="pdf-actions-info" role="status">{busy || t('i2p.count', items.length)}</p>
						<button type="button" class="pdfb pdfb--primary" disabled={!!busy} onClick={run}>{busy ? t('busy') : t('i2p.go')}</button>
					</div>
				)}
		</div>
	);
}
