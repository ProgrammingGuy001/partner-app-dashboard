import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { logger } from './helpers';

/**
 * One image compressor for the whole app.
 *
 * Attendance and useFileUpload each grew their own version (1024/0.7 on the new
 * SDK 54+ object API, 1280/0.8 on the deprecated manipulateAsync). Both live here
 * now, on the supported API, with one set of numbers.
 *
 * The backend rejects anything over 5MB, and the mobile client's axios timeout is
 * 30s including the upload — so a raw 12MP camera JPEG on a site connection is
 * exactly the failure case this exists to prevent.
 */

export const MAX_IMAGE_DIMENSION = 1280;
export const IMAGE_COMPRESS_QUALITY = 0.7;

const getImageSize = (uri) =>
  new Promise((resolve) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });

/**
 * Resize (never upscale) and re-encode to JPEG. Returns the original uri if
 * anything fails — a slightly large photo beats a blocked check-in.
 */
export const compressImageUri = async (uri) => {
  if (!uri) return uri;
  try {
    const size = await getImageSize(uri);
    const context = ImageManipulator.manipulate(uri);
    // Upscaling a small image makes the file bigger, which is the opposite of the point.
    if (size && Math.max(size.width, size.height) > MAX_IMAGE_DIMENSION) {
      context.resize(size.width >= size.height
        ? { width: MAX_IMAGE_DIMENSION }
        : { height: MAX_IMAGE_DIMENSION });
    }
    const rendered = await context.renderAsync();
    const output = await rendered.saveAsync({
      compress: IMAGE_COMPRESS_QUALITY,
      format: SaveFormat.JPEG,
    });
    return output.uri;
  } catch (err) {
    logger.warn('image', `Compression failed, using original: ${err.message}`);
    return uri;
  }
};

const jpegName = (name) =>
  `${name?.replace(/\.[^/.]+$/, '') || `upload-${Date.now()}`}.jpg`;

/** Real byte count of the compressed file, so the 5MB check still means something. */
export const fileSizeBytes = (uri) => {
  try {
    return new File(uri).size || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Compress a picked file descriptor ({uri, name, mimeType, size}).
 * Non-images (PDF, DOC) pass through untouched.
 */
export const compressPickedImage = async (file) => {
  if (!file?.mimeType?.startsWith('image/')) return file;

  const uri = await compressImageUri(file.uri);
  if (uri === file.uri) return file;

  return {
    ...file,
    uri,
    mimeType: 'image/jpeg',
    name: jpegName(file.name),
    // The original byte count no longer describes this file — re-stat it.
    size: fileSizeBytes(uri) ?? file.size,
  };
};
