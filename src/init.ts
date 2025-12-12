import pino from 'pino';
import { z } from 'zod';

export const logger = pino({ level: 'info' });

const ModelsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
  })).optional(),
});

const MODEL_CACHE_TTL_MS = 60_000; // 1 minute

interface ModelCache {
  model: string;
  timestamp: number;
}

const modelCache = new Map<string, ModelCache>();

export async function checkBackendHealth(url: string, name: string): Promise<void> {
  const healthUrl = `${url}/health`;
  const modelsUrl = `${url}/v1/models`;
  
  for (const endpoint of [healthUrl, modelsUrl]) {
    try {
      const response = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (response.ok || response.status === 401) {
        logger.info({ backend: name, endpoint }, 'Backend reachable');
        return;
      }
    } catch {
      // Try next endpoint
    }
  }
  
  throw new Error(`Backend ${name} unreachable at ${url} - check VLLM_URL`);
}

async function fetchModelFromBackend(url: string, apiKey?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const response = await fetch(`${url}/v1/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) return null;
    
    const json = await response.json();
    const data = ModelsResponseSchema.parse(json);
    
    if (data.data && data.data.length > 0) {
      return data.data[0].id;
    }
  } catch {
    // Model discovery failed
  }
  return null;
}

export async function discoverModel(url: string, apiKey?: string): Promise<string | null> {
  const cached = modelCache.get(url);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < MODEL_CACHE_TTL_MS) {
    return cached.model;
  }
  
  const model = await fetchModelFromBackend(url, apiKey);
  
  if (model) {
    modelCache.set(url, { model, timestamp: now });
    logger.info({ url, model }, 'Discovered model from backend');
  }
  
  return model;
}

export async function getAvailableModels(url: string, apiKey?: string): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const response = await fetch(`${url}/v1/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) return [];
    
    const json = await response.json();
    const data = ModelsResponseSchema.parse(json);
    
    return data.data?.map(m => m.id) || [];
  } catch {
    return [];
  }
}

export function clearModelCache(): void {
  modelCache.clear();
}
