// Birleştir: birkaç PDF'i seçilen sırayla tek PDF yapar.
import { useEffect, useRef, useState } from 'preact/hooks';
import { closePdf, isPdf, openPdf, loadForEdit, getLib, download } from '../pdf.js';
import { fmtSize } from '../util.js';
import { Dropzone, ErrorLine, PasswordPrompt, ResultBand, Thumb, moveItem, openError, uid, useDragReorder } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';

export function Merge({ t }) {
	const [items, setItems] = useState([]); // { id, file, opened } | { id, file, locked, wrong }
	const [error, setError] = useState([]);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);
	const live = useRef(items);
	live.current = items;

	useEffect(() => () => live.current.forEach(it => closePdf(it.opened)), []);

	const add = async (files) => {
		setError([]);
		setResult(null);
		const errors = [];
		for (const file of files) {
			if (!isPdf(file)) { errors.push(t('err.type', file.name)); continue; }
			try {
				const res = await openPdf(file);
				const id = uid();
				if (res.ok) setItems(list => [...list, { id, file, opened: res }]);
				else if (res.reason === 'password') setItems(list => [...list, { id, file, locked: true, wrong: false }]);
				else errors.push(openError(t, file.name, res.reason));
			} catch (err) {
				errors.push(openError(t, file.name, 'broken'));
			}
		}
		if (errors.length) setError(errors);
	};

	const unlock = async (item, password) => {
		let res;
		try {
			res = await openPdf(item.file, password);
		} catch (err) {
			res = { ok: false, reason: 'broken' };
		}
		if (!res.ok && res.reason !== 'wrong-password') {
			// Şifre doğru ama dosya açılamıyor (bozuk ya da düzenlemeye kapalı): satır kalkar, sebep yazılır
			setItems(list => list.filter(it => it.id !== item.id));
			setError([openError(t, item.file.name, res.reason)]);
			return;
		}
		setItems(list => list.map((it) => {
			if (it.id !== item.id) return it;
			return res.ok ? { id: it.id, file: it.file, opened: res } : { ...it, wrong: true };
		}));
	};

	const change = (fn) => { setResult(null); setItems(fn); };
	const remove = (id) => {
		const item = items.find(it => it.id === id);
		if (item) closePdf(item.opened);
		change(list => list.filter(it => it.id !== id));
	};
	const move = (from, to) => change(list => moveItem(list, from, to));
	const drag = useDragReorder(move);

	const ready = items.filter(it => it.opened);
	const pages = ready.reduce((n, it) => n + it.opened.pages, 0);
	const canGo = ready.length >= 2 && ready.length === items.length && !busy;

	const run = async () => {
		setBusy(true);
		setError('');
		try {
			const { PDFDocument } = await getLib();
			const out = await PDFDocument.create();
			for (const it of ready) {
				const src = await loadForEdit(it.opened);
				const copied = await out.copyPages(src, src.getPageIndices());
				copied.forEach(p => out.addPage(p));
			}
			const bytes = await out.save({ useObjectStreams: true });
			setResult({ bytes, pages: out.getPageCount() });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	if (!items.length) {
		return (
			<div>
				<Dropzone t={t} many onFiles={add} />
				<ErrorLine>{error}</ErrorLine>
			</div>
		);
	}
	return (
		<div>
			<ol class="pdf-files">
				{items.map((it, i) => (
					<li key={it.id} class={`pdf-file${drag.over === i ? ' is-target' : ''}`} {...drag.bind(i)} draggable={it.locked ? undefined : true}>
						<span class="pdf-file-grip" aria-hidden="true"><Icon name="grip" size={18} /></span>
						{it.opened
							? <Thumb doc={it.opened.doc} page={1} width={44} rotate={0} />
							: <span class="pdf-file-lock"><Icon name="lock" size={20} /></span>}
						<span class="pdf-file-main">
							<span class="pdf-file-name">{it.file.name}</span>
							<span class="pdf-file-meta">{it.opened ? `${t('pages', it.opened.pages)} · ${fmtSize(it.file.size)}` : fmtSize(it.file.size)}</span>
							{it.locked ? <PasswordPrompt t={t} inline name={it.file.name} wrong={it.wrong} onSubmit={pw => unlock(it, pw)} /> : null}
						</span>
						<span class="pdf-file-actions">
							<button type="button" class="pdfb pdfb--icon" aria-label={`${t('up')}: ${it.file.name}`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="up" size={18} /></button>
							<button type="button" class="pdfb pdfb--icon" aria-label={`${t('down')}: ${it.file.name}`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><Icon name="down" size={18} /></button>
							<button type="button" class="pdfb pdfb--icon" aria-label={`${t('remove')}: ${it.file.name}`} onClick={() => remove(it.id)}><Icon name="x" size={18} /></button>
						</span>
					</li>
				))}
			</ol>
			<Dropzone t={t} many compact onFiles={add} />
			<ErrorLine>{error}</ErrorLine>
			{result
				? <ResultBand t={t} meta={`${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`} onDownload={() => download(result.bytes, 'birlestirilmis.pdf', 'application/pdf')} onAgain={() => { items.forEach(it => closePdf(it.opened)); setItems([]); setResult(null); }} />
				: (
					<div class="pdf-actions">
						<p class="pdf-actions-info">{ready.length < 2 ? t('merge.need') : t('merge.total', ready.length, pages)}</p>
						<button type="button" class="pdfb pdfb--primary" disabled={!canGo} onClick={run}>{busy ? t('busy') : t('merge.go')}</button>
					</div>
				)}
		</div>
	);
}
