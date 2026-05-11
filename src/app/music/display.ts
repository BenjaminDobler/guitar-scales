import { noteName, PitchClass } from './notes';
import { BuiltScale } from './scales';

export type DisplayMode = 'note' | 'degree' | 'interval';

const INTERVAL_LABELS: Record<number, string> = {
  0: 'R',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
};

/** Maps a pitch class to its interval label relative to a root. */
export function intervalLabel(pc: PitchClass, root: PitchClass): string {
  const iv = (((pc - root) % 12) + 12) % 12;
  return INTERVAL_LABELS[iv];
}

const SCALE_DEGREE_LABEL: Record<number, string> = {
  // For 7-note scales we use 1..7. The interval-to-degree mapping depends on the scale's intervals.
  // We compute it dynamically below; this map is just for the natural degrees of major scale.
  0: '1',
  2: '2',
  4: '3',
  5: '4',
  7: '5',
  9: '6',
  11: '7',
};

/**
 * Build a label map for every pitch class in a scale, given the display mode.
 * For non-scale pitch classes, returns no entry (caller falls back to note name).
 */
export function buildLabelMap(
  built: BuiltScale,
  mode: DisplayMode,
  useFlats: boolean,
): Map<PitchClass, string> {
  const map = new Map<PitchClass, string>();
  if (mode === 'note') {
    for (const pc of built.pitchClasses) {
      map.set(pc, noteName(pc, useFlats));
    }
    return map;
  }
  if (mode === 'interval') {
    for (const pc of built.pitchClasses) {
      map.set(pc, intervalLabel(pc, built.root));
    }
    return map;
  }
  // Degree mode: use scale-degree labels (1, 2, 3, 4, 5, 6, 7) for 7-note scales,
  // or (1, 2, 3, 4, 5) for pentatonic, etc. For non-natural intervals add accidentals.
  const intervals = built.scale.intervals;
  intervals.forEach((iv, i) => {
    const pc = built.pitchClasses[i];
    const naturalForDegree = naturalIntervalForDegree(intervals.length, i);
    if (naturalForDegree === iv) {
      map.set(pc, String(i + 1));
    } else {
      const diff = iv - naturalForDegree;
      const acc = diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff);
      map.set(pc, acc + (i + 1));
    }
  });
  return map;
}

function naturalIntervalForDegree(scaleLength: number, degreeIndex: number): number {
  if (scaleLength === 7) {
    // Major-scale baseline.
    return [0, 2, 4, 5, 7, 9, 11][degreeIndex];
  }
  if (scaleLength === 5) {
    // Major pentatonic baseline (1, 2, 3, 5, 6).
    return [0, 2, 4, 7, 9][degreeIndex];
  }
  if (scaleLength === 6) {
    // Blues-style (1, ♭3, 4, ♭5, 5, ♭7) — map degrees to closest natural baseline.
    return [0, 3, 5, 6, 7, 10][degreeIndex];
  }
  return degreeIndex * 2;
}
