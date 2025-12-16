import {describe, it, expect} from 'vitest';

import {
  getMimeType,
  isImageMimeType,
  sanitizeToolChoice,
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

describe('sanitizeToolChoice', () => {
  it('should remove tool_choice when tools array is empty', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hi'}],
      tool_choice: 'auto',
      tools: [],
    };
    const result = sanitizeToolChoice(body);
    expect(result.tool_choice).toBeUndefined();
  });

  it('should remove tool_choice when tools is undefined', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hi'}],
      tool_choice: 'auto',
    };
    const result = sanitizeToolChoice(body);
    expect(result.tool_choice).toBeUndefined();
  });

  it('should keep tool_choice when tools are present', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hi'}],
      tool_choice: 'auto',
      tools: [{type: 'function', function: {name: 'test'}}],
    };
    const result = sanitizeToolChoice(body);
    expect(result.tool_choice).toBe('auto');
  });

  it('should return unchanged when no tool_choice', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hi'}],
    };
    const result = sanitizeToolChoice(body);
    expect(result).toEqual(body);
  });
});
