import { CapabilityError } from './errors.js';

export function auditProviderCapabilities(plan, capabilities, providerConfiguration) {
  const errors = [];
  const warnings = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };

  require(capabilities.providerId === plan.generation.provider,
    `Plan provider "${plan.generation.provider}" does not match capability provider "${capabilities.providerId}"`);
  require(providerConfiguration.providerId === plan.generation.provider,
    `Configured provider "${providerConfiguration.providerId}" does not match plan provider "${plan.generation.provider}"`);
  require(providerConfiguration.model === plan.generation.model,
    `Configured model "${providerConfiguration.model}" does not match plan model "${plan.generation.model}"`);
  require(capabilities.operations.includes(plan.operation), `Provider does not support ${plan.operation}`);
  require(capabilities.models.some(model => model.id === plan.generation.model), `Provider does not advertise model ${plan.generation.model}`);
  if (capabilities.limits.maxDurationSeconds !== null) {
    require(plan.musicalProfile.durationSeconds <= capabilities.limits.maxDurationSeconds,
      `Requested duration exceeds provider maximum of ${capabilities.limits.maxDurationSeconds} seconds`);
  }
  if (capabilities.limits.maxCandidates !== null) {
    require(plan.generation.candidateCount <= capabilities.limits.maxCandidates,
      `Requested candidate count exceeds provider maximum of ${capabilities.limits.maxCandidates}`);
  }
  if (capabilities.sampleRates.length) require(capabilities.sampleRates.includes(plan.musicalProfile.sampleRate), 'Provider does not support the requested sample rate');
  if (capabilities.channelCounts.length) require(capabilities.channelCounts.includes(plan.musicalProfile.channels), 'Provider does not support the requested channel count');
  require(capabilities.outputFormats.some(format => ['wav', 'wave', 'flac'].includes(format)), 'Provider must supply a lossless WAV or FLAC candidate');
  if (plan.generation.outputStems) require(capabilities.features.stems, 'Plan requires stems but provider does not support stems');
  require(capabilities.features.analysis.available, 'A semantic music/sound analyzer is required for strict candidate validation');
  require(capabilities.features.analysis.calibrated, 'The semantic analyzer must report calibrated confidence');
  require(capabilities.features.analysis.openSet, 'The analyzer must support open-set unknown-acoustic-source results');
  require(Boolean(capabilities.features.analysis.model), 'The analyzer must identify its model');
  require(Boolean(capabilities.features.analysis.taxonomyVersion), 'The analyzer must identify its taxonomy version');
  require(capabilities.features.originality.available, 'An originality comparator is required for strict generation');
  require(Boolean(capabilities.features.originality.model), 'The originality comparator must identify its model');
  require(Boolean(capabilities.features.originality.corpusVersion), 'The originality comparator must identify its comparison corpus version');
  if (!capabilities.features.seeds && plan.generation.seedPolicy === 'record-when-supported') {
    warnings.push('Provider does not support deterministic seeds; the run may not be reproducible');
  }

  const result = {
    passed: errors.length === 0,
    checkedAt: new Date().toISOString(),
    adapter: providerConfiguration.adapter,
    providerId: capabilities.providerId,
    providerVersion: capabilities.providerVersion,
    model: plan.generation.model,
    errors,
    warnings,
    capabilities
  };
  if (errors.length) throw new CapabilityError(errors, warnings);
  return result;
}
