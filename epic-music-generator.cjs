const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Epic Multi-Genre Music Generator
// Creates original music with orchestral, electronic, rock elements
class EpicMusicGenerator {
    constructor() {
        this.sampleRate = 192000; // High-end 192kHz
        this.duration = 330; // 5:30 minutes (330 seconds)
        this.outputName = 'Epic_Adrenaline_Rush';
        
        // Music structure
        this.structure = {
            intro: { start: 0, duration: 20, bpm: 80, mood: 'mysterious' },
            buildup1: { start: 20, duration: 30, bpm: 100, mood: 'rising' },
            drop1: { start: 50, duration: 40, bpm: 140, mood: 'intense' },
            breakdown: { start: 90, duration: 30, bpm: 90, mood: 'emotional' },
            buildup2: { start: 120, duration: 35, bpm: 120, mood: 'powerful' },
            drop2: { start: 155, duration: 50, bpm: 150, mood: 'explosive' },
            bridge: { start: 205, duration: 40, bpm: 110, mood: 'epic' },
            finale: { start: 245, duration: 85, bpm: 160, mood: 'adrenaline' }
        };
        
        this.tracks = [];
    }

    log(message) {
        console.log(`  ${message}`);
    }

    // Generate orchestral string section
    async generateStrings() {
        console.log('\n🎻 Generating Orchestral Strings...');
        
        const tracks = [];
        
        // Cellos - Deep sustained notes
        this.log('Creating cello foundation...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=110:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=165:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.6 0.4,` +
            `tremolo=f=4:d=0.3,` +
            `volume=0.4,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le strings_cello.wav`
        );
        tracks.push('strings_cello.wav');
        
        // Violins - High emotional melodies
        this.log('Creating violin melodies...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=554:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.5 0.5,` +
            `vibrato=f=6:d=0.4,` +
            `tremolo=f=5:d=0.2,` +
            `volume=0.35,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le strings_violin.wav`
        );
        tracks.push('strings_violin.wav');
        
        // Violas - Mid-range harmony
        this.log('Creating viola harmonies...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=220:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=277:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.5 0.5,` +
            `tremolo=f=4.5:d=0.25,` +
            `volume=0.3,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le strings_viola.wav`
        );
        tracks.push('strings_viola.wav');
        
        this.log('✓ Orchestral strings generated');
        return tracks;
    }

    // Generate powerful brass section
    async generateBrass() {
        console.log('\n🎺 Generating Epic Brass...');
        
        const tracks = [];
        
        // French Horns - Rich mid tones
        this.log('Creating french horns...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=147:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=185:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=220:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2]amix=inputs=3:weights=0.4 0.3 0.3,` +
            `vibrato=f=5:d=0.3,` +
            `volume=0.45,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le brass_horns.wav`
        );
        tracks.push('brass_horns.wav');
        
        // Trumpets - Bright powerful accents
        this.log('Creating trumpets...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=523:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=659:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.5 0.5,` +
            `vibrato=f=6:d=0.35,` +
            `volume=0.4,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le brass_trumpets.wav`
        );
        tracks.push('brass_trumpets.wav');
        
        // Trombones - Deep power
        this.log('Creating trombones...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=98:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=123:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.6 0.4,` +
            `vibrato=f=4:d=0.4,` +
            `volume=0.5,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le brass_trombones.wav`
        );
        tracks.push('brass_trombones.wav');
        
        this.log('✓ Epic brass generated');
        return tracks;
    }

    // Generate massive electronic bass
    async generateElectronicBass() {
        console.log('\n🔊 Generating Electronic Bass...');
        
        const tracks = [];
        
        // Sub bass - Ultra low frequencies
        this.log('Creating sub bass...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=55:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=41:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.7 0.3,` +
            `vibrato=f=1:d=0.1,` +
            `volume=0.6,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le bass_sub.wav`
        );
        tracks.push('bass_sub.wav');
        
        // Mid bass - Growling synth bass
        this.log('Creating synth bass...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=110:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=165:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=220:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2]amix=inputs=3:weights=0.5 0.3 0.2,` +
            `vibrato=f=7:d=0.5,` +
            `tremolo=f=8:d=0.4,` +
            `volume=0.5,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le bass_synth.wav`
        );
        tracks.push('bass_synth.wav');
        
        this.log('✓ Electronic bass generated');
        return tracks;
    }

