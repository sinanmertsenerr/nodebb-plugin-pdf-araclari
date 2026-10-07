// PDF düzenle ve İmzala'nın ortak düzenleyicisi: sayfalar solda (gri zeminde), araçlar ve özellikler sağ panelde.
// Eklenenler görünen sayfa ölçüsünde tutulur (pt, sol üstten, y aşağı); kaydederken sayfanın dönüklüğüne ve kırpma kutusuna göre
// gerçek koordinata çevrilip pdf-lib ile sayfaya çizilir (yazı Inter ile gömülür, Türkçe harfler dahil).
import { useEffect, useRef, useState } from 'preact/hooks';
import { download, getLib, loadClean } from '../pdf.js';
import { loadFontSet } from '../fonts.js';
import { hexToRgb, pageFrame, rectToPdf } from '../stamp.js';
import { canvasBytes, drawToCanvas, isImageFile, loadImage } from '../images.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Slider, Swatches, Thumb, uid } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { SignaturePad, savedSignature } from '../ui/SignaturePad.jsx';

const ICONS = { select: 'cursor', text: 'type', pen: 'pen', hl: 'highlighter', white: 'eraser', rect: 'square', image: 'image-plus', sign: 'signature', date: 'calendar' };
const ACTIONS = new Set(['image', 'sign', 'date']); // tıklayınca bir şey ekler, araç olarak seçili kalmaz
const COLORS = ['#111827', '#dc2626', '#1d4ed8', '#15803d', '#7c3aed'];
const COLOR_NAMES = ['wm.black', 'wm.red', 'wm.blue', 'cover.green', 'wm.violet'];
const HL = '#facc15';
const LINE = 1.25; // yazı satır yüksekliği / boyut
const ASC = 0.93; // ilk satırın taban çizgisi, kutunun üstünden (em)
const MAX_WIDTH = 820;

let measureCtx = null;
function textWidth(text, size) {
	if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
	measureCtx.font = `${size}px ${getComputedStyle(document.body).fontFamily || 'Inter, sans-serif'}`;
	return measureCtx.measureText(text).width;
}

export function bbox(a) {
	if (a.type === 'pen') {
		const xs = a.points.map(p => p[0]);
		const ys = a.points.map(p => p[1]);
		const pad = a.size / 2;
		return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + a.size, h: Math.max(...ys) - Math.min(...ys) + a.size };
	}
	if (a.type === 'text') {
		const lines = (a.text || ' ').split('\n');
		const w = Math.max(a.size, ...lines.map(l => textWidth(l || ' ', a.size)));
		return { x: a.x, y: a.y, w, h: lines.length * a.size * LINE };
	}
	return { x: a.x, y: a.y, w: a.w, h: a.h };
}

const inside = (b, p, tol) => p[0] >= b.x - tol && p[0] <= b.x + b.w + tol && p[1] >= b.y - tol && p[1] <= b.y + b.h + tol;
const resizable = a => a.type !== 'pen';
const today = (lang) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

// Görünen sayfadaki bir eklenti (SVG, birim pt)
function Ann({ a, hidden }) {
	if (hidden) return null;
	if (a.type === 'text') {
		return (
			<text x={a.x} y={a.y + a.size * ASC} font-size={a.size} fill={a.color} class="pdf-ed-svgtext">
				{(a.text || '').split('\n').map((line, i) => <tspan key={i} x={a.x} dy={i ? a.size * LINE : 0}>{line || ' '}</tspan>)}
			</text>
		);
	}
	if (a.type === 'pen') return <polyline points={a.points.map(p => p.join(',')).join(' ')} fill="none" stroke={a.color} stroke-width={a.size} stroke-linecap="round" stroke-linejoin="round" />;
	if (a.type === 'hl') return <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={HL} fill-opacity=".38" style={{ mixBlendMode: 'multiply' }} />;
	if (a.type === 'white') return <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="#ffffff" />;
	if (a.type === 'rect') return <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="none" stroke={a.color} stroke-width={a.size} />;
	if (a.type === 'img') return <image href={a.src} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="none" />;
	return null;
}

