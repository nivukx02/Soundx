/**
 * NIV Audio Codec Web App
 * Main application logic
 */

let encodeFileData = null;
let decodeFileData = null;
let infoFileData = null;
let audioContext = null;

// Check browser compatibility on load
window.addEventListener('DOMContentLoaded', () => {
    console.log('%c🎵 NIV Audio Codec Web App', 'font-size: 20px; font-weight: bold; color: #667eea');
    console.log('%cVersion 1.0.0', 'color: #6c757d');
    
    // Check for required APIs
    const hasCompressionStreams = typeof CompressionStream !== 'undefined';
    const hasWebAudio = typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined';
    
    console.log('\n🔍 Browser Compatibility Check:');
    console.log(`   CompressionStream API: ${hasCompressionStreams ? '✓' : '✗'}`);
    console.log(`   Web Audio API: ${hasWebAudio ? '✓' : '✗'}`);
    
    if (!hasCompressionStreams) {
        showGlobalError('Your browser does not support CompressionStream API. Please use Chrome 80+ or Edge 80+');
    }
    if (!hasWebAudio) {
        showGlobalError('Your browser does not support Web Audio API.');
    }
    
    if (hasCompressionStreams && hasWebAudio) {
        console.log('\n✅ All required APIs are available!');
        console.log('\n📝 Ready to encode/decode audio files.\n');
    }
});

// Show global error
function showGlobalError(message) {
    console.error('❌ ' + message);
    // Could add a visible alert here if needed
}

// Initialize Audio Context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Tab switching
function switchTab(tabName, event) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If no event, find and activate the tab button
        document.querySelectorAll('.tab').forEach((tab, index) => {
            const tabs = ['encode', 'decode', 'info'];
            if (tabs[index] === tabName) {
                tab.classList.add('active');
            }
        });
    }
    
    // Reset results
    hideResult('encode');
    hideResult('decode');
    hideResult('info');
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Show progress
function showProgress(type, percent, text) {
    const progressContainer = document.getElementById(`${type}-progress`);
    const progressFill = document.getElementById(`${type}-progress-fill`);
    const progressText = document.getElementById(`${type}-progress-text`);
    
    progressContainer.classList.add('show');
    progressFill.style.width = `${percent}%`;
    progressFill.textContent = `${percent}%`;
    progressText.textContent = text;
}

// Hide progress
function hideProgress(type) {
    const progressContainer = document.getElementById(`${type}-progress`);
    progressContainer.classList.remove('show');
}

// Show result
function showResult(type, title, message, isError = false, downloadData = null) {
    const result = document.getElementById(`${type}-result`);
    result.className = 'result show' + (isError ? ' error' : '');
    
    let html = `
        <div class="result-title">${title}</div>
        <div class="result-message">${message}</div>
    `;
    
    if (downloadData) {
        html += `<button class="download-button" onclick="downloadFile('${type}')">📥 Download File</button>`;
        window[`${type}DownloadData`] = downloadData;
    }
    
    result.innerHTML = html;
}

// Hide result
function hideResult(type) {
    const result = document.getElementById(`${type}-result`);
    result.classList.remove('show');
}

