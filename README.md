# Guitar Scales

Interactive tool for exploring guitar scales, the chords they generate, and the scales that fit a given lick. Built with Angular 21 (zoneless, signals) and Tone.js.

**Live: https://benjamindobler.github.io/guitar-scales/**

## Features

- **Scale picker** with modes, minors, pentatonics, and blues; sharp/flat toggle.
- **SVG fretboard** with multiple tunings (Standard, Drop D, DADGAD, Open G, half-step down, 7-string).
- **Display modes** — show notes, scale degrees, or intervals on every fret position.
- **Diatonic chord list** with roman numerals and 7th extensions. Pentatonic and blues scales fall back to their parent scale's chords (e.g. A minor pentatonic shows A Aeolian's i–VII).
- **CAGED 5-box and 3-notes-per-string positions** with a translucent fret-window frame.
- **Lick finder** — click positions on the neck to mark a melodic idea; the app lists every scale that contains those notes.
- **Audio playback** — scale arpeggios, chord stabs, and a looping backing track. Playback uses the current tuning's lowest-string MIDI so register matches the instrument.
- **Backing-track grooves** — Block, Rock 8ths, Shuffle, Ballad arp, and Bossa, each with a synthesized drum pattern (kick / snare / hi-hat). Drums can be toggled off.
- **Playback highlighting** — the specific fret currently sounding pulses on the neck during scale playback.

## Local development

```bash
npm install
npm start          # dev server on http://localhost:4200
npm test           # Vitest
npm run build      # production build via @angular/build (esbuild)
```

## Deployment

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. See `.github/workflows/deploy.yml`.

## Architecture

Layered:

1. **`src/app/music/`** — pure TypeScript domain model (no Angular imports): pitch classes, scale definitions, chord classification, lick finder, position generation, tunings.
2. **`src/app/audio/`** — Tone.js wrapper. Scale, chord, and backing-track playback live here; everything else stays free of audio concerns.
3. **Components** — `guitar-neck`, `scale-picker`, `chord-list`, `lick-finder`, `position-picker`, `backing-track`. Each is OnPush, signal-based, and communicates only through the `App` shell.
4. **`App` (`src/app/app.ts`)** — the only stateful component. Owns the signals and derives everything else with `computed()`.

See `CLAUDE.md` for the deeper design notes.
