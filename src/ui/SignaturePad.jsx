// İmza penceresi: çizerek, adını yazarak ya da imzanın fotoğrafını yükleyerek. Sonuç saydam zeminli PNG'dir.
// İstenirse imza bu cihazda hatırlanır (yalnızca bu tarayıcıda, açık onayla).
import { useEffect, useRef, useState } from 'preact/hooks';
import { canvasBytes, isImageFile, loadImage } from '../images.js';
import { Icon } from './icons.jsx';
import { Check } from './common.jsx';

const STORE = 'pdf-araclari:signature:v1';
const INKS = ['#111827', '#1d4ed8'];
const SCRIPT_FONTS = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", "URW Chancery L", cursive';

// Saydam olmayan pikselleri çevreleyen kutuya kırpar; boşsa null
function trim(canvas, pad = 6) {
	const ctx = canvas.getContext('2d');
	const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (data[(y * width + x) * 4 + 3] > 8) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	}
	if (x1 < 0) return null;
	x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
	x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
	const out = document.createElement('canvas');
	out.width = x1 - x0 + 1;
	out.height = y1 - y0 + 1;
	out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
	return out;
}

// İmza fotoğrafı: açık renkli zemin saydam olur, mürekkep kalır
function clearPaper(canvas) {
	const ctx = canvas.getContext('2d');
	const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
		if (y > 185) d[i + 3] = 0;
		else if (y > 140) d[i + 3] = Math.round(d[i + 3] * (185 - y) / 45);
	}
	ctx.putImageData(img, 0, 0);
}

async function finish(canvas) {
	const trimmed = trim(canvas);
	if (!trimmed) return null;
	const bytes = await canvasBytes(trimmed, 'image/png');
	return { bytes, url: trimmed.toDataURL('image/png'), w: trimmed.width, h: trimmed.height };
}

export function savedSignature() {
	try {
		const raw = localStorage.getItem(STORE);
		if (!raw) return null;
		const sig = JSON.parse(raw);
		sig.bytes = Uint8Array.from(atob(sig.url.split(',')[1]), c => c.charCodeAt(0));
		return sig;
	} catch (err) {
		return null;
	}
}

