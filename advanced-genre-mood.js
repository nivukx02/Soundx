/**
 * Advanced Genre and Mood Classification
 * ML-based classification using audio features
 */

/**
 * Classify genre using multiple audio features
 */
async function classifyGenre(audioBuffer, tempoData, frequencyData, progressCallback = null) {
    if (progressCallback) progressCallback(0, 'Extracting genre features...');
    
    // Extract features for genre classification
    const features = {
        tempo: tempoData.bpm,
        spectral: analyzeSpectralCharacteristics(frequencyData),
        rhythm: analyzeRhythmicComplexity(tempoData),
        energy: calculateEnergyLevel(audioBuffer),
        timbre: analyzeTimbre(audioBuffer)
    };
    
    if (progressCallback) progressCallback(50, 'Classifying genre...');
    
    // Score against genre profiles
    const genreScores = scoreGenres(features);
    
    if (progressCallback) progressCallback(100, 'Genre classification complete!');
    
    return {
        primary: genreScores[0],
        secondary: genreScores[1],
        tertiary: genreScores[2],
        allScores: genreScores,
        confidence: genreScores[0].confidence
    };
}

/**
 * Genre profiles with characteristic features
 */
const GENRE_PROFILES = {
    'Classical': {
        tempo: { min: 60, max: 140, optimal: 100 },
        spectralCentroid: { min: 1500, max: 4000 },
        spectralRolloff: { min: 4000, max: 8000 },
        energyVariance: { min: 0.3, max: 0.8 },
        rhythmComplexity: { min: 0.2, max: 0.6 },
        instruments: ['strings', 'keyboard', 'wind']
    },
    'Rock': {
        tempo: { min: 100, max: 160, optimal: 130 },
        spectralCentroid: { min: 2000, max: 6000 },
        spectralRolloff: { min: 6000, max: 12000 },
        energyVariance: { min: 0.5, max: 0.9 },
        rhythmComplexity: { min: 0.4, max: 0.7 },
        instruments: ['strings', 'percussion', 'electronic']
    },
    'Electronic/EDM': {
        tempo: { min: 120, max: 150, optimal: 128 },
        spectralCentroid: { min: 3000, max: 8000 },
        spectralRolloff: { min: 8000, max: 16000 },
        energyVariance: { min: 0.6, max: 1.0 },
        rhythmComplexity: { min: 0.6, max: 1.0 },
        instruments: ['electronic', 'percussion']
    },
    'Hip-Hop/Rap': {
        tempo: { min: 70, max: 110, optimal: 90 },
        spectralCentroid: { min: 1500, max: 5000 },
        spectralRolloff: { min: 5000, max: 10000 },
        energyVariance: { min: 0.4, max: 0.7 },
        rhythmComplexity: { min: 0.5, max: 0.8 },
        instruments: ['percussion', 'vocal', 'electronic']
    },
    'Pop': {
        tempo: { min: 100, max: 130, optimal: 120 },
        spectralCentroid: { min: 2000, max: 5000 },
        spectralRolloff: { min: 5000, max: 10000 },
        energyVariance: { min: 0.4, max: 0.7 },
        rhythmComplexity: { min: 0.3, max: 0.6 },
        instruments: ['vocal', 'electronic', 'strings']
    },
    'Jazz': {
        tempo: { min: 80, max: 180, optimal: 120 },
        spectralCentroid: { min: 1800, max: 5000 },
        spectralRolloff: { min: 5000, max: 10000 },
        energyVariance: { min: 0.3, max: 0.7 },
        rhythmComplexity: { min: 0.6, max: 0.9 },
        instruments: ['wind', 'keyboard', 'percussion']
    },
    'Metal': {
        tempo: { min: 120, max: 200, optimal: 160 },
        spectralCentroid: { min: 2500, max: 7000 },
        spectralRolloff: { min: 7000, max: 14000 },
        energyVariance: { min: 0.7, max: 1.0 },
        rhythmComplexity: { min: 0.6, max: 0.9 },
        instruments: ['strings', 'percussion', 'electronic']
    },
    'Country': {
        tempo: { min: 90, max: 140, optimal: 120 },
        spectralCentroid: { min: 1800, max: 4500 },
        spectralRolloff: { min: 4500, max: 9000 },
        energyVariance: { min: 0.3, max: 0.6 },
        rhythmComplexity: { min: 0.3, max: 0.6 },
        instruments: ['strings', 'vocal', 'keyboard']
    },
    'R&B/Soul': {
        tempo: { min: 70, max: 110, optimal: 90 },
        spectralCentroid: { min: 1500, max: 4500 },
        spectralRolloff: { min: 4500, max: 9000 },
        energyVariance: { min: 0.3, max: 0.6 },
        rhythmComplexity: { min: 0.4, max: 0.7 },
        instruments: ['vocal', 'keyboard', 'strings']
    },
    'Reggae': {
        tempo: { min: 60, max: 90, optimal: 75 },
        spectralCentroid: { min: 1500, max: 4000 },
        spectralRolloff: { min: 4000, max: 8000 },
        energyVariance: { min: 0.3, max: 0.6 },
        rhythmComplexity: { min: 0.5, max: 0.8 },
        instruments: ['percussion', 'strings', 'keyboard']
    }
};

