// Sıkıştırmasız (store) ZIP yazıcı: PDF'ler zaten sıkışık olduğu için sıkıştırmaya gerek yok, kod küçük kalır.

const TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

export function crc32(bytes) {
	let c = 0xFFFFFFFF;
	for (let i = 0; i < bytes.length; i += 1) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return { time, day };
}

// files: [{ name, data: Uint8Array }] -> Uint8Array (ZIP). Dosya adları UTF-8 (Türkçe harfler bozulmaz).
export function zip(files, now = new Date()) {
	const enc = new TextEncoder();
	const { time, day } = dosDateTime(now);
	const chunks = [];
	const central = [];
	let offset = 0;
	files.forEach((file) => {
		const name = enc.encode(file.name);
		const crc = crc32(file.data);
		const size = file.data.length;
		const head = new DataView(new ArrayBuffer(30));
		head.setUint32(0, 0x04034B50, true);
		head.setUint16(4, 20, true);
		head.setUint16(6, 0x0800, true); // UTF-8 adlar
		head.setUint16(8, 0, true); // store
		head.setUint16(10, time, true);
		head.setUint16(12, day, true);
		head.setUint32(14, crc, true);
		head.setUint32(18, size, true);
		head.setUint32(22, size, true);
		head.setUint16(26, name.length, true);
		head.setUint16(28, 0, true);
		chunks.push(new Uint8Array(head.buffer), name, file.data);

		const entry = new DataView(new ArrayBuffer(46));
		entry.setUint32(0, 0x02014B50, true);
		entry.setUint16(4, 20, true);
		entry.setUint16(6, 20, true);
		entry.setUint16(8, 0x0800, true);
		entry.setUint16(10, 0, true);
		entry.setUint16(12, time, true);
		entry.setUint16(14, day, true);
		entry.setUint32(16, crc, true);
		entry.setUint32(20, size, true);
		entry.setUint32(24, size, true);
		entry.setUint16(28, name.length, true);
		entry.setUint32(42, offset, true);
		central.push(new Uint8Array(entry.buffer), name);
		offset += 30 + name.length + size;
	});
	const centralSize = central.reduce((n, c) => n + c.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054B50, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, centralSize, true);
	end.setUint32(16, offset, true);
	const all = [...chunks, ...central, new Uint8Array(end.buffer)];
	const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
	let at = 0;
	all.forEach((c) => { out.set(c, at); at += c.length; });
	return out;
}
