// Filigran: sayfaların üstüne saydam bir yazı basar ("TASLAK", adın…). Ortada tek ya da sayfaya döşenmiş; düz ya da çapraz.
// Döndürülmüş sayfada da yazı görünen yöne göre durur.
import { useState } from 'preact/hooks';
import { download, getLib, loadClean } from '../pdf.js';
import { loadFontSet } from '../fonts.js';
import { centeredStart, hexToRgb, pageFrame, watermarkSpots } from '../stamp.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Field, Radios, Slider, Swatches, usePageSize, useSinglePdf } from '../ui/common.jsx';
import { PagePaper, Workspace, fitPage } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

const COLORS = ['#6b7280', '#dc2626', '#2563eb', '#7c3aed', '#111827'];
const COLOR_NAMES = ['wm.gray', 'wm.red', 'wm.blue', 'wm.violet', 'wm.black'];
const MAX_LENGTH = 60;

// Önizlemede yazı genişliği: forumun yazı tipiyle (belgeye gömülen Inter ile aynı aile) ölçülür
let measureCtx = null;
function previewWidth(text, size) {
	if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
	const family = getComputedStyle(document.body).fontFamily || 'Inter, sans-serif';
	measureCtx.font = `700 ${size}px ${family}`;
	return measureCtx.measureText(text).width;
}

function WatermarkTool({ t, opened, file, onAgain }) {
	const [text, setText] = useState(() => t('wm.default'));
	const [size, setSize] = useState(56);
	const [strength, setStrength] = useState(25);
	const [angle, setAngle] = useState(45);
	const [tiled, setTiled] = useState(false);
	const [color, setColor] = useState(COLORS[0]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const frame = usePageSize(opened.doc, 1);
	const label = text.replace(/\s+/g, ' ').trim();
	const edit = fn => (v) => { fn(v); setResult(null); };

	const run = async () => {
		if (!label) { setError(t('wm.need')); return; }
		setBusy(true);
		setError('');
		try {
			const { rgb } = await getLib();
			const doc = await loadClean(opened);
			const fonts = await loadFontSet(doc);
			const ink = rgb(...hexToRgb(color));
			const width = fonts.width(label, size, true);
			doc.getPages().forEach((page) => {
				const f = pageFrame(page);
				watermarkSpots(f.w, f.h, width, size, angle, tiled).forEach((spot) => {
					const s = centeredStart(spot.x, spot.y, width, size, angle);
					const p = f.toPdf(s.x, s.y);
					fonts.draw(page, label, { x: p.x, y: p.y, size, color: ink, bold: true, opacity: strength / 100, rotate: angle + f.rot });
				});
			});
			const bytes = await doc.save({ useObjectStreams: true });
			setResult({ bytes });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	// Önizleme: aynı yerleşim hesabı, yüzde konumlu yazılar
	const paper = (box) => {
		const width = fitPage(box, frame);
		const k = frame ? width / frame.w : 0;
		const spots = frame && label ? watermarkSpots(frame.w, frame.h, previewWidth(label, size), size, angle, tiled) : [];
		return (
			<PagePaper doc={opened.doc} page={1} width={width} caption={t('pn.previewOf', 1)}>
				{spots.map((s, i) => (
					<span key={i} class="pdf-wm-mark" style={{ left: `${(s.x / frame.w) * 100}%`, bottom: `${(s.y / frame.h) * 100}%`, fontSize: `${size * k}px`, color, opacity: strength / 100, transform: `translate(-50%, 50%) rotate(${-angle}deg)` }}>{label}</span>
				))}
			</PagePaper>
		);
	};

	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={paper}
			action={{ label: t('wm.go'), onClick: run, busy }}
			result={result && { title: t('wm.done'), meta: `${t('pages', opened.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-filigranli.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<Field id="pdf-wm-text" label={t('wm.text')} error={label ? '' : t('wm.need')}>
				<input id="pdf-wm-text" class="pdf-input" value={text} maxLength={MAX_LENGTH} autocomplete="off" aria-invalid={label ? undefined : 'true'} aria-describedby={label ? undefined : 'pdf-wm-text-e'} onInput={e => edit(setText)(e.currentTarget.value)} />
			</Field>
			<Radios name="pdf-wm-layout" legend={t('wm.layout')} value={tiled ? 'tile' : 'center'} onChange={v => edit(setTiled)(v === 'tile')} options={[{ value: 'center', label: t('wm.center') }, { value: 'tile', label: t('wm.tile') }]} />
			<Radios name="pdf-wm-angle" legend={t('wm.angle')} value={String(angle)} onChange={v => edit(setAngle)(Number(v))} options={[{ value: '45', label: t('wm.diag') }, { value: '0', label: t('wm.flat') }]} />
			<Slider id="pdf-wm-size" label={t('wm.size')} min={16} max={120} value={size} onChange={edit(setSize)} format={v => `${v} pt`} />
			<Slider id="pdf-wm-strength" label={t('wm.strength')} min={10} max={90} step={5} value={strength} onChange={edit(setStrength)} format={v => t('pct', v)} />
			<Swatches legend={t('wm.color')} value={color} onChange={edit(setColor)} colors={COLORS.map((c, i) => ({ value: c, label: t(COLOR_NAMES[i]) }))} />
		</Workspace>
	);
}

export function Watermark({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <WatermarkTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
