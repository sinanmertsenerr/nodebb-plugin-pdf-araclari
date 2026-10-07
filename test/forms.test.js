'use strict';

// forms.js: form alanlarını okuma ve Türkçe harfli değerlerle yazma
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

test('readFields + writeFields: metin, açılır liste, seçenek ve onay kutusu', async () => {
	const lib = await import('@cantoo/pdf-lib');
	const { readFields, writeFields } = await import('../src/forms.js');
	const doc = await lib.PDFDocument.create();
	const page = doc.addPage([400, 400]);
	const form = doc.getForm();
	form.createTextField('ogrenci.ad').addToPage(page, { x: 20, y: 300, width: 200, height: 24 });
	const dd = form.createDropdown('bolum');
	dd.addOptions(['Yazılım', 'Endüstri']);
	dd.addToPage(page, { x: 20, y: 260, width: 200, height: 24 });
	const rg = form.createRadioGroup('sinif');
	rg.addOptionToPage('1', page, { x: 20, y: 220, width: 18, height: 18 });
	rg.addOptionToPage('2', page, { x: 60, y: 220, width: 18, height: 18 });
	form.createCheckBox('onay').addToPage(page, { x: 20, y: 180, width: 18, height: 18 });
	const fields = readFields(doc, lib);
	assert.deepEqual(fields.map(f => [f.label, f.kind]), [['ad', 'text'], ['bolum', 'select'], ['sinif', 'radio'], ['onay', 'check']]);
	// Yazı tipi yokken (fonts: null) Türkçe değer görüntüleyiciye bırakılır: NeedAppearances
	const res = writeFields(doc, lib, fields, { 'ogrenci.ad': 'Ayşe Yılmaz', bolum: 'Endüstri', sinif: '2', onay: true }, null);
	assert.equal(res.changed, 4);
	assert.equal(res.needAppearances, true);
	const back = await lib.PDFDocument.load(await doc.save({ updateFieldAppearances: false }));
	const f2 = back.getForm();
	assert.equal(f2.getTextField('ogrenci.ad').getText(), 'Ayşe Yılmaz');
	assert.deepEqual(f2.getDropdown('bolum').getSelected(), ['Endüstri']);
	assert.equal(f2.getRadioGroup('sinif').getSelected(), '2');
	assert.equal(f2.getCheckBox('onay').isChecked(), true);
});

test('form.pdf fikstürü varsa altı alan okunur', async (t) => {
	const file = path.join(__dirname, 'out/form.pdf');
	let bytes;
	try { bytes = await readFile(file); } catch (e) { t.skip('test/out/form.pdf yok (node test/make-fixtures.mjs)'); return; }
	const lib = await import('@cantoo/pdf-lib');
	const { readFields } = await import('../src/forms.js');
	const fields = readFields(await lib.PDFDocument.load(bytes), lib);
	assert.equal(fields.length, 6);
	assert.ok(fields.find(f => f.name === 'aciklama').multiline);
	assert.equal(fields.find(f => f.name === 'ogrenci.numara').maxLength, 10);
});
