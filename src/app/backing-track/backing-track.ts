import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GrooveId, listGrooves } from '../audio/audio.service';
import { DiatonicChord } from '../music/chords';

@Component({
  selector: 'app-backing-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="track">
      <div class="header">
        <h3>Backing track</h3>
        <button
          type="button"
          class="play"
          [class.stop]="isPlaying()"
          (click)="playToggled.emit()"
        >
          {{ isPlaying() ? '■ Stop' : '▶ Play' }}
        </button>
      </div>

      <div class="bpm">
        <label>
          <span>BPM</span>
          <input
            type="range"
            min="50"
            max="180"
            [value]="bpm()"
            (input)="onBpmInput($event)"
          />
          <span class="bpm-value">{{ bpm() }}</span>
        </label>
      </div>

      <div class="groove">
        <span class="groove-label">Groove</span>
        <div class="groove-buttons" role="radiogroup" aria-label="Groove pattern">
          @for (g of grooves; track g.id) {
            <button
              type="button"
              role="radio"
              [class.active]="groove() === g.id"
              [attr.aria-checked]="groove() === g.id"
              (click)="grooveChanged.emit(g.id)"
            >
              {{ g.name }}
            </button>
          }
        </div>
        <label class="drums-toggle">
          <input
            type="checkbox"
            [checked]="drumsEnabled()"
            (change)="onDrumsToggle($event)"
          />
          <span>Drums</span>
        </label>
      </div>

      <div class="progression">
        <div class="seq">
          @for (step of resolvedSteps(); track $index; let i = $index) {
            <button
              type="button"
              class="cell"
              [class.active]="currentStep() === i"
              (click)="removeAt(i)"
              title="Click to remove"
            >
              <span class="roman">{{ step.chord.roman }}</span>
              <span class="symbol">{{ step.chord.symbol }}</span>
            </button>
          }
          @if (resolvedSteps().length === 0) {
            <p class="empty">Click a chord below (or in the chord list) to build a progression.</p>
          }
        </div>
        <div class="presets">
          <button type="button" (click)="presetSelected.emit([1, 4, 5, 1])">I-IV-V-I</button>
          <button type="button" (click)="presetSelected.emit([2, 5, 1, 1])">ii-V-I-I</button>
          <button type="button" (click)="presetSelected.emit([1, 6, 4, 5])">I-vi-IV-V</button>
          <button type="button" (click)="presetSelected.emit([1, 1, 4, 5])">12-bar shell</button>
        </div>
      </div>

      <div class="palette">
        <p class="hint">Add chords:</p>
        <div class="chips">
          @for (c of chords(); track c.degree) {
            <button type="button" (click)="addChord(c.degree)">
              <span class="roman">{{ c.roman }}</span>
              <span class="symbol">{{ c.symbol }}</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .track { display: flex; flex-direction: column; gap: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    h3 {
      margin: 0;
      font-size: 14px;
      color: var(--label-fg, #cbd5e1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .play {
      background: var(--accent, #f97316);
      color: #1c1917;
      border: 0;
      border-radius: 6px;
      padding: 6px 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .play.stop { background: #ef4444; color: #fff; }
    .bpm label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--label-fg, #cbd5e1); }
    .bpm input { flex: 1; }
    .bpm-value { font-family: ui-monospace, Menlo, monospace; min-width: 36px; text-align: right; }
    .groove { display: flex; flex-direction: column; gap: 4px; }
    .groove-label { font-size: 12px; color: var(--muted-fg, #94a3b8); }
    .groove-buttons { display: flex; flex-wrap: wrap; gap: 4px; }
    .groove-buttons button {
      background: var(--input-bg, #1e293b);
      border: 1px solid var(--input-border, #334155);
      color: var(--input-fg, #f1f5f9);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .groove-buttons button.active {
      background: var(--accent, #f97316);
      color: #1c1917;
      border-color: transparent;
      font-weight: 600;
    }
    .drums-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--label-fg, #cbd5e1);
      cursor: pointer;
      user-select: none;
    }
    .seq {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 48px;
      padding: 6px;
      border: 1px dashed var(--input-border, #334155);
      border-radius: 6px;
    }
    .cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: var(--input-bg, #1e293b);
      border: 1px solid var(--input-border, #334155);
      color: var(--input-fg, #f1f5f9);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      min-width: 56px;
    }
    .cell.active {
      background: var(--accent, #f97316);
      color: #1c1917;
      border-color: transparent;
    }
    .cell .roman { font-weight: 600; font-size: 11px; opacity: 0.85; }
    .cell .symbol { font-weight: 700; font-size: 14px; }
    .empty { color: var(--muted-fg, #94a3b8); font-size: 12px; padding: 8px; }
    .presets { display: flex; gap: 6px; flex-wrap: wrap; }
    .presets button {
      background: transparent;
      border: 1px solid var(--input-border, #334155);
      color: var(--label-fg, #cbd5e1);
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
    }
    .palette .hint { margin: 0 0 4px; font-size: 12px; color: var(--muted-fg, #94a3b8); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chips button {
      background: var(--input-bg, #1e293b);
      border: 1px solid var(--input-border, #334155);
      color: var(--input-fg, #f1f5f9);
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      gap: 4px;
      align-items: baseline;
    }
    .chips .roman { color: var(--accent, #f97316); font-weight: 600; }
  `,
})
export class BackingTrack {
  readonly chords = input.required<readonly DiatonicChord[]>();
  readonly progressionDegrees = input.required<readonly number[]>();
  readonly bpm = input.required<number>();
  readonly groove = input<GrooveId>('block');
  readonly drumsEnabled = input<boolean>(true);
  readonly isPlaying = input<boolean>(false);
  readonly currentStep = input<number>(-1);

  readonly playToggled = output<void>();
  readonly bpmChanged = output<number>();
  readonly progressionChanged = output<readonly number[]>();
  readonly presetSelected = output<readonly number[]>();
  readonly grooveChanged = output<GrooveId>();
  readonly drumsToggled = output<boolean>();

  protected readonly grooves = listGrooves();

  onDrumsToggle(e: Event): void {
    this.drumsToggled.emit((e.target as HTMLInputElement).checked);
  }

  protected readonly resolvedSteps = computed(() => {
    const degrees = this.progressionDegrees();
    const chords = this.chords();
    const steps: { chord: DiatonicChord }[] = [];
    for (const d of degrees) {
      const chord = chords.find((c) => c.degree === d);
      if (chord) steps.push({ chord });
    }
    return steps;
  });

  addChord(degree: number): void {
    this.progressionChanged.emit([...this.progressionDegrees(), degree]);
  }

  removeAt(idx: number): void {
    const next = [...this.progressionDegrees()];
    next.splice(idx, 1);
    this.progressionChanged.emit(next);
  }

  onBpmInput(e: Event): void {
    this.bpmChanged.emit(Number((e.target as HTMLInputElement).value));
  }
}
