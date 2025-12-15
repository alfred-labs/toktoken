import {describe, it, expect} from 'vitest';

import {
  getMimeType,
  isImageMimeType,
} from '../../src/utils/images.js';

describe('getMimeType', () => {
  it('should return mime type for known extensions', () => {
    expect(getMimeType('png')).toBe('image/png');
    expect(getMimeType('jpg')).toBe('image/jpeg');
    expect(getMimeType('json')).toBe('application/json');
  });

  it('should return false for unknown extensions', () => {
    expect(getMimeType('xyz123')).toBe(false);
  });
});

describe('isImageMimeType', () => {
  it('should return true for image types', () => {
    expect(isImageMimeType('image/png')).toBe(true);
    expect(isImageMimeType('image/jpeg')).toBe(true);
    expect(isImageMimeType('image/webp')).toBe(true);
  });

  it('should return false for non-image types', () => {
    expect(isImageMimeType('application/json')).toBe(false);
    expect(isImageMimeType('text/plain')).toBe(false);
  });
});

