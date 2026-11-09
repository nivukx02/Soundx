#!/usr/bin/env node

import { open, stat } from 'node:fs/promises';
import path from 'node:path';

const HEADER_SIZE = 64;
const MAGIC = Buffer.from([0x4e, 0x49, 0x56, 0x00]);
const DEFAULT_MAX_METADATA = 16 * 1024 * 1024;

function usage() {
  console.error('Usage: node inspect_niv.mjs <file.niv> [--full-metadata] [--max-metadata-bytes=<n>]');
}

function parsePositiveInteger(value, label) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return parsed;
}

function parseArgs(argv) {
  let file = null;
  let fullMetadata = false;
  let maxMetadataBytes = DEFAULT_MAX_METADATA;

  for (const arg of argv) {
    if (arg === '--full-metadata') {
      fullMetadata = true;
    } else if (arg.startsWith('--max-metadata-bytes=')) {
      maxMetadataBytes = parsePositiveInteger(arg.split('=', 2)[1], 'max metadata bytes');
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (file === null) {
      file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!file) {
    usage();
    process.exit(2);
  }

  return { file, fullMetadata, maxMetadataBytes };
}

async function readExactly(handle, length, position) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) throw new Error('Unexpected end of file');
    offset += bytesRead;
  }
  return buffer;
}

function safeSize(bigValue, label) {
  if (bigValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the JavaScript safe integer range`);
  }
  return Number(bigValue);
}

async function inspectNiv(filePath, options) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error('Input is not a regular file');
  if (fileStat.size < HEADER_SIZE) throw new Error('File is smaller than the NIV header');

  const handle = await open(filePath, 'r');
  try {
    const header = await readExactly(handle, HEADER_SIZE, 0);
    if (!header.subarray(0, 4).equals(MAGIC)) throw new Error('Invalid NIV magic number');

    const version = header.readUInt16LE(4);
    const channels = header.readUInt8(6);
    const sampleRate = header.readUInt32LE(7);
    const bitDepth = header.readUInt8(11);
    const audioDataSize = safeSize(header.readBigUInt64LE(12), 'audio data size');
    const metadataSize = header.readUInt32LE(20);
    const checksum = header.readUInt32LE(24);

    if (channels < 1 || channels > 32) throw new Error(`Invalid channel count: ${channels}`);
    if (sampleRate < 8000 || sampleRate > 384000) throw new Error(`Invalid sample rate: ${sampleRate}`);
    if (![8, 16, 24, 32, 64].includes(bitDepth)) throw new Error(`Unsupported bit depth: ${bitDepth}`);
    if (metadataSize > options.maxMetadataBytes) {
      throw new Error(`Metadata size ${metadataSize} exceeds limit ${options.maxMetadataBytes}`);
    }

    const expectedSize = HEADER_SIZE + metadataSize + audioDataSize;
    if (!Number.isSafeInteger(expectedSize)) throw new Error('Declared file size exceeds safe integer range');
    if (expectedSize > fileStat.size) throw new Error('Declared NIV sections exceed the physical file size');

    const metadataBuffer = await readExactly(handle, metadataSize, HEADER_SIZE);
    let metadata;
    try {
      metadata = JSON.parse(metadataBuffer.toString('utf8'));
    } catch (error) {
      throw new Error(`Invalid UTF-8 JSON metadata: ${error.message}`);
    }
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('NIV metadata must be a JSON object');
    }

    const analysis = metadata.analysis;
    const result = {
      file: path.resolve(filePath),
      physicalSize: fileStat.size,
      expectedSize,
      trailingBytes: fileStat.size - expectedSize,
      header: {
        magic: 'NIV\\0',
        version,
        channels,
        sampleRate,
        bitDepth,
        audioDataSize,
        metadataSize,
        compressedAudioCrc32: `0x${checksum.toString(16).padStart(8, '0')}`
      },
      metadataKeys: Object.keys(metadata).sort(),
      analysisKeys: analysis && typeof analysis === 'object' && !Array.isArray(analysis)
        ? Object.keys(analysis).sort()
        : [],
      warnings: []
    };

    if (version !== 1) result.warnings.push(`Inspector understands the v1 layout; file declares version ${version}`);
    if (result.trailingBytes > 0) result.warnings.push(`${result.trailingBytes} trailing byte(s) are not declared by the header`);
    if (!metadata.analysis) result.warnings.push('No embedded analysis metadata');
    if (options.fullMetadata) result.metadata = metadata;

    return result;
  } finally {
    await handle.close();
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const result = await inspectNiv(options.file, options);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`NIV inspection failed: ${error.message}`);
  process.exitCode = 1;
}
