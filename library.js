'use strict';

const path = require('node:path');

const nconf = nodebb.require('nconf');
const meta = nodebb.require('./src/meta');
const routeHelpers = nodebb.require('./src/routes/helpers');

const manifest = require('./static/dist/manifest.json');

const plugin = module.exports;

// Uygulama dosyaları (JS, CSS, pdf.js, pdf-lib, yazı tipleri) NodeBB'nin /assets klasörüne kopyalanmaz, bu yoldan
// verilir. Herkese açıktır: araç giriş istemez. Aracı kimin göreceğine forum karar verir (misafire giriş kartı
// çizen bir eklenti gibi); dosyaların kendisi kimlik sormaz.
const APP_PATH = '/pdf-araclari/app';
const STATIC_DIR = path.join(__dirname, 'static');
const ALLOWED_DIR = /^(dist|fonts|pdf-[\d.]+)$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const assetBase = () => `${nconf.get('relative_path')}${APP_PATH}`;

plugin.init = async function (params) {
	const { router } = params;
	routeHelpers.setupPageRoute(router, '/pdf', renderPage);
	router.get(`${APP_PATH}/:dir/:file`, (req, res) => {
		const { dir, file } = req.params;
		if (!ALLOWED_DIR.test(dir) || !SAFE_FILE.test(file)) {
			return res.status(404).end();
		}
		// Dosya adları özetli/sürümlü: tarayıcı ve ara önbellekler 60 gün saklar
		res.sendFile(`${dir}/${file}`, {
			root: STATIC_DIR,
			dotfiles: 'deny',
			cacheControl: false,
			headers: { 'Cache-Control': 'public, max-age=5184000, immutable', 'X-Content-Type-Options': 'nosniff' },
		}, (err) => {
			if (err && !res.headersSent) {
				res.status(err.status === 404 || err.code === 'ENOENT' ? 404 : 500).end();
			}
		});
	});
};

// Sayfa kabuğu: uygulamanın kendisi (JS/CSS) yalnızca bu sayfada, önbelleklenen dosyalardan yüklenir.
// Dosyalar kullanıcının kendi tarayıcısında çalışır; sunucuya PDF gelmez, bu eklentinin veritabanı ya da API'si yoktur.
async function renderPage(req, res) {
	res.render('pdf', {
		title: '[[pdf-araclari:title]]',
		breadcrumbs: [{ text: '[[global:home]]', url: `${nconf.get('relative_path')}/` }, { text: '[[pdf-araclari:title]]' }],
		js: `${assetBase()}/dist/${manifest.js}`,
		css: `${assetBase()}/dist/${manifest.css}`,
		uid: req.uid > 0 ? req.uid : 0,
		defaultLang: meta.config.defaultLang || 'en-GB',
	});
}
