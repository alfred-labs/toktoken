import type { AnthropicRequest, AnthropicContentBlock, BackendConfig } from '../types/index.js';
import { logger } from '../init.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load system prompt from agent.image.md
function loadSystemPrompt(): string {
  const defaultPrompt = 'Analyze this image and describe what you see.';
  try {
    const possiblePaths = [
      join(__dirname, 'agent.image.md'),
      join(__dirname, '..', '..', 'src', 'agents', 'agent.image.md'),
    ];
    
    for (const mdPath of possiblePaths) {
      try {
        const content = readFileSync(mdPath, 'utf-8');
        const match = content.match(/## System Prompt\n\n([\s\S]*?)(?=\n## |$)/);
        if (match?.[1]) {
          return match[1].trim();
        }
      } catch {
        continue;
      }
    }
    return defaultPrompt;
  } catch {
    return defaultPrompt;
  }
}

const VISION_SYSTEM_PROMPT = loadSystemPrompt();

// Max image size in bytes (500KB)
const MAX_IMAGE_SIZE = 500 * 1024;

interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ImageAgentOptions {
  visionBackend: BackendConfig;
  clientAuthHeader?: string;
}

function isImageBlock(block: AnthropicContentBlock): block is ImageBlock {
  return block.type === 'image' && 'source' in block;
}

/**
 * Resize image if too large
 */
async function resizeImageIfNeeded(
  base64Data: string,
  mediaType: string
): Promise<{ data: string; media_type: string }> {
  const buffer = Buffer.from(base64Data, 'base64');
  
  if (buffer.length <= MAX_IMAGE_SIZE) {
    return { data: base64Data, media_type: mediaType };
  }
  
  logger.info({ originalSize: buffer.length, maxSize: MAX_IMAGE_SIZE }, 'Resizing large image');
  
  try {
    const metadata = await sharp(buffer).metadata();
    const { width = 1920, height = 1080 } = metadata;
    
    const scaleFactor = Math.sqrt(MAX_IMAGE_SIZE / buffer.length);
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);
    
    const resized = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    logger.info({ 
      originalSize: buffer.length, 
      newSize: resized.length,
      originalDimensions: `${width}x${height}`,
      newDimensions: `${newWidth}x${newHeight}`,
    }, 'Image resized');
    
    return {
      data: resized.toString('base64'),
      media_type: 'image/jpeg',
    };
  } catch (error) {
    logger.error({ error }, 'Failed to resize image, using original');
    return { data: base64Data, media_type: mediaType };
  }
}

/**
 * Check if request has images in any message
 */
export function hasImages(request: AnthropicRequest): boolean {
  for (const msg of request.messages) {
    if (msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    if (msg.content.some(block => isImageBlock(block as AnthropicContentBlock))) {
      return true;
    }
  }
  return false;
}

/**
 * Check if last message has images
 */
export function lastMessageHasImages(request: AnthropicRequest): boolean {
  const lastMessage = request.messages[request.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  if (!Array.isArray(lastMessage.content)) return false;
  return lastMessage.content.some(block => isImageBlock(block as AnthropicContentBlock));
}

/**
 * Check if history (excluding last message) has images
 */
export function historyHasImages(request: AnthropicRequest): boolean {
  for (let i = 0; i < request.messages.length - 1; i++) {
    const msg = request.messages[i];
    if (msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    if (msg.content.some(block => isImageBlock(block as AnthropicContentBlock))) {
      return true;
    }
  }
  return false;
}

/**
 * Analyze a single image using vision model (always OpenAI format)
 */
async function analyzeImage(
  imageBlock: ImageBlock,
  task: string,
  options: ImageAgentOptions
): Promise<string> {
  const { visionBackend, clientAuthHeader } = options;
  
  // Resize if needed
  const resized = await resizeImageIfNeeded(
    imageBlock.source.data,
    imageBlock.source.media_type
  );
  
  const authHeader = clientAuthHeader || `Bearer ${visionBackend.apiKey}`;
  
  try {
    // Always use OpenAI format for vision
    const response = await fetch(`${visionBackend.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        model: visionBackend.model,
        messages: [
          {
            role: 'system',
            content: VISION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: task || 'Describe this image in detail.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${resized.media_type};base64,${resized.data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Vision analysis failed');
      return '[Image analysis failed]';
    }

    const result = await response.json() as { choices: Array<{ message: { content: string } }> };
    return result.choices?.[0]?.message?.content || '[No analysis available]';
  } catch (error) {
    logger.error({ error }, 'Vision analysis error');
    return '[Image analysis error]';
  }
}

/**
 * Process images in last message: analyze and replace with descriptions
 */
export async function processImagesInLastMessage(
  request: AnthropicRequest,
  options: ImageAgentOptions
): Promise<AnthropicRequest> {
  const lastIndex = request.messages.length - 1;
  const lastMessage = request.messages[lastIndex];
  
  if (!lastMessage || lastMessage.role !== 'user' || !Array.isArray(lastMessage.content)) {
    return request;
  }
  
  let imageCount = 0;
  const newContent: AnthropicContentBlock[] = [];
  
  // Get text context for analysis task
  const textContext = lastMessage.content
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join(' ') || 'Describe this image';
  
  for (const block of lastMessage.content) {
    if (isImageBlock(block as AnthropicContentBlock)) {
      imageCount++;
      logger.info({ imageCount }, 'Analyzing image');
      
      const description = await analyzeImage(
        block as ImageBlock,
        textContext,
        options
      );
      
      // Replace image with description
      newContent.push({
        type: 'text',
        text: `[Image ${imageCount} analysis]:\n${description}`,
      });
    } else {
      newContent.push(block);
    }
  }
  
  // Convert to string if all text
  const allText = newContent.every(b => b.type === 'text');
  const finalContent = allText
    ? newContent.map(b => b.text || '').join('\n\n')
    : newContent;
  
  const newMessages = [...request.messages];
  newMessages[lastIndex] = { ...lastMessage, content: finalContent };
  
  return { ...request, messages: newMessages };
}

/**
 * Remove images from history (replace with placeholder)
 */
export function removeImagesFromHistory(request: AnthropicRequest): AnthropicRequest {
  let globalImageCount = 0;
  
  const newMessages = request.messages.map((msg, index) => {
    // Don't modify last message
    if (index === request.messages.length - 1) return msg;
    
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
    
    const newContent = msg.content.map(block => {
      if (isImageBlock(block as AnthropicContentBlock)) {
        globalImageCount++;
        return {
          type: 'text' as const,
          text: `[Image ${globalImageCount} - previously analyzed]`,
        };
      }
      return block;
    });
    
    // Convert to string if all text
    const allText = newContent.every(b => b.type === 'text');
    const finalContent = allText
      ? newContent.map(b => b.text || '').join('\n\n')
      : newContent;
    
    return { ...msg, content: finalContent };
  });
  
  return { ...request, messages: newMessages };
}
