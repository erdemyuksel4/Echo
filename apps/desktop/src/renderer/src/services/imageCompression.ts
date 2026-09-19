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

export async function uploadImageAttachment(groupId: string, file: File): Promise<Attachment> {
  const payload = await processImageForUpload(file);

  const res = await fetch(`http://localhost:8787/api/groups/${groupId}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || 'Görsel yüklenemedi.');
  }

  const data = (await res.json()) as { success: boolean; attachment: Attachment };
  return data.attachment;
}
