import Fastify from 'fastify';
import cors from '@fastify/cors';
import pino from 'pino';
import { loadConfig } from './config.js';
import { AnthropicRouter } from './router.js';
import {
  handleTokenCount,
  createAnthropicMessagesHandler,
  createOpenAIChatHandler,
  createHealthHandler,
  createStatsHandler,
  createModelsHandler,
} from './handlers/index.js';
import { checkBackendHealth, discoverModel, getAvailableModels } from './init.js';

const logger = pino({ level: 'info' });

async function main() {
  const config = loadConfig();
  
  // Verify backend connectivity before starting
  logger.info('Checking backend connectivity');
  await checkBackendHealth(config.defaultBackend.url, config.defaultBackend.name);
  
  // Auto-discover or validate default backend model
  const availableModels = await getAvailableModels(config.defaultBackend.url, config.defaultBackend.apiKey);
  if (availableModels.length > 0) {
    // Empty string or undefined - use discovered model
    if (!config.defaultBackend.model || config.defaultBackend.model.trim() === '') {
      config.defaultBackend.model = availableModels[0];
      logger.info({ model: config.defaultBackend.model }, 'Using discovered model');
    } else if (!availableModels.includes(config.defaultBackend.model)) {
      const originalModel = config.defaultBackend.model;
      config.defaultBackend.model = availableModels[0];
      logger.warn({ requested: originalModel, actual: config.defaultBackend.model }, 'Model overwritten - requested model not available');
    }
  } else {
    logger.warn({ url: config.defaultBackend.url }, 'No models discovered from backend');
  }
  
  if (config.visionBackend) {
    await checkBackendHealth(config.visionBackend.url, config.visionBackend.name);
    
    // Auto-discover vision model if not specified
    if (!config.visionBackend.model || config.visionBackend.model === 'auto') {
      const discoveredModel = await discoverModel(config.visionBackend.url, config.visionBackend.apiKey);
      if (discoveredModel) {
        config.visionBackend.model = discoveredModel;
        logger.info({ model: discoveredModel }, 'Using discovered vision model');
      }
    } else {
      // Check if configured vision model exists
      const visionModels = await getAvailableModels(config.visionBackend.url, config.visionBackend.apiKey);
      if (visionModels.length > 0 && !visionModels.includes(config.visionBackend.model)) {
        const originalModel = config.visionBackend.model;
        config.visionBackend.model = visionModels[0];
        logger.warn({ requested: originalModel, actual: config.visionBackend.model }, 'Vision model overwritten - requested model not available');
      }
    }
  }
  
  const router = new AnthropicRouter(config);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  await app.register(cors, { origin: true });

  const ctx = { router, config };

  // Routes - no schema validation, pass through to SDK types
  app.get('/health', createHealthHandler());
  app.get('/stats', createStatsHandler(ctx));
  app.get('/v1/models', createModelsHandler(ctx));
  app.post('/v1/messages/count_tokens', async (request) => handleTokenCount(request.body));
  app.post('/v1/messages', createAnthropicMessagesHandler(ctx));
  app.post('/v1/chat/completions', createOpenAIChatHandler(ctx));

  // Start server
  const host = config.host;
  const port = config.port;
  
  await app.listen({ host, port });
  
  logger.info({
    host,
    port,
    backend: config.defaultBackend.url,
    model: config.defaultBackend.model,
    telemetry: config.telemetry.enabled
  }, 'Server started');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
