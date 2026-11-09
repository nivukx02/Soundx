import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { writeNIVFile } from '../../encoder.js';
import { decodeFromNIV, getNIVInfo } from '../../decoder.js';
import { canonicalizeAudio, renderCanonicalAudio } from './audio/canonical.js';
import { assertNewFile, hashJson, sha256Buffer, sha256File, writeJson } from './utils.js';

function resolveOutputs(plan, planDirectory, outputDirectory) {
  if (outputDirectory) {
    const root = path.resolve(outputDirectory);
    return {
      audioPath: path.join(root, path.basename(plan.output.audioPath)),
      nivPath: path.join(root, path.basename(plan.output.nivPath))
    };
  }
  return {
    audioPath: path.resolve(planDirectory, plan.output.audioPath),
    nivPath: path.resolve(planDirectory, plan.output.nivPath)
  };
}

function sanitizedPlan(plan) {
  return {
    ...plan,
    intent: { ...plan.intent, prompt: '[redacted; see generation.promptHash]' },
    generation: { ...plan.generation, providerParameters: '[redacted; see generation.parametersHash]' }
  };
}

export async function packageSelectedCandidate({
  selected,
  plan,
  planDirectory,
  outputDirectory,
  providerConfiguration,
  capabilityAudit,
  candidateRecord,
  allCandidateRecords,
  source,
  job,
  overwrite = false
}) {
  const output = resolveOutputs(plan, planDirectory, outputDirectory);
  const manifestPath = `${output.nivPath}.manifest.json`;
  const targets = [output.audioPath, output.nivPath, manifestPath].map(target => path.resolve(target));
  if (new Set(targets.map(target => target.toLowerCase())).size !== targets.length) {
    throw new Error('Audio, NIV, and manifest output paths must be distinct');
  }
  if (source) {
    const protectedSources = [source.originalPath, source.providerPath].filter(Boolean).map(target => path.resolve(target).toLowerCase());
    if (targets.some(target => protectedSources.includes(target.toLowerCase()))) {
      throw new Error('A delivery path must never overwrite a source artifact');
    }
  }
  for (const target of [output.audioPath, output.nivPath, manifestPath]) await assertNewFile(target, overwrite);
  await fs.promises.mkdir(path.dirname(output.audioPath), { recursive: true });
  await fs.promises.mkdir(path.dirname(output.nivPath), { recursive: true });

  await renderCanonicalAudio(selected.canonical, output.audioPath, plan.output.audioFormat, { overwrite });
  const deliveryCheckDir = path.join(job.directory, 'delivery-verification');
  const deliveredCanonical = await canonicalizeAudio(output.audioPath, deliveryCheckDir, providerConfiguration.maxArtifactBytes);
  if (deliveredCanonical.pcmSha256 !== selected.canonical.pcmSha256) {
    throw new Error('Lossless delivery audio does not decode to the selected candidate PCM');
  }

  const assetId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const promptHash = hashJson({ prompt: plan.intent.prompt });
  const parametersHash = hashJson(plan.generation.providerParameters ?? {});
  const audio = {
    codec: 'pcm-s32le',
    deliveryFormat: plan.output.audioFormat,
    sampleRate: selected.canonical.audioInfo.sampleRate,
    channels: selected.canonical.audioInfo.channels,
    frames: selected.canonical.audioInfo.frames,
    durationSeconds: selected.canonical.audioInfo.duration,
    pcmHash: selected.canonical.pcmSha256,
    deliveryHash: await sha256File(output.audioPath)
  };
  const generation = {
    operation: plan.operation,
    provider: providerConfiguration.providerId,
    model: providerConfiguration.model,
    adapter: providerConfiguration.adapter,
    providerVersion: capabilityAudit.providerVersion,
    seed: candidateRecord.seed,
    promptHash,
    parametersHash,
    sourceAssetIds: source ? [source.originalSha256] : [],
    selectedCandidateId: candidateRecord.id,
    createdAt
  };
  const quality = {
    ...candidateRecord.quality,
    technical: candidateRecord.technical,
    loudness: candidateRecord.loudness,
    deliveryPcmHashMatch: true
  };
  const embeddedMetadata = {
    schema: 'niv.music/2',
    assetId,
    audio,
    analysis: {
      version: candidateRecord.analysis.modelVersion ?? candidateRecord.analysis.model ?? 'provider-calibrated',
      instruments: candidateRecord.analysis.instruments,
      unknownSounds: candidateRecord.analysis.unknownSounds,
      planCompliance: candidateRecord.analysis.planCompliance
    },
    generation,
    rights: { sourceStatus: plan.source.rights, voiceConsent: plan.source.voiceConsent },
    quality: {
      passed: quality.passed,
      truePeakDbtp: candidateRecord.loudness.truePeakDbtp,
      integratedLufs: candidateRecord.loudness.integratedLufs,
      gates: quality.gates
    },
    history: [{ at: createdAt, operation: plan.operation, jobId: job.state.id }],
    sidecar: path.basename(manifestPath)
  };
  await writeNIVFile(output.nivPath, {
    ...selected.canonical.audioInfo,
    format: plan.output.audioFormat,
    bitDepth: 32
  }, selected.canonical.pcmData, embeddedMetadata, { overwrite });

  const decoded = await decodeFromNIV(output.nivPath, { maxDecodedBytes: providerConfiguration.maxArtifactBytes });
  const decodedPcmHash = sha256Buffer(decoded.pcmData);
  if (decodedPcmHash !== selected.canonical.pcmSha256) throw new Error('NIV decode round-trip PCM hash mismatch');
  const nivInfo = await getNIVInfo(output.nivPath);
  const expectedFrames = selected.canonical.audioInfo.frames;
  if (decoded.audioInfo.frames !== expectedFrames) throw new Error('NIV decode round-trip frame count mismatch');
  quality.gates['container-integrity'] = {
    passed: nivInfo.version === 1 && nivInfo.channels === audio.channels && nivInfo.sampleRate === audio.sampleRate,
    evidence: { version: nivInfo.version, channels: nivInfo.channels, sampleRate: nivInfo.sampleRate }
  };
  quality.gates['decode-roundtrip'] = {
    passed: true,
    evidence: { encodedPcmHash: selected.canonical.pcmSha256, decodedPcmHash, frames: decoded.audioInfo.frames }
  };
  quality.passed = Object.values(quality.gates).every(gate => gate.passed === true);
  if (!quality.passed) throw new Error('Final NIV integrity quality gates failed');

  const manifest = {
    schema: 'niv.music/2',
    compatibility: {
      physicalContainer: 'NIV v1',
      limitation: 'The complete niv.music/2 logical record is stored in this sidecar until a chunked physical NIV v2 exists.'
    },
    assetId,
    audio,
    analysis: candidateRecord.analysis,
    generation,
    rights: { sourceStatus: plan.source.rights, voiceConsent: plan.source.voiceConsent },
    quality,
    musicPlan: sanitizedPlan(plan),
    capabilityAudit,
    candidateSelection: {
      requested: plan.generation.candidateCount,
      selectedCandidateId: candidateRecord.id,
      candidates: allCandidateRecords.map(record => ({
        id: record.id,
        seed: record.seed,
        accepted: record.accepted,
        selectionScore: record.selectionScore,
        failedGates: record.quality?.failed ?? [],
        rawSha256: record.rawSha256 ?? null,
        error: record.error ?? null
      }))
    },
    source,
    artifacts: {
      audio: { path: output.audioPath, sha256: audio.deliveryHash },
      niv: { path: output.nivPath, sha256: await sha256File(output.nivPath) },
      manifest: { path: manifestPath }
    },
    history: embeddedMetadata.history
  };
  await writeJson(manifestPath, manifest, { overwrite });
  return { output, manifestPath, manifest };
}
