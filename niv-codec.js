/**
 * NIV Audio Codec for Web Browsers
 * Uses Web Audio API and native browser compression
 */

const NIV_MAGIC = new Uint8Array([0x4E, 0x49, 0x56, 0x00]); // "NIV\0"
const NIV_VERSION = 1;
const HEADER_SIZE = 64;

/**
 * Delta encoding for lossless compression
 */
function deltaEncode(samples) {
    const deltas = new Int32Array(samples.length);
    deltas[0] = samples[0];
    
    for (let i = 1; i < samples.length; i++) {
        deltas[i] = samples[i] - samples[i - 1];
    }
    
    return deltas;
}

/**
 * Reverse delta encoding
 */
function deltaDecode(deltas) {
    const samples = new Int32Array(deltas.length);
    samples[0] = deltas[0];
    
    for (let i = 1; i < deltas.length; i++) {
        samples[i] = samples[i - 1] + deltas[i];
    }
    
    return samples;
}

/**
 * CRC32 checksum calculation
 */
function calculateCRC32(data) {
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Compress data using browser's CompressionStream API
 */
async function compressData(data) {
    try {
        const stream = new Blob([data]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
        const blob = await new Response(compressedStream).blob();
        return new Uint8Array(await blob.arrayBuffer());
    } catch (error) {
        console.error('Compression error:', error);
        throw new Error(`Compression failed: ${error.message}`);
    }
}

/**
 * Decompress data using browser's DecompressionStream API
 */
async function decompressData(data) {
    try {
        const stream = new Blob([data]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
        const blob = await new Response(decompressedStream).blob();
        return new Uint8Array(await blob.arrayBuffer());
    } catch (error) {
        console.error('Decompression error:', error);
        throw new Error(`Decompression failed: ${error.message}`);
    }
}

/**
 * Convert AudioBuffer to 32-bit PCM Int32Array
 */
function audioBufferToPCM(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const pcmData = new Int32Array(numberOfChannels * length);
    
    // Interleave channels
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Convert float32 (-1.0 to 1.0) to int32
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            pcmData[i * numberOfChannels + channel] = Math.floor(sample * 0x7FFFFFFF);
        }
    }
    
    return pcmData;
}

/**
 * Convert PCM Int32Array to AudioBuffer
 */
function pcmToAudioBuffer(pcmData, channels, sampleRate, audioContext) {
    const length = pcmData.length / channels;
    const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);
    
    // De-interleave channels
    for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Convert int32 to float32 (-1.0 to 1.0)
            channelData[i] = pcmData[i * channels + channel] / 0x7FFFFFFF;
        }
    }
    
    return audioBuffer;
}

/**
 * Encode audio to .NIV format with advanced analysis
 */
