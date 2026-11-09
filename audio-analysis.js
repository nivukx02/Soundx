/**
 * Advanced Audio Analysis Module for NIV Codec
 * Analyzes: Instruments, Frequencies, Peaks, Emotional Moments, BPM, Key, Genre, Mood, Vocals
 */

/**
 * Instrument frequency ranges (Hz)
 */
const INSTRUMENT_RANGES = {
    strings: {
        name: 'String Instruments',
        ranges: [
            { min: 82, max: 1320, weight: 1.0 },   // Fundamental
            { min: 1320, max: 4200, weight: 0.7 },  // Harmonics
            { min: 4200, max: 8000, weight: 0.4 }   // Brightness
        ],
        characteristics: ['sustained', 'harmonic-rich']
    },
    wind: {
        name: 'Wind Instruments',
        ranges: [
            { min: 130, max: 900, weight: 1.0 },    // Fundamental
            { min: 900, max: 2500, weight: 0.8 },   // Harmonics
            { min: 2500, max: 4000, weight: 0.5 }   // Air noise
        ],
        characteristics: ['breathy', 'attack']
    },
    percussion: {
        name: 'Percussion Instruments',
        ranges: [
            { min: 20, max: 250, weight: 1.0 },     // Bass/kick
            { min: 250, max: 800, weight: 0.9 },    // Toms/body
            { min: 800, max: 5000, weight: 0.8 },   // Snare/hi-hat
            { min: 5000, max: 12000, weight: 0.6 }  // Cymbals/transients
        ],
        characteristics: ['transient', 'short-decay']
    },
    keyboard: {
        name: 'Keyboard Instruments',
        ranges: [
            { min: 27.5, max: 523, weight: 1.0 },   // Low-Mid keys
            { min: 523, max: 2093, weight: 0.9 },   // Mid-High keys
            { min: 2093, max: 4186, weight: 0.7 }   // Highest keys + harmonics
        ],
        characteristics: ['percussive-attack', 'harmonic']
    },
    electronic: {
        name: 'Electronic Instruments',
        ranges: [
            { min: 20, max: 200, weight: 0.9 },     // Sub bass
            { min: 200, max: 2000, weight: 1.0 },   // Synth body
            { min: 2000, max: 8000, weight: 0.8 },  // Brightness
            { min: 8000, max: 20000, weight: 0.6 }  // Air/presence
        ],
        characteristics: ['synthetic', 'wide-spectrum']
    },
    vocal: {
        name: 'Vocal/Voice',
        ranges: [
            { min: 80, max: 350, weight: 1.0 },     // Fundamental (male/female)
            { min: 350, max: 1200, weight: 0.9 },   // Formants
            { min: 1200, max: 4000, weight: 0.7 },  // Presence
            { min: 4000, max: 8000, weight: 0.5 }   // Sibilance
        ],
        characteristics: ['formant-peaks', 'vibrato']
    }
};

/**
 * Analyze audio buffer and extract all musical features (ADVANCED VERSION)
 */
async function analyzeAudio(audioBuffer, progressCallback = null) {
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const channels = audioBuffer.numberOfChannels;
    
    console.log('🎵 Starting ADVANCED audio analysis...');
    
    // Create offline context for analysis
    const offlineContext = new OfflineAudioContext(
        channels,
        audioBuffer.length,
        sampleRate
    );
    
    // 1. Frequency Analysis (FFT)
    if (progressCallback) progressCallback(5, 'Analyzing frequencies...');
    const frequencyData = await analyzeFrequencies(audioBuffer, offlineContext);
    
    // 2. Instrument Detection
    if (progressCallback) progressCallback(15, 'Detecting instruments...');
    const instruments = detectInstruments(frequencyData);
    
    // 3. Peak Detection
    if (progressCallback) progressCallback(25, 'Finding peak moments...');
    const peaks = detectPeaks(audioBuffer);
    
    // 4. Goosebumps/Emotional Moments
    if (progressCallback) progressCallback(35, 'Analyzing emotional moments...');
    const emotionalMarkers = detectEmotionalMoments(audioBuffer, frequencyData, peaks);
    
    // 5. Dynamic Range & Energy
    if (progressCallback) progressCallback(45, 'Calculating dynamics...');
    const dynamics = analyzeDynamics(audioBuffer);
    
    // 6. BPM/Tempo Detection (ADVANCED)
    if (progressCallback) progressCallback(55, '🎼 Detecting BPM and tempo...');
    const tempoData = await detectBPM(audioBuffer, (p, t) => {
        if (progressCallback) progressCallback(55 + p * 0.1, t);
    });
    
    // 7. Musical Key Detection (ADVANCED)
    if (progressCallback) progressCallback(70, '🎹 Detecting musical key...');
    const keyData = await detectMusicalKey(audioBuffer, (p, t) => {
        if (progressCallback) progressCallback(70 + p * 0.05, t);
    });
    
    // 8. Genre Classification (ADVANCED)
    if (progressCallback) progressCallback(80, '🎸 Classifying genre...');
    const genreData = await classifyGenre(audioBuffer, tempoData, frequencyData, (p, t) => {
        if (progressCallback) progressCallback(80 + p * 0.05, t);
    });
    
    // 9. Mood Classification (ADVANCED)
    if (progressCallback) progressCallback(87, '😊 Analyzing mood...');
    const moodData = await classifyMood(audioBuffer, { ...genreData, key: keyData }, tempoData, emotionalMarkers, (p, t) => {
        if (progressCallback) progressCallback(87 + p * 0.05, t);
    });
    
    // 10. Vocal Detection (ADVANCED)
    if (progressCallback) progressCallback(94, '🎤 Detecting vocals...');
    const vocalData = await detectVocals(audioBuffer, instruments, (p, t) => {
        if (progressCallback) progressCallback(94 + p * 0.06, t);
    });
    
    if (progressCallback) progressCallback(100, 'Complete analysis finished!');
    
    console.log('✓ ADVANCED audio analysis complete');
    
    return {
        // Original features
        frequencyData,
        instruments,
        peaks,
        emotionalMarkers,
        dynamics,
        // Advanced features
        tempo: tempoData,
        key: keyData,
        genre: genreData,
        mood: moodData,
        vocals: vocalData,
        // Metadata
        duration,
        sampleRate,
        channels,
        analysisVersion: '2.0 - HIGH-END'
    };
}

