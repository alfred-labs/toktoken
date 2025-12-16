import {lookup} from 'mime-types';
import type {OpenAIRequest} from '../types/index.js';

/** Gets MIME type from file extension. */
export function getMimeType(extension: string): string | false {
  return lookup(extension);
}

/** Checks if a MIME type is an image type. */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Removes tool_choice when tools is empty or missing (vLLM validation fix). */
export function sanitizeToolChoice(body: OpenAIRequest): OpenAIRequest {
  if (body.tool_choice && (!body.tools || (body.tools as unknown[]).length === 0)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {tool_choice, ...rest} = body;
    return rest as OpenAIRequest;
  }
  return body;
}
