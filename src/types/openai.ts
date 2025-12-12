import { z } from 'zod';

// Message Content Schema
export const OpenAIMessageContentSchema = z.union([
  z.string(),
  z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
    image_url: z.object({
      url: z.string(),
    }).optional(),
  })),
]);

// Message Schema
export const OpenAIMessageSchema = z.object({
  role: z.string(),
  content: OpenAIMessageContentSchema,
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
});

// Request Schema
export const OpenAIRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OpenAIMessageSchema),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.object({
    type: z.string(),
    function: z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()),
    }),
  })).optional(),
  tool_choice: z.union([
    z.string(),
    z.object({
      type: z.string(),
      function: z.object({
        name: z.string(),
      }).optional(),
    }),
  ]).optional(),
});

// Inferred types
export type OpenAIRequest = z.infer<typeof OpenAIRequestSchema>;

// Response types (not validated)
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
