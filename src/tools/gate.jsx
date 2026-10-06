// Tek PDF alan araçların girişi: dosya yoksa bırakma alanı, şifreliyse şifre sorusu, açıldıysa araç.
import { Dropzone, ErrorLine, PasswordPrompt } from '../ui/common.jsx';

export function SingleGate({ t, pdf, children }) {
	const { state, loading, error, pick, unlock } = pdf;
	if (state && state.opened) return children(state.opened, state.file);
	return (
		<div>
			{state && state.locked
				? <PasswordPrompt t={t} name={state.file.name} wrong={state.wrong} onSubmit={unlock} />
				: <Dropzone t={t} many={false} onFiles={pick} />}
			{loading ? <p class="pdf-status" role="status">{t('loading')}</p> : null}
			<ErrorLine>{error}</ErrorLine>
		</div>
	);
}
