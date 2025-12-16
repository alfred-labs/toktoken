import type {FastifyInstance} from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';

import metricsPlugin from './plugins/metrics.js';
import anthropicRoutes from './routes/anthropic.js';
import openaiRoutes from './routes/openai.js';
import systemRoutes from './routes/system.js';
import type {AppConfig} from './types/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export interface BuildAppOptions {
  config: AppConfig;
  logLevel?: string;
  logPretty?: boolean;
  logFilePath?: string;
}

/** Creates and configures the Fastify application. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const {config, logLevel = 'info', logPretty = false, logFilePath} = options;

  // Build pino targets for transport
  const targets: {target: string; options: Record<string, unknown>; level: string}[] = [];

  // Console target
  if (logPretty) {
    targets.push({target: 'pino-pretty', options: {colorize: true}, level: logLevel});
  } else {
    targets.push({target: 'pino/file', options: {destination: 1}, level: logLevel});
  }

  // File target (if specified)
  if (logFilePath) {
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
    targets.push({target: 'pino/file', options: {destination: logFilePath}, level: logLevel});
  }

  const app = Fastify({
    logger: targets.length > 0 ? {level: logLevel, transport: {targets}} : {level: logLevel},
    bodyLimit: 50 * 1024 * 1024, // 50MB for base64 images
  });

  app.decorate('config', config);

  await app.register(cors, {origin: true});
  await app.register(metricsPlugin);
  await app.register(systemRoutes);
  await app.register(anthropicRoutes);
  await app.register(openaiRoutes);

  return app;
}
