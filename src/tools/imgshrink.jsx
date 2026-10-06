// Resim küçült: en uzun kenarı ve kaliteyi düşürür. Tür korunur (JPG JPG, PNG PNG, WebP WebP); küçülmeyen resim olduğu gibi kalır.
import { useState } from 'preact/hooks';
import { download } from '../pdf.js';
import { FORMATS, canvasBytes, drawToCanvas, loadImage } from '../images.js';
import { baseName, fmtSize, safeName, uniqueNames } from '../util.js';
import { zip } from '../zip.js';
import { Dropzone, ErrorLine, Radios, Slider } from '../ui/common.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { ImageRows, useImageList } from '../ui/ImageRows.jsx';

const EDGES = { e1: 800, e2: 1280, e3: 1600, e4: 2400 };

// Çıktı türü: JPG/PNG/WebP korunur; diğer her şey (GIF, BMP, AVIF, SVG) JPG olur
export function outputFormat(file) {
	if (/png/i.test(file.type) || /\.png$/i.test(file.name)) return 'png';
	if (/webp/i.test(file.type) || /\.webp$/i.test(file.name)) return 'webp';
	return 'jpg';
}

export function ImgShrink({ t }) {
	const list = useImageList(t);
	const [edge, setEdge] = useState('e2');
	const [quality, setQuality] = useState(75);
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const { items } = list;

	const run = async () => {
		setError('');
		try {
			const files = [];
			let before = 0;
			let after = 0;
			for (const [i, it] of items.entries()) {
				setBusy(t('busy.page', i + 1, items.length));
				const key = outputFormat(it.file);
				const fmt = FORMATS[key];
				const img = await loadImage(it.file);
				const canvas = drawToCanvas(img, { maxSide: EDGES[edge], background: key === 'jpg' ? '#ffffff' : null });
				const bytes = await canvasBytes(canvas, fmt.type, quality / 100);
				const original = new Uint8Array(await it.file.arrayBuffer());
				// Küçülmediyse özgün dosya kalır: resmi büyütmek kimsenin işine yaramaz
				const smaller = bytes.length < original.length && fmt.type === it.file.type;
				const data = smaller ? bytes : (fmt.type === it.file.type ? original : bytes);
				files.push({ name: `${safeName(baseName(it.file.name))}.${fmt.ext}`, data });
				before += original.length;
				after += data.length;
				img.close();
				canvas.width = 1;
				canvas.height = 1;
			}
			const saved = before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
			const meta = `${fmtSize(before)} → ${fmtSize(after)}`;
			const title = saved ? t('cmp.saved', saved) : t('cmp.same');
			if (files.length === 1) {
				setResult({ bytes: files[0].data, name: files[0].name, type: FORMATS[outputFormat(items[0].file)].type, meta, title });
			} else {
				const names = uniqueNames(files.map(f => f.name));
				const bytes = zip(files.map((f, i) => ({ name: names[i], data: f.data })));
				setResult({ bytes, name: 'kucuk-resimler.zip', type: 'application/zip', meta: `${files.length} · ${meta}`, title });
			}
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy('');
		}
	};

	if (!items.length) {
		return (
			<div>
				<Dropzone t={t} many kind="image" onFiles={list.add} />
				<ErrorLine>{list.errors}</ErrorLine>
			</div>
		);
	}
	const edit = fn => (v) => { fn(v); setResult(null); };
	return (
		<Workspace
			t={t}
			canvas={(
				<div class="pdf-canvas-list">
					<ImageRows t={t} items={items} setItems={list.setItems} onChange={() => setResult(null)} />
					<Dropzone t={t} many compact kind="image" onFiles={(f) => { setResult(null); list.add(f); }} />
				</div>
			)}
			action={{ label: t('is.go'), onClick: run, busy, info: t('i2p.count', items.length) }}
			result={result && { title: result.title, meta: result.meta, onDownload: () => download(result.bytes, result.name, result.type), onEdit: () => setResult(null), onAgain: () => { list.clear(); setResult(null); } }}
			error={[...list.errors, error]}
		>
			<Radios name="pdf-is-edge" legend={t('is.edge')} value={edge} onChange={edit(setEdge)} cards options={[
				{ value: 'e1', label: t('is.e1'), hint: `${EDGES.e1} px` },
				{ value: 'e2', label: t('is.e2'), hint: `${EDGES.e2} px` },
				{ value: 'e3', label: t('is.e3'), hint: `${EDGES.e3} px` },
				{ value: 'e4', label: t('is.e4'), hint: `${EDGES.e4} px` },
			]} />
			<Slider id="pdf-is-q" label={t('ic.quality')} min={40} max={95} step={5} value={quality} onChange={edit(setQuality)} format={v => t('pct', v)} />
		</Workspace>
	);
}