/**
 * Analyze spectral characteristics
 */
function analyzeSpectralCharacteristics(frequencyData) {
    const avgSpectrum = frequencyData.avgSpectrum;
    
    // Spectral centroid (brightness)
    let centroid = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < avgSpectrum.length; i++) {
        centroid += i * avgSpectrum[i];
        totalEnergy += avgSpectrum[i];
    }
    
    centroid = (centroid / totalEnergy) * (frequencyData.nyquist / avgSpectrum.length);
    
    // Spectral rolloff (90% of energy)
    let cumulativeEnergy = 0;
    let rolloff = avgSpectrum.length - 1;
    const targetEnergy = totalEnergy * 0.9;
    
    for (let i = 0; i < avgSpectrum.length; i++) {
        cumulativeEnergy += avgSpectrum[i];
        if (cumulativeEnergy >= targetEnergy) {
            rolloff = i;
            break;
        }
    }
    
    rolloff = rolloff * (frequencyData.nyquist / avgSpectrum.length);
    
    return {
        centroid: Math.round(centroid),
        rolloff: Math.round(rolloff),
        brightness: centroid / frequencyData.nyquist
    };
}

/**
 * Analyze rhythmic complexity
 */
function analyzeRhythmicComplexity(tempoData) {
    if (!tempoData.beats || tempoData.beats.length < 2) {
        return 0.5;
    }
    
    // Calculate inter-beat interval variance
    const intervals = [];
    for (let i = 1; i < tempoData.beats.length; i++) {
        intervals.push(parseFloat(tempoData.beats[i].time) - parseFloat(tempoData.beats[i - 1].time));
    }
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    
    // Normalize to 0-1
    return Math.min(1.0, variance * 10);
}

/**
 * Calculate overall energy level
 */
function calculateEnergyLevel(audioBuffer) {
    let totalEnergy = 0;
    let sampleCount = 0;
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (const sample of channelData) {
            totalEnergy += sample * sample;
            sampleCount++;
        }
    }
    
    return Math.sqrt(totalEnergy / sampleCount);
}

/**
 * Analyze timbre characteristics
 */
function analyzeTimbre(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const windowSize = 2048;
    const numWindows = Math.floor(channelData.length / windowSize);
    
    let zcr = 0; // Zero crossing rate
    
    for (let w = 0; w < Math.min(numWindows, 100); w++) {
        const start = w * windowSize;
        for (let i = start + 1; i < start + windowSize; i++) {
            if ((channelData[i] >= 0 && channelData[i - 1] < 0) ||
                (channelData[i] < 0 && channelData[i - 1] >= 0)) {
                zcr++;
            }
        }
    }
    
    return {
        zeroCrossingRate: zcr / (windowSize * Math.min(numWindows, 100)),
        roughness: zcr / (windowSize * Math.min(numWindows, 100)) > 0.1 ? 'high' : 'low'
    };
}

/**
 * Score features against genre profiles
 */
function scoreGenres(features) {
    const scores = [];
    
    for (const [genreName, profile] of Object.entries(GENRE_PROFILES)) {
        let score = 0;
        let factors = [];
        
        // Tempo match (30% weight)
        const tempoScore = scoreFeature(features.tempo, profile.tempo.min, profile.tempo.max, profile.tempo.optimal);
        score += tempoScore * 0.3;
        if (tempoScore > 0.7) factors.push('tempo-match');
        
        // Spectral centroid (25% weight)
        const centroidScore = scoreFeature(features.spectral.centroid, profile.spectralCentroid.min, profile.spectralCentroid.max);
        score += centroidScore * 0.25;
        if (centroidScore > 0.7) factors.push('spectral-match');
        
        // Spectral rolloff (20% weight)
        const rolloffScore = scoreFeature(features.spectral.rolloff, profile.spectralRolloff.min, profile.spectralRolloff.max);
        score += rolloffScore * 0.2;
        
        // Rhythm complexity (15% weight)
        const rhythmScore = scoreFeature(features.rhythm, profile.rhythmComplexity.min, profile.rhythmComplexity.max);
        score += rhythmScore * 0.15;
        if (rhythmScore > 0.7) factors.push('rhythm-match');
        
        // Energy variance (10% weight)
        const energyScore = scoreFeature(features.energy, profile.energyVariance.min, profile.energyVariance.max);
        score += energyScore * 0.1;
        
        scores.push({
            genre: genreName,
            score: score.toFixed(3),
            confidence: (score * 100).toFixed(1) + '%',
            factors: factors
        });
    }
    
    // Sort by score
    scores.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    
    return scores;
}

/**
 * Score individual feature against range
 */
