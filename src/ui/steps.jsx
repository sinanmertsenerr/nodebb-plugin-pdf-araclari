// Adım çubuğu: 1 Dosya seç · 2 Ayarla · 3 İndir. Araçlar adımı kendileri bildirmez:
// tam bırakma alanı görünüyorsa 1, sonuç bandı görünüyorsa 3, ikisi de yoksa 2.
import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';

const StepContext = createContext(null);

export function StepProvider({ children }) {
	const [marks, setMarks] = useState({ start: 0, done: 0 });
	const api = useMemo(() => ({ add: (kind, delta) => setMarks(m => ({ ...m, [kind]: m[kind] + delta })) }), []);
	const value = useMemo(() => ({ api, step: marks.done > 0 ? 3 : (marks.start > 0 ? 1 : 2) }), [api, marks]);
	return <StepContext.Provider value={value}>{children}</StepContext.Provider>;
}

// kind: 'start' (henüz dosya/metin yok) ya da 'done' (sonuç hazır). active false iken sayılmaz.
export function useStepMark(kind, active = true) {
	const ctx = useContext(StepContext);
	const api = ctx && ctx.api;
	useEffect(() => {
		if (!api || !active) return undefined;
		api.add(kind, 1);
		return () => api.add(kind, -1);
	}, [api, kind, active]);
}

// labels: üç adımın i18n anahtarları (Metinden PDF'te "Yaz", Ödev kapağında "Doldur")
export function Steps({ t, labels = ['step.1', 'step.2', 'step.3'] }) {
	const ctx = useContext(StepContext);
	const step = ctx ? ctx.step : 1;
	return (
		<ol class="pdf-steps" aria-label={t('step.label')}>
			{labels.map((key, i) => {
				const n = i + 1;
				const state = n < step ? 'done' : (n === step ? 'current' : 'next');
				return (
					<li key={key} class={`pdf-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
						<span class="pdf-step-dot" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} /> : n}</span>
						<span class="pdf-step-name">{t(key)}</span>
					</li>
				);
			})}
		</ol>
	);
}
