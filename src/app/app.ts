import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AudioService, GrooveId } from './audio/audio.service';
import { BackingTrack } from './backing-track/backing-track';
import { ChordList } from './chord-list/chord-list';
import { FretPosition, GuitarNeck } from './guitar-neck/guitar-neck';
import { LickFinder } from './lick-finder/lick-finder';
import { diatonicChords } from './music/chords';
import { buildLabelMap, DisplayMode } from './music/display';
import { ScaleMatch } from './music/lick-finder';
import { PitchClass } from './music/notes';
import { ascendingScaleMidis, computePositions, pickAscendingFingering } from './music/positions';
import { buildScale, scaleById } from './music/scales';
import { DEFAULT_TUNING, fretPitchClass, openPc, stringCount, TUNINGS } from './music/tunings';
import { PositionPicker, PositionSelection } from './position-picker/position-picker';
import { ScalePicker } from './scale-picker/scale-picker';

type Mode = 'scale' | 'lick';
const NECK_FRETS = 22;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuitarNeck, ScalePicker, ChordList, LickFinder, PositionPicker, BackingTrack],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly tunings = TUNINGS;
  protected readonly tuningId = signal(DEFAULT_TUNING.id);
  protected readonly tuning = computed(
    () => TUNINGS.find((t) => t.id === this.tuningId()) ?? DEFAULT_TUNING,
  );

  protected readonly root = signal<PitchClass>(9); // A
  protected readonly scaleId = signal('minor-pentatonic');
  protected readonly useFlats = signal(false);

  protected readonly mode = signal<Mode>('scale');
  protected readonly selectedPositions = signal<readonly FretPosition[]>([]);
  protected readonly activeDegree = signal<number | null>(null);
  protected readonly positionSelection = signal<PositionSelection>({ kind: 'off' });
  protected readonly displayMode = signal<DisplayMode>('note');
  protected readonly progressionDegrees = signal<readonly number[]>([1, 4, 5, 1]);
  protected readonly bpm = signal(96);
  protected readonly groove = signal<GrooveId>('block');
  protected readonly drumsEnabled = signal(true);
  protected readonly neckFrets = NECK_FRETS;
  protected readonly audio = inject(AudioService);

  protected readonly scaleDef = computed(() => scaleById(this.scaleId())!);
  protected readonly built = computed(() => buildScale(this.root(), this.scaleDef()));

  /** Scale used to derive diatonic chords. For pentatonics/blues this is the parent scale. */
  protected readonly chordSourceBuilt = computed(() => {
    const def = this.scaleDef();
    const parentId = def.chordParentId;
    if (!parentId) return this.built();
    const parent = scaleById(parentId);
    return parent ? buildScale(this.root(), parent) : this.built();
  });

  protected readonly chords = computed(() => diatonicChords(this.chordSourceBuilt(), this.useFlats()));

  /** Display name of the parent scale when chords are sourced from one, otherwise null. */
  protected readonly chordSourceName = computed(() => {
    const def = this.scaleDef();
    if (!def.chordParentId) return null;
    return this.chordSourceBuilt().scale.name;
  });

  protected readonly activeChord = computed(() => {
    const d = this.activeDegree();
    if (d == null) return null;
    return this.chords().find((c) => c.degree === d) ?? null;
  });

  protected readonly highlightedPitchClasses = computed<readonly PitchClass[]>(() => {
    if (this.mode() === 'lick') return [];
    const chord = this.activeChord();
    if (chord) return chord.seventhNotes;
    return this.built().pitchClasses;
  });

  protected readonly rootForNeck = computed<PitchClass | null>(() => {
    if (this.mode() === 'lick') return null;
    const chord = this.activeChord();
    return chord ? chord.root : this.root();
  });

  protected readonly lickNotes = computed<readonly PitchClass[]>(() => {
    const tuning = this.tuning();
    const seen = new Set<PitchClass>();
    const ordered: PitchClass[] = [];
    for (const pos of this.selectedPositions()) {
      if (pos.string >= stringCount(tuning)) continue;
      const pc = fretPitchClass(openPc(tuning, pos.string), pos.fret);
      if (!seen.has(pc)) {
        seen.add(pc);
        ordered.push(pc);
      }
    }
    return ordered;
  });

  protected readonly neckSelected = computed(() =>
    this.mode() === 'lick' ? this.selectedPositions() : [],
  );

  protected readonly availablePositions = computed(() => {
    const sel = this.positionSelection();
    if (sel.kind !== 'system') return [];
    return computePositions(this.built(), this.tuning(), this.neckFrets, sel.system);
  });

  protected readonly activePosition = computed(() => {
    const sel = this.positionSelection();
    if (sel.kind !== 'system') return null;
    const positions = this.availablePositions();
    return positions.find((p) => p.id === sel.positionId) ?? positions[0] ?? null;
  });

  protected readonly restrictToCells = computed(() => {
    if (this.mode() !== 'scale') return null;
    const pos = this.activePosition();
    if (!pos) return null;
    if (this.activeChord()) return null; // chord overlay takes precedence
    return pos.cells;
  });

  protected readonly positionFrame = computed(() => {
    if (this.mode() !== 'scale') return null;
    if (this.activeChord()) return null;
    const pos = this.activePosition();
    if (!pos) return null;
    return { fromFret: pos.fretRange.from, toFret: pos.fretRange.to };
  });

  protected readonly nps7Available = computed(() => this.scaleDef().intervals.length === 7);

  protected readonly noteLabels = computed(() => {
    if (this.mode() === 'lick') return null;
    return buildLabelMap(this.built(), this.displayMode(), this.useFlats());
  });

  protected readonly progressionSteps = computed(() => {
    const degrees = this.progressionDegrees();
    const chords = this.chords();
    const steps = [];
    for (const d of degrees) {
      const chord = chords.find((c) => c.degree === d);
      if (!chord) continue;
      steps.push({ degree: d, chord });
    }
    return steps;
  });

  constructor() {
    // Sanitize position selection when scale or tuning changes invalidates it.
    effect(() => {
      const sel = this.positionSelection();
      if (sel.kind !== 'system') return;
      const positions = this.availablePositions();
      if (positions.length === 0) {
        // 3-NPS chosen but scale is no longer 7-note — drop back to off.
        this.positionSelection.set({ kind: 'off' });
        return;
      }
      if (!positions.some((p) => p.id === sel.positionId)) {
        this.positionSelection.set({ ...sel, positionId: positions[0].id });
      }
    });
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    if (m === 'scale') {
      this.selectedPositions.set([]);
    } else {
      this.activeDegree.set(null);
    }
  }

  onTuningChange(e: Event): void {
    this.tuningId.set((e.target as HTMLSelectElement).value);
    this.selectedPositions.set([]);
  }

  onPositionClick(pos: FretPosition): void {
    const tuning = this.tuning();
    if (pos.string >= stringCount(tuning)) return;
    if (this.mode() === 'scale') {
      const midi = tuning.midiStrings[pos.string] + pos.fret;
      void this.audio.playNote(midi);
      return;
    }
    const current = this.selectedPositions();
    const key = `${pos.string}:${pos.fret}`;
    const existing = current.find((p) => `${p.string}:${p.fret}` === key);
    if (existing) {
      this.selectedPositions.set(current.filter((p) => p !== existing));
    } else {
      this.selectedPositions.set([...current, pos]);
    }
  }

  onMatchPicked(match: ScaleMatch): void {
    this.root.set(match.root);
    this.scaleId.set(match.scale.id);
    this.setMode('scale');
  }

  onClearLick(): void {
    this.selectedPositions.set([]);
  }

  onDegreeSelected(degree: number | null): void {
    this.activeDegree.set(degree);
    if (degree == null) return;
    const chord = this.chords().find((c) => c.degree === degree);
    if (chord) {
      void this.audio.playChord(chord.seventhNotes, { baseRootMidi: this.tuning().midiStrings[0] });
    }
  }

  onPositionSelectionChange(sel: PositionSelection): void {
    if (sel.kind === 'system' && !sel.positionId) {
      const positions = computePositions(this.built(), this.tuning(), this.neckFrets, sel.system);
      const first = positions[0]?.id ?? '';
      this.positionSelection.set({ ...sel, positionId: first });
      return;
    }
    this.positionSelection.set(sel);
  }

  setDisplayMode(m: DisplayMode): void {
    this.displayMode.set(m);
  }

  playScale(): void {
    const tuning = this.tuning();
    const midis = ascendingScaleMidis(this.built().pitchClasses, tuning.midiStrings[0]);
    const fingering = pickAscendingFingering(midis, tuning, this.neckFrets, this.restrictToCells());
    void this.audio.playScale(fingering);
  }

  playActiveChord(): void {
    const chord = this.activeChord();
    if (!chord) return;
    void this.audio.playChord(chord.seventhNotes, { baseRootMidi: this.tuning().midiStrings[0] });
  }

  toggleBackingTrack(): void {
    if (this.audio.isPlayingTrack()) {
      this.audio.stopBackingTrack();
      return;
    }
    const steps = this.progressionSteps().map((s) => ({
      notes: s.chord.triadNotes,
      label: s.chord.symbol,
    }));
    if (steps.length === 0) return;
    void this.audio.startBackingTrack(steps, {
      bpm: this.bpm(),
      baseRootMidi: this.tuning().midiStrings[0],
      grooveId: this.groove(),
      drumsEnabled: this.drumsEnabled(),
    });
  }

  setProgression(degrees: readonly number[]): void {
    this.progressionDegrees.set(degrees);
    if (this.audio.isPlayingTrack()) {
      this.toggleBackingTrack();
      this.toggleBackingTrack();
    }
  }

  setBpm(bpm: number): void {
    this.bpm.set(bpm);
  }

  setGroove(id: GrooveId): void {
    this.groove.set(id);
    if (this.audio.isPlayingTrack()) {
      this.toggleBackingTrack();
      this.toggleBackingTrack();
    }
  }

  setDrumsEnabled(on: boolean): void {
    this.drumsEnabled.set(on);
    if (this.audio.isPlayingTrack()) {
      this.toggleBackingTrack();
      this.toggleBackingTrack();
    }
  }
}
