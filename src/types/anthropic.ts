import { z } from 'zod';

// Content Block Schema
export const AnthropicContentBlockSchema = z.object({
  type: z.enum(['text', 'image', 'tool_use', 'tool_result']),
  text: z.string().optional(),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.string(),
    data: z.string(),
  }).optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  tool_use_id: z.string().optional(),
  content: z.string().optional(),
});

// Message Schema
export const AnthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
});

// Tool Schema
export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.string(), z.unknown()),
});

// System Content Block Schema (for array format)
export const AnthropicSystemBlockSchema = z.object({
  type: z.enum(['text']),
  text: z.string(),
  cache_control: z.object({
    type: z.string(),
  }).optional(),
});

// Request Schema
export const AnthropicRequestSchema = z.object({
  model: z.string(),
  messages: z.array(AnthropicMessageSchema),
  max_tokens: z.number(),
  system: z.union([z.string(), z.array(AnthropicSystemBlockSchema)]).optional(),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: z.object({
    type: z.string(),
    name: z.string().optional(),
  }).optional(),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  stop_sequences: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Inferred types
export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;
export type AnthropicRequest = z.infer<typeof AnthropicRequestSchema>;

// Response types (not validated)
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamEvent {
  type: string;
  message?: Partial<AnthropicResponse>;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}
