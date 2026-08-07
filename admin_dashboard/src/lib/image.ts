/**
 * Browser-side image compression for attendance capture and file uploads.
 *
 * getUserMedia hands back frames at the device's full sensor resolution — on a
 * modern phone that is a 4000px-wide canvas encoding to several MB. The backend
 * rejects anything over 5MB, so an unresized capture can fail the check-in
 * outright, and on a site connection even a successful one is slow.
 */

export const MAX_IMAGE_DIMENSION = 1280;
export const JPEG_QUALITY = 0.7;

/** Scale to fit inside MAX_IMAGE_DIMENSION. Never upscales. */
const fittedSize = (width: number, height: number) => {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const toJpegFile = async (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  filename: string,
): Promise<File | null> => {
  const { width, height } = fittedSize(sourceWidth, sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  return blob ? new File([blob], filename, { type: 'image/jpeg' }) : null;
};

/** Grab the current frame of a <video> as a compressed JPEG File. */
export const captureVideoFrame = (
  video: HTMLVideoElement,
  filename = `capture-${Date.now()}.jpg`,
): Promise<File | null> => {
  if (!video.videoWidth || !video.videoHeight) return Promise.resolve(null);
  return toJpegFile(video, video.videoWidth, video.videoHeight, filename);
};

/**
 * Compress a user-selected image File. Non-images (PDF, DOC) pass through
 * untouched, as does anything that fails to decode or would not get smaller.
 */
export const compressImageFile = async (file: File): Promise<File> => {
  if (!file?.type?.startsWith('image/')) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const name = `${file.name?.replace(/\.[^/.]+$/, '') || 'upload'}.jpg`;
    const compressed = await toJpegFile(bitmap, bitmap.width, bitmap.height, name);
    return compressed && compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
};
