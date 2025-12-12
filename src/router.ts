import type { AnthropicRequest, AnthropicResponse, OpenAIRequest, OpenAIResponse, RouterConfig } from './types/index.js';
import { TelemetryCollector } from './telemetry/index.js';
import { BackendSelector } from './routing/index.js';
import { countTokens } from './transform/index.js';
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
} from './agents/index.js';

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
    
    // If last message has images, analyze them and replace with descriptions
    if (lastMessageHasImages(request) && this.config.visionBackend) {
      processedRequest = await processImagesInLastMessage(request, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    } else if (historyHasImages(request)) {
      // Just remove images from history
      processedRequest = removeImagesFromHistory(request);
    }

    const backend = this.backendSelector.select(processedRequest);
    return anthropicHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
      isVisionRequest: false,
    });
  }

  async *handleAnthropicStreamingRequest(request: AnthropicRequest, clientAuthHeader?: string): AsyncGenerator<string> {
    let processedRequest = request;
    
    // If last message has images, analyze them and replace with descriptions
    if (lastMessageHasImages(request) && this.config.visionBackend) {
      processedRequest = await processImagesInLastMessage(request, {
        visionBackend: this.config.visionBackend,
        clientAuthHeader,
      });
      // Remove images from history
      processedRequest = removeImagesFromHistory(processedRequest);
    } else if (historyHasImages(request)) {
      // Just remove images from history
      processedRequest = removeImagesFromHistory(request);
    }

    const backend = this.backendSelector.select(processedRequest);
    yield* anthropicStreamHandler(processedRequest, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
      isVisionRequest: false,
    });
  }

  async handleOpenAIRequest(request: OpenAIRequest, clientAuthHeader?: string): Promise<OpenAIResponse> {
    const backend = this.backendSelector.selectForOpenAI(request);
    return openaiHandler(request, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }

  async *handleOpenAIStreamingRequest(request: OpenAIRequest, clientAuthHeader?: string): AsyncGenerator<string> {
    const backend = this.backendSelector.selectForOpenAI(request);
    yield* openaiStreamHandler(request, {
      backend,
      onTelemetry: (usage) => this.telemetry.record(usage),
      clientAuthHeader,
    });
  }
}
