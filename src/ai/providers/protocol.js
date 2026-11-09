import { ProviderError } from '../errors.js';

const OPERATIONS = new Set(['prompt-generate', 'reference-transform', 'edit', 'extend', 'remix']);
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
const ARTIFACT_KINDS = new Set(['url', 'base64', 'path']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError(`${label} must be an object`);
  return value;
}

function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new ProviderError(`${label} must be a non-empty string`);
  return value.trim();
}

function confidence(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ProviderError(`${label} must be a finite number from 0 through 1`);
  }
  return value;
}

export function normalizeCapabilities(input) {
  const value = object(input, 'Provider capabilities');
  if (value.schemaVersion !== 'niv.ai-capabilities/1') {
    throw new ProviderError('Provider capabilities schemaVersion must equal "niv.ai-capabilities/1"');
  }
  const operations = Array.isArray(value.operations) ? value.operations.map((item, index) => {
    const operation = string(item, `operations[${index}]`);
    if (!OPERATIONS.has(operation)) throw new ProviderError(`Unsupported provider operation: ${operation}`);
    return operation;
  }) : [];
  const models = Array.isArray(value.models) ? value.models.map((item, index) => {
    if (typeof item === 'string') return { id: string(item, `models[${index}]`) };
    const model = object(item, `models[${index}]`);
    return { ...model, id: string(model.id, `models[${index}].id`) };
  }) : [];
  const formats = Array.isArray(value.outputFormats) ? value.outputFormats.map((item, index) => string(item, `outputFormats[${index}]`).toLowerCase()) : [];
  const limits = object(value.limits ?? {}, 'limits');
  const maxDurationSeconds = Number(limits.maxDurationSeconds);
  const maxCandidates = Number(limits.maxCandidates);
  const features = object(value.features ?? {}, 'features');
  const analysis = object(features.analysis ?? {}, 'features.analysis');
  const originality = object(features.originality ?? {}, 'features.originality');
  return {
    schemaVersion: value.schemaVersion,
    providerId: string(value.providerId, 'providerId'),
    providerVersion: string(value.providerVersion ?? 'unknown', 'providerVersion'),
    operations,
    models,
    outputFormats: formats,
    sampleRates: Array.isArray(value.sampleRates) ? value.sampleRates.filter(Number.isInteger) : [],
    channelCounts: Array.isArray(value.channelCounts) ? value.channelCounts.filter(Number.isInteger) : [],
    limits: {
      maxDurationSeconds: Number.isFinite(maxDurationSeconds) && maxDurationSeconds > 0 ? maxDurationSeconds : null,
      maxCandidates: Number.isInteger(maxCandidates) && maxCandidates > 0 ? maxCandidates : null
    },
    features: {
      seeds: features.seeds === true,
      stems: features.stems === true,
      analysis: {
        available: analysis.available === true,
        calibrated: analysis.calibrated === true,
        model: typeof analysis.model === 'string' ? analysis.model : null,
        taxonomyVersion: typeof analysis.taxonomyVersion === 'string' ? analysis.taxonomyVersion : null,
        openSet: analysis.openSet === true
      },
      originality: {
        available: originality.available === true,
        model: typeof originality.model === 'string' ? originality.model : null,
        corpusVersion: typeof originality.corpusVersion === 'string' ? originality.corpusVersion : null
      }
    }
  };
}

export function normalizeSubmission(input) {
  const value = object(input, 'Generation submission');
  const status = string(value.status, 'submission.status');
  if (!JOB_STATUSES.has(status)) throw new ProviderError(`Invalid generation status: ${status}`);
  if (status === 'completed') {
    return { status, jobId: value.jobId ? string(value.jobId, 'submission.jobId') : null, candidates: normalizeCandidates(value.candidates) };
  }
  return { status, jobId: string(value.jobId, 'submission.jobId'), candidates: [] };
}

export function normalizeJobStatus(input) {
  const value = object(input, 'Provider job status');
  const status = string(value.status, 'job.status');
  if (!JOB_STATUSES.has(status)) throw new ProviderError(`Invalid provider job status: ${status}`);
  return {
    jobId: string(value.jobId, 'job.jobId'),
    status,
    progress: value.progress === undefined ? null : confidence(value.progress, 'job.progress'),
    message: typeof value.message === 'string' ? value.message : null,
    error: status === 'failed' ? object(value.error ?? { message: 'Provider job failed' }, 'job.error') : null
  };
}

