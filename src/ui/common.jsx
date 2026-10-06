// Araçların ortak parçaları: bırakma alanı, sayfa küçük resmi, sonuç bandı, şifre sorusu, tek dosya akışı.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { closePdf, getPdfjs, isPdf, openPdf, renderPage, MAX_MB } from '../pdf.js';
import { notify } from '../notify.js';
import { Icon } from './icons.jsx';

let nextId = 1;
export const uid = () => `f${nextId++}`;

// Dosya seçilir ya da sürüklenir. kind: 'pdf' (varsayılan) ya da 'image'; yalnızca o türün dosyaları geçer
const KINDS = {
	pdf: { accept: 'application/pdf,.pdf', many: 'drop.many', one: 'drop.one', pick: 'drop.pick', add: 'add' },
	image: { accept: 'image/*', many: 'drop.images', one: 'drop.image', pick: 'drop.pickImage', add: 'add.image' },
};

export function Dropzone({ t, many, onFiles, compact, kind = 'pdf', capture }) {
	const input = useRef(null);
	const [over, setOver] = useState(false);
	const k = KINDS[kind];
	const take = (list) => {
		const files = Array.from(list || []);
		if (files.length) onFiles(many ? files : files.slice(0, 1));
	};
	return (
		<div
			class={`pdf-drop${over ? ' is-over' : ''}${compact ? ' pdf-drop--compact' : ''}`}
			onDragOver={(e) => { e.preventDefault(); setOver(true); }}
			onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
			onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer && e.dataTransfer.files); }}
		>
			{!compact && <Icon name={kind === 'image' ? 'image' : 'upload'} size={32} />}
			{compact && !over ? null : <p class="pdf-drop-title">{over ? t('drop.over') : t(many ? k.many : k.one)}</p>}
			<button type="button" class={compact ? 'pdfb pdfb--secondary' : 'pdfb pdfb--primary'} onClick={() => input.current && input.current.click()}>
				{compact ? <Icon name="plus" size={18} /> : null}{compact ? t(k.add) : t(k.pick)}
			</button>
			<input ref={input} class="pdf-visually-hidden" type="file" accept={k.accept} capture={capture} multiple={many} tabIndex={-1} aria-label={t(k.pick)}
				onChange={(e) => { take(e.currentTarget.files); e.currentTarget.value = ''; }} />
			{!compact && <p class="pdf-privacy"><Icon name="lock" size={16} />{t('drop.privacy')}</p>}
		</div>
	);
}

// Sayfa küçük resmi: ekrana yaklaşınca çizilir, çizimler sırayla yapılır
export function Thumb({ doc, page, width, rotate }) {
	const canvas = useRef(null);
	const box = useRef(null);
	const [ratio, setRatio] = useState(1.414);
	const [state, setState] = useState('wait');
	useEffect(() => {
		let dead = false;
		const draw = () => {
			setState('busy');
			renderPage(doc, page, canvas.current, width).then((size) => {
				if (dead) return;
				setRatio(size.height / size.width);
				setState('ready');
			}).catch(() => { if (!dead) setState('error'); });
		};
		if (typeof IntersectionObserver === 'undefined') { draw(); return () => { dead = true; }; }
		const io = new IntersectionObserver((entries) => {
			if (entries.some(en => en.isIntersecting)) { io.disconnect(); draw(); }
		}, { rootMargin: '200px' });
		io.observe(box.current);
		return () => { dead = true; io.disconnect(); };
	}, [doc, page, width]);
	const turned = ((rotate % 360) + 360) % 360;
	const sideways = turned === 90 || turned === 270;
	return (
		<span class={`pdf-thumb is-${state}`} ref={box} style={{ width: `${width}px`, height: `${Math.round(width * (sideways ? 1 / ratio : ratio))}px` }}>
			<canvas ref={canvas} style={{ width: `${width}px`, height: `${Math.round(width * ratio)}px`, transform: turned ? `translate(-50%, -50%) rotate(${turned}deg)${sideways ? ` scale(${(1 / ratio).toFixed(4)})` : ''}` : 'translate(-50%, -50%)' }} />
		</span>
	);
}

export function ErrorLine({ children }) {
	const lines = [].concat(children || []).filter(Boolean);
	if (!lines.length) return null;
	return (
		<div class="pdf-error" role="alert">
			<Icon name="alert" size={18} />
			<span>{lines.map((line, i) => <span class="pdf-error-line" key={i}>{line}</span>)}</span>
		</div>
	);
}