    // Generate synth leads and pads
    async generateSynths() {
        console.log('\n⚡ Generating Synth Leads & Pads...');
        
        const tracks = [];
        
        // Lead synth - Bright melodic lead
        this.log('Creating lead synth...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=880:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=1108:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=1318:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2]amix=inputs=3:weights=0.4 0.3 0.3,` +
            `vibrato=f=5:d=0.3,` +
            `tremolo=f=6:d=0.35,` +
            `volume=0.35,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le synth_lead.wav`
        );
        tracks.push('synth_lead.wav');
        
        // Pad - Atmospheric background
        this.log('Creating atmospheric pads...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=330:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=415:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=494:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=622:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2][3]amix=inputs=4:weights=0.25 0.25 0.25 0.25,` +
            `vibrato=f=2:d=0.2,` +
            `tremolo=f=1:d=0.15,` +
            `volume=0.25,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le synth_pad.wav`
        );
        tracks.push('synth_pad.wav');
        
        this.log('✓ Synths generated');
        return tracks;
    }

    // Generate powerful drums and percussion
    async generateDrums() {
        console.log('\n🥁 Generating Epic Drums & Percussion...');
        
        const tracks = [];
        
        // Kick drum - Powerful low thump
        this.log('Creating epic kicks...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=60:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "tremolo=f=2:d=0.9,volume=0.7,asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le drums_kick.wav`
        );
        tracks.push('drums_kick.wav');
        
        // Snare - Sharp attack
        this.log('Creating snares...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=200:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "tremolo=f=3:d=0.8,volume=0.45,asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le drums_snare.wav`
        );
        tracks.push('drums_snare.wav');
        
        // Hi-hats - Fast rhythm
        this.log('Creating hi-hats...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=8000:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "tremolo=f=8:d=0.9,volume=0.2,asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le drums_hats.wav`
        );
        tracks.push('drums_hats.wav');
        
        // Cinematic percussion - Epic impacts
        this.log('Creating cinematic percussion...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=80:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=120:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.6 0.4,` +
            `tremolo=f=1.5:d=0.7,` +
            `volume=0.55,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le drums_cinematic.wav`
        );
        tracks.push('drums_cinematic.wav');
        
        this.log('✓ Drums & percussion generated');
        return tracks;
    }

    // Generate piano melodies
    async generatePiano() {
        console.log('\n🎹 Generating Epic Piano...');
        
        this.log('Creating piano melodies...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=262:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=330:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=392:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=523:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2][3]amix=inputs=4:weights=0.3 0.3 0.2 0.2,` +
            `tremolo=f=3:d=0.3,` +
            `volume=0.4,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le piano.wav`
        );
        
        this.log('✓ Piano generated');
        return ['piano.wav'];
    }

    // Generate guitar riffs
    async generateGuitar() {
        console.log('\n🎸 Generating Epic Guitar...');
        
        this.log('Creating guitar riffs...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=330:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=440:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=554:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2]amix=inputs=3:weights=0.4 0.3 0.3,` +
            `vibrato=f=5:d=0.4,` +
            `tremolo=f=7:d=0.45,` +
            `volume=0.45,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le guitar.wav`
        );
        
        this.log('✓ Guitar generated');
        return ['guitar.wav'];
    }

    // Generate vocal-like atmospheric sounds
    async generateVocals() {
        console.log('\n🎤 Generating Atmospheric Vocals...');
        
        this.log('Creating vocal atmosphere...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=350:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=450:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=550:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1][2]amix=inputs=3:weights=0.35 0.35 0.3,` +
            `vibrato=f=6:d=0.5,` +
            `tremolo=f=4:d=0.3,` +
            `volume=0.3,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le vocals.wav`
        );
        
        this.log('✓ Vocals generated');
        return ['vocals.wav'];
    }

