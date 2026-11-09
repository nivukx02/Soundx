import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { convertToPcm32Wav, encodeFlac } from './ffmpeg.js';
import { readWav, writePcm32Wav } from './wav.js';
import { sha256Buffer } from '../utils.js';

function requireBundledFlacPrecision(pcmData) {
  const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  for (let offset = 0; offset < pcmData.length; offset += 4) {
    if ((view.getInt32(offset, true) & 0xFF) !== 0) {
      throw new Error('Bundled FLAC encoding is limited to 24 valid bits; choose WAV to preserve full 32-bit PCM exactly');
    }
  }
}

async function isWav(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    return bytesRead === 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE';
  } finally {
    await handle.close();
  }
}

export async function canonicalizeAudio(inputPath, workingDirectory, maxBytes) {
  await fs.promises.mkdir(workingDirectory, { recursive: true });
  let wavPath = inputPath;
  let converted = false;
  if (!await isWav(inputPath)) {
    wavPath = path.join(workingDirectory, `${crypto.randomUUID()}.normalized.wav`);
    await convertToPcm32Wav(inputPath, wavPath);
    converted = true;
  }
  const parsed = await readWav(wavPath, maxBytes);
  return {
    ...parsed,
    sourcePath: inputPath,
    normalizedPath: wavPath,
    converted,
    pcmSha256: sha256Buffer(parsed.pcmData)
  };
}

export async function renderCanonicalAudio(canonical, outputPath, format, { overwrite = false } = {}) {
  const wavTemporary = format === 'wav' ? outputPath : `${outputPath}.${crypto.randomUUID()}.source.wav`;
  if (format === 'flac') requireBundledFlacPrecision(canonical.pcmData);
  await writePcm32Wav(wavTemporary, canonical.pcmData, canonical.audioInfo, { overwrite });
  if (format === 'wav') return { path: outputPath, temporaryWav: null };
  try {
    if (format !== 'flac') throw new Error(`Unsupported strict output format: ${format}`);
    await encodeFlac(wavTemporary, outputPath, { overwrite });
    return { path: outputPath, temporaryWav: wavTemporary };
  } finally {
    if (format !== 'wav') await fs.promises.rm(wavTemporary, { force: true }).catch(() => {});
  }
}
