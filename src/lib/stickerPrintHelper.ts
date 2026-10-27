import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { AppUser } from '../contexts/AuthContext';
import { printHtmlDocument } from './printHelper';

/**
 * Generates vector 1D Barcode SVG string for thermal printing
 */
export function generateBarcodeSvg(code: string, width = 1.3, height = 24, fontSize = 8): string {
  if (!code) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const sanitized = code.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    JsBarcode(svg, sanitized || code, {
      format: 'CODE128',
      width,
      height,
      displayValue: false, // We render the promo number separately with high-visibility styling
      margin: 1
    });
    return svg.outerHTML;
  } catch (e) {
    return `<div style="font-family:monospace;font-size:11px;font-weight:900;border:1px dashed #000;padding:2px;text-align:center;">${code}</div>`;
  }
}

/**
 * Generates offline vector QR Code SVG string for parent report
 */
export async function generateQrSvg(url: string, size = 95): Promise<string> {
  try {
    return await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      width: size
    });
  } catch (err) {
    console.warn('QR SVG generation error:', err);
    return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}" width="${size}" height="${size}" alt="QR" />`;
  }
}

/**
 * Generates HTML for a single thermal sticker label (Side-by-Side: QR + Promo Code & Barcode)
 * Standard size: 65mm x 40mm (or 65x42mm) - strictly 1 page with ZERO page overflow
 */
export async function generateStickerHtml(
  student: AppUser,
  origin: string = window.location.origin
): Promise<string> {
  const studentCode = (student.code || student.uid.replace(/^center_/, '')).trim().substring(0, 10);
  const parentReportUrl = `${origin}/parent-report/${studentCode || student.uid}`;
  const barcodeSvg = generateBarcodeSvg(studentCode, 1.25, 20, 8);
  const qrSvg = await generateQrSvg(parentReportUrl, 82);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>استيكر كارت الطالب - ${student.name}</title>
      <style>
        @page {
          size: 65mm 40mm;
          margin: 0 !important;
        }
        @media print {
          html, body {
            width: 65mm !important;
            height: 40mm !important;
            max-width: 65mm !important;
            max-height: 40mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
            break-after: avoid !important;
          }
        }
        * {
          box-sizing: border-box !important;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
          width: 65mm;
          height: 40mm;
          max-width: 65mm;
          max-height: 40mm;
          background: #ffffff;
          color: #000000;
          padding: 1mm 1.5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          page-break-inside: avoid;
          page-break-after: avoid;
          break-inside: avoid;
          break-after: avoid;
        }
        .sticker-card {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1.2px solid #000000;
          border-radius: 3px;
          padding: 1.2mm 1.5mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.2px solid #000;
          padding-bottom: 0.6mm;
          font-size: 7.5px;
          font-weight: 900;
          line-height: 1;
        }
        .teacher-brand {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .academic-year {
          font-size: 6.8px;
          font-weight: 900;
          border: 0.8px solid #000;
          padding: 0.4px 3px;
          border-radius: 2px;
        }
        .st-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6mm 0;
          line-height: 1.1;
        }
        .st-name {
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 44mm;
        }
        .st-grade {
          font-size: 7px;
          font-weight: 800;
          white-space: nowrap;
        }
        /* MAIN SPLIT: PROMO CODE & BARCODE (RIGHT) + QR (LEFT) */
        .main-split {
          display: grid;
          grid-template-columns: 37mm 21mm;
          gap: 1mm;
          align-items: center;
          margin: 0.3mm 0;
        }
        .barcode-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .promo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: #000000;
          color: #ffffff !important;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 0.8mm;
          width: 95%;
        }
        .promo-title {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.3px;
        }
        .promo-number {
          font-size: 11.5px;
          font-weight: 900;
          font-family: 'Courier New', Courier, monospace;
          letter-spacing: 1px;
        }
        .barcode-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          height: 15mm;
        }
        .barcode-wrap svg {
          max-width: 100%;
          height: 15mm !important;
          display: block;
        }
        .qr-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-right: 1px dashed #000;
          padding-right: 1mm;
        }
        .qr-wrap svg, .qr-wrap img {
          width: 17.5mm !important;
          height: 17.5mm !important;
          display: block;
        }
        .qr-label {
          font-size: 6px;
          font-weight: 900;
          margin-top: 0.4mm;
          line-height: 1;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #000;
          padding-top: 0.5mm;
          font-size: 6.8px;
          font-weight: 800;
          line-height: 1;
        }
        .group-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 36mm;
        }
      </style>
    </head>
    <body>
      <div class="sticker-card">
        <div class="header">
          <span class="teacher-brand">Mr. Mohamed Saber • English Master</span>
          <span class="academic-year">دفعة 2026 - 2027</span>
        </div>

        <div class="st-info-row">
          <span class="st-name">${student.name}</span>
          <span class="st-grade">${student.grade || 'الثانوية العامة'}</span>
        </div>

        <div class="main-split">
          <!-- RIGHT: PROMO CODE & SCANNER BARCODE -->
          <div class="barcode-side">
            <div class="promo-container">
              <span class="promo-title">PROMO:</span>
              <span class="promo-number">${studentCode}</span>
            </div>
            <div class="barcode-wrap">
              ${barcodeSvg}
            </div>
          </div>

          <!-- LEFT: PARENT REPORT QR CODE -->
          <div class="qr-side">
            <div class="qr-wrap">
              ${qrSvg}
            </div>
            <div class="qr-label">📱 تقرير ولي الأمر</div>
          </div>
        </div>

        <div class="footer">
          <span class="group-label">المجموعة: ${student.centerGroup || 'عامة'}</span>
          <span>هاتف: <span dir="ltr">${student.phone || student.parentPhone || '-'}</span></span>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Print a single student sticker directly to thermal sticker printer
 */
