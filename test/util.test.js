'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('parseRanges, formatRanges, fmtSize, names', async () => {
	const { parseRanges, formatRanges, fmtSize, baseName, safeName, uniqueNames } = await import('../src/util.js');

	assert.deepEqual(parseRanges('1-3, 5, 8-10', 12), [1, 2, 3, 5, 8, 9, 10]);
	assert.deepEqual(parseRanges('3-1', 5), [1, 2, 3], 'ters aralık düzelir');
	assert.deepEqual(parseRanges('2 2 2', 5), [2], 'tekrar eden sayfa bir kez');
	assert.deepEqual(parseRanges('', 5), []);
	assert.equal(parseRanges('0', 5), null);
	assert.equal(parseRanges('6', 5), null, 'sayfa sayısını aşan geçersiz');
	assert.equal(parseRanges('1-x', 5), null);
	assert.equal(parseRanges('1--3', 5), null);

	assert.equal(formatRanges([1, 2, 3, 5, 8, 9, 10]), '1-3, 5, 8-10');
	assert.equal(formatRanges([4]), '4');
	assert.equal(formatRanges([]), '');
	assert.equal(formatRanges([2, 1, 2]), '1-2');
	assert.equal(formatRanges(parseRanges('1-3, 5', 9)), '1-3, 5');

	assert.equal(fmtSize(0), '0 B');
	assert.equal(fmtSize(900), '900 B');
	assert.equal(fmtSize(1536), '1,5 KB');
	assert.equal(fmtSize(2 * 1024 * 1024), '2 MB');
	assert.equal(fmtSize(1.2 * 1024 * 1024), '1,2 MB');
	assert.equal(fmtSize(25 * 1024 * 1024), '25 MB');

	assert.equal(baseName('Ödev Final (1).pdf'), 'Ödev Final (1)');
	assert.equal(baseName('arşiv.tar.gz'), 'arşiv.tar');
	assert.equal(baseName(''), 'dosya');
	assert.equal(safeName('a/b\\c:d*e?.pdf'), 'a_b_c_d_e_.pdf');
	assert.equal(safeName('   '), 'dosya');
	assert.deepEqual(uniqueNames(['a.pdf', 'a.pdf', 'b.pdf', 'a.pdf']), ['a.pdf', 'a (2).pdf', 'b.pdf', 'a (3).pdf']);
});

test('zip: geçerli ZIP üretir, Türkçe adlar ve içerik bozulmaz', async () => {
	const { zip, crc32 } = await import('../src/zip.js');
	const { execFileSync } = require('node:child_process');
	const fs = require('node:fs');
	const os = require('node:os');
	const path = require('node:path');

	assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'CRC-32 standart değeri');

	const data = [
		{ name: 'ödev-sayfa-1.pdf', data: new TextEncoder().encode('%PDF-1.4 bir') },
		{ name: 'şiir.pdf', data: new Uint8Array(70000).map((_, i) => i % 251) },
		{ name: 'boş.pdf', data: new Uint8Array(0) },
	];
	const bytes = zip(data);

	// ZIP'i kendimiz okuruz: merkez dizin sonundan girişleri, adları (UTF-8) ve içeriği çıkar
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const end = bytes.length - 22;
	assert.equal(view.getUint32(end, true), 0x06054B50);
	const count = view.getUint16(end + 10, true);
	assert.equal(count, 3);
	let at = view.getUint32(end + 16, true);
	const found = [];
	for (let i = 0; i < count; i += 1) {
		assert.equal(view.getUint32(at, true), 0x02014B50);
		const crc = view.getUint32(at + 16, true);
		const size = view.getUint32(at + 24, true);
		const nameLen = view.getUint16(at + 28, true);
		const local = view.getUint32(at + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const body = bytes.subarray(start, start + size);
		assert.equal(crc32(body), crc, `${name} CRC`);
		found.push({ name, body });
		at += 46 + nameLen;
	}
	assert.deepEqual(found.map(f => f.name), data.map(d => d.name));
	found.forEach((f, i) => assert.deepEqual(Buffer.from(f.body), Buffer.from(data[i].data)));

	// Sistemde unzip varsa bütünlüğü ayrıca ona da doğrulatırız
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
	const file = path.join(dir, 'x.zip');
	fs.writeFileSync(file, bytes);
	try {
		assert.match(execFileSync('unzip', ['-t', file], { encoding: 'utf8' }), /No errors detected/);
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	} finally {
		fs.rmSync(dir, { recursive: true });
	}
});

test('i18n: Türkçe ve İngilizce aynı anahtarlara sahip, yer tutucular eşleşir', async () => {
	const { UI, makeT, uiLangOf } = await import('../src/i18n.js');
	const tr = Object.keys(UI.tr).sort();
	const en = Object.keys(UI.en).sort();
	assert.deepEqual(en.filter(k => !tr.includes(k)), [], 'yalnızca İngilizce olan anahtar');
	assert.deepEqual(tr.filter(k => !en.includes(k)), [], 'İngilizcesi eksik anahtar');
	const holders = text => (String(text).match(/%\d/g) || []).sort().join();
	tr.forEach(k => assert.equal(holders(UI.en[k]), holders(UI.tr[k]), `${k}: yer tutucular farklı`));

	assert.equal(uiLangOf('tr'), 'tr');
	assert.equal(uiLangOf('tr-TR'), 'tr');
	assert.equal(uiLangOf('en-GB'), 'en');
	assert.equal(uiLangOf(undefined), 'en');
	assert.equal(makeT('tr')('pages', 5), '5 sayfa');
	assert.equal(makeT('en-GB')('pages', 5), '5 pages');
	assert.equal(makeT('tr')('cmp.saved', 75), '%75 küçüldü');
	assert.equal(makeT('en')('cmp.saved', 75), '75% smaller');
	assert.equal(makeT('tr')('yok-anahtar'), 'yok-anahtar');
});
