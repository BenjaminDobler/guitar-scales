import { computed, Injectable, signal } from '@angular/core';
import * as Tone from 'tone';
import { PitchClass } from '../music/notes';
import { FingeringStep } from '../music/positions';

export interface ProgressionStep {
  /** Pitch classes of the chord (root first). */
  notes: readonly PitchClass[];
  /** Display label for visual highlighting (optional). */
  label?: string;
}

export interface BackingTrackOptions {
  bpm: number;
  beatsPerBar?: number;
  /** Lowest note the chord voicing will land on, in MIDI. Defaults to C3 (48). */
  baseRootMidi?: number;
  /** Rhythmic pattern. Defaults to 'block'. */
  grooveId?: GrooveId;
  /** When false, suppress drum hits in the groove. Default true. */
  drumsEnabled?: boolean;
}

export type GrooveId = 'block' | 'rock-8ths' | 'shuffle' | 'ballad' | 'bossa';

type GrooveVoice = 'chord' | 'bass' | 'arp' | 'kick' | 'snare' | 'hat';

interface GrooveEvent {
  /** Bar-relative onset, 0..1. */
  time: number;
  /** Duration as a fraction of the bar (ignored for drum voices). */
  duration: number;
  voice: GrooveVoice;
  /** Velocity scaling 0..1 (default 1). */
  velocity?: number;
  /** For chord voice: stagger notes slightly. */
  strum?: boolean;
  /** For arp voice: which chord tone (mod chord size). */
  arpIndex?: number;
}

// Generate an evenly-spaced run of drum hits (e.g. eighth-note hi-hats) with optional accents.
function hatEighths(velocityOn: number, velocityOff: number): GrooveEvent[] {
  return Array.from({ length: 8 }, (_, i) => ({
    time: i * 0.125,
    duration: 0.05,
    voice: 'hat' as const,
    velocity: i % 2 === 0 ? velocityOn : velocityOff,
  }));
}

function hatShuffled(velocityOn: number, velocityOff: number): GrooveEvent[] {
  // Triplet feel: long-short pairs per beat.
  return [0, 0.25, 0.5, 0.75].flatMap((beat) => [
    { time: beat, duration: 0.05, voice: 'hat' as const, velocity: velocityOn },
    { time: beat + 0.166, duration: 0.05, voice: 'hat' as const, velocity: velocityOff },
  ]);
}

interface GrooveDef {
  id: GrooveId;
  name: string;
  events: readonly GrooveEvent[];
}

const GROOVES: readonly GrooveDef[] = [
  {
    id: 'block',
    name: 'Block (1 + 3)',
    events: [
      { time: 0, duration: 0.95, voice: 'chord', strum: true },
      { time: 0, duration: 0.45, voice: 'bass' },
      { time: 0.5, duration: 0.45, voice: 'bass' },
      // Sparse drums: kick on 1, snare on 3.
      { time: 0, duration: 0.05, voice: 'kick', velocity: 0.9 },
      { time: 0.5, duration: 0.05, voice: 'snare', velocity: 0.7 },
    ],
  },
  {
    id: 'rock-8ths',
    name: 'Rock 8ths',
    events: [
      ...Array.from({ length: 8 }, (_, i) => ({
        time: i * 0.125,
        duration: 0.11,
        voice: 'chord' as const,
        velocity: i % 2 === 0 ? 1 : 0.55,
      })),
      { time: 0, duration: 0.45, voice: 'bass' },
      { time: 0.5, duration: 0.45, voice: 'bass' },
      // Backbeat: kick 1 & 3, snare 2 & 4, hat on every 8th.
      { time: 0, duration: 0.05, voice: 'kick', velocity: 1 },
      { time: 0.5, duration: 0.05, voice: 'kick', velocity: 1 },
      { time: 0.25, duration: 0.05, voice: 'snare', velocity: 0.9 },
      { time: 0.75, duration: 0.05, voice: 'snare', velocity: 0.9 },
      ...hatEighths(0.7, 0.45),
    ],
  },
  {
    id: 'shuffle',
    name: 'Shuffle',
    events: [
      // Triplet feel: long-short pairs per beat (2/3 + 1/3).
      ...[0, 0.25, 0.5, 0.75].flatMap((beat) => [
        { time: beat, duration: 0.13, voice: 'chord' as const },
        { time: beat + 0.166, duration: 0.07, voice: 'chord' as const, velocity: 0.5 },
      ]),
      { time: 0, duration: 0.22, voice: 'bass' },
      { time: 0.25, duration: 0.22, voice: 'bass' },
      { time: 0.5, duration: 0.22, voice: 'bass' },
      { time: 0.75, duration: 0.22, voice: 'bass' },
      // Shuffle hat + backbeat.
      { time: 0, duration: 0.05, voice: 'kick', velocity: 1 },
      { time: 0.5, duration: 0.05, voice: 'kick', velocity: 1 },
      { time: 0.25, duration: 0.05, voice: 'snare', velocity: 0.85 },
      { time: 0.75, duration: 0.05, voice: 'snare', velocity: 0.85 },
      ...hatShuffled(0.6, 0.35),
    ],
  },
  {
    id: 'ballad',
    name: 'Ballad arp',
    events: [
      { time: 0, duration: 0.95, voice: 'bass' },
      { time: 0, duration: 0.22, voice: 'arp', arpIndex: 0 },
      { time: 0.25, duration: 0.22, voice: 'arp', arpIndex: 1 },
      { time: 0.5, duration: 0.22, voice: 'arp', arpIndex: 2 },
      { time: 0.75, duration: 0.22, voice: 'arp', arpIndex: 3 },
      // Soft brushy backbeat, no hat.
      { time: 0, duration: 0.05, voice: 'kick', velocity: 0.55 },
      { time: 0.5, duration: 0.05, voice: 'snare', velocity: 0.4 },
    ],
  },
  {
    id: 'bossa',
    name: 'Bossa',
    events: [
      // Classic bossa comping skeleton.
      { time: 0, duration: 0.18, voice: 'chord' },
      { time: 0.375, duration: 0.18, voice: 'chord' },
      { time: 0.625, duration: 0.18, voice: 'chord' },
      { time: 0.875, duration: 0.12, voice: 'chord' },
      { time: 0, duration: 0.42, voice: 'bass' },
      { time: 0.5, duration: 0.42, voice: 'bass' },
      // Bossa kick + side-stick clave-ish + steady eighths.
      { time: 0, duration: 0.05, voice: 'kick', velocity: 0.85 },
      { time: 0.5, duration: 0.05, voice: 'kick', velocity: 0.85 },
      // 3-2 clave fragment as a quiet side-stick.
      { time: 0.25, duration: 0.05, voice: 'snare', velocity: 0.45 },
      { time: 0.625, duration: 0.05, voice: 'snare', velocity: 0.45 },
      { time: 0.875, duration: 0.05, voice: 'snare', velocity: 0.45 },
      ...hatEighths(0.45, 0.3),
    ],
  },
];

