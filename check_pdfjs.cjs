const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function testPdf() {
    const data = new Uint8Array(fs.readFileSync('C:/Users/viole/Downloads/Chuong-5.-Phuong-thuc-tin-dung-CT.pdf'));
    
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: data,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
        });
        const doc = await loadingTask.promise;
        console.log(`Successfully opened PDF. Pages: ${doc.numPages}`);
        const page = await doc.getPage(1);
        const textContent = await page.getTextContent();
        console.log('Successfully read text content of page 1. Items length:', textContent.items.length);
    } catch (e) {
        console.error('Failed to open PDF:', e);
    }
}

testPdf();
