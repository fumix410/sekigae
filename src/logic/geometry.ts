import type { Layout, SeatKey } from '../types';

export interface Pos {
  r: number;
  c: number;
}

export const seatKey = (r: number, c: number): SeatKey => `${r}-${c}`;

export function parseSeat(key: SeatKey): Pos {
  const [r, c] = key.split('-').map(Number);
  return { r, c };
}

export const manhattan = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
export const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
/** 同じ行で左右に隣り合っている */
export const isSideBySide = (a: Pos, b: Pos) => a.r === b.r && Math.abs(a.c - b.c) === 1;

export function inBounds(layout: Layout, p: Pos): boolean {
  return p.r >= 0 && p.c >= 0 && p.r < layout.rows && p.c < layout.cols;
}

export function isEnabled(layout: Layout, key: SeatKey): boolean {
  return inBounds(layout, parseSeat(key)) && !layout.disabled.includes(key);
}

export function enabledSeats(layout: Layout): SeatKey[] {
  const disabled = new Set(layout.disabled);
  const out: SeatKey[] = [];
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const k = seatKey(r, c);
      if (!disabled.has(k)) out.push(k);
    }
  }
  return out;
}

/** 画面（や Excel）に描く順の行番号・列番号。教卓が下なら 180° 回して並べる */
export function displayOrder(layout: Layout): { rows: number[]; cols: number[] } {
  const rows = Array.from({ length: layout.rows }, (_, i) => i);
  const cols = Array.from({ length: layout.cols }, (_, i) => i);
  return layout.desk === 'bottom' ? { rows: rows.reverse(), cols: cols.reverse() } : { rows, cols };
}

export function seatLabel(key: SeatKey): string {
  const { r, c } = parseSeat(key);
  return `前から${r + 1}番目・左から${c + 1}番目`;
}