async function encodeToNIV(audioBuffer, metadata = {}, analysisData = null) {
    try {
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Step 1: Convert to PCM
        const pcmData = audioBufferToPCM(audioBuffer);
        
        // Step 2: Delta encode
        const deltaEncoded = deltaEncode(pcmData);
        
        // Step 3: Compress using DEFLATE - ensure proper buffer
        const deltaBuffer = new ArrayBuffer(deltaEncoded.length * 4);
        const deltaView = new Uint8Array(deltaBuffer);
        const deltaSource = new Uint8Array(deltaEncoded.buffer, deltaEncoded.byteOffset, deltaEncoded.byteLength);
        deltaView.set(deltaSource);
        
        const compressed = await compressData(deltaView);
        
        // Step 4: Prepare metadata with analysis data
        const metadataObj = {
            ...metadata,
            originalFormat: metadata.originalFormat || 'unknown',
            encodedAt: new Date().toISOString(),
            duration: duration,
            originalSize: pcmData.length * 4,
            // Include analysis data if available
            analysis: analysisData ? {
                instruments: analysisData.instruments,
                peaks: analysisData.peaks,
                emotionalMarkers: analysisData.emotionalMarkers,
                dynamics: analysisData.dynamics,
                frequencyStats: {
                    avgSpectrum: analysisData.frequencyData.avgSpectrum.slice(0, 50), // First 50 bins
                    dominantFrequencies: analysisData.frequencyData.samples
                        .filter((s, i) => i % 10 === 0) // Sample every 10th
                        .map(s => ({
                            time: s.time,
                            freq: s.dominantFrequency.frequency.toFixed(1),
                            energy: s.dominantFrequency.energy.toFixed(3)
                        }))
                }
            } : null
        };
        const metadataJson = JSON.stringify(metadataObj);
        const metadataBytes = new TextEncoder().encode(metadataJson);
        
        // Step 5: Calculate checksum
        const checksum = calculateCRC32(compressed);
        
        // Step 6: Create header
        const header = new ArrayBuffer(HEADER_SIZE);
        const headerView = new DataView(header);
        const headerBytes = new Uint8Array(header);
        
        let offset = 0;
        
        // Magic number
        headerBytes.set(NIV_MAGIC, offset);
        offset += 4;
        
        // Version
        headerView.setUint16(offset, NIV_VERSION, true);
        offset += 2;
        
        // Channels
        headerView.setUint8(offset, channels);
        offset += 1;
        
        // Sample rate
        headerView.setUint32(offset, sampleRate, true);
        offset += 4;
        
        // Bit depth (always 32 for our implementation)
        headerView.setUint8(offset, 32);
        offset += 1;
        
        // Audio data size
        headerView.setBigUint64(offset, BigInt(compressed.length), true);
        offset += 8;
        
        // Metadata size
        headerView.setUint32(offset, metadataBytes.length, true);
        offset += 4;
        
        // Checksum
        headerView.setUint32(offset, checksum, true);
        
        // Step 7: Combine all parts
        const totalSize = HEADER_SIZE + metadataBytes.length + compressed.length;
        const result = new Uint8Array(totalSize);
        
        result.set(headerBytes, 0);
        result.set(metadataBytes, HEADER_SIZE);
        result.set(compressed, HEADER_SIZE + metadataBytes.length);
        
        return {
            data: result,
            info: {
                originalSize: pcmData.length * 4,
                encodedSize: totalSize,
                compressionRatio: ((pcmData.length * 4) / totalSize).toFixed(2),
                channels,
                sampleRate,
                duration,
                bitDepth: 32,
                hasAnalysis: analysisData !== null
            }
        };
    } catch (error) {
        console.error('Encoding error:', error);
        throw new Error(`Encoding failed: ${error.message}`);
    }
}

/**
 * Parse .NIV file header
 */
function parseNIVHeader(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    
    let offset = 0;
    
    // Verify magic number
    const magic = bytes.slice(offset, offset + 4);
    if (!magic.every((byte, i) => byte === NIV_MAGIC[i])) {
        throw new Error('Invalid .NIV file: Magic number mismatch');
    }
    offset += 4;
    
    // Read version
    const version = view.getUint16(offset, true);
    offset += 2;
    
    // Read channels
    const channels = view.getUint8(offset);
    offset += 1;
    
    // Read sample rate
    const sampleRate = view.getUint32(offset, true);
    offset += 4;
    
    // Read bit depth
    const bitDepth = view.getUint8(offset);
    offset += 1;
    
    // Read audio data size
    const audioDataSize = Number(view.getBigUint64(offset, true));
    offset += 8;
    
    // Read metadata size
    const metadataSize = view.getUint32(offset, true);
    offset += 4;
    
    // Read checksum
    const checksum = view.getUint32(offset, true);
    
    return {
        version,
        channels,
        sampleRate,
        bitDepth,
        audioDataSize,
        metadataSize,
        checksum
    };
}

/**
 * Decode .NIV file to AudioBuffer
 */
