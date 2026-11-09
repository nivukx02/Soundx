import fs from 'node:fs';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

export function ffmpegPath() {
  return ffmpegInstaller?.path ?? ffmpegInstaller?.default?.path ?? null;
}

export async function inspectFfmpeg() {
  const executable = ffmpegPath();
  if (!executable) return { available: false, path: null, reason: 'Bundled FFmpeg path is unavailable' };
  try {
    await fs.promises.access(executable, fs.constants.X_OK);
    const result = await runFfmpeg(['-version'], { timeoutMs: 10000 });
    const firstLine = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).find(Boolean) ?? 'unknown';
    return { available: true, path: executable, version: firstLine };
  } catch (error) {
    return { available: false, path: executable, reason: error.message };
  }
}

export function runFfmpeg(args, { timeoutMs = 120000, maxOutputBytes = 4 * 1024 * 1024 } = {}) {
  const executable = ffmpegPath();
  if (!executable) return Promise.reject(new Error('Bundled FFmpeg is unavailable'));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-nostdin', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let captured = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const capture = target => chunk => {
      captured += chunk.length;
      if (captured <= maxOutputBytes) target.push(chunk);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.on('error', error => finish(reject, error));
    child.on('close', code => {
      const result = { code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') };
      if (code === 0) finish(resolve, result);
      else finish(reject, new Error(`FFmpeg exited with code ${code}: ${result.stderr.slice(-4000)}`));
    });
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error(`FFmpeg timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
}

export async function convertToPcm32Wav(inputPath, outputPath) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', '-i', inputPath,
    '-map', '0:a:0', '-vn', '-c:a', 'pcm_s32le', '-f', 'wav', outputPath
  ], { timeoutMs: 10 * 60 * 1000 });
  return outputPath;
}

export async function encodeFlac(inputWavPath, outputPath, { overwrite = false } = {}) {
  await runFfmpeg([
    '-hide_banner', '-loglevel', 'error', ...(overwrite ? ['-y'] : []), '-i', inputWavPath,
    '-map', '0:a:0', '-vn', '-c:a', 'flac', '-compression_level', '12', '-f', 'flac', outputPath
  ], { timeoutMs: 10 * 60 * 1000 });
  return outputPath;
}

function lastMatch(text, expression) {
  let result = null;
  for (const match of text.matchAll(expression)) result = match[1];
  return result;
}

function decibels(value) {
  if (value === null || value === undefined) return null;
  if (String(value).toLowerCase() === '-inf') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function measureEbur128(inputPath) {
  try {
    const result = await runFfmpeg([
      '-hide_banner', '-nostats', '-i', inputPath,
      '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'
    ], { timeoutMs: 10 * 60 * 1000, maxOutputBytes: 16 * 1024 * 1024 });
    const text = `${result.stdout}\n${result.stderr}`;
    const integrated = decibels(lastMatch(text, /\bI:\s*(-?inf|[-+]?\d+(?:\.\d+)?)\s+LUFS/gmi));
    const loudnessRange = decibels(lastMatch(text, /\bLRA:\s*(-?inf|[-+]?\d+(?:\.\d+)?)\s+LU/gmi));
    const truePeak = decibels(lastMatch(text, /\bPeak:\s*(-?inf|[-+]?\d+(?:\.\d+)?)\s+dBFS/gmi));
    if (truePeak === null && !/Peak:\s*-inf/i.test(text)) throw new Error('FFmpeg did not emit a true-peak summary');
    return {
      available: true,
      method: 'FFmpeg ebur128 peak=true (4x oversampled true-peak mode)',
      integratedLufs: integrated,
      loudnessRangeLu: loudnessRange,
      truePeakDbtp: truePeak,
      silent: truePeak === null
    };
  } catch (error) {
    return { available: false, method: null, integratedLufs: null, loudnessRangeLu: null, truePeakDbtp: null, silent: null, reason: error.message };
  }
}
