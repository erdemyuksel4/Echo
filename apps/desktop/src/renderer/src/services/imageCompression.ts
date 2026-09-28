import type { Attachment } from '@echo/shared';

const MAX_IMAGE_DIMENSION = 1920;
const CHUNK_SIZE_BYTES = 180 * 1024; // ~180KB binary -> ~240KB Base64 (well under SQLite 256KB row limit)

export interface CompressedImagePayload {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  totalChunks: number;
  chunks: Array<{ index: number; dataBase64: string }>;
  width?: number;
  height?: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function chunkArrayBuffer(buffer: ArrayBuffer): Array<{ index: number; dataBase64: string }> {
  const chunks: Array<{ index: number; dataBase64: string }> = [];
  let offset = 0;
  let index = 0;

  while (offset < buffer.byteLength) {
    const slice = buffer.slice(offset, offset + CHUNK_SIZE_BYTES);
    chunks.push({
      index,
      dataBase64: arrayBufferToBase64(slice),
    });
    offset += CHUNK_SIZE_BYTES;
    index++;
  }

  return chunks;
}

export async function processImageForUpload(file: File): Promise<CompressedImagePayload> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Dosya boyutu 10 MB sınırını aşıyor.');
  }

  // Preserve GIF animation frames without transcoding
  if (file.type === 'image/gif') {
    const arrayBuffer = await file.arrayBuffer();
    const chunks = chunkArrayBuffer(arrayBuffer);
    return {
      filename: file.name,
      mimeType: 'image/gif',
      sizeBytes: file.size,
      totalChunks: chunks.length,
      chunks,
    };
  }

  // Convert other images (PNG, JPEG, WebP, etc.) to optimized WebP
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      // Scale down if larger than MAX_IMAGE_DIMENSION
      if (targetWidth > MAX_IMAGE_DIMENSION || targetHeight > MAX_IMAGE_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * MAX_IMAGE_DIMENSION) / targetWidth);
          targetWidth = MAX_IMAGE_DIMENSION;
        } else {
          targetWidth = Math.round((targetWidth * MAX_IMAGE_DIMENSION) / targetHeight);
          targetHeight = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context could not be created'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Görsel sıkıştırma başarısız oldu.'));
            return;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const chunks = chunkArrayBuffer(arrayBuffer);
          const baseName = file.name.replace(/\.[^/.]+$/, '');

          resolve({
            filename: `${baseName}.webp`,
            mimeType: 'image/webp',
            sizeBytes: blob.size,
            totalChunks: chunks.length,
            chunks,
            width: targetWidth,
            height: targetHeight,
          });
        },
        'image/webp',
        0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel yüklenirken hata oluştu.'));
    };

    img.src = objectUrl;
  });
}

export async function createImageAttachment(file: File): Promise<Attachment> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Görsel boyutu 15 MB sınırını aşıyor.');
  }

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

  // Preserve animated GIFs using direct Data URL if under 2.5MB
  if (isGif) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('GIF boyutu 3 MB sınırını aşıyor.');
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('GIF okunamadı.'));
      reader.readAsDataURL(file);
    });

    return {
      id: `gif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: file.name,
      size: file.size,
      mimeType: 'image/gif',
      url: dataUrl,
      type: 'gif',
    };
  }

  // Optimize and scale other images (JPEG, PNG, WebP) to WebP Base64 Data URL
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxDim = 1280;
      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
          targetWidth = maxDim;
        } else {
          targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
          targetHeight = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas oluşturulamadı.'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Export as high quality compact WebP Data URL
      let dataUrl = canvas.toDataURL('image/webp', 0.82);
      // Fallback if browser doesn't support WebP export
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      }

      const approxBytes = Math.round((dataUrl.length * 3) / 4);

      resolve({
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        name: file.name.replace(/\.[^/.]+$/, '') + '.webp',
        size: approxBytes,
        mimeType: 'image/webp',
        url: dataUrl,
        type: 'image',
        width: targetWidth,
        height: targetHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel dosyası açılamadı.'));
    };

    img.src = objectUrl;
  });
}

export async function uploadImageAttachment(_groupId: string, file: File): Promise<Attachment> {
  // Use instant client-side WebP Data URL: no server upload delay, zero storage quotas, zero 404s
  return createImageAttachment(file);
}
