// PDF düzenle ve İmzala: aynı düzenleyici, farklı araç takımı.
import { useSinglePdf } from '../ui/common.jsx';
import { Editor } from './editor.jsx';
import { SingleGate } from './gate.jsx';

export function Edit({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <Editor t={t} opened={opened} file={file} onAgain={pdf.reset} mode="edit" />}</SingleGate>;
}

export function Sign({ t }) {
	const pdf = useSinglePdf(t);
	return <SingleGate t={t} pdf={pdf}>{(opened, file) => <Editor t={t} opened={opened} file={file} onAgain={pdf.reset} mode="sign" />}</SingleGate>;
}
