// PDF'ten metin: sayfaların yazısını çıkarır; kopyala ya da TXT olarak indir. Taranmış sayfada yazı yoktur, söylenir.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { download } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { textOfPages, wordCount } from '../text.js';
import { notify } from '../notify.js';
import { Check, useSinglePdf } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { useStepMark } from '../ui/steps.jsx';
import { Workspace } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

function PdfToTxtTool({ t, opened, file, onAgain }) {
	const [pages, setPages] = useState(null);
	const [progress, setProgress] = useState(0);
	const [breaks, setBreaks] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState('');
	useStepMark('done', saved);

	useEffect(() => {
		let dead = false;
		textOfPages(opened.doc, (n) => { if (!dead) setProgress(n); })
			.then((list) => { if (!dead) setPages(list); })
			.catch(() => { if (!dead) setError(t('err.fail')); });
		return () => { dead = true; };
	}, [opened]);

	const text = useMemo(() => {
		if (!pages) return '';
		if (!breaks) return pages.filter(Boolean).join('\n\n');
		return pages.map((p, i) => `${t('p2t.pageMark', i + 1)}\n${p}`).join('\n\n');
	}, [pages, breaks, t]);
	const empty = pages && !pages.some(Boolean);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			notify({ type: 'success', title: t('p2t.copied'), message: t('p2t.stats', pages.length, wordCount(text)) });
		} catch (err) {
			setError(t('p2t.copyFail'));
		}
	};
	const save = () => {
		if (!text) return;
		download(new TextEncoder().encode(`﻿${text}`), `${safeName(baseName(file.name))}.txt`, 'text/plain;charset=utf-8');
		setSaved(true);
	};

	let canvas;
	if (!pages && !error) canvas = <p class="pdf-status pdf-status--canvas" role="status"><span class="pdf-yu-spinner" aria-hidden="true" />{t('p2t.reading', progress, opened.pages)}</p>;
	else if (empty) canvas = <p class="pdf-info pdf-info--canvas" role="status"><Icon name="alert" size={18} />{t('p2t.empty')}</p>;
	else {
		canvas = (
			<div class="pdf-textpaper">
				<label class="pdf-visually-hidden" for="pdf-p2t-text">{t('p2t.label')}</label>
				<textarea id="pdf-p2t-text" class="pdf-textpaper-area" readOnly value={text} spellcheck={false} />
			</div>
		);
	}

	return (
		<Workspace
			t={t} file={file.name} meta={pages ? t('p2t.stats', pages.length, wordCount(text)) : `${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={canvas}
			action={text ? { label: t('p2t.save'), onClick: save, icon: 'download' } : null}
			error={error}
		>
			<Check checked={breaks} onChange={setBreaks} label={t('p2t.breaks')} disabled={!text} />
			<button type="button" class="pdfb pdfb--secondary pdfb--block" disabled={!text} onClick={copy}><Icon name="copy" size={18} />{t('p2t.copy')}</button>
		</Workspace>
	);
}

export function PdfToTxt({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <PdfToTxtTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
