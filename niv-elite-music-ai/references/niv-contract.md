# NIV Music Contract

## Contents

1. Existing NIV v1 contract
2. Elite logical metadata
3. Compatibility and integrity rules
4. Safe processing limits
5. Artifact and provenance rules

## Existing NIV v1 contract

Treat the current project format as a 64-byte little-endian header followed by UTF-8 JSON metadata and compressed audio.

| Offset | Size | Field |
|---:|---:|---|
| 0 | 4 | Magic `NIV\0` |
| 4 | 2 | Version |
| 6 | 1 | Channels |
| 7 | 4 | Sample rate |
| 11 | 1 | Bit depth |
| 12 | 8 | Compressed audio size |
| 20 | 4 | Metadata size |
| 24 | 4 | CRC32 of compressed audio |
| 28 | 36 | Reserved |

The current Node payload is interleaved signed 32-bit little-endian PCM transformed with delta coding and zlib DEFLATE. The browser path quantizes `AudioBuffer` float samples to signed 32-bit values before the same transform.

Do not assume existing v1 files contain advanced analysis. Do not assume metadata is checksummed. Do not use metadata duration as proof of decoded frame count.

## Elite logical metadata

Preserve a provider-neutral logical model even when the physical v1 container cannot carry every future chunk efficiently.

```json
{
  "schema": "niv.music/2",
  "assetId": "stable-id",
  "audio": {
    "codec": "flac-or-pcm",
    "sampleRate": 48000,
    "channels": 2,
    "frames": 0,
    "durationSeconds": 0,
    "pcmHash": "sha256:..."
  },
  "analysis": {
    "version": "provider-and-version",
    "tempoMap": [],
    "meterMap": [],
    "tonality": {},
    "harmony": [],
    "structure": [],
    "instruments": [],
    "soundEvents": [],
    "vocals": {},
    "dynamics": {},
    "spatial": {},
    "embeddings": []
  },
  "generation": {
    "operation": "prompt-generate",
    "provider": "provider-id",
    "model": "model-id",
    "seed": null,
    "promptHash": "sha256:...",
    "sourceAssetIds": [],
    "createdAt": "ISO-8601"
  },
  "rights": {
    "sourceStatus": "owned-or-licensed",
    "voiceConsent": null
  },
  "quality": {},
  "history": []
}
```

Store large time-series features, embeddings, stems, previews, artwork, and video instructions as separately sized chunks in a future physical NIV v2 implementation. Do not inflate JSON metadata indefinitely.

Until a physical v2 codec exists, write only fields that the v1 encoder round-trips and provide the complete plan as a sidecar manifest. State this compatibility limitation in the delivery report.

## Compatibility and integrity rules

- Reject unsupported versions rather than guessing.
- Validate channel count, sample rate, bit depth, sizes, frame divisibility, and decoded byte length.
- Reject 64-bit sizes above the runtime’s safe integer range.
- Bound metadata before allocating or parsing it.
- Bound decompressed output and require an expected frame count before inflate.
- Authenticate header, metadata, and every payload chunk in the future format. CRC32 is an accidental-corruption check, not a security signature.
- Preserve unknown metadata keys when safely round-tripping newer files.
- Use explicit codec identifiers; never infer payload codec solely from version.
- Maintain cross-runtime golden fixtures for Node and browser encoders/decoders.
- Escape metadata before rendering it in HTML.

## Safe processing limits

Derive limits from the task and available memory. Require explicit approval before exceeding them.

- Default metadata ceiling: 16 MiB.
- Default channels: 1–32.
- Default sample rate: 8 kHz–384 kHz; do not imply that higher rates improve an existing source.
- Require a declared decoded byte count and reject expansion materially beyond it.
- Stream large audio payloads and hash incrementally; avoid whole-file copies.
- Keep generation credentials out of NIV metadata.

## Artifact and provenance rules

Use separate paths for source, decoded working audio, stems, candidates, selected mix, master, NIV package, verification decode, and MP4. Never overwrite the only source copy.

Record model and provider identifiers, adapter version, time, seed, source asset IDs, transformation history, quality measurements, and rights declaration. Hash private prompts instead of embedding them when disclosure is not requested.
