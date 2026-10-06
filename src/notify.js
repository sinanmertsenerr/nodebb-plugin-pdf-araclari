// Başarı bildirimi: forumun kendi uyarısı (sağ altta) varsa o kullanılır; yoksa (test sayfası) aynı yerde kendi bildirimimiz çıkar.
let hostNotify = null;
let box = null;

// main.jsx bağlanırken forumun uyarı fonksiyonunu verir (static/lib/page.js: NodeBB'nin "alerts" modülü)
export function setNotifier(fn) {
	hostNotify = typeof fn === 'function' ? fn : null;
}

function ensureBox() {
	if (box && document.body.contains(box)) return box;
	box = document.createElement('div');
	box.className = 'pdf-toasts';
	box.setAttribute('aria-hidden', 'true'); // sonuç çubuğu zaten duyurulur (role="status")
	document.body.appendChild(box);
	return box;
}

// { type: 'success' | 'danger', title, message, timeout (ms) }
export function notify({ type = 'success', title, message = '', timeout = 6000 }) {
	if (hostNotify) {
		try {
			hostNotify({ type, title, message, timeout });
			return;
		} catch (err) { /* forum uyarısı yoksa kendi bildirimimize düşeriz */ }
	}
	const toast = document.createElement('div');
	toast.className = `pdf-toast pdf-toast--${type}`;
	const head = document.createElement('strong');
	head.textContent = title || '';
	const body = document.createElement('span');
	body.textContent = message;
	const close = document.createElement('button');
	close.type = 'button';
	close.className = 'pdf-toast-close';
	close.textContent = '×';
	close.setAttribute('tabindex', '-1');
	toast.append(head, body, close);
	const remove = () => { toast.classList.add('is-leaving'); setTimeout(() => toast.remove(), 180); };
	close.addEventListener('click', remove);
	ensureBox().appendChild(toast);
	if (timeout) setTimeout(remove, timeout);
}

// Testler için: ekrandaki bildirimlerin metni
export const toastTexts = () => Array.from(document.querySelectorAll('.pdf-toast')).map(el => el.textContent.replace('×', '').trim());
