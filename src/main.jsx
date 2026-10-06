// Uygulama kökü: ana ekranda renkli araç kartları; kart seçilince araç sayfası (geri düğmesi, 1-2-3 adım çubuğu).
// Adres #araç biçimindedir (boşsa ana ekran). window.YuPDF.mount/unmount ile bağlanır.
import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { makeT } from './i18n.js';
import { GROUPS, TOOLS } from './tools/index.js';
import { Icon } from './ui/icons.jsx';
import { StepProvider, Steps } from './ui/steps.jsx';
import { useWidth } from './ui/workspace.jsx';
import { setNotifier } from './notify.js';

const hashParts = () => decodeURIComponent((window.location.hash || '').replace(/^#/, '')).split('&');

const toolFromHash = () => {
	const tool = TOOLS.find(x => x.id === hashParts()[0] && x.component);
	return tool ? tool.id : '';
};

// Aramada Türkçe harfler ve büyük/küçük harf fark etmez: "sifre" Şifre'yi, "bol" Böl'ü bulur
const fold = s => String(s).toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Grupların sütunlara dağılımı: araç sayıları dengeli (4+2, 6+1, 4+2), ilk sıra Temel · Dönüştür · Düzenle
const COLUMNS = {
	3: [['basic', 'secure'], ['convert', 'scan'], ['edit', 'student']],
	2: [['basic', 'edit', 'student'], ['convert', 'secure', 'scan']],
	1: [GROUPS],
};

function Home({ t, onPick }) {
	const [query, setQuery] = useState('');
	const box = useRef(null);
	const width = useWidth(box, 900);
	const cols = width >= 780 ? 3 : (width >= 520 ? 2 : 1);
	const q = fold(query.trim());
	const shown = TOOLS.filter(x => !q || fold(`${t(`tool.${x.id}`)} ${t(`desc.${x.id}`)}`).includes(q));
	return (
		<div class="pdf-home">
			<header class="pdf-home-head">
				<div class="pdf-home-intro">
					<h2 class="pdf-home-title" id="pdf-title">{t('app.title')}</h2>
					<p class="pdf-home-sub"><Icon name="lock" size={16} />{t('home.sub')}</p>
				</div>
				<label class="pdf-search">
					<Icon name="search" size={18} />
					<span class="pdf-visually-hidden">{t('home.search')}</span>
					<input class="pdf-search-input" type="search" placeholder={t('home.search')} value={query} autocomplete="off" onInput={e => setQuery(e.currentTarget.value)} />
				</label>
			</header>
			<div class="pdf-home-groups" ref={box} style={{ '--pdf-cols': cols }}>
				{COLUMNS[cols].map(column => (
					<div class="pdf-home-col" key={column.join()}>
						{column.map((group) => {
							const items = shown.filter(x => x.group === group);
							if (!items.length) return null;
							return (
								<section key={group} class="pdf-home-group" aria-labelledby={`pdf-g-${group}`}>
									<h3 class="pdf-home-h" id={`pdf-g-${group}`}>{t(`group.${group}`)}</h3>
									<ul class="pdf-tools">
										{items.map(x => (
											<li key={x.id}>
												<button type="button" class="pdf-tool-link" disabled={!x.component} title={t(`desc.${x.id}`)} onClick={() => onPick(x.id)}>
													<span class="pdf-ico-tile" aria-hidden="true"><Icon name={x.icon} size={20} /></span>
													<span class="pdf-tool-name">{t(`tool.${x.id}`)}</span>
													{x.component ? null : <span class="pdf-soon">{t('soon')}</span>}
												</button>
											</li>
										))}
									</ul>
								</section>
							);
						})}
					</div>
				))}
			</div>
			{shown.length ? null : <p class="pdf-home-none" role="status">{t('home.none')}</p>}
		</div>
	);
}

function ToolPage({ t, tool, onBack }) {
	const Tool = tool.component;
	return (
		<StepProvider>
			<div class="pdf-page">
				<header class="pdf-page-head">
					<button type="button" class="pdf-back" onClick={onBack}><Icon name="left" size={18} />{t('nav.all')}</button>
					<div class="pdf-page-row">
						<div class="pdf-page-title">
							<span class="pdf-ico-tile pdf-ico-tile--lg" aria-hidden="true"><Icon name={tool.icon} size={24} /></span>
							<h2 class="pdf-title" id="pdf-title">{t(`tool.${tool.id}`)}</h2>
						</div>
						<Steps t={t} labels={tool.steps} />
					</div>
				</header>
				<section class="pdf-panel" aria-labelledby="pdf-title">
					{/* key: araç değişince durum (açılmış dosyalar) sıfırlanır */}
					<div class="pdf-tool"><Tool key={tool.id} t={t} /></div>
				</section>
			</div>
		</StepProvider>
	);
}

function App({ ctx }) {
	const t = useMemo(() => makeT(ctx.uiLang), [ctx.uiLang]);
	const [id, setId] = useState(toolFromHash);
	const [dir, setDir] = useState('');
	const root = useRef(null);
	const tool = TOOLS.find(x => x.id === id);

	useEffect(() => {
		const onHash = () => { setDir(''); setId(toolFromHash()); };
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	// Adres değişir ama geçmişe kayıt eklenmez: forumun kendi geri/ileri yönetimi (ajaxify) bozulmasın
	const go = (next) => {
		const rest = hashParts().slice(1).filter(Boolean).join('&'); // test sayfasının theme/ui parametreleri korunur
		const hash = [next, rest].filter(Boolean).join('&');
		window.history.replaceState(window.history.state, '', hash ? `#${hash}` : `${window.location.pathname}${window.location.search}`);
		setDir(next ? 'fwd' : 'back');
		setId(next);
		const top = root.current ? root.current.getBoundingClientRect().top : 0;
		if (top < 0) window.scrollBy({ top: top - 80 });
	};

	return (
		<div class="pdf-app" ref={root}>
			<div key={tool ? tool.id : 'home'} class={`pdf-view${dir ? ` pdf-enter-${dir}` : ''}`}>
				{tool ? <ToolPage t={t} tool={tool} onBack={() => go('')} /> : <Home t={t} onPick={go} />}
			</div>
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
