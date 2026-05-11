import { PitchClass } from './notes';

export interface Tuning {
  id: string;
  name: string;
  /** Low to high. Each entry is the open-string MIDI number. */
  midiStrings: readonly number[];
}

export function openPc(tuning: Tuning, stringIndex: number): PitchClass {
  const m = tuning.midiStrings[stringIndex];
  return (((m % 12) + 12) % 12) as PitchClass;
}

export function stringCount(tuning: Tuning): number {
  return tuning.midiStrings.length;
}

// MIDI note numbers — middle C = 60. Standard guitar: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.
export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard (EADGBE)', midiStrings: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', name: 'Drop D (DADGBE)', midiStrings: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', midiStrings: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G (DGDGBD)', midiStrings: [38, 43, 50, 55, 59, 62] },
  { id: 'half-step-down', name: 'Eb Standard', midiStrings: [39, 44, 49, 54, 58, 63] },
  { id: '7-string', name: '7-String (BEADGBE)', midiStrings: [35, 40, 45, 50, 55, 59, 64] },
] as const;

export const DEFAULT_TUNING = TUNINGS[0];

export function fretPitchClass(openPc: PitchClass, fret: number): PitchClass {
  return (((openPc + fret) % 12) + 12) % 12 as PitchClass;
}

export function fretMidi(openMidi: number, fret: number): number {
  return openMidi + fret;
}
