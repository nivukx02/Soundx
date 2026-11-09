/**
 * Advanced BPM and Tempo Detection
 * Uses autocorrelation and onset detection
 */

/**
 * Detect BPM (Beats Per Minute) from audio buffer
 */
async function detectBPM(audioBuffer, progressCallback = null) {
    if (progressCallback) progressCallback(0, 'Analyzing tempo...');
    
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    
    // 1. Calculate onset strength envelope
    const onsetEnvelope = calculateOnsetEnvelope(channelData, sampleRate);
    
    if (progressCallback) progressCallback(30, 'Detecting beats...');
    
    // 2. Find tempo using autocorrelation
    const tempo = estimateTempo(onsetEnvelope, sampleRate);
    
    if (progressCallback) progressCallback(60, 'Building beat grid...');
    
    // 3. Detect individual beats
    const beats = detectBeats(onsetEnvelope, sampleRate, tempo.bpm);
    
    if (progressCallback) progressCallback(90, 'Analyzing time signature...');
    
    // 4. Detect time signature
    const timeSignature = detectTimeSignature(beats, tempo.bpm);
    
    if (progressCallback) progressCallback(100, 'Tempo analysis complete!');
    
    return {
        bpm: Math.round(tempo.bpm * 10) / 10,
        confidence: tempo.confidence,
        beats: beats,
        timeSignature: timeSignature,
        beatGrid: generateBeatGrid(beats, tempo.bpm, audioBuffer.duration),
        genre: classifyGenreFromTempo(tempo.bpm)
    };
}

/**
 * Calculate onset strength envelope using spectral flux
 */
function calculateOnsetEnvelope(samples, sampleRate) {
    const hopSize = 512;
    const fftSize = 2048;
    const numHops = Math.floor(samples.length / hopSize);
    const envelope = new Float32Array(numHops);
    
    let prevSpectrum = new Float32Array(fftSize / 2);
    
    for (let i = 0; i < numHops; i++) {
        const start = i * hopSize;
        const frame = samples.slice(start, start + fftSize);
        
        // Simple magnitude spectrum
        const spectrum = calculateMagnitudeSpectrum(frame);
        
        // Spectral flux (difference from previous frame)
        let flux = 0;
        for (let j = 0; j < spectrum.length; j++) {
            const diff = spectrum[j] - prevSpectrum[j];
            flux += diff > 0 ? diff : 0; // Half-wave rectification
        }
        
        envelope[i] = flux;
        prevSpectrum = spectrum;
    }
    
    // Normalize
    const max = Math.max(...envelope);
    if (max > 0) {
        for (let i = 0; i < envelope.length; i++) {
            envelope[i] /= max;
        }
    }
    
    return envelope;
}

/**
 * Calculate magnitude spectrum
 */
function calculateMagnitudeSpectrum(frame) {
    const fftSize = frame.length;
    const spectrum = new Float32Array(fftSize / 2);
    
    // Simple energy calculation per frequency band
    for (let i = 0; i < fftSize / 2; i++) {
        let energy = 0;
        const start = i * 2;
        const end = Math.min(start + 2, fftSize);
        
        for (let j = start; j < end; j++) {
            energy += frame[j] * frame[j];
        }
        
        spectrum[i] = Math.sqrt(energy);
    }
    
    return spectrum;
}

/**
 * Estimate tempo using autocorrelation
 */