function scoreFeature(value, min, max, optimal = null) {
    if (value < min || value > max) {
        // Outside range - penalize based on distance
        const distance = value < min ? min - value : value - max;
        const range = max - min;
        return Math.max(0, 1 - (distance / range));
    }
    
    if (optimal) {
        // Within range - score based on distance from optimal
        const distance = Math.abs(value - optimal);
        const maxDistance = Math.max(optimal - min, max - optimal);
        return 1 - (distance / maxDistance) * 0.3; // At least 0.7 if in range
    }
    
    return 1.0; // Perfect if in range and no optimal
}

/**
 * Classify mood using valence-arousal model
 */
async function classifyMood(audioBuffer, genreData, tempoData, emotionalMarkers, progressCallback = null) {
    if (progressCallback) progressCallback(0, 'Analyzing mood features...');
    
    // Calculate valence (happiness/sadness) and arousal (energy level)
    const valence = calculateValence(audioBuffer, genreData);
    const arousal = calculateArousal(audioBuffer, tempoData);
    
    if (progressCallback) progressCallback(50, 'Determining mood...');
    
    // Map to mood categories
    const mood = determineMood(valence, arousal, emotionalMarkers);
    
    if (progressCallback) progressCallback(100, 'Mood classification complete!');
    
    return mood;
}

/**
 * Calculate valence (positive/negative emotion)
 */
function calculateValence(audioBuffer, genreData) {
    let valence = 0.5; // Neutral baseline
    
    // Major keys = more positive
    if (genreData && genreData.key && genreData.key.mode === 'major') {
        valence += 0.2;
    } else if (genreData && genreData.key && genreData.key.mode === 'minor') {
        valence -= 0.2;
    }
    
    // Higher frequencies = more positive
    const channelData = audioBuffer.getChannelData(0);
    let highFreqEnergy = 0;
    let lowFreqEnergy = 0;
    
    for (let i = 0; i < Math.min(44100, channelData.length); i++) {
        const sample = channelData[i];
        if (i % 10 < 5) {
            highFreqEnergy += sample * sample;
        } else {
            lowFreqEnergy += sample * sample;
        }
    }
    
    if (highFreqEnergy > lowFreqEnergy * 1.2) {
        valence += 0.1;
    } else if (lowFreqEnergy > highFreqEnergy * 1.2) {
        valence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, valence));
}

/**
 * Calculate arousal (energy/intensity level)
 */
function calculateArousal(audioBuffer, tempoData) {
    let arousal = 0.5; // Neutral baseline
    
    // Higher tempo = higher arousal
    if (tempoData.bpm > 130) {
        arousal += 0.3;
    } else if (tempoData.bpm < 80) {
        arousal -= 0.3;
    }
    
    // Calculate RMS energy
    let totalEnergy = 0;
    let sampleCount = 0;
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (const sample of channelData) {
            totalEnergy += sample * sample;
            sampleCount++;
        }
    }
    
    const rms = Math.sqrt(totalEnergy / sampleCount);
    arousal += (rms - 0.1) * 2; // Adjust based on energy
    
    return Math.max(0, Math.min(1, arousal));
}

/**
 * Determine mood category from valence-arousal
 */
function determineMood(valence, arousal, emotionalMarkers) {
    const moods = [];
    
    // Primary mood (valence-arousal quadrants)
    let primary;
    if (valence > 0.6 && arousal > 0.6) {
        primary = 'Happy/Excited';
    } else if (valence > 0.6 && arousal <= 0.6) {
        primary = 'Peaceful/Relaxed';
    } else if (valence <= 0.4 && arousal > 0.6) {
        primary = 'Angry/Tense';
    } else if (valence <= 0.4 && arousal <= 0.4) {
        primary = 'Sad/Melancholic';
    } else {
        primary = 'Neutral/Balanced';
    }
    
    moods.push(primary);
    
    // Secondary descriptors
    if (valence > 0.7) moods.push('Uplifting');
    if (valence < 0.3) moods.push('Dark');
    if (arousal > 0.8) moods.push('Energetic');
    if (arousal < 0.2) moods.push('Calm');
    
    // Check emotional markers
    if (emotionalMarkers && emotionalMarkers.length > 3) {
        moods.push('Emotional');
    }
    
    return {
        primary: primary,
        valence: valence.toFixed(2),
        arousal: arousal.toFixed(2),
        descriptors: moods,
        quadrant: getQuadrant(valence, arousal)
    };
}

/**
 * Get valence-arousal quadrant
 */
function getQuadrant(valence, arousal) {
    if (valence > 0.5 && arousal > 0.5) return 'Q1 (High Valence, High Arousal)';
    if (valence <= 0.5 && arousal > 0.5) return 'Q2 (Low Valence, High Arousal)';
    if (valence <= 0.5 && arousal <= 0.5) return 'Q3 (Low Valence, Low Arousal)';
    return 'Q4 (High Valence, Low Arousal)';
}
