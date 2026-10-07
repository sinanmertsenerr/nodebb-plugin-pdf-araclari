// pdf-lib ayrı bir dosyaya derlenir; araç ilk kullanıldığında yüklenir, sayfa açılışını ağırlaştırmaz.
import { BlendMode, LineCapStyle, PDFDocument, PDFInvalidObject, PDFName, StandardFonts, degrees, grayscale, rgb } from '@cantoo/pdf-lib';

window.YuPdfLib = { BlendMode, LineCapStyle, PDFDocument, PDFInvalidObject, PDFName, StandardFonts, degrees, grayscale, rgb };
