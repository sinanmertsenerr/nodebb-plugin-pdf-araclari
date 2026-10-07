// pdf-lib ayrı bir dosyaya derlenir; araç ilk kullanıldığında yüklenir, sayfa açılışını ağırlaştırmaz.
import {
	BlendMode, LineCapStyle, PDFBool, PDFCheckBox, PDFDocument, PDFDropdown, PDFInvalidObject, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField,
	StandardFonts, degrees, grayscale, rgb,
} from '@cantoo/pdf-lib';

window.YuPdfLib = {
	BlendMode, LineCapStyle, PDFBool, PDFCheckBox, PDFDocument, PDFDropdown, PDFInvalidObject, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField,
	StandardFonts, degrees, grayscale, rgb,
};
