import { UPLOAD_LIMITS } from '../modality.js';

export interface ImageDimensionValidationResult {
  valid: boolean;
  pixels: number;
}

/**
 * Validates image dimensions against decompression-bomb and maximum side pixel limits
 */
export function validateImageDimensions(
  width: number,
  height: number,
  maxPixels = UPLOAD_LIMITS.maxImagePixels,
  maxSide = UPLOAD_LIMITS.maxImageSidePx,
): ImageDimensionValidationResult {
  if (width <= 0 || height <= 0) {
    const err = new Error('IMAGE_DIMENSIONS_EXCEEDED: Image width and height must be positive.');
    (err as unknown as { code: string }).code = 'IMAGE_DIMENSIONS_EXCEEDED';
    throw err;
  }

  if (width > maxSide || height > maxSide) {
    const err = new Error(
      `IMAGE_DIMENSIONS_EXCEEDED: Image dimension (${width}x${height}) exceeds maximum side length of ${maxSide}px.`,
    );
    (err as unknown as { code: string }).code = 'IMAGE_DIMENSIONS_EXCEEDED';
    throw err;
  }

  const pixels = width * height;
  if (pixels > maxPixels) {
    const err = new Error(
      `IMAGE_DIMENSIONS_EXCEEDED: Image total pixels (${pixels}) exceeds maximum decompression budget of ${maxPixels} pixels.`,
    );
    (err as unknown as { code: string }).code = 'IMAGE_DIMENSIONS_EXCEEDED';
    throw err;
  }

  return {
    valid: true,
    pixels,
  };
}
