// Forumun gerçek sayfasının yerel kopyası: aracı forumun içinde görmek için (canlı foruma hiçbir şey yazılmaz).
// Forum sayfası misafir olarak okunur, betikleri çıkarılır (stiller forumdan gelir), menüye CV'nin altına "PDF Araçları"
// eklenir ve içerik alanına bu eklentinin uygulaması bağlanır. Canlı sayfa yerel dosyaları engellediği için bu yol var.
// Kullanım: node test/forum-shell.mjs  ->  http://127.0.0.1:8765/test/out/forum-shell.html#look=a (theme=dark, tool=merge)
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ORIGIN = 'https://yu.uniforum.app';
const manifest = JSON.parse(await readFile(new URL('../static/dist/manifest.json', import.meta.url), 'utf8'));
let html = await (await fetch(`${ORIGIN}/cv`, { headers: { 'Accept-Language': 'tr' } })).text();

// Forumun dosyaları yerel test sunucusunun /__forum/ yolundan gelir (forum başka kökene dosya vermiyor)
html = html.replace(/(href|src)="\/(?!\/)/g, '$1="/__forum/').split(`${ORIGIN}/`).join('/__forum/');
html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
html = html.replace(/<link[^>]+rel="(?:preload|modulepreload)"[^>]+as="script"[^>]*>/gi, '');

// Menü birden çok yerde çizilir (kenar çubuğu, mobil menü): her CV öğesinin kopyası hemen altına eklenir
const items = html.match(/<li class="nav-item[^"]*"[^>]*title="CV Oluşturucu">[\s\S]*?<\/li>/g) || [];
items.forEach((li) => {
	const copy = li.replace(/CV Oluşturucu/g, 'PDF Araçları').replace('href="/cv"', 'href="/pdf"').replace(/fa-file-lines|fa-file-alt/g, 'fa-file-pdf');
	html = html.replace(li, `${li}\n${copy}`);
});

const local = 'http://127.0.0.1:8765/static/dist/';
const mount = `
<link rel="stylesheet" href="${local}${manifest.css}">
<script src="${local}${manifest.js}"></script>
<script>
(function () {
	var params = new URLSearchParams(location.hash.replace(/^#/, ''));
	if (params.get('theme') === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.setAttribute('data-bs-theme', 'dark'); }
	var content = document.querySelector('#content');
	content.querySelectorAll('[data-widget-area]').forEach(function (el) { el.remove(); });
	content.innerHTML = '<div class="row flex-fill"><div class="pdf-yu-page w-100" id="pdf-yu-root"></div></div>';
	var host = document.getElementById('pdf-yu-root');
	var looks = [['a', 'A · Sade kart'], ['b', 'B · Kategori satırı'], ['c', 'C · Kısa liste']];
	var bar = document.createElement('div');
	bar.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:3000;display:flex;gap:6px;padding:6px;border:1px solid rgba(16,32,42,.15);border-radius:10px;background:#fff;box-shadow:0 8px 24px -8px rgba(16,32,42,.35);font:600 14px Inter,system-ui,sans-serif';
	function show(look) {
		params.set('look', look);
		history.replaceState(null, '', '#' + params.toString());
		window.YuPDF.unmount();
		window.YuPDF.mount(host, { uid: 1, relativePath: '', csrf: '', uiLang: 'tr', look: look });
		bar.querySelectorAll('button').forEach(function (b) { var on = b.dataset.look === look; b.style.background = on ? '#1a73e8' : 'transparent'; b.style.color = on ? '#fff' : '#1f272b'; });
	}
	looks.forEach(function (l) { var b = document.createElement('button'); b.type = 'button'; b.dataset.look = l[0]; b.textContent = l[1]; b.style.cssText = 'border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit'; b.onclick = function () { show(l[0]); }; bar.appendChild(b); });
	document.body.appendChild(bar);
	show(params.get('look') || 'a');
}());
</script>`;
html = html.replace(/<\/body>/i, `${mount}\n</body>`);

await mkdir(new URL('./out/', import.meta.url), { recursive: true });
await writeFile(new URL('./out/forum-shell.html', import.meta.url), html);
console.log(`forum-shell.html hazır (${items.length} menü öğesi eklendi)`);
