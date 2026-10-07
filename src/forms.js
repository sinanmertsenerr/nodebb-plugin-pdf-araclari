// PDF form alanları: okuma (panelde doldurulacak liste) ve yazma (kaydederken). Metin, onay kutusu, seçenek düğmeleri,
// açılır liste ve seçim listesi desteklenir; düğme, imza ve salt okunur alanlar listelenmez.

// Alan adı çoğu zaman teknik olur ("topmostSubform[0].Page1[0].Ad[0]"): varsa ipucu (TU), yoksa adın son parçası
function labelOf(field, PDFName) {
	const tu = field.acroField.dict.get(PDFName.of('TU'));
	const hint = tu && typeof tu.decodeText === 'function' ? tu.decodeText().trim() : '';
	return hint || field.getName().split('.').pop().replace(/\[\d+\]/g, '').replace(/[_]+/g, ' ').trim() || field.getName();
}

// -> [{ name, label, kind: 'text' | 'check' | 'radio' | 'select', value, options, multiline, maxLength }]
export function readFields(doc, lib) {
	let form;
	try {
		form = doc.getForm();
	} catch (err) {
		return [];
	}
	const out = [];
	form.getFields().forEach((f) => {
		try {
			if (f.isReadOnly && f.isReadOnly()) return;
			const base = { name: f.getName(), label: labelOf(f, lib.PDFName) };
			if (f instanceof lib.PDFTextField) out.push({ ...base, kind: 'text', value: f.getText() || '', multiline: f.isMultiline(), maxLength: f.getMaxLength() || undefined });
			else if (f instanceof lib.PDFCheckBox) out.push({ ...base, kind: 'check', value: f.isChecked() });
			else if (f instanceof lib.PDFRadioGroup) out.push({ ...base, kind: 'radio', value: f.getSelected() || '', options: f.getOptions() });
			else if (f instanceof lib.PDFDropdown || f instanceof lib.PDFOptionList) out.push({ ...base, kind: 'select', value: (f.getSelected() || [])[0] || '', options: f.getOptions() });
		} catch (err) { /* okunamayan alan atlanır */ }
	});
	return out;
}

// Değişen değerleri yazar. Görünüm, değerin harflerini taşıyan gömülü yazı tipiyle çizilir; taşıyan yoksa (ör. "Ayşe": ş başka
// alt kümede) görüntüleyicinin çizmesi için NeedAppearances açılır. -> { changed: sayı, needAppearances }
export function writeFields(doc, lib, fields, values, fonts) {
	const form = doc.getForm();
	let changed = 0;
	let needAppearances = false;
	fields.forEach((f) => {
		const v = values[f.name];
		if (v === undefined || v === f.value) return;
		changed += 1;
		if (f.kind === 'text') {
			const field = form.getTextField(f.name);
			field.setText(v);
			const font = v && fonts ? fonts.covering(v) : null;
			if (font) field.updateAppearances(font);
			else if (v) needAppearances = true;
		} else if (f.kind === 'check') {
			const field = form.getCheckBox(f.name);
			if (v) field.check(); else field.uncheck();
		} else if (f.kind === 'radio') {
			const field = form.getRadioGroup(f.name);
			if (v) field.select(v); else field.clear();
		} else if (f.kind === 'select') {
			let field;
			try { field = form.getDropdown(f.name); } catch (err) { field = form.getOptionList(f.name); }
			if (v) field.select(v); else field.clear();
			const font = v && fonts ? fonts.covering(v) : null;
			if (font) field.updateAppearances(font);
			else if (v) needAppearances = true;
		}
	});
	if (needAppearances) form.acroForm.dict.set(lib.PDFName.of('NeedAppearances'), lib.PDFBool.True);
	return { changed, needAppearances };
}
