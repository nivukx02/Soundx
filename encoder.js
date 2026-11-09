import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const deflate = promisify(zlib.deflate);

export const NIV_MAGIC = Buffer.from('NIV\0');
export const NIV_VERSION = 1;
export const HEADER_SIZE = 64;
export const MAX_METADATA_BYTES = 16 * 1024 * 1024;

function requireAudioInfo(audioInfo, pcmData) {
  if (!audioInfo || typeof audioInfo !== 'object') throw new TypeError('audioInfo must be an object');
  if (!Number.isInteger(audioInfo.channels) || audioInfo.channels < 1 || audioInfo.channels > 32) {
    throw new RangeError('audioInfo.channels must be an integer from 1 through 32');
  }
  if (!Number.isInteger(audioInfo.sampleRate) || audioInfo.sampleRate < 8000 || audioInfo.sampleRate > 384000) {
    throw new RangeError('audioInfo.sampleRate must be an integer from 8000 through 384000');
  }
  if (audioInfo.bitDepth !== 32) {
    throw new RangeError('NIV v1 stores signed 32-bit little-endian PCM; bitDepth must be 32');
  }
  if (!Buffer.isBuffer(pcmData) || pcmData.length === 0 || pcmData.length % 4 !== 0) {
    throw new TypeError('pcmData must be a non-empty Buffer of signed 32-bit little-endian samples');
  }
  const sampleCount = pcmData.length / 4;
  if (sampleCount % audioInfo.channels !== 0) {
    throw new RangeError('pcmData does not contain a whole number of interleaved audio frames');
  }
  return sampleCount / audioInfo.channels;
}

function deltaEncode(pcmData) {
  const sampleCount = pcmData.length / 4;
  const output = Buffer.allocUnsafe(pcmData.length);
  const inputView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  const outputView = new DataView(output.buffer, output.byteOffset, output.byteLength);
  let previous = 0;
  for (let index = 0; index < sampleCount; index++) {
    const sample = inputView.getInt32(index * 4, true);
    outputView.setInt32(index * 4, sample - previous, true);
    previous = sample;
  }
  return output;
}

export function calculateCRC32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < buffer.length; index++) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export async function encodeToNIV(audioInfo, pcmData, metadata = {}) {
  const frames = requireAudioInfo(audioInfo, pcmData);
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be a JSON object');
  }

  const duration = frames / audioInfo.sampleRate;
  const pcmHash = `sha256:${crypto.createHash('sha256').update(pcmData).digest('hex')}`;
  const metadataJson = JSON.stringify({
    ...metadata,
    audio: {
      ...(metadata.audio && typeof metadata.audio === 'object' && !Array.isArray(metadata.audio) ? metadata.audio : {}),
      codec: 'pcm-s32le',
      sampleRate: audioInfo.sampleRate,
      channels: audioInfo.channels,
      frames,
      durationSeconds: duration,
      pcmHash
    },
    originalFormat: audioInfo.format ?? 'pcm_s32le',
    encodedAt: new Date().toISOString(),
    duration
  });
  const metadataBuffer = Buffer.from(metadataJson, 'utf8');
  if (metadataBuffer.length > MAX_METADATA_BYTES) {
    throw new RangeError(`NIV metadata exceeds the ${MAX_METADATA_BYTES}-byte safety limit`);
  }

  const deltaEncoded = deltaEncode(pcmData);
  const compressed = await deflate(deltaEncoded, { level: 9 });
  const header = Buffer.alloc(HEADER_SIZE);
  NIV_MAGIC.copy(header, 0);
  header.writeUInt16LE(NIV_VERSION, 4);
  header.writeUInt8(audioInfo.channels, 6);
  header.writeUInt32LE(audioInfo.sampleRate, 7);
  header.writeUInt8(32, 11);
  header.writeBigUInt64LE(BigInt(compressed.length), 12);
  header.writeUInt32LE(metadataBuffer.length, 20);
  header.writeUInt32LE(calculateCRC32(compressed), 24);

  return Buffer.concat([header, metadataBuffer, compressed]);
}

export async function writeNIVFile(outputPath, audioInfo, pcmData, metadata, options = {}) {
  if (!options.overwrite) {
    try {
      await fs.promises.access(outputPath);
      throw new Error(`Refusing to overwrite existing NIV file: ${outputPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const nivBuffer = await encodeToNIV(audioInfo, pcmData, metadata);
  await fs.promises.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  try {
    await fs.promises.writeFile(outputPath, nivBuffer, { flag: options.overwrite ? 'w' : 'wx' });
  } catch (error) {
    if (!options.overwrite) await fs.promises.rm(outputPath, { force: true }).catch(() => {});
    throw error;
  }
  return {
    originalSize: pcmData.length,
    encodedSize: nivBuffer.length,
    compressionRatio: pcmData.length / nivBuffer.length
  };
}
