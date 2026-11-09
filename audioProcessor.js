import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalizeAudio } from './src/ai/audio/canonical.js';
import { encodeFlac, runFfmpeg } from './src/ai/audio/ffmpeg.js';
import { writePcm32Wav } from './src/ai/audio/wav.js';

const DEFAULT_MAX_AUDIO_BYTES = 2 * 1024 * 1024 * 1024;

function sourceFormat(filePath) {
  return path.extname(filePath).slice(1).toLowerCase() || 'unknown';
}

async function inTemporaryDirectory(prefix, callback) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(directory);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

export async function getAudioMetadata(inputPath) {
  return inTemporaryDirectory('niv-audio-info-', async directory => {
    const canonical = await canonicalizeAudio(inputPath, directory, DEFAULT_MAX_AUDIO_BYTES);
    const stats = await fs.promises.stat(inputPath);
    const duration = canonical.audioInfo.duration;
    return {
      format: sourceFormat(inputPath),
      duration,
      bitrate: duration > 0 ? Math.round(stats.size * 8 / duration) : 0,
      channels: canonical.audioInfo.channels,
      sampleRate: canonical.audioInfo.sampleRate,
      bitDepth: canonical.audioInfo.sourceBitDepth ?? 32,
      codec: canonical.converted ? 'decoded-by-ffmpeg-to-pcm-s32le' : 'pcm',
      tags: {},
      frames: canonical.audioInfo.frames
    };
  });
}

export async function audioToPCM(inputPath) {
  return inTemporaryDirectory('niv-audio-decode-', async directory => {
    const canonical = await canonicalizeAudio(inputPath, directory, DEFAULT_MAX_AUDIO_BYTES);
    return {
      audioInfo: {
        channels: canonical.audioInfo.channels,
        sampleRate: canonical.audioInfo.sampleRate,
        bitDepth: 32,
        format: sourceFormat(inputPath),
        frames: canonical.audioInfo.frames,
        duration: canonical.audioInfo.duration
      },
      pcmData: canonical.pcmData,
      metadata: {}
    };
  });
}

export async function pcmToAudio(pcmData, audioInfo, outputPath, format = 'wav') {
  const normalizedFormat = String(format).toLowerCase();
  await fs.promises.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  if (normalizedFormat === 'wav') {
    await writePcm32Wav(outputPath, pcmData, audioInfo, { overwrite: true });
  } else {
    const temporaryWav = path.join(path.dirname(path.resolve(outputPath)), `.niv-${crypto.randomUUID()}.wav`);
    await writePcm32Wav(temporaryWav, pcmData, audioInfo);
    try {
      if (normalizedFormat === 'flac') {
        await encodeFlac(temporaryWav, outputPath, { overwrite: true });
      } else {
        const encoding = {
          mp3: ['-c:a', 'libmp3lame', '-b:a', '320k', '-f', 'mp3'],
          aac: ['-c:a', 'aac', '-b:a', '320k', '-f', 'adts'],
          m4a: ['-c:a', 'aac', '-b:a', '320k', '-f', 'ipod'],
          ogg: ['-c:a', 'libvorbis', '-b:a', '320k', '-f', 'ogg'],
          aiff: ['-c:a', 'pcm_s32be', '-f', 'aiff'],
          alac: ['-c:a', 'alac', '-f', 'ipod']
        }[normalizedFormat];
        if (!encoding) throw new Error(`Unsupported output format: ${normalizedFormat}`);
        await runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', temporaryWav, '-map', '0:a:0', '-vn', ...encoding, outputPath], {
          timeoutMs: 10 * 60 * 1000
        });
      }
    } finally {
      await fs.promises.rm(temporaryWav, { force: true }).catch(() => {});
    }
  }
  return { outputPath, format: normalizedFormat, channels: audioInfo.channels, sampleRate: audioInfo.sampleRate };
}

export function detectOutputFormat(filePath) {
  const extension = path.extname(filePath).toLowerCase().slice(1);
  return ['wav', 'flac', 'aiff', 'alac'].includes(extension) ? extension : 'flac';
}

export async function isValidAudioFile(filePath) {
  try {
    await getAudioMetadata(filePath);
    return true;
  } catch {
    return false;
  }
}
