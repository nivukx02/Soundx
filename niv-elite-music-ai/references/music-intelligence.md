# Music and Sound Intelligence

## Contents

1. Analysis layers
2. Worldwide instrument ontology
3. Open-set recognition
4. Evidence and confidence
5. Failure rules

## Analysis layers

Analyze multiple time scales and retain time-local results.

1. **Technical:** codec, frames, channels, sample rate, clipping, silence, DC offset, noise, bandwidth, loudness, and phase.
2. **Rhythm:** onset curve, tempo candidates, tempo map, beat/downbeat grid, meter, swing, syncopation, groove, and rhythmic motifs.
3. **Pitch and harmony:** tuning reference, pitch salience, melody, bass line, key regions, modes, chords, harmonic rhythm, cadences, and microtonal evidence.
4. **Structure:** boundaries, repetitions, intro, verse, chorus, bridge, drop, breakdown, solo, transition, climax, and outro with confidence.
5. **Timbre and sources:** instruments, ensembles, synthesis methods, samples, playing techniques, roles, registers, articulations, and effects.
6. **Voice:** speech, singing, rap, choir, language when supported, register, role, and consent-sensitive identity boundaries.
7. **General sounds:** ambience, field recordings, foley, impacts, machines, animals, weather, crowds, noise, and designed effects.
8. **Perceptual:** energy, density, tension, brightness, warmth, spaciousness, roughness, valence, and mood as model-dependent estimates.

Never derive all layers from one FFT or from the first channel alone.

Before analysis, record a capability matrix with the tool/model name, version, supported labels, calibration source, and availability for each layer. If only signal-processing heuristics are available, return technical measurements and hypotheses; do not present them as calibrated semantic recognition.

## Worldwide instrument ontology

Use an extensible record instead of a finite flat list.

```json
{
  "canonicalId": "hs:423.232",
  "canonicalName": "trumpet",
  "aliases": ["natural trumpet"],
  "family": "aerophone",
  "subfamily": "lip-vibrated",
  "regionOrTradition": [],
  "technique": ["sustained"],
  "role": "lead",
  "startSeconds": 0,
  "endSeconds": 4,
  "confidence": 0.86,
  "evidence": ["separated-stem", "embedding", "harmonic-envelope"]
}
```

Anchor acoustic classification in Hornbostel–Sachs families while allowing modern and local taxonomies:

- idiophones;
- membranophones;
- chordophones;
- aerophones;
- electrophones and electronic synthesis;
- human voice and body percussion;
- sampled, hybrid, prepared, invented, and sound-designed sources.

Preserve original/local names and aliases. Do not erase cultural identity by replacing every regional instrument with a Western approximation. Allow multiple candidate IDs when evidence is ambiguous.

## Open-set recognition

Combine independent evidence when tools permit:

- source separation or query-based separation;
- audio and text embedding similarity against a versioned taxonomy;
- multi-label acoustic-event classification;
- pitch, inharmonicity, onset, decay, modulation, formant, and spectral-temporal behavior;
- playing-technique and articulation classifiers;
- temporal tracking and section-level consistency;
- metadata or user evidence, marked separately from acoustic evidence.

Calibrate an unknown threshold on held-out data. Emit `unknown-acoustic-source`, a stable candidate ID, an embedding reference, time ranges, nearest candidates, and evidence when no class is reliable. Permit later human naming without re-encoding the audio.

Recognize mixtures as mixtures. A frequency region may contain several instruments and effects. Never treat broad overlapping frequency bands as proof of instrument identity.

## Evidence and confidence

Keep confidence within `0..1` and describe what it means. Separate:

- model probability or calibrated confidence;
- signal quality;
- temporal coverage;
- agreement among detectors;
- human-confirmed labels.

Aggregate only compatible confidence values. Return competing hypotheses when their scores are close. Mark unavailable analysis as unavailable, not zero.

Use benchmarks before publishing accuracy. Report dataset, class coverage, split, metric, threshold, and confidence intervals. Do not reuse accuracy from another model or taxonomy.

Require a separate originality comparator for similarity claims. If melodic, lyric, voice, embedding, or fingerprint comparison is unavailable, require human review and mark automated originality verification unavailable.

## Failure rules

- Reject `Infinity`, `NaN`, negative duration, zero-step loops, and impossible beat grids.
- Return no tempo for silence or weak periodic evidence.
- Return no key for insufficient pitched evidence.
- Avoid mood certainty from loudness or brightness alone.
- Do not claim lyrics, language, identity, or instrument subtype without a supporting model and evidence.
- Avoid blocking the browser main thread for full-track analysis; prefer workers, streaming, batching, and cancellable jobs.
