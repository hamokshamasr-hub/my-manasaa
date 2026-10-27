import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { base64ToBlob, normalizePdfUrl } from './pdfHelper';

// Max chunk size in characters (~450KB to remain safely below Firestore's 1MB limit)
const CHUNK_SIZE = 450000;

// Native IndexedDB Cache helper for zero-latency subsequent reads
const DB_NAME = 'saber_platform_pdf_cache';
const STORE_NAME = 'pdf_blobs';

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedBlob(fileId: string): Promise<Blob | null> {
  try {
    const idb = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedBlob(fileId: string, blob: Blob): Promise<void> {
  try {
    const idb = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore cache failure
  }
}

/**
 * Upload any PDF file directly into Firestore chunked cloud storage.
 * Works seamlessly for files of any size (1MB, 5MB, 10MB, 20MB) with zero external setup.
 */
export async function uploadPdfDirectly(
  file: File,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ fileId: string; url: string; size: number; name: string }> {
  onProgress?.(10, 'جاري قراءة ملف الـ PDF من جهازك...');

  // Convert File to base64
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });

  const fileId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const cleanBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const totalLength = cleanBase64.length;
  const totalChunks = Math.ceil(totalLength / CHUNK_SIZE);

  onProgress?.(25, `جاري تجهيز وتشفير أجزاء الملف (0 / ${totalChunks})...`);

  // Write chunks in batches of 5 to avoid overwhelming network
  const batchSize = 4;
  for (let i = 0; i < totalChunks; i += batchSize) {
    const chunkPromises = [];
    for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
      const start = j * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalLength);
      const chunkData = cleanBase64.substring(start, end);

      const chunkDocRef = doc(db, 'pdf_chunks', `${fileId}_chunk_${j}`);
      chunkPromises.push(
        setDoc(chunkDocRef, {
          fileId,
          index: j,
          totalChunks,
          data: chunkData,
          size: chunkData.length,
          createdAt: Date.now()
        })
      );
    }

    await Promise.all(chunkPromises);

    const currentCompleted = Math.min(i + batchSize, totalChunks);
    const percent = Math.min(92, Math.round(25 + ((currentCompleted / totalChunks) * 65)));
    onProgress?.(percent, `جاري الرفع السحابي المباشر (${currentCompleted} من ${totalChunks} جزء)...`);
  }

  // Save File Manifest
  onProgress?.(95, 'جاري تسجيل بيانات الملف السحابية...');
  const manifestRef = doc(db, 'pdf_files', fileId);
  await setDoc(manifestRef, {
    id: fileId,
    name: file.name,
    size: file.size,
    totalChunks,
    mimeType: file.type || 'application/pdf',
    createdAt: Date.now()
  });

  // Also cache locally for instant immediate preview
  try {
    const blob = base64ToBlob(cleanBase64, 'application/pdf');
    await setCachedBlob(fileId, blob);
  } catch {}

  onProgress?.(100, 'تم الرفع السحابي المباشر بنجاح!');

  return {
    fileId,
    url: `pdf-cloud://${fileId}`,
    size: file.size,
    name: file.name
  };
}

/**
 * Reassemble and fetch PDF Blob from Firestore Chunked Cloud Storage
 */
export async function fetchPdfBlobFromCloud(
  fileId: string,
  onProgress?: (progressPercent: number) => void
): Promise<Blob> {
  const cleanId = fileId.replace('pdf-cloud://', '').trim();

  // 1. Check Local IndexedDB Cache
  const cached = await getCachedBlob(cleanId);
  if (cached) {
    onProgress?.(100);
    return cached;
  }

  onProgress?.(20);

  // 2. Fetch manifest
  const manifestSnap = await getDoc(doc(db, 'pdf_files', cleanId));
  let totalChunks = 0;
  if (manifestSnap.exists()) {
    totalChunks = manifestSnap.data().totalChunks || 0;
  }

  onProgress?.(40);

  // 3. Fetch all chunks
  const qChunks = query(collection(db, 'pdf_chunks'), where('fileId', '==', cleanId));
  const chunkSnap = await getDocs(qChunks);

  if (chunkSnap.empty) {
    throw new Error('لم يتم العثور على أجزاء الملف السحابي');
  }

  const chunksList = chunkSnap.docs.map(d => d.data() as { index: number; data: string });
  chunksList.sort((a, b) => a.index - b.index);

  onProgress?.(80);

  // 4. Concatenate chunks
  const fullBase64 = chunksList.map(c => c.data).join('');
  const blob = base64ToBlob(fullBase64, 'application/pdf');

  // 5. Cache for future instant loads
  await setCachedBlob(cleanId, blob);

  onProgress?.(100);
  return blob;
}

/**
 * Universal PDF Resolver: Works for Google Drive, Direct PDF Links,
 * Data URLs, and Chunked Cloud Storage ('pdf-cloud://...').
 */
export async function resolvePdfToViewUrl(url: string): Promise<string> {
  if (!url) return '';
  const trimmed = url.trim();

  // 1. Direct Cloud Upload format
  if (trimmed.startsWith('pdf-cloud://')) {
    const blob = await fetchPdfBlobFromCloud(trimmed);
    return URL.createObjectURL(blob);
  }

  // 2. Base64
  if (trimmed.startsWith('data:application/pdf') || trimmed.startsWith('data:')) {
    const blob = base64ToBlob(trimmed);
    return URL.createObjectURL(blob);
  }

  // 3. Google Drive / External URL
  return normalizePdfUrl(trimmed);
}

/**
 * Delete a chunked PDF file from cloud
 */
export async function deletePdfFromCloud(fileId: string): Promise<void> {
  try {
    const cleanId = fileId.replace('pdf-cloud://', '').trim();
    // Delete manifest
    await deleteDoc(doc(db, 'pdf_files', cleanId)).catch(() => {});

    // Delete all chunks
    const qChunks = query(collection(db, 'pdf_chunks'), where('fileId', '==', cleanId));
    const snap = await getDocs(qChunks);
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error deleting cloud pdf chunks:', err);
  }
}
