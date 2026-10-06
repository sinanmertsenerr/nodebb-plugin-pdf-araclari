// Küçült: "Metni koru" PDF'i yeniden yazar; diğer iki seviye sayfaları JPEG'e çevirip yeniden kurar (taranmış dosyada çok etkili).
import { useState } from 'preact/hooks';
import { download, getLib, loadClean } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Radios, usePageSize, useSinglePdf } from '../ui/common.jsx';
import { PagePaper, Workspace, fitPage } from '../ui/workspace.jsx';
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
	const frame = usePageSize(opened.doc, 1);
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

	const saved = result ? Math.round((1 - result.after / before) * 100) : 0;
	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(before)}`} onChangeFile={onAgain}
			canvas={box => <PagePaper doc={opened.doc} page={1} width={fitPage(box, frame)} caption={t('pages', opened.pages)} />}
			action={{ label: t('cmp.go'), onClick: run, busy }}
			result={result && {
				title: result.smaller ? t('cmp.saved', saved) : t('cmp.same'),
				meta: `${fmtSize(before)} → ${fmtSize(result.after)}`,
				onDownload: () => download(result.bytes, result.smaller ? `${safeName(baseName(file.name))}-kucuk.pdf` : safeName(file.name), 'application/pdf'),
				onEdit: () => setResult(null),
				onAgain,
			}}
			error={error}
		>
			<Radios name="pdf-cmp-level" legend={t('cmp.level')} value={level} onChange={(v) => { setLevel(v); setResult(null); }} cards
				options={Object.entries(LEVELS).map(([key, lv]) => ({ value: key, label: t(lv.name), hint: t(lv.hint) }))} />
		</Workspace>
	);
}

export function Compress({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <CompressTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
