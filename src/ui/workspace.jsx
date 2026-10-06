// Araç çalışma alanı: solda belge (gri zemin üstünde büyük önizleme), sağda ayar paneli, ana düğme panelin tabanında.
// Yaygın PDF araçlarındaki düzen: kişi neyi değiştirdiğini önizlemede görür, düğmeyi her araçta aynı yerde bulur.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { notify } from '../notify.js';
import { Icon } from './icons.jsx';
import { useStepMark } from './steps.jsx';
import { ErrorLine, Thumb } from './common.jsx';

// Kutunun iç genişliği (ana ekranın sütun sayısı için)
export function useWidth(ref, fallback = 560) {
	const [width, setWidth] = useState(fallback);
	useEffect(() => {
		if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
		const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
		ro.observe(ref.current);
		return () => ro.disconnect();
	}, []);
	return width;
}

const PAD = 56; // önizleme alanının iç boşluğu (iki yan)

// Önizleme alanının kullanılabilir ölçüsü. Telefonda alan içeriğe göre uzadığı için yükseklik ekrandan alınır.
function useCanvasBox(ref) {
	const [box, setBox] = useState({ w: 560, h: 640 });
	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === 'undefined') return undefined;
		const measure = () => {
			const wide = window.matchMedia('(min-width: 992px)').matches;
			setBox({ w: Math.max(200, el.clientWidth - (wide ? PAD : 32)), h: Math.max(240, (wide ? el.clientHeight : window.innerHeight * 0.55) - (wide ? PAD : 32)) });
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);
	return box;
}

// Sayfayı alana sığdıran genişlik: hem eni hem boyu sığar. frame: görünen sayfa ölçüsü (pt) ya da henüz yoksa null
export function fitPage(box, frame, max = 720) {
	if (!frame) return Math.min(box.w, 460);
	const byHeight = box.h / (frame.h / frame.w);
	return Math.max(200, Math.round(Math.min(box.w, max, byHeight)));
}

// canvas: öğe ya da (box) => öğe. action: { label, onClick, busy, info }. result: { title, meta, onDownload, onEdit, onAgain }
export function Workspace({ t, file, meta, onChangeFile, canvas, children, action, result, error }) {
	const root = useRef(null);
	const area = useRef(null);
	const box = useCanvasBox(area);

	// Alan ekranın kalanını doldurur: kutunun sayfadaki üst kenarı ölçülür (CSS --pdf-ws-top)
	useLayoutEffect(() => {
		const set = () => {
			if (!root.current) return;
			const top = root.current.getBoundingClientRect().top + window.scrollY;
			root.current.style.setProperty('--pdf-ws-top', `${Math.max(0, Math.round(top))}px`);
		};
		set();
		window.addEventListener('resize', set);
		return () => window.removeEventListener('resize', set);
	}, []);

	return (
		<div class="pdf-ws" ref={root}>
			<div class="pdf-ws-canvas" ref={area}>
				<div class="pdf-ws-canvas-in">{typeof canvas === 'function' ? canvas(box) : canvas}</div>
			</div>
			<aside class="pdf-ws-panel" aria-label={t('ws.panel')}>
				{file ? (
					<div class="pdf-ws-file">
						<span class="pdf-ws-file-ico" aria-hidden="true"><Icon name="file-text" size={20} /></span>
						<span class="pdf-ws-file-text">
							<strong class="pdf-ws-file-name" title={file}>{file}</strong>
							{meta ? <span class="pdf-ws-file-meta">{meta}</span> : null}
						</span>
						{onChangeFile ? <button type="button" class="pdf-link" onClick={onChangeFile}>{t('ws.change')}</button> : null}
					</div>
				) : null}
				<div class="pdf-ws-body">{children}</div>
				<div class="pdf-ws-foot">
					<ErrorLine>{error}</ErrorLine>
					{result ? <ResultBlock t={t} {...result} /> : (action ? <ActionBlock t={t} {...action} /> : null)}
				</div>
			</aside>
		</div>
	);
}

function ActionBlock({ t, label, onClick, busy, info, icon }) {
	return (
		<>
			{info ? <p class="pdf-ws-info" role="status">{info}</p> : null}
			<button type="button" class="pdfb pdfb--primary pdfb--block" disabled={!!busy} aria-busy={busy ? 'true' : undefined} onClick={onClick}>
				{busy ? <span class="pdf-yu-spinner pdf-yu-spinner--sm" aria-hidden="true" /> : (icon ? <Icon name={icon} size={18} /> : null)}
				{busy ? (typeof busy === 'string' ? busy : t('busy')) : label}
			</button>
		</>
	);
}

// İş bitince: başarı başlığı, İndir (ana düğme), ayarlara dönme ve yeni dosya
function ResultBlock({ t, title, meta, onDownload, onEdit, onAgain }) {
	const ref = useRef(null);
	const heading = title || t('res.ready');
	useStepMark('done');
	useEffect(() => {
		if (ref.current) ref.current.focus();
		notify({ type: 'success', title: heading, message: meta || '' });
	}, []);
	return (
		<div class="pdf-ws-done" role="status">
			<p class="pdf-ws-done-title" tabIndex={-1} ref={ref}><Icon name="circle-check" size={20} />{heading}</p>
			{meta ? <p class="pdf-ws-done-meta">{meta}</p> : null}
			<button type="button" class="pdfb pdfb--primary pdfb--block" onClick={onDownload}><Icon name="download" size={18} />{t('res.download')}</button>
			<div class="pdf-ws-done-more">
				{onEdit ? <button type="button" class="pdfb pdfb--secondary" onClick={onEdit}>{t('res.edit')}</button> : null}
				<button type="button" class="pdfb pdfb--secondary" onClick={onAgain}>{t('res.again')}</button>
			</div>
		</div>
	);
}

// Gri zemin üstünde duran sayfa; üstüne yüzde konumlu önizleme katmanı (numara, filigran) yerleşir
export function PagePaper({ doc, page = 1, width, children, caption }) {
	return (
		<figure class="pdf-paper-wrap">
			<div class="pdf-paper">
				<Thumb doc={doc} page={page} width={width} rotate={0} />
				{children ? <div class="pdf-preview-layer" aria-hidden="true">{children}</div> : null}
			</div>
			{caption ? <figcaption class="pdf-paper-cap">{caption}</figcaption> : null}
		</figure>
	);
}
