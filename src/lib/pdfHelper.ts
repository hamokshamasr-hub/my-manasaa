import { fetchPdfBlobFromCloud } from './pdfStorage';

/**
 * PDF Helper Utilities for Saber Educational Platform
 * Seamlessly handles Direct Chunked Cloud Storage, Google Drive embeds,
 * Base64 conversions, browser preview, printing, and downloads.
 */

export function normalizePdfUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Direct cloud storage protocol
  if (trimmed.startsWith('pdf-cloud://')) {
    return trimmed;
  }

  // Google Drive /file/d/ID/...
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Google Drive open?id=ID
  const driveOpenMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch && driveOpenMatch[1]) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  // Dropbox dl=0 -> raw=1
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  }

  return trimmed;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

export function base64ToBlob(base64Data: string, contentType = 'application/pdf'): Blob {
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(base64Clean);
  const sliceSize = 512;
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

export function getSafePdfViewUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:application/pdf') || url.startsWith('data:')) {
    try {
      const blob = base64ToBlob(url);
      return URL.createObjectURL(blob);
    } catch {
      return url;
    }
  }
  return normalizePdfUrl(url);
}

export async function openPdfInNewTab(url: string, title = 'مذكرة دراسية'): Promise<void> {
  if (!url) return;
  const trimmed = url.trim();

  // 1. Direct Cloud Upload
  if (trimmed.startsWith('pdf-cloud://')) {
    try {
      const blob = await fetchPdfBlobFromCloud(trimmed);
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) window.location.href = blobUrl;
      return;
    } catch (e) {
      console.error('Error opening cloud PDF', e);
      alert('حدث خطأ أثناء فتح المذكرة من السحابة.');
      return;
    }
  }

  // 2. Base64
  if (trimmed.startsWith('data:application/pdf') || trimmed.startsWith('data:')) {
    try {
      const blob = base64ToBlob(trimmed);
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) window.location.href = blobUrl;
      return;
    } catch (e) {
      console.error('Error opening base64 PDF', e);
    }
  }

  // 3. Normal URL / Drive
  const safeUrl = normalizePdfUrl(trimmed);
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
}

export async function downloadPdfFile(url: string, filename = 'document.pdf'): Promise<void> {
  if (!url) return;
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const trimmed = url.trim();

  // 1. Direct Cloud Upload
  if (trimmed.startsWith('pdf-cloud://')) {
    try {
      const blob = await fetchPdfBlobFromCloud(trimmed);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    } catch (e) {
      console.error('Error downloading cloud PDF', e);
      alert('حدث خطأ أثناء تحميل المذكرة.');
      return;
    }
  }

  // 2. Base64
  if (trimmed.startsWith('data:application/pdf') || trimmed.startsWith('data:')) {
    try {
      const blob = base64ToBlob(trimmed);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    } catch (e) {
      console.error('Error downloading base64 PDF', e);
    }
  }

  // 3. Normal link
  const link = document.createElement('a');
  link.href = trimmed;
  link.target = '_blank';
  link.download = cleanFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
