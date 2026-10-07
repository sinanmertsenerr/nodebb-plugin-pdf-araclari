// Metinden PDF: yazılan ya da açılan metni (TXT, MD) A4 PDF yapar. Kısa Markdown isteğe bağlı: # başlık, - madde, ---.
// Yazı Inter ile gömülür (Türkçe harfler dahil); uzun metin sayfalara bölünür, başlık sayfa sonunda yalnız kalmaz.
import { useEffect, useRef, useState } from 'preact/hooks';
import { download, getLib } from '../pdf.js';
import { loadFontSet } from '../fonts.js';
import { layoutText, parseBlocks } from '../textlayout.js';
import { fmtSize, safeName } from '../util.js';
import { Check, Radios, ResultPreview } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { useStepMark } from '../ui/steps.jsx';
import { Workspace } from '../ui/workspace.jsx';

const A4 = [595.28, 841.89];
const MARGINS = { m1: 42, m2: 64, m3: 85 };
const MAX_CHARS = 300000;
const INK = [0.12, 0.14, 0.16];

export async function buildTextPdf(text, opts, t) {
	const { PDFDocument, rgb } = await getLib();
	const doc = await PDFDocument.create();
	const fonts = await loadFontSet(doc);
	const [w, h] = opts.orient === 'land' ? [A4[1], A4[0]] : A4;
	const margin = MARGINS[opts.margin];
	const { pages } = layoutText(parseBlocks(text, opts.md), {
		pageW: w,
		pageH: h,
		margin,
		size: opts.size,
		measure: (s, sz, bold) => fonts.width(s, sz, bold),
		wrap: (s, max, sz, bold) => fonts.wrap(s, max, sz, bold),
		bottomReserve: opts.numbers ? 14 : 0,
	});
	const ink = rgb(...INK);
	pages.forEach((items, i) => {
		const page = doc.addPage([w, h]);
		items.forEach((it) => {
			if (it.type === 'rule') page.drawLine({ start: { x: it.x1, y: it.y }, end: { x: it.x2, y: it.y }, thickness: 0.75, color: rgb(0.74, 0.77, 0.8) });
			else if (it.text.trim()) fonts.draw(page, it.text, { x: it.x, y: it.y, size: it.size, bold: it.bold, color: ink });
		});
		if (opts.numbers) {
			const label = t('pn.wordOf', i + 1, pages.length);
			fonts.draw(page, label, { x: (w - fonts.width(label, 9)) / 2, y: margin / 2, size: 9, color: rgb(0.4, 0.43, 0.46) });
		}
	});
	const title = titleOf(text);
	if (title) doc.setTitle(title);
	return { bytes: await doc.save({ useObjectStreams: true }), pages: pages.length };
}

// İlk dolu satır (Markdown işaretleri olmadan): dosya adı ve belge başlığı
function titleOf(text) {
	const line = String(text).split('\n').map(l => l.replace(/^#+\s*|[*_`]/g, '').trim()).find(Boolean) || '';
	return line.slice(0, 60);
}

// Metin dosyası: önce UTF-8; geçersizse Türkçe Windows kodlaması (eski Not Defteri dosyaları)
async function readTextFile(file) {
	const buf = await file.arrayBuffer();
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
	} catch (err) {
		return new TextDecoder('windows-1254').decode(buf);
	}
}

export function TxtToPdf({ t }) {
	const [text, setText] = useState('');
	const [size, setSize] = useState('11');
	const [orient, setOrient] = useState('port');
	const [margin, setMargin] = useState('m2');
	const [md, setMd] = useState(true);
	const [numbers, setNumbers] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const [preview, setPreview] = useState(null);
	const picker = useRef(null);
	const empty = !text.trim();
	useStepMark('start', empty);

	const opts = { size: Number(size), orient, margin, md, numbers };
	const key = JSON.stringify(opts);

	// Canlı önizleme: yazmaya ara verince ilk sayfa ve sayfa sayısı güncellenir
	useEffect(() => {
		if (empty || text.length > MAX_CHARS) { setPreview(null); return undefined; }
		let dead = false;
		const id = setTimeout(() => {
			buildTextPdf(text, opts, t).then((out) => { if (!dead) setPreview(out); }).catch(() => {});
		}, 600);
		return () => { dead = true; clearTimeout(id); };
	}, [text, key]);

	const edit = fn => (v) => { fn(v); setResult(null); };
	const run = async () => {
		if (empty) { setError(t('txt.need')); return; }
		if (text.length > MAX_CHARS) { setError(t('txt.big')); return; }
		setBusy(true);
		setError('');
		try {
			setResult(await buildTextPdf(text, opts, t));
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};
	const open = async (file) => {
		if (!file) return;
		if (file.size > 4 * 1024 * 1024) { setError(t('txt.big')); return; }
		setError('');
		setResult(null);
		setText(await readTextFile(file));
	};

	const paper = (
		<div class="pdf-textpaper pdf-textpaper--edit">
			<label class="pdf-visually-hidden" for="pdf-txt-area">{t('txt.label')}</label>
			<textarea id="pdf-txt-area" class="pdf-textpaper-area" value={text} placeholder={t('txt.ph')} spellcheck={true} onInput={e => edit(setText)(e.currentTarget.value)} />
		</div>
	);

	return (
		<Workspace
			t={t}
			canvas={paper}
			action={{ label: t('txt.go'), onClick: run, busy, info: preview ? t('pages', preview.pages) : '' }}
			result={result && { meta: `${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(titleOf(text) || t('txt.file'))}.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain: () => { setText(''); setResult(null); } }}
			error={error}
		>
			<div class="pdf-field">
				<button type="button" class="pdfb pdfb--secondary pdfb--block" onClick={() => picker.current && picker.current.click()}><Icon name="upload" size={18} />{t('txt.open')}</button>
				<input ref={picker} class="pdf-visually-hidden" type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" tabIndex={-1} aria-label={t('txt.open')} onChange={(e) => { open(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
			</div>
			<Radios name="pdf-txt-size" legend={t('txt.size')} value={size} onChange={edit(setSize)} options={['10', '11', '12', '14'].map(v => ({ value: v, label: `${v} pt` }))} />
			<Radios name="pdf-txt-orient" legend={t('txt.page')} value={orient} onChange={edit(setOrient)} options={[{ value: 'port', label: t('txt.port') }, { value: 'land', label: t('txt.land') }]} />
			<Radios name="pdf-txt-margin" legend={t('i2p.margin')} value={margin} onChange={edit(setMargin)} options={[{ value: 'm1', label: t('txt.m1') }, { value: 'm2', label: t('i2p.m2') }, { value: 'm3', label: t('txt.m3') }]} />
			<Check checked={md} onChange={edit(setMd)} label={t('txt.md')} />
			<Check checked={numbers} onChange={edit(setNumbers)} label={t('txt.numbers')} />
			{preview ? <ResultPreview bytes={preview.bytes} t={t} max={1} /> : null}
		</Workspace>
	);
}
