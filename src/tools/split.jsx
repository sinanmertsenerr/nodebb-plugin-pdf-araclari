// Böl: sayfaları küçük resimlerden ya da aralıkla seç; tek PDF ya da her sayfa ayrı dosya (ZIP) olarak al.
import { useState } from 'preact/hooks';
import { download, getLib, loadForEdit } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { zip } from '../zip.js';
import { Radios, useSinglePdf } from '../ui/common.jsx';
import { PageGrid, RangeControls, usePagePick } from '../ui/PageSelector.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

function SplitTool({ t, opened, file, onAgain }) {
	const total = opened.pages;
	const [mode, setMode] = useState('one');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const pick = usePagePick(total, new Set(), () => setResult(null));
	const { chosen } = pick;

	const run = async () => {
		if (pick.bad) return;
		if (!chosen.length) { setError(t('split.need')); return; }
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
		<Workspace
			t={t} file={file.name} meta={`${t('pages', total)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={<PageGrid t={t} doc={opened.doc} pick={pick} />}
			action={{ label: t('split.go'), onClick: run, busy, info: chosen.length ? t('split.count', chosen.length, total) : '' }}
			result={result && { meta: result.meta, onDownload: () => download(result.bytes, result.name, result.kind === 'zip' ? 'application/zip' : 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<RangeControls t={t} pick={pick} id="pdf-split-range" />
			<Radios name="pdf-split-mode" legend={t('split.mode')} value={mode} onChange={(v) => { setMode(v); setResult(null); }} cards options={[{ value: 'one', label: t('split.one'), hint: t('split.oneD') }, { value: 'each', label: t('split.each'), hint: t('split.eachD') }]} />
		</Workspace>
	);
}

export function Split({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <SplitTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
