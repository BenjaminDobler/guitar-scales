import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { noteName, PitchClass } from '../music/notes';
import { SCALES, ScaleDefinition } from '../music/scales';

interface ScaleGroup {
  category: ScaleDefinition['category'];
  label: string;
  scales: ScaleDefinition[];
}

const CATEGORY_LABELS: Record<ScaleDefinition['category'], string> = {
  'major-modes': 'Major-scale modes',
  minor: 'Minor variants',
  pentatonic: 'Pentatonic',
  other: 'Other',
};

@Component({
  selector: 'app-scale-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <label>
        <span>Root</span>
        <select [value]="root()" (change)="onRootChange($event)">
          @for (note of rootOptions(); track note.value) {
            <option [value]="note.value">{{ note.label }}</option>
          }
        </select>
      </label>
      <label>
        <span>Scale</span>
        <select [value]="scaleId()" (change)="onScaleChange($event)">
          @for (group of groups; track group.category) {
            <optgroup [label]="group.label">
              @for (s of group.scales; track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </optgroup>
          }
        </select>
      </label>
      <label class="check">
        <input type="checkbox" [checked]="useFlats()" (change)="onFlatsChange($event)" />
        <span>Show flats</span>
      </label>
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
      min-width: 180px;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      padding-bottom: 6px;
    }
  `,
})
export class ScalePicker {
  readonly root = input.required<PitchClass>();
  readonly scaleId = input.required<string>();
  readonly useFlats = input<boolean>(false);

  readonly rootChange = output<PitchClass>();
  readonly scaleIdChange = output<string>();
  readonly useFlatsChange = output<boolean>();

  protected readonly rootOptions = computed(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: noteName(i as PitchClass, this.useFlats()),
    })),
  );

  protected readonly groups: ScaleGroup[] = (() => {
    const map = new Map<ScaleDefinition['category'], ScaleDefinition[]>();
    for (const s of SCALES) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries()).map(([category, scales]) => ({
      category,
      label: CATEGORY_LABELS[category],
      scales,
    }));
  })();

  onRootChange(e: Event): void {
    const v = Number((e.target as HTMLSelectElement).value) as PitchClass;
    this.rootChange.emit(v);
  }

  onScaleChange(e: Event): void {
    this.scaleIdChange.emit((e.target as HTMLSelectElement).value);
  }

  onFlatsChange(e: Event): void {
    this.useFlatsChange.emit((e.target as HTMLInputElement).checked);
  }
}