function estimateTempo(onsetEnvelope, sampleRate) {
    const hopSize = 512;
    const timePerFrame = hopSize / sampleRate;
    
    // BPM range: 60-180
    const minBPM = 60;
    const maxBPM = 180;
    
    const minLag = Math.floor(60 / maxBPM / timePerFrame);
    const maxLag = Math.floor(60 / minBPM / timePerFrame);
    
    // Calculate autocorrelation
    let maxCorr = 0;
    let bestLag = 0;
    
    for (let lag = minLag; lag < maxLag && lag < onsetEnvelope.length / 2; lag++) {
        let corr = 0;
        let count = 0;
        
        for (let i = 0; i < onsetEnvelope.length - lag; i++) {
            corr += onsetEnvelope[i] * onsetEnvelope[i + lag];
            count++;
        }
        
        corr /= count;
        
        if (corr > maxCorr) {
            maxCorr = corr;
            bestLag = lag;
        }
    }
    
    const bpm = 60 / (bestLag * timePerFrame);
    const confidence = Math.min(1.0, maxCorr * 2); // Scale to 0-1
    
    return { bpm, confidence };
}

/**
 * Detect individual beat positions
 */
function detectBeats(onsetEnvelope, sampleRate, estimatedBPM) {
    const hopSize = 512;
    const timePerFrame = hopSize / sampleRate;
    const avgBeatInterval = 60 / estimatedBPM / timePerFrame;
    
    const beats = [];
    const threshold = 0.3; // Peak threshold
    
    // Simple peak picking with dynamic threshold
    for (let i = 1; i < onsetEnvelope.length - 1; i++) {
        const curr = onsetEnvelope[i];
        const prev = onsetEnvelope[i - 1];
        const next = onsetEnvelope[i + 1];
        
        // Check if it's a local maximum above threshold
        if (curr > prev && curr > next && curr > threshold) {
            const time = i * timePerFrame;
            
            // Avoid beats too close together
            if (beats.length === 0 || (i - beats[beats.length - 1].frame) > avgBeatInterval * 0.5) {
                beats.push({
                    time: time.toFixed(3),
                    frame: i,
                    strength: curr.toFixed(3)
                });
            }
        }
    }
    
    return beats;
}

/**
 * Detect time signature (4/4, 3/4, 6/8, etc.)
 */
function detectTimeSignature(beats, bpm) {
    if (beats.length < 8) {
        return { numerator: 4, denominator: 4, confidence: 0.5 };
    }
    
    // Calculate inter-beat intervals
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
        const interval = parseFloat(beats[i].time) - parseFloat(beats[i - 1].time);
        intervals.push(interval);
    }
    
    // Expected beat interval for 4/4
    const expectedInterval = 60 / bpm;
    
    // Count beats that match downbeat patterns
    let fourFourScore = 0;
    let threeFourScore = 0;
    let sixEightScore = 0;
    
    for (let i = 0; i < beats.length; i++) {
        const strength = parseFloat(beats[i].strength);
        
        // Every 4th beat should be stronger in 4/4
        if (i % 4 === 0 && strength > 0.6) fourFourScore += strength;
        
        // Every 3rd beat should be stronger in 3/4
        if (i % 3 === 0 && strength > 0.6) threeFourScore += strength;
        
        // Different pattern for 6/8
        if (i % 6 === 0 && strength > 0.6) sixEightScore += strength;
    }
    
    // Determine most likely time signature
    const scores = [
        { sig: { numerator: 4, denominator: 4 }, score: fourFourScore },
        { sig: { numerator: 3, denominator: 4 }, score: threeFourScore },
        { sig: { numerator: 6, denominator: 8 }, score: sixEightScore }
    ];
    
    scores.sort((a, b) => b.score - a.score);
    
    const confidence = scores[0].score / (scores[0].score + scores[1].score + scores[2].score);
    
    return {
        ...scores[0].sig,
        confidence: confidence.toFixed(2)
    };
}

/**
 * Generate beat grid for visualization
 */
function generateBeatGrid(beats, bpm, duration) {
    const beatInterval = 60 / bpm;
    const grid = [];
    
    let currentTime = 0;
    let beatIndex = 0;
    
    while (currentTime < duration) {
        const isDetectedBeat = beats.some(beat => 
            Math.abs(parseFloat(beat.time) - currentTime) < beatInterval * 0.1
        );
        
        grid.push({
            time: currentTime.toFixed(3),
            beat: beatIndex % 4 + 1,
            measure: Math.floor(beatIndex / 4) + 1,
            isDownbeat: beatIndex % 4 === 0,
            isDetected: isDetectedBeat
        });
        
        currentTime += beatInterval;
        beatIndex++;
    }
    
    return grid;
}