    // Mix all tracks together
    async mixTracks(allTracks) {
        console.log('\n🎚️ Mixing All Tracks...');
        
        this.log(`Combining ${allTracks.length} tracks...`);
        
        // Create input list
        const inputs = allTracks.map(track => `-i "${track}"`).join(' ');
        const amixInputs = allTracks.length;
        
        // Build input labels dynamically
        const inputLabels = Array.from({length: amixInputs}, (_, i) => `[${i}:a]`).join('');
        
        // Mix with professional processing
        await execAsync(
            `ffmpeg -y ${inputs} ` +
            `-filter_complex "${inputLabels}amix=inputs=${amixInputs}:duration=longest:normalize=0,` +
            `volume=1.8,` +  // Boost overall volume
            `acompressor=threshold=-18dB:ratio=4:attack=5:release=50,` +  // Compression
            `equalizer=f=60:t=q:w=1:g=4,` +     // Bass boost
            `equalizer=f=250:t=q:w=1:g=2,` +    // Low-mid presence
            `equalizer=f=2000:t=q:w=1:g=3,` +   // Mid clarity
            `equalizer=f=8000:t=q:w=1:g=5,` +   // High sparkle
            `equalizer=f=15000:t=q:w=1:g=3,` +  // Air
            `stereowiden=delay=10:feedback=0.4:crossfeed=0.4:drymix=0.7,` + // Stereo width
            `loudnorm=I=-14:TP=-1:LRA=11,` +    // Loudness normalization
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le mixed_base.wav`
        );
        
        this.log('✓ Initial mix complete');
        return 'mixed_base.wav';
    }

    // Add adrenaline rush moments
    async addAdrenalineRush(baseMix) {
        console.log('\n💥 Adding Adrenaline Rush Moments...');
        
        // Create impact/riser effects
        this.log('Creating epic impacts...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=40:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-f lavfi -i "sine=frequency=80:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "[0][1]amix=inputs=2:weights=0.6 0.4,` +
            `tremolo=f=0.5:d=0.8,` +
            `volume=0.6,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le impact.wav`
        );
        
        this.log('Creating risers...');
        await execAsync(
            `ffmpeg -y -f lavfi -i "sine=frequency=100:duration=${this.duration}:sample_rate=${this.sampleRate}" ` +
            `-filter_complex "vibrato=f=10:d=0.6,tremolo=f=12:d=0.7,volume=0.4,asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le riser.wav`
        );
        
        // Combine with base mix
        this.log('Adding rush elements...');
        await execAsync(
            `ffmpeg -y -i "${baseMix}" -i impact.wav -i riser.wav ` +
            `-filter_complex "[0:a][1:a][2:a]amix=inputs=3:weights=1.0 0.3 0.25:duration=longest:normalize=0,` +
            `volume=1.1,` +
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le mixed_with_rush.wav`
        );
        
        this.log('✓ Adrenaline moments added');
        return 'mixed_with_rush.wav';
    }

    // Master the final audio
    async masterAudio(inputFile) {
        console.log('\n✨ Mastering Final Audio...');
        
        const outputFile = `${this.outputName}.wav`;
        
        this.log('Applying mastering chain...');
        await execAsync(
            `ffmpeg -y -i "${inputFile}" ` +
            `-af "acompressor=threshold=-16dB:ratio=3:attack=3:release=50,` +  // Gentle compression
            `equalizer=f=40:t=q:w=1:g=3,` +       // Sub bass
            `equalizer=f=120:t=q:w=1:g=2,` +      // Bass
            `equalizer=f=500:t=q:w=1:g=1,` +      // Low-mid
            `equalizer=f=3000:t=q:w=1:g=2,` +     // Presence
            `equalizer=f=10000:t=q:w=1:g=4,` +    // Brilliance
            `equalizer=f=16000:t=q:w=1:g=2,` +    // Air
            `stereowiden=delay=15:feedback=0.4:crossfeed=0.4:drymix=0.75,` +  // Wide stereo
            `extrastereo=m=1.3:c=false,` +         // Extra stereo depth
            `loudnorm=I=-11:TP=-0.5:LRA=9,` +     // Competitive loudness
            `volume=1.05,` +                       // Final boost
            `asetrate=${this.sampleRate}" ` +
            `-c:a pcm_s32le "${outputFile}"`
        );
        
        this.log('✓ Mastering complete');
        return outputFile;
    }

