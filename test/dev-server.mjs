// Yerel test sunucusu: depoyu sunar ve test sayfasının indirdiği dosyaları test/out/downloads/ altına kaydeder.
// Kullanım: node test/dev-server.mjs [port]   (yalnızca 127.0.0.1'e bağlanır)
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saveDir = path.join(root, 'test/out/downloads');
const port = Number(process.argv[2]) || 8765;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };

createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://127.0.0.1');
		if (req.method === 'PUT' && url.pathname.startsWith('/__save/')) {
			const name = path.basename(decodeURIComponent(url.pathname.slice('/__save/'.length)));
			const chunks = [];
			for await (const c of req) chunks.push(c);
			await mkdir(saveDir, { recursive: true });
			await writeFile(path.join(saveDir, name), Buffer.concat(chunks));
			res.writeHead(204).end();
			return;
		}
		const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
		if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
		const body = await readFile(file);
		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }).end(body);
	} catch (err) {
		res.writeHead(404).end('yok');
	}
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/static/dist/harness.html`));
