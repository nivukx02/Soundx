import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { NIV_MAGIC, NIV_VERSION, HEADER_SIZE, MAX_METADATA_BYTES, calculateCRC32 } from './encoder.js';

const inflate = promisify(zlib.inflate);
const DEFAULT_MAX_DECODED_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_MAX_NIV_BYTES = 2 * 1024 * 1024 * 1024;

function safeInteger(bigint, label) {
  if (bigint > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} exceeds JavaScript's safe integer range`);
  return Number(bigint);
}

export function parseHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_SIZE) throw new Error('Invalid .NIV file: header is truncated');
  if (!buffer.subarray(0, 4).equals(NIV_MAGIC)) throw new Error('Invalid .NIV file: magic number mismatch');

  const header = {
    version: buffer.readUInt16LE(4),
    channels: buffer.readUInt8(6),
    sampleRate: buffer.readUInt32LE(7),
    bitDepth: buffer.readUInt8(11),
    audioDataSize: safeInteger(buffer.readBigUInt64LE(12), 'Compressed audio size'),
    metadataSize: buffer.readUInt32LE(20),
    checksum: buffer.readUInt32LE(24)
  };
  if (header.version !== NIV_VERSION) throw new Error(`Unsupported NIV version: ${header.version}`);
  if (header.channels < 1 || header.channels > 32) throw new Error(`Invalid NIV channel count: ${header.channels}`);
  if (header.sampleRate < 8000 || header.sampleRate > 384000) throw new Error(`Invalid NIV sample rate: ${header.sampleRate}`);
  if (header.bitDepth !== 32) throw new Error(`Unsupported NIV v1 bit depth: ${header.bitDepth}`);
  if (header.metadataSize > MAX_METADATA_BYTES) throw new Error(`NIV metadata exceeds ${MAX_METADATA_BYTES} bytes`);
  if (header.audioDataSize < 1) throw new Error('NIV compressed audio payload is empty');
  return header;
}

function deltaDecode(deltaBuffer) {
  if (deltaBuffer.length === 0 || deltaBuffer.length % 4 !== 0) {
    throw new Error('Decoded NIV delta payload is not valid signed 32-bit PCM');
  }
  const output = Buffer.allocUnsafe(deltaBuffer.length);
  const inputView = new DataView(deltaBuffer.buffer, deltaBuffer.byteOffset, deltaBuffer.byteLength);
  const outputView = new DataView(output.buffer, output.byteOffset, output.byteLength);
  let sample = 0;
  for (let index = 0; index < deltaBuffer.length / 4; index++) {
    sample = (sample + inputView.getInt32(index * 4, true)) | 0;
    outputView.setInt32(index * 4, sample, true);
  }
  return output;
}

