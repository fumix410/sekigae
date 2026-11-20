/** 座席キー: "行-列"（0始まり。行0が教卓側＝最前列、列0が画面左） */
export type SeatKey = string;

export interface Student {
  id: string;
  name: string;
  /** 前方希望（視力など）。設定の frontRows 以内に配置する */
  front: boolean;
}

export type DeskPosition = 'top' | 'bottom';

export interface Layout {
  rows: number;
  cols: number;
  /** 使わない席 */
  disabled: SeatKey[];
  /** 座席表で教卓を上に描くか下に描くか。下のときは教卓から見た向き（180°回転） */
  desk?: DeskPosition;
}

export interface Settings {
  /** 「前方希望」の生徒を前から何番目以内に置くか */
  frontRows: number;
}

export type Constraint =
  | { id: string; type: 'fixedSeat'; a: string; seat: SeatKey }
  | { id: string; type: 'frontRows'; a: string; rows: number }
  | { id: string; type: 'notAdjacent'; a: string; b: string; diagonal: boolean }
  | { id: string; type: 'apart'; a: string; b: string; gap: number }
  | { id: string; type: 'together'; a: string; b: string };

export type ConstraintType = Constraint['type'];

/** 座席 → 生徒ID */
export type Assignment = Record<SeatKey, string>;

export interface Violation {
  key: string;
  message: string;
  studentIds: string[];
}
