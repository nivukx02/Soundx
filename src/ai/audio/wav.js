import fs from 'node:fs';
import path from 'node:path';

function fourCC(buffer, offset) {
  return buffer.toString('ascii', offset, offset + 4);
}

function requireInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(`${label} must be from ${minimum} through ${maximum}`);
}

export function parseWavBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) throw new Error('WAV file is truncated');
  if (fourCC(buffer, 0) !== 'RIFF' || fourCC(buffer, 8) !== 'WAVE') {
    if (fourCC(buffer, 0) === 'RF64') throw new Error('RF64 input is not yet supported by the NIV v1 in-memory codec');
    throw new Error('Input is not a RIFF/WAVE file');
  }
  const declaredRiffEnd = buffer.readUInt32LE(4) + 8;
  if (declaredRiffEnd > buffer.length) throw new Error('WAV RIFF size exceeds physical file size');
  if (declaredRiffEnd !== buffer.length) throw new Error('WAV contains undeclared trailing bytes');

  let format = null;
  const dataChunks = [];
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = fourCC(buffer, offset);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > buffer.length) throw new Error(`WAV ${id} chunk exceeds physical file size`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error('WAV fmt chunk is too small');
      let formatTag = buffer.readUInt16LE(start);
      const channels = buffer.readUInt16LE(start + 2);
      const sampleRate = buffer.readUInt32LE(start + 4);
      const byteRate = buffer.readUInt32LE(start + 8);
      const blockAlign = buffer.readUInt16LE(start + 12);
      const bitsPerSample = buffer.readUInt16LE(start + 14);
      let validBitsPerSample = bitsPerSample;
      let channelMask = null;
      if (formatTag === 0xFFFE) {
        if (size < 40 || buffer.readUInt16LE(start + 16) < 22) throw new Error('WAVE_FORMAT_EXTENSIBLE fmt chunk is truncated');
        validBitsPerSample = buffer.readUInt16LE(start + 18);
        channelMask = buffer.readUInt32LE(start + 20);
        formatTag = buffer.readUInt16LE(start + 24);
        const guidTail = buffer.subarray(start + 26, start + 40).toString('hex');
        if (guidTail !== '000000001000800000aa00389b71') throw new Error('Unsupported WAVE_FORMAT_EXTENSIBLE subformat GUID');
      }
      format = { formatTag, channels, sampleRate, byteRate, blockAlign, bitsPerSample, validBitsPerSample, channelMask };
    } else if (id === 'data') {
      dataChunks.push(buffer.subarray(start, end));
    }
    offset = end + (size & 1);
  }
  if (!format) throw new Error('WAV has no fmt chunk');
  if (!dataChunks.length) throw new Error('WAV has no data chunk');
  requireInteger(format.channels, 'WAV channels', 1, 32);
  requireInteger(format.sampleRate, 'WAV sample rate', 8000, 384000);
  if (![1, 3].includes(format.formatTag)) throw new Error(`Unsupported WAV sample format tag: ${format.formatTag}`);
  const supportedBits = format.formatTag === 1 ? [8, 16, 24, 32] : [32, 64];
  if (!supportedBits.includes(format.bitsPerSample)) throw new Error(`Unsupported WAV bit depth: ${format.bitsPerSample}`);
  const bytesPerSample = format.bitsPerSample / 8;
  const expectedBlockAlign = format.channels * bytesPerSample;
  if (format.blockAlign !== expectedBlockAlign) throw new Error('Packed or padded WAV frames are not supported');
  if (format.byteRate !== format.sampleRate * format.blockAlign) throw new Error('WAV byte rate is inconsistent with its format');
  if (format.validBitsPerSample < 1 || format.validBitsPerSample > format.bitsPerSample) throw new Error('WAV valid-bits field is inconsistent');
  const data = dataChunks.length === 1 ? dataChunks[0] : Buffer.concat(dataChunks);
  if (!data.length || data.length % format.blockAlign !== 0) throw new Error('WAV data does not contain complete audio frames');

  const sampleCount = data.length / bytesPerSample;
  const frames = sampleCount / format.channels;
  const pcmData = Buffer.allocUnsafe(sampleCount * 4);
  const output = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  let nonFiniteSamples = 0;
  let outOfRangeFloatSamples = 0;
  for (let index = 0; index < sampleCount; index++) {
    const sourceOffset = index * bytesPerSample;
    let sample;
    if (format.formatTag === 1 && format.bitsPerSample === 8) {
      sample = (data[sourceOffset] - 128) * 0x1000000;
    } else if (format.formatTag === 1 && format.bitsPerSample === 16) {
      sample = data.readInt16LE(sourceOffset) * 0x10000;
    } else if (format.formatTag === 1 && format.bitsPerSample === 24) {
      sample = data[sourceOffset] | (data[sourceOffset + 1] << 8) | (data[sourceOffset + 2] << 16);
      if (sample & 0x800000) sample |= 0xFF000000;
      sample *= 256;
    } else if (format.formatTag === 1) {
      sample = data.readInt32LE(sourceOffset);
    } else {
      const float = format.bitsPerSample === 32 ? data.readFloatLE(sourceOffset) : data.readDoubleLE(sourceOffset);
      if (!Number.isFinite(float)) {
        nonFiniteSamples++;
        sample = 0;
      } else if (float >= 1) {
        outOfRangeFloatSamples++;
        sample = 0x7FFFFFFF;
      } else if (float <= -1) {
        outOfRangeFloatSamples++;
        sample = -0x80000000;
      } else {
        sample = Math.round(float * (float < 0 ? 0x80000000 : 0x7FFFFFFF));
      }
    }
    output.setInt32(index * 4, sample, true);
  }
  return {
    audioInfo: {
      format: 'wav',
      channels: format.channels,
      sampleRate: format.sampleRate,
      bitDepth: 32,
      sourceBitDepth: format.bitsPerSample,
      frames,
      duration: frames / format.sampleRate,
      channelMask: format.channelMask
    },
    pcmData,
    diagnostics: { nonFiniteSamples, outOfRangeFloatSamples, sourceFormatTag: format.formatTag }
  };
}

