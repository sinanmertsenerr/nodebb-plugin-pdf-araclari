'use strict';

// Şifresi çözülen belge temiz kaydedilmeli: yeniden açılınca "şifreli" sanılmamalı (Şifre aç, Küçült, Filigran… şifreli kaynakla)
const test = require('node:test');
const assert = require('node:assert/strict');

test('stripEncryption: şifre çözülmüş belge şifresiz ve açılabilir kaydedilir', async () => {
	const lib = await import('@cantoo/pdf-lib');
	const { stripEncryption } = await import('../src/pdf.js');
	const src = await lib.PDFDocument.create();
	src.addPage([200, 200]).drawText('gizli', { x: 20, y: 100 });
	src.encrypt({ userPassword: '1234', ownerPassword: 'sahip', permissions: { documentAssembly: true, modifying: true, copying: true, printing: true } });
	const locked = await src.save();
	await assert.rejects(lib.PDFDocument.load(locked), /encrypted/i);
	const doc = await lib.PDFDocument.load(locked, { password: '1234' });
	stripEncryption(doc, lib);
	for (const useObjectStreams of [true, false]) {
		const out = await doc.save({ useObjectStreams });
		const back = await lib.PDFDocument.load(out);
		assert.equal(back.isEncrypted, false);
		assert.equal(back.getPageCount(), 1);
		assert.ok(!Buffer.from(out).toString('latin1').includes('/Encrypt'), 'çıktıda şifre kaydı kalmamalı');
	}
});
