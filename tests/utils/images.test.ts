import {describe, it, expect} from 'vitest';

import {
  hasAnthropicImages,
  hasOpenAIImages,
  getMimeType,
  isImageMimeType,
  stripAnthropicImages,
  stripOpenAIImages,
} from '../../src/utils/images.js';

describe('hasAnthropicImages', () => {
  it('should return true when last message has image blocks', () => {
    const body = {
      model: 'test',
      messages: [
        {role: 'user' as const, content: [{type: 'text', text: 'Hello'}]},
        {role: 'user' as const, content: [{type: 'image', source: {type: 'base64', data: 'abc'}}]},
      ],
      max_tokens: 100,
    };
    expect(hasAnthropicImages(body)).toBe(true);
  });

  it('should return false when no images', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user' as const, content: [{type: 'text', text: 'Hello'}]}],
      max_tokens: 100,
    };
    expect(hasAnthropicImages(body)).toBe(false);
  });

  it('should return false for string content', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user' as const, content: 'Hello'}],
      max_tokens: 100,
    };
    expect(hasAnthropicImages(body)).toBe(false);
  });

  it('should return false for empty messages', () => {
    const body = {model: 'test', messages: [], max_tokens: 100};
    expect(hasAnthropicImages(body)).toBe(false);
  });
});

describe('hasOpenAIImages', () => {
  it('should return true when last message has image_url', () => {
    const body = {
      model: 'test',
      messages: [
        {role: 'user', content: [{type: 'image_url', image_url: {url: 'data:image/png;base64,abc'}}]},
      ],
    };
    expect(hasOpenAIImages(body)).toBe(true);
  });

  it('should return false when no images', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: [{type: 'text', text: 'Hello'}]}],
    };
    expect(hasOpenAIImages(body)).toBe(false);
  });

  it('should return false for string content', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hello'}],
    };
    expect(hasOpenAIImages(body)).toBe(false);
  });
});

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

describe('stripAnthropicImages', () => {
  it('should preserve string content', () => {
    const body = {
      model: 'test',
      max_tokens: 100,
      messages: [{role: 'user' as const, content: 'Hello'}],
    };
    const result = stripAnthropicImages(body);
    expect(result.messages[0].content).toBe('Hello');
  });

  it('should remove image blocks and keep text', () => {
    const body = {
      model: 'test',
      max_tokens: 100,
      messages: [{
        role: 'user' as const,
        content: [
          {type: 'text', text: 'What is this?'},
          {type: 'image', source: {type: 'base64', data: 'abc'}},
        ],
      }],
    };
    const result = stripAnthropicImages(body);
    expect(result.messages[0].content).toBe('What is this?');
  });

  it('should replace all-image content with placeholder', () => {
    const body = {
      model: 'test',
      max_tokens: 100,
      messages: [{
        role: 'user' as const,
        content: [{type: 'image', source: {type: 'base64', data: 'abc'}}],
      }],
    };
    const result = stripAnthropicImages(body);
    expect(result.messages[0].content).toBe('[Image removed]');
  });

  it('should keep multiple text blocks as array', () => {
    const body = {
      model: 'test',
      max_tokens: 100,
      messages: [{
        role: 'user' as const,
        content: [
          {type: 'text', text: 'Part 1'},
          {type: 'image', source: {type: 'base64', data: 'abc'}},
          {type: 'text', text: 'Part 2'},
        ],
      }],
    };
    const result = stripAnthropicImages(body);
    expect(result.messages[0].content).toEqual([
      {type: 'text', text: 'Part 1'},
      {type: 'text', text: 'Part 2'},
    ]);
  });
});

describe('stripOpenAIImages', () => {
  it('should preserve string content', () => {
    const body = {
      model: 'test',
      messages: [{role: 'user', content: 'Hello'}],
    };
    const result = stripOpenAIImages(body);
    expect(result.messages[0].content).toBe('Hello');
  });

  it('should preserve null content', () => {
    const body = {
      model: 'test',
      messages: [{role: 'assistant', content: null}],
    };
    const result = stripOpenAIImages(body);
    expect(result.messages[0].content).toBeNull();
  });

  it('should remove image_url and keep text', () => {
    const body = {
      model: 'test',
      messages: [{
        role: 'user',
        content: [
          {type: 'text', text: 'What is this?'},
          {type: 'image_url', image_url: {url: 'data:image/png;base64,abc'}},
        ],
      }],
    };
    const result = stripOpenAIImages(body);
    expect(result.messages[0].content).toBe('What is this?');
  });

  it('should replace all-image content with placeholder', () => {
    const body = {
      model: 'test',
      messages: [{
        role: 'user',
        content: [{type: 'image_url', image_url: {url: 'data:image/png;base64,abc'}}],
      }],
    };
    const result = stripOpenAIImages(body);
    expect(result.messages[0].content).toBe('[Image removed]');
  });

  it('should keep multiple text parts as array', () => {
    const body = {
      model: 'test',
      messages: [{
        role: 'user',
        content: [
          {type: 'text', text: 'Part 1'},
          {type: 'image_url', image_url: {url: 'data:image/png;base64,abc'}},
          {type: 'text', text: 'Part 2'},
        ],
      }],
    };
    const result = stripOpenAIImages(body);
    expect(result.messages[0].content).toEqual([
      {type: 'text', text: 'Part 1'},
      {type: 'text', text: 'Part 2'},
    ]);
  });
});
