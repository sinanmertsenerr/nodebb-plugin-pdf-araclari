// PDF'ten resim: seçilen sayfaları PNG ya da JPG yapar. Tek sayfa tek resim, çok sayfa ZIP olur.
import { useState } from 'preact/hooks';
import { download, renderToCanvas } from '../pdf.js';
import { FORMATS, canvasBytes } from '../images.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { zip } from '../zip.js';
import { ErrorLine, Radios, ResultBand, useSinglePdf } from '../ui/common.jsx';
import { PageSelector } from '../ui/PageSelector.jsx';
import { SingleGate } from './gate.jsx';

const SIZES = { s1: 100, s2: 150, s3: 220 };

function PdfToImgTool({ t, opened, file, onAgain }) {
	const total = opened.pages;
	const [picked, setPicked] = useState(() => new Set(Array.from({ length: total }, (_, i) => i + 1)));
	const [invalid, setInvalid] = useState(false);
	const [format, setFormat] = useState('png');
	const [size, setSize] = useState('s2');
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const chosen = [...picked].sort((a, b) => a - b);
	const edit = fn => (v) => { fn(v); setResult(null); };

	const run = async () => {
		setError('');
		try {
			const fmt = FORMATS[format];
			const name = safeName(baseName(file.name));
			const width = String(total).length;
			const files = [];
			for (const [i, n] of chosen.entries()) {
				setBusy(t('busy.page', i + 1, chosen.length));
				const canvas = await renderToCanvas(opened.doc, n, { dpi: SIZES[size], background: '#ffffff' });
				files.push({ name: `${name}-sayfa-${String(n).padStart(width, '0')}.${fmt.ext}`, data: await canvasBytes(canvas, fmt.type, 0.92) });
				canvas.width = 1;
				canvas.height = 1;
			}
			if (files.length === 1) {
				setResult({ bytes: files[0].data, name: files[0].name, type: fmt.type, meta: fmtSize(files[0].data.length) });
			} else {
				const bytes = zip(files);
				setResult({ bytes, name: `${name}-resimler.zip`, type: 'application/zip', meta: `${files.length} ${format.toUpperCase()} · ${fmtSize(bytes.length)}` });
			}
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy('');
		}
	};

	return (
		<div>
			<PageSelector t={t} doc={opened.doc} total={total} picked={picked} onChange={(set) => { setPicked(set); setResult(null); }} onInvalid={setInvalid} id="pdf-p2i-range" />
			<ErrorLine>{error}</ErrorLine>
			{result
				? <ResultBand t={t} meta={result.meta} onDownload={() => download(result.bytes, result.name, result.type)} onAgain={onAgain} />
				: (
					<div class="pdf-actions">
						<Radios name="pdf-p2i-format" legend={t('p2i.format')} value={format} onChange={edit(setFormat)} options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }]} />
						<Radios name="pdf-p2i-size" legend={t('p2i.size')} value={size} onChange={edit(setSize)} options={[{ value: 's1', label: `${t('p2i.s1')} · ${SIZES.s1} dpi` }, { value: 's2', label: `${t('p2i.s2')} · ${SIZES.s2} dpi` }, { value: 's3', label: `${t('p2i.s3')} · ${SIZES.s3} dpi` }]} />
						<span class="pdf-actions-info" role="status">{busy}</span>
						<button type="button" class="pdfb pdfb--primary" disabled={!chosen.length || !!busy || invalid} onClick={run}>{busy ? t('busy') : t('p2i.go')}</button>
					</div>
				)}
		</div>
	);
}

export function PdfToImg({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <PdfToImgTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
