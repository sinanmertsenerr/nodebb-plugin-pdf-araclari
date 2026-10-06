// Küçült: "Metni koru" PDF'i yeniden yazar; diğer iki seviye sayfaları JPEG'e çevirip yeniden kurar (taranmış dosyada çok etkili).
import { useState } from 'preact/hooks';
import { download, getLib, loadClean } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { ErrorLine, ResultBand, useSinglePdf } from '../ui/common.jsx';
import { SingleGate } from './gate.jsx';

const LEVELS = {
	keep: { name: 'cmp.keep', hint: 'cmp.keepD' },
	mid: { name: 'cmp.mid', hint: 'cmp.midD', dpi: 130, quality: 0.72 },
	max: { name: 'cmp.max', hint: 'cmp.maxD', dpi: 96, quality: 0.55 },
};
const MAX_SIDE = 2600;

const toBlob = (canvas, quality) => new Promise((resolve, reject) => {
	canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality);
});

async function rasterize(opened, level, onPage) {
	const { PDFDocument } = await getLib();
	const out = await PDFDocument.create();
	const canvas = document.createElement('canvas');
	for (let n = 1; n <= opened.pages; n += 1) {
		onPage(n);
		const page = await opened.doc.getPage(n);
		const base = page.getViewport({ scale: 1 });
		const scale = Math.min(level.dpi / 72, MAX_SIDE / Math.max(base.width, base.height));
		const viewport = page.getViewport({ scale });
		canvas.width = Math.max(1, Math.round(viewport.width));
		canvas.height = Math.max(1, Math.round(viewport.height));
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		await page.render({ canvas, canvasContext: ctx, viewport }).promise;
		page.cleanup();
		const jpg = new Uint8Array(await (await toBlob(canvas, level.quality)).arrayBuffer());
		const image = await out.embedJpg(jpg);
		const sheet = out.addPage([base.width, base.height]);
		sheet.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
	}
	canvas.width = 1;
	canvas.height = 1;
	return out.save({ useObjectStreams: true });
}

function CompressTool({ t, opened, file, onAgain }) {
	const [level, setLevel] = useState('keep');
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const before = file.size;

	const run = async () => {
		setBusy(t('busy'));
		setError('');
		try {
			let bytes;
			if (level === 'keep') {
				bytes = await (await loadClean(opened)).save({ useObjectStreams: true });
			} else {
				bytes = await rasterize(opened, LEVELS[level], n => setBusy(t('busy.page', n, opened.pages)));
			}
			// Küçülmediyse özgün dosya verilir: dosyayı büyütmek kimsenin işine yaramaz
			const smaller = bytes.length < before;
			setResult({ bytes: smaller ? bytes : opened.bytes, after: smaller ? bytes.length : before, smaller });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy('');
		}
	};

	const pick = (key) => { setLevel(key); setResult(null); };
	const saved = result ? Math.round((1 - result.after / before) * 100) : 0;

	return (
		<div>
			<p class="pdf-fileinfo"><strong>{file.name}</strong> · {t('pages', opened.pages)} · {fmtSize(before)}</p>
			<fieldset class="pdf-levels">
				<legend class="pdf-label">{t('cmp.level')}</legend>
				{Object.entries(LEVELS).map(([key, lv]) => (
					<label key={key} class={`pdf-level${level === key ? ' is-on' : ''}`}>
						<input type="radio" name="pdf-cmp-level" checked={level === key} onChange={() => pick(key)} />
						<span class="pdf-level-name">{t(lv.name)}</span>
						<span class="pdf-level-hint">{t(lv.hint)}</span>
					</label>
				))}
			</fieldset>
			<ErrorLine>{error}</ErrorLine>
			{result
				? (
					<ResultBand t={t} title={result.smaller ? t('cmp.saved', saved) : t('cmp.same')} meta={`${t('cmp.before')} ${fmtSize(before)} → ${t('cmp.after')} ${fmtSize(result.after)}`}
						onDownload={() => download(result.bytes, result.smaller ? `${safeName(baseName(file.name))}-kucuk.pdf` : safeName(file.name), 'application/pdf')} onAgain={onAgain} />
				)
				: (
					<div class="pdf-actions">
						<p class="pdf-actions-info" role="status">{busy || ''}</p>
						<button type="button" class="pdfb pdfb--primary" disabled={!!busy} onClick={run}>{busy ? t('busy') : t('cmp.go')}</button>
					</div>
				)}
		</div>
	);
}

export function Compress({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <CompressTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
