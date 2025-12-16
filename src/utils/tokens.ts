import {get_encoding} from 'tiktoken';

const enc = get_encoding('cl100k_base');

/** Counts tokens in a string using tiktoken (cl100k_base encoding). */
export function countTokens(text: string): number {
  try {
    return enc.encode(text).length;
  } catch {
    // Fallback to character-based estimation
    return Math.ceil(text.length / 4);
  }
}

interface ContentBlock {
  type: string;
  text?: string;
  input?: unknown;
  content?: string | unknown[];
}

interface Message {
  content: string | ContentBlock[];
}

interface Tool {
  name?: string;
  description?: string;
  input_schema?: unknown;
}

/**
 * Calculates token count for Anthropic messages, system prompt, and tools.
 * Matches claude-code-router's calculateTokenCount logic.
 */
export function calculateTokenCount(
  messages: Message[],
  system?: string | ContentBlock[],
  tools?: Tool[],
): number {
  let tokenCount = 0;

  // Count message content
  if (Array.isArray(messages)) {
    for (const message of messages) {
      if (typeof message.content === 'string') {
        tokenCount += enc.encode(message.content).length;
      } else if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text' && block.text) {
            tokenCount += enc.encode(block.text).length;
          } else if (block.type === 'tool_use' && block.input) {
            tokenCount += enc.encode(JSON.stringify(block.input)).length;
          } else if (block.type === 'tool_result') {
            const content = block.content;
            tokenCount += enc.encode(
              typeof content === 'string' ? content : JSON.stringify(content),
            ).length;
          }
        }
      }
    }
  }

  // Count system prompt
  if (typeof system === 'string') {
    tokenCount += enc.encode(system).length;
  } else if (Array.isArray(system)) {
    for (const item of system) {
      if (item.type === 'text' && typeof item.text === 'string') {
        tokenCount += enc.encode(item.text).length;
      }
    }
  }

  // Count tools
  if (tools) {
    for (const tool of tools) {
      if (tool.name) {
        tokenCount += enc.encode(tool.name).length;
      }
      if (tool.description) {
        tokenCount += enc.encode(tool.description).length;
      }
      if (tool.input_schema) {
        tokenCount += enc.encode(JSON.stringify(tool.input_schema)).length;
      }
    }
  }

  return tokenCount;
}

/** Estimates token count for a request by serializing to JSON (legacy). */
export function estimateRequestTokens(messages: unknown): number {
  return countTokens(JSON.stringify(messages));
}
