#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodeToNIV, NIV_MAGIC } from './encoder.js';
import { decodeFromNIV, getNIVInfo, parseHeader } from './decoder.js';

const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'niv-codec-test-'));
let passed = 0;
async function check(name, callback) {
  await callback();
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  console.log('NIV Audio Codec - Core Tests\n');
  await check('signed PCM is byte-exact after NIV encode/decode', async () => {
    const samples = new Int32Array(2000);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.floor(Math.sin(index / 10) * 1000000);
    const pcmData = Buffer.from(samples.buffer);
    const audioInfo = { channels: 2, sampleRate: 48000, bitDepth: 32, format: 'wav' };
    const encoded = await encodeToNIV(audioInfo, pcmData, { title: 'round-trip', audio: { frames: 1000 } });
    const file = path.join(directory, 'roundtrip.niv');
    await fs.promises.writeFile(file, encoded);
    const decoded = await decodeFromNIV(file);
    assert(decoded.pcmData.equals(pcmData));
    assert.equal(decoded.audioInfo.frames, 1000);
    assert.equal(decoded.metadata.title, 'round-trip');
  });

  await check('header fields and metadata inspection are valid', async () => {
    const pcmData = Buffer.from(new Int32Array([1, 2, 3, 4]).buffer);
    const encoded = await encodeToNIV({ channels: 1, sampleRate: 8000, bitDepth: 32, format: 'wav' }, pcmData, {});
    assert(encoded.subarray(0, 4).equals(NIV_MAGIC));
    const header = parseHeader(encoded.subarray(0, 64));
    assert.equal(header.version, 1);
    const file = path.join(directory, 'info.niv');
    await fs.promises.writeFile(file, encoded);
    const info = await getNIVInfo(file);
    assert.equal(info.channels, 1);
    assert.equal(info.sampleRate, 8000);
  });

  await check('compressed-payload corruption is rejected', async () => {
    const pcmData = Buffer.from(new Int32Array([5, 6, 7, 8]).buffer);
    const encoded = await encodeToNIV({ channels: 1, sampleRate: 8000, bitDepth: 32, format: 'wav' }, pcmData, {});
    encoded[encoded.length - 1] ^= 0xFF;
    const file = path.join(directory, 'corrupt.niv');
    await fs.promises.writeFile(file, encoded);
    await assert.rejects(() => decodeFromNIV(file), /checksum/i);
  });

  await check('trailing undeclared bytes and invalid magic are rejected', async () => {
    assert.throws(() => parseHeader(Buffer.alloc(64)), /magic/i);
    const pcmData = Buffer.from(new Int32Array([1]).buffer);
    const encoded = await encodeToNIV({ channels: 1, sampleRate: 8000, bitDepth: 32, format: 'wav' }, pcmData, {});
    const file = path.join(directory, 'trailing.niv');
    await fs.promises.writeFile(file, Buffer.concat([encoded, Buffer.from([1])]));
    await assert.rejects(() => decodeFromNIV(file), /trailing/i);
  });

  console.log(`\n${passed} core tests passed`);
} finally {
  await fs.promises.rm(directory, { recursive: true, force: true });
}
