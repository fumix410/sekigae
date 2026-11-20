/** このアプリで書き出した座席表 Excel（座席表・名簿の2シート）の読み戻し。UI に依存しない純粋関数 */
import type { DeskPosition, Layout, SeatKey } from '../types';
import { cellText, isTruthy } from './roster';
import type { RosterEntry } from './roster';
import { seatKey } from './geometry';

export interface WorkbookSheet {
  sheet: string;
  data: readonly (readonly unknown[])[];
}

export interface ExcelRestore {
  students: RosterEntry[];
  /** 席 → students の添字 */
  seats: Record<SeatKey, number>;
  layout: { rows: number; cols: number; desk: DeskPosition };
  /** 教室の大きさをファイル（または今の教室の設定）から確実に決められたか */
  sizeCertain: boolean;
}

const LABEL = /前から\s*(\d+)\s*番目\s*・\s*左から\s*(\d+)\s*番目/;

/** 「前から2番目・左から3番目」→ { r: 1, c: 2 } */
export function parseSeatLabel(label: string): { r: number; c: number } | null {
  const m = LABEL.exec(label);
  if (!m) return null;
  const r = Number(m[1]) - 1;
  const c = Number(m[2]) - 1;
  return r >= 0 && c >= 0 ? { r, c } : null;
}

interface ListEntry extends RosterEntry {
  label: { r: number; c: number } | null;
}

/** 「名簿」シート（見出しに「名前」と「席」がある）を読む。形が違えば null */
function readList(data: WorkbookSheet['data']): ListEntry[] | null {
  const rows = data.map((r) => r.map(cellText));
  const headIdx = rows.findIndex((r) => r.some(Boolean));
  if (headIdx < 0) return null;
  const head = rows[headIdx];
  const nameCol = head.indexOf('名前');
  const seatCol = head.indexOf('席');
  if (nameCol < 0 || seatCol < 0) return null;
  const frontCol = head.findIndex((h) => /前方/.test(h));
  return rows
    .slice(headIdx + 1)
    .map((r) => ({
      name: r[nameCol] ?? '',
      front: frontCol >= 0 && isTruthy(r[frontCol] ?? ''),
      label: parseSeatLabel(r[seatCol] ?? ''),
    }))
    .filter((e) => e.name !== '');
}

interface GridCell {
  /** 画面に描いた順の行・列（0始まり） */
  k: number;
  m: number;
  name: string;
}

interface Grid {
  desk: DeskPosition;
  cells: GridCell[];
  /** 席の行数。教卓が下なら確定、上なら下限 */
  rows: number;
  rowsExact: boolean;
  /** 席の列数の下限（右端の列が全部空だと読み取れないため） */
  minCols: number;
}

/** 「座席表」シートを読む。教卓の行が見つからなければ null */
function readGrid(data: WorkbookSheet['data']): Grid | null {
  const rows = data.map((r) => r.map(cellText));
  const deskIdx = rows.findIndex((r) => r[0] === '教卓');
  if (deskIdx < 0) return null;
  const desk: DeskPosition = deskIdx <= 1 ? 'top' : 'bottom';
  // 教卓が上：タイトル・教卓・(空行・席の行)… ／ 下：タイトル・席の行・(空行・席の行)…・空行・教卓
  const first = desk === 'top' ? deskIdx + 2 : 1;
  const last = desk === 'top' ? rows.length - 1 : deskIdx - 2;
  const cells: GridCell[] = [];
  let minCols = 1;
  let k = 0;
  for (let i = first; i <= last; i += 2, k++) {
    const row = rows[i] ?? [];
    for (let j = 0; j < row.length; j += 2) {
      if (row[j]) {
        cells.push({ k, m: j / 2, name: row[j] });
        minCols = Math.max(minCols, j / 2 + 1);
      }
    }
  }
  return { desk, cells, rows: Math.max(k, 1), rowsExact: desk === 'bottom', minCols };
}

/** 一番多い値 */
function mode(values: number[]): number | undefined {
  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best: number | undefined;
  let n = 0;
  for (const [v, c] of count) if (c > n) [best, n] = [v, c];
  return best;
}

