import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { noteName, PitchClass } from '../music/notes';
import { fretPitchClass, openPc, stringCount, Tuning } from '../music/tunings';

export interface FretPosition {
  string: number;
  fret: number;
}

interface NoteCell {
  string: number;
  fret: number;
  pc: PitchClass;
  name: string;
  cx: number;
  cy: number;
  isHighlighted: boolean;
  isInPosition: boolean;
  isRoot: boolean;
  isSelected: boolean;
  isActive: boolean;
}

export interface PositionFrame {
  fromFret: number;
  toFret: number;
}

const FRET_X = 64;
const NUT_X = 36;
const FRET_WIDTH = 64;
const STRING_SPACING = 30;
const STRING_TOP = 40;
const PADDING_BOTTOM = 36;
const SINGLE_DOT_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_DOT_FRETS = new Set([12, 24]);

@Component({
  selector: 'app-guitar-neck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guitar-neck.html',
  styleUrl: './guitar-neck.css',
})
export class GuitarNeck {
  readonly tuning = input.required<Tuning>();
  readonly frets = input<number>(22);
  readonly highlightedPitchClasses = input<readonly PitchClass[]>([]);
  readonly rootPitchClass = input<PitchClass | null>(null);
  readonly selectedPositions = input<readonly FretPosition[]>([]);
  readonly useFlats = input<boolean>(false);
  readonly interactive = input<boolean>(true);
  /** When set, only cells in this list are rendered as highlighted notes; others are dimmed. */
  readonly restrictToCells = input<readonly FretPosition[] | null>(null);
  /** When set, draws a translucent frame across the given fret range. */
  readonly positionFrame = input<PositionFrame | null>(null);
  /** Optional override for note labels per pitch class (e.g. degrees, intervals). */
  readonly noteLabels = input<ReadonlyMap<PitchClass, string> | null>(null);
  /** Specific (string, fret) currently sounding during playback. */
  readonly activePosition = input<FretPosition | null>(null);

  readonly positionClick = output<FretPosition>();

  protected readonly width = computed(() => NUT_X + FRET_WIDTH * this.frets() + 24);
  protected readonly height = computed(
    () => STRING_TOP + STRING_SPACING * (stringCount(this.tuning()) - 1) + PADDING_BOTTOM,
  );

  protected readonly stringYs = computed(() => {
    // High string at top (visual order is reversed from tuning order which is low->high).
    const count = stringCount(this.tuning());
    return Array.from({ length: count }, (_, i) => STRING_TOP + i * STRING_SPACING);
  });

  protected readonly highlightMask = computed(() => {
    let mask = 0;
    for (const pc of this.highlightedPitchClasses()) mask |= 1 << pc;
    return mask;
  });

  protected readonly selectedKeys = computed(() => {
    const set = new Set<string>();
    for (const p of this.selectedPositions()) set.add(`${p.string}:${p.fret}`);
    return set;
  });

  protected readonly restrictKeys = computed(() => {
    const list = this.restrictToCells();
    if (!list) return null;
    const set = new Set<string>();
    for (const p of list) set.add(`${p.string}:${p.fret}`);
    return set;
  });

  protected readonly frameRect = computed(() => {
    const frame = this.positionFrame();
    if (!frame) return null;
    const fromX = frame.fromFret === 0 ? 4 : NUT_X + (frame.fromFret - 1) * FRET_WIDTH + 2;
    const toX = NUT_X + frame.toFret * FRET_WIDTH;
    const ys = this.stringYs();
    return {
      x: fromX,
      y: ys[0] - 18,
      width: Math.max(0, toX - fromX),
      height: ys[ys.length - 1] - ys[0] + 36,
    };
  });

  protected readonly fretLines = computed(() => {
    const lines: { x: number; fret: number }[] = [];
    for (let f = 0; f <= this.frets(); f++) {
      const x = f === 0 ? NUT_X : NUT_X + f * FRET_WIDTH;
      lines.push({ x, fret: f });
    }
    return lines;
  });

  protected readonly inlayDots = computed(() => {
    const dots: { cx: number; cy: number; size: number }[] = [];
    const heights = this.stringYs();
    const midY = (heights[0] + heights[heights.length - 1]) / 2;
    const upperY = heights[Math.floor(heights.length / 3)];
    const lowerY = heights[Math.floor((heights.length * 2) / 3)];
    for (let f = 1; f <= this.frets(); f++) {
      const cx = NUT_X + (f - 0.5) * FRET_WIDTH;
      if (DOUBLE_DOT_FRETS.has(f)) {
        dots.push({ cx, cy: upperY, size: 5 });
        dots.push({ cx, cy: lowerY, size: 5 });
      } else if (SINGLE_DOT_FRETS.has(f)) {
        dots.push({ cx, cy: midY, size: 5 });
      }
    }
    return dots;
  });

  protected readonly notes = computed<NoteCell[]>(() => {
    const tuning = this.tuning();
    const useFlats = this.useFlats();
    const labels = this.noteLabels();
    const highlightMask = this.highlightMask();
    const root = this.rootPitchClass();
    const selected = this.selectedKeys();
    const restrict = this.restrictKeys();
    const active = this.activePosition();
    const activeKey = active ? `${active.string}:${active.fret}` : null;
    const count = stringCount(tuning);
    const ys = this.stringYs();
    const cells: NoteCell[] = [];

    for (let s = 0; s < count; s++) {
      // tuning is low->high; visual row 0 is highest string.
      const visualRow = count - 1 - s;
      const cy = ys[visualRow];
      const open = openPc(tuning, s);
      for (let f = 0; f <= this.frets(); f++) {
        const pc = fretPitchClass(open, f);
        const cx = f === 0 ? NUT_X - 18 : NUT_X + (f - 0.5) * FRET_WIDTH;
        const inHighlight = (highlightMask & (1 << pc)) !== 0;
        const key = `${s}:${f}`;
        const inPosition = restrict ? restrict.has(key) : inHighlight;
        const isRoot = root !== null && pc === root;
        cells.push({
          string: s,
          fret: f,
          pc,
          name: labels?.get(pc) ?? noteName(pc, useFlats),
          cx,
          cy,
          isHighlighted: inHighlight,
          isInPosition: inPosition,
          isRoot,
          isSelected: selected.has(key),
          isActive: activeKey !== null && key === activeKey,
        });
      }
    }
    return cells;
  });

  protected readonly fretNumbers = computed(() => {
    const ys = this.stringYs();
    const y = ys[ys.length - 1] + 26;
    const labels: { x: number; y: number; n: number }[] = [];
    for (let f = 1; f <= this.frets(); f++) {
      if (DOUBLE_DOT_FRETS.has(f) || SINGLE_DOT_FRETS.has(f)) {
        labels.push({ x: NUT_X + (f - 0.5) * FRET_WIDTH, y, n: f });
      }
    }
    return labels;
  });

  onCellClick(cell: NoteCell): void {
    if (!this.interactive()) return;
    this.positionClick.emit({ string: cell.string, fret: cell.fret });
  }

  trackCell(_: number, cell: NoteCell): string {
    return `${cell.string}:${cell.fret}`;
  }

  trackFret(_: number, item: { fret: number }): number {
    return item.fret;
  }
}
