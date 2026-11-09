import path from 'node:path';
import { validateMusicPlan } from '../../niv-elite-music-ai/scripts/validate_music_plan.mjs';
import { PlanValidationError } from './errors.js';

export function assertValidMusicPlan(plan, { requireReady = false } = {}) {
  const result = validateMusicPlan(plan);
  const errors = [...result.errors];
  if (requireReady && plan.stage !== 'ready-for-inference') {
    errors.push('stage: generation requires "ready-for-inference"');
  }
  if (errors.length) throw new PlanValidationError(errors, result.warnings);
  return result;
}

function buildSections(duration) {
  const boundaries = [0, duration * 0.14, duration * 0.48, duration * 0.78, duration];
  const labels = ['intro', 'development', 'climax', 'resolution'];
  const energies = [0.25, 0.55, 0.92, 0.5];
  return labels.map((label, index) => ({
    label,
    startSeconds: Number(boundaries[index].toFixed(3)),
    endSeconds: Number(boundaries[index + 1].toFixed(3)),
    energy: energies[index],
    confidence: 1
  }));
}

export function createPromptMusicPlan({
  prompt,
  operation = 'prompt-generate',
  sourceNivPath = null,
  sourceAudioPath = null,
  sourceRights = 'owned',
  voiceConsent = null,
  preserve = [],
  change = null,
  durationSeconds = 180,
  sampleRate = 48000,
  channels = 2,
  bpm = 100,
  meter = '4/4',
  tonic = 'D',
  mode = 'minor',
  candidateCount = 4,
  instruments = [],
  providerAudit = null,
  outputDirectory = 'output',
  audioFormat = 'wav'
}) {
  if (!prompt?.trim()) throw new TypeError('A non-empty prompt is required');
  const configured = providerAudit?.configured === true;
  const capabilities = providerAudit?.capabilities;
  const provider = providerAudit?.providerId ?? 'configure-before-generation';
  const model = providerAudit?.model ?? 'configure-before-generation';
  const analysisFeature = capabilities?.features?.analysis;
  const originalityFeature = capabilities?.features?.originality;
  const stage = configured
    && capabilities?.operations?.includes(operation)
    && capabilities?.models?.some(item => item.id === model)
    && analysisFeature?.available
    && analysisFeature?.calibrated
    && analysisFeature?.openSet
    && originalityFeature?.available
    ? 'ready-for-inference'
    : 'draft';

  return {
    schemaVersion: 'niv.music-plan/1',
    stage,
    operation,
    secondaryOperations: [],
    capabilities: {
      analysis: analysisFeature?.available ? [{
        status: 'available',
        calibrated: analysisFeature.calibrated === true,
        provider,
        model: analysisFeature.model ?? null,
        taxonomyVersion: analysisFeature.taxonomyVersion ?? null
      }] : [],
      generation: { status: configured ? 'available' : 'unconfigured', adapter: configured ? 'niv-http/1' : null },
      originality: originalityFeature?.available
        ? { status: 'available', tool: originalityFeature.model ?? provider }
        : { status: 'unavailable', tool: null }
    },
    source: { nivPath: sourceNivPath, audioPath: sourceAudioPath, rights: sourceRights, voiceConsent },
    intent: {
      prompt: prompt.trim(),
      preserve,
      change: change ?? ['melody', 'motif', 'harmonic detail', 'recording identity'],
      exclude: ['copied melody', 'copied lyrics', 'identifiable performer imitation', 'unintended clipping']
    },
    musicalProfile: {
      durationSeconds,
      sampleRate,
      channels,
      tempo: { bpm, confidence: 1 },
      meter,
      tonality: { tonic, mode, tuningHz: 440, confidence: 1 },
      sections: buildSections(durationSeconds),
      instruments: instruments.map(item => ({
        canonicalId: item.canonicalId ?? `user:${item.canonicalName.toLowerCase().replace(/\s+/g, '-')}`,
        canonicalName: item.canonicalName,
        aliases: item.aliases ?? [],
        family: item.family ?? 'open-world-unspecified',
        regionOrTradition: item.regionOrTradition ?? [],
        role: item.role ?? 'provider-arranged',
        techniques: item.techniques ?? [],
        confidence: 1,
        evidence: ['explicit-composition-intent']
      })),
      unknownSounds: [],
      soundEvents: [],
      energyArc: [0.25, 0.55, 0.92, 0.5]
    },
    generation: {
      provider,
      model,
      candidateCount,
      seedPolicy: 'record-when-supported',
      outputStems: capabilities?.features?.stems === true,
      providerParameters: {}
    },
    output: {
      nivPath: path.join(outputDirectory, 'generated.niv'),
      audioFormat,
      audioPath: path.join(outputDirectory, `generated.${audioFormat}`),
      stemsDirectory: path.join(outputDirectory, 'stems'),
      videoPath: null
    },
    quality: {
      rejectOnFailure: true,
      maxTruePeakDbtp: -1,
      targetIntegratedLufs: null,
      durationToleranceSeconds: 0.05,
      requiredGates: [
        'finite-samples',
        'no-unintended-clipping',
        'true-peak',
        'duration-and-structure',
        'originality-review',
        'container-integrity',
        'decode-roundtrip'
      ]
    }
  };
}