/**
 * Analyze frequency spectrum over time using FFT
 */
async function analyzeFrequencies(audioBuffer, offlineContext) {
    const fftSize = 4096;
    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.8;
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(offlineContext.destination);
    
    const frequencyBins = analyser.frequencyBinCount;
    const nyquist = audioBuffer.sampleRate / 2;
    const binWidth = nyquist / frequencyBins;
    
    // Sample frequency data at intervals (every 0.1 seconds)
    const sampleInterval = 0.1;
    const numSamples = Math.floor(audioBuffer.duration / sampleInterval);
    const samples = [];
    
    // Get channel data
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
        const time = i * sampleInterval;
        const sampleIndex = Math.floor(time * audioBuffer.sampleRate);
        
        if (sampleIndex < channelData.length) {
            // Get frequency data for this time slice
            const slice = channelData.slice(sampleIndex, sampleIndex + fftSize);
            const frequencies = performFFT(slice, audioBuffer.sampleRate);
            
            samples.push({
                time,
                frequencies,
                dominantFrequency: findDominantFrequency(frequencies, binWidth)
            });
        }
    }
    
    // Calculate average spectrum
    const avgSpectrum = calculateAverageSpectrum(samples);
    
    return {
        samples,
        avgSpectrum,
        fftSize,
        binWidth,
        nyquist
    };
}

/**
 * Compute a real magnitude spectrum using a radix-2 Cooley-Tukey FFT.
 * Returns the first N/2 frequency bins (one-sided spectrum), where N is the
 * input length rounded up to the next power of two. Bin `k` corresponds to
 * frequency `k * sampleRate / N`.
 *
 * NOTE: The previous implementation computed the same total signal energy for
 * every frequency bucket (the per-band freqStart/freqEnd were never used), so
 * every bucket ended up identical. That silently broke instrument detection,
 * dominant-frequency detection and the average spectrum. This performs a real
 * FFT so each bin reflects the energy at its own frequency.
 */
function performFFT(samples, sampleRate) {
    // Round up to the next power of two for the radix-2 algorithm
    let size = 1;
    while (size < samples.length) size <<= 1;
    if (size < 2) {
        return new Float32Array(1);
    }

    // Separate real/imaginary arrays and zero-pad to `size`
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let i = 0; i < samples.length; i++) {
        real[i] = samples[i] || 0;
    }

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < size; i++) {
        let bit = size >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            const tr = real[i]; real[i] = real[j]; real[j] = tr;
            const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
        }
    }

    // Cooley-Tukey iterative butterfly
    for (let len = 2; len <= size; len <<= 1) {
        const half = len >> 1;
        const angle = -2 * Math.PI / len;
        const wReal = Math.cos(angle);
        const wImag = Math.sin(angle);
        for (let i = 0; i < size; i += len) {
            let curReal = 1;
            let curImag = 0;
            for (let k = 0; k < half; k++) {
                const idx = i + k;
                const idx2 = idx + half;
                const tReal = curReal * real[idx2] - curImag * imag[idx2];
                const tImag = curReal * imag[idx2] + curImag * real[idx2];
                real[idx2] = real[idx] - tReal;
                imag[idx2] = imag[idx] - tImag;
                real[idx] += tReal;
                imag[idx] += tImag;
                const nextReal = curReal * wReal - curImag * wImag;
                curImag = curReal * wImag + curImag * wReal;
                curReal = nextReal;
            }
        }
    }

    // One-sided magnitude spectrum (first size/2 bins)
    const bins = size >> 1;
    const frequencies = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
        frequencies[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / size;
    }

    return frequencies;
}

