#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { providerConfigurationFromEnvironment, createProviderFromEnvironment } from './src/ai/providers/config.js';
import { createPromptMusicPlan, assertValidMusicPlan } from './src/ai/music-plan.js';
import { runEliteGeneration } from './src/ai/orchestrator.js';
import { GenerationJobStore } from './src/ai/job-store.js';
import { publicError } from './src/ai/errors.js';
import { readJson, writeJson } from './src/ai/utils.js';

function number(value, previous) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new InvalidArgumentError('Expected a finite number');
  return previous === undefined ? parsed : parsed;
}

function integer(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new InvalidArgumentError('Expected an integer');
  return parsed;
}

function collect(value, values) {
  values.push(value);
  return values;
}

function parseInstrument(value) {
  const [canonicalName, family = 'open-world-unspecified', role = 'provider-arranged'] = value.split('|').map(item => item.trim());
  if (!canonicalName) throw new InvalidArgumentError('Instrument syntax is "name|family|role"');
  return { canonicalName, family, role };
}

function emit(value, asJson = false) {
  if (asJson) console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

const program = new Command();
program
  .name('niv-ai')
  .description('Strict provider-backed AI music generation and NIV packaging')
  .version('2.0.0')
  .showHelpAfterError();

program.command('providers')
  .description('Audit the configured real AI provider without exposing credentials')
  .option('--json', 'Print machine-readable JSON')
  .action(async options => {
    const configuration = providerConfigurationFromEnvironment();
    if (!configuration.configured) {
      emit(options.json ? configuration : `${chalk.yellow('UNCONFIGURED')} ${configuration.reason}`, options.json);
      return;
    }
    const provider = createProviderFromEnvironment();
    const capabilities = await provider.capabilities();
    const result = { configuration: provider.publicConfiguration(), capabilities };
    emit(options.json ? result : `${chalk.green('AVAILABLE')} ${capabilities.providerId} / ${configuration.model}\nOperations: ${capabilities.operations.join(', ')}`, options.json);
  });

program.command('plan')
  .description('Create a strict prompt-to-music plan')
  .requiredOption('-p, --prompt <text>', 'Creative music prompt')
  .option('--operation <name>', 'prompt-generate, reference-transform, edit, extend, or remix', 'prompt-generate')
  .option('--source-niv <path>', 'Source NIV for an authorized transform/edit/extend/remix')
  .option('--source-audio <path>', 'Source audio for an authorized transform/edit/extend/remix')
  .option('--rights <status>', 'owned, licensed, public-domain, or unknown', 'owned')
  .option('--voice-consent <record>', 'Voice-consent record when identity preservation is authorized')
  .option('--preserve <attribute>', 'Repeatable authorized attribute to preserve', collect, [])
  .option('--change <attribute>', 'Repeatable attribute to replace or change', collect, [])
  .option('-o, --out <file>', 'Plan output path', 'music-plan.json')
  .option('--output-directory <path>', 'Delivery paths stored in the plan', 'output')
  .option('--duration <seconds>', 'Exact target duration', number, 180)
  .option('--sample-rate <hz>', 'Target sample rate', integer, 48000)
  .option('--channels <count>', 'Target channel count', integer, 2)
  .option('--bpm <value>', 'Tempo in BPM', number, 100)
  .option('--meter <meter>', 'Meter', '4/4')
  .option('--tonic <note>', 'Tonic', 'D')
  .option('--mode <name>', 'Mode or tonal language', 'minor')
  .option('--candidates <count>', 'Candidate count', integer, 4)
  .option('--format <format>', 'Lossless delivery format: wav or flac', 'wav')
  .option('-i, --instrument <name|family|role>', 'Repeatable open-world instrument intent', collect, [])
  .option('--offline', 'Create a draft without contacting a configured provider')
  .option('--force', 'Overwrite an existing plan')
  .action(async options => {
    const operations = new Set(['prompt-generate', 'reference-transform', 'edit', 'extend', 'remix']);
    if (!operations.has(options.operation)) throw new InvalidArgumentError(`Unsupported generation operation: ${options.operation}`);
    const sourceCount = Number(Boolean(options.sourceNiv)) + Number(Boolean(options.sourceAudio));
    if (options.operation === 'prompt-generate' && sourceCount) throw new InvalidArgumentError('prompt-generate does not accept a source; choose a transform operation');
    if (options.operation !== 'prompt-generate' && sourceCount !== 1) throw new InvalidArgumentError('Transform operations require exactly one of --source-niv or --source-audio');
    let providerAudit = null;
    const configuration = providerConfigurationFromEnvironment();
    if (!options.offline && configuration.configured) {
      const provider = createProviderFromEnvironment();
      const capabilities = await provider.capabilities();
      providerAudit = { configured: true, providerId: capabilities.providerId, model: configuration.model, capabilities };
    }
    const planFile = path.resolve(options.out);
    const planDirectory = path.dirname(planFile);
    const plan = createPromptMusicPlan({
      prompt: options.prompt,
      operation: options.operation,
      sourceNivPath: options.sourceNiv ? path.relative(planDirectory, path.resolve(options.sourceNiv)) : null,
      sourceAudioPath: options.sourceAudio ? path.relative(planDirectory, path.resolve(options.sourceAudio)) : null,
      sourceRights: options.rights,
      voiceConsent: options.voiceConsent ?? null,
      preserve: options.preserve,
      change: options.change.length ? options.change : null,
      durationSeconds: options.duration,
      sampleRate: options.sampleRate,
      channels: options.channels,
      bpm: options.bpm,
      meter: options.meter,
      tonic: options.tonic,
      mode: options.mode,
      candidateCount: options.candidates,
      instruments: options.instrument.map(parseInstrument),
      providerAudit,
      outputDirectory: options.outputDirectory,
      audioFormat: options.format.toLowerCase()
    });
    const validation = assertValidMusicPlan(plan);
    await writeJson(planFile, plan, { overwrite: options.force });
    console.log(chalk.green(`Plan written: ${planFile}`));
    console.log(`Stage: ${plan.stage}`);
    if (validation.warnings.length) console.log(chalk.yellow(validation.warnings.join('\n')));
    if (plan.stage === 'draft') console.log(chalk.yellow('Configure a calibrated generation/analysis/originality provider before inference.'));
  });

program.command('validate')
  .description('Validate a music plan without running inference')
  .argument('<plan>', 'Music plan JSON')
  .option('--ready', 'Also require ready-for-inference stage')
  .option('--json', 'Print machine-readable JSON')
  .action(async (planPath, options) => {
    const plan = await readJson(path.resolve(planPath));
    const result = assertValidMusicPlan(plan, { requireReady: options.ready });
    emit(options.json ? { valid: true, ...result } : chalk.green(`Music plan is valid (${result.warnings.length} warning(s)).`), options.json);
  });

program.command('generate')
  .description('Generate with a real configured model, validate, and package as NIV')
  .argument('<plan>', 'Ready music plan JSON')
  .option('-o, --output-directory <path>', 'Override the delivery directory')
  .option('--poll-ms <milliseconds>', 'Provider polling interval', integer, 2000)
  .option('--overwrite', 'Explicitly replace existing delivery files')
  .option('--json', 'Print machine-readable JSON')
  .action(async (planPath, options) => {
    const resolved = path.resolve(planPath);
    const plan = await readJson(resolved);
    const provider = createProviderFromEnvironment();
    const controller = new AbortController();
    const cancel = () => controller.abort(new Error('Interrupted by user'));
    process.once('SIGINT', cancel);
    try {
      const result = await runEliteGeneration({
        plan,
        planPath: resolved,
        provider,
        outputDirectory: options.outputDirectory,
        overwrite: options.overwrite,
        pollIntervalMs: options.pollMs,
        signal: controller.signal
      });
      emit(options.json ? result : `${chalk.green('GENERATION VERIFIED')}\nAudio: ${result.outputs.audioPath}\nNIV: ${result.outputs.nivPath}\nManifest: ${result.outputs.manifestPath}\nJob: ${result.jobDirectory}`, options.json);
    } finally {
      process.removeListener('SIGINT', cancel);
    }
  });

program.command('status')
  .description('Read a local generation job state')
  .argument('<job>', 'Job directory or state.json')
  .option('--json', 'Print machine-readable JSON')
  .action(async (jobPath, options) => {
    const store = await GenerationJobStore.open(path.resolve(jobPath));
    emit(options.json ? store.state : `${store.state.id}: ${store.state.status} / ${store.state.phase}\n${store.state.outputs ? JSON.stringify(store.state.outputs, null, 2) : ''}`, options.json);
  });

program.command('cancel')
  .description('Cancel the provider job recorded in a local generation job')
  .argument('<job>', 'Job directory or state.json')
  .action(async jobPath => {
    const store = await GenerationJobStore.open(path.resolve(jobPath));
    if (!store.state.remoteJobId) throw new Error('This local job has no cancellable remote job id');
    const provider = createProviderFromEnvironment();
    await provider.cancel(store.state.remoteJobId);
    await store.update({ status: 'cancelled', phase: 'cancelled', providerStatus: 'cancelled' });
    console.log(chalk.yellow(`Cancelled provider job ${store.state.remoteJobId}`));
  });

program.parseAsync(process.argv).catch(error => {
  const output = publicError(error);
  console.error(chalk.red(`${output.code}: ${output.message}`));
  if (output.details) console.error(JSON.stringify(output.details, null, 2));
  if (error.jobDirectory) console.error(`Job evidence: ${error.jobDirectory}`);
  if (process.env.NIV_AI_DEBUG === '1') console.error(error.stack);
  process.exitCode = 1;
});
