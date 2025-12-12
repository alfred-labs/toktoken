import { z } from 'zod';

// Token Count Request Schema
export const TokenCountRequestSchema = z.object({
  messages: z.array(z.object({
    content: z.union([
      z.string(),
      z.array(z.object({
        type: z.string(),
        text: z.string().optional(),
        input: z.unknown().optional(),
        content: z.unknown().optional(),
      })),
    ]),
  })).optional(),
  system: z.union([
    z.string(),
    z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })),
  ]).optional(),
  tools: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    input_schema: z.unknown().optional(),
  })).optional(),
});

// Backend Config Schema
export const BackendConfigSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  apiKey: z.string(),
  model: z.string(),
  anthropicNative: z.boolean().optional(),
});

// Telemetry Config Schema
export const TelemetryConfigSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().url().optional(),
});

// Router Config Schema
export const RouterConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string(),
  apiKey: z.string(),
  defaultBackend: BackendConfigSchema,
  visionBackend: BackendConfigSchema.optional(),
  telemetry: TelemetryConfigSchema,
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

// Inferred types
export type TokenCountRequest = z.infer<typeof TokenCountRequestSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;
export type RouterConfig = z.infer<typeof RouterConfigSchema>;

// Telemetry types
export interface TokenUsage {
  requestId: string;
  timestamp: Date;
  model: string;
  backend: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  hasToolCalls: boolean;
  hasVision: boolean;
}