/**
 * Find dominant frequency in spectrum
 */
function findDominantFrequency(frequencies, binWidth) {
    let maxEnergy = 0;
    let maxBin = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
        if (frequencies[i] > maxEnergy) {
            maxEnergy = frequencies[i];
            maxBin = i;
        }
    }
    
    return {
        frequency: maxBin * binWidth,
        energy: maxEnergy
    };
}

/**
 * Calculate average frequency spectrum
 */
function calculateAverageSpectrum(samples) {
    if (samples.length === 0) return [];
    
    const buckets = samples[0].frequencies.length;
    const avg = new Float32Array(buckets);
    
    for (const sample of samples) {
        for (let i = 0; i < buckets; i++) {
            avg[i] += sample.frequencies[i];
        }
    }
    
    for (let i = 0; i < buckets; i++) {
        avg[i] /= samples.length;
    }
    
    return Array.from(avg);
}

/**
 * Detect instruments based on frequency analysis
 */
function detectInstruments(frequencyData) {
    const instruments = {};
    const { avgSpectrum, binWidth, nyquist } = frequencyData;
    
    for (const [key, instrument] of Object.entries(INSTRUMENT_RANGES)) {
        let totalEnergy = 0;
        let weightedEnergy = 0;
        
        for (const range of instrument.ranges) {
            const startBin = Math.floor(range.min / binWidth);
            const endBin = Math.floor(range.max / binWidth);
            
            for (let i = startBin; i < endBin && i < avgSpectrum.length; i++) {
                const energy = avgSpectrum[i];
                totalEnergy += energy;
                weightedEnergy += energy * range.weight;
            }
        }
        
        // Calculate presence score (0-100)
        const score = Math.min(100, weightedEnergy * 100);
        
        instruments[key] = {
            name: instrument.name,
            presence: score.toFixed(2),
            detected: score > 10, // Threshold for detection
            characteristics: instrument.characteristics
        };
    }
    
    return instruments;
}

/**
 * Detect peak moments (loud/intense parts)
 */
function detectPeaks(audioBuffer) {
    const peaks = [];
    const windowSize = Math.floor(audioBuffer.sampleRate * 0.1); // 100ms windows
    const threshold = 0.7; // Peak threshold
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        
        for (let i = 0; i < channelData.length; i += windowSize) {
            let energy = 0;
            let peakAmplitude = 0;
            
            for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) {
                const sample = Math.abs(channelData[i + j]);
                energy += sample * sample;
                peakAmplitude = Math.max(peakAmplitude, sample);
            }
            
            const rms = Math.sqrt(energy / windowSize);
            
            if (peakAmplitude > threshold || rms > threshold * 0.7) {
                const time = i / audioBuffer.sampleRate;
                peaks.push({
                    time: time.toFixed(3),
                    amplitude: peakAmplitude.toFixed(3),
                    rms: rms.toFixed(3),
                    type: peakAmplitude > 0.85 ? 'extreme' : 'high'
                });
            }
        }
    }
    
    // Merge nearby peaks
    return mergePeaks(peaks);
}

/**
 * Merge peaks that are close together
 */
function mergePeaks(peaks) {
    if (peaks.length === 0) return [];
    
    const merged = [];
    let current = peaks[0];
    
    for (let i = 1; i < peaks.length; i++) {
        if (parseFloat(peaks[i].time) - parseFloat(current.time) < 0.5) {
            // Merge with current
            current.amplitude = Math.max(current.amplitude, peaks[i].amplitude);
            current.rms = Math.max(current.rms, peaks[i].rms);
        } else {
            merged.push(current);
            current = peaks[i];
        }
    }
    merged.push(current);
    
    return merged;
}

/**
 * Detect emotional/goosebumps moments
 */
