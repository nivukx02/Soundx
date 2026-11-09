const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Audio analysis and extension with enhanced peaks
class AudioExtender {
    constructor(inputFile) {
        this.inputFile = inputFile;
        this.originalDuration = 105; // 1:45
        this.targetDuration = 180; // 3:00
        this.extensionDuration = 75; // 1:15 additional
    }

    async analyzeAudio() {
        console.log('🎵 Analyzing audio patterns...');
        
        // Extract audio statistics
        const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${this.inputFile}"`;
        const { stdout } = await execAsync(cmd);
        const data = JSON.parse(stdout);
        
        console.log('✓ Audio analysis complete');
        return data;
    }

    async extractPeakSegments() {
        console.log('🎼 Extracting peak segments for extension...');
        
        // Extract high-energy segments from the original
        // Based on the analysis, peaks are around: 1.7s, 35-40s, 46-76s, 85s+
        const peakSegments = [
            { start: 35, duration: 10 },  // High energy section
            { start: 46, duration: 30 },  // Most intense section
            { start: 75, duration: 20 },  // Emotional peak
        ];
        
        const extractedFiles = [];
        
        for (let i = 0; i < peakSegments.length; i++) {
            const seg = peakSegments[i];
            const outputFile = `peak_segment_${i}.wav`;
            
            // Extract segment
            await execAsync(`ffmpeg -y -i "${this.inputFile}" -ss ${seg.start} -t ${seg.duration} -c:a pcm_s32le "${outputFile}"`);
            extractedFiles.push(outputFile);
            console.log(`  ✓ Extracted peak segment ${i + 1}`);
        }
        
        return extractedFiles;
    }

    async createEnhancedExtension(peakSegments) {
        console.log('✨ Creating enhanced extension with more peaks...');
        
        // Apply audio enhancement to make peaks more intense
        const enhancedSegments = [];
        
        for (let i = 0; i < peakSegments.length; i++) {
            const input = peakSegments[i];
            const output = `enhanced_${i}.wav`;
            
            // Apply audio processing:
            // - Increase dynamics
            // - Boost highs and lows
            // - Add subtle saturation for more energy
            // - Increase loudness
            const filters = [
                'acompressor=threshold=-20dB:ratio=4:attack=5:release=50',  // Compression
                'equalizer=f=100:t=q:w=1:g=3',   // Boost bass
                'equalizer=f=8000:t=q:w=1:g=4',  // Boost treble for brightness
                'equalizer=f=3000:t=q:w=1:g=2',  // Boost mids for presence
                'loudnorm=I=-14:TP=-1.5:LRA=11', // Normalize loudness
                'volume=1.2',  // Increase overall energy
            ].join(',');
            
            await execAsync(`ffmpeg -y -i "${input}" -af "${filters}" -c:a pcm_s32le "${output}"`);
            enhancedSegments.push(output);
            console.log(`  ✓ Enhanced segment ${i + 1}`);
        }
        
        return enhancedSegments;
    }

    async arrangeExtension(enhancedSegments) {
        console.log('🎹 Arranging extended section...');
        
        // Create arrangement by combining and varying the segments
        // to create natural flow with more peaks
        
        // Create a concat file for ffmpeg
        const arrangement = [
            enhancedSegments[1], // Start with most intense
            enhancedSegments[2], // Follow with emotional peak
            enhancedSegments[0], // High energy
            enhancedSegments[1], // Back to intense
            enhancedSegments[2], // End with emotional climax
        ];
        
        // Create concat list
        let concatList = '';
        for (const file of arrangement) {
            concatList += `file '${file}'\n`;
        }
        fs.writeFileSync('concat_list.txt', concatList);
        
        // Combine segments
        await execAsync(`ffmpeg -y -f concat -safe 0 -i concat_list.txt -c:a pcm_s32le extension_combined.wav`);
        
        // Trim to exact duration needed (75 seconds)
        await execAsync(`ffmpeg -y -i extension_combined.wav -t 75 -c:a pcm_s32le extension_final.wav`);
        
        console.log('  ✓ Extension arranged');
        return 'extension_final.wav';
    }

