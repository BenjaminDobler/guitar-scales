import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { findScalesContaining, ScaleMatch } from '../music/lick-finder';
import { noteName, PitchClass } from '../music/notes';

@Component({
  selector: 'app-lick-finder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="finder">
      <div class="header">
        <h3>Lick → Scales</h3>
        @if (notes().length > 0) {
          <button type="button" class="clear" (click)="clearClicked.emit()">Clear lick</button>
        }
      </div>

      @if (notes().length === 0) {
        <p class="hint">
          Switch to <strong>Lick mode</strong> and click positions on the neck. Matches appear here.
        </p>
      } @else {
        <p class="lick">
          Notes: <span class="set">{{ noteSet() }}</span>
        </p>
        <p class="count">{{ matches().length }} matching scales</p>
        <ul>
          @for (m of matches(); track $index) {
            <li
              [class.complete]="m.containsRoot"
              (click)="matchPicked.emit(m)"
            >
              <span class="root">{{ m.rootName }}</span>
              <span class="name">{{ m.scale.name }}</span>
              @if (!m.containsRoot) {
                <span class="warn" title="Lick is in this scale, but doesn't contain its root">
                  no root
                </span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    h3 {
      margin: 0;
      font-size: 14px;
      color: var(--label-fg, #cbd5e1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .clear {
      background: transparent;
      border: 1px solid var(--input-border, #475569);
      color: var(--label-fg, #cbd5e1);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .hint, .lick, .count { margin: 4px 0; font-size: 13px; color: var(--muted-fg, #94a3b8); }
    .set {
      font-family: ui-monospace, Menlo, monospace;
      color: var(--note-selected-bg, #facc15);
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
      max-height: 280px;
      overflow-y: auto;
    }
    li {
      display: flex;
      gap: 10px;
      align-items: baseline;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    li:hover { background: var(--row-hover, rgba(56, 189, 248, 0.08)); }
    li .root { font-weight: 700; color: var(--accent, #f97316); width: 28px; }
    li .name { flex: 1; font-size: 14px; }
    li .warn { color: var(--muted-fg, #94a3b8); font-size: 11px; }
    li.complete { background: rgba(34, 197, 94, 0.05); }
  `,
})
export class LickFinder {
  readonly notes = input.required<readonly PitchClass[]>();
  readonly useFlats = input<boolean>(false);

  readonly matchPicked = output<ScaleMatch>();
  readonly clearClicked = output<void>();

  protected readonly matches = computed(() => findScalesContaining(this.notes(), undefined, this.useFlats()));

  protected readonly noteSet = computed(() => {
    const seen = new Set<PitchClass>();
    const ordered: PitchClass[] = [];
    for (const pc of this.notes()) {
      if (!seen.has(pc)) {
        seen.add(pc);
        ordered.push(pc);
      }
    }
    return ordered.map((pc) => noteName(pc, this.useFlats())).join(' · ');
  });
}
