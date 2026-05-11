import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PositionSystem, ScalePosition } from '../music/positions';

export type PositionSelection =
  | { kind: 'off' }
  | { kind: 'system'; system: PositionSystem; positionId: string };

@Component({
  selector: 'app-position-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <label>
        <span>Position system</span>
        <select [value]="systemValue()" (change)="onSystemChange($event)">
          <option value="off">Off (show all)</option>
          <option value="5-box">5-Box (CAGED-style)</option>
          <option value="3-nps" [disabled]="!nps7Available()">3-NPS (7 positions)</option>
        </select>
      </label>
      @if (selection().kind === 'system' && positions().length > 0) {
        <label>
          <span>Position</span>
          <select [value]="positionId()" (change)="onPositionChange($event)">
            @for (p of positions(); track p.id) {
              <option [value]="p.id">{{ p.label }} (frets {{ p.fretRange.from }}–{{ p.fretRange.to }})</option>
            }
          </select>
        </label>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .picker {
      display: flex;
      gap: 16px;
      align-items: end;
      flex-wrap: wrap;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--label-fg, #cbd5e1);
    }
    select {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--input-border, #475569);
      background: var(--input-bg, #1e293b);
      color: var(--input-fg, #f1f5f9);
      font-size: 14px;
      min-width: 200px;
    }
    select option:disabled { color: #64748b; }
  `,
})
export class PositionPicker {
  readonly selection = input.required<PositionSelection>();
  readonly positions = input<readonly ScalePosition[]>([]);
  readonly nps7Available = input<boolean>(false);

  readonly selectionChange = output<PositionSelection>();

  protected readonly systemValue = computed(() => {
    const sel = this.selection();
    return sel.kind === 'off' ? 'off' : sel.system;
  });

  protected readonly positionId = computed(() => {
    const sel = this.selection();
    return sel.kind === 'system' ? sel.positionId : '';
  });

  onSystemChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'off') {
      this.selectionChange.emit({ kind: 'off' });
      return;
    }
    const system = value as PositionSystem;
    const first = this.positions()[0];
    this.selectionChange.emit({
      kind: 'system',
      system,
      positionId: first?.id ?? '',
    });
  }

  onPositionChange(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    const sel = this.selection();
    if (sel.kind !== 'system') return;
    this.selectionChange.emit({ ...sel, positionId: id });
  }
}
