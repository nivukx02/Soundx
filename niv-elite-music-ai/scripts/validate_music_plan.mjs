#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const OPERATIONS = new Set([
  'analyze',
  'reference-transform',
  'prompt-generate',
  'edit',
  'extend',
  'remix',
  'master',
  'render-video'
]);
const RIGHTS = new Set(['owned', 'licensed', 'public-domain', 'unknown']);
const STAGES = new Set(['draft', 'ready-for-inference', 'final']);
const REQUIRED_GATES = new Set([
  'finite-samples',
  'no-unintended-clipping',
  'true-peak',
  'duration-and-structure',
  'originality-review',
  'container-integrity',
  'decode-roundtrip'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isConfidence(value) {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function usage() {
  console.error('Usage: node validate_music_plan.mjs <music-plan.json|->');
}

export async function loadMusicPlan(filePath) {
  let text;
  if (filePath === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    text = await readFile(filePath, 'utf8');
  }
  const plan = JSON.parse(text);
  if (!isObject(plan)) throw new Error('Plan root must be a JSON object');
  return plan;
}

export function validateMusicPlan(plan) {
  const errors = [];
  const warnings = [];
  const error = (path, message) => errors.push(`${path}: ${message}`);
  const warn = (path, message) => warnings.push(`${path}: ${message}`);

  if (plan.schemaVersion !== 'niv.music-plan/1') {
    error('schemaVersion', 'must equal "niv.music-plan/1"');
  }
  if (!STAGES.has(plan.stage)) error('stage', `must be one of: ${[...STAGES].join(', ')}`);
  if (!OPERATIONS.has(plan.operation)) {
    error('operation', `must be one of: ${[...OPERATIONS].join(', ')}`);
  }
  if (!Array.isArray(plan.secondaryOperations)) {
    error('secondaryOperations', 'must be an array');
  } else {
    const seen = new Set();
    plan.secondaryOperations.forEach((operation, index) => {
      if (!OPERATIONS.has(operation)) error(`secondaryOperations[${index}]`, `must be one of: ${[...OPERATIONS].join(', ')}`);
      if (operation === plan.operation) error(`secondaryOperations[${index}]`, 'must not duplicate the primary operation');
      if (seen.has(operation)) error(`secondaryOperations[${index}]`, 'must not be duplicated');
      seen.add(operation);
    });
  }
  const requestedOperations = new Set([plan.operation, ...(Array.isArray(plan.secondaryOperations) ? plan.secondaryOperations : [])]);
  const generationRequired = ['reference-transform', 'prompt-generate', 'edit', 'extend', 'remix']
    .some(operation => requestedOperations.has(operation));

  if (!isObject(plan.capabilities)) {
    error('capabilities', 'must be an object');
  } else {
    if (!Array.isArray(plan.capabilities.analysis)) {
      error('capabilities.analysis', 'must be an array');
    } else if (plan.stage !== 'draft' && !plan.capabilities.analysis.some(item => isObject(item) && item.status === 'available' && item.calibrated === true)) {
      error('capabilities.analysis', 'ready and final plans require at least one available calibrated analyzer');
    }
    if (!isObject(plan.capabilities.generation)) {
      error('capabilities.generation', 'must be an object');
    } else if (generationRequired && plan.capabilities.generation.status !== 'available') {
      const message = 'generation capability must be available before inference';
      plan.stage === 'draft' ? warn('capabilities.generation.status', message) : error('capabilities.generation.status', message);
    }
    if (!isObject(plan.capabilities.originality)) {
      error('capabilities.originality', 'must be an object');
    } else if (generationRequired && !['available', 'human-review'].includes(plan.capabilities.originality.status)) {
      const message = 'originality comparison or explicit human review is required';
      plan.stage === 'draft' ? warn('capabilities.originality.status', message) : error('capabilities.originality.status', message);
    }
  }

  if (!isObject(plan.source)) {
    error('source', 'must be an object');
  } else {
    if (!RIGHTS.has(plan.source.rights)) error('source.rights', `must be one of: ${[...RIGHTS].join(', ')}`);
    if (plan.source.rights === 'unknown') warn('source.rights', 'generation or transformation needs a rights decision');
    if (!plan.source.nivPath && !plan.source.audioPath && plan.operation !== 'prompt-generate') {
      error('source', 'nivPath or audioPath is required for this operation');
    }
  }

  if (!isObject(plan.intent)) {
    error('intent', 'must be an object');
  } else {
    if (plan.operation === 'prompt-generate' && (!plan.intent.prompt || !plan.intent.prompt.trim())) {
      error('intent.prompt', 'is required for prompt generation');
    }
    for (const key of ['preserve', 'change', 'exclude']) {
      if (!Array.isArray(plan.intent[key])) error(`intent.${key}`, 'must be an array');
    }
  }

  const profile = plan.musicalProfile;
  if (!isObject(profile)) {
    error('musicalProfile', 'must be an object');
  } else {
    if (!isFiniteNumber(profile.durationSeconds) || profile.durationSeconds <= 0) {
      error('musicalProfile.durationSeconds', 'must be a positive finite number');
    }
    if (!Number.isInteger(profile.sampleRate) || profile.sampleRate < 8000 || profile.sampleRate > 384000) {
      error('musicalProfile.sampleRate', 'must be an integer from 8000 through 384000');
    }
    if (!Number.isInteger(profile.channels) || profile.channels < 1 || profile.channels > 32) {
      error('musicalProfile.channels', 'must be an integer from 1 through 32');
    }
    if (profile.tempo !== null) {
      if (!isObject(profile.tempo)) {
        error('musicalProfile.tempo', 'must be an object or null');
      } else {
        if (!isFiniteNumber(profile.tempo.bpm) || profile.tempo.bpm < 20 || profile.tempo.bpm > 400) {
          error('musicalProfile.tempo.bpm', 'must be a finite value from 20 through 400');
        }
        if (!isConfidence(profile.tempo.confidence)) error('musicalProfile.tempo.confidence', 'must be from 0 through 1');
      }
    }

    if (!Array.isArray(profile.sections) || profile.sections.length === 0) {
      error('musicalProfile.sections', 'must contain at least one section');
    } else {
      let previousEnd = 0;
      profile.sections.forEach((section, index) => {
        const base = `musicalProfile.sections[${index}]`;
        if (!isObject(section)) return error(base, 'must be an object');
        if (!section.label || typeof section.label !== 'string') error(`${base}.label`, 'must be a non-empty string');
        if (!isFiniteNumber(section.startSeconds) || section.startSeconds < 0) error(`${base}.startSeconds`, 'must be non-negative');
        if (!isFiniteNumber(section.endSeconds) || section.endSeconds <= section.startSeconds) error(`${base}.endSeconds`, 'must be after startSeconds');
        if (isFiniteNumber(section.startSeconds) && section.startSeconds < previousEnd - 0.001) warn(base, 'overlaps the previous section');
        if (isFiniteNumber(section.endSeconds)) previousEnd = Math.max(previousEnd, section.endSeconds);
        if (isFiniteNumber(profile.durationSeconds) && section.endSeconds > profile.durationSeconds + 0.05) {
          error(`${base}.endSeconds`, 'exceeds durationSeconds');
        }
        if (!isConfidence(section.confidence)) error(`${base}.confidence`, 'must be from 0 through 1');
      });
    }

    if (!Array.isArray(profile.instruments)) {
      error('musicalProfile.instruments', 'must be an array');
    } else {
      profile.instruments.forEach((instrument, index) => {
        const base = `musicalProfile.instruments[${index}]`;
        if (!isObject(instrument)) return error(base, 'must be an object');
        if (!instrument.canonicalName || typeof instrument.canonicalName !== 'string') error(`${base}.canonicalName`, 'must be a non-empty string');
        if (!instrument.family || typeof instrument.family !== 'string') error(`${base}.family`, 'must be a non-empty string');
        if (!isConfidence(instrument.confidence)) error(`${base}.confidence`, 'must be from 0 through 1');
        if (!Array.isArray(instrument.evidence) || instrument.evidence.length === 0) warn(`${base}.evidence`, 'should identify acoustic or human evidence');
      });
    }
    if (!Array.isArray(profile.unknownSounds)) error('musicalProfile.unknownSounds', 'must be an array');
  }

  if (!isObject(plan.generation)) {
    error('generation', 'must be an object');
  } else if (generationRequired) {
    if (!plan.generation.provider || !plan.generation.model) {
      error('generation', 'provider and model are required before inference');
    }
    if (plan.generation.provider === 'configure-before-generation' || plan.generation.model === 'configure-before-generation') {
      const message = 'replace configuration placeholders before inference';
      plan.stage === 'draft' ? warn('generation', message) : error('generation', message);
    }
    if (!Number.isInteger(plan.generation.candidateCount) || plan.generation.candidateCount < 1) {
      error('generation.candidateCount', 'must be a positive integer');
    }
  }

  if (!isObject(plan.output)) {
    error('output', 'must be an object');
  } else {
    if (!plan.output.nivPath || typeof plan.output.nivPath !== 'string') error('output.nivPath', 'must be a non-empty string');
    if (!plan.output.audioPath || typeof plan.output.audioPath !== 'string') error('output.audioPath', 'must be a non-empty string');
    if (!['wav', 'flac'].includes(plan.output.audioFormat)) error('output.audioFormat', 'must be wav or flac');
  }

  if (!isObject(plan.quality)) {
    error('quality', 'must be an object');
  } else {
    if (plan.quality.rejectOnFailure !== true) error('quality.rejectOnFailure', 'must be true for strict mode');
    if (!Array.isArray(plan.quality.requiredGates)) {
      error('quality.requiredGates', 'must be an array');
    } else {
      for (const gate of REQUIRED_GATES) {
        if (!plan.quality.requiredGates.includes(gate)) error('quality.requiredGates', `missing required gate "${gate}"`);
      }
    }
    if (!isFiniteNumber(plan.quality.maxTruePeakDbtp) || plan.quality.maxTruePeakDbtp > 0) {
      error('quality.maxTruePeakDbtp', 'must be a finite value at or below 0 dBTP');
    }
    if (!isFiniteNumber(plan.quality.durationToleranceSeconds) || plan.quality.durationToleranceSeconds < 0 || plan.quality.durationToleranceSeconds > 5) {
      error('quality.durationToleranceSeconds', 'must be a finite value from 0 through 5 seconds');
    }
    if (plan.quality.targetIntegratedLufs !== null && (!isFiniteNumber(plan.quality.targetIntegratedLufs) || plan.quality.targetIntegratedLufs > 0 || plan.quality.targetIntegratedLufs < -70)) {
      error('quality.targetIntegratedLufs', 'must be null or a finite value from -70 through 0 LUFS');
    }
  }

  return { errors, warnings };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  if (process.argv.length !== 3) {
    usage();
    process.exit(2);
  }

  try {
    const plan = await loadMusicPlan(process.argv[2]);
    const result = validateMusicPlan(plan);
    if (result.warnings.length) {
      console.warn('Warnings:');
      result.warnings.forEach(item => console.warn(`  - ${item}`));
    }
    if (result.errors.length) {
      console.error('Errors:');
      result.errors.forEach(item => console.error(`  - ${item}`));
      console.error(`Music plan is invalid (${result.errors.length} error(s), ${result.warnings.length} warning(s)).`);
      process.exitCode = 1;
    } else {
      console.log(`Music plan is valid (${result.warnings.length} warning(s)).`);
    }
  } catch (error) {
    console.error(`Music plan validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
