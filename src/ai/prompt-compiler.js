function list(values, fallback = 'none specified') {
  return Array.isArray(values) && values.length ? values.join('; ') : fallback;
}

function sectionLine(section) {
  return `${section.label}: ${section.startSeconds.toFixed(2)}-${section.endSeconds.toFixed(2)} s, energy ${section.energy ?? 'unspecified'}`;
}

function instrumentLine(instrument) {
  const technique = Array.isArray(instrument.techniques) && instrument.techniques.length
    ? `; techniques: ${instrument.techniques.join(', ')}`
    : '';
  return `${instrument.canonicalName} [${instrument.family}], role: ${instrument.role ?? 'unspecified'}${technique}`;
}

export function compileGenerationPrompt(plan) {
  const profile = plan.musicalProfile;
  const tempo = profile.tempo ? `${profile.tempo.bpm} BPM` : 'tempo chosen musically by the model';
  const tonality = profile.tonality
    ? `${profile.tonality.tonic} ${profile.tonality.mode}, A4=${profile.tonality.tuningHz ?? 440} Hz`
    : 'tonality intentionally open';
  const sections = profile.sections.map(sectionLine).join('\n- ');
  const instruments = profile.instruments.length
    ? profile.instruments.map(instrumentLine).join('\n- ')
    : 'Select an original, culturally respectful orchestration that fits the requested intent.';

  return [
    'Compose and render a completely original music recording.',
    `Creative brief: ${plan.intent.prompt}`,
    `Exact target duration: ${profile.durationSeconds} seconds (tolerance ${plan.quality.durationToleranceSeconds} seconds).`,
    `Rhythm: ${tempo}, meter ${profile.meter ?? 'provider-selected'}.`,
    `Tonal language: ${tonality}.`,
    `Audio delivery: ${profile.sampleRate} Hz, ${profile.channels} channel(s).`,
    'Section timeline:',
    `- ${sections}`,
    'Instrumentation and roles:',
    `- ${instruments}`,
    `Energy arc: ${list(profile.energyArc, 'follow section energy values')}.`,
    `Preserve only these authorized attributes: ${list(plan.intent.preserve)}.`,
    `Deliberately change: ${list(plan.intent.change)}.`,
    `Exclude: ${list(plan.intent.exclude)}.`,
    'Use coherent motif development, intentional transitions, clean endings, controlled dynamics, and production choices appropriate to the brief.',
    'Do not copy an existing melody, lyric, hook, recording identity, or identifiable performer voice.'
  ].join('\n');
}