// Eklentileri pdf-lib belgesine çizer
async function bake(opened, list) {
	const { rgb, degrees, BlendMode, LineCapStyle } = await getLib();
	const doc = await loadClean(opened);
	const fonts = list.some(a => a.type === 'text') ? await loadFontSet(doc) : null;
	const images = new Map();
	for (const a of list) {
		const page = doc.getPage(a.page - 1);
		const f = pageFrame(page);
		const color = rgb(...hexToRgb(a.color || '#000000'));
		if (a.type === 'text') {
			(a.text || '').split('\n').forEach((line, i) => {
				if (!line.trim()) return;
				const p = f.toPdf(a.x, f.h - (a.y + a.size * ASC + i * a.size * LINE));
				fonts.draw(page, line, { x: p.x, y: p.y, size: a.size, color, rotate: f.rot });
			});
		} else if (a.type === 'pen') {
			const pts = a.points.map(([x, y]) => f.toPdf(x, f.h - y));
			const path = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`).join(' ');
			page.drawSvgPath(pts.length === 1 ? `${path} L ${(pts[0].x + 0.01).toFixed(2)} ${(-pts[0].y).toFixed(2)}` : path, { x: 0, y: 0, borderColor: color, borderWidth: a.size, borderLineCap: LineCapStyle.Round });
		} else if (a.type === 'img') {
			if (!images.has(a.id)) images.set(a.id, a.mime === 'image/jpeg' ? await doc.embedJpg(a.bytes) : await doc.embedPng(a.bytes));
			const p = f.toPdf(a.x, f.h - (a.y + a.h));
			page.drawImage(images.get(a.id), { x: p.x, y: p.y, width: a.w, height: a.h, rotate: degrees(f.rot) });
		} else {
			const r = rectToPdf(f, a.x, f.h - (a.y + a.h), a.w, a.h);
			if (a.type === 'hl') page.drawRectangle({ ...r, color: rgb(...hexToRgb(HL)), opacity: 0.38, blendMode: BlendMode.Multiply });
			else if (a.type === 'white') page.drawRectangle({ ...r, color: rgb(1, 1, 1) });
			else page.drawRectangle({ ...r, borderColor: color, borderWidth: a.size });
		}
	}
	return doc.save({ useObjectStreams: true });
}

export function Editor({ t, opened, file, onAgain, mode }) {
	const toolIds = mode === 'sign' ? ['select', 'sign', 'text', 'date'] : ['select', 'text', 'pen', 'hl', 'white', 'rect', 'image', 'sign'];
	const [sizes, setSizes] = useState(null);
	const [tool, setTool] = useState(mode === 'sign' ? 'select' : 'text');
	const [color, setColor] = useState(COLORS[0]);
	const [textSize, setTextSize] = useState(14);
	const [stroke, setStroke] = useState(2);
	const [hist, setHist] = useState({ list: [], past: [], future: [] });
	const [sel, setSel] = useState(null);
	const [editing, setEditing] = useState(null);
	const [draft, setDraft] = useState(null);
	const [active, setActive] = useState(1);
	const [padOpen, setPadOpen] = useState(false);
	const [saved] = useState(savedSignature);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const drag = useRef(null);
	const picker = useRef(null);
	const column = useRef(null);
	const { list } = hist;
	const selected = list.find(a => a.id === sel) || null;

	useEffect(() => {
		let dead = false;
		Promise.all(Array.from({ length: opened.pages }, (_, i) => opened.doc.getPage(i + 1).then((p) => {
			const v = p.getViewport({ scale: 1 });
			return { w: v.width, h: v.height };
		}))).then((s) => { if (!dead) setSizes(s); }).catch(() => { if (!dead) setError(t('err.fail')); });
		return () => { dead = true; };
	}, [opened]);

	// Geçmiş: her ekleme/silme bir adım; sürükleme boyunca canlı güncellenir, bırakınca tek adım olur
	const commit = fn => setHist(h => ({ list: fn(h.list), past: [...h.past.slice(-60), h.list], future: [] }));
	const begin = () => setHist(h => ({ ...h, past: [...h.past.slice(-60), h.list], future: [] }));
	const live = fn => setHist(h => ({ ...h, list: fn(h.list) }));
	const patch = (id, change) => live(l => l.map(a => (a.id === id ? { ...a, ...change } : a)));
	const undo = () => { setSel(null); setEditing(null); setHist(h => (h.past.length ? { list: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.list, ...h.future] } : h)); };
	const redo = () => { setSel(null); setHist(h => (h.future.length ? { list: h.future[0], past: [...h.past, h.list], future: h.future.slice(1) } : h)); };
	const remove = (id) => { commit(l => l.filter(a => a.id !== id)); setSel(null); setEditing(null); };
	const changed = () => setResult(null);

	// Klavye: Sil, geri al / yinele, Esc
	useEffect(() => {
		const onKey = (e) => {
			if (padOpen) return;
			const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
			if (typing) return;
			const mod = e.metaKey || e.ctrlKey;
			if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); changed(); return; }
			if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); changed(); return; }
			if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); remove(sel); changed(); return; }
			if (e.key === 'Escape') { setSel(null); setTool('select'); }
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [sel, padOpen]);

	// Etkin sayfa: kaydırınca görünür alanın ortasındaki sayfa (resim, imza ve tarih oraya eklenir)
	useEffect(() => {
		const scroller = column.current && column.current.closest('.pdf-ws-canvas');
		if (!scroller) return undefined;
		const onScroll = () => {
			const mid = scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
			let best = 1;
			let dist = Infinity;
			column.current.querySelectorAll('[data-page]').forEach((el) => {
				const r = el.getBoundingClientRect();
				const d = mid < r.top ? r.top - mid : (mid > r.bottom ? mid - r.bottom : 0);
				if (d < dist) { dist = d; best = Number(el.dataset.page); }
			});
			setActive(best);
		};
		scroller.addEventListener('scroll', onScroll, { passive: true });
		return () => scroller.removeEventListener('scroll', onScroll);
	}, [sizes]);

	const place = (n, item) => {
		commit(l => [...l, item]);
		setSel(item.id);
		setTool('select');
		changed();
	};

	const addImage = async (fileIn) => {
		if (!fileIn) return;
		if (!isImageFile(fileIn)) { setError(t('err.imgtype', fileIn.name)); return; }
		try {
			const img = await loadImage(fileIn);
			const alpha = /png|gif|webp|svg/i.test(fileIn.type);
			const canvas = drawToCanvas(img, { maxSide: 1800, background: alpha ? null : '#ffffff' });
			const mime = alpha ? 'image/png' : 'image/jpeg';
			const bytes = await canvasBytes(canvas, mime, 0.9);
			const src = canvas.toDataURL(mime, 0.9);
			const page = sizes[active - 1];
			const w = Math.min(page.w * 0.4, canvas.width * 0.75);
			const h = w * (canvas.height / canvas.width);
			img.close();
			place(active, { id: uid(), page: active, type: 'img', x: (page.w - w) / 2, y: (page.h - h) / 2, w, h, src, bytes, mime });
			setError('');
		} catch (err) {
			setError(t('err.image', fileIn.name));
		}
	};

	const addSignature = (sig) => {
		setPadOpen(false);
		const page = sizes[active - 1];
		const w = Math.min(160, page.w * 0.35);
		const h = w * (sig.h / sig.w);
		place(active, { id: uid(), page: active, type: 'img', x: page.w - w - 56, y: page.h - h - 84, w, h, src: sig.url, bytes: sig.bytes, mime: 'image/png' });
	};

	const addDate = () => {
		const page = sizes[active - 1];
		const text = today(t.lang);
		place(active, { id: uid(), page: active, type: 'text', x: page.w - 56 - textWidth(text, 12), y: page.h - 72, text, size: 12, color: COLORS[0] });
	};

	const pick = (id) => {
		if (id === 'image') { if (picker.current) picker.current.click(); return; }
		if (id === 'sign') { setPadOpen(true); return; }
		if (id === 'date') { addDate(); return; }
		setTool(id);
		if (id !== 'select') setSel(null);
	};

	// Sayfa üstünde fare/dokunma: seç, taşı, boyutlandır, yaz, çiz
	const down = (n, k) => (e) => {
		if (e.button) return;
		const r = e.currentTarget.getBoundingClientRect();
		const p = [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
		const tol = 6 / k;
		setActive(n);
		if (editing) finishEdit();
		const onPage = list.filter(a => a.page === n);
		if (tool === 'select' || (tool === 'text' && onPage.some(a => a.type === 'text' && inside(bbox(a), p, tol)))) {
			if (selected && selected.page === n && resizable(selected)) {
				const b = bbox(selected);
				if (Math.abs(p[0] - (b.x + b.w)) < 10 / k && Math.abs(p[1] - (b.y + b.h)) < 10 / k) {
					e.preventDefault();
					e.currentTarget.setPointerCapture(e.pointerId);
					drag.current = { kind: 'resize', id: selected.id, start: p, orig: { ...selected }, box: b, begun: false };
					return;
				}
			}
			const hit = [...onPage].reverse().find(a => inside(bbox(a), p, tol));
			if (!hit) { setSel(null); setEditing(null); return; }
			// Seçili yazıya bir daha tıklamak (ya da Yazı aracıyla tıklamak) yazıyı düzenlemeye açar
			if (hit.type === 'text' && (hit.id === sel || tool === 'text')) { setSel(hit.id); setEditing(hit.id); return; }
			setSel(hit.id);
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
			drag.current = { kind: 'move', id: hit.id, start: p, orig: { ...hit, points: hit.points && hit.points.map(q => q.slice()) }, begun: false };
			return;
		}
		e.preventDefault();
		if (tool === 'text') {
			const a = { id: uid(), page: n, type: 'text', x: p[0], y: p[1] - textSize * 0.6, text: '', size: textSize, color };
			commit(l => [...l, a]);
			setSel(a.id);
			setEditing(a.id);
			changed();
			return;
		}
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { kind: 'draw', start: p, page: n };
		setDraft(tool === 'pen'
			? { id: 'draft', page: n, type: 'pen', points: [p], color, size: stroke }
			: { id: 'draft', page: n, type: tool, x: p[0], y: p[1], w: 0, h: 0, color, size: stroke });
	};

	const move = k => (e) => {
		const d = drag.current;
		if (!d) return;
		const r = e.currentTarget.getBoundingClientRect();
		const p = [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
		const dx = p[0] - d.start[0];
		const dy = p[1] - d.start[1];
		if (d.kind !== 'draw' && !d.begun) {
			if (Math.hypot(dx, dy) < 2 / k) return;
			begin();
			d.begun = true;
		}
		if (d.kind === 'move') {
			const o = d.orig;
			if (o.type === 'pen') patch(d.id, { points: o.points.map(q => [q[0] + dx, q[1] + dy]) });
			else patch(d.id, { x: o.x + dx, y: o.y + dy });
		} else if (d.kind === 'resize') {
			const o = d.orig;
			if (o.type === 'text') patch(d.id, { size: Math.max(6, Math.min(120, o.size * ((d.box.w + dx) / d.box.w))) });
			else if (o.type === 'img') { const w = Math.max(12, o.w + dx); patch(d.id, { w, h: w * (o.h / o.w) }); } else patch(d.id, { w: Math.max(6, o.w + dx), h: Math.max(4, o.h + dy) });
		} else if (d.kind === 'draw') {
			setDraft((dr) => {
				if (!dr) return dr;
				if (dr.type === 'pen') {
					const last = dr.points[dr.points.length - 1];
					return Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.8 / k ? dr : { ...dr, points: [...dr.points, p] };
				}
				return { ...dr, x: Math.min(d.start[0], p[0]), y: Math.min(d.start[1], p[1]), w: Math.abs(dx), h: Math.abs(dy) };
			});
		}
	};

	const up = () => {
		const d = drag.current;
		drag.current = null;
		if (!d) return;
		if (d.begun || d.kind === 'draw') changed();
		if (d.kind !== 'draw') return;
		setDraft((dr) => {
			if (!dr) return null;
			const ok = dr.type === 'pen' || (dr.w >= 4 && dr.h >= 3);
			if (ok) commit(l => [...l, { ...dr, id: uid() }]);
			return null;
		});
	};

	const editingItem = list.find(a => a.id === editing);
	const finishEdit = () => {
		if (editingItem && !editingItem.text.trim()) remove(editingItem.id);
		setEditing(null);
	};

	const save = async () => {
		if (editing) finishEdit();
		const items = list.filter(a => a.type !== 'text' || a.text.trim());
		if (!items.length) { setError(t(mode === 'sign' ? 'ed.emptySign' : 'ed.empty')); return; }
		setBusy(true);
		setError('');
		try {
			const bytes = await bake(opened, items);
			setResult({ bytes });
			setSel(null);
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	const canvas = (box) => {
		if (!sizes) return <p class="pdf-status pdf-status--canvas" role="status"><span class="pdf-yu-spinner" aria-hidden="true" />{t('loading')}</p>;
		return (
			<div class={`pdf-ed-pages pdf-ed-tool--${tool}`} ref={column}>
				{sizes.map((s, i) => {
					const n = i + 1;
					const dw = Math.max(240, Math.min(box.w, MAX_WIDTH, s.w * 1.6));
					const k = dw / s.w;
					const dh = s.h * k;
					const items = list.filter(a => a.page === n);
					const selBox = selected && selected.page === n ? bbox(selected) : null;
					return (
						<figure key={n} class="pdf-ed-page" data-page={n}>
							<div class="pdf-paper pdf-ed-sheet" style={{ width: `${dw}px`, height: `${dh}px` }}>
								<Thumb doc={opened.doc} page={n} width={dw} rotate={0} />
								<svg class="pdf-ed-layer" viewBox={`0 0 ${s.w} ${s.h}`} width={dw} height={dh} role="img" aria-label={t('ed.pageLayer', n)}
									onPointerDown={down(n, k)} onPointerMove={move(k)} onPointerUp={up} onPointerCancel={up}>
									{items.map(a => <Ann key={a.id} a={a} hidden={a.id === editing} />)}
									{draft && draft.page === n ? <Ann a={draft} /> : null}
									{selBox ? (
										<g class="pdf-ed-sel" aria-hidden="true">
											<rect x={selBox.x - 3 / k} y={selBox.y - 3 / k} width={selBox.w + 6 / k} height={selBox.h + 6 / k} fill="none" stroke-width={1.5 / k} stroke-dasharray={`${5 / k} ${3 / k}`} />
											{resizable(selected) ? <rect class="pdf-ed-handle" x={selBox.x + selBox.w - 5 / k} y={selBox.y + selBox.h - 5 / k} width={10 / k} height={10 / k} rx={2 / k} stroke-width={1.5 / k} /> : null}
										</g>
									) : null}
								</svg>
								{editingItem && editingItem.page === n ? (
									<textarea
										class="pdf-ed-textedit"
										aria-label={t('ed.typeHere')}
										value={editingItem.text}
										rows={Math.max(1, editingItem.text.split('\n').length)}
										style={{ left: `${editingItem.x * k}px`, top: `${editingItem.y * k}px`, fontSize: `${editingItem.size * k}px`, color: editingItem.color, width: `${Math.max(120, (bbox(editingItem).w + editingItem.size) * k)}px` }}
										ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
										onInput={e => patch(editingItem.id, { text: e.currentTarget.value })}
										onBlur={finishEdit}
										onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
									/>
								) : null}
							</div>
							<figcaption class="pdf-paper-cap">{n} / {opened.pages}</figcaption>
						</figure>
					);
				})}
			</div>
		);
	};

	const usesColor = ['text', 'pen', 'rect'].includes(tool) || (selected && ['text', 'pen', 'rect'].includes(selected.type));
	const usesStroke = ['pen', 'rect'].includes(tool) || (selected && ['pen', 'rect'].includes(selected.type));
	const usesSize = tool === 'text' || (selected && selected.type === 'text');
	const setProp = (key, value, setter) => {
		setter(value);
		if (selected && (key !== 'size' || selected.type === 'text' || ['pen', 'rect'].includes(selected.type))) {
			begin();
			patch(selected.id, { [key]: value });
			changed();
		}
	};

	return (
		<>
			<Workspace
				t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
				canvas={canvas}
				action={{ label: t('ed.save'), onClick: save, busy, info: list.length ? t('ed.count', list.length) : '' }}
				result={result && { title: t(mode === 'sign' ? 'ed.signed' : 'ed.done'), meta: fmtSize(result.bytes.length), onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-${mode === 'sign' ? 'imzali' : 'duzenlenmis'}.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
				error={error}
			>
				{mode === 'sign' ? (
					<div class="pdf-ed-signs">
						<button type="button" class="pdfb pdfb--secondary pdfb--block" onClick={() => setPadOpen(true)}><Icon name="signature" size={18} />{t('sig.new')}</button>
						{saved ? <button type="button" class="pdfb pdfb--secondary pdfb--block" onClick={() => addSignature(saved)}><img src={saved.url} alt="" class="pdf-ed-savedsig" />{t('sig.useSaved')}</button> : null}
					</div>
				) : null}
				<div class="pdf-ed-tools" role="toolbar" aria-label={t('ed.tools')}>
					{toolIds.map(id => (
						<button key={id} type="button" class={`pdf-ed-toolbtn${tool === id && !ACTIONS.has(id) ? ' is-on' : ''}`} aria-pressed={ACTIONS.has(id) ? undefined : tool === id} onClick={() => pick(id)}>
							<Icon name={ICONS[id]} size={20} />
							<span>{t(`ed.${id}`)}</span>
						</button>
					))}
				</div>
				<p class="pdf-hint" role="status">{t(`ed.hint.${tool}`)}</p>
				{usesColor ? <Swatches legend={t('wm.color')} value={selected && selected.color ? selected.color : color} onChange={v => setProp('color', v, setColor)} colors={COLORS.map((c, i) => ({ value: c, label: t(COLOR_NAMES[i]) }))} /> : null}
				{usesSize ? <Slider id="pdf-ed-size" label={t('pn.size')} min={8} max={48} value={Math.round(selected && selected.type === 'text' ? selected.size : textSize)} onChange={v => setProp('size', v, setTextSize)} format={v => `${v} pt`} /> : null}
				{usesStroke ? <Slider id="pdf-ed-stroke" label={t('ed.stroke')} min={1} max={10} value={selected && ['pen', 'rect'].includes(selected.type) ? selected.size : stroke} onChange={v => setProp('size', v, setStroke)} format={v => `${v} pt`} /> : null}
				<div class="pdf-ed-row">
					<button type="button" class="pdfb pdfb--secondary" disabled={!hist.past.length} onClick={() => { undo(); changed(); }}><Icon name="undo" size={18} />{t('ed.undo')}</button>
					<button type="button" class="pdfb pdfb--secondary" disabled={!hist.future.length} onClick={() => { redo(); changed(); }}><Icon name="redo" size={18} />{t('ed.redo')}</button>
				</div>
				{selected ? <button type="button" class="pdfb pdfb--danger pdfb--block" onClick={() => { remove(selected.id); changed(); }}><Icon name="trash" size={18} />{t('ed.delete')}</button> : null}
				<input ref={picker} class="pdf-visually-hidden" type="file" accept="image/*" tabIndex={-1} aria-label={t('ed.image')} onChange={(e) => { addImage(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
			</Workspace>
			{padOpen ? <SignaturePad t={t} onDone={addSignature} onCancel={() => setPadOpen(false)} /> : null}
		</>
	);
}
