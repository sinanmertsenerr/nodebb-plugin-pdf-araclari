// Ödev kapağı: bilgileri doldur, kapak canlı önizlenir; istersen bir PDF'in başına eklenir. Bilgiler istenirse bu cihazda hatırlanır.
import { useEffect, useRef, useState } from 'preact/hooks';
import { download, getLib, isPdf, loadClean, openPdf, closePdf } from '../pdf.js';
import { canvasBytes, drawToCanvas, isImageFile, loadImage } from '../images.js';
import { loadFontSet } from '../fonts.js';
import { drawCover, formatDate } from '../cover.js';
import { hexToRgb } from '../stamp.js';
import { fmtSize, safeName } from '../util.js';
import { Check, Field, Radios, Swatches, openError } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { useStepMark } from '../ui/steps.jsx';
import { BytesPaper, Workspace, fitPage } from '../ui/workspace.jsx';

const STORE = 'pdf-araclari:cover:v1';
const LOGO_STORE = 'pdf-araclari:cover-logo:v1';
const COLORS = ['#111827', '#1e3a8a', '#7f1d1d', '#14532d'];
const COLOR_NAMES = ['wm.black', 'cover.navy', 'cover.maroon', 'cover.green'];
const A4 = { w: 595.28, h: 841.89 };
const today = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function loadSaved(t) {
	const base = { uni: t('cover.uniDefault'), faculty: '', dept: '', course: '', title: '', students: '', instructor: '', layout: 'center', color: COLORS[0] };
	try {
		const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
		return saved ? { ...base, ...saved, title: '' } : base;
	} catch (err) {
		return base;
	}
}

const toDataUrl = bytes => `data:image/png;base64,${btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))}`;
const fromDataUrl = url => Uint8Array.from(atob(url.split(',')[1] || ''), c => c.charCodeAt(0));

async function readLogo(file) {
	const img = await loadImage(file);
	const canvas = drawToCanvas(img, { maxSide: 600 });
	const bytes = await canvasBytes(canvas, 'image/png');
	img.close();
	return { bytes, url: toDataUrl(bytes) };
}

function savedLogo() {
	try {
		const url = localStorage.getItem(LOGO_STORE);
		return url ? { bytes: fromDataUrl(url), url } : null;
	} catch (err) {
		return null;
	}
}

async function buildCover(data, t, attached, logo) {
	const { PDFDocument, rgb } = await getLib();
	const doc = await PDFDocument.create();
	const fonts = await loadFontSet(doc);
	const page = doc.addPage([A4.w, A4.h]);
	let mark = null;
	if (logo) {
		const image = await doc.embedPng(logo.bytes);
		mark = { image, width: image.width, height: image.height };
	}
	drawCover(page, fonts, rgb, { ...data, date: formatDate(data.date, t.lang) }, { layout: data.layout, color: hexToRgb(data.color) }, { by: t('cover.by'), byMany: t('cover.byMany'), inst: t('cover.inst') }, mark);
	if (data.title) doc.setTitle(data.title);
	if (attached) {
		const src = await loadClean(attached.opened);
		(await doc.copyPages(src, src.getPageIndices())).forEach(p => doc.addPage(p));
	}
	return { bytes: await doc.save({ useObjectStreams: true }), pages: doc.getPageCount() };
}

