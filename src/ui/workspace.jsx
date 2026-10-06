// Araç çalışma alanı: solda belge (gri zemin üstünde büyük önizleme), sağda ayar paneli, ana düğme panelin tabanında.
// Yaygın PDF araçlarındaki düzen: kişi neyi değiştirdiğini önizlemede görür, düğmeyi her araçta aynı yerde bulur.
import { useEffect, useRef, useState } from 'preact/hooks';
import { notify } from '../notify.js';
import { Icon } from './icons.jsx';
import { useStepMark } from './steps.jsx';
import { ErrorLine } from './common.jsx';

// Kutunun iç genişliği (önizlemeyi alana sığdırmak için)
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

// canvas: öğe ya da (genişlik) => öğe. action: { label, onClick, busy, info }. result: { title, meta, onDownload, onEdit, onAgain }
export function Workspace({ t, file, meta, onChangeFile, canvas, children, action, result, error }) {
	const area = useRef(null);
	const width = useWidth(area);
	return (
		<div class="pdf-ws">
			<div class="pdf-ws-canvas">
				<div class="pdf-ws-canvas-in" ref={area}>{typeof canvas === 'function' ? canvas(width) : canvas}</div>
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
					{result ? <ResultBlock t={t} {...result} /> : <ActionBlock t={t} {...action} />}
				</div>
			</aside>
		</div>
	);
}

function ActionBlock({ t, label, onClick, busy, info }) {
	return (
		<>
			{info ? <p class="pdf-ws-info" role="status">{info}</p> : null}
			<button type="button" class="pdfb pdfb--primary pdfb--block" disabled={!!busy} aria-busy={busy ? 'true' : undefined} onClick={onClick}>
				{busy ? <span class="pdf-yu-spinner pdf-yu-spinner--sm" aria-hidden="true" /> : null}
				{busy ? (typeof busy === 'string' ? busy : t('busy')) : label}
			</button>
		</>
	);
}

// İş bitince: başarı başlığı, İndir (ana düğme), ayarları değiştirmeye dönme ve yeni dosya
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

// Önizlemedeki kâğıt: sayfa küçük resmi + üstüne yerleşen katman. width: görünen genişlik (px)
export function fitWidth(areaWidth, pageRatio, maxHeight) {
	const byWidth = Math.min(areaWidth, 720);
	if (!pageRatio || !maxHeight) return Math.max(200, Math.round(byWidth));
	return Math.max(200, Math.round(Math.min(byWidth, maxHeight / pageRatio)));
}
