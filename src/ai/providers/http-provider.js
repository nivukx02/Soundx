import fs from 'node:fs';
import path from 'node:path';
import { MusicGenerationProvider } from './provider.js';
import { ProviderError } from '../errors.js';
import { compileGenerationPrompt } from '../prompt-compiler.js';
import { sha256File } from '../utils.js';
import {
  normalizeAnalysis,
  normalizeCapabilities,
  normalizeCandidates,
  normalizeJobStatus,
  normalizeOriginalityReview,
  normalizeSubmission
} from './protocol.js';

function loopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export class NivHttpProvider extends MusicGenerationProvider {
  static adapterId = 'niv-http/1';

  constructor(configuration) {
    super();
    this.configuration = Object.freeze({ ...configuration });
    this.baseUrl = new URL(configuration.baseUrl);
    this.uploadCache = new Map();
  }

  publicConfiguration() {
    return {
      adapter: NivHttpProvider.adapterId,
      configured: true,
      mode: this.configuration.mode,
      baseUrl: this.baseUrl.href,
      providerId: this.configuration.providerId,
      model: this.configuration.model,
      authenticationConfigured: Boolean(this.configuration.apiKey),
      requestTimeoutMs: this.configuration.requestTimeoutMs,
      jobTimeoutMs: this.configuration.jobTimeoutMs,
      maxArtifactBytes: this.configuration.maxArtifactBytes,
      localPathArtifactsEnabled: Boolean(this.configuration.localArtifactRoot)
    };
  }

  authHeaders() {
    if (!this.configuration.apiKey) return {};
    const prefix = this.configuration.authScheme ? `${this.configuration.authScheme} ` : '';
    return { [this.configuration.authHeader]: `${prefix}${this.configuration.apiKey}` };
  }

  async requestJson(relativePath, { method = 'GET', json, body, headers = {}, timeoutMs } = {}) {
    const url = new URL(relativePath, this.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Provider request timed out')), timeoutMs ?? this.configuration.requestTimeoutMs);
    const requestHeaders = { Accept: 'application/json', ...this.authHeaders(), ...headers };
    let requestBody = body;
    if (json !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(json);
    }
    try {
      const options = { method, headers: requestHeaders, body: requestBody, signal: controller.signal };
      if (body && typeof body.pipe === 'function') options.duplex = 'half';
      const response = await fetch(url, options);
      const limit = Math.min(Math.ceil(this.configuration.maxArtifactBytes * 1.5), 2_500_000_000);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body ?? []) {
        bytes += chunk.length;
        if (bytes > limit) throw new ProviderError(`Provider JSON response exceeded ${limit} bytes`);
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      if (!response.ok) {
        throw new ProviderError(`Provider returned HTTP ${response.status}`, {
          status: response.status,
          response: text.slice(0, 8192)
        });
      }
      try {
        return text ? JSON.parse(text) : {};
      } catch (error) {
        throw new ProviderError('Provider returned invalid JSON', { status: response.status }, error);
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(`Provider request failed: ${error.message}`, { url: url.origin }, error);
    } finally {
      clearTimeout(timer);
    }
  }

  async capabilities() {
    return normalizeCapabilities(await this.requestJson('/v1/capabilities'));
  }

  async generate(plan, inputs = {}) {
    const response = await this.requestJson('/v1/generations', {
      method: 'POST',
      json: {
        schemaVersion: 'niv.generation-request/1',
        operation: plan.operation,
        model: plan.generation.model,
        candidateCount: plan.generation.candidateCount,
        seedPolicy: plan.generation.seedPolicy,
        outputStems: plan.generation.outputStems,
        providerParameters: plan.generation.providerParameters,
        prompt: compileGenerationPrompt(plan),
        plan,
        inputs
      }
    });
    return normalizeSubmission(response);
  }

  async uploadFile(filePath, purpose = 'audio') {
    const resolved = path.resolve(filePath);
    const stats = await fs.promises.stat(resolved);
    if (!stats.isFile()) throw new ProviderError(`Upload source is not a regular file: ${resolved}`);
    if (stats.size > this.configuration.maxArtifactBytes) throw new ProviderError(`Upload exceeds ${this.configuration.maxArtifactBytes} bytes`);
    const sha256 = await sha256File(resolved);
    const cacheKey = `${resolved}:${stats.size}:${stats.mtimeMs}:${purpose}`;
    if (this.uploadCache.has(cacheKey)) return this.uploadCache.get(cacheKey);
    const response = await this.requestJson('/v1/uploads', {
      method: 'POST',
      body: fs.createReadStream(resolved),
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stats.size),
        'X-NIV-File-Name': encodeURIComponent(path.basename(resolved)),
        'X-NIV-Purpose': purpose,
        'X-NIV-SHA256': sha256
      },
      timeoutMs: this.configuration.jobTimeoutMs
    });
    if (!response.assetId || typeof response.assetId !== 'string') throw new ProviderError('Upload response requires assetId');
    const uploaded = { assetId: response.assetId, sha256, bytes: stats.size };
    this.uploadCache.set(cacheKey, uploaded);
    return uploaded;
  }

  async transform(plan, source, stems = []) {
    const sourceAsset = await this.uploadFile(source, 'source-audio');
    const stemAssets = [];
    for (const stem of stems) stemAssets.push(await this.uploadFile(stem, 'source-stem'));
    const response = await this.requestJson('/v1/transforms', {
      method: 'POST',
      json: {
        schemaVersion: 'niv.generation-request/1',
        operation: plan.operation,
        model: plan.generation.model,
        candidateCount: plan.generation.candidateCount,
        seedPolicy: plan.generation.seedPolicy,
        outputStems: plan.generation.outputStems,
        providerParameters: plan.generation.providerParameters,
        prompt: compileGenerationPrompt(plan),
        plan,
        source: sourceAsset,
        stems: stemAssets
      },
      timeoutMs: this.configuration.requestTimeoutMs
    });
    return normalizeSubmission(response);
  }

  async status(jobId) {
    return normalizeJobStatus(await this.requestJson(`/v1/jobs/${encodeURIComponent(jobId)}`));
  }

  async cancel(jobId) {
    return this.requestJson(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  }

  async collect(jobId) {
    const response = await this.requestJson(`/v1/jobs/${encodeURIComponent(jobId)}/result`, { timeoutMs: this.configuration.jobTimeoutMs });
    return normalizeCandidates(response.candidates);
  }

  async analyze(audioPath, plan) {
    const asset = await this.uploadFile(audioPath, 'candidate-analysis');
    const response = await this.requestJson('/v1/analysis', {
      method: 'POST',
      json: {
        schemaVersion: 'niv.analysis-request/1',
        asset,
        plan,
        requirements: {
          openSet: true,
          retainUnknownAcousticSources: true,
          sectionLevelEvidence: true,
          planCompliance: true
        }
      },
      timeoutMs: this.configuration.jobTimeoutMs
    });
    return normalizeAnalysis(response, asset.sha256);
  }

  async reviewOriginality(audioPath, sourcePath, plan) {
    const asset = await this.uploadFile(audioPath, 'candidate-originality');
    const source = sourcePath ? await this.uploadFile(sourcePath, 'originality-reference') : null;
    const response = await this.requestJson('/v1/originality', {
      method: 'POST',
      json: {
        schemaVersion: 'niv.originality-request/1',
        asset,
        source,
        operation: plan.operation,
        protectedDimensions: ['melody', 'lyrics', 'hook', 'recording-identity', 'performer-identity', 'audio-fingerprint']
      },
      timeoutMs: this.configuration.jobTimeoutMs
    });
    return normalizeOriginalityReview(response, asset.sha256);
  }

  permitsArtifactUrl(url) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.protocol === 'https:') return true;
    return this.configuration.allowInsecureHttp || loopback(parsed.hostname);
  }
}