function detectEmotionalMoments(audioBuffer, frequencyData, peaks) {
    const moments = [];
    const windowSize = Math.floor(audioBuffer.sampleRate * 1.0); // 1 second windows
    
    for (let i = 0; i < audioBuffer.length; i += windowSize) {
        const time = i / audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        
        // Analyze this window
        const slice = channelData.slice(i, i + windowSize);
        
        // 1. Sudden dynamic change
        const dynamicChange = calculateDynamicChange(slice);
        
        // 2. Harmonic complexity
        const harmonicComplexity = calculateHarmonicComplexity(slice);
        
        // 3. Check if near peak
        const nearPeak = peaks.some(p => Math.abs(parseFloat(p.time) - time) < 1.0);
        
        // Calculate emotional score
        let score = 0;
        let factors = [];
        
        if (dynamicChange > 0.3) {
            score += 30;
            factors.push('dynamic-shift');
        }
        
        if (harmonicComplexity > 0.6) {
            score += 25;
            factors.push('harmonic-richness');
        }
        
        if (nearPeak) {
            score += 20;
            factors.push('peak-intensity');
        }
        
        // High frequency content (brightness = emotion)
        const brightness = calculateBrightness(slice);
        if (brightness > 0.5) {
            score += 15;
            factors.push('brightness');
        }
        
        // Energy buildup
        const energyBuildup = calculateEnergyBuildup(channelData, i, windowSize);
        if (energyBuildup > 0.4) {
            score += 10;
            factors.push('energy-buildup');
        }
        
        if (score > 40) {
            moments.push({
                time: time.toFixed(2),
                score: score,
                intensity: score > 70 ? 'extreme' : score > 55 ? 'high' : 'moderate',
                factors: factors,
                description: generateEmotionalDescription(factors, score)
            });
        }
    }
    
    return moments;
}

/**
 * Calculate dynamic change in audio
 */
function calculateDynamicChange(samples) {
    if (samples.length < 2) return 0;
    
    const firstHalf = samples.slice(0, samples.length / 2);
    const secondHalf = samples.slice(samples.length / 2);
    
    const rms1 = calculateRMS(firstHalf);
    const rms2 = calculateRMS(secondHalf);
    
    return Math.abs(rms2 - rms1);
}

/**
 * Calculate harmonic complexity
 */
function calculateHarmonicComplexity(samples) {
    let zeroCrossings = 0;
    
    for (let i = 1; i < samples.length; i++) {
        if ((samples[i] >= 0 && samples[i - 1] < 0) || 
            (samples[i] < 0 && samples[i - 1] >= 0)) {
            zeroCrossings++;
        }
    }
    
    // Normalize
    return Math.min(1.0, zeroCrossings / (samples.length * 0.1));
}

/**
 * Calculate brightness (high frequency content)
 */
function calculateBrightness(samples) {
    let highFreqEnergy = 0;
    
    for (let i = 0; i < samples.length - 1; i++) {
        const diff = samples[i + 1] - samples[i];
        highFreqEnergy += diff * diff;
    }
    
    return Math.min(1.0, Math.sqrt(highFreqEnergy / samples.length) * 10);
}

/**
 * Calculate energy buildup
 */
function calculateEnergyBuildup(channelData, start, windowSize) {
    const prevWindow = channelData.slice(Math.max(0, start - windowSize), start);
    const currentWindow = channelData.slice(start, start + windowSize);
    
    const prevEnergy = calculateRMS(prevWindow);
    const currentEnergy = calculateRMS(currentWindow);
    
    return Math.max(0, currentEnergy - prevEnergy);
}

/**
 * Calculate RMS (Root Mean Square)
 */
function calculateRMS(samples) {
    let sum = 0;
    for (const sample of samples) {
        sum += sample * sample;
    }
    return Math.sqrt(sum / samples.length);
}

/**
 * Generate emotional description
 */
function generateEmotionalDescription(factors, score) {
    if (score > 70) {
        return '🌟 Intense emotional peak - likely goosebumps moment!';
    } else if (score > 55) {
        return '✨ Strong emotional moment - high energy and dynamics';
    } else {
        return '💫 Moderate emotional content - notable musical moment';
    }
}

/**
 * Analyze overall dynamics
 */
function analyzeDynamics(audioBuffer) {
    let minAmplitude = Infinity;
    let maxAmplitude = -Infinity;
    let totalEnergy = 0;
    let sampleCount = 0;
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        
        for (const sample of channelData) {
            const abs = Math.abs(sample);
            minAmplitude = Math.min(minAmplitude, abs);
            maxAmplitude = Math.max(maxAmplitude, abs);
            totalEnergy += sample * sample;
            sampleCount++;
        }
    }
    
    const rms = Math.sqrt(totalEnergy / sampleCount);
    const dynamicRange = 20 * Math.log10(maxAmplitude / Math.max(0.0001, minAmplitude));
    const crestFactor = maxAmplitude / Math.max(0.0001, rms);
    
    return {
        minAmplitude: minAmplitude.toFixed(4),
        maxAmplitude: maxAmplitude.toFixed(4),
        rms: rms.toFixed(4),
        dynamicRange: dynamicRange.toFixed(2) + ' dB',
        crestFactor: crestFactor.toFixed(2),
        loudness: rms > 0.5 ? 'loud' : rms > 0.2 ? 'moderate' : 'quiet'
    };
}
