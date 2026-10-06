// Sayfa numarası: sayfalara "1", "1 / 12" ya da "Sayfa 1" yazar. Konum görünen yöne göredir: döndürülmüş sayfada da
// numara doğru köşeye düşer. Yazı Inter ile gömülür (Türkçe harfler dahil).
import { useState } from 'preact/hooks';
import { download, getLib, loadClean } from '../pdf.js';
import { loadFontSet } from '../fonts.js';
import { numberSpot, pageFrame } from '../stamp.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Check, Field, Radios, Slider, usePageSize, useSinglePdf } from '../ui/common.jsx';
import { PagePaper, Workspace, fitPage } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

const MARGIN = 28; // pt, ≈1 cm
const INK = [0.13, 0.15, 0.17];
const POSITIONS = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];

export function numberLabel(format, n, last, t) {
	if (format === 'nt') return `${n} / ${last}`;
	if (format === 'pn') return t('pn.word', n);
	if (format === 'pnt') return t('pn.wordOf', n, last);
	return String(n);
}

// Konum seçici: küçük bir sayfa, üstte ve altta üçer nokta
function PosPicker({ t, value, onChange }) {
	return (
		<fieldset class="pdf-pospick">
			<legend class="pdf-label">{t('pn.pos')}</legend>
			<div class="pdf-pospick-page">
				{POSITIONS.map(p => (
					<label key={p} class={`pdf-pos pdf-pos--${p}${value === p ? ' is-on' : ''}`} title={t(`pn.${p}`)}>
						<input type="radio" name="pdf-pn-pos" checked={value === p} onChange={() => onChange(p)} />
						<span class="pdf-visually-hidden">{t(`pn.${p}`)}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function PageNumTool({ t, opened, file, onAgain }) {
	const [pos, setPos] = useState('bc');
	const [format, setFormat] = useState('nt');
	const [startText, setStartText] = useState('1');
	const [skipFirst, setSkipFirst] = useState(false);
	const [size, setSize] = useState(11);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	const start = /^\d{1,4}$/.test(startText.trim()) ? parseInt(startText, 10) : NaN;
	const startBad = !(start >= 1);
	const count = opened.pages - (skipFirst ? 1 : 0);
	const last = start + count - 1;
	const previewPage = skipFirst && opened.pages > 1 ? 2 : 1;
	const frame = usePageSize(opened.doc, previewPage);
	const edit = fn => (v) => { fn(v); setResult(null); };

	const run = async () => {
		if (startBad) return;
		if (count < 1) { setError(t('pn.none')); return; }
		setBusy(true);
		setError('');
		try {
			const { rgb } = await getLib();
			const doc = await loadClean(opened);
			const fonts = await loadFontSet(doc);
			const color = rgb(...INK);
			doc.getPages().forEach((page, i) => {
				if (skipFirst && i === 0) return;
				const label = numberLabel(format, start + i - (skipFirst ? 1 : 0), last, t);
				const f = pageFrame(page);
				const width = fonts.width(label, size);
				const at = numberSpot(pos, f.w, f.h, width, size, MARGIN);
				const p = f.toPdf(at.x, at.y);
				fonts.draw(page, label, { x: p.x, y: p.y, size, color, rotate: f.rot });
			});
			const bytes = await doc.save({ useObjectStreams: true });
			setResult({ bytes });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	// Önizleme: numara, görünen sayfa ölçüsüne göre ölçekli ve köşeye göre konumlu
	const sample = numberLabel(format, startBad ? 1 : start, startBad ? count : last, t);
	const paper = (box) => {
		const width = fitPage(box, frame);
		const k = frame ? width / frame.w : 0;
		return (
			<PagePaper doc={opened.doc} page={previewPage} width={width} caption={t('pn.previewOf', previewPage)}>
				{frame ? <span class={`pdf-pn-mark pdf-pn-mark--${pos}`} style={{ fontSize: `${size * k}px`, '--pdf-m': `${MARGIN * k}px` }}>{sample}</span> : null}
			</PagePaper>
		);
	};

	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={paper}
			action={{ label: t('pn.go'), onClick: run, busy, info: count < 1 ? t('pn.none') : t('pn.count', count) }}
			result={result && { title: t('pn.done'), meta: `${t('pages', opened.pages)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-numarali.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<PosPicker t={t} value={pos} onChange={edit(setPos)} />
			<Radios name="pdf-pn-format" legend={t('pn.format')} value={format} onChange={edit(setFormat)} options={[
				{ value: 'n', label: '1' },
				{ value: 'nt', label: `1 / ${count}` },
				{ value: 'pn', label: t('pn.word', 1) },
				{ value: 'pnt', label: t('pn.wordOf', 1, count) },
			]} />
			<Slider id="pdf-pn-size" label={t('pn.size')} min={8} max={24} value={size} onChange={edit(setSize)} format={v => `${v} pt`} />
			<Field id="pdf-pn-start" label={t('pn.start')} error={startBad ? t('pn.startBad') : ''}>
				<input id="pdf-pn-start" class="pdf-input pdf-input--short" inputMode="numeric" value={startText} aria-invalid={startBad ? 'true' : undefined} aria-describedby={startBad ? 'pdf-pn-start-e' : undefined} onInput={e => edit(setStartText)(e.currentTarget.value)} />
			</Field>
			<Check checked={skipFirst} disabled={opened.pages < 2} onChange={edit(setSkipFirst)} label={t('pn.skip')} />
		</Workspace>
	);
}

export function PageNum({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <PageNumTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