export function SignaturePad({ t, onDone, onCancel }) {
	const [mode, setMode] = useState('draw');
	const [ink, setInk] = useState(INKS[0]);
	const [name, setName] = useState('');
	const [upload, setUpload] = useState(null);
	const [empty, setEmpty] = useState(true);
	const [remember, setRemember] = useState(false);
	const [error, setError] = useState('');
	const pad = useRef(null);
	const box = useRef(null);
	const drawing = useRef(null);

	useEffect(() => {
		const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
		document.addEventListener('keydown', onKey);
		if (box.current) box.current.focus();
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	// Çizim alanı ekran yoğunluğuna göre ölçeklenir: çizgi keskin kalır
	useEffect(() => {
		if (mode !== 'draw' || !pad.current) return;
		const c = pad.current;
		const ratio = Math.min(window.devicePixelRatio || 1, 3);
		c.width = Math.round(c.clientWidth * ratio);
		c.height = Math.round(c.clientHeight * ratio);
		const ctx = c.getContext('2d');
		ctx.scale(ratio, ratio);
		setEmpty(true);
	}, [mode]);

	const point = (e) => {
		const r = pad.current.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	};
	const down = (e) => {
		e.preventDefault();
		pad.current.setPointerCapture(e.pointerId);
		const p = point(e);
		drawing.current = { last: p, mid: p };
		const ctx = pad.current.getContext('2d');
		ctx.fillStyle = ink;
		ctx.beginPath();
		ctx.arc(p[0], p[1], 1.4, 0, Math.PI * 2);
		ctx.fill();
		setEmpty(false);
	};
	const move = (e) => {
		if (!drawing.current) return;
		const p = point(e);
		const { last, mid } = drawing.current;
		const nextMid = [(last[0] + p[0]) / 2, (last[1] + p[1]) / 2];
		const ctx = pad.current.getContext('2d');
		ctx.strokeStyle = ink;
		ctx.lineWidth = 2.6;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(mid[0], mid[1]);
		ctx.quadraticCurveTo(last[0], last[1], nextMid[0], nextMid[1]);
		ctx.stroke();
		drawing.current = { last: p, mid: nextMid };
	};
	const up = () => { drawing.current = null; };
	const clear = () => {
		const c = pad.current;
		c.getContext('2d').clearRect(0, 0, c.width, c.height);
		setEmpty(true);
	};

	const pickPhoto = async (file) => {
		if (!file || !isImageFile(file)) { setError(t('sig.badImage')); return; }
		try {
			const img = await loadImage(file);
			const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
			const c = document.createElement('canvas');
			c.width = Math.round(img.width * scale);
			c.height = Math.round(img.height * scale);
			c.getContext('2d').drawImage(img.source, 0, 0, c.width, c.height);
			img.close();
			clearPaper(c);
			setUpload(await finish(c));
			setError('');
		} catch (err) {
			setError(t('sig.badImage'));
		}
	};

	const add = async () => {
		let sig = null;
		if (mode === 'draw') {
			if (empty) { setError(t('sig.drawFirst')); return; }
			sig = await finish(pad.current);
		} else if (mode === 'type') {
			if (!name.trim()) { setError(t('sig.typeFirst')); return; }
			const c = document.createElement('canvas');
			c.width = 1400;
			c.height = 320;
			const ctx = c.getContext('2d');
			ctx.fillStyle = ink;
			ctx.font = `120px ${SCRIPT_FONTS}`;
			ctx.textBaseline = 'middle';
			ctx.fillText(name.trim(), 40, 170, 1320);
			sig = await finish(c);
		} else {
			if (!upload) { setError(t('sig.uploadFirst')); return; }
			sig = upload;
		}
		if (!sig) { setError(t('sig.drawFirst')); return; }
		try {
			if (remember) localStorage.setItem(STORE, JSON.stringify({ url: sig.url, w: sig.w, h: sig.h }));
		} catch (err) { /* yer yoksa hatırlanmaz */ }
		onDone(sig);
	};

	return (
		<div class="pdf-modal" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
			<div class="pdf-modal-box" role="dialog" aria-modal="true" aria-labelledby="pdf-sig-title" tabIndex={-1} ref={box}>
				<div class="pdf-modal-head">
					<h3 class="pdf-modal-title" id="pdf-sig-title">{t('sig.title')}</h3>
					<button type="button" class="pdfb pdfb--icon" aria-label={t('cancel')} onClick={onCancel}><Icon name="x" size={18} /></button>
				</div>
				<fieldset class="pdf-radios">
					<legend class="pdf-visually-hidden">{t('sig.how')}</legend>
					<div class="pdf-seg">
						{['draw', 'type', 'upload'].map(m => (
							<label key={m} class="pdf-radio">
								<input type="radio" name="pdf-sig-mode" checked={mode === m} onChange={() => { setMode(m); setError(''); }} />
								<span>{t(`sig.${m}`)}</span>
							</label>
						))}
					</div>
				</fieldset>
				{mode === 'draw' ? (
					<div class="pdf-sigpad">
						<canvas ref={pad} class="pdf-sigpad-canvas" aria-label={t('sig.drawHere')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
						{empty ? <span class="pdf-sigpad-hint" aria-hidden="true">{t('sig.drawHere')}</span> : null}
						<button type="button" class="pdf-link pdf-sigpad-clear" onClick={clear}>{t('sig.clear')}</button>
					</div>
				) : null}
				{mode === 'type' ? (
					<div class="pdf-field">
						<label class="pdf-label" for="pdf-sig-name">{t('sig.name')}</label>
						<input id="pdf-sig-name" class="pdf-input" value={name} autocomplete="name" onInput={e => setName(e.currentTarget.value)} />
						<div class="pdf-sigtype" style={{ fontFamily: SCRIPT_FONTS, color: ink }} aria-hidden="true">{name || t('sig.namePh')}</div>
					</div>
				) : null}
				{mode === 'upload' ? (
					<div class="pdf-field">
						<label class="pdfb pdfb--secondary pdfb--block">
							<Icon name="upload" size={18} />{t('sig.pick')}
							<input class="pdf-visually-hidden" type="file" accept="image/*" onChange={(e) => { pickPhoto(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
						</label>
						<p class="pdf-field-hint">{t('sig.uploadHint')}</p>
						{upload ? <img class="pdf-sigupload" src={upload.url} alt={t('sig.preview')} /> : null}
					</div>
				) : null}
				{mode !== 'upload' ? (
					<fieldset class="pdf-swatches">
						<legend class="pdf-label">{t('wm.color')}</legend>
						<div class="pdf-swatch-row">
							{INKS.map((c, i) => (
								<label key={c} class={`pdf-swatch${ink === c ? ' is-on' : ''}`} title={t(i ? 'wm.blue' : 'wm.black')}>
									<input type="radio" name="pdf-sig-ink" checked={ink === c} onChange={() => setInk(c)} />
									<span class="pdf-swatch-dot" style={{ backgroundColor: c }} />
									<span class="pdf-visually-hidden">{t(i ? 'wm.blue' : 'wm.black')}</span>
								</label>
							))}
						</div>
					</fieldset>
				) : null}
				<Check checked={remember} onChange={setRemember} label={t('sig.remember')} />
				{error ? <p class="pdf-field-error" role="alert">{error}</p> : null}
				<div class="pdf-modal-foot">
					<button type="button" class="pdfb pdfb--secondary" onClick={onCancel}>{t('cancel')}</button>
					<button type="button" class="pdfb pdfb--primary" onClick={add}>{t('sig.add')}</button>
				</div>
			</div>
		</div>
	);
}
