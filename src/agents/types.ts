import type { AnthropicRequest } from '../types/index.js';

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export interface Agent {
  name: string;
  tools: Map<string, AgentTool>;
  
  /** Check if this agent should handle the request */
  shouldHandle: (request: AnthropicRequest) => boolean;
  
  /** Modify request before sending to backend */
  processRequest: (request: AnthropicRequest) => AnthropicRequest;
}
