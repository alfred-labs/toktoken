import type { AnthropicRequest, AnthropicContentBlock } from '../types/index.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Sanitize message content for vLLM compatibility.
 * Converts complex tool_result content to string format.
 */
export function sanitizeMessageContent(request: AnthropicRequest): AnthropicRequest {
  const sanitizedMessages = request.messages.map((msg, idx) => {
    logger.debug({ msgIdx: idx, role: msg.role, contentType: typeof msg.content, isArray: Array.isArray(msg.content) }, 'Sanitizing message');
    
    if (typeof msg.content === 'string') {
      return msg;
    }

    if (Array.isArray(msg.content)) {
      const sanitizedContent = msg.content.map((block, blockIdx) => {
        const sanitized = sanitizeBlock(block);
        logger.debug({ msgIdx: idx, blockIdx, blockType: block.type, sanitized: sanitized !== block }, 'Block processed');
        return sanitized;
      });
      return { ...msg, content: sanitizedContent };
    }

    // Non-array, non-string content - this is the problem!
    logger.warn({ msgIdx: idx, contentType: typeof msg.content, content: JSON.stringify(msg.content).slice(0, 200) }, 'Non-standard message content - stringifying');
    return { ...msg, content: JSON.stringify(msg.content) };
  });

  return { ...request, messages: sanitizedMessages };
}

function sanitizeBlock(block: AnthropicContentBlock): AnthropicContentBlock {
  // Convert tool_result with non-string content to string
  if (block.type === 'tool_result' && 'content' in block) {
    const content = block.content;
    if (content !== undefined && typeof content !== 'string') {
      logger.debug({ blockType: 'tool_result', contentType: typeof content, isArray: Array.isArray(content) }, 'Stringifying tool_result content');
      return { ...block, content: JSON.stringify(content) };
    }
  }

  return block;
}
