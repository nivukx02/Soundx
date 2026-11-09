import { sha256Buffer } from '../utils.js';

function db(amplitude) {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : null;
}

export function measurePcm32(pcmData, audioInfo, diagnostics = {}) {
  const channels = audioInfo.channels;
  const sampleCount = pcmData.length / 4;
  const frames = sampleCount / channels;
  const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  const sums = new Array(channels).fill(0);
  const squares = new Array(channels).fill(0);
  let absolutePeak = 0;
  let fullScaleSamples = 0;
  let silentFrames = 0;
  let currentSilentFrames = 0;
  let longestSilentFrames = 0;
  let potentialDiscontinuities = 0;
  const previous = new Array(channels).fill(0);
  const silenceThreshold = Math.round(0x80000000 * Math.pow(10, -90 / 20));
  const discontinuityThreshold = 0x70000000;
  for (let frame = 0; frame < frames; frame++) {
    let silent = true;
    for (let channel = 0; channel < channels; channel++) {
      const sample = view.getInt32((frame * channels + channel) * 4, true);
      const absolute = Math.abs(sample);
      if (absolute > absolutePeak) absolutePeak = absolute;
      if (sample === -0x80000000 || sample === 0x7FFFFFFF) fullScaleSamples++;
      if (absolute > silenceThreshold) silent = false;
      if (frame > 0 && Math.abs(sample - previous[channel]) > discontinuityThreshold) potentialDiscontinuities++;
      previous[channel] = sample;
      const normalized = sample / (sample < 0 ? 0x80000000 : 0x7FFFFFFF);
      sums[channel] += normalized;
      squares[channel] += normalized * normalized;
    }
    if (silent) {
      silentFrames++;
      currentSilentFrames++;
      if (currentSilentFrames > longestSilentFrames) longestSilentFrames = currentSilentFrames;
    } else {
      currentSilentFrames = 0;
    }
  }
  const dcOffset = sums.map(sum => sum / frames);
  const rms = squares.map(sum => Math.sqrt(sum / frames));
  const rmsDbfs = rms.map(db);
  const finiteRms = rmsDbfs.filter(value => value !== null);
  const channelBalanceDb = finiteRms.length > 1 ? Math.max(...finiteRms) - Math.min(...finiteRms) : 0;
  return {
    method: 'native signed-PCM scan',
    pcmSha256: sha256Buffer(pcmData),
    frames,
    samples: sampleCount,
    channels,
    sampleRate: audioInfo.sampleRate,
    durationSeconds: frames / audioInfo.sampleRate,
    finiteSamples: diagnostics.nonFiniteSamples === 0,
    sourceNonFiniteSamples: diagnostics.nonFiniteSamples ?? 0,
    sourceOutOfRangeFloatSamples: diagnostics.outOfRangeFloatSamples ?? 0,
    fullScaleSamples,
    samplePeakDbfs: db(absolutePeak / 0x80000000),
    dcOffset,
    rmsDbfs,
    channelBalanceDb,
    silentFrameRatio: silentFrames / frames,
    longestSilenceSeconds: longestSilentFrames / audioInfo.sampleRate,
    potentialDiscontinuities
  };
}

export function evaluateCandidateQuality({ technical, loudness, analysis, originality, plan }) {
  const tolerance = plan.quality.durationToleranceSeconds;
  const durationError = Math.abs(technical.durationSeconds - plan.musicalProfile.durationSeconds);
  const gates = {
    'finite-samples': {
      passed: technical.finiteSamples && technical.sourceNonFiniteSamples === 0,
      evidence: { sourceNonFiniteSamples: technical.sourceNonFiniteSamples }
    },
    'no-unintended-clipping': {
      passed: technical.fullScaleSamples === 0 && technical.sourceOutOfRangeFloatSamples === 0,
      evidence: { fullScaleSamples: technical.fullScaleSamples, sourceOutOfRangeFloatSamples: technical.sourceOutOfRangeFloatSamples }
    },
    'true-peak': {
      passed: loudness.available && !loudness.silent && loudness.truePeakDbtp <= plan.quality.maxTruePeakDbtp,
      evidence: { measuredDbtp: loudness.truePeakDbtp, maximumDbtp: plan.quality.maxTruePeakDbtp, method: loudness.method, available: loudness.available }
    },
    'duration-and-structure': {
      passed: durationError <= tolerance && analysis?.planCompliance?.structure?.passed === true,
      evidence: {
        measuredDurationSeconds: technical.durationSeconds,
        requestedDurationSeconds: plan.musicalProfile.durationSeconds,
        errorSeconds: durationError,
        toleranceSeconds: tolerance,
        structure: analysis?.planCompliance?.structure ?? null
      }
    },
    'originality-review': {
      passed: originality?.passed === true,
      evidence: originality ?? null
    }
  };
  if (plan.quality.targetIntegratedLufs !== null) {
    const toleranceLufs = plan.quality.integratedLufsTolerance ?? 1;
    gates['integrated-loudness'] = {
      passed: loudness.available && loudness.integratedLufs !== null && Math.abs(loudness.integratedLufs - plan.quality.targetIntegratedLufs) <= toleranceLufs,
      evidence: { measuredLufs: loudness.integratedLufs, targetLufs: plan.quality.targetIntegratedLufs, toleranceLufs }
    };
  }
  const failed = Object.entries(gates).filter(([, gate]) => !gate.passed).map(([name]) => name);
  return { passed: failed.length === 0, failed, gates };
}
