import { noteName, PitchClass, transpose } from './notes';
import { BuiltScale } from './scales';

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'min7b5'
  | 'dim7'
  | 'minMaj7';

const QUALITY_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  min7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export interface DiatonicChord {
  degree: number; // 1-based
  roman: string;
  root: PitchClass;
  quality: ChordQuality;
  symbol: string;
  triadNotes: PitchClass[];
  seventhNotes: PitchClass[];
}

const QUALITY_SUFFIX: Record<ChordQuality, { triad: string; seventh: string; roman: (r: string) => string }> = {
  maj: { triad: '', seventh: 'maj7', roman: (r) => r },
  min: { triad: 'm', seventh: 'm7', roman: (r) => r.toLowerCase() },
  dim: { triad: 'dim', seventh: 'm7♭5', roman: (r) => r.toLowerCase() + '°' },
  aug: { triad: 'aug', seventh: 'maj7♯5', roman: (r) => r + '+' },
  maj7: { triad: '', seventh: 'maj7', roman: (r) => r },
  min7: { triad: 'm', seventh: 'm7', roman: (r) => r.toLowerCase() },
  dom7: { triad: '', seventh: '7', roman: (r) => r },
  min7b5: { triad: 'dim', seventh: 'm7♭5', roman: (r) => r.toLowerCase() + 'ø' },
  dim7: { triad: 'dim', seventh: 'dim7', roman: (r) => r.toLowerCase() + '°' },
  minMaj7: { triad: 'm', seventh: 'mMaj7', roman: (r) => r.toLowerCase() },
};

function classifyTriad(intervals: number[]): ChordQuality | null {
  const [, third, fifth] = intervals;
  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  if (third === 3 && fifth === 6) return 'dim';
  if (third === 4 && fifth === 8) return 'aug';
  return null;
}

function classifySeventh(intervals: number[]): ChordQuality | null {
  const [, third, fifth, seventh] = intervals;
  if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
  if (third === 4 && fifth === 7 && seventh === 10) return 'dom7';
  if (third === 3 && fifth === 7 && seventh === 10) return 'min7';
  if (third === 3 && fifth === 6 && seventh === 10) return 'min7b5';
  if (third === 3 && fifth === 6 && seventh === 9) return 'dim7';
  if (third === 3 && fifth === 7 && seventh === 11) return 'minMaj7';
  return null;
}

function modInterval(from: PitchClass, to: PitchClass): number {
  return (((to - from) % 12) + 12) % 12;
}

export function diatonicChords(built: BuiltScale, useFlats = false): DiatonicChord[] {
  const notes = built.pitchClasses;
  const n = notes.length;
  const result: DiatonicChord[] = [];
  for (let i = 0; i < n; i++) {
    const root = notes[i];
    const third = notes[(i + 2) % n];
    const fifth = notes[(i + 4) % n];
    const seventh = notes[(i + 6) % n];
    const triadIntervals = [0, modInterval(root, third), modInterval(root, fifth)];
    const seventhIntervals = [...triadIntervals, modInterval(root, seventh)];

    const triadQ = classifyTriad(triadIntervals);
    const seventhQ = classifySeventh(seventhIntervals);
    if (!triadQ) continue;

    const quality: ChordQuality = seventhQ ?? triadQ;
    const rootName = noteName(root, useFlats);
    const triadSuffix = QUALITY_SUFFIX[triadQ].triad;
    const seventhSuffix = seventhQ ? QUALITY_SUFFIX[seventhQ].seventh : triadSuffix;
    const romanBase = ROMAN[i % 7];
    result.push({
      degree: i + 1,
      roman: QUALITY_SUFFIX[seventhQ ?? triadQ].roman(romanBase),
      root,
      quality,
      symbol: rootName + triadSuffix,
      triadNotes: [root, third, fifth],
      seventhNotes: [root, third, fifth, seventh],
    });
    // suppress unused-var lint by referencing names
    void seventhSuffix;
  }
  return result;
}

export function chordNoteNames(notes: PitchClass[], useFlats = false): string[] {
  return notes.map((n) => noteName(n, useFlats));
}

export function chordIntervalSet(quality: ChordQuality): readonly number[] {
  return QUALITY_INTERVALS[quality];
}

export function buildChordNotes(root: PitchClass, quality: ChordQuality): PitchClass[] {
  return QUALITY_INTERVALS[quality].map((iv) => transpose(root, iv));
}
