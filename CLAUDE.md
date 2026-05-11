# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Generic Angular/TypeScript style rules live in `.claude/CLAUDE.md` (added by `ng new`). This file covers only what is specific to this project.

## Commands

- `npm start` — dev server on port 4200 (`ng serve`). Pass `-- --port 4201` if 4200 is taken by another local Angular project.
- `npm run build` — production build via `@angular/build:application` (esbuild).
- `npm test` — Vitest via `@angular/build:unit-test`.
- `npx ng test --include src/app/music/...spec.ts` — run a single test file.

This is a **zoneless** Angular 21 app (no `zone.js` polyfill). Change detection is provided by `provideZonelessChangeDetection()` in `src/app/app.config.ts`.

## Architecture

The app is a single-page tool for exploring guitar scales, the chords they generate, and (in lick-finder mode) the scales a chosen lick fits into.

### Layered structure

1. **`src/app/music/`** — Pure TypeScript domain model. No Angular imports. All functions take primitives or plain objects and return new ones.
   - `notes.ts` — `PitchClass = 0..11`, sharp/flat name tables, `transpose()`.
   - `scales.ts` — `SCALES` (modes + minors + pentatonics + blues), `buildScale(root, def)` produces a `BuiltScale { root, scale, pitchClasses }`. `pitchClassSet()` / `scaleMask()` produce 12-bit bitmasks for fast set ops.
   - `chords.ts` — `diatonicChords(built)` walks the scale degrees, classifies the resulting triad and 7th by interval pattern, and returns roman numerals + symbols + note arrays.
   - `lick-finder.ts` — `findScalesContaining(notes)` runs `(12 roots × N scales)` superset checks using the pitch-class bitmask and ranks matches by scale size and whether the lick contains the scale's root.
   - `positions.ts` — `computePositions(built, tuning, fretCount, system)` returns an array of `ScalePosition` (id, label, fret range, cells). Two systems: `'5-box'` (CAGED-style, anchors on root positions across strings, Box 1 starts on root on the lowest string) and `'3-nps'` (3-notes-per-string, only available for 7-note scales, anchors on each scale degree on the lowest string). Note: the visual frame produced by `'5-box'` differs from textbook fingerings by ±1 fret on some boxes because conventional fingering frames extend slightly outside the strict root-to-root window — the scale notes contained are the same.
   - `tunings.ts` — `Tuning { strings: PitchClass[] }` low → high. `fretPitchClass(open, fret)` computes a position's pitch class.

2. **`src/app/audio/audio.service.ts`** — `providedIn: 'root'` Tone.js wrapper. Lazy-init on first user gesture (`Tone.start()`). Exposes `playScale`, `playChord`, `startBackingTrack`, `stopBackingTrack`, plus `isPlayingTrack` and `currentStep` signals. Uses two `PolySynth` voices (chord + bass). All chord/scale voicing logic (octave assignment) lives here in `voiceChord` / `voiceScale`.

3. **Components** — Each is a folder under `src/app/`, OnPush, signal-input/output. None of them know about each other; they communicate only through `App`.
   - `guitar-neck/` — SVG fretboard. Inputs: `tuning`, `frets`, `highlightedPitchClasses`, `rootPitchClass`, `selectedPositions`, `interactive`. Output: `positionClick`. The neck is purely presentational — it does not know about scales or lick mode.
   - `scale-picker/` — Root + scale dropdowns and the flats/sharps toggle.
   - `chord-list/` — Diatonic chord table for a `BuiltScale`. Emits the active degree on row click.
   - `lick-finder/` — Lists matching scales for the current set of selected pitch classes. Clicking a match swaps the app into scale mode for that scale.
   - `backing-track/` — Chord-vamp progression builder + transport. Renders the queue, lets the user add/remove diatonic chords or pick a preset (I-IV-V, ii-V-I, etc.), and emits play/stop/BPM events.

3. **`App` (`src/app/app.ts`)** — The only stateful component. Owns the signals: `root`, `scaleId`, `useFlats`, `tuningId`, `mode` (`'scale' | 'lick'`), `selectedPositions`, `activeDegree`. Derives `built`, `chords`, `activeChord`, `highlightedPitchClasses`, `rootForNeck`, `lickNotes` via `computed()`.

### Key design choices

- **Pitch classes, not absolute pitches.** Everything except (eventually) audio works in 0..11 modular arithmetic. Octaves only enter if/when sound is added.
- **Bitmask set operations.** A scale or lick is a 12-bit mask; "is the lick contained in this scale" is `(lick & scale) === lick`. This keeps `findScalesContaining` cheap so it can run on every click.
- **Tuning carries MIDI.** `Tuning.midiStrings` is the canonical low-to-high list; `openPc(tuning, s)` derives the pitch class. The neck reverses string order for rendering. Audio playback uses MIDI directly; everything else uses pitch classes. Adding a new tuning is one entry in `TUNINGS`.

- **Display labels are computed in `App`** via `buildLabelMap(built, mode, useFlats)` and passed as a `Map<PitchClass, string>` to `<app-guitar-neck>`. The neck falls back to `noteName()` if the map has no entry. This lets the app show note names, scale degrees, or intervals without the neck knowing music theory.

- **Audio is single-flight.** Starting a backing track stops any in-flight scale/chord playback (and vice versa). The audio service holds the only `Tone.Part` so there is exactly one transport schedule alive at a time.
- **Highlight precedence on the neck.** When a chord row is selected (`activeDegree` set), `highlightedPitchClasses` switches from "all scale notes" to "chord notes" and `rootForNeck` becomes the chord root. In lick mode, the neck shows only `selectedPositions` and ignores `highlightedPitchClasses`. When a position is selected (and no chord is active), the neck dims notes outside the position cells and draws a translucent frame across the position's fret range — see `restrictToCells` and `positionFrame` inputs on `<app-guitar-neck>`.
- **Click semantics on the neck depend on `mode`.** `App.onPositionClick` is a no-op in scale mode; in lick mode it toggles the position. The neck's `interactive` input is bound to `mode() === 'lick'` so non-highlighted cells only show hover state when clicks would do something.

### Extending

- **New scale**: add a `ScaleDefinition` to `SCALES`. The lick finder, chord list, and neck pick it up automatically.
- **New tuning**: add a `Tuning` to `TUNINGS`. The neck reads `tuning.strings.length` for string count.
- **Audio (future)**: octaves currently aren't tracked. Add an `octave` to `Tuning.strings` (or a parallel array) and compute MIDI numbers in `tunings.ts` before wiring a synth.
