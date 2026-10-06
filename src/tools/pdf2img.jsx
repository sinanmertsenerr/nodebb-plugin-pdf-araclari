// PDF'ten resim: seçilen sayfaları PNG ya da JPG yapar. Tek sayfa tek resim, çok sayfa ZIP olur.
import { useState } from 'preact/hooks';
import { download, renderToCanvas } from '../pdf.js';
import { FORMATS, canvasBytes } from '../images.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { zip } from '../zip.js';
import { Radios, useSinglePdf } from '../ui/common.jsx';
import { PageGrid, RangeControls, usePagePick } from '../ui/PageSelector.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

const SIZES = { s1: 100, s2: 150, s3: 220 };

function PdfToImgTool({ t, opened, file, onAgain }) {
	const total = opened.pages;
	const [format, setFormat] = useState('png');
	const [size, setSize] = useState('s2');
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const pick = usePagePick(total, new Set(Array.from({ length: total }, (_, i) => i + 1)), () => setResult(null));
	const { chosen } = pick;
	const edit = fn => (v) => { fn(v); setResult(null); };

	const run = async () => {
		if (pick.bad) return;
		if (!chosen.length) { setError(t('split.need')); return; }
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
		<Workspace
			t={t} file={file.name} meta={`${t('pages', total)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={<PageGrid t={t} doc={opened.doc} pick={pick} />}
			action={{ label: t('p2i.go'), onClick: run, busy }}
			result={result && { meta: result.meta, onDownload: () => download(result.bytes, result.name, result.type), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<RangeControls t={t} pick={pick} id="pdf-p2i-range" />
			<Radios name="pdf-p2i-format" legend={t('p2i.format')} value={format} onChange={edit(setFormat)} options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }]} />
			<Radios name="pdf-p2i-size" legend={t('p2i.size')} value={size} onChange={edit(setSize)} cards options={[
				{ value: 's1', label: t('p2i.s1'), hint: `${SIZES.s1} dpi` },
				{ value: 's2', label: t('p2i.s2'), hint: `${SIZES.s2} dpi` },
				{ value: 's3', label: t('p2i.s3'), hint: `${SIZES.s3} dpi` },
			]} />
		</Workspace>
	);
}

export function PdfToImg({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <PdfToImgTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
