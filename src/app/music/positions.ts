import { PitchClass } from './notes';
import { BuiltScale } from './scales';
import { fretPitchClass, openPc, stringCount, Tuning } from './tunings';

export type PositionSystem = '5-box' | '3-nps';

export interface FretCell {
  string: number;
  fret: number;
}

export interface ScalePosition {
  id: string;
  label: string;
  system: PositionSystem;
  /** Inclusive fret range that visually frames the position. */
  fretRange: { from: number; to: number };
  /** All scale-note cells inside the position. */
  cells: FretCell[];
}

interface Anchor {
  string: number;
  fret: number;
}

function rootPositionsByFret(root: PitchClass, tuning: Tuning, fretCount: number): Anchor[] {
  const out: Anchor[] = [];
  for (let s = 0; s < stringCount(tuning); s++) {
    const open = openPc(tuning, s);
    for (let f = 0; f <= fretCount; f++) {
      if (fretPitchClass(open, f) === root) {
        out.push({ string: s, fret: f });
      }
    }
  }
  out.sort((a, b) => a.fret - b.fret || a.string - b.string);
  return out;
}

function uniqueAscending(values: number[]): number[] {
  const out: number[] = [];
  let prev = -Infinity;
  for (const v of values) {
    if (v !== prev) {
      out.push(v);
      prev = v;
    }
  }
  return out;
}

function collectScaleCells(
  built: BuiltScale,
  tuning: Tuning,
  range: { from: number; to: number },
): FretCell[] {
  const allowed = new Set<PitchClass>(built.pitchClasses);
  const cells: FretCell[] = [];
  for (let s = 0; s < stringCount(tuning); s++) {
    const open = openPc(tuning, s);
    for (let f = range.from; f <= range.to; f++) {
      if (f < 0) continue;
      if (allowed.has(fretPitchClass(open, f))) {
        cells.push({ string: s, fret: f });
      }
    }
  }
  return cells;
}

/**
 * 5-box system. Anchored on root positions across the strings, sorted ascending.
 * Box 1 starts on the root on the lowest string; subsequent boxes follow up the neck.
 *
 * For A minor pentatonic in standard tuning this produces (window = [anchor, next_anchor + 1]):
 *   Box 1: 5-8, Box 2: 7-11, Box 3: 10-13, Box 4: 12-15, Box 5: 14-18.
 * The conventional textbook windows (5-8, 7-10, 9-12, 12-15, 14-17) differ by ±1 fret on
 * some boxes because conventional fingering frames extend slightly outside the strict
 * root-to-root window. The scale notes contained in each box are the same.
 */
function fiveBoxPositions(
  built: BuiltScale,
  tuning: Tuning,
  fretCount: number,
): ScalePosition[] {
  const roots = rootPositionsByFret(built.root, tuning, fretCount);
  if (roots.length < 2) return [];

  const distinctFrets = uniqueAscending(roots.map((r) => r.fret));

  // Find the root position on the lowest string and start counting boxes from there.
  const lowest = openPc(tuning, 0);
  let lowestRootFret = -1;
  for (let f = 0; f <= fretCount; f++) {
    if (fretPitchClass(lowest, f) === built.root) {
      lowestRootFret = f;
      break;
    }
  }
  const startIdx = Math.max(0, distinctFrets.indexOf(lowestRootFret));
  const anchors = distinctFrets.slice(startIdx, startIdx + 6);

  const positions: ScalePosition[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i];
    const next = anchors[i + 1];
    const to = Math.min(next + 1, fretCount);
    const cells = collectScaleCells(built, tuning, { from, to });
    if (cells.length === 0) continue;
    positions.push({
      id: `5-box-${i + 1}`,
      label: `Box ${i + 1}`,
      system: '5-box',
      fretRange: { from, to },
      cells,
    });
  }
  return positions;
}

/**
 * 3-notes-per-string for 7-note scales. Each position is anchored on a scale degree on the
 * lowest string and spans a 5-fret window so that 3 notes fit on each string.
 */
function threeNpsPositions(
  built: BuiltScale,
  tuning: Tuning,
  fretCount: number,
): ScalePosition[] {
  if (built.pitchClasses.length !== 7) return [];
  if (stringCount(tuning) === 0) return [];

  const lowest = openPc(tuning, 0);
  const positions: ScalePosition[] = [];
  for (let degree = 0; degree < 7; degree++) {
    const targetPc = built.pitchClasses[degree];
    let anchor = -1;
    for (let f = 0; f <= fretCount; f++) {
      if (fretPitchClass(lowest, f) === targetPc) {
        anchor = f;
        break;
      }
    }
    if (anchor < 0) continue;
    const from = anchor;
    const to = Math.min(anchor + 4, fretCount);
    const cells = collectScaleCells(built, tuning, { from, to });
    if (cells.length === 0) continue;
    positions.push({
      id: `3-nps-${degree + 1}`,
      label: `Position ${degree + 1}`,
      system: '3-nps',
      fretRange: { from, to },
      cells,
    });
  }
  return positions;
}

export function computePositions(
  built: BuiltScale,
  tuning: Tuning,
  fretCount: number,
  system: PositionSystem,
): ScalePosition[] {
  if (system === '5-box') return fiveBoxPositions(built, tuning, fretCount);
  return threeNpsPositions(built, tuning, fretCount);
}

export function systemAvailableFor(scaleLength: number, system: PositionSystem): boolean {
  if (system === '3-nps') return scaleLength === 7;
  return true;
}

export interface FingeringStep {
  string: number;
  fret: number;
  midi: number;
}

/**
 * Produce an ascending sequence of MIDI notes for a scale, starting at the first
 * occurrence of the first pitch class at or above `baseRootMidi`. Each subsequent
 * note is the lowest MIDI strictly greater than the previous matching the next
 * pitch class. Appends the octave of the first note so the run resolves.
 */
export function ascendingScaleMidis(
  pitchClasses: readonly PitchClass[],
  baseRootMidi: number,
): number[] {
  if (pitchClasses.length === 0) return [];
  const out: number[] = [];
  let prev = baseRootMidi - 1;
  for (const pc of pitchClasses) {
    const next = prev + 1 + ((((pc - ((prev + 1) % 12)) % 12) + 12) % 12);
    out.push(next);
    prev = next;
  }
  out.push(out[0] + 12);
  return out;
}

/**
 * Choose a single (string, fret) for each MIDI note such that the run reads as a
 * natural fingering. Heuristic:
 *   - If `restrictToCells` is set, only consider positions inside that set.
 *   - Otherwise prefer the lowest-pitched open string that can play the note,
 *     producing a single-string ascending run when feasible.
 * Notes that can't be placed (e.g. octave above the highest fret) are dropped.
 */
export function pickAscendingFingering(
  midis: readonly number[],
  tuning: Tuning,
  fretCount: number,
  restrictToCells: readonly FretCell[] | null = null,
): FingeringStep[] {
  const restrict = restrictToCells
    ? new Set(restrictToCells.map((c) => `${c.string}:${c.fret}`))
    : null;
  const result: FingeringStep[] = [];
  const stringTotal = stringCount(tuning);
  for (const midi of midis) {
    let chosen: FingeringStep | null = null;
    for (let s = 0; s < stringTotal; s++) {
      const fret = midi - tuning.midiStrings[s];
      if (fret < 0 || fret > fretCount) continue;
      if (restrict && !restrict.has(`${s}:${fret}`)) continue;
      // Prefer the lowest-pitched open string that can reach the note.
      if (!chosen || s < chosen.string) {
        chosen = { string: s, fret, midi };
      }
    }
    if (chosen) result.push(chosen);
  }
  return result;
}
