/**
 * Advanced Vocal Detection and Lyrics Alignment
 */

/**
 * Detect vocal sections in audio
 */
async function detectVocals(audioBuffer, instrumentData, progressCallback = null) {
    if (progressCallback) progressCallback(0, 'Analyzing vocal presence...');
    
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    
    // 1. Detect vocal sections based on frequency characteristics
    const vocalSections = detectVocalSections(channelData, sampleRate);
    
    if (progressCallback) progressCallback(50, 'Classifying vocal types...');
    
    // 2. Classify vocal types (singing vs speech)
    const classifiedSections = classifyVocalTypes(vocalSections, channelData, sampleRate);
    
    if (progressCallback) progressCallback(75, 'Analyzing vocal characteristics...');
    
    // 3. Analyze vocal characteristics
    const vocalCharacteristics = analyzeVocalCharacteristics(classifiedSections, audioBuffer);
    
    if (progressCallback) progressCallback(100, 'Vocal detection complete!');
    
    return {
        sections: classifiedSections,
        characteristics: vocalCharacteristics,
        totalVocalTime: calculateTotalVocalTime(classifiedSections),
        vocalDensity: calculateVocalDensity(classifiedSections, audioBuffer.duration),
        predominantType: getPredominantVocalType(classifiedSections)
    };
}

/**
 * Detect vocal sections using formant analysis
 */
function detectVocalSections(samples, sampleRate) {
    const windowSize = Math.floor(sampleRate * 0.5); // 500ms windows
    const hopSize = Math.floor(windowSize / 2); // 50% overlap
    const sections = [];
    
    for (let i = 0; i < samples.length - windowSize; i += hopSize) {
        const window = samples.slice(i, i + windowSize);
        const time = i / sampleRate;
        
        // Check for vocal characteristics
        const hasVocalFormants = checkVocalFormants(window, sampleRate);
        const hasVocalPitch = checkVocalPitchRange(window, sampleRate);
        const hasModulation = checkVocalModulation(window);
        
        // Score vocal likelihood
        let score = 0;
        if (hasVocalFormants) score += 0.4;
        if (hasVocalPitch) score += 0.4;
        if (hasModulation) score += 0.2;
        
        if (score > 0.6) {
            const endTime = (i + windowSize) / sampleRate;
            sections.push({
                startTime: time.toFixed(2),
                endTime: endTime.toFixed(2),
                score: score.toFixed(2),
                hasFormants: hasVocalFormants,
                hasPitch: hasVocalPitch,
                hasModulation: hasModulation
            });
        }
    }
    
    // Merge adjacent sections
    return mergeSections(sections);
}

/**
 * Check for vocal formants (resonances)
 */
function checkVocalFormants(samples, sampleRate) {
    // Vocal formants are typically at:
    // F1: 200-1000 Hz (vowel height)
    // F2: 600-3000 Hz (vowel frontness)
    // F3: 1500-4000 Hz (r-coloring)
    
    const fftSize = 1024;
    const spectrum = performSimpleFFT(samples.slice(0, fftSize));
    
    // Check for energy peaks in formant regions
    const f1Range = getEnergyInRange(spectrum, 200, 1000, sampleRate, fftSize);
    const f2Range = getEnergyInRange(spectrum, 600, 3000, sampleRate, fftSize);
    const f3Range = getEnergyInRange(spectrum, 1500, 4000, sampleRate, fftSize);
    
    // Vocals have strong energy in all three formant regions
    return (f1Range > 0.3 && f2Range > 0.3 && f3Range > 0.2);
}

/**
 * Check for vocal pitch range
 */
function checkVocalPitchRange(samples, sampleRate) {
    // Human voice fundamental frequency: 80-1100 Hz
    // Male: 80-180 Hz, Female: 165-255 Hz, Child: 250-400 Hz
    
    const dominantFreq = estimateDominantFrequency(samples, sampleRate);
    return (dominantFreq >= 80 && dominantFreq <= 1100);
}

/**
 * Check for vocal modulation (vibrato, pitch variation)
 */
function checkVocalModulation(samples) {
    // Calculate amplitude modulation rate
    const windowSize = 100;
    const numWindows = Math.floor(samples.length / windowSize);
    const amplitudes = [];
    
    for (let i = 0; i < numWindows; i++) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            sum += Math.abs(samples[i * windowSize + j]);
        }
        amplitudes.push(sum / windowSize);
    }
    
    // Check for modulation (variation in amplitude)
    const mean = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
    const variance = amplitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amplitudes.length;
    
    // Vocals typically have moderate modulation
    return (variance > 0.01 && variance < 0.5);
}

/**
 * Simple FFT for frequency analysis
 */
function performSimpleFFT(samples) {
    const spectrum = new Float32Array(samples.length / 2);
    
    for (let i = 0; i < spectrum.length; i++) {
        let real = 0;
        let imag = 0;
        
        for (let j = 0; j < samples.length; j++) {
            const angle = (2 * Math.PI * i * j) / samples.length;
            real += samples[j] * Math.cos(angle);
            imag += samples[j] * Math.sin(angle);
        }
        
        spectrum[i] = Math.sqrt(real * real + imag * imag) / samples.length;
    }
    
    return spectrum;
}

/**
 * Get energy in frequency range
 */
function getEnergyInRange(spectrum, minFreq, maxFreq, sampleRate, fftSize) {
    const minBin = Math.floor(minFreq * fftSize / sampleRate);
    const maxBin = Math.floor(maxFreq * fftSize / sampleRate);
    
    let energy = 0;
    for (let i = minBin; i < maxBin && i < spectrum.length; i++) {
        energy += spectrum[i];
    }
    
    return energy / (maxBin - minBin);
}