// İş bitince: alt çubuk "İndir"e döner (ana düğmeyle aynı yerde); başarı bildirimi forumun uyarısı gibi sağ altta çıkar
export function ResultBand({ t, title, meta, onDownload, onAgain, children }) {
	const ref = useRef(null);
	const heading = title || t('res.ready');
	useEffect(() => {
		if (ref.current) ref.current.focus();
		notify({ type: 'success', title: heading, message: meta || '' });
	}, []);
	return (
		<div class="pdf-actions pdf-actions--done" role="status">
			<div class="pdf-result-actions">
				<button type="button" class="pdfb pdfb--primary" onClick={onDownload}><Icon name="download" size={18} />{t('res.download')}</button>
				<button type="button" class="pdfb pdfb--secondary" onClick={onAgain}>{t('res.again')}</button>
			</div>
			<div class="pdf-done">
				<p class="pdf-result-title" tabIndex={-1} ref={ref}><Icon name="circle-check" size={20} />{heading}</p>
				{meta ? <p class="pdf-result-meta">{meta}</p> : null}
				{children}
			</div>
		</div>
	);
}

// Şifreli dosya: şifre sorulur; yanlışsa açıkça söylenir
export function PasswordPrompt({ t, name, wrong, onSubmit, inline }) {
	const [value, setValue] = useState('');
	const id = useRef(uid());
	return (
		<form class="pdf-password" onSubmit={(e) => { e.preventDefault(); if (value) onSubmit(value); }}>
			{inline ? null : <p class="pdf-password-title"><Icon name="lock" size={18} />{t('pw.locked', name)}</p>}
			<div class="pdf-password-row">
				<label class="pdf-label" for={id.current}>{t('pw.label')}</label>
				<input id={id.current} class="pdf-input" type="password" autocomplete="off" data-bwignore data-1p-ignore data-lpignore="true" value={value} aria-invalid={wrong ? 'true' : undefined} aria-describedby={wrong ? `${id.current}-e` : undefined} onInput={e => setValue(e.currentTarget.value)} />
				<button type="submit" class="pdfb pdfb--secondary" disabled={!value}>{t('pw.open')}</button>
			</div>
			{wrong ? <p class="pdf-field-error" id={`${id.current}-e`}>{t('pw.wrong')}</p> : null}
		</form>
	);
}

// Dosya açma hatalarının metni
export function openError(t, name, reason) {
	if (reason === 'big') return t('err.big', name, MAX_MB);
	if (reason === 'restricted') return t('err.restricted', name);
	return t('err.broken', name);
}

// Tek PDF alan araçlar için: seç, aç, şifre sor, sıfırla
export function useSinglePdf(t) {
	const [state, setState] = useState(null); // { file, opened } | { file, locked, wrong }
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const current = useRef(null);
	current.current = state;

	const destroy = useCallback((s) => { if (s) closePdf(s.opened); }, []);

	const run = useCallback(async (file, password) => {
		setLoading(true);
		setError('');
		try {
			const res = await openPdf(file, password);
			if (res.ok) {
				destroy(current.current);
				setState({ file, opened: res });
			} else if (res.reason === 'password' || res.reason === 'wrong-password') {
				setState({ file, locked: true, wrong: res.reason === 'wrong-password' });
			} else {
				setError(openError(t, file.name, res.reason));
			}
		} catch (err) {
			setError(openError(t, file.name, 'broken'));
		} finally {
			setLoading(false);
		}
	}, [t, destroy]);

	const pick = useCallback((files) => {
		const file = files[0];
		if (!file) return;
		if (!isPdf(file)) { setError(t('err.type', file.name)); return; }
		run(file);
	}, [run, t]);

	useEffect(() => () => destroy(current.current), [destroy]);

	return {
		state,
		loading,
		error,
		setError,
		pick,
		unlock: password => state && run(state.file, password),
		reset: () => { destroy(current.current); setState(null); setError(''); },
	};
}

// Sürükle-bırak ve ok düğmeleriyle yeniden sıralama için küçük yardımcı
export function moveItem(list, from, to) {
	if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
	const copy = list.slice();
	const [item] = copy.splice(from, 1);
	copy.splice(to, 0, item);
	return copy;
}

export function useDragReorder(onMove) {
	const from = useRef(-1);
	const [over, setOver] = useState(-1);
	return {
		over,
		bind: index => ({
			draggable: true,
			onDragStart: (e) => { from.current = index; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); } },
			onDragOver: (e) => { if (from.current >= 0) { e.preventDefault(); setOver(index); } },
			onDragEnd: () => { from.current = -1; setOver(-1); },
			onDrop: (e) => { e.preventDefault(); if (from.current >= 0) onMove(from.current, index); from.current = -1; setOver(-1); },
		}),
	};
}

