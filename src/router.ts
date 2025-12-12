import type { AnthropicRequest, AnthropicResponse, OpenAIRequest, OpenAIResponse, RouterConfig } from './types/index.js';
import { TelemetryCollector } from './telemetry/index.js';
import { BackendSelector } from './routing/index.js';
import { countTokens, sanitizeMessageContent } from './transform/index.js';
import agentsManager from './agents/index.js';
import {
  handleAnthropicRequest as anthropicHandler,
  handleAnthropicStreamingRequest as anthropicStreamHandler,
  handleOpenAIRequest as openaiHandler,
  handleOpenAIStreamingRequest as openaiStreamHandler,
} from './handlers/index.js';
import {
  lastMessageHasImages,
  historyHasImages,
  processImagesInLastMessage,
  removeImagesFromHistory,
  openaiLastMessageHasImages,
  openaiHistoryHasImages,
  processOpenAIImagesInLastMessage,
  removeOpenAIImagesFromHistory,
} from './vision/index.js';

// Re-export for backwards compatibility
export { countTokens };

export class AnthropicRouter {
  private config: RouterConfig;
  private telemetry: TelemetryCollector;
  private backendSelector: BackendSelector;

  constructor(config: RouterConfig) {
    this.config = config;
    this.telemetry = new TelemetryCollector(config.telemetry);
    this.backendSelector = new BackendSelector(config);
  }

  getTelemetryStats() {
    return this.telemetry.getStats();
  }

  async handleAnthropicRequest(request: AnthropicRequest, clientAuthHeader?: string): Promise<AnthropicResponse> {
    let processedRequest = request;
    
    // Apply agents processing (web search guidance, etc.)
    for (const agent of agentsManager.getAllAgents()) {
      if (agent.shouldHandle(processedRequest)) {
        processedRequest = agent.processRequest(processedRequest);
      }
    }
    
    // If last message has images, analyze them and replace with descriptions
    if (lastMessageHasImages(processedRequest) && this.config.visionBackend) {
      processedRequest = await processImagesInLastMessage(processedRequest, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    } else if (historyHasImages(processedRequest)) {
      // Just remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    }

    // Sanitize tool_result content for vLLM compatibility
    processedRequest = sanitizeMessageContent(processedRequest);

    const backend = this.backendSelector.select(processedRequest);
    return anthropicHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }

  async *handleAnthropicStreamingRequest(request: AnthropicRequest, clientAuthHeader?: string): AsyncGenerator<string> {
    let processedRequest = request;
    
    // Apply agents processing (web search guidance, etc.)
    for (const agent of agentsManager.getAllAgents()) {
      if (agent.shouldHandle(processedRequest)) {
        processedRequest = agent.processRequest(processedRequest);
      }
    }
    
    // If last message has images, analyze them and replace with descriptions
    if (lastMessageHasImages(processedRequest) && this.config.visionBackend) {
      processedRequest = await processImagesInLastMessage(processedRequest, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    } else if (historyHasImages(processedRequest)) {
      // Just remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    }

    // Sanitize tool_result content for vLLM compatibility
    processedRequest = sanitizeMessageContent(processedRequest);

    const backend = this.backendSelector.select(processedRequest);
    yield* anthropicStreamHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }

  async handleOpenAIRequest(request: OpenAIRequest, clientAuthHeader?: string): Promise<OpenAIResponse> {
    let processedRequest = request;
    
    // If last message has images, analyze them and replace with descriptions
    if (openaiLastMessageHasImages(request) && this.config.visionBackend) {
      processedRequest = await processOpenAIImagesInLastMessage(request, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeOpenAIImagesFromHistory(processedRequest);
    } else if (openaiHistoryHasImages(request)) {
      // Just remove images from history
      processedRequest = removeOpenAIImagesFromHistory(request);
    }

    const backend = this.backendSelector.selectForOpenAI(processedRequest);
    return openaiHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }

  async *handleOpenAIStreamingRequest(request: OpenAIRequest, clientAuthHeader?: string): AsyncGenerator<string> {
    let processedRequest = request;
    
    // If last message has images, analyze them and replace with descriptions
    if (openaiLastMessageHasImages(request) && this.config.visionBackend) {
      processedRequest = await processOpenAIImagesInLastMessage(request, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeOpenAIImagesFromHistory(processedRequest);
    } else if (openaiHistoryHasImages(request)) {
      // Just remove images from history
      processedRequest = removeOpenAIImagesFromHistory(request);
    }

    const backend = this.backendSelector.selectForOpenAI(processedRequest);
    yield* openaiStreamHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }
}
