// Böl: sayfaları küçük resimlerden ya da aralıkla seç; tek PDF ya da her sayfa ayrı dosya (ZIP) olarak al.
import { useState } from 'preact/hooks';
import { download, getLib, loadForEdit } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { zip } from '../zip.js';
import { ErrorLine, Radios, ResultBand, useSinglePdf } from '../ui/common.jsx';
import { PageSelector } from '../ui/PageSelector.jsx';
import { SingleGate } from './gate.jsx';

function SplitTool({ t, opened, file, onAgain }) {
	const total = opened.pages;
	const [picked, setPicked] = useState(() => new Set());
	const [invalid, setInvalid] = useState(false);
	const [mode, setMode] = useState('one');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const chosen = [...picked].sort((a, b) => a - b);

	const run = async () => {
		setBusy(true);
		setError('');
		try {
			const { PDFDocument } = await getLib();
			const src = await loadForEdit(opened);
			const name = safeName(baseName(file.name));
			if (mode === 'one') {
				const out = await PDFDocument.create();
				(await out.copyPages(src, chosen.map(n => n - 1))).forEach(p => out.addPage(p));
				const bytes = await out.save({ useObjectStreams: true });
				setResult({ kind: 'pdf', bytes, name: `${name}-secilen.pdf`, meta: `${t('pages', chosen.length)} · ${fmtSize(bytes.length)}` });
			} else {
				const files = [];
				for (const n of chosen) {
					const out = await PDFDocument.create();
					const [page] = await out.copyPages(src, [n - 1]);
					out.addPage(page);
					files.push({ name: `${name}-sayfa-${String(n).padStart(String(total).length, '0')}.pdf`, data: await out.save({ useObjectStreams: true }) });
				}
				const bytes = zip(files);
				setResult({ kind: 'zip', bytes, name: `${name}-sayfalar.zip`, meta: `${chosen.length} PDF · ${fmtSize(bytes.length)}` });
			}
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div>
			<PageSelector t={t} doc={opened.doc} total={total} picked={picked} onChange={(set) => { setPicked(set); setResult(null); }} onInvalid={setInvalid} id="pdf-split-range" />
			<ErrorLine>{error}</ErrorLine>
			{result
				? <ResultBand t={t} meta={result.meta} onDownload={() => download(result.bytes, result.name, result.kind === 'zip' ? 'application/zip' : 'application/pdf')} onAgain={onAgain} />
				: (
					<div class="pdf-actions">
						<Radios name="pdf-split-mode" legend={t('split.mode')} value={mode} onChange={setMode} options={[{ value: 'one', label: t('split.one') }, { value: 'each', label: t('split.each') }]} />
						<button type="button" class="pdfb pdfb--primary" disabled={!chosen.length || busy || invalid} onClick={run}>{busy ? t('busy') : t('split.go')}</button>
					</div>
				)}
		</div>
	);
}

export function Split({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <SplitTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
