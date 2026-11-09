# NIV Elite AI Music Engine

This project now has a strict, model-backed path from a composition plan to verified audio and a lossless NIV package. It does **not** call fixed tones, loops, FFT thresholds, or metadata guesses “AI.” If no real local or cloud model is configured, generation stops with an exact configuration error.

## What the engine guarantees

- A real provider must advertise the requested model, duration, sample rate, channels, candidate count, and operation.
- The provider must expose a calibrated, open-set analyzer. Known instruments use extensible canonical records; unresolved timbres remain `unknown-acoustic-source` rather than receiving a forced label.
- Every candidate is preserved unchanged, decoded to canonical signed 32-bit PCM, scanned for invalid/full-scale samples, measured with FFmpeg EBU R128 true-peak mode, checked against duration and structure evidence, and sent through an originality comparator.
- Failed candidates are retained as job evidence but cannot become deliverables.
- The selected lossless master is encoded to NIV v1 with `niv.music/2` provenance metadata, decoded again, and required to produce the exact original PCM SHA-256 hash.
- The complete logical v2 record is written as a sidecar manifest until a physical, chunked NIV v2 container exists.

The bundled FLAC encoder carries 24 valid PCM bits. The pipeline permits FLAC only when the canonical signed 32-bit samples are 24-bit-aligned and verifies the decoded hash. Use WAV for arbitrary full-32-bit PCM; the system will reject a precision-losing FLAC delivery.

No finite classifier can literally contain every instrument and sound in the world. The production design therefore uses an open taxonomy, local names and aliases, Hornbostel–Sachs-compatible families, multi-label mixtures, calibrated confidence, and a permanent unknown class. Coverage can grow without changing the NIV audio payload.

## Configure a real model

Set environment variables from [.env.example](.env.example). Remote providers require HTTPS and authentication by default. Loopback HTTP is supported for local GPU model servers. Credentials are never written to plans, NIV metadata, job state, or manifests.

```powershell
$env:NIV_AI_BASE_URL = 'http://127.0.0.1:8080/'
$env:NIV_AI_PROVIDER_MODE = 'local'
$env:NIV_AI_PROVIDER_ID = 'my-local-music-stack'
$env:NIV_AI_MODEL = 'my-audio-model'
node ai-cli.js providers
```

Then create and run a plan:

```powershell
node ai-cli.js plan --prompt "An original cinematic Tamil folk-electronic piece with nadaswaram, thavil, modular bass, and a restrained final cadence" --duration 180 --instrument "nadaswaram|aerophone|lead" --instrument "thavil|membranophone|rhythmic-foundation" --out music-plan.json
node ai-cli.js validate music-plan.json --ready
node ai-cli.js generate music-plan.json
```

For an authorized NIV transformation, the source is decoded and hash-recorded, then sent through calibrated source analysis before inference:

```powershell
node ai-cli.js plan --operation reference-transform --source-niv "owned-reference.niv" --rights owned --prompt "Preserve the broad energy contour and meter; replace melody, hook, harmony detail, recording identity, and orchestration" --preserve "energy contour" --preserve "meter" --change "melody" --change "recording identity" --out transform-plan.json
node ai-cli.js generate transform-plan.json
```

Use `node ai-cli.js status <job-directory>` to inspect persistent state. Ctrl+C during a remote job requests provider cancellation.

## Provider protocol v1

The adapter expects these authenticated JSON endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/v1/capabilities` | Model, limits, lossless formats, calibrated analysis and originality capabilities |
| `POST` | `/v1/generations` | Prompt-to-music submission |
| `POST` | `/v1/transforms` | Authorized reference operation after upload |
| `POST` | `/v1/uploads` | Streaming audio upload; returns `assetId` |
| `GET` | `/v1/jobs/{id}` | Queued/running/completed/failed/cancelled state |
| `DELETE` | `/v1/jobs/{id}` | Cancellation |
| `GET` | `/v1/jobs/{id}/result` | Normalized candidate artifacts |
| `POST` | `/v1/analysis` | Calibrated open-set music and sound profile plus plan compliance |
| `POST` | `/v1/originality` | Melody, lyric, hook, recording, voice, embedding and fingerprint review |

Canonical schemas are enforced in [protocol.js](src/ai/providers/protocol.js). Candidate artifacts may be signed HTTPS URLs, bounded base64 data, or paths confined to `NIV_AI_LOCAL_ARTIFACT_ROOT` for a loopback provider. The bundled test server is only a protocol fixture and is explicitly not an AI generator.

## Artifact layout

Each run creates `.niv-jobs/<run-id>/` beside the delivery directory. It contains the immutable plan snapshot, capability audit, raw candidates, normalized working audio, per-candidate evaluations, and state. Only a passing candidate creates the requested audio, `.niv`, and `.niv.manifest.json` deliverables.
