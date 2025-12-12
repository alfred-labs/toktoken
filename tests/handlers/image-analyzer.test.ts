import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lastMessageHasImages,
  historyHasImages,
  processImagesInLastMessage,
  removeImagesFromHistory,
} from '../../src/agents/index.js';
import type { AnthropicRequest } from '../../src/types/index.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Image Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lastMessageHasImages', () => {
    it('should return true when last message has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(true);
    });

    it('should return false when last message has no images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'user', content: 'No image here' },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(false);
    });

    it('should return false when last message is from assistant', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(false);
    });
  });

  describe('historyHasImages', () => {
    it('should return true when history has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'assistant', content: 'I see a green image' },
          { role: 'user', content: 'What else?' },
        ],
      };
      expect(historyHasImages(request)).toBe(true);
    });

    it('should return false when only last message has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };
      expect(historyHasImages(request)).toBe(false);
    });
  });

  describe('removeImagesFromHistory', () => {
    it('should replace images in history with placeholders', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look at this' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'assistant', content: 'I see green' },
          { role: 'user', content: 'What about now?' },
        ],
      };

      const result = removeImagesFromHistory(request);

      // First message should have image replaced (concatenated to string)
      expect(result.messages[0].content).toBe('Look at this\n\n[Image 1 - previously analyzed]');

      // Last message should be unchanged
      expect(result.messages[2].content).toBe('What about now?');
    });

    it('should not modify last message', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = removeImagesFromHistory(request);

      // Last message should still have image
      expect(result.messages[1].content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
      ]);
    });
  });

  describe('processImagesInLastMessage', () => {
    it('should analyze images and replace with descriptions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is a green square' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Image should be replaced with analysis (concatenated to string)
      expect(result.messages[0].content).toBe('What is this?\n\n[Image 1 analysis]:\nThis is a green square');

      // Vision API should be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should analyze multiple images', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Green square' } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Red circle' } }],
          }),
        });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Compare these' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'green' } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'red' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result.messages[0].content).toBe('Compare these\n\n[Image 1 analysis]:\nGreen square\n\n[Image 2 analysis]:\nRed circle');

      // Vision API should be called twice (once per image)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT re-analyze images in history (only last message)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'New image analysis' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          // Old message with image (should NOT be analyzed)
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'old' } },
            ],
          },
          { role: 'assistant', content: 'I saw a green image' },
          // New message with image (should be analyzed)
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What about this one?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'new' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Only ONE call to vision API (for the new image in last message)
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Old image in history should be unchanged
      expect(result.messages[0].content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'old' } },
      ]);

      // New image should be replaced with analysis (concatenated to string)
      expect(result.messages[2].content).toBe('What about this one?\n\n[Image 1 analysis]:\nNew image analysis');
    });
  });

  describe('Full flow - images not re-analyzed', () => {
    it('should only analyze new images, not previously analyzed ones', async () => {
      // First turn: user sends image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'A green square' } }],
        }),
      });

      const firstRequest: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'green' } },
            ],
          },
        ],
      };

      const firstResult = await processImagesInLastMessage(firstRequest, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second turn: user asks follow-up (no new image)
      // Simulate conversation with processed first message
      const secondRequest: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          firstResult.messages[0], // Already processed (image replaced with description)
          { role: 'assistant', content: 'It is a green square' },
          { role: 'user', content: 'What shade of green?' },
        ],
      };

      // This should NOT call vision API since there are no new images
      const hasImages = lastMessageHasImages(secondRequest);
      expect(hasImages).toBe(false);

      // No additional calls to vision API
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