export async function printStudentSticker(student: AppUser): Promise<void> {
  const html = await generateStickerHtml(student);
  printHtmlDocument(html, `استيكر-${student.name || 'طالب'}`);
}

/**
 * Print batch stickers for multiple students
 */
export async function printBatchStickers(students: AppUser[]): Promise<void> {
  if (!students || students.length === 0) return;

  const items = await Promise.all(
    students.map(async (student) => {
      const studentCode = (student.code || student.uid.replace(/^center_/, '')).trim().substring(0, 10);
      const barcodeSvg = generateBarcodeSvg(studentCode, 1.25, 20, 8);
      const parentReportUrl = `${window.location.origin}/parent-report/${studentCode || student.uid}`;
      const qrSvg = await generateQrSvg(parentReportUrl, 82);

      return `
        <div class="sticker-page">
          <div class="sticker-card">
            <div class="header">
              <span class="teacher-brand">Mr. Mohamed Saber • English Master</span>
              <span class="academic-year">دفعة 2026 - 2027</span>
            </div>

            <div class="st-info-row">
              <span class="st-name">${student.name}</span>
              <span class="st-grade">${student.grade || 'الثانوية العامة'}</span>
            </div>

            <div class="main-split">
              <div class="barcode-side">
                <div class="promo-container">
                  <span class="promo-title">PROMO:</span>
                  <span class="promo-number">${studentCode}</span>
                </div>
                <div class="barcode-wrap">
                  ${barcodeSvg}
                </div>
              </div>

              <div class="qr-side">
                <div class="qr-wrap">
                  ${qrSvg}
                </div>
                <div class="qr-label">📱 تقرير ولي الأمر</div>
              </div>
            </div>

            <div class="footer">
              <span class="group-label">المجموعة: ${student.centerGroup || 'عامة'}</span>
              <span>هاتف: <span dir="ltr">${student.phone || student.parentPhone || '-'}</span></span>
            </div>
          </div>
        </div>
      `;
    })
  );

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>طباعة مجمعة لاستيكرات الطلاب (${students.length})</title>
      <style>
        @page {
          size: 65mm 40mm;
          margin: 0 !important;
        }
        @media print {
          html, body {
            width: 65mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .sticker-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .sticker-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
        * {
          box-sizing: border-box !important;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
          background: #ffffff;
          color: #000000;
        }
        .sticker-page {
          width: 65mm;
          height: 40mm;
          max-width: 65mm;
          max-height: 40mm;
          padding: 1mm 1.5mm;
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
          break-inside: avoid;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .sticker-page:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
        .sticker-card {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1.2px solid #000000;
          border-radius: 3px;
          padding: 1.2mm 1.5mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.2px solid #000;
          padding-bottom: 0.6mm;
          font-size: 7.5px;
          font-weight: 900;
          line-height: 1;
        }
        .teacher-brand {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .academic-year {
          font-size: 6.8px;
          font-weight: 900;
          border: 0.8px solid #000;
          padding: 0.4px 3px;
          border-radius: 2px;
        }
        .st-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6mm 0;
          line-height: 1.1;
        }
        .st-name {
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 44mm;
        }
        .st-grade {
          font-size: 7px;
          font-weight: 800;
          white-space: nowrap;
        }
        .main-split {
          display: grid;
          grid-template-columns: 37mm 21mm;
          gap: 1mm;
          align-items: center;
          margin: 0.3mm 0;
        }
        .barcode-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .promo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: #000000;
          color: #ffffff !important;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 0.8mm;
          width: 95%;
        }
        .promo-title {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.3px;
        }
        .promo-number {
          font-size: 11.5px;
          font-weight: 900;
          font-family: 'Courier New', Courier, monospace;
          letter-spacing: 1px;
        }
        .barcode-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          height: 15mm;
        }
        .barcode-wrap svg {
          max-width: 100%;
          height: 15mm !important;
          display: block;
        }
        .qr-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-right: 1px dashed #000;
          padding-right: 1mm;
        }
        .qr-wrap svg, .qr-wrap img {
          width: 17.5mm !important;
          height: 17.5mm !important;
          display: block;
        }
        .qr-label {
          font-size: 6px;
          font-weight: 900;
          margin-top: 0.4mm;
          line-height: 1;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #000;
          padding-top: 0.5mm;
          font-size: 6.8px;
          font-weight: 800;
          line-height: 1;
        }
        .group-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 36mm;
        }
      </style>
    </head>
    <body>
      ${items.join('')}
    </body>
    </html>
  `;

  printHtmlDocument(fullHtml, `استيكرات-السنتر-${students.length}-طالب`);
}
