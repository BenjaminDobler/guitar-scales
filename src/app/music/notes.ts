export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export const NOTE_NAMES_FLAT = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

export type NoteName = (typeof NOTE_NAMES_SHARP)[number];

export function noteName(pc: PitchClass, useFlats = false): string {
  return (useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pc];
}

export function pitchClassFromName(name: string): PitchClass | null {
  const sharp = NOTE_NAMES_SHARP.indexOf(name as NoteName);
  if (sharp >= 0) return sharp as PitchClass;
  const flat = NOTE_NAMES_FLAT.indexOf(name as (typeof NOTE_NAMES_FLAT)[number]);
  if (flat >= 0) return flat as PitchClass;
  return null;
}

export function transpose(pc: PitchClass, semitones: number): PitchClass {
  return (((pc + semitones) % 12) + 12) % 12 as PitchClass;
}
