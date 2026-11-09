import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createPcm32Wav, parseWavBuffer } from '../src/ai/audio/wav.js';
import { createPromptMusicPlan, assertValidMusicPlan } from '../src/ai/music-plan.js';
import { runEliteGeneration } from '../src/ai/orchestrator.js';
import { NivHttpProvider } from '../src/ai/providers/http-provider.js';
import { providerConfigurationFromEnvironment } from '../src/ai/providers/config.js';
import { decodeFromNIV } from '../decoder.js';
import { encodeToNIV } from '../encoder.js';
import { sha256Buffer } from '../src/ai/utils.js';
import { audioToPCM, getAudioMetadata } from '../audioProcessor.js';
import { renderCanonicalAudio } from '../src/ai/audio/canonical.js';

function json(response, status, value) {
  const data = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': data.length });
  response.end(data);
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function sha256(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function testOnlyAudioFixture() {
  // This deterministic tone is only a protocol fixture. It is never presented as AI output.
  const sampleRate = 48000;
  const samples = new Int32Array(sampleRate);
  for (let index = 0; index < samples.length; index++) {
    samples[index] = Math.round(Math.sin(2 * Math.PI * 220 * index / sampleRate) * 0x180000) * 256;
  }
  return createPcm32Wav(Buffer.from(samples.buffer), { channels: 1, sampleRate });
}

async function startProtocolFixture() {
  const audio = testOnlyAudioFixture();
  const audioHash = sha256(audio);
  const assets = new Map();
  let uploadIndex = 0;
  let statusCalls = 0;
  let cancelCalls = 0;
  const capabilities = {
    schemaVersion: 'niv.ai-capabilities/1',
    providerId: 'test-only-protocol-fixture',
    providerVersion: '1.0-test',
    operations: ['prompt-generate', 'reference-transform', 'edit', 'extend', 'remix'],
    models: [{ id: 'contract-test-model' }],
    outputFormats: ['wav'],
    sampleRates: [48000],
    channelCounts: [1, 2],
    limits: { maxDurationSeconds: 60, maxCandidates: 4 },
    features: {
      seeds: true,
      stems: false,
      analysis: { available: true, calibrated: true, openSet: true, model: 'test-analyzer', taxonomyVersion: 'test-taxonomy/1' },
      originality: { available: true, model: 'test-comparator', corpusVersion: 'test-corpus/1' }
    }
  };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/v1/capabilities') return json(response, 200, capabilities);
      if (request.method === 'POST' && url.pathname === '/v1/generations') {
        const payload = JSON.parse((await body(request)).toString('utf8'));
        assert.equal(payload.schemaVersion, 'niv.generation-request/1');
        assert.match(payload.prompt, /completely original/i);
        return json(response, 202, { status: 'queued', jobId: 'fixture-job-1' });
      }
      if (request.method === 'POST' && url.pathname === '/v1/transforms') {
        const payload = JSON.parse((await body(request)).toString('utf8'));
        assert.equal(payload.schemaVersion, 'niv.generation-request/1');
        assert.equal(payload.operation, 'edit');
        assert.match(payload.source.assetId, /^asset-/);
        return json(response, 202, { status: 'queued', jobId: 'fixture-job-1' });
      }
      if (request.method === 'GET' && url.pathname === '/v1/jobs/fixture-job-1') {
        statusCalls++;
        return json(response, 200, { jobId: 'fixture-job-1', status: statusCalls === 1 ? 'running' : 'completed', progress: statusCalls === 1 ? 0.5 : 1 });
      }
      if (request.method === 'GET' && url.pathname === '/v1/jobs/fixture-job-1/result') {
        return json(response, 200, { candidates: [{
          id: 'fixture-candidate-1',
          artifact: { kind: 'base64', data: audio.toString('base64') },
          mediaType: 'audio/wav',
          format: 'wav',
          model: 'contract-test-model',
          seed: 42,
          providerScore: 0.8,
          sha256: audioHash,
          provenance: { testOnly: true, statement: 'Protocol fixture; not AI-generated music' }
        }] });
      }
      if (request.method === 'DELETE' && url.pathname.startsWith('/v1/jobs/')) {
        cancelCalls++;
        return json(response, 200, { cancelled: true });
      }
      if (request.method === 'POST' && url.pathname === '/v1/uploads') {
        const bytes = await body(request);
        const assetId = `asset-${++uploadIndex}`;
        assets.set(assetId, sha256(bytes));
        return json(response, 201, { assetId });
      }
      if (request.method === 'POST' && url.pathname === '/v1/analysis') {
        const payload = JSON.parse((await body(request)).toString('utf8'));
        return json(response, 200, {
          schemaVersion: 'niv.analysis/1',
          audioSha256: assets.get(payload.asset.assetId),
          calibrated: true,
          model: 'test-analyzer',
          modelVersion: '1-test',
          taxonomyVersion: 'test-taxonomy/1',
          calibration: { method: 'test-fixture-ground-truth', datasetVersion: 'fixture-dataset/1' },
          instruments: [{ canonicalId: 'electrophone:test-oscillator', canonicalName: 'test oscillator', family: 'electrophone', confidence: 0.99, evidence: ['test-fixture-ground-truth'] }],
          unknownSounds: [],
          planCompliance: { structure: { passed: true, score: 0.95, evidence: ['test-fixture-contract'] }, overallScore: 0.9 }
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/originality') {
        const payload = JSON.parse((await body(request)).toString('utf8'));
        return json(response, 200, {
          schemaVersion: 'niv.originality-review/1',
          audioSha256: assets.get(payload.asset.assetId),
          passed: true,
          method: 'test-fixture-known-origin',
          reviewerModel: 'test-comparator',
          distanceScore: 1,
          threshold: 0.5,
          corpusVersion: 'test-corpus/1',
          flaggedMatches: []
        });
      }
      return json(response, 404, { error: 'not found' });
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, capabilities, baseUrl: `http://127.0.0.1:${address.port}/`, get cancelCalls() { return cancelCalls; } };
}

test('unconfigured environments never pretend that AI generation is available', () => {
  const result = providerConfigurationFromEnvironment({});
  assert.equal(result.configured, false);
  assert.deepEqual(result.missing, ['NIV_AI_BASE_URL', 'NIV_AI_MODEL']);
});

test('remote providers require HTTPS and authentication by default', () => {
  assert.throws(() => providerConfigurationFromEnvironment({
    NIV_AI_BASE_URL: 'http://music.example.test/',
    NIV_AI_PROVIDER_MODE: 'remote',
    NIV_AI_MODEL: 'model'
  }), /HTTPS/);
  assert.throws(() => providerConfigurationFromEnvironment({
    NIV_AI_BASE_URL: 'https://music.example.test/',
    NIV_AI_PROVIDER_MODE: 'remote',
    NIV_AI_MODEL: 'model'
  }), /API_KEY/);
});

test('draft plans cannot enter inference', () => {
  const plan = createPromptMusicPlan({ prompt: 'Original acoustic chamber work', durationSeconds: 10 });
  assert.equal(plan.stage, 'draft');
  assert.throws(() => assertValidMusicPlan(plan, { requireReady: true }), /strict validation/i);
});

test('authorized NIV edit plans require and retain an explicit source and rights status', () => {
  const plan = createPromptMusicPlan({
    prompt: 'Create a new arrangement while preserving only the authorized tempo contour',
    operation: 'edit',
    sourceNivPath: 'source.niv',
    sourceRights: 'licensed',
    preserve: ['tempo contour'],
    change: ['melody', 'recording identity']
  });
  assert.equal(plan.operation, 'edit');
  assert.equal(plan.source.nivPath, 'source.niv');
  assert.equal(plan.source.rights, 'licensed');
  assert.deepEqual(plan.intent.preserve, ['tempo contour']);
  assert.doesNotThrow(() => assertValidMusicPlan(plan));
});

test('legacy audio import reads WAV directly without a separate FFprobe binary', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'niv-import-test-'));
  try {
    const audio = testOnlyAudioFixture();
    const audioPath = path.join(directory, 'fixture.wav');
    await fs.promises.writeFile(audioPath, audio);
    const metadata = await getAudioMetadata(audioPath);
    const decoded = await audioToPCM(audioPath);
    assert.equal(metadata.sampleRate, 48000);
    assert.equal(metadata.channels, 1);
    assert.equal(decoded.audioInfo.frames, 48000);
    assert.equal(decoded.pcmData.length, 48000 * 4);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('FLAC delivery rejects full 32-bit PCM that the bundled encoder would truncate', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'niv-flac-precision-test-'));
  try {
    const pcmData = Buffer.from(new Int32Array([1, 257, -513]).buffer);
    await assert.rejects(() => renderCanonicalAudio({
      pcmData,
      audioInfo: { channels: 1, sampleRate: 48000, frames: 3, duration: 3 / 48000 }
    }, path.join(directory, 'invalid.flac'), 'flac'), /24 valid bits/);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('full provider job, evidence gates, NIV encode, and exact decode verification', async () => {
  const fixture = await startProtocolFixture();
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'niv-elite-test-'));
  try {
    const configuration = {
      configured: true,
      mode: 'local',
      baseUrl: fixture.baseUrl,
      providerId: fixture.capabilities.providerId,
      model: 'contract-test-model',
      apiKey: null,
      authHeader: 'Authorization',
      authScheme: 'Bearer',
      requestTimeoutMs: 10000,
      jobTimeoutMs: 60000,
      maxArtifactBytes: 32 * 1024 * 1024,
      localArtifactRoot: null,
      allowInsecureHttp: false
    };
    const provider = new NivHttpProvider(configuration);
    const capabilities = await provider.capabilities();
    const plan = createPromptMusicPlan({
      prompt: 'A one-second original test composition with a clean ending',
      durationSeconds: 1,
      sampleRate: 48000,
      channels: 1,
      candidateCount: 1,
      providerAudit: { configured: true, providerId: capabilities.providerId, model: configuration.model, capabilities },
      outputDirectory: 'delivery',
      audioFormat: 'flac'
    });
    assert.equal(plan.stage, 'ready-for-inference');
    const planPath = path.join(directory, 'music-plan.json');
    await fs.promises.writeFile(planPath, JSON.stringify(plan));
    let result;
    try {
      result = await runEliteGeneration({ plan, planPath, provider, pollIntervalMs: 5 });
    } catch (error) {
      if (error.jobDirectory) {
        const evaluation = path.join(error.jobDirectory, 'candidates', '01', 'evaluation.json');
        if (fs.existsSync(evaluation)) console.error(await fs.promises.readFile(evaluation, 'utf8'));
      }
      throw error;
    }
    assert.equal(result.manifest.quality.passed, true);
    assert.equal(result.manifest.generation.provider, configuration.providerId);
    assert.equal(result.manifest.candidateSelection.candidates[0].accepted, true);
    assert.equal(result.manifest.analysis.instruments[0].canonicalName, 'test oscillator');
    const decoded = await decodeFromNIV(result.outputs.nivPath, { maxDecodedBytes: configuration.maxArtifactBytes });
    assert.equal(sha256Buffer(decoded.pcmData), result.manifest.audio.pcmHash);
    assert.equal(decoded.metadata.schema, 'niv.music/2');
    assert.equal(decoded.metadata.generation.seed, 42);
    await fs.promises.access(result.outputs.audioPath);
    await fs.promises.access(result.outputs.manifestPath);
  } finally {
    await new Promise(resolve => fixture.server.close(resolve));
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('authorized NIV source is decoded, analyzed, transformed, and repackaged exactly', async () => {
  const fixture = await startProtocolFixture();
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'niv-transform-test-'));
  try {
    const configuration = {
      configured: true,
      mode: 'local',
      baseUrl: fixture.baseUrl,
      providerId: fixture.capabilities.providerId,
      model: 'contract-test-model',
      apiKey: null,
      authHeader: 'Authorization',
      authScheme: 'Bearer',
      requestTimeoutMs: 10000,
      jobTimeoutMs: 60000,
      maxArtifactBytes: 32 * 1024 * 1024,
      localArtifactRoot: null,
      allowInsecureHttp: false
    };
    const provider = new NivHttpProvider(configuration);
    const capabilities = await provider.capabilities();
    const sourceAudio = parseWavBuffer(testOnlyAudioFixture());
    const sourceNiv = await encodeToNIV(sourceAudio.audioInfo, sourceAudio.pcmData, {
      title: 'authorized test source',
      audio: { frames: sourceAudio.audioInfo.frames, pcmHash: sha256Buffer(sourceAudio.pcmData) }
    });
    const sourceNivPath = path.join(directory, 'source.niv');
    await fs.promises.writeFile(sourceNivPath, sourceNiv);
    const plan = createPromptMusicPlan({
      prompt: 'Create a new arrangement while preserving only the licensed timing contour',
      operation: 'edit',
      sourceNivPath: 'source.niv',
      sourceRights: 'licensed',
      preserve: ['timing contour'],
      change: ['melody', 'hook', 'recording identity'],
      durationSeconds: 1,
      sampleRate: 48000,
      channels: 1,
      candidateCount: 1,
      providerAudit: { configured: true, providerId: capabilities.providerId, model: configuration.model, capabilities },
      outputDirectory: 'transformed',
      audioFormat: 'wav'
    });
    const planPath = path.join(directory, 'edit-plan.json');
    await fs.promises.writeFile(planPath, JSON.stringify(plan));
    const result = await runEliteGeneration({ plan, planPath, provider, pollIntervalMs: 5 });
    assert.equal(result.manifest.generation.operation, 'edit');
    assert.equal(result.manifest.rights.sourceStatus, 'licensed');
    assert.equal(result.manifest.source.kind, 'niv');
    assert.equal(result.manifest.source.analysis.calibrated, true);
    assert.equal(result.manifest.source.decodedPcmSha256, sha256Buffer(sourceAudio.pcmData));
    const decoded = await decodeFromNIV(result.outputs.nivPath, { maxDecodedBytes: configuration.maxArtifactBytes });
    assert.equal(sha256Buffer(decoded.pcmData), result.manifest.audio.pcmHash);
  } finally {
    await new Promise(resolve => fixture.server.close(resolve));
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
