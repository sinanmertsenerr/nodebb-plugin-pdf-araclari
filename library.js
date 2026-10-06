'use strict';

const path = require('node:path');

const nconf = nodebb.require('nconf');
const meta = nodebb.require('./src/meta');
const routeHelpers = nodebb.require('./src/routes/helpers');

const manifest = require('./static/dist/manifest.json');

const plugin = module.exports;

// Uygulama dosyaları (JS, CSS, pdf.js, pdf-lib, yazı tipleri) herkese açık /assets altında değil, yalnızca girişli
// kullanıcıya bu yoldan verilir: misafir uygulamayı dosyalarından da çalıştıramaz.
const APP_PATH = '/pdf-araclari/app';
const STATIC_DIR = path.join(__dirname, 'static');
const ALLOWED_DIR = /^(dist|fonts|pdf-[\d.]+)$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const assetBase = () => `${nconf.get('relative_path')}${APP_PATH}`;

plugin.init = async function (params) {
	const { router, middleware } = params;
	routeHelpers.setupPageRoute(router, '/pdf', renderPage);
	router.get(`${APP_PATH}/:dir/:file`, middleware.authenticateRequest, (req, res) => {
		if (!(req.uid > 0)) {
			return res.status(401).set('Cache-Control', 'no-store').end();
		}
		const { dir, file } = req.params;
		if (!ALLOWED_DIR.test(dir) || !SAFE_FILE.test(file)) {
			return res.status(404).end();
		}
		// Dosya adları özetli/sürümlü: tarayıcı 60 gün saklar; "private" ortak önbelleklerin misafire vermesini önler
		res.sendFile(`${dir}/${file}`, {
			root: STATIC_DIR,
			dotfiles: 'deny',
			cacheControl: false,
			headers: { 'Cache-Control': 'private, max-age=5184000, immutable', 'X-Content-Type-Options': 'nosniff' },
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