export function listGrooves(): readonly { id: GrooveId; name: string }[] {
  return GROOVES.map((g) => ({ id: g.id, name: g.name }));
}

function getGroove(id: GrooveId | undefined): GrooveDef {
  return GROOVES.find((g) => g.id === id) ?? GROOVES[0];
}

/** Place a chord (pitch classes) into MIDI roughly around a base octave. Root sits low; rest stack up. */
function voiceChord(notes: readonly PitchClass[], baseRootMidi = 48): number[] {
  if (notes.length === 0) return [];
  const root = notes[0];
  const rootMidi = baseRootMidi + ((((root - (baseRootMidi % 12)) % 12) + 12) % 12);
  const out: number[] = [rootMidi];
  let prev = rootMidi;
  for (let i = 1; i < notes.length; i++) {
    const pc = notes[i];
    let next = prev + ((((pc - (prev % 12)) % 12) + 12) % 12);
    if (next === prev) next += 12;
    out.push(next);
    prev = next;
  }
  return out;
}

const midiToFreq = (m: number): string => Tone.Frequency(m, 'midi').toNote();

@Injectable({ providedIn: 'root' })
export class AudioService {
  private synth: Tone.PolySynth | null = null;
  private bassSynth: Tone.PolySynth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.NoiseSynth | null = null;
  private backingPart: Tone.Part | null = null;
  private initialized = false;

  private readonly _isPlayingTrack = signal(false);
  readonly isPlayingTrack = computed(() => this._isPlayingTrack());

  private readonly _currentStep = signal(-1);
  readonly currentStep = computed(() => this._currentStep());

  private readonly _currentScalePosition = signal<{ string: number; fret: number } | null>(null);
  readonly currentScalePosition = computed(() => this._currentScalePosition());

  private scaleTimeouts: number[] = [];

  private readonly _enabled = signal(false);
  readonly enabled = computed(() => this._enabled());

