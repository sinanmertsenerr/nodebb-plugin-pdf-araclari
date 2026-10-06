// Şifre koy: PDF'i açma şifresiyle (AES-256) korur. Şifre ve dosya yalnızca bu tarayıcıda kalır.
import { useState } from 'preact/hooks';
import { download, loadClean } from '../pdf.js';
import { baseName, fmtSize, safeName } from '../util.js';
import { Check, Field, usePageSize, useSinglePdf } from '../ui/common.jsx';
import { PagePaper, Workspace, fitPage } from '../ui/workspace.jsx';
import { SingleGate } from './gate.jsx';

const MIN_LENGTH = 4;

// Sahip şifresi kullanıcıya gösterilmez ve saklanmaz: izinleri kimse şifreyle değiştiremez, açma şifresi yine de açar
function randomOwnerPassword() {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function ProtectTool({ t, opened, file, onAgain }) {
	const [pw, setPw] = useState('');
	const [again, setAgain] = useState('');
	const [show, setShow] = useState(false);
	const [print, setPrint] = useState(true);
	const [copy, setCopy] = useState(true);
	const [touched, setTouched] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	const tooShort = pw.length < MIN_LENGTH;
	const mismatch = again.length > 0 && again !== pw;
	const ready = !tooShort && again === pw && !busy;
	const type = show ? 'text' : 'password';
	const edit = (fn, value) => { fn(value); setResult(null); };

	const run = async () => {
		setTouched(true);
		if (!ready) {
			if (!tooShort && again !== pw) setError(t(again ? 'pw.mismatch' : 'pw.againNeed'));
			return;
		}
		setBusy(true);
		setError('');
		try {
			const doc = await loadClean(opened);
			doc.encrypt({
				userPassword: pw,
				ownerPassword: randomOwnerPassword(),
				permissions: {
					printing: print ? 'highResolution' : false,
					copying: copy,
					modifying: true,
					annotating: true,
					fillingForms: true,
					contentAccessibility: true,
					documentAssembly: true,
				},
			});
			const bytes = await doc.save();
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
			action={{ label: t('pw.go'), onClick: run, busy, icon: 'lock' }}
			result={result && { title: t('pw.done'), meta: fmtSize(result.bytes.length), onDownload: () => download(result.bytes, `${safeName(baseName(file.name))}-sifreli.pdf`, 'application/pdf'), onEdit: () => setResult(null), onAgain }}
			error={error}
		>
			<form class="pdf-form" onSubmit={(e) => { e.preventDefault(); run(); }} noValidate>
				<Field id="pdf-pw" label={t('pw.set')} error={touched && tooShort ? t('pw.short', MIN_LENGTH) : ''} hint={!tooShort && pw.length < 8 ? t('pw.weak') : ''}>
					<input id="pdf-pw" class="pdf-input" type={type} value={pw} autocomplete="new-password" data-bwignore data-1p-ignore data-lpignore="true" aria-invalid={touched && tooShort ? 'true' : undefined} aria-describedby={touched && tooShort ? 'pdf-pw-e' : undefined} onInput={e => edit(setPw, e.currentTarget.value)} />
				</Field>
				<Field id="pdf-pw2" label={t('pw.again')} error={mismatch ? t('pw.mismatch') : ''}>
					<input id="pdf-pw2" class="pdf-input" type={type} value={again} autocomplete="new-password" data-bwignore data-1p-ignore data-lpignore="true" aria-invalid={mismatch ? 'true' : undefined} aria-describedby={mismatch ? 'pdf-pw2-e' : undefined} onInput={e => edit(setAgain, e.currentTarget.value)} />
				</Field>
				<Check checked={show} onChange={setShow} label={t('pw.show')} />
				<button type="submit" class="pdf-visually-hidden" tabIndex={-1}>{t('pw.go')}</button>
			</form>
			<fieldset class="pdf-checks">
				<legend class="pdf-label">{t('pw.allow')}</legend>
				<Check checked={print} onChange={v => edit(setPrint, v)} label={t('pw.allowPrint')} />
				<Check checked={copy} onChange={v => edit(setCopy, v)} label={t('pw.allowCopy')} />
			</fieldset>
			<p class="pdf-note">{t('pw.note')}</p>
		</Workspace>
	);
}

export function Protect({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <ProtectTool t={t} opened={opened} file={file} onAgain={pdf.reset} />}</SingleGate>;
}