/**
 * このアプリで書き出した Excel なら、名簿・座席の配置・教室の大きさを読み取る。そうでなければ null。
 * - 名前と前方希望は「名簿」シート、座席の配置は「座席表」シート（Excel で入れ替えた結果が反映される）から読む。
 * - 「座席表」シートにしかいない名前は、名簿に追加する。
 * - 空の席だけの行・列はファイルから読み取れないので、`current`（今の教室）が収まるならその大きさを使う。
 */
export function parseExportedWorkbook(sheets: readonly WorkbookSheet[], current?: Layout): ExcelRestore | null {
  const listSheet = sheets.find((s) => s.sheet === '名簿');
  const list = listSheet ? readList(listSheet.data) : null;
  if (!list) return null;
  const gridSheet = sheets.find((s) => s.sheet === '座席表');
  const grid = gridSheet ? readGrid(gridSheet.data) : null;

  const labelRows = Math.max(0, ...list.map((e) => (e.label ? e.label.r + 1 : 0)));
  const labelCols = Math.max(0, ...list.map((e) => (e.label ? e.label.c + 1 : 0)));
  const desk: DeskPosition = grid?.desk ?? current?.desk ?? 'top';
  const fits = (rows: number, cols: number) =>
    current !== undefined && (current.desk ?? 'top') === desk && current.rows >= rows && current.cols >= cols;

  const students: RosterEntry[] = list.map(({ name, front }) => ({ name, front }));
  const seats: Record<SeatKey, number> = {};

  if (!grid) {
    // 座席表シートがなければ「席」の列から
    const rows = Math.max(labelRows, 1);
    const cols = Math.max(labelCols, 1);
    const useCurrent = fits(rows, cols);
    list.forEach((e, i) => {
      if (e.label) seats[seatKey(e.label.r, e.label.c)] = i;
    });
    return {
      students,
      seats,
      layout: useCurrent ? { rows: current!.rows, cols: current!.cols, desk } : { rows, cols, desk },
      sizeCertain: useCurrent,
    };
  }

  let rows = Math.max(grid.rows, labelRows);
  const rowsExact = grid.rowsExact && rows === grid.rows;
  let cols = Math.max(grid.minCols, labelCols);
  let colsExact = false;

  if (desk === 'bottom') {
    // 180°回して描いているので、列の数が分からないと左右を戻せない。
    // 名簿の「席」と座席表の位置が一致する人から、列の数を割り出す
    const byName = new Map<string, ListEntry[]>();
    for (const e of list) byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
    const candidates = grid.cells.flatMap(({ k, m, name }) => {
      const es = byName.get(name);
      const label = es?.length === 1 ? es[0].label : null;
      return label && label.r === rows - 1 - k ? [label.c + m + 1] : [];
    });
    const fromLabels = mode(candidates.filter((c) => c >= cols));
    if (fromLabels !== undefined) {
      cols = fromLabels;
      colsExact = true;
    }
  }

  let sizeCertain = rowsExact && colsExact;
  if (!sizeCertain && fits(rows, cols)) {
    if (!rowsExact) rows = current!.rows;
    if (!colsExact) cols = current!.cols;
    sizeCertain = true;
  }

  const toSeat = (k: number, m: number) => (desk === 'top' ? { r: k, c: m } : { r: rows - 1 - k, c: cols - 1 - m });
  const used = new Set<number>();
  for (const { k, m, name } of grid.cells) {
    const { r, c } = toSeat(k, m);
    if (r < 0 || c < 0) continue;
    const same = list.map((e, i) => ({ e, i })).filter(({ e, i }) => e.name === name && !used.has(i));
    // 同じ名前が何人かいれば、名簿の「席」がここの人を優先する
    let idx = (same.find(({ e }) => e.label?.r === r && e.label?.c === c) ?? same[0])?.i;
    if (idx === undefined) {
      idx = students.length;
      students.push({ name, front: false });
    }
    used.add(idx);
    seats[seatKey(r, c)] = idx;
  }
  return { students, seats, layout: { rows, cols, desk }, sizeCertain };
}
