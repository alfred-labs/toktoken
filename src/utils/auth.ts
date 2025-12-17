import type {BackendConfig} from '../types/index.js';

/** Decodes a JWT without verification (for extracting claims). */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url payload
    const payload = parts[1];
    const buffer = Buffer.from(payload, 'base64');
    const payloadStr = buffer.toString('utf8');
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

/** Extracts email from Authorization header (JWT). */
export function extractEmailFromAuth(authHeader?: string): string | null {
  if (!authHeader) return null;

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) return null;

  const claims = decodeJWT(token);
  if (!claims || typeof claims.email !== 'string') return null;

  return claims.email;
}

/** Creates a short hash of an email for use as a tag value. */
export function hashEmail(email: string): string {
  if (!email) return 'unknown';
  
  const local = email.split('@')[0]?.toLowerCase();
  if (!local) return 'unknown';
  
  const parts = local.split('.');
  const first = parts[0]?.charAt(0) || 'x';
  const last = parts.length > 1 ? parts[1]?.substring(0, 2) || 'xx' : local.substring(1, 3) || 'xx';
  
  let hash = 0;
  for (let i = 0; i < local.length; i++) {
    hash = (hash << 5) - hash + local.charCodeAt(i);
  }
  
  return `${first}${last}-${Math.abs(hash).toString(16).padStart(4, '0').slice(0, 4)}`;
}

/** Checks if a URL is an internal cluster service. */
export function isInternalService(url: string): boolean {
  return url.includes('.cluster.local');
}

/**
 * Returns the appropriate auth for a backend.
 * Internal cluster services always use the backend's API key.
 * External services prefer backend key, fallback to client auth.
 */
export function getBackendAuth(
  backend: Pick<BackendConfig, 'url' | 'apiKey'>,
  clientAuth?: string,
): string | undefined {
  if (isInternalService(backend.url)) {
    return backend.apiKey;
  }
  return backend.apiKey || clientAuth;
}