    // Cleanup temporary files
    async cleanup() {
        console.log('\n🧹 Cleaning up temporary files...');
        
        const tempFiles = [
            'strings_cello.wav', 'strings_violin.wav', 'strings_viola.wav',
            'brass_horns.wav', 'brass_trumpets.wav', 'brass_trombones.wav',
            'bass_sub.wav', 'bass_synth.wav',
            'synth_lead.wav', 'synth_pad.wav',
            'drums_kick.wav', 'drums_snare.wav', 'drums_hats.wav', 'drums_cinematic.wav',
            'piano.wav', 'guitar.wav', 'vocals.wav',
            'mixed_base.wav', 'impact.wav', 'riser.wav', 'mixed_with_rush.wav'
        ];
        
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) {
                // Ignore
            }
        }
        
        this.log('✓ Cleanup complete');
    }

    // Main generation process
    async generate() {
        console.log('\n🎵 ═══════════════════════════════════════════════════');
        console.log('   EPIC ADRENALINE RUSH MUSIC GENERATOR');
        console.log('   Multi-Genre | All Instruments | Maximum Impact');
        console.log('   ═══════════════════════════════════════════════════\n');
        
        try {
            const allTracks = [];
            
            // Generate all instrument layers
            const strings = await this.generateStrings();
            allTracks.push(...strings);
            
            const brass = await this.generateBrass();
            allTracks.push(...brass);
            
            const bass = await this.generateElectronicBass();
            allTracks.push(...bass);
            
            const synths = await this.generateSynths();
            allTracks.push(...synths);
            
            const drums = await this.generateDrums();
            allTracks.push(...drums);
            
            const piano = await this.generatePiano();
            allTracks.push(...piano);
            
            const guitar = await this.generateGuitar();
            allTracks.push(...guitar);
            
            const vocals = await this.generateVocals();
            allTracks.push(...vocals);
            
            // Mix everything
            const baseMix = await this.mixTracks(allTracks);
            
            // Add adrenaline moments
            const withRush = await this.addAdrenalineRush(baseMix);
            
            // Master the audio
            const finalAudio = await this.masterAudio(withRush);
            
            // Cleanup
            await this.cleanup();
            
            console.log('\n✅ ═══════════════════════════════════════════════════');
            console.log('   MUSIC GENERATION COMPLETE!');
            console.log('   ═══════════════════════════════════════════════════');
            console.log(`   📁 Output: ${finalAudio}`);
            console.log(`   ⏱️  Duration: ${Math.floor(this.duration / 60)}:${(this.duration % 60).toString().padStart(2, '0')} minutes`);
            console.log('   🎚️  Quality: 192kHz / 32-bit / Stereo');
            console.log('   🎼 Instruments: 19 tracks mixed');
            console.log('   ✨ Epic, Powerful, Adrenaline-inducing');
            console.log('   ═══════════════════════════════════════════════════\n');
            
            return finalAudio;
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }
}

// Run the generator
const generator = new EpicMusicGenerator();
generator.generate()
    .then(outputFile => {
        console.log(`\n🎉 Ready to encode to .NIV format!`);
        console.log(`   Run: node cli.js encode "${outputFile}"`);
    })
    .catch(err => {
        console.error('Failed:', err);
        process.exit(1);
    });
