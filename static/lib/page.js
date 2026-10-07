'use strict';

// /pdf sayfasının NodeBB modülü. Uygulamanın kendisi büyük olduğu için her sayfaya gömülmez;
// burada yalnızca bu sayfada, özetli (önbelleklenen) dosyalardan yüklenir ve bağlanır.
define('forum/pdf', ['hooks', 'alerts'], function (hooks, alerts) {
	const Page = {};
	let mounted = false;
	let clarityPaused = false;

	// Forumda Microsoft Clarity varsa bu sayfada kayıt durur, çıkınca devam eder (CV Oluşturucu gibi).
	// İçeriği asıl koruyan şablondaki data-clarity-mask; pause/resume belgelenmemiş komutlar, en iyi çaba.
	function clarity(command) {
		try {
			if (typeof window.clarity === 'function') {
				window.clarity(command);
				return true;
			}
		} catch (err) { /* Clarity yoksa ya da komutu tanımıyorsa önemli değil */ }
		return false;
	}

	function loadOnce(tag, attrs, key) {
		return new Promise(function (resolve, reject) {
			const existing = document.querySelector(`${tag}[data-pdf-araclari="${key}"]`);
			if (existing) {
				if (existing.dataset.ready === '1') {
					return resolve();
				}
				existing.addEventListener('load', () => resolve());
				existing.addEventListener('error', () => reject(new Error(`pdf-araclari: ${key} failed`)));
				return;
			}
			const el = document.createElement(tag);
			Object.keys(attrs).forEach((k) => { el.setAttribute(k, attrs[k]); });
			el.dataset.pdfAraclari = key;
			el.addEventListener('load', () => { el.dataset.ready = '1'; resolve(); });
			el.addEventListener('error', () => reject(new Error(`pdf-araclari: ${key} failed`)));
			document.head.appendChild(el);
		});
	}

	Page.init = async function () {
		const root = document.getElementById('pdf-yu-root');
		if (!root) {
			return;
		}
		clarityPaused = clarity('pause');
		try {
			await Promise.all([
				loadOnce('link', { rel: 'stylesheet', href: root.dataset.css }, 'css'),
				loadOnce('script', { src: root.dataset.js, defer: '' }, 'js'),
			]);
			window.YuPDF.mount(root, {
				uid: parseInt(root.dataset.uid, 10) || 0,
				relativePath: config.relative_path || '',
				csrf: config.csrf_token,
				uiLang: config.userLang || root.dataset.defaultLang || 'en-GB',
				// Başarı bildirimi forumun kendi uyarısıyla (sağ altta) gösterilir
				notify: function (n) {
					alerts.alert({ type: n.type, title: n.title, message: n.message, timeout: n.timeout, alert_id: 'pdf-araclari' });
				},
			});
			mounted = true;
		} catch (err) {
			root.innerHTML = `<div class="alert alert-danger m-3">${err.message}</div>`;
		}
	};

	hooks.on('action:ajaxify.start', function () {
		if (mounted && window.YuPDF) {
			window.YuPDF.unmount();
			mounted = false;
		}
		if (clarityPaused) {
			clarity('resume');
			clarityPaused = false;
		}
	});

	return Page;
});