export async function readWav(filePath, maxBytes = 2 * 1024 * 1024 * 1024) {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile() || stats.size < 44) throw new Error('Audio candidate is not a valid regular WAV file');
  if (stats.size > maxBytes) throw new Error(`Audio candidate exceeds ${maxBytes} bytes`);
  return parseWavBuffer(await fs.promises.readFile(filePath));
}

export function createPcm32Wav(pcmData, audioInfo) {
  if (!Buffer.isBuffer(pcmData) || !pcmData.length || pcmData.length % 4 !== 0) throw new TypeError('PCM must be non-empty signed 32-bit data');
  requireInteger(audioInfo.channels, 'channels', 1, 32);
  requireInteger(audioInfo.sampleRate, 'sample rate', 8000, 384000);
  if (pcmData.length % (audioInfo.channels * 4) !== 0) throw new Error('PCM does not contain complete frames');
  const dataSize = pcmData.length;
  if (dataSize > 0xFFFFFFFF - 36) throw new Error('Audio exceeds classic RIFF/WAVE size; NIV v1 cannot package this safely in memory');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(dataSize + 36, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(audioInfo.channels, 22);
  header.writeUInt32LE(audioInfo.sampleRate, 24);
  header.writeUInt32LE(audioInfo.sampleRate * audioInfo.channels * 4, 28);
  header.writeUInt16LE(audioInfo.channels * 4, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

export async function writePcm32Wav(filePath, pcmData, audioInfo, { overwrite = false } = {}) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, createPcm32Wav(pcmData, audioInfo), { flag: overwrite ? 'w' : 'wx' });
}
