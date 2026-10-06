// Sayfa seçimi: küçük resimlere tıkla (önizleme alanında), aralık yaz ya da hızlı düğmeleri kullan (panelde).
// Böl ve PDF'ten resim kullanır. Durum usePagePick'te; ızgara ve denetimler ayrı yerlere konur.
import { useMemo, useRef, useState } from 'preact/hooks';
import { formatRanges, parseRanges } from '../util.js';
import { Thumb } from './common.jsx';

export function usePagePick(total, initial, onChange) {
	const [picked, setPicked] = useState(initial);
	const [text, setText] = useState(() => formatRanges([...initial]));
	const [bad, setBad] = useState(false);
	const last = useRef(0);
	const pages = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

	const apply = (set) => {
		setPicked(set);
		setText(formatRanges([...set]));
		setBad(false);
		if (onChange) onChange();
	};
	return {
		picked,
		text,
		bad,
		total,
		pages,
		chosen: [...picked].sort((a, b) => a - b),
		toggle(n, e) {
			const set = new Set(picked);
			if (e && e.shiftKey && last.current) {
				const [a, b] = last.current < n ? [last.current, n] : [n, last.current];
				for (let i = a; i <= b; i += 1) set.add(i);
			} else if (set.has(n)) set.delete(n);
			else set.add(n);
			last.current = n;
			apply(set);
		},
		type(value) {
			setText(value);
			const list = parseRanges(value, total);
			setBad(list === null);
			if (list !== null) {
				setPicked(new Set(list));
				if (onChange) onChange();
			}
		},
		quick: fn => apply(new Set(pages.filter(fn))),
	};
}

// Önizleme alanında küçük resim ızgarası: tıkla seç (Shift ile aralık)
export function PageGrid({ t, doc, pick, size = 140 }) {
	return (
		<ul class="pdf-grid pdf-grid--canvas" style={{ '--pdf-tile': `${size}px` }} aria-label={t('split.range')}>
			{pick.pages.map(n => (
				<li key={n}>
					<button type="button" class={`pdf-tile${pick.picked.has(n) ? ' is-picked' : ''}`} aria-pressed={pick.picked.has(n)} onClick={e => pick.toggle(n, e)}>
						<Thumb doc={doc} page={n} width={size} rotate={0} />
						<span class="pdf-tile-label">{n}</span>
					</button>
				</li>
			))}
		</ul>
	);
}

// Paneldeki denetimler: aralık alanı, hızlı seçim ve kaç sayfa seçildiği
export function RangeControls({ t, pick, id = 'pdf-range' }) {
	return (
		<div class="pdf-field">
			<label class="pdf-label" for={id}>{t('split.range')}</label>
			<input id={id} class="pdf-input" value={pick.text} placeholder={t('split.rangePh')} inputMode="text" autocomplete="off" aria-invalid={pick.bad ? 'true' : undefined} aria-describedby={`${id}-h`} onInput={e => pick.type(e.currentTarget.value)} />
			<p class={pick.bad ? 'pdf-field-error' : 'pdf-field-hint'} id={`${id}-h`} role={pick.bad ? 'alert' : 'status'}>
				{pick.bad ? t('split.rangeBad', pick.total) : (pick.picked.size ? t('split.count', pick.picked.size, pick.total) : t('split.need'))}
			</p>
			<div class="pdf-chips" role="group" aria-label={t('split.quick')}>
				<button type="button" class="pdfb pdfb--chip" onClick={() => pick.quick(() => true)}>{t('split.all')}</button>
				<button type="button" class="pdfb pdfb--chip" onClick={() => pick.quick(() => false)}>{t('split.none')}</button>
				<button type="button" class="pdfb pdfb--chip" onClick={() => pick.quick(n => n % 2 === 1)}>{t('split.odd')}</button>
				<button type="button" class="pdfb pdfb--chip" onClick={() => pick.quick(n => n % 2 === 0)}>{t('split.even')}</button>
			</div>
		</div>
	);
}
