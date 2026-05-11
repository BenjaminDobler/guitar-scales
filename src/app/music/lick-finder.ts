import { noteName, PitchClass } from './notes';
import { buildScale, pitchClassSet, ScaleDefinition, SCALES, scaleMask } from './scales';

export interface ScaleMatch {
  root: PitchClass;
  rootName: string;
  scale: ScaleDefinition;
  containsRoot: boolean;
}

export function findScalesContaining(
  notes: readonly PitchClass[],
  scales: readonly ScaleDefinition[] = SCALES,
  useFlats = false,
): ScaleMatch[] {
  if (notes.length === 0) return [];
  const noteMask = pitchClassSet(notes as PitchClass[]);
  const matches: ScaleMatch[] = [];
  for (let root = 0 as PitchClass; root < 12; root = ((root + 1) as PitchClass)) {
    for (const scale of scales) {
      const built = buildScale(root, scale);
      const mask = scaleMask(built);
      if ((noteMask & mask) === noteMask) {
        matches.push({
          root,
          rootName: noteName(root, useFlats),
          scale,
          containsRoot: (noteMask & (1 << root)) !== 0,
        });
      }
    }
    if (root === 11) break;
  }
  // Prefer smaller scales (tighter fit) and matches where the lick contains the root
  matches.sort((a, b) => {
    if (a.containsRoot !== b.containsRoot) return a.containsRoot ? -1 : 1;
    return a.scale.intervals.length - b.scale.intervals.length;
  });
  return matches;
}
