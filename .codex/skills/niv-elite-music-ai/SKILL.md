---
name: niv-elite-music-ai
description: Analyze, generate, transform, extend, remix, arrange, master, validate, encode, and decode music for the NIV Audio Codec at professional quality. Use for .niv files, data-driven music understanding, worldwide instrument and sound recognition, open-set timbre classification, reference-inspired original composition, prompt-to-music generation, stem-aware AI editing, NIV metadata and provenance, audio mastering, or optional music-video rendering.
---

# NIV Elite Music AI

## Mission

Turn NIV into an evidence-driven music intelligence and creation workflow. Understand source audio from measurable data, construct an explicit composition plan, invoke a real audio-generation or transformation engine, validate the result, and encode the verified output back into NIV.

Treat “elite” as a quality gate, not a label. Never report professional, lossless, AI-generated, or instrument-recognition success without corresponding artifacts and measurements.

## Non-negotiable rules

- Decode audio before changing sound. Never edit compressed DEFLATE, FLAC, or other payload bytes as if they were musical parameters.
- Distinguish analysis, planning, generation, mixing, mastering, encoding, and video rendering as separate stages.
- Invoke an actual configured generation model for AI music. If none is available, produce a validated generation plan and report the missing provider; never synthesize a fake success.
- Preserve an open-world `unknown` class. Never force every sound into a known instrument label.
- Represent confidence numerically and attach evidence. Do not invent accuracy percentages.
- Generate an original work from abstract musical attributes. Do not copy a protected melody, lyrics, recording, or identifiable performer voice unless the user owns or has licensed the source and explicitly requests an authorized edit.
- Keep source, intermediate stems, generated candidates, masters, NIV packages, and optional videos as distinct artifacts.
- Reject outputs that fail required quality or integrity checks.

## Load the right resources

- Read [references/niv-contract.md](references/niv-contract.md) for every NIV inspection, schema, encoding, decoding, integrity, or compatibility task.
- Read [references/music-intelligence.md](references/music-intelligence.md) for instrument, vocal, acoustic-event, structure, harmony, rhythm, mood, or sound recognition.
- Read [references/generation-and-quality.md](references/generation-and-quality.md) for reference transformation, prompt generation, arrangement, mastering, originality, or video delivery.
- Copy [assets/music-plan.template.json](assets/music-plan.template.json) when creating a new operation plan.
- Run `node scripts/inspect_niv.mjs <file.niv>` before trusting an existing NIV file.
- Run `node scripts/validate_music_plan.mjs <plan.json>` before generation and again before final encoding.

## Select the operation

Classify the request with one primary `operation` and zero or more `secondaryOperations`:

- `analyze`: derive a calibrated musical and acoustic profile without generating audio.
- `reference-transform`: create a new, original composition that preserves selected attributes of a reference.
- `prompt-generate`: create new music from text and explicit musical constraints.
- `edit`: change specified regions, stems, instruments, vocals, harmony, rhythm, or mix parameters.
- `extend`: add structurally coherent material rather than repeating arbitrary audio.
- `remix`: rearrange authorized material while recording preserved and changed elements.
- `master`: improve delivery quality without pretending to change composition.
- `render-video`: combine a completed audio master with artwork, animation, captions, or visualization into a separate video artifact.

Ask only for decisions that materially change the result: rights, target duration, required deliverables, must-preserve elements, lyrics or vocals, and generation provider when none is configured.

## Execute the elite workflow

### 1. Establish authority and deliverables

Record the source-rights status, requested operation, target duration, output formats, intended platform, language, vocal requirements, and optional video requirements. Treat “same type” as similar measurable attributes—not a request to duplicate composition identity.

Discover available calibrated analyzers, originality comparators, local models, provider adapters, API configuration, GPU/CPU limits, FFmpeg/FFprobe availability, and storage budget. Record this capability audit in the plan. Never expose credentials in plans, logs, metadata, or generated files.

If a required analyzer, comparator, or generation provider is unavailable, stop that stage and return the validated plan plus the exact missing capability. Do not substitute the project’s legacy heuristics for calibrated evidence.

