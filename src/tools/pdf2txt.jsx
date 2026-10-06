// PDF'ten metin: sayfaların yazısını çıkarır; kopyala ya da TXT olarak indir. Taranmış sayfada yazı yoktur, söylenir.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { download } from '../pdf.js';
import { baseName, safeName } from '../util.js';
import { textOfPages, wordCount } from '../text.js';
import { notify } from '../notify.js';
import { Check, ErrorLine, useSinglePdf } from '../ui/common.jsx';
import { Icon } from '../ui/icons.jsx';
import { SingleGate } from './gate.jsx';

function PdfToTxtTool({ t, opened, file, onAgain }) {
	const [pages, setPages] = useState(null);
	const [progress, setProgress] = useState(0);
	const [breaks, setBreaks] = useState(false);
	const [error, setError] = useState('');

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
	const save = () => download(new TextEncoder().encode(`﻿${text}`), `${safeName(baseName(file.name))}.txt`, 'text/plain;charset=utf-8');

	if (!pages && !error) {
		return <p class="pdf-status" role="status">{t('p2t.reading', progress, opened.pages)}</p>;
	}
	return (
		<div>
			<p class="pdf-fileinfo"><strong>{file.name}</strong>{pages ? ` · ${t('p2t.stats', pages.length, wordCount(text))}` : ''}</p>
			<ErrorLine>{error}</ErrorLine>
			{empty
				? <p class="pdf-info" role="status"><Icon name="alert" size={18} />{t('p2t.empty')}</p>
				: (
					<div class="pdf-field pdf-field--wide pdf-grow">
						<label class="pdf-label" for="pdf-p2t-text">{t('p2t.label')}</label>
						<textarea id="pdf-p2t-text" class="pdf-textarea pdf-textarea--grow" readOnly value={text} spellcheck={false} />
					</div>
				)}
			<div class="pdf-actions">
				<Check checked={breaks} onChange={setBreaks} label={t('p2t.breaks')} />
				<span class="pdf-actions-info" />
				<button type="button" class="pdfb pdfb--secondary" onClick={onAgain}>{t('res.again')}</button>
				<button type="button" class="pdfb pdfb--secondary" disabled={!text} onClick={copy}><Icon name="copy" size={18} />{t('p2t.copy')}</button>
				<button type="button" class="pdfb pdfb--primary" disabled={!text} onClick={save}><Icon name="download" size={18} />{t('p2t.save')}</button>
			</div>
		</div>
	);
}

export function PdfToTxt({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <PdfToTxtTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
