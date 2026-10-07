<!-- Dosyalar sayfa okunurken hemen inmeye başlar (page.js aynı istek biçimiyle kullanır, iki kez inmez) -->
<link rel="preload" href="{js}" as="script">
<link rel="preload" href="{css}" as="style">
<!-- data-clarity-mask: forumdaki oturum kaydı aracı (Microsoft Clarity) bu alanın içeriğini göremez; belgeler kişiseldir -->
<div class="pdf-yu-page" id="pdf-yu-root" data-clarity-mask="True" data-js="{js}" data-css="{css}" data-uid="{uid}" data-default-lang="{defaultLang}">
	<noscript>
		<div class="alert alert-warning m-3">{{tx("pdf-araclari:needs-js")}}</div>
	</noscript>
	<div class="pdf-yu-loading" role="status" aria-live="polite">
		<span class="pdf-yu-spinner" aria-hidden="true"></span>
		<span>{{tx("pdf-araclari:loading")}}</span>
	</div>
</div>
