// Sayfa seçici: küçük resimlere tıkla, aralık yaz ("2-4, 9") ya da hızlı düğmeleri kullan. Böl ve PDF'ten resim kullanır.
import { useMemo, useRef, useState } from 'preact/hooks';
import { formatRanges, parseRanges } from '../util.js';
import { Thumb } from './common.jsx';

export function PageSelector({ t, doc, total, picked, onChange, onInvalid, id = 'pdf-range' }) {
	const [text, setText] = useState(() => formatRanges([...picked]));
	const [bad, setBad] = useState(false);
	const last = useRef(0);
	const pages = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

	const apply = (set) => {
		onChange(set);
		setText(formatRanges([...set]));
		setBad(false);
		if (onInvalid) onInvalid(false);
	};
	const toggle = (n, e) => {
		const set = new Set(picked);
		if (e.shiftKey && last.current) {
			const [a, b] = last.current < n ? [last.current, n] : [n, last.current];
			for (let i = a; i <= b; i += 1) set.add(i);
		} else if (set.has(n)) set.delete(n);
		else set.add(n);
		last.current = n;
		apply(set);
	};
	const onText = (value) => {
		setText(value);
		const list = parseRanges(value, total);
		setBad(list === null);
		if (onInvalid) onInvalid(list === null);
		if (list !== null) onChange(new Set(list));
	};
	const quick = fn => apply(new Set(pages.filter(fn)));

	return (
		<div>
			<div class="pdf-toolbar">
				<div class="pdf-field">
					<label class="pdf-label" for={id}>{t('split.range')}</label>
					<input id={id} class="pdf-input" value={text} placeholder={t('split.rangePh')} inputMode="text" autocomplete="off" aria-invalid={bad ? 'true' : undefined} aria-describedby={bad ? `${id}-e` : undefined} onInput={e => onText(e.currentTarget.value)} />
					{bad ? <p class="pdf-field-error" id={`${id}-e`}>{t('split.rangeBad', total)}</p> : null}
				</div>
				<div class="pdf-chips" role="group" aria-label={t('split.range')}>
					<button type="button" class="pdfb pdfb--ghost" onClick={() => quick(() => true)}>{t('split.all')}</button>
					<button type="button" class="pdfb pdfb--ghost" onClick={() => quick(() => false)}>{t('split.none')}</button>
					<button type="button" class="pdfb pdfb--ghost" onClick={() => quick(n => n % 2 === 1)}>{t('split.odd')}</button>
					<button type="button" class="pdfb pdfb--ghost" onClick={() => quick(n => n % 2 === 0)}>{t('split.even')}</button>
				</div>
			</div>
			<ul class="pdf-grid" aria-label={t('split.range')}>
				{pages.map(n => (
					<li key={n}>
						<button type="button" class={`pdf-tile${picked.has(n) ? ' is-picked' : ''}`} aria-pressed={picked.has(n)} onClick={e => toggle(n, e)}>
							<Thumb doc={doc} page={n} width={132} rotate={0} />
							<span class="pdf-tile-label">{n}</span>
						</button>
					</li>
				))}
			</ul>
			<p class="pdf-hint" role="status">{picked.size ? t('split.count', picked.size, total) : t('split.need')}</p>
			{bad ? <span class="pdf-visually-hidden" role="alert">{t('split.rangeBad', total)}</span> : null}
		</div>
	);
}

// Aralık geçersizken ana düğmeyi kapatmak için: metin geçerli mi?
export const rangeValid = (text, total) => parseRanges(text, total) !== null;
