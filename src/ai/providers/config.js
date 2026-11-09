import path from 'node:path';
import { ConfigurationError } from '../errors.js';
import { parseBoolean, parsePositiveInteger } from '../utils.js';
import { NivHttpProvider } from './http-provider.js';

function loopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function providerConfigurationFromEnvironment(env = process.env) {
  const missing = ['NIV_AI_BASE_URL', 'NIV_AI_MODEL'].filter(key => !env[key]?.trim());
  if (missing.length) {
    return { configured: false, missing, reason: `Set ${missing.join(' and ')} to connect a real music model.` };
  }
  let baseUrl;
  try {
    baseUrl = new URL(env.NIV_AI_BASE_URL);
  } catch {
    throw new ConfigurationError('NIV_AI_BASE_URL must be an absolute HTTP(S) URL');
  }
  const mode = env.NIV_AI_PROVIDER_MODE?.toLowerCase() ?? (loopback(baseUrl.hostname) ? 'local' : 'remote');
  if (!['local', 'remote'].includes(mode)) throw new ConfigurationError('NIV_AI_PROVIDER_MODE must be local or remote');
  if (mode === 'local' && !loopback(baseUrl.hostname)) throw new ConfigurationError('Local providers must use a loopback hostname');
  if (mode === 'remote' && baseUrl.protocol !== 'https:' && !parseBoolean(env.NIV_AI_ALLOW_INSECURE_HTTP)) {
    throw new ConfigurationError('Remote providers require HTTPS; NIV_AI_ALLOW_INSECURE_HTTP=1 is only for controlled development');
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new ConfigurationError('NIV_AI_BASE_URL must use HTTP or HTTPS');
  if (mode === 'remote' && !env.NIV_AI_API_KEY && !parseBoolean(env.NIV_AI_ALLOW_ANONYMOUS)) {
    throw new ConfigurationError('Remote providers require NIV_AI_API_KEY unless anonymous access is explicitly enabled');
  }
  return {
    configured: true,
    mode,
    baseUrl: baseUrl.href,
    providerId: env.NIV_AI_PROVIDER_ID?.trim() || baseUrl.hostname,
    model: env.NIV_AI_MODEL.trim(),
    apiKey: env.NIV_AI_API_KEY || null,
    authHeader: env.NIV_AI_AUTH_HEADER?.trim() || 'Authorization',
    authScheme: env.NIV_AI_AUTH_SCHEME === undefined ? 'Bearer' : env.NIV_AI_AUTH_SCHEME.trim(),
    requestTimeoutMs: parsePositiveInteger(env.NIV_AI_REQUEST_TIMEOUT_MS, 'NIV_AI_REQUEST_TIMEOUT_MS', 120000),
    jobTimeoutMs: parsePositiveInteger(env.NIV_AI_JOB_TIMEOUT_MS, 'NIV_AI_JOB_TIMEOUT_MS', 30 * 60 * 1000),
    maxArtifactBytes: parsePositiveInteger(env.NIV_AI_MAX_ARTIFACT_BYTES, 'NIV_AI_MAX_ARTIFACT_BYTES', 2 * 1024 * 1024 * 1024),
    localArtifactRoot: env.NIV_AI_LOCAL_ARTIFACT_ROOT ? path.resolve(env.NIV_AI_LOCAL_ARTIFACT_ROOT) : null,
    allowInsecureHttp: parseBoolean(env.NIV_AI_ALLOW_INSECURE_HTTP)
  };
}

export function createProviderFromEnvironment(env = process.env) {
  const configuration = providerConfigurationFromEnvironment(env);
  if (!configuration.configured) throw new ConfigurationError(configuration.reason, { missing: configuration.missing });
  return new NivHttpProvider(configuration);
}
