// Resim listesi: küçük resim, ad, boyut; yukarı/aşağı, sürükle, kaldır. Resimden PDF, Resim çevir ve Resim küçült kullanır.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { fmtSize } from '../util.js';
import { MAX_IMAGE_MB, isImageFile, loadImage, previewUrl } from '../images.js';
import { moveItem, uid, useDragReorder } from './common.jsx';
import { Icon } from './icons.jsx';

// Dosyaları listeye ekler: açılabilenler { id, file, url, width, height } olur, açılamayanların adı errors'a gider
export async function readImages(files, t) {
	const items = [];
	const errors = [];
	for (const file of files) {
		if (!isImageFile(file)) { errors.push(t('err.imgtype', file.name)); continue; }
		try {
			const img = await loadImage(file);
			const entry = { id: uid(), file, url: previewUrl(file), width: img.width, height: img.height };
			img.close();
			items.push(entry);
		} catch (err) {
			errors.push(err.message === 'big' ? t('err.imgbig', file.name, MAX_IMAGE_MB) : t('err.image', file.name));
		}
	}
	return { items, errors };
}

export function ImageRows({ t, items, setItems, extra, onChange }) {
	const live = useRef(items);
	live.current = items;
	useEffect(() => () => live.current.forEach(it => URL.revokeObjectURL(it.url)), []);

	const change = (fn) => { setItems(fn); if (onChange) onChange(); };
	const move = (from, to) => change(list => moveItem(list, from, to));
	const remove = (id) => {
		const item = items.find(it => it.id === id);
		if (item) URL.revokeObjectURL(item.url);
		change(list => list.filter(it => it.id !== id));
	};
	const drag = useDragReorder(move);

	return (
		<ol class="pdf-files">
			{items.map((it, i) => (
				<li key={it.id} class={`pdf-file${drag.over === i ? ' is-target' : ''}`} {...drag.bind(i)}>
					<span class="pdf-file-grip" aria-hidden="true"><Icon name="grip" size={18} /></span>
					<img class="pdf-file-img" src={it.url} alt="" width="44" height="44" draggable={false} />
					<span class="pdf-file-main">
						<span class="pdf-file-name">{it.file.name}</span>
						<span class="pdf-file-meta">{it.width} × {it.height} px · {fmtSize(it.file.size)}{extra ? extra(it) : ''}</span>
					</span>
					<span class="pdf-file-actions">
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('up')}: ${it.file.name}`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="up" size={18} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('down')}: ${it.file.name}`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><Icon name="down" size={18} /></button>
						<button type="button" class="pdfb pdfb--icon" aria-label={`${t('remove')}: ${it.file.name}`} onClick={() => remove(it.id)}><Icon name="x" size={18} /></button>
					</span>
				</li>
			))}
		</ol>
	);
}

// Resim listesi durumu: ekle (hatalar ayrı satırlar), temizle
export function useImageList(t) {
	const [items, setItems] = useState([]);
	const [errors, setErrors] = useState([]);
	const add = useCallback(async (files) => {
		setErrors([]);
		const { items: added, errors: bad } = await readImages(files, t);
		setItems(list => [...list, ...added]);
		if (bad.length) setErrors(bad);
	}, [t]);
	const clear = useCallback(() => {
		setItems((list) => { list.forEach(it => URL.revokeObjectURL(it.url)); return []; });
		setErrors([]);
	}, []);
	return { items, setItems, errors, setErrors, add, clear };
}
