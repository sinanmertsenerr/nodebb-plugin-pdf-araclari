// Uygulama kökü: solda araç listesi, sağda seçili araç. window.YuPDF.mount/unmount ile bağlanır.
import { render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { makeT } from './i18n.js';
import { GROUPS, TOOLS } from './tools/index.js';
import { Icon } from './ui/icons.jsx';
import { setNotifier } from './notify.js';

const toolFromHash = () => {
	const id = decodeURIComponent((window.location.hash || '').replace(/^#/, '')).split('&')[0];
	const tool = TOOLS.find(x => x.id === id && x.component);
	return tool ? tool.id : TOOLS[0].id;
};

function App({ ctx }) {
	const t = useMemo(() => makeT(ctx.uiLang), [ctx.uiLang]);
	const [id, setId] = useState(toolFromHash);
	const tool = TOOLS.find(x => x.id === id) || TOOLS[0];
	const Tool = tool.component;
	const app = useRef(null);

	// Araç ekranın kalanını doldurur: kutunun sayfadaki üst kenarı ölçülür (CSS --pdf-app-top)
	useLayoutEffect(() => {
		const measure = () => {
			if (!app.current) return;
			const top = app.current.getBoundingClientRect().top + window.scrollY;
			app.current.style.setProperty('--pdf-app-top', `${Math.max(0, Math.round(top))}px`);
		};
		measure();
		window.addEventListener('resize', measure);
		const late = setTimeout(measure, 400); // yazı tipi ve forum başlığı yerleşince
		return () => { window.removeEventListener('resize', measure); clearTimeout(late); };
	}, []);

	useEffect(() => {
		const onHash = () => setId(toolFromHash());
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	const choose = (next) => {
		window.history.replaceState(null, '', `#${next}`);
		setId(next);
	};

	return (
		<div class="pdf-app" ref={app}>
			<nav class="pdf-nav" aria-label={t('nav.tools')}>
				{GROUPS.map(group => (
					<div key={group} class="pdf-nav-group" role="group" aria-labelledby={`pdf-g-${group}`}>
						<p class="pdf-nav-h" id={`pdf-g-${group}`}>{t(`group.${group}`)}</p>
						{TOOLS.filter(x => x.group === group).map(x => (
							<button
								key={x.id}
								type="button"
								class={`pdf-nav-item${x.id === tool.id ? ' is-current' : ''}`}
								aria-current={x.id === tool.id ? 'page' : undefined}
								disabled={!x.component}
								onClick={() => choose(x.id)}
							>
								<Icon name={x.icon} size={20} />
								<span class="pdf-nav-name">{t(`tool.${x.id}`)}</span>
								{x.component ? null : <span class="pdf-soon">{t('soon')}</span>}
							</button>
						))}
					</div>
				))}
			</nav>
			<section class="pdf-work" aria-labelledby="pdf-title">
				<label class="pdf-pick">
					<span class="pdf-visually-hidden">{t('nav.pick')}</span>
					<select class="pdf-input" value={tool.id} onChange={e => choose(e.currentTarget.value)}>
						{GROUPS.map(group => (
							<optgroup key={group} label={t(`group.${group}`)}>
								{TOOLS.filter(x => x.group === group).map(x => (
									<option key={x.id} value={x.id} disabled={!x.component}>{t(`tool.${x.id}`)}{x.component ? '' : ` (${t('soon')})`}</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				<h2 class="pdf-title" id="pdf-title">{t(`tool.${tool.id}`)}</h2>
				{/* key: araç değişince durum (açılmış dosyalar) sıfırlanır */}
				<div class="pdf-tool"><Tool key={tool.id} t={t} /></div>
			</section>
		</div>
	);
}

let mountedRoot = null;
window.YuPDF = {
	mount(root, ctx) {
		mountedRoot = root;
		setNotifier(ctx.notify);
		root.classList.add('pdf-yu-mounted');
		render(<App ctx={ctx} />, root);
	},
	unmount() {
		if (mountedRoot) {
			render(null, mountedRoot);
			mountedRoot = null;
		}
	},
};
