import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { chordNoteNames, DiatonicChord } from '../music/chords';
import { BuiltScale } from '../music/scales';

@Component({
  selector: 'app-chord-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list">
      <h3>Chords in {{ heading() }}</h3>
      @if (sourceScaleName()) {
        <p class="source-hint">Harmonized from parent scale: {{ sourceScaleName() }}</p>
      }
      @if (chords().length === 0) {
        <p class="empty">This scale produces no clean diatonic triads (e.g. fewer than 7 notes).</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Degree</th>
              <th>Triad</th>
              <th>7th</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of chords(); track c.degree) {
              <tr
                [class.active]="activeDegree() === c.degree"
                (click)="select(c.degree)"
              >
                <td class="roman">{{ c.roman }}</td>
                <td class="symbol">{{ c.symbol }}</td>
                <td class="seventh">{{ seventhSymbol(c) }}</td>
                <td class="notes">{{ noteList(c.seventhNotes) }}</td>
                <td>
                  @if (activeDegree() === c.degree) {
                    <button type="button" (click)="clear($event)">Clear</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--label-fg, #cbd5e1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .empty { color: var(--muted-fg, #94a3b8); font-size: 13px; }
    .source-hint {
      margin: -4px 0 8px;
      font-size: 12px;
      color: var(--muted-fg, #94a3b8);
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      text-align: left;
      padding: 6px 10px;
      color: var(--muted-fg, #94a3b8);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--divider, #334155);
    }
    td { padding: 8px 10px; border-bottom: 1px solid var(--divider-soft, #1e293b); }
    tr { cursor: pointer; }
    tr:hover { background: var(--row-hover, rgba(56, 189, 248, 0.06)); }
    tr.active { background: var(--row-active, rgba(249, 115, 22, 0.14)); }
    .roman { font-weight: 600; color: var(--accent, #f97316); width: 60px; }
    .symbol { font-weight: 600; }
    .seventh { color: var(--muted-fg, #94a3b8); }
    .notes { color: var(--muted-fg, #cbd5e1); font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    button {
      background: transparent;
      border: 1px solid var(--input-border, #475569);
      color: var(--label-fg, #cbd5e1);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
    }
  `,
})
export class ChordList {
  readonly built = input.required<BuiltScale>();
  readonly chords = input.required<readonly DiatonicChord[]>();
  readonly useFlats = input<boolean>(false);
  readonly activeDegree = input<number | null>(null);
  readonly sourceScaleName = input<string | null>(null);

  readonly degreeSelected = output<number | null>();

  protected readonly heading = computed(() => {
    const built = this.built();
    return `${chordNoteNames([built.pitchClasses[0]], this.useFlats())[0]} ${built.scale.name}`;
  });

  protected seventhSymbol(c: DiatonicChord): string {
    const root = chordNoteNames([c.root], this.useFlats())[0];
    const map: Record<typeof c.quality, string> = {
      maj: 'maj7',
      min: 'm7',
      dim: 'm7♭5',
      aug: 'maj7♯5',
      maj7: 'maj7',
      min7: 'm7',
      dom7: '7',
      min7b5: 'm7♭5',
      dim7: 'dim7',
      minMaj7: 'mMaj7',
    };
    return root + map[c.quality];
  }

  protected noteList(notes: readonly number[]): string {
    return chordNoteNames(notes as Parameters<typeof chordNoteNames>[0], this.useFlats()).join(' · ');
  }

  select(degree: number): void {
    this.degreeSelected.emit(this.activeDegree() === degree ? null : degree);
  }

  clear(e: Event): void {
    e.stopPropagation();
    this.degreeSelected.emit(null);
  }
}
