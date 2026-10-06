// Araç listesi: sıra menüdeki sıradır. component yoksa araç "Yakında" görünür.
import { Merge } from './merge.jsx';
import { Split } from './split.jsx';
import { Organize } from './organize.jsx';
import { Compress } from './compress.jsx';
import { Protect } from './protect.jsx';
import { Unlock } from './unlock.jsx';
import { ImgToPdf } from './img2pdf.jsx';
import { PdfToImg } from './pdf2img.jsx';
import { PdfToTxt } from './pdf2txt.jsx';
import { ImgConv } from './imgconv.jsx';
import { ImgShrink } from './imgshrink.jsx';

export const GROUPS = ['basic', 'convert', 'edit', 'secure', 'student', 'scan'];

export const TOOLS = [
	{ id: 'merge', group: 'basic', icon: 'files', component: Merge },
	{ id: 'split', group: 'basic', icon: 'scissors', component: Split },
	{ id: 'organize', group: 'basic', icon: 'reorder', component: Organize },
	{ id: 'compress', group: 'basic', icon: 'shrink', component: Compress },

	{ id: 'img2pdf', group: 'convert', icon: 'image', component: ImgToPdf },
	{ id: 'pdf2img', group: 'convert', icon: 'file-image', component: PdfToImg },
	{ id: 'pdf2txt', group: 'convert', icon: 'file-text', component: PdfToTxt },
	{ id: 'imgconv', group: 'convert', icon: 'swap', component: ImgConv },
	{ id: 'imgshrink', group: 'convert', icon: 'image-minus', component: ImgShrink },
	{ id: 'txt2pdf', group: 'convert', icon: 'type' },

	{ id: 'edit', group: 'edit', icon: 'edit' },
	{ id: 'sign', group: 'edit', icon: 'signature' },
	{ id: 'pagenum', group: 'edit', icon: 'hash' },
	{ id: 'watermark', group: 'edit', icon: 'stamp' },

	{ id: 'protect', group: 'secure', icon: 'lock', component: Protect },
	{ id: 'unlock', group: 'secure', icon: 'unlock', component: Unlock },

	{ id: 'handout', group: 'student', icon: 'printer' },
	{ id: 'cover', group: 'student', icon: 'book' },

	{ id: 'scan', group: 'scan', icon: 'scan' },
];
