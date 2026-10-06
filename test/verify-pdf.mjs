// İndirilen PDF'i okur: sayfa sayısı, her sayfanın metni (etiket), boyutu ve dönüklüğü. Kullanım: node test/verify-pdf.mjs <dosya.pdf> [şifre]
import { readFile } from 'node:fs/promises';
import { inspectPdf } from './inspect.mjs';

const [file, password] = process.argv.slice(2);
const info = await inspectPdf(await readFile(file), password);
console.log(JSON.stringify({ file, pages: info.pages, rows: info.rows.map(r => ({ n: r.n, rotate: r.rotate, size: `${r.w}x${r.h}`, text: r.text.slice(0, 40) })) }, null, 1));