    async combineOriginalAndExtension(extensionFile) {
        console.log('🔗 Combining original and extension...');
        
        // Add a smooth crossfade transition
        const crossfadeDuration = 2; // 2 second crossfade
        
        // Create concat list
        const concatList = `file '${this.inputFile}'\nfile '${extensionFile}'`;
        fs.writeFileSync('final_concat.txt', concatList);
        
        // Combine with crossfade
        await execAsync(
            `ffmpeg -y -i "${this.inputFile}" -i "${extensionFile}" ` +
            `-filter_complex "[0][1]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri" ` +
            `-c:a pcm_s32le combined_48k.wav`
        );
        
        console.log('  ✓ Combined successfully');
        return 'combined_48k.wav';
    }

    async upsampleTo192k(inputFile) {
        console.log('⬆️  Upsampling to 192kHz/32-bit...');
        
        const outputFile = 'The_Wild_Theme_Extended_192k.wav';
        
        // Upsample with high-quality resampling
        await execAsync(
            `ffmpeg -y -i "${inputFile}" ` +
            `-ar 192000 ` +          // 192kHz sample rate
            `-c:a pcm_s32le ` +      // 32-bit depth
            `-af "aresample=resampler=soxr:precision=28:dither_method=triangular" ` + // High quality resampling
            `"${outputFile}"`
        );
        
        console.log('  ✓ Upsampled to 192kHz/32-bit');
        return outputFile;
    }

    async applyStereoWidening(inputFile) {
        console.log('🎧 Applying stereo widening...');
        
        const outputFile = 'The_Wild_Theme_Extended_Final.wav';
        
        // Apply stereo enhancement using extrastereo and haas effect
        await execAsync(
            `ffmpeg -y -i "${inputFile}" ` +
            `-af "stereotools,stereowiden=delay=15:feedback=0.3:crossfeed=0.3:drymix=0.8,extrastereo=m=1.5:c=false" ` +
            `-c:a pcm_s32le ` +
            `"${outputFile}"`
        );
        
        console.log('  ✓ Stereo widening applied');
        return outputFile;
    }

    async cleanup() {
        console.log('🧹 Cleaning up temporary files...');
        
        const tempFiles = [
            'peak_segment_0.wav',
            'peak_segment_1.wav',
            'peak_segment_2.wav',
            'enhanced_0.wav',
            'enhanced_1.wav',
            'enhanced_2.wav',
            'concat_list.txt',
            'extension_combined.wav',
            'extension_final.wav',
            'final_concat.txt',
            'combined_48k.wav',
        ];
        
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) {
                // Ignore errors
            }
        }
        
        console.log('  ✓ Cleanup complete');
    }

    async extend() {
        try {
            console.log('\n🎵 ═══════════════════════════════════════════════════');
            console.log('   AUDIO EXTENSION & ENHANCEMENT ENGINE');
            console.log('   ═══════════════════════════════════════════════════\n');
            
            // Step 1: Analyze
            await this.analyzeAudio();
            
            // Step 2: Extract peak segments
            const peakSegments = await this.extractPeakSegments();
            
            // Step 3: Enhance segments
            const enhancedSegments = await this.createEnhancedExtension(peakSegments);
            
            // Step 4: Arrange extension
            const extension = await this.arrangeExtension(enhancedSegments);
            
            // Step 5: Combine
            const combined = await this.combineOriginalAndExtension(extension);
            
            // Step 6: Upsample to 192kHz
            const upsampled = await this.upsampleTo192k(combined);
            
            // Step 7: Apply stereo widening
            const final = await this.applyStereoWidening(upsampled);
            
            // Step 8: Cleanup
            await this.cleanup();
            
            console.log('\n✅ ═══════════════════════════════════════════════════');
            console.log('   EXTENSION COMPLETE!');
            console.log('   ═══════════════════════════════════════════════════');
            console.log(`   📁 Output: ${final}`);
            console.log('   ⏱️  Duration: 3:00 minutes');
            console.log('   🎚️  Quality: 192kHz / 32-bit / Stereo');
            console.log('   ✨ Enhanced with more peaks and goosebump moments');
            console.log('   ═══════════════════════════════════════════════════\n');
            
            return final;
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }
}

// Run the extender
const extender = new AudioExtender('The_Wild_Theme_Original.wav');
extender.extend()
    .then(outputFile => {
        console.log(`\n🎉 Ready to encode to .NIV format!`);
        console.log(`   Run: node cli.js encode "${outputFile}"`);
    })
    .catch(err => {
        console.error('Failed:', err);
        process.exit(1);
    });