async function decodeFromNIV(nivArrayBuffer, audioContext) {
    try {
        // Validate input
        if (!nivArrayBuffer || nivArrayBuffer.byteLength < HEADER_SIZE) {
            throw new Error('Invalid .NIV file: File too small');
        }
        
        // Parse header
        const header = parseNIVHeader(nivArrayBuffer.slice(0, HEADER_SIZE));
        
        // Validate header values
        if (header.channels < 1 || header.channels > 32) {
            throw new Error('Invalid channel count');
        }
        if (header.sampleRate < 8000 || header.sampleRate > 192000) {
            throw new Error('Invalid sample rate');
        }
        
        // Extract metadata
        const metadataStart = HEADER_SIZE;
        const metadataEnd = metadataStart + header.metadataSize;
        
        if (metadataEnd > nivArrayBuffer.byteLength) {
            throw new Error('Invalid .NIV file: Metadata size exceeds file size');
        }
        
        const metadataBytes = new Uint8Array(nivArrayBuffer.slice(metadataStart, metadataEnd));
        const metadataJson = new TextDecoder().decode(metadataBytes);
        const metadata = JSON.parse(metadataJson);
        
        // Extract compressed audio data
        const audioDataStart = metadataEnd;
        const audioDataEnd = audioDataStart + header.audioDataSize;
        
        if (audioDataEnd > nivArrayBuffer.byteLength) {
            throw new Error('Invalid .NIV file: Audio data size exceeds file size');
        }
        
        const compressedData = new Uint8Array(nivArrayBuffer.slice(audioDataStart, audioDataEnd));
        
        // Verify checksum
        const calculatedChecksum = calculateCRC32(compressedData);
        if (calculatedChecksum !== header.checksum) {
            throw new Error('Checksum mismatch: File may be corrupted');
        }
        
        // Decompress audio data
        const deltaBytes = await decompressData(compressedData);
        
        // Convert back to Int32Array - ensure proper alignment
        const alignedBuffer = new ArrayBuffer(deltaBytes.length);
        const alignedView = new Uint8Array(alignedBuffer);
        alignedView.set(deltaBytes);
        const deltaEncoded = new Int32Array(alignedBuffer);
        
        // Reverse delta encoding
        const pcmData = deltaDecode(deltaEncoded);
        
        // Convert to AudioBuffer
        const audioBuffer = pcmToAudioBuffer(
            pcmData,
            header.channels,
            header.sampleRate,
            audioContext
        );
        
        return {
            audioBuffer,
            metadata,
            info: {
                channels: header.channels,
                sampleRate: header.sampleRate,
                bitDepth: header.bitDepth,
                duration: audioBuffer.duration
            }
        };
    } catch (error) {
        console.error('Decoding error:', error);
        throw new Error(`Decoding failed: ${error.message}`);
    }
}

/**
 * Get .NIV file info without full decoding
 */
async function getNIVInfo(nivArrayBuffer) {
    // Parse header
    const header = parseNIVHeader(nivArrayBuffer.slice(0, HEADER_SIZE));
    
    // Extract metadata
    const metadataStart = HEADER_SIZE;
    const metadataEnd = metadataStart + header.metadataSize;
    const metadataBytes = new Uint8Array(nivArrayBuffer.slice(metadataStart, metadataEnd));
    const metadataJson = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataJson);
    
    return {
        version: header.version,
        channels: header.channels,
        sampleRate: header.sampleRate,
        bitDepth: header.bitDepth,
        audioDataSize: header.audioDataSize,
        metadata
    };
}

/**
 * Convert AudioBuffer to WAV file
 */
function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bitDepth = 32; // 32-bit float
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // WAV header
    let offset = 0;
    
    // "RIFF" chunk descriptor
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, bufferSize - 8, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    
    // "fmt " sub-chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // Subchunk size
    view.setUint16(offset, 3, true); offset += 2; // Audio format (3 = IEEE float)
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;
    
    // "data" sub-chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;
    
    // Write audio data (interleaved)
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = audioBuffer.getChannelData(channel)[i];
            view.setFloat32(offset, sample, true);
            offset += 4;
        }
    }
    
    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