  private clearScaleTimeouts(): void {
    for (const id of this.scaleTimeouts) clearTimeout(id);
    this.scaleTimeouts = [];
    this._currentScalePosition.set(null);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
    // Plucky guitar-ish polyphonic voice.
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fattriangle' },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.6 },
      volume: -8,
    }).toDestination();
    this.bassSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.5 },
      volume: -10,
    }).toDestination();
    this.initialized = true;
    this._enabled.set(true);
  }

  /**
   * Drum synths keep internal oscillator/noise state timelines that can drift out of
   * order after a stop-then-start cycle (the cause of "time must be ≥ last scheduled
   * time" errors). Recreating them from scratch on every backing-track start gives
   * Tone a clean slate.
   */
  private recreateDrums(): void {
    this.kick?.dispose();
    this.snare?.dispose();
    this.hat?.dispose();
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
      volume: -4,
    }).toDestination();
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.03 },
      volume: -12,
    }).toDestination();
    const hatFilter = new Tone.Filter(7000, 'highpass').toDestination();
    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -22,
    }).connect(hatFilter);
  }

  async playNote(midi: number, sustainSec = 0.8): Promise<void> {
    await this.init();
    if (!this.synth) return;
    // Layered over the backing track on purpose — single-note preview shouldn't stop the loop.
    this.synth.triggerAttackRelease(midiToFreq(midi), sustainSec, Tone.now() + 0.01);
  }

  async playScale(steps: readonly FingeringStep[], noteMs = 220): Promise<void> {
    await this.init();
    if (!this.synth) return;
    this.stopBackingTrack();
    this.clearScaleTimeouts();
    if (steps.length === 0) return;
    const now = Tone.now() + 0.05;
    const dur = noteMs / 1000;
    // 50ms aligns with the 0.05s audio offset above.
    const startDelay = 50;
    steps.forEach((step, i) => {
      this.synth!.triggerAttackRelease(midiToFreq(step.midi), dur * 0.95, now + i * dur);
      this.scaleTimeouts.push(
        window.setTimeout(
          () => this._currentScalePosition.set({ string: step.string, fret: step.fret }),
          startDelay + i * noteMs,
        ),
      );
    });
    this.scaleTimeouts.push(
      window.setTimeout(() => this._currentScalePosition.set(null), startDelay + steps.length * noteMs),
    );
  }

  async playChord(
    notes: readonly PitchClass[],
    opts: { strum?: boolean; sustainSec?: number; baseRootMidi?: number } = {},
  ): Promise<void> {
    await this.init();
    if (!this.synth) return;
    this.stopBackingTrack();
    this.clearScaleTimeouts();
    const { strum = true, sustainSec = 1.6, baseRootMidi = 48 } = opts;
    const midis = voiceChord(notes, baseRootMidi);
    const now = Tone.now() + 0.05;
    midis.forEach((m, i) => {
      const offset = strum ? i * 0.025 : 0;
      this.synth!.triggerAttackRelease(midiToFreq(m), sustainSec, now + offset);
    });
  }

  async startBackingTrack(
    progression: readonly ProgressionStep[],
    opts: BackingTrackOptions,
  ): Promise<void> {
    await this.init();
    if (!this.synth || !this.bassSynth) return;
    if (progression.length === 0) return;
    this.stopBackingTrack();
    this.clearScaleTimeouts();
    this.recreateDrums();

    const beatsPerBar = opts.beatsPerBar ?? 4;
    const barSec = (60 / opts.bpm) * beatsPerBar;
    const baseRootMidi = opts.baseRootMidi ?? 48;
    const groove = getGroove(opts.grooveId);
    const drumsEnabled = opts.drumsEnabled ?? true;

    const events = progression.map((step, i) => ({ time: i * barSec, step, index: i }));

    this.backingPart = new Tone.Part((time, value: { step: ProgressionStep; index: number }) => {
      const midis = voiceChord(value.step.notes, baseRootMidi);
      const bassMidi = midis[0] - 12;
      for (const ev of groove.events) {
        const at = time + ev.time * barSec;
        const dur = ev.duration * barSec;
        const vel = ev.velocity ?? 1;
        switch (ev.voice) {
          case 'bass':
            this.bassSynth!.triggerAttackRelease(midiToFreq(bassMidi), dur, at, vel);
            break;
          case 'arp': {
            const len = midis.length;
            const idx = ((((ev.arpIndex ?? 0) % len) + len) % len);
            this.synth!.triggerAttackRelease(midiToFreq(midis[idx]), dur, at, vel);
            break;
          }
          case 'chord':
            if (ev.strum) {
              midis.forEach((m, i) => {
                this.synth!.triggerAttackRelease(midiToFreq(m), dur, at + i * 0.018, vel);
              });
            } else {
              midis.forEach((m) => {
                this.synth!.triggerAttackRelease(midiToFreq(m), dur, at, vel);
              });
            }
            break;
          case 'kick':
            if (drumsEnabled) this.kick!.triggerAttackRelease('C2', 0.1, at, vel);
            break;
          case 'snare':
            if (drumsEnabled) this.snare!.triggerAttackRelease(0.12, at, vel);
            break;
          case 'hat':
            if (drumsEnabled) this.hat!.triggerAttackRelease(0.04, at, vel);
            break;
        }
      }
      Tone.Draw.schedule(() => {
        this._currentStep.set(value.index);
      }, time);
    }, events);

    this.backingPart.loop = true;
    this.backingPart.loopEnd = progression.length * barSec;
    this.backingPart.start(0);
    Tone.getTransport().start();
    this._isPlayingTrack.set(true);
  }

  stopBackingTrack(): void {
    if (this.backingPart) {
      this.backingPart.stop();
      this.backingPart.dispose();
      this.backingPart = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().cancel(0);
    this._isPlayingTrack.set(false);
    this._currentStep.set(-1);
  }
}