export function normalizeCandidates(input) {
  if (!Array.isArray(input) || input.length === 0) throw new ProviderError('Completed provider result must contain at least one candidate');
  const identifiers = new Set();
  return input.map((raw, index) => {
    const value = object(raw, `candidates[${index}]`);
    const id = string(value.id ?? `candidate-${index + 1}`, `candidates[${index}].id`);
    if (identifiers.has(id)) throw new ProviderError(`Duplicate provider candidate id: ${id}`);
    identifiers.add(id);
    const artifact = object(value.artifact, `candidates[${index}].artifact`);
    const kind = string(artifact.kind, `candidates[${index}].artifact.kind`);
    if (!ARTIFACT_KINDS.has(kind)) throw new ProviderError(`Unsupported candidate artifact kind: ${kind}`);
    if (kind === 'url') string(artifact.url, `candidates[${index}].artifact.url`);
    if (kind === 'base64') string(artifact.data, `candidates[${index}].artifact.data`);
    if (kind === 'path') string(artifact.path, `candidates[${index}].artifact.path`);
    return {
      id,
      artifact: { ...artifact, kind },
      mediaType: typeof value.mediaType === 'string' ? value.mediaType.toLowerCase() : null,
      format: typeof value.format === 'string' ? value.format.toLowerCase() : null,
      seed: Number.isSafeInteger(value.seed) ? value.seed : null,
      model: typeof value.model === 'string' ? value.model : null,
      providerScore: typeof value.providerScore === 'number' && Number.isFinite(value.providerScore) ? value.providerScore : null,
      provenance: value.provenance && typeof value.provenance === 'object' && !Array.isArray(value.provenance) ? value.provenance : {},
      expectedSha256: typeof value.sha256 === 'string' ? value.sha256 : null
    };
  });
}

export function normalizeAnalysis(input, expectedAudioHash) {
  const value = object(input, 'Analysis response');
  if (value.schemaVersion !== 'niv.analysis/1') throw new ProviderError('Analysis schemaVersion must equal "niv.analysis/1"');
  if (value.audioSha256 !== expectedAudioHash) throw new ProviderError('Analysis response audioSha256 does not match the candidate');
  if (value.calibrated !== true) throw new ProviderError('Semantic analysis must identify itself as calibrated');
  const model = string(value.model, 'analysis.model');
  const modelVersion = string(value.modelVersion, 'analysis.modelVersion');
  const taxonomyVersion = string(value.taxonomyVersion, 'analysis.taxonomyVersion');
  const calibration = object(value.calibration, 'analysis.calibration');
  string(calibration.method, 'analysis.calibration.method');
  string(calibration.datasetVersion, 'analysis.calibration.datasetVersion');
  const instruments = Array.isArray(value.instruments) ? value.instruments.map((raw, index) => {
    const item = object(raw, `instruments[${index}]`);
    const evidence = Array.isArray(item.evidence) ? item.evidence.map(entry => string(entry, `instruments[${index}].evidence`)) : [];
    if (!evidence.length) throw new ProviderError(`instruments[${index}] requires evidence`);
    return {
      ...item,
      canonicalId: string(item.canonicalId, `instruments[${index}].canonicalId`),
      canonicalName: string(item.canonicalName, `instruments[${index}].canonicalName`),
      family: string(item.family, `instruments[${index}].family`),
      confidence: confidence(item.confidence, `instruments[${index}].confidence`),
      evidence
    };
  }) : [];
  const unknownSounds = Array.isArray(value.unknownSounds) ? value.unknownSounds.map((raw, index) => {
    const item = object(raw, `unknownSounds[${index}]`);
    const evidence = Array.isArray(item.evidence) ? item.evidence.map(entry => string(entry, `unknownSounds[${index}].evidence`)) : [];
    if (!evidence.length) throw new ProviderError(`unknownSounds[${index}] requires evidence`);
    return {
      ...item,
      canonicalId: string(item.canonicalId ?? 'unknown-acoustic-source', `unknownSounds[${index}].canonicalId`),
      confidence: confidence(item.confidence, `unknownSounds[${index}].confidence`),
      evidence
    };
  }) : [];
  const compliance = object(value.planCompliance, 'planCompliance');
  const structure = object(compliance.structure, 'planCompliance.structure');
  if (typeof structure.passed !== 'boolean') throw new ProviderError('planCompliance.structure.passed must be boolean');
  confidence(structure.score, 'planCompliance.structure.score');
  if (compliance.overallScore !== undefined) confidence(compliance.overallScore, 'planCompliance.overallScore');
  return { ...value, model, modelVersion, taxonomyVersion, calibration, instruments, unknownSounds, planCompliance: { ...compliance, structure } };
}

export function normalizeOriginalityReview(input, expectedAudioHash) {
  const value = object(input, 'Originality review');
  if (value.schemaVersion !== 'niv.originality-review/1') {
    throw new ProviderError('Originality review schemaVersion must equal "niv.originality-review/1"');
  }
  if (value.audioSha256 !== expectedAudioHash) throw new ProviderError('Originality review audioSha256 does not match the candidate');
  if (typeof value.passed !== 'boolean') throw new ProviderError('Originality review passed must be boolean');
  string(value.method, 'originality.method');
  string(value.reviewerModel ?? value.reviewer, 'originality reviewer');
  string(value.corpusVersion, 'originality.corpusVersion');
  confidence(value.distanceScore, 'originality.distanceScore');
  confidence(value.threshold, 'originality.threshold');
  if (!Array.isArray(value.flaggedMatches)) throw new ProviderError('Originality review flaggedMatches must be an array');
  return value;
}
