# Generation, Originality, and Quality

## Contents

1. Composition planning
2. Reference transformation
3. Prompt generation
4. Candidate production
5. Mix and master gates
6. Originality and rights
7. Video delivery

## Provider adapter contract

Keep provider integration behind a versioned adapter that exposes:

- `capabilities()` for duration, conditioning, stems, seeds, formats, safety, and limits;
- `generate(plan, inputs)` for prompt generation;
- `transform(plan, source, stems)` for authorized reference work;
- `status(jobId)`, `cancel(jobId)`, and `collect(jobId)` for long jobs;
- normalized candidate metadata containing provider, model, version, seed, parameters, provenance, and hashes.

Validate provider output rather than trusting completion status. Never invent adapter results or silently fall back to a different model.

## Composition planning

Translate creative language into controllable musical dimensions: duration, tempo map, meter, tonal language, harmonic rhythm, form, energy arc, instrumentation, techniques, register, density, groove, motif behavior, vocal/lyric requirements, spatial design, and delivery target.

Use section-level constraints. A high-end plan explains how the music evolves; it is not a bag of genre adjectives.

## Reference transformation

Separate attributes into three sets:

- **Preserve:** user-authorized elements that should remain exact or close.
- **Abstract:** tempo range, energy contour, orchestration density, broad texture, form proportions, mix perspective, or mood.
- **Replace:** melody, lyrics, signature hooks, recording identity, performer identity, and other protected or deliberately changed elements.

Set a similarity budget for each dimension. Create a new motif and melodic contour unless exact preservation is authorized. Prefer feature conditioning over raw-audio conditioning when it satisfies the request.

## Prompt generation

Build provider prompts from the canonical plan. Include positive musical instructions, section timeline, instrument roles and techniques, transition behavior, vocal details, mix perspective, duration, and exclusions. Keep provider syntax in an adapter layer.

Do not rely on “high quality,” “epic,” or “professional” alone. Express observable requirements such as dynamic brass swells, low-string ostinato, 12/8 meter, 96 BPM, gradual density increase, dry close percussion, or wide hall returns.

## Candidate production

Generate multiple candidates when resources allow. Use deterministic seeds when supported. Keep raw provider outputs unchanged.

Rank candidates against hard constraints first, then musical coherence:

1. duration and structural compliance;
2. required and prohibited content;
3. tempo, tuning, harmony, and transition stability;
4. instrumentation and sound-event evidence;
5. artifacts, clipping, silence, and spectral defects;
6. originality distance;
7. perceptual preference or human selection.

Regenerate failed sections or stems instead of concealing composition errors with mastering.

## Mix and master gates

Set targets from the intended platform and genre. Record actual measurements and tolerances in the music plan.

Require at minimum:

- finite samples with no unintended digital clipping;
- controlled true peak, commonly at or below `-1 dBTP` for lossy-distribution safety unless the target specifies otherwise;
- integrated loudness and loudness range appropriate to the destination rather than one universal value;
- no unintended DC offset, discontinuities, clicks, long dropouts, or truncated tails;
- controlled sub-bass and low-frequency phase;
- acceptable mono compatibility and channel balance;
- justified bandwidth and sample rate;
- clean section transitions and exact requested duration within tolerance;
- stem sum and final mix checks when stems are delivered.

Do not describe compression, limiting, widening, reverb, upsampling, or EQ as improvement without before/after measurements and listening review.

## Originality and rights

Record whether each source is owned, licensed, public domain, or unknown. Require explicit voice consent for identity-preserving or cloning work.

Compare source and result with available melodic, rhythmic, harmonic, lyric, embedding, and audio-fingerprint evidence. Flag suspiciously close hooks or passages for human review. Similar genre or instrumentation is acceptable; copied expressive identity may not be.

Store provenance without exposing secrets. Include provider/model/version, adapter, seed, source asset IDs, prompt hash, date, and transformation history.

## Video delivery

Approve the audio master first. Then create artwork, timeline cues, captions, waveform or spectrum visualization, animation, and an MP4 mux as separate stages. Preserve lossless audio separately even when the video uses a delivery codec.

Validate frame size, frame rate, color space, caption timing, audio synchronization, loudness, and final duration. NIV decoding alone produces audio unless the format explicitly contains and supports a video payload.
