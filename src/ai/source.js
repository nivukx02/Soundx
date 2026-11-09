import fs from 'node:fs';
import path from 'node:path';
import { decodeFromNIV, getNIVInfo } from '../../decoder.js';
import { writePcm32Wav } from './audio/wav.js';
import { sha256Buffer, sha256File } from './utils.js';

const SOURCE_OPERATIONS = new Set(['reference-transform', 'edit', 'extend', 'remix']);

export async function prepareSource(plan, planDirectory, workingDirectory, maxDecodedBytes) {
  if (!SOURCE_OPERATIONS.has(plan.operation)) return null;
  if (plan.source.rights === 'unknown') throw new Error('Source rights must be owned, licensed, or public-domain before transformation');
  const declared = plan.source.nivPath ?? plan.source.audioPath;
  const sourcePath = path.resolve(planDirectory, declared);
  const stats = await fs.promises.stat(sourcePath);
  if (!stats.isFile()) throw new Error(`Source is not a regular file: ${sourcePath}`);
  if (plan.source.nivPath) {
    const info = await getNIVInfo(sourcePath);
    const decoded = await decodeFromNIV(sourcePath, { maxDecodedBytes });
    const decodedPath = path.join(workingDirectory, 'source.decoded.wav');
    await writePcm32Wav(decodedPath, decoded.pcmData, decoded.audioInfo);
    return {
      originalPath: sourcePath,
      providerPath: decodedPath,
      kind: 'niv',
      nivInfo: { version: info.version, channels: info.channels, sampleRate: info.sampleRate, bitDepth: info.bitDepth },
      originalSha256: await sha256File(sourcePath),
      decodedPcmSha256: sha256Buffer(decoded.pcmData)
    };
  }
  return { originalPath: sourcePath, providerPath: sourcePath, kind: 'audio', originalSha256: await sha256File(sourcePath) };
}