function parseMetadata(buffer) {
  let metadata;
  try {
    metadata = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid NIV metadata JSON: ${error.message}`);
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('NIV metadata must be a JSON object');
  }
  return metadata;
}

function declaredDecodedBytes(metadata, header) {
  const frames = metadata?.audio?.frames ?? metadata?.pcmFrames;
  if (frames === undefined) return null;
  if (!Number.isSafeInteger(frames) || frames < 1) throw new Error('NIV metadata declares an invalid PCM frame count');
  const bytes = frames * header.channels * 4;
  if (!Number.isSafeInteger(bytes)) throw new Error('Declared NIV decoded size exceeds the safe integer range');
  return bytes;
}

export async function decodeFromNIV(inputPath, options = {}) {
  const maxDecodedBytes = options.maxDecodedBytes ?? DEFAULT_MAX_DECODED_BYTES;
  const maxNivBytes = options.maxNivBytes ?? DEFAULT_MAX_NIV_BYTES;
  if (!Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes < 4) throw new RangeError('maxDecodedBytes must be a positive safe integer');
  if (!Number.isSafeInteger(maxNivBytes) || maxNivBytes < HEADER_SIZE) throw new RangeError('maxNivBytes must be a positive safe integer');
  const inputStats = await fs.promises.stat(inputPath);
  if (!inputStats.isFile()) throw new Error('NIV input is not a regular file');
  if (inputStats.size > maxNivBytes) throw new Error(`NIV file size ${inputStats.size} exceeds limit ${maxNivBytes}`);
  const nivBuffer = await fs.promises.readFile(inputPath);
  const header = parseHeader(nivBuffer);
  const expectedFileSize = HEADER_SIZE + header.metadataSize + header.audioDataSize;
  if (!Number.isSafeInteger(expectedFileSize) || expectedFileSize > nivBuffer.length) {
    throw new Error('Declared NIV sections exceed the physical file size');
  }
  if (expectedFileSize !== nivBuffer.length && options.allowTrailingBytes !== true) {
    throw new Error(`NIV file contains ${nivBuffer.length - expectedFileSize} undeclared trailing byte(s)`);
  }

  const metadataEnd = HEADER_SIZE + header.metadataSize;
  const metadata = parseMetadata(nivBuffer.subarray(HEADER_SIZE, metadataEnd));
  const expectedDecodedBytes = declaredDecodedBytes(metadata, header);
  if (expectedDecodedBytes !== null && expectedDecodedBytes > maxDecodedBytes) {
    throw new Error(`Declared decoded audio size ${expectedDecodedBytes} exceeds limit ${maxDecodedBytes}`);
  }
  const outputLimit = expectedDecodedBytes ?? maxDecodedBytes;
  const compressedData = nivBuffer.subarray(metadataEnd, expectedFileSize);
  if (calculateCRC32(compressedData) !== header.checksum) throw new Error('NIV compressed payload checksum mismatch');

  let deltaEncoded;
  try {
    deltaEncoded = await inflate(compressedData, { maxOutputLength: outputLimit });
  } catch (error) {
    throw new Error(`NIV decompression failed or exceeded its safety limit: ${error.message}`);
  }
  if (expectedDecodedBytes !== null && deltaEncoded.length !== expectedDecodedBytes) {
    throw new Error(`Decoded NIV length ${deltaEncoded.length} does not match declared length ${expectedDecodedBytes}`);
  }
  if (deltaEncoded.length % (header.channels * 4) !== 0) {
    throw new Error('Decoded NIV payload does not contain complete interleaved frames');
  }
  const pcmData = deltaDecode(deltaEncoded);
  if (metadata?.audio?.pcmHash !== undefined) {
    const pcmHash = `sha256:${crypto.createHash('sha256').update(pcmData).digest('hex')}`;
    if (metadata.audio.pcmHash !== pcmHash) throw new Error('Decoded NIV PCM hash does not match metadata');
  }
  const frames = pcmData.length / (header.channels * 4);
  return {
    audioInfo: {
      channels: header.channels,
      sampleRate: header.sampleRate,
      bitDepth: header.bitDepth,
      format: metadata.originalFormat ?? 'pcm_s32le',
      frames,
      duration: frames / header.sampleRate
    },
    pcmData,
    metadata
  };
}

export async function getNIVInfo(inputPath) {
  const handle = await fs.promises.open(inputPath, 'r');
  try {
    const headerBuffer = Buffer.alloc(HEADER_SIZE);
    const headerRead = await handle.read(headerBuffer, 0, HEADER_SIZE, 0);
    if (headerRead.bytesRead !== HEADER_SIZE) throw new Error('Invalid .NIV file: header is truncated');
    const header = parseHeader(headerBuffer);
    const metadataBuffer = Buffer.alloc(header.metadataSize);
    const metadataRead = await handle.read(metadataBuffer, 0, header.metadataSize, HEADER_SIZE);
    if (metadataRead.bytesRead !== header.metadataSize) throw new Error('Invalid .NIV file: metadata is truncated');
    return { ...header, metadata: parseMetadata(metadataBuffer) };
  } finally {
    await handle.close();
  }
}
