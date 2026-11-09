export class NivAiError extends Error {
  constructor(message, { code = 'NIV_AI_ERROR', details = null, cause = undefined } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class ConfigurationError extends NivAiError {
  constructor(message, details = null) {
    super(message, { code: 'CONFIGURATION_ERROR', details });
  }
}

export class PlanValidationError extends NivAiError {
  constructor(errors, warnings = []) {
    super(`Music plan failed strict validation (${errors.length} error(s))`, {
      code: 'PLAN_VALIDATION_ERROR',
      details: { errors, warnings }
    });
  }
}

export class CapabilityError extends NivAiError {
  constructor(errors, warnings = []) {
    super(`Configured AI provider cannot satisfy the music plan (${errors.length} incompatibility(s))`, {
      code: 'CAPABILITY_ERROR',
      details: { errors, warnings }
    });
  }
}

export class ProviderError extends NivAiError {
  constructor(message, details = null, cause = undefined) {
    super(message, { code: 'PROVIDER_ERROR', details, cause });
  }
}

export class QualityGateError extends NivAiError {
  constructor(message, details = null) {
    super(message, { code: 'QUALITY_GATE_ERROR', details });
  }
}

export function publicError(error) {
  return {
    name: error?.name ?? 'Error',
    code: error?.code ?? 'UNEXPECTED_ERROR',
    message: error?.message ?? String(error),
    details: error?.details ?? null
  };
}
