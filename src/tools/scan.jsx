// Tara: telefonla çekilen belge fotoğraflarını taranmış PDF'e çevirir. Kenarlar kendiliğinden bulunur, köşeler sürüklenerek
// düzeltilir; eğiklik giderilir, Belge / Gri / Siyah-beyaz filtreyle kâğıt beyazlar. Hepsi bu cihazda olur.
import { useEffect, useRef, useState } from 'preact/hooks';
import { download, getLib } from '../pdf.js';
import { canvasBytes, drawToCanvas, isImageFile, loadImage, MAX_IMAGE_MB } from '../images.js';
import { applyFilter, detectCorners, insetCorners, outputSize, rotate, warp } from '../scan.js';
import { fmtSize } from '../util.js';
import { Dropzone, Radios, moveItem, uid } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { Workspace } from '../ui/workspace.jsx';

const DISPLAY_SIDE = 1400;
const OUTPUT_SIDE = 2400;
const A4 = { w: 595.28, h: 841.89 };
const FILTERS = ['doc', 'gray', 'bw', 'original'];

const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
function toCanvas(img) {
	const c = document.createElement('canvas');
	c.width = img.width;
	c.height = img.height;
	c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
	return c;
}

// Kenar bulma küçük kopyada yapılır (≈320 px), sonuç asıl ölçüye büyütülür
function findCorners(disp, natural) {
	const small = drawToCanvas({ source: disp, width: disp.width, height: disp.height }, { maxSide: 320 });
	const found = detectCorners(pixels(small));
	if (!found) return null;
	const s = natural.w / small.width;
	return found.map(([x, y]) => [x * s, y * s]);
}

async function readPage(file) {
	const img = await loadImage(file);
	const natural = { w: img.width, h: img.height };
	const disp = drawToCanvas(img, { maxSide: DISPLAY_SIDE });
	img.close();
	const auto = findCorners(disp, natural);
	return { id: uid(), file, natural, disp, url: disp.toDataURL('image/jpeg', 0.85), corners: auto || insetCorners(natural.w, natural.h), auto: !!auto, rot: 0 };
}

// Bir sayfayı işler: kaynak kanvas (hangi ölçüde olursa) + köşeler (asıl ölçüde) -> düzeltilmiş, döndürülmüş, filtrelenmiş kanvas
function processCanvas(source, page, filter, maxSide) {
	const s = source.width / page.natural.w;
	const corners = page.corners.map(([x, y]) => [x * s, y * s]);
	const { w, h } = outputSize(corners, maxSide);
	let img = warp(pixels(source), corners, w, h);
	img = rotate(img, page.rot);
	applyFilter(img, filter);
	return toCanvas(img);
}

function Stage({ t, page, box, onCorners }) {
	const svg = useRef(null);
	const drag = useRef(null);
	const { w: nw, h: nh } = page.natural;
	const scale = Math.min(box.w / nw, (box.h - 120) / nh, 1.5);
	const dw = Math.max(200, Math.round(nw * scale));
	const dh = Math.round(nh * scale);
	const k = dw / nw;
	const c = page.corners;
	const point = (e) => {
		const r = svg.current.getBoundingClientRect();
		return [Math.max(0, Math.min(nw, (e.clientX - r.left) / k)), Math.max(0, Math.min(nh, (e.clientY - r.top) / k))];
	};
	const down = i => (e) => {
		e.preventDefault();
		e.stopPropagation();
		svg.current.setPointerCapture(e.pointerId);
		drag.current = i;
	};
	const move = (e) => {
		if (drag.current === null) return;
		const p = point(e);
		onCorners(c.map((q, i) => (i === drag.current ? p : q)), false);
	};
	const up = () => {
		if (drag.current !== null) onCorners(c, true);
		drag.current = null;
	};
	const quad = c.map(p => p.join(',')).join(' ');
	return (
		<div class="pdf-scan-stage" style={{ width: `${dw}px`, height: `${dh}px` }}>
			<img src={page.url} width={dw} height={dh} alt="" draggable={false} />
			<svg ref={svg} class="pdf-scan-layer" viewBox={`0 0 ${nw} ${nh}`} width={dw} height={dh} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="group" aria-label={t('scan.corners')}>
				<path d={`M0 0H${nw}V${nh}H0Z M${c[0].join(' ')} L${c[1].join(' ')} L${c[2].join(' ')} L${c[3].join(' ')} Z`} fill-rule="evenodd" class="pdf-scan-shade" />
				<polygon points={quad} class="pdf-scan-quad" stroke-width={2 / k} />
				{c.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={13 / k} class="pdf-scan-handle" stroke-width={2.5 / k} onPointerDown={down(i)} aria-label={t(`scan.corner${i}`)} />)}
			</svg>
		</div>
	);
}

