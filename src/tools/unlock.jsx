// Şifre aç: şifresini bildiğin PDF'in şifresini kaldırır. Şifre sorulur; dosya ve şifre yalnızca bu tarayıcıda kalır.
import { useEffect, useState } from 'preact/hooks';
import { download, isEncryptedBytes, loadClean } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { usePageSize, useSinglePdf } from '../ui/common.jsx';
import { PagePaper, Workspace, fitPage } from '../ui/workspace.jsx';
import { Icon } from '../ui/icons.jsx';
import { SingleGate } from './gate.jsx';

function UnlockTool({ t, opened, file, onAgain }) {
	const [encrypted, setEncrypted] = useState(null); // null: bakılıyor
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	useEffect(() => {
		let dead = false;
		isEncryptedBytes(opened.bytes).then((v) => { if (!dead) setEncrypted(v); }).catch(() => { if (!dead) setEncrypted(false); });
		return () => { dead = true; };
	}, [opened]);

	const run = async () => {
		setBusy(true);
		setError('');
		try {
			const bytes = await (await loadClean(opened)).save({ useObjectStreams: true });
			setResult({ bytes });
		} catch (err) {
			setError(t('err.fail'));
		} finally {
			setBusy(false);
		}
	};

	const frame = usePageSize(opened.doc, 1);
	return (
		<Workspace
			t={t} file={file.name} meta={`${t('pages', opened.pages)} · ${fmtSize(file.size)}`} onChangeFile={onAgain}
			canvas={box => <PagePaper doc={opened.doc} page={1} width={fitPage(box, frame)} />}
			action={encrypted === false ? null : { label: t('un.go'), onClick: run, busy: busy || encrypted === null, icon: 'unlock' }}
			result={result && { title: t('un.done'), meta: fmtSize(result.bytes.length), onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-sifresiz.pdf`, 'application/pdf'), onAgain }}
			error={error}
		>
			{encrypted === false
				? <p class="pdf-info" role="status"><Icon name="circle-check" size={18} />{t('un.none')}</p>
				: <p class="pdf-info" role="status"><Icon name={opened.password ? 'unlock' : 'lock'} size={18} />{opened.password ? t('un.opened') : t('un.ownerOnly')}</p>}
		</Workspace>
	);
}

export function Unlock({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <UnlockTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
