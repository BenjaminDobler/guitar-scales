import { PitchClass, transpose } from './notes';

export interface ScaleDefinition {
  id: string;
  name: string;
  category: 'major-modes' | 'minor' | 'pentatonic' | 'other';
  intervals: readonly number[];
  /**
   * For scales that don't produce clean diatonic triads on their own (e.g. pentatonics),
   * the id of the parent scale whose chords are typically used to harmonize this one.
   */
  chordParentId?: string;
}

export const SCALES: readonly ScaleDefinition[] = [
  { id: 'ionian', name: 'Ionian (Major)', category: 'major-modes', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', name: 'Dorian', category: 'major-modes', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Phrygian', category: 'major-modes', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: 'Lydian', category: 'major-modes', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', name: 'Mixolydian', category: 'major-modes', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'aeolian', name: 'Aeolian (Natural Minor)', category: 'major-modes', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'locrian', name: 'Locrian', category: 'major-modes', intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'harmonic-minor', name: 'Harmonic Minor', category: 'minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic-minor', name: 'Melodic Minor (Asc.)', category: 'minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'major-pentatonic', name: 'Major Pentatonic', category: 'pentatonic', intervals: [0, 2, 4, 7, 9], chordParentId: 'ionian' },
  { id: 'minor-pentatonic', name: 'Minor Pentatonic', category: 'pentatonic', intervals: [0, 3, 5, 7, 10], chordParentId: 'aeolian' },
  { id: 'blues', name: 'Blues (Minor)', category: 'other', intervals: [0, 3, 5, 6, 7, 10], chordParentId: 'aeolian' },
] as const;

export function scaleById(id: string): ScaleDefinition | undefined {
  return SCALES.find((s) => s.id === id);
}

export interface BuiltScale {
  root: PitchClass;
  scale: ScaleDefinition;
  pitchClasses: PitchClass[];
}

export function buildScale(root: PitchClass, scale: ScaleDefinition): BuiltScale {
  return {
    root,
    scale,
    pitchClasses: scale.intervals.map((iv) => transpose(root, iv)),
  };
}

export function pitchClassSet(notes: PitchClass[]): number {
  let mask = 0;
  for (const n of notes) mask |= 1 << n;
  return mask;
}

export function scaleMask(built: BuiltScale): number {
  return pitchClassSet(built.pitchClasses);
}