export function Scan({ t }) {
	const [pages, setPages] = useState([]);
	const [current, setCurrent] = useState(0);
	const [view, setView] = useState('corners');
	const [filter, setFilter] = useState('doc');
	const [size, setSize] = useState('a4');
	const [preview, setPreview] = useState(null);
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState('');
	const [error, setError] = useState([]);
	const [result, setResult] = useState(null);
	const page = pages[current] || null;
	const changed = () => setResult(null);

	const add = async (files) => {
		const first = pages.length;
		setAdding(true);
		const bad = [];
		const added = [];
		for (const file of files) {
			if (!isImageFile(file)) { bad.push(t('err.imgtype', file.name)); continue; }
			try {
				added.push(await readPage(file));
			} catch (err) {
				bad.push(err.message === 'big' ? t('err.imgbig', file.name, MAX_IMAGE_MB) : t('err.image', file.name));
			}
		}
		setPages(list => [...list, ...added]);
		if (added.length) setCurrent(first);
		setError(bad);
		setAdding(false);
		changed();
	};

	const patch = (change) => { setPages(list => list.map((p, i) => (i === current ? { ...p, ...change } : p))); changed(); };
	const remove = () => {
		setPages(list => list.filter((p, i) => i !== current));
		setCurrent(i => Math.max(0, i - 1));
		changed();
	};

	// Sonuç görünümü: o sayfanın işlenmiş hâli (ekran çözünürlüğünde)
	useEffect(() => {
		if (view !== 'result' || !page) { setPreview(null); return undefined; }
		let dead = false;
		const id = setTimeout(() => {
			try {
				const out = processCanvas(page.disp, page, filter, 1200);
				if (!dead) setPreview(out.toDataURL('image/jpeg', 0.85));
			} catch (err) { /* önizleme olmazsa köşeler görünümü kalır */ }
		}, 60);
		return () => { dead = true; clearTimeout(id); };
	}, [view, page, filter]);

	const run = async () => {
		if (!pages.length) return;
		setError([]);
		try {
			const { PDFDocument } = await getLib();
			const doc = await PDFDocument.create();
			for (const [i, p] of pages.entries()) {
				setBusy(t('busy.page', i + 1, pages.length));
				const img = await loadImage(p.file);
				const source = drawToCanvas(img, { maxSide: OUTPUT_SIDE });
				img.close();
				const out = processCanvas(source, p, filter, 2200);
				source.width = 1;
				const jpg = await doc.embedJpg(await canvasBytes(out, 'image/jpeg', filter === 'bw' ? 0.8 : 0.85));
				let pw; let ph; let x = 0; let y = 0; let w; let h;
				if (size === 'a4') {
					const land = out.width > out.height;
					[pw, ph] = land ? [A4.h, A4.w] : [A4.w, A4.h];
					const s = Math.min(pw / out.width, ph / out.height);
					w = out.width * s;
					h = out.height * s;
					x = (pw - w) / 2;
					y = (ph - h) / 2;
				} else {
					// Resme göre: 200 dpi kabul edilir
					pw = (out.width * 72) / 200;
					ph = (out.height * 72) / 200;
					w = pw;
					h = ph;
				}
				doc.addPage([pw, ph]).drawImage(jpg, { x, y, width: w, height: h });
				out.width = 1;
				await new Promise(r => setTimeout(r, 0)); // arayüz nefes alsın
			}
			const bytes = await doc.save({ useObjectStreams: true });
			setResult({ bytes, pages: pages.length });
		} catch (err) {
			setError([t('err.fail')]);
		} finally {
			setBusy('');
		}
	};

	if (!pages.length) {
		return (
			<div>
				<Dropzone t={t} many kind="image" onFiles={add} />
				{adding ? <p class="pdf-status" role="status">{t('loading')}</p> : null}
				{error.length ? <div class="pdf-error" role="alert">{error.map(e => <span key={e} class="pdf-error-line">{e}</span>)}</div> : null}
			</div>
		);
	}

	const canvas = box => (
		<div class="pdf-scan">
			{view === 'result' && preview
				? <div class="pdf-paper pdf-scan-result"><img src={preview} alt={t('scan.resultOf', current + 1)} style={{ maxWidth: `${box.w}px`, maxHeight: `${box.h - 120}px` }} /></div>
				: <Stage t={t} page={page} box={box} onCorners={(c, done) => { patch({ corners: c, auto: done ? false : page.auto }); }} />}
			<ol class="pdf-scan-strip" aria-label={t('scan.pages')}>
				{pages.map((p, i) => (
					<li key={p.id}>
						<button type="button" class={`pdf-scan-thumb${i === current ? ' is-current' : ''}`} aria-current={i === current ? 'true' : undefined} aria-label={t('scan.pageN', i + 1)} onClick={() => setCurrent(i)}>
							<img src={p.url} alt="" style={{ transform: `rotate(${p.rot}deg)` }} draggable={false} />
							<span class="pdf-tile-label">{i + 1}</span>
						</button>
					</li>
				))}
				<li><Dropzone t={t} many compact kind="image" onFiles={add} /></li>
			</ol>
		</div>
	);

	return (
		<Workspace
			t={t}
			canvas={canvas}
			action={{ label: t('scan.go'), onClick: run, busy: busy || (adding ? t('loading') : ''), info: t('pages', pages.length) }}
			result={result && { title: t('scan.done'), meta: `${t('pages', result.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, 'tarama.pdf', 'application/pdf'), onEdit: () => setResult(null), onAgain: () => { setPages([]); setCurrent(0); setResult(null); } }}
			error={error}
		>
			<Radios name="pdf-scan-view" legend={t('scan.view')} value={view} onChange={setView} options={[{ value: 'corners', label: t('scan.corners') }, { value: 'result', label: t('scan.result') }]} />
			<div class="pdf-field">
				<span class="pdf-label">{t('scan.page', current + 1, pages.length)}</span>
				<div class="pdf-ed-row">
					<button type="button" class="pdfb pdfb--secondary" onClick={() => { const c = findCorners(page.disp, page.natural); patch({ corners: c || insetCorners(page.natural.w, page.natural.h), auto: !!c }); if (!c) setError([t('scan.noEdges')]); else setError([]); }}><Icon name="scan" size={18} />{t('scan.auto')}</button>
					<button type="button" class="pdfb pdfb--secondary" onClick={() => patch({ corners: insetCorners(page.natural.w, page.natural.h, 0), auto: false })}><Icon name="image" size={18} />{t('scan.whole')}</button>
					<button type="button" class="pdfb pdfb--secondary" onClick={() => patch({ rot: (page.rot + 270) % 360 })}><Icon name="rotate-ccw" size={18} />{t('org.rotL')}</button>
					<button type="button" class="pdfb pdfb--secondary" onClick={() => patch({ rot: (page.rot + 90) % 360 })}><Icon name="rotate-cw" size={18} />{t('org.rotR')}</button>
				</div>
				<p class="pdf-field-hint">{page.auto ? t('scan.found') : t('scan.drag')}</p>
			</div>
			<Radios name="pdf-scan-filter" legend={t('scan.filter')} value={filter} onChange={(v) => { setFilter(v); changed(); }} options={FILTERS.map(f => ({ value: f, label: t(`scan.f.${f}`) }))} />
			<Radios name="pdf-scan-size" legend={t('i2p.size')} value={size} onChange={(v) => { setSize(v); changed(); }} options={[{ value: 'a4', label: t('i2p.a4') }, { value: 'fit', label: t('i2p.fit') }]} />
			<div class="pdf-ed-row">
				<button type="button" class="pdfb pdfb--secondary" disabled={current === 0} onClick={() => { setPages(list => moveItem(list, current, current - 1)); setCurrent(current - 1); changed(); }}><Icon name="left" size={18} />{t('org.left')}</button>
				<button type="button" class="pdfb pdfb--secondary" disabled={current === pages.length - 1} onClick={() => { setPages(list => moveItem(list, current, current + 1)); setCurrent(current + 1); changed(); }}>{t('org.right')}<Icon name="right" size={18} /></button>
			</div>
			<button type="button" class="pdfb pdfb--danger pdfb--block" onClick={remove}><Icon name="trash" size={18} />{t('scan.remove')}</button>
		</Workspace>
	);
}