### 2. Inspect and decode safely

Inspect the NIV header and metadata with the bundled inspector. Validate magic, version, declared sizes, file bounds, metadata limits, and supported codec before decompression.

Decode to a canonical working representation. Prefer lossless interleaved PCM or FLAC plus separate floating-point analysis buffers. Preserve the untouched source artifact.

Treat legacy NIV v1 analysis as hints. Recompute critical features when metadata is absent, uncalibrated, internally inconsistent, or produced by frequency-band heuristics.

### 3. Build the music intelligence profile

Analyze technical quality, rhythm, meter, tempo map, key and tuning, harmony, melody, structure, dynamics, timbre, instruments, vocals, sound events, spatial image, and perceptual descriptors at multiple time scales.

Use multi-label evidence for instruments and arbitrary sounds. Combine separation, embeddings, pitch and onset behavior, spectral-temporal features, and temporal consistency. Emit canonical IDs, aliases, family, region or tradition when known, technique, role, time ranges, confidence, and evidence. Retain unresolved sounds as unknown candidates.

Do not equate a broad frequency range with an instrument. Do not call threshold rules AI.

### 4. Create and validate the music plan

Create a plan from the bundled template. Express:

- preserved attributes and deliberately changed attributes;
- tempo and meter maps, tonal language, harmonic rhythm, and tuning;
- section timeline and energy arc;
- instrumentation, playing techniques, roles, registers, and stem layout;
- melody, motif, rhythm, texture, spatial, vocal, lyric, and sound-design constraints;
- generation provider, model, seed policy, candidate count, and iteration strategy;
- originality, mastering, container, and delivery gates.

Validate the plan. Resolve every error before inference. Treat warnings as explicit review items. Pipe JSON to the validator with `-` when a persistent plan file is unnecessary.

### 5. Generate or transform with a real engine

Use the configured provider through an adapter; keep provider-specific parameters outside the canonical plan where possible. Generate stems or musically meaningful layers when supported.

For reference transformation, condition on abstract descriptors, structure, embeddings with controlled strength, or authorized stems. Set explicit preservation and variation budgets. Avoid passing full reference audio when a safer feature representation meets the goal.

Generate multiple candidates for complex work. Score candidates against the plan, inspect failures, refine constraints, and select on musical coherence—not merely provider completion.

For extension, infer section function and continue motifs, harmony, orchestration, and energy with deliberate transitions. Do not label raw looping as composition.

### 6. Arrange, mix, and master

Align stems, repair transitions, remove clicks and invalid samples, manage masking, preserve headroom, control low-frequency phase, automate dynamics, and verify mono compatibility. Make mastering targets depend on destination and genre rather than applying one preset to every track.

Never claim upsampling increases musical detail. Preserve native sample rate unless delivery or processing has a justified requirement.

### 7. Re-analyze and compare

Analyze the rendered result independently. Compare it with the plan and, when applicable, with the reference profile. Confirm intended similarity in tempo, structure, timbre, mood, or energy while checking that protected melodic, lyrical, recording, and voice identity was not unintentionally copied.

Reject or regenerate when required attributes, originality, duration, integrity, or audio-quality gates fail.

### 8. Encode and deliver

Encode the verified master into the supported NIV version. Store calibrated analysis, generation provenance, source-rights declaration, model/provider identifiers, prompt hash or redacted prompt, seed when available, transformation history, quality measurements, and payload hashes.

Decode the created NIV once and compare the decoded audio with the encoded master. For lossless output, require an exact PCM or codec-appropriate hash match.

Render MP4 only after audio approval. Keep MP4 as a delivery artifact; do not describe ordinary NIV audio decoding as video generation.

## Required completion report

Return:

1. Operation and creative intent.
2. Source and rights status.
3. Evidence-backed music profile with uncertainty.
4. Generation provider/model and candidate-selection record.
5. Preserved versus changed attributes.
6. Output artifact paths and formats.
7. Objective quality, originality, and NIV integrity results.
8. Known limitations or unresolved unknown sounds.

Do not mark the task complete when a required provider, source right, artifact, decode verification, or strict quality gate remains unresolved.