/**
 * Classify genre based on tempo
 */
function classifyGenreFromTempo(bpm) {
    if (bpm < 70) return 'Ballad/Slow';
    if (bpm < 90) return 'Hip-Hop/R&B';
    if (bpm < 110) return 'Pop/Rock';
    if (bpm < 130) return 'Dance/House';
    if (bpm < 150) return 'Techno/Trance';
    return 'Drum & Bass/Hardcore';
}

/**
 * Detect musical key using Krumhansl-Schmuckler algorithm
 */
async function detectMusicalKey(audioBuffer, progressCallback = null) {
    if (progressCallback) progressCallback(0, 'Analyzing pitch content...');
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // 1. Extract chroma features (pitch class profile)
    const chromagram = calculateChromagram(channelData, sampleRate);
    
    if (progressCallback) progressCallback(50, 'Calculating key correlations...');
    
    // 2. Correlate with key profiles
    const keyResult = correlateWithKeyProfiles(chromagram);
    
    if (progressCallback) progressCallback(100, 'Key detection complete!');
    
    return keyResult;
}

/**
 * Calculate chromagram (12-bin pitch class profile)
 */
function calculateChromagram(samples, sampleRate) {
    const chromagram = new Float32Array(12); // 12 pitch classes
    const hopSize = 4096;
    const numHops = Math.floor(samples.length / hopSize);
    
    for (let hop = 0; hop < numHops; hop++) {
        const start = hop * hopSize;
        const frame = samples.slice(start, start + hopSize);
        
        // Simple pitch detection by finding dominant frequencies
        for (let note = 0; note < 12; note++) {
            let energy = 0;
            
            // Check multiple octaves for this pitch class
            for (let octave = 2; octave < 7; octave++) {
                const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
                const bin = Math.round(freq * hopSize / sampleRate);
                
                if (bin < frame.length) {
                    energy += Math.abs(frame[bin]);
                }
            }
            
            chromagram[note] += energy;
        }
    }
    
    // Normalize
    const max = Math.max(...chromagram);
    if (max > 0) {
        for (let i = 0; i < 12; i++) {
            chromagram[i] /= max;
        }
    }
    
    return chromagram;
}

/**
 * Correlate chromagram with key profiles (Krumhansl-Schmuckler)
 */
function correlateWithKeyProfiles(chromagram) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Major and minor key profiles (simplified)
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    
    let maxCorr = -Infinity;
    let bestKey = { note: 'C', mode: 'major', correlation: 0 };
    
    // Try all 12 major and 12 minor keys
    for (let root = 0; root < 12; root++) {
        // Major
        let majorCorr = correlate(chromagram, rotateArray(majorProfile, root));
        if (majorCorr > maxCorr) {
            maxCorr = majorCorr;
            bestKey = {
                note: notes[root],
                mode: 'major',
                correlation: majorCorr.toFixed(3),
                confidence: (majorCorr / 6.35).toFixed(2) // Normalize
            };
        }
        
        // Minor
        let minorCorr = correlate(chromagram, rotateArray(minorProfile, root));
        if (minorCorr > maxCorr) {
            maxCorr = minorCorr;
            bestKey = {
                note: notes[root],
                mode: 'minor',
                correlation: minorCorr.toFixed(3),
                confidence: (minorCorr / 6.33).toFixed(2)
            };
        }
    }
    
    return bestKey;
}

/**
 * Calculate correlation between two arrays
 */
function correlate(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

/**
 * Rotate array (for transposing key profiles)
 */
function rotateArray(arr, n) {
    const result = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        result[i] = arr[(i + n) % arr.length];
    }
    return result;
}
