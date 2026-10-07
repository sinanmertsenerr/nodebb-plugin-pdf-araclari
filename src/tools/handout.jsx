// Çıktıya hazırla: bir kâğıda 2, 4, 6 ya da 9 sayfa (slayt) dizer. Normalde sayfalar vektör kalır (yazı net, dosya küçük);
// "koyu slaytları beyaza çevir" ya da "siyah beyaz" seçilince sayfalar resme çevrilip renkleri değiştirilir.
import { useEffect, useState } from 'preact/hooks';
import { download, getLib, loadClean, renderToCanvas } from '../pdf.js';
import { canvasBytes } from '../images.js';
import { fitInto, invertLightness, meanLightness, nupLayout, pickSheet, toGray } from '../nup.js';
import { pageFrame } from '../stamp.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Check, Radios, useSinglePdf } from '../ui/common.jsx';
import { BytesPaper, Workspace, fitPage } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

const DARK = 110; // ortalama parlaklık bunun altındaysa sayfa koyu sayılır

// Sayfa resmine renk işlemleri: koyuysa parlaklığı çevir, istenirse gri yap
function recolor(canvas, { invert, gray }) {
	if (!invert && !gray) return;
	const ctx = canvas.getContext('2d');
	const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
	if (invert && meanLightness(img.data) < DARK) invertLightness(img.data);
	if (gray) toGray(img.data);
	ctx.putImageData(img, 0, 0);
}

// limit: yalnız ilk kâğıt (önizleme). dpi: resim modunda çözünürlük
export async function buildHandout(opened, opts, { limit = Infinity, dpi = 150 } = {}) {
	const { PDFDocument, rgb, degrees } = await getLib();
	const src = await loadClean(opened);
	const pages = src.getPages().slice(0, limit === Infinity ? undefined : opts.per * limit);
	const seen = pages.map(p => pageFrame(p));
	const sheet = pickSheet(opts.per, seen[0], opts.orient);
	const grid = nupLayout(opts.per, sheet, seen[0]);
	const raster = opts.invert || opts.gray;
	const out = await PDFDocument.create();
	const embedded = raster ? null : await out.embedPages(pages, pages.map((p) => {
		const b = p.getCropBox();
		return { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height };
	}));
	for (let i = 0; i < pages.length; i += opts.per) {
		const sheetPage = out.addPage([sheet.w, sheet.h]);
		for (let k = 0; k < opts.per && i + k < pages.length; k += 1) {
			const v = seen[i + k];
			const fit = fitInto(grid.cells[k], v);
			if (raster) {
				const canvas = await renderToCanvas(opened.doc, i + k + 1, { dpi, background: '#ffffff' });
				recolor(canvas, opts);
				const image = await out.embedJpg(await canvasBytes(canvas, 'image/jpeg', 0.85));
				sheetPage.drawImage(image, { x: fit.x, y: fit.y, width: fit.w, height: fit.h });
				canvas.width = 1;
				canvas.height = 1;
			} else {
				// Gömülen sayfa döndürülmemiş hâliyle gelir: görünen yönüne çevrilerek konur
				let { x, y } = fit;
				let turn = 0;
				if (v.rot === 90) { turn = -90; y = fit.y + fit.h; } else if (v.rot === 180) { turn = 180; x = fit.x + fit.w; y = fit.y + fit.h; } else if (v.rot === 270) { turn = 90; x = fit.x + fit.w; }
				sheetPage.drawPage(embedded[i + k], { x, y, xScale: fit.s, yScale: fit.s, rotate: degrees(turn) });
			}
			if (opts.frame) sheetPage.drawRectangle({ x: fit.x, y: fit.y, width: fit.w, height: fit.h, borderColor: rgb(0.62, 0.65, 0.68), borderWidth: 0.6 });
		}
	}
	return { bytes: await out.save({ useObjectStreams: true }), sheets: out.getPageCount(), sheet };
}

function HandoutTool({ t, opened, file, onAgain }) {
	const [per, setPer] = useState('4');
	const [orient, setOrient] = useState('auto');
	const [frame, setFrame] = useState(true);
	const [invert, setInvert] = useState(false);
	const [gray, setGray] = useState(false);
	const [preview, setPreview] = useState(null);
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const opts = { per: Number(per), orient, frame, invert, gray };
	const key = JSON.stringify(opts);
	const sheets = Math.ceil(opened.pages / opts.per);
	const edit = fn => (v) => { fn(v); setResult(null); };

	// Önizleme: ilk kâğıt, gerçek çıktıyla aynı hesapla (resim modunda düşük çözünürlük)
	useEffect(() => {
		let dead = false;
		const id = setTimeout(() => {
			buildHandout(opened, opts, { limit: 1, dpi: 72 }).then((out) => { if (!dead) setPreview(out); }).catch(() => {});
		}, 250);
		return () => { dead = true; clearTimeout(id); };
	}, [key]);

	const run = async () => {
		setBusy(t('busy'));
		setError('');
		try {
			setResult(await buildHandout(opened, opts));
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy('');
		}
	};

	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={box => <BytesPaper bytes={preview && preview.bytes} width={fitPage(box, preview ? preview.sheet : { w: 595, h: 842 })} caption={t('ho.first')} />}
			action={{ label: t('ho.go'), onClick: run, busy, info: t('ho.count', opened.pages, sheets) }}
			result={result && { title: t('ho.done'), meta: `${t('ho.sheets', result.sheets)} · ${fmtSize(result.bytes.length)}`, onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-cikti.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<Radios name="pdf-ho-per" legend={t('ho.per')} value={per} onChange={edit(setPer)} options={['2', '4', '6', '9'].map(v => ({ value: v, label: v }))} />
			<Radios name="pdf-ho-orient" legend={t('ho.sheet')} value={orient} onChange={edit(setOrient)} options={[{ value: 'auto', label: t('ho.auto') }, { value: 'port', label: t('txt.port') }, { value: 'land', label: t('txt.land') }]} />
			<Check checked={frame} onChange={edit(setFrame)} label={t('ho.frame')} />
			<Check checked={invert} onChange={edit(setInvert)} label={t('ho.invert')} />
			<Check checked={gray} onChange={edit(setGray)} label={t('ho.gray')} />
			{invert || gray ? <p class="pdf-note">{t('ho.rasterNote')}</p> : null}
		</Workspace>
	);
}

export function Handout({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <HandoutTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