// Download file
function downloadFile(type) {
    const data = window[`${type}DownloadData`];
    if (!data) return;
    
    const blob = new Blob([data.buffer], { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== ENCODE TAB ====================

async function handleEncodeFile(file) {
    if (!file) return;
    
    hideResult('encode');
    showProgress('encode', 10, 'Reading file...');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const ctx = initAudioContext();
        
        showProgress('encode', 30, 'Decoding audio...');
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        encodeFileData = {
            file: file,
            audioBuffer: audioBuffer,
            metadata: {
                originalFormat: file.type || 'unknown',
                fileName: file.name
            }
        };
        
        // Display file info
        document.getElementById('encode-filename').textContent = file.name;
        document.getElementById('encode-size').textContent = formatBytes(file.size);
        document.getElementById('encode-duration').textContent = formatDuration(audioBuffer.duration);
        document.getElementById('encode-channels').textContent = audioBuffer.numberOfChannels;
        document.getElementById('encode-samplerate').textContent = `${audioBuffer.sampleRate} Hz`;
        
        document.getElementById('encode-info').classList.add('show');
        document.getElementById('encode-button').disabled = false;
        
        hideProgress('encode');
        showResult('encode', '✓ File Ready', 'Audio file loaded successfully. Click "Encode to .NIV Format" to continue.');
        
    } catch (error) {
        hideProgress('encode');
        showResult('encode', '✗ Error', `Failed to read audio file: ${error.message}`, true);
        console.error(error);
    }
}

async function processEncode() {
    if (!encodeFileData) return;
    
    hideResult('encode');
    document.getElementById('encode-button').disabled = true;
    
    try {
        // Step 1: Analyze audio
        showProgress('encode', 10, '🎵 Analyzing audio...');
        console.log('🎵 Starting audio analysis...');
        
        const analysisData = await analyzeAudio(
            encodeFileData.audioBuffer,
            (percent, text) => {
                showProgress('encode', 10 + (percent * 0.3), text); // 10-40%
            }
        );
        
        console.log('✓ Analysis complete:', analysisData);
        
        showProgress('encode', 45, '📊 Converting to PCM...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        showProgress('encode', 60, '🔢 Applying delta encoding...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        showProgress('encode', 80, '🗜️ Compressing data...');
        
        // Step 2: Encode to .NIV with analysis data
        const result = await encodeToNIV(
            encodeFileData.audioBuffer, 
            encodeFileData.metadata,
            analysisData  // Include analysis
        );
        
        showProgress('encode', 100, 'Complete!');
        
        // Prepare download
        const filename = encodeFileData.file.name.replace(/\.[^/.]+$/, '') + '.niv';
        
        hideProgress('encode');
        
        // Build detailed message with ALL analysis results (ADVANCED)
        let instrumentList = '';
        if (analysisData.instruments) {
            instrumentList = '<br><br><strong>🎼 Detected Instruments:</strong><br>';
            for (const [key, inst] of Object.entries(analysisData.instruments)) {
                if (inst.detected) {
                    instrumentList += `&nbsp;&nbsp;• ${inst.name}: ${inst.presence}%<br>`;
                }
            }
        }
        
        let advancedFeatures = '';
        
        // BPM/Tempo
        if (analysisData.tempo) {
            advancedFeatures += `<br><strong>🎵 Tempo:</strong> ${analysisData.tempo.bpm} BPM (${analysisData.tempo.timeSignature.numerator}/${analysisData.tempo.timeSignature.denominator})`;
            advancedFeatures += `<br><strong>🎼 Beats:</strong> ${analysisData.tempo.beats.length} detected`;
        }
        
        // Musical Key
        if (analysisData.key) {
            advancedFeatures += `<br><strong>🎹 Key:</strong> ${analysisData.key.note} ${analysisData.key.mode} (${(analysisData.key.confidence * 100).toFixed(0)}% confidence)`;
        }
        
        // Genre
        if (analysisData.genre) {
            advancedFeatures += `<br><strong>🎸 Genre:</strong> ${analysisData.genre.primary.genre} (${analysisData.genre.primary.confidence})`;
            if (analysisData.genre.secondary) {
                advancedFeatures += ` / ${analysisData.genre.secondary.genre}`;
            }
        }
        
        // Mood
        if (analysisData.mood) {
            advancedFeatures += `<br><strong>😊 Mood:</strong> ${analysisData.mood.primary}`;
            if (analysisData.mood.descriptors.length > 1) {
                advancedFeatures += ` (${analysisData.mood.descriptors.slice(1, 3).join(', ')})`;
            }
        }
        
        // Vocals
        if (analysisData.vocals) {
            advancedFeatures += `<br><strong>🎤 Vocals:</strong> ${analysisData.vocals.sections.length} sections (${analysisData.vocals.vocalDensity} of song)`;
            advancedFeatures += `<br>&nbsp;&nbsp;&nbsp;Type: ${analysisData.vocals.predominantType}`;
        }
        
        let peaksInfo = '';
        if (analysisData.peaks && analysisData.peaks.length > 0) {
            peaksInfo = `<br><strong>📈 Peak Moments:</strong> ${analysisData.peaks.length} detected`;
        }
        
        let emotionalInfo = '';
        if (analysisData.emotionalMarkers && analysisData.emotionalMarkers.length > 0) {
            emotionalInfo = `<br><strong>✨ Goosebumps Moments:</strong> ${analysisData.emotionalMarkers.length} detected`;
        }
        
        const message = `
            <strong>🎉 HIGH-END Encoding Complete!</strong><br><br>
            <strong>📦 File Info:</strong><br>
            &nbsp;&nbsp;Original Size: ${formatBytes(result.info.originalSize)}<br>
            &nbsp;&nbsp;Encoded Size: ${formatBytes(result.info.encodedSize)}<br>
            &nbsp;&nbsp;Compression: ${result.info.compressionRatio}:1<br>
            &nbsp;&nbsp;Quality: Lossless 32-bit<br>
            &nbsp;&nbsp;Channels: ${result.info.channels}<br>
            &nbsp;&nbsp;Sample Rate: ${result.info.sampleRate} Hz<br>
            &nbsp;&nbsp;Duration: ${formatDuration(result.info.duration)}
            ${instrumentList}
            ${advancedFeatures}
            ${peaksInfo}
            ${emotionalInfo}
            <br><br><strong>✓ Professional-grade analysis complete!</strong><br>
            <em style="color: #667eea;">Analysis Version: ${analysisData.analysisVersion}</em>
        `;
        
        showResult('encode', '🎉 Success!', message, false, {
            buffer: result.data.buffer,
            filename: filename,
            mimeType: 'application/octet-stream'
        });
        
    } catch (error) {
        hideProgress('encode');
        showResult('encode', '✗ Error', `Encoding failed: ${error.message}`, true);
        console.error(error);
    } finally {
        document.getElementById('encode-button').disabled = false;
    }
}

// ==================== DECODE TAB ====================

async function handleDecodeFile(file) {
    if (!file) return;
    
    hideResult('decode');
    showProgress('decode', 10, 'Reading .NIV file...');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        showProgress('decode', 30, 'Parsing header...');
        
        // Parse header to show info
        const info = await getNIVInfo(arrayBuffer);
        
        decodeFileData = {
            file: file,
            arrayBuffer: arrayBuffer,
            info: info
        };
        
        // Display file info
        document.getElementById('decode-filename').textContent = file.name;
        document.getElementById('decode-channels').textContent = info.channels;
        document.getElementById('decode-samplerate').textContent = `${info.sampleRate} Hz`;
        document.getElementById('decode-bitdepth').textContent = `${info.bitDepth} bits`;
        
        document.getElementById('decode-info').classList.add('show');
        document.getElementById('decode-button').disabled = false;
        
        hideProgress('decode');
        showResult('decode', '✓ File Ready', '.NIV file loaded successfully. Select output format and click "Decode to Audio".');
        
    } catch (error) {
        hideProgress('decode');
        showResult('decode', '✗ Error', `Failed to read .NIV file: ${error.message}`, true);
        console.error(error);
    }
}

async function processDecode() {
    if (!decodeFileData) return;
    
    hideResult('decode');
    document.getElementById('decode-button').disabled = true;
    
    try {
        const format = document.getElementById('decode-format').value;
        
        showProgress('decode', 20, 'Decompressing data...');
        
        const ctx = initAudioContext();
        
        showProgress('decode', 50, 'Decoding .NIV file...');
        
        // Decode from .NIV (calling the codec function from niv-codec.js)
        const result = await decodeFromNIV(decodeFileData.arrayBuffer, ctx);
        
        showProgress('decode', 80, 'Converting to audio format...');
        
        // Convert to WAV (only supported format for now in browser)
        const wavBuffer = audioBufferToWav(result.audioBuffer);
        
        showProgress('decode', 100, 'Complete!');
        
        // Prepare download
        const filename = decodeFileData.file.name.replace('.niv', '') + '.wav';
        
        hideProgress('decode');
        
        const message = `
            <strong>Decoding successful!</strong><br><br>
            <strong>Format:</strong> WAV (32-bit float)<br>
            <strong>Channels:</strong> ${result.info.channels}<br>
            <strong>Sample Rate:</strong> ${result.info.sampleRate} Hz<br>
            <strong>Duration:</strong> ${formatDuration(result.info.duration)}<br>
            <strong>Size:</strong> ${formatBytes(wavBuffer.byteLength)}
        `;
        
        showResult('decode', '🎉 Success!', message, false, {
            buffer: wavBuffer,
            filename: filename,
            mimeType: 'audio/wav'
        });
        
    } catch (error) {
        hideProgress('decode');
        showResult('decode', '✗ Error', `Decoding failed: ${error.message}`, true);
        console.error(error);
    } finally {
        document.getElementById('decode-button').disabled = false;
    }
}

// ==================== INFO TAB ====================

async function handleInfoFile(file) {
    if (!file) return;
    
    hideResult('info');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const info = await getNIVInfo(arrayBuffer);
        
        infoFileData = {
            file: file,
            info: info
        };
        
        // Display detailed info
        const infoDetails = document.getElementById('info-details');
        infoDetails.className = 'file-info show';
        
        let html = `
            <div class="file-info-row">
                <span class="file-info-label">File Name:</span>
                <span class="file-info-value">${file.name}</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">File Size:</span>
                <span class="file-info-value">${formatBytes(file.size)}</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">NIV Version:</span>
                <span class="file-info-value">${info.version}</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">Channels:</span>
                <span class="file-info-value">${info.channels}</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">Sample Rate:</span>
                <span class="file-info-value">${info.sampleRate} Hz</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">Bit Depth:</span>
                <span class="file-info-value">${info.bitDepth} bits</span>
            </div>
            <div class="file-info-row">
                <span class="file-info-label">Compressed Audio Size:</span>
                <span class="file-info-value">${formatBytes(info.audioDataSize)}</span>
            </div>
        `;
        
        // Add analysis data if available  
        if (info.metadata && info.metadata.analysis) {
            const analysis = info.metadata.analysis;
            
            // Instruments
            if (analysis.instruments) {
                html += `<div class="file-info-row" style="margin-top: 20px; border-top: 2px solid #667eea; padding-top: 15px;">
                    <span class="file-info-label" style="font-size: 1.2em; color: #667eea;">🎼 Detected Instruments</span>
                    <span class="file-info-value"></span>
                </div>`;
                
                for (const [key, inst] of Object.entries(analysis.instruments)) {
                    if (inst.detected) {
                        const barWidth = Math.min(100, parseFloat(inst.presence));
                        html += `<div class="file-info-row">
                            <span class="file-info-label">${inst.name}:</span>
                            <span class="file-info-value">${inst.presence}%</span>
                        </div>`;
                    }
                }
            }
            
            // Peaks
            if (analysis.peaks && analysis.peaks.length > 0) {
                html += `<div class="file-info-row" style="margin-top: 20px; border-top: 2px solid #667eea; padding-top: 15px;">
                    <span class="file-info-label" style="font-size: 1.2em; color: #667eea;">📈 Peak Moments</span>
                    <span class="file-info-value">${analysis.peaks.length} detected</span>
                </div>`;
            }
            
            // Advanced Features Section
            if (analysis.tempo || analysis.key || analysis.genre || analysis.mood || analysis.vocals) {
                html += `<div class="file-info-row" style="margin-top: 20px; border-top: 3px solid #667eea; padding-top: 15px;">
                    <span class="file-info-label" style="font-size: 1.3em; color: #667eea; font-weight: bold;">🚀 ADVANCED ANALYSIS</span>
                    <span class="file-info-value" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8em;">HIGH-END</span>
                </div>`;
            }
            
            // BPM/Tempo
            if (analysis.tempo) {
                html += `<div class="file-info-row" style="background: #f0f4ff; padding: 10px; border-radius: 5px; margin: 5px 0;">
                    <span class="file-info-label">🎵 BPM:</span>
                    <span class="file-info-value"><strong>${analysis.tempo.bpm}</strong> (${(analysis.tempo.confidence * 100).toFixed(0)}% confidence)</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">🎼 Time Signature:</span>
                    <span class="file-info-value">${analysis.tempo.timeSignature.numerator}/${analysis.tempo.timeSignature.denominator}</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">🥁 Beats Detected:</span>
                    <span class="file-info-value">${analysis.tempo.beats.length}</span>
                </div>`;
            }
            
            // Musical Key
            if (analysis.key) {
                html += `<div class="file-info-row" style="background: #f0f4ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <span class="file-info-label">🎹 Musical Key:</span>
                    <span class="file-info-value"><strong>${analysis.key.note} ${analysis.key.mode}</strong> (${(analysis.key.confidence * 100).toFixed(0)}% confidence)</span>
                </div>`;
            }
            
            // Genre
            if (analysis.genre) {
                html += `<div class="file-info-row" style="background: #fff5f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <span class="file-info-label">🎸 Genre:</span>
                    <span class="file-info-value"><strong>${analysis.genre.primary.genre}</strong> (${analysis.genre.primary.confidence})</span>
                </div>`;
                if (analysis.genre.secondary) {
                    html += `<div class="file-info-row">
                        <span class="file-info-label">Secondary Genre:</span>
                        <span class="file-info-value">${analysis.genre.secondary.genre} (${analysis.genre.secondary.confidence})</span>
                    </div>`;
                }
                if (analysis.genre.tertiary) {
                    html += `<div class="file-info-row">
                        <span class="file-info-label">Tertiary Genre:</span>
                        <span class="file-info-value">${analysis.genre.tertiary.genre} (${analysis.genre.tertiary.confidence})</span>
                    </div>`;
                }
            }
            
            // Mood
            if (analysis.mood) {
                html += `<div class="file-info-row" style="background: #fff0f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <span class="file-info-label">😊 Mood:</span>
                    <span class="file-info-value"><strong>${analysis.mood.primary}</strong></span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">Valence (Positivity):</span>
                    <span class="file-info-value">${(analysis.mood.valence * 100).toFixed(0)}%</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">Arousal (Energy):</span>
                    <span class="file-info-value">${(analysis.mood.arousal * 100).toFixed(0)}%</span>
                </div>`;
                if (analysis.mood.descriptors && analysis.mood.descriptors.length > 1) {
                    html += `<div class="file-info-row">
                        <span class="file-info-label">Descriptors:</span>
                        <span class="file-info-value">${analysis.mood.descriptors.join(', ')}</span>
                    </div>`;
                }
            }
            
            // Vocals
            if (analysis.vocals) {
                html += `<div class="file-info-row" style="background: #f0fff4; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <span class="file-info-label">🎤 Vocals:</span>
                    <span class="file-info-value"><strong>${analysis.vocals.sections.length} sections</strong> (${analysis.vocals.vocalDensity} of song)</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">Vocal Type:</span>
                    <span class="file-info-value">${analysis.vocals.predominantType}</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">Singing Sections:</span>
                    <span class="file-info-value">${analysis.vocals.characteristics.singingSections}</span>
                </div>`;
                html += `<div class="file-info-row">
                    <span class="file-info-label">Speech Sections:</span>
                    <span class="file-info-value">${analysis.vocals.characteristics.speechSections}</span>
                </div>`;
            }
            
            // Goosebumps Moments
            if (analysis.emotionalMarkers && analysis.emotionalMarkers.length > 0) {
                html += `<div class="file-info-row" style="margin-top: 20px; border-top: 2px solid #764ba2; padding-top: 15px;">
                    <span class="file-info-label" style="font-size: 1.2em; color: #764ba2;">✨ Goosebumps Moments</span>
                    <span class="file-info-value">${analysis.emotionalMarkers.length} detected</span>
                </div>`;
                
                for (const marker of analysis.emotionalMarkers) {
                    html += `<div class="file-info-row" style="background: #f8f0ff; padding: 10px; margin: 5px 0; border-radius: 5px;">
                        <div style="width: 100%;">
                            <div><strong>⏱️ ${marker.time}s - ${marker.intensity}</strong></div>
                            <div style="color: #6c757d; font-size: 0.9em;">${marker.description}</div>
                        </div>
                    </div>`;
                }
            }
        }
        
        // Regular metadata
        if (info.metadata) {
            html += `<div class="file-info-row" style="margin-top: 20px; border-top: 2px solid #dee2e6; padding-top: 15px;">
                <span class="file-info-label" style="font-size: 1.1em;">📋 Metadata</span>
                <span class="file-info-value"></span>
            </div>`;
            
            Object.entries(info.metadata).forEach(([key, value]) => {
                if (key !== 'analysis' && typeof value !== 'object') {
                    html += `<div class="file-info-row">
                        <span class="file-info-label">${key}:</span>
                        <span class="file-info-value">${value}</span>
                    </div>`;
                }
            });
        }
        
        infoDetails.innerHTML = html;
        
        const hasAnalysis = info.metadata && info.metadata.analysis;
        showResult('info', '✓ Information Retrieved', 
            hasAnalysis ? '✨ Successfully read .NIV file with full audio analysis data!' : 
            'Successfully read .NIV file information.');
        
    } catch (error) {
        showResult('info', '✗ Error', `Failed to read .NIV file: ${error.message}`, true);
        console.error(error);
    }
}

// ==================== DRAG & DROP ====================

// Setup drag and drop for all upload areas
document.addEventListener('DOMContentLoaded', () => {
    const uploadAreas = document.querySelectorAll('.upload-area');
    
    uploadAreas.forEach(area => {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });
        
        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });
        
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const inputId = area.querySelector('input[type="file"]').id;
                
                if (inputId === 'encode-file') {
                    handleEncodeFile(file);
                } else if (inputId === 'decode-file') {
                    handleDecodeFile(file);
                } else if (inputId === 'info-file') {
                    handleInfoFile(file);
                }
            }
        });
    });
});
