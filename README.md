# NIV Audio + Elite AI Music Pipeline

NIV is a lossless audio container and a strict, provider-backed workflow for prompt-to-music and authorized music transformation. The production path separates composition planning, real model inference, calibrated music/sound analysis, originality review, audio-quality validation, NIV encoding, and exact decode verification.

The project does not describe fixed oscillators, loops, frequency thresholds, or metadata guesses as AI. The older browser experiments remain useful UI prototypes, but their heuristic instrument/genre/mood labels are not calibrated evidence and are not used by the elite pipeline.

## Current production capabilities

- Signed 32-bit PCM NIV v1 encoding with delta coding, DEFLATE, CRC32, bounded metadata, and safe decoding limits.
- Byte-exact PCM round trips with SHA-256 verification after delivery encoding.
- A canonical `niv.music-plan/1` composition plan and strict validator.
- Real local or cloud generation through the versioned NIV HTTP provider adapter.
- Prompt generation plus authorized reference transform, edit, extend, and remix operations.
- Persistent provider jobs with polling, cancellation, immutable raw candidates, and provenance.
- Calibrated open-set instrument and arbitrary-sound records, including `unknown-acoustic-source` instead of forced labels.
- Candidate structure/intent evidence and independent originality review.
- Native PCM integrity measurements and FFmpeg EBU R128 true-peak/loudness measurements.
- Lossless WAV/FLAC delivery, logical `niv.music/2` metadata, a full sidecar manifest, and exact NIV decode/hash gates.

With the bundled FFmpeg build, FLAC is accepted only for 24-bit-aligned PCM and is decoded/hash-checked. Choose WAV for arbitrary full-32-bit PCM; a precision-losing FLAC conversion is rejected.

## Important truth boundary

This repository does not bundle a trained music-generation model or claim universal recognition accuracy. A real model stack must be configured with `NIV_AI_BASE_URL` and `NIV_AI_MODEL`. No finite model literally knows every sound in existence; global coverage is handled with an extensible taxonomy, local aliases, calibrated confidence, multi-label mixtures, and a permanent unknown class.

If the required generator, calibrated analyzer, or originality comparator is absent, the system creates a draft plan or stops. It never substitutes a procedural tone and calls it generated music.

## Quick start

Install the existing Node dependencies, then verify the system:

```powershell
npm.cmd test
node ai-cli.js providers
```

Without provider configuration, the second command intentionally reports `UNCONFIGURED`.

Configure a real provider (see [.env.example](.env.example)), create a detailed plan, validate it, and generate:

```powershell
$env:NIV_AI_BASE_URL = 'http://127.0.0.1:8080/'
$env:NIV_AI_PROVIDER_MODE = 'local'
$env:NIV_AI_PROVIDER_ID = 'my-local-music-stack'
$env:NIV_AI_MODEL = 'my-model-id'

node ai-cli.js plan --prompt "An original cinematic Tamil folk-electronic work with nadaswaram, thavil, modular bass, evolving motifs, and a restrained final cadence" --duration 180 --instrument "nadaswaram|aerophone|lead" --instrument "thavil|membranophone|rhythmic-foundation" --out music-plan.json
node ai-cli.js validate music-plan.json --ready
node ai-cli.js generate music-plan.json
```

See [AI-MUSIC.md](AI-MUSIC.md) for provider schemas, security controls, quality gates, and artifact layout. The governing project skill is [SKILL.md](niv-elite-music-ai/SKILL.md).

## Codec CLI

The original codec commands remain available:

```powershell
node cli.js encode input.wav -o output.niv
node cli.js decode output.niv -o restored.flac --format flac
node cli.js info output.niv
```

The audio conversion path no longer depends on a missing FFprobe executable; it normalizes through the bundled FFmpeg binary and parses canonical WAV data directly.

## NIV v1 physical layout

| Offset | Bytes | Field |
|---:|---:|---|
| 0 | 4 | `NIV\0` magic |
| 4 | 2 | Version (`1`) |
| 6 | 1 | Channels |
| 7 | 4 | Sample rate, little-endian |
| 11 | 1 | Bit depth (`32`) |
| 12 | 8 | Compressed payload size |
| 20 | 4 | UTF-8 JSON metadata size |
| 24 | 4 | CRC32 of compressed audio |
| 28 | 36 | Reserved |

The payload is interleaved signed 32-bit little-endian PCM, delta-coded and DEFLATE-compressed. CRC32 detects accidental payload corruption; it is not a cryptographic signature. The elite manifest therefore records SHA-256 hashes and complete provenance. Large embeddings, stems, and time-series features stay outside v1 metadata until a chunked physical NIV v2 is implemented.

## Test coverage

`npm.cmd test` runs:

- codec header, corruption, bounds, and byte-exact round-trip tests;
- configuration and ready-plan rejection tests;
- a queued HTTP-provider contract fixture;
- artifact upload/collection and hash checks;
- calibrated analysis and originality schemas;
- EBU true-peak candidate gating;
- final WAV, NIV, sidecar, and exact decoded-PCM verification.

The deterministic waveform in the integration test is explicitly a test-only protocol fixture, never an AI implementation or deliverable.