/**
 * Estimate dominant frequency
 */
function estimateDominantFrequency(samples, sampleRate) {
    const spectrum = performSimpleFFT(samples.slice(0, 1024));
    
    let maxEnergy = 0;
    let maxBin = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > maxEnergy) {
            maxEnergy = spectrum[i];
            maxBin = i;
        }
    }
    
    return (maxBin * sampleRate) / 1024;
}

/**
 * Merge adjacent vocal sections
 */
function mergeSections(sections) {
    if (sections.length === 0) return [];
    
    const merged = [];
    // Start with a copy of the first section. Each section already carries its
    // own endTime (set in detectVocalSections); keep it rather than resetting
    // it to startTime, which previously produced zero-length sections.
    let current = { ...sections[0] };
    
    for (let i = 1; i < sections.length; i++) {
        const gap = parseFloat(sections[i].startTime) - parseFloat(current.endTime);
        
        if (gap < 1.0) { // Merge if gap less than 1 second
            // Extend the merged section's end to the later section's end time
            if (parseFloat(sections[i].endTime) > parseFloat(current.endTime)) {
                current.endTime = sections[i].endTime;
            }
        } else {
            merged.push(current);
            current = { ...sections[i] };
        }
    }
    
    merged.push(current);
    return merged;
}

/**
 * Classify vocal types (singing vs speech)
 */
function classifyVocalTypes(sections, samples, sampleRate) {
    return sections.map(section => {
        const start = Math.floor(parseFloat(section.startTime) * sampleRate);
        const end = Math.floor(parseFloat(section.endTime) * sampleRate);
        const segment = samples.slice(start, end);
        
        // Singing has more pitch variation and sustained notes
        const pitchVariation = analyzePitchVariation(segment, sampleRate);
        const sustainedNotes = checkSustainedNotes(segment);
        
        let type;
        let confidence;
        
        if (pitchVariation > 0.6 && sustainedNotes) {
            type = 'singing';
            confidence = 0.8;
        } else if (pitchVariation < 0.3) {
            type = 'speech';
            confidence = 0.7;
        } else {
            type = 'mixed';
            confidence = 0.5;
        }
        
        return {
            ...section,
            type,
            confidence: confidence.toFixed(2),
            duration: (parseFloat(section.endTime) - parseFloat(section.startTime)).toFixed(2)
        };
    });
}

/**
 * Analyze pitch variation
 */
function analyzePitchVariation(samples, sampleRate) {
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const pitches = [];
    
    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
        const window = samples.slice(i, i + windowSize);
        pitches.push(estimateDominantFrequency(window, sampleRate));
    }
    
    if (pitches.length < 2) return 0;
    
    const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pitches.length;
    
    // Normalize to 0-1
    return Math.min(1.0, Math.sqrt(variance) / mean);
}

/**
 * Check for sustained notes (characteristic of singing)
 */
function checkSustainedNotes(samples) {
    const windowSize = 1000;
    let sustainedCount = 0;
    
    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
        const window = samples.slice(i, i + windowSize);
        
        // Calculate amplitude stability
        const amplitudes = window.map(s => Math.abs(s));
        const mean = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
        const variance = amplitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amplitudes.length;
        
        // Sustained notes have low variance
        if (variance < 0.01 && mean > 0.1) {
            sustainedCount++;
        }
    }
    
    return sustainedCount > (samples.length / windowSize) * 0.3; // 30% threshold
}

/**
 * Analyze vocal characteristics
 */
function analyzeVocalCharacteristics(sections, audioBuffer) {
    const singingCount = sections.filter(s => s.type === 'singing').length;
    const speechCount = sections.filter(s => s.type === 'speech').length;
    
    // Calculate average confidence
    const avgConfidence = sections.reduce((sum, s) => sum + parseFloat(s.confidence), 0) / sections.length;
    
    return {
        totalSections: sections.length,
        singingSections: singingCount,
        speechSections: speechCount,
        averageConfidence: avgConfidence.toFixed(2),
        vocalQuality: avgConfidence > 0.7 ? 'high' : avgConfidence > 0.5 ? 'medium' : 'low'
    };
}

/**
 * Calculate total vocal time
 */
function calculateTotalVocalTime(sections) {
    const total = sections.reduce((sum, section) => {
        return sum + (parseFloat(section.endTime) - parseFloat(section.startTime));
    }, 0);
    
    return total.toFixed(2);
}

/**
 * Calculate vocal density (% of song with vocals)
 */
function calculateVocalDensity(sections, duration) {
    const totalVocalTime = calculateTotalVocalTime(sections);
    const density = (parseFloat(totalVocalTime) / duration) * 100;
    return density.toFixed(1) + '%';
}

/**
 * Get predominant vocal type
 */
function getPredominantVocalType(sections) {
    const counts = {
        singing: 0,
        speech: 0,
        mixed: 0
    };
    
    sections.forEach(section => {
        counts[section.type]++;
    });
    
    const max = Math.max(counts.singing, counts.speech, counts.mixed);
    
    if (counts.singing === max) return 'singing';
    if (counts.speech === max) return 'speech';
    return 'mixed';
}

/**
 * Create lyrics alignment timestamps (placeholder for future integration)
 */
function prepareLyricsAlignment(vocalSections) {
    return vocalSections.map(section => ({
        startTime: section.startTime,
        endTime: section.endTime,
        type: section.type,
        // Future: integrate with lyrics API or manual alignment
        lyricLine: null,
        confidence: section.confidence
    }));
}
