import fs from 'node:fs';
import path from 'node:path';
import { assertValidMusicPlan } from './music-plan.js';
import { auditProviderCapabilities } from './capability-audit.js';
import { materializeCandidate } from './artifacts.js';
import { canonicalizeAudio } from './audio/canonical.js';
import { measureEbur128 } from './audio/ffmpeg.js';
import { evaluateCandidateQuality, measurePcm32 } from './audio/quality.js';
import { GenerationJobStore } from './job-store.js';
import { packageSelectedCandidate } from './packager.js';
import { prepareSource } from './source.js';
import { ProviderError, QualityGateError } from './errors.js';
import { delay, writeJson } from './utils.js';

const TRANSFORM_OPERATIONS = new Set(['reference-transform', 'edit', 'extend', 'remix']);

async function waitForCandidates(provider, submission, store, pollIntervalMs, signal) {
  if (submission.status === 'completed') return submission.candidates;
  const jobId = submission.jobId;
  await store.update({ status: 'running', phase: 'provider-inference', remoteJobId: jobId, providerStatus: submission.status });
  const deadline = Date.now() + provider.configuration.jobTimeoutMs;
  try {
    while (Date.now() < deadline) {
      if (signal?.aborted) throw signal.reason ?? new Error('Generation cancelled');
      const status = await provider.status(jobId);
      await store.update({ providerStatus: status.status, providerProgress: status.progress, providerMessage: status.message });
      if (status.status === 'completed') return provider.collect(jobId);
      if (status.status === 'failed') throw new ProviderError('AI provider generation failed', status.error);
      if (status.status === 'cancelled') throw new ProviderError('AI provider generation was cancelled');
      await delay(pollIntervalMs, signal);
    }
    throw new ProviderError(`AI provider job exceeded ${provider.configuration.jobTimeoutMs} ms`);
  } catch (error) {
    await provider.cancel(jobId).catch(() => {});
    throw error;
  }
}

function selectionScore(candidate, analysis, originality, loudness) {
  const provider = candidate.providerScore ?? 0;
  const structure = Number(analysis?.planCompliance?.structure?.score ?? (analysis?.planCompliance?.structure?.passed ? 1 : 0));
  const intent = Number(analysis?.planCompliance?.overallScore ?? 0);
  const original = Number(originality?.distanceScore ?? (originality?.passed ? 1 : 0));
  const peakMargin = loudness.truePeakDbtp === null ? 0 : Math.min(1, Math.max(0, -loudness.truePeakDbtp / 6));
  return Number((provider * 0.15 + structure * 0.3 + intent * 0.25 + original * 0.25 + peakMargin * 0.05).toFixed(6));
}

async function evaluateCandidate(candidate, index, context) {
  const { provider, store, plan, source } = context;
  const directory = path.join(store.directory, 'candidates', String(index + 1).padStart(2, '0'));
  await fs.promises.mkdir(directory, { recursive: true });
  const record = { id: candidate.id, seed: candidate.seed, accepted: false, selectionScore: null };
  try {
    const raw = await materializeCandidate(candidate, directory, provider);
    record.rawPath = raw.path;
    record.rawSha256 = raw.sha256;
    record.rawBytes = raw.bytes;
    const canonical = await canonicalizeAudio(raw.path, path.join(directory, 'normalized'), provider.configuration.maxArtifactBytes);
    record.canonicalPcmSha256 = canonical.pcmSha256;
    const technical = measurePcm32(canonical.pcmData, canonical.audioInfo, canonical.diagnostics);
    const specificationPassed = canonical.audioInfo.sampleRate === plan.musicalProfile.sampleRate
      && canonical.audioInfo.channels === plan.musicalProfile.channels;
    const loudness = await measureEbur128(canonical.normalizedPath);
    const analysis = await provider.analyze(raw.path, plan);
    const originality = await provider.reviewOriginality(raw.path, source?.providerPath ?? null, plan);
    const quality = evaluateCandidateQuality({ technical, loudness, analysis, originality, plan });
    quality.gates['delivery-specification'] = {
      passed: specificationPassed,
      evidence: {
        requestedSampleRate: plan.musicalProfile.sampleRate,
        actualSampleRate: canonical.audioInfo.sampleRate,
        requestedChannels: plan.musicalProfile.channels,
        actualChannels: canonical.audioInfo.channels
      }
    };
    if (!specificationPassed) {
      quality.passed = false;
      quality.failed.push('delivery-specification');
    }
    const score = selectionScore(candidate, analysis, originality, loudness);
    Object.assign(record, { technical, loudness, analysis, originality, quality, accepted: quality.passed, selectionScore: score });
    await writeJson(path.join(directory, 'evaluation.json'), record);
    return { record, canonical, candidate };
  } catch (error) {
    record.error = { name: error.name, code: error.code ?? 'CANDIDATE_ERROR', message: error.message, details: error.details ?? null };
    await writeJson(path.join(directory, 'evaluation.json'), record);
    return { record, canonical: null, candidate };
  }
}