// ---------- Form parçaları ----------

// Etiketli alan: etiket üstte, hata altta
export function Field({ id, label, error, hint, children, wide }) {
	return (
		<div class={`pdf-field${wide ? ' pdf-field--wide' : ''}`}>
			<label class="pdf-label" for={id}>{label}</label>
			{children}
			{hint && !error ? <p class="pdf-field-hint">{hint}</p> : null}
			{error ? <p class="pdf-field-error" id={`${id}-e`}>{error}</p> : null}
		</div>
	);
}

// Seçenek grubu (radyo): options = [{ value, label, hint? }]
export function Radios({ name, legend, value, options, onChange, cards }) {
	return (
		<fieldset class={cards ? 'pdf-levels' : 'pdf-radios'}>
			<legend class="pdf-label">{legend}</legend>
			{options.map(o => (
				<label key={o.value} class={cards ? `pdf-level${value === o.value ? ' is-on' : ''}` : 'pdf-radio'}>
					<input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
					<span class={cards ? 'pdf-level-name' : undefined}>{o.label}</span>
					{cards && o.hint ? <span class="pdf-level-hint">{o.hint}</span> : null}
				</label>
			))}
		</fieldset>
	);
}

export function Check({ checked, onChange, label, disabled }) {
	return (
		<label class="pdf-check">
			<input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.currentTarget.checked)} />
			<span>{label}</span>
		</label>
	);
}

// Kaydırıcı: değer yanında yazılır
export function Slider({ id, label, min, max, step = 1, value, onChange, format }) {
	return (
		<div class="pdf-field">
			<label class="pdf-label" for={id}>{label}: <strong>{format ? format(value) : value}</strong></label>
			<input id={id} class="pdf-range" type="range" min={min} max={max} step={step} value={value} onInput={e => onChange(Number(e.currentTarget.value))} />
		</div>
	);
}

// Renk seçimi: küçük örnekler. colors = [{ value: '#hex', label }]
export function Swatches({ legend, colors, value, onChange }) {
	return (
		<fieldset class="pdf-swatches">
			<legend class="pdf-label">{legend}</legend>
			<div class="pdf-swatch-row">
				{colors.map(c => (
					<label key={c.value} class={`pdf-swatch${value === c.value ? ' is-on' : ''}`} title={c.label}>
						<input type="radio" name={`sw-${legend}`} checked={value === c.value} onChange={() => onChange(c.value)} />
						<span class="pdf-swatch-dot" style={{ backgroundColor: c.value }} />
						<span class="pdf-visually-hidden">{c.label}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

// Sayfa küçük resmi + üstüne yerleşen önizleme katmanı (yüzde konumlu çocuklar)
export function PagePreview({ doc, page = 1, width = 260, children, label }) {
	return (
		<figure class="pdf-preview">
			<div class="pdf-preview-page">
				<Thumb doc={doc} page={page} width={width} rotate={0} />
				<div class="pdf-preview-layer" aria-hidden="true">{children}</div>
			</div>
			{label ? <figcaption>{label}</figcaption> : null}
		</figure>
	);
}

// Üretilen PDF'in ilk sayfaları: indirmeden önce sonuca bakılır
export function ResultPreview({ bytes, t, max = 4 }) {
	const [doc, setDoc] = useState(null);
	useEffect(() => {
		let dead = false;
		let task = null;
		getPdfjs().then(({ getDocument }) => {
			task = getDocument({ data: bytes.slice(), isEvalSupported: false });
			return task.promise;
		}).then((d) => { if (!dead) setDoc(d); }).catch(() => {});
		return () => { dead = true; if (task) { try { task.destroy(); } catch (e) { /* kapanmışsa önemli değil */ } } };
	}, [bytes]);
	if (!doc) return null;
	const shown = Math.min(doc.numPages, max);
	return (
		<section class="pdf-result-preview" aria-label={t('preview')}>
			<h3 class="pdf-subtitle">{t('preview')}</h3>
			<ul class="pdf-grid pdf-grid--preview">
				{Array.from({ length: shown }, (_, i) => i + 1).map(n => (
					<li key={n}>
						<Thumb doc={doc} page={n} width={150} rotate={0} />
						<span class="pdf-tile-label">{n}</span>
					</li>
				))}
			</ul>
			{doc.numPages > shown ? <p class="pdf-hint">{t('preview.more', doc.numPages - shown)}</p> : null}
		</section>
	);
}
