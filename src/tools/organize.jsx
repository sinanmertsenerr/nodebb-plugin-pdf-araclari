// Sırala: sayfaları sürükle ya da oklarla taşı, çevir, sil; yeni sırayla kaydet.
import { useState } from 'preact/hooks';
import { download, getLib, loadForEdit } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Thumb, moveItem, useDragReorder, useSinglePdf } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

function OrganizeTool({ t, opened, file, onAgain }) {
	const [pages, setPages] = useState(() => Array.from({ length: opened.pages }, (_, i) => ({ n: i + 1, rot: 0, del: false })));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	const edit = (fn) => { setResult(null); setPages(fn); };
	const move = (from, to) => edit(list => moveItem(list, from, to));
	const patch = (i, change) => edit(list => list.map((p, k) => (k === i ? { ...p, ...change } : p)));
	const drag = useDragReorder(move);
	const kept = pages.filter(p => !p.del);
	const removed = pages.length - kept.length;
	const changed = removed > 0 || pages.some((p, i) => p.rot || p.n !== i + 1);

	const run = async () => {
		if (!kept.length) { setError(t('org.need')); return; }
		setBusy(true);
		setError('');
		try {
			const { PDFDocument, degrees } = await getLib();
			const src = await loadForEdit(opened);
			const out = await PDFDocument.create();
			const copied = await out.copyPages(src, kept.map(p => p.n - 1));
			copied.forEach((page, i) => {
				const turn = (page.getRotation().angle + kept[i].rot) % 360;
				page.setRotation(degrees((turn + 360) % 360));
				out.addPage(page);
			});
			const bytes = await out.save({ useObjectStreams: true });
			setResult({ bytes, pages: kept.length });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	const grid = (
		<ul class="pdf-grid pdf-grid--canvas pdf-grid--org">
			{pages.map((p, i) => (
				<li key={p.n} class={`pdf-org${p.del ? ' is-deleted' : ''}${drag.over === i ? ' is-target' : ''}`} {...drag.bind(i)}>
					<div class="pdf-org-page">
						<span class="pdf-org-box"><Thumb doc={opened.doc} page={p.n} width={132} rotate={p.rot} /></span>
						<span class="pdf-tile-label">{p.n}</span>
					</div>
					<div class="pdf-org-tools">
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('org.left')}: ${p.n}`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="left" size={16} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('org.rotL')}: ${p.n}`} onClick={() => patch(i, { rot: (p.rot + 270) % 360 })}><Icon name="rotate-ccw" size={16} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('org.rotR')}: ${p.n}`} onClick={() => patch(i, { rot: (p.rot + 90) % 360 })}><Icon name="rotate-cw" size={16} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t(p.del ? 'org.undel' : 'org.del')}: ${p.n}`} aria-pressed={p.del} onClick={() => patch(i, { del: !p.del })}><Icon name={p.del ? 'undo' : 'trash'} size={16} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('org.right')}: ${p.n}`} disabled={i === pages.length - 1} onClick={() => move(i, i + 1)}><Icon name="right" size={16} /></button>
					</div>
				</li>
			))}
		</ul>
	);

	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={grid}
			action={{ label: t('org.go'), onClick: run, busy, info: kept.length ? (removed ? t('org.removed', removed) : t('pages', kept.length)) : t('org.need') }}
			result={result && { meta: `${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-siralanmis.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<p class="pdf-hint">{t('org.hint')}</p>
			<ul class="pdf-legend">
				<li><Icon name="left" size={16} /><Icon name="right" size={16} />{t('org.legendMove')}</li>
				<li><Icon name="rotate-ccw" size={16} /><Icon name="rotate-cw" size={16} />{t('org.legendTurn')}</li>
				<li><Icon name="trash" size={16} />{t('org.legendDel')}</li>
			</ul>
			{changed ? <button type="button" class="pdf-link pdf-link--start" onClick={() => edit(() => Array.from({ length: opened.pages }, (_, i) => ({ n: i + 1, rot: 0, del: false })))}>{t('org.reset')}</button> : null}
		</Workspace>
	);
}

export function Organize({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <OrganizeTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