export async function runEliteGeneration({
  plan,
  planPath,
  provider,
  outputDirectory = null,
  overwrite = false,
  pollIntervalMs = 2000,
  signal = null
}) {
  assertValidMusicPlan(plan, { requireReady: true });
  const planDirectory = path.dirname(path.resolve(planPath));
  const defaultOutput = path.resolve(planDirectory, plan.output.nivPath);
  const jobRoot = path.join(outputDirectory ? path.resolve(outputDirectory) : path.dirname(defaultOutput), '.niv-jobs');
  await fs.promises.mkdir(jobRoot, { recursive: true });
  const providerConfiguration = provider.publicConfiguration();
  const store = await GenerationJobStore.create(jobRoot, {
    operation: plan.operation,
    provider: providerConfiguration,
    planPath: path.resolve(planPath)
  });
  try {
    await writeJson(path.join(store.directory, 'plan.snapshot.json'), plan, { overwrite: false });
    const capabilities = await provider.capabilities();
    const capabilityAudit = auditProviderCapabilities(plan, capabilities, providerConfiguration);
    await writeJson(path.join(store.directory, 'capability-audit.json'), capabilityAudit, { overwrite: false });
    await store.update({ status: 'running', phase: 'source-preparation' });
    const source = await prepareSource(plan, planDirectory, store.directory, provider.configuration.maxArtifactBytes);
    if (source) {
      await store.update({ phase: 'source-analysis' });
      source.analysis = await provider.analyze(source.providerPath, plan);
      await writeJson(path.join(store.directory, 'source-analysis.json'), source.analysis, { overwrite: false });
    }

    await store.update({ phase: 'provider-submission' });
    const submission = TRANSFORM_OPERATIONS.has(plan.operation)
      ? await provider.transform(plan, source.providerPath, [])
      : await provider.generate(plan);
    const candidates = await waitForCandidates(provider, submission, store, pollIntervalMs, signal);
    if (candidates.length < plan.generation.candidateCount) {
      throw new ProviderError(`Provider returned ${candidates.length} candidate(s), but the plan requires ${plan.generation.candidateCount}`);
    }
    await store.update({ phase: 'candidate-verification', candidateCount: candidates.length });
    const evaluations = [];
    for (let index = 0; index < candidates.length; index++) {
      evaluations.push(await evaluateCandidate(candidates[index], index, { provider, store, plan, source }));
    }
    const accepted = evaluations.filter(item => item.record.accepted).sort((a, b) => b.record.selectionScore - a.record.selectionScore);
    if (!accepted.length) {
      throw new QualityGateError('Every AI-generated candidate failed strict validation', {
        candidates: evaluations.map(item => ({ id: item.record.id, failedGates: item.record.quality?.failed ?? [], error: item.record.error ?? null }))
      });
    }
    const selected = accepted[0];
    await store.update({ phase: 'niv-packaging', selectedCandidateId: selected.record.id });
    const packaged = await packageSelectedCandidate({
      selected,
      plan,
      planDirectory,
      outputDirectory,
      providerConfiguration,
      capabilityAudit,
      candidateRecord: selected.record,
      allCandidateRecords: evaluations.map(item => item.record),
      source,
      job: store,
      overwrite
    });
    await store.update({
      status: 'completed',
      phase: 'completed',
      outputs: { ...packaged.output, manifestPath: packaged.manifestPath },
      qualityPassed: packaged.manifest.quality.passed
    });
    return { job: store.state, jobDirectory: store.directory, outputs: store.state.outputs, manifest: packaged.manifest };
  } catch (error) {
    await store.fail(error);
    error.jobDirectory = store.directory;
    throw error;
  }
}