export function Cover({ t }) {
	const [data, setData] = useState(() => ({ ...loadSaved(t), date: today() }));
	const [remember, setRemember] = useState(() => { try { return localStorage.getItem(STORE) !== null; } catch (e) { return false; } });
	const [attached, setAttached] = useState(null); // { file, opened }
	const [logo, setLogo] = useState(savedLogo); // { bytes, url }
	const logoPicker = useRef(null);
	const [preview, setPreview] = useState(null);
	const [busy, setBusy] = useState(false);
	const [touched, setTouched] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const picker = useRef(null);
	const live = useRef(attached);
	live.current = attached;
	const titleMissing = !data.title.trim();
	useStepMark('start', titleMissing);

	useEffect(() => () => { if (live.current) closePdf(live.current.opened); }, []);

	// Canlı önizleme (yalnızca kapak)
	useEffect(() => {
		let dead = false;
		const id = setTimeout(() => {
			buildCover({ ...data, title: data.title || t('cover.titlePh') }, t, null, logo).then((out) => { if (!dead) setPreview(out.bytes); }).catch(() => {});
		}, 350);
		return () => { dead = true; clearTimeout(id); };
	}, [JSON.stringify(data), logo]);

	// Hatırla açıksa bilgiler bu cihazda saklanır (başlık hariç: her ödevde değişir)
	useEffect(() => {
		try {
			if (remember) {
				const { title, date, ...keep } = data;
				localStorage.setItem(STORE, JSON.stringify(keep));
				if (logo && logo.url.length < 1500000) localStorage.setItem(LOGO_STORE, logo.url);
				else localStorage.removeItem(LOGO_STORE);
			} else {
				localStorage.removeItem(STORE);
				localStorage.removeItem(LOGO_STORE);
			}
		} catch (err) { /* gizli pencere ya da yer yok: saklanamaz, önemli değil */ }
	}, [remember, JSON.stringify(data), logo]);

	const pickLogo = async (file) => {
		if (!file) return;
		if (!isImageFile(file)) { setError(t('err.imgtype', file.name)); return; }
		try {
			setLogo(await readLogo(file));
			setError('');
			setResult(null);
		} catch (err) {
			setError(t('err.image', file.name));
		}
	};

	const set = key => (value) => { setData(d => ({ ...d, [key]: value })); setResult(null); };
	const input = (key, label, opts = {}) => (
		<Field id={`pdf-cv-${key}`} label={label} error={opts.error} hint={opts.hint}>
			{opts.multi
				? <textarea id={`pdf-cv-${key}`} class="pdf-input pdf-input--multi" rows={3} value={data[key]} aria-invalid={opts.error ? 'true' : undefined} aria-describedby={opts.error ? `pdf-cv-${key}-e` : undefined} onInput={e => set(key)(e.currentTarget.value)} />
				: <input id={`pdf-cv-${key}`} class="pdf-input" type={opts.type || 'text'} value={data[key]} autocomplete="off" aria-invalid={opts.error ? 'true' : undefined} aria-describedby={opts.error ? `pdf-cv-${key}-e` : undefined} onInput={e => set(key)(e.currentTarget.value)} />}
		</Field>
	);

	const attach = async (file) => {
		if (!file) return;
		if (!isPdf(file)) { setError(t('err.type', file.name)); return; }
		const res = await openPdf(file);
		if (!res.ok) { setError(res.reason === 'password' ? t('cover.locked', file.name) : openError(t, file.name, res.reason)); return; }
		if (attached) closePdf(attached.opened);
		setAttached({ file, opened: res });
		setError('');
		setResult(null);
	};

	const run = async () => {
		setTouched(true);
		if (titleMissing) { setError(t('cover.titleNeed')); return; }
		setBusy(true);
		setError('');
		try {
			setResult(await buildCover(data, t, attached, logo));
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Workspace
			t={t}
			canvas={box => <BytesPaper bytes={preview} width={fitPage(box, A4)} />}
			action={{ label: t('cover.go'), onClick: run, busy, info: attached ? t('cover.withFile', attached.file.name) : '' }}
			result={result && { title: t('cover.done'), meta: `${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(data.title) || t('cover.file')}.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain: () => { setData(d => ({ ...d, title: '', course: '' })); setResult(null); setTouched(false); } }}
			error={error}
		>
			{input('title', t('cover.title'), { error: touched && titleMissing ? t('cover.titleNeed') : '' })}
			{input('course', t('cover.course'), { hint: t('cover.courseHint') })}
			{input('students', t('cover.students'), { multi: true, hint: t('cover.studentsHint') })}
			{input('instructor', t('cover.instructor'))}
			{input('uni', t('cover.uni'))}
			{input('faculty', t('cover.faculty'))}
			{input('dept', t('cover.dept'))}
			{input('date', t('cover.date'), { type: 'date' })}
			<div class="pdf-field">
				<span class="pdf-label">{t('cover.logo')}</span>
				{logo
					? (
						<div class="pdf-attached">
							<img class="pdf-attached-logo" src={logo.url} alt="" />
							<span class="pdf-attached-name">{t('cover.logoOn')}</span>
							<button type="button" class="pdf-link" onClick={() => logoPicker.current && logoPicker.current.click()}>{t('ws.change')}</button>
							<button type="button" class="pdf-link" onClick={() => { setLogo(null); setResult(null); }}>{t('remove')}</button>
						</div>
					)
					: <button type="button" class="pdfb pdfb--secondary pdfb--block" onClick={() => logoPicker.current && logoPicker.current.click()}><Icon name="image-plus" size={18} />{t('cover.logoPick')}</button>}
				<input ref={logoPicker} class="pdf-visually-hidden" type="file" accept="image/*" tabIndex={-1} aria-label={t('cover.logoPick')} onChange={(e) => { pickLogo(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
			</div>
			<Radios name="pdf-cv-layout" legend={t('cover.layout')} value={data.layout} onChange={set('layout')} options={[{ value: 'center', label: t('cover.center') }, { value: 'left', label: t('cover.left') }]} />
			<Swatches legend={t('wm.color')} value={data.color} onChange={set('color')} colors={COLORS.map((c, i) => ({ value: c, label: t(COLOR_NAMES[i]) }))} />
			<div class="pdf-field">
				<span class="pdf-label">{t('cover.attach')}</span>
				{attached
					? (
						<div class="pdf-attached">
							<Icon name="file-text" size={18} />
							<span class="pdf-attached-name">{attached.file.name}</span>
							<button type="button" class="pdf-link" onClick={() => { closePdf(attached.opened); setAttached(null); setResult(null); }}>{t('remove')}</button>
						</div>
					)
					: <button type="button" class="pdfb pdfb--secondary pdfb--block" onClick={() => picker.current && picker.current.click()}><Icon name="plus" size={18} />{t('cover.attachPick')}</button>}
				<input ref={picker} class="pdf-visually-hidden" type="file" accept="application/pdf,.pdf" tabIndex={-1} aria-label={t('cover.attachPick')} onChange={(e) => { attach(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
			</div>
			<Check checked={remember} onChange={setRemember} label={t('cover.remember')} />
		</Workspace>
	);
}
