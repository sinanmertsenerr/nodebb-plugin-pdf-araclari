// Resim çevir: JPG, PNG ve WebP arasında çevirir. Tek resim tek dosya, çok resim ZIP olur.
import { useEffect, useState } from 'preact/hooks';
import { download } from '../pdf.js';
import { FORMATS, canvasBytes, drawToCanvas, loadImage, webpSupported } from '../images.js';
import { baseName, fmtSize, safeName, uniqueNames } from '../util.js';
import { zip } from '../zip.js';
import { Dropzone, ErrorLine, Radios, Slider } from '../ui/common.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { ImageRows, useImageList } from '../ui/ImageRows.jsx';

export function ImgConv({ t }) {
	const list = useImageList(t);
	const [format, setFormat] = useState('jpg');
	const [quality, setQuality] = useState(90);
	const [webp, setWebp] = useState(true);
	const [busy, setBusy] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);
	const { items } = list;

	useEffect(() => { webpSupported().then(setWebp); }, []);

	const run = async () => {
		setError('');
		try {
			const fmt = FORMATS[format];
			const files = [];
			for (const [i, it] of items.entries()) {
				setBusy(t('busy.page', i + 1, items.length));
				const img = await loadImage(it.file);
				// JPG saydamlığı bilmez: saydam alan beyaza boyanır
				const canvas = drawToCanvas(img, { background: format === 'jpg' ? '#ffffff' : null });
				files.push({ name: `${safeName(baseName(it.file.name))}.${fmt.ext}`, data: await canvasBytes(canvas, fmt.type, quality / 100) });
				img.close();
				canvas.width = 1;
				canvas.height = 1;
			}
			if (files.length === 1) {
				setResult({ bytes: files[0].data, name: files[0].name, type: fmt.type, meta: fmtSize(files[0].data.length) });
			} else {
				const names = uniqueNames(files.map(f => f.name));
				const bytes = zip(files.map((f, i) => ({ name: names[i], data: f.data })));
				setResult({ bytes, name: `resimler-${fmt.ext}.zip`, type: 'application/zip', meta: `${files.length} ${format.toUpperCase()} · ${fmtSize(bytes.length)}` });
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
	const lossy = format !== 'png';
	const edit = fn => (v) => { fn(v); setResult(null); };
	const formats = [{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, ...(webp ? [{ value: 'webp', label: 'WebP' }] : [])];
	return (
		<Workspace
			t={t}
			canvas={(
				<div class="pdf-canvas-list">
					<ImageRows t={t} items={items} setItems={list.setItems} onChange={() => setResult(null)} />
					<Dropzone t={t} many compact kind="image" onFiles={(f) => { setResult(null); list.add(f); }} />
				</div>
			)}
			action={{ label: t('ic.go'), onClick: run, busy, info: t('i2p.count', items.length) }}
			result={result && { meta: result.meta, onDownload: () => download(result.bytes, result.name, result.type), onEdit: () => setResult(null), onAgain: () => { list.clear(); setResult(null); } }}
			error={[...list.errors, error]}
		>
			<Radios name="pdf-ic-format" legend={t('ic.to')} value={format} onChange={edit(setFormat)} options={formats} />
			{lossy ? <Slider id="pdf-ic-q" label={t('ic.quality')} min={50} max={100} step={5} value={quality} onChange={edit(setQuality)} format={v => t('pct', v)} /> : <p class="pdf-hint">{t('ic.pngNote')}</p>}
		</Workspace>
	);
}
