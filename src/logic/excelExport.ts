import type { Cell, Sheet, SheetData } from 'write-excel-file/browser';
import type { Assignment, Layout, Student } from '../types';
import { displayOrder, seatKey, seatLabel } from './geometry';

/** ブラウザ版で使うシートの型 */
type BrowserSheet = Sheet<File | Blob | ArrayBuffer>;

const BORDER = { borderColor: '#555555', borderStyle: 'thin' } as const;

/** 座席表を Excel のシート（座席表・名簿の2枚）にする */
export function buildSeatingSheets(students: Student[], layout: Layout, assignment: Assignment, date = new Date()): BrowserSheet[] {
  const nameOf = new Map(students.map((s) => [s.id, s.name]));
  const disabled = new Set(layout.disabled);
  /** 席の列と列の間に空の列を挟むので、シート上の列数は 席の列数×2−1 */
  const cols = Math.max(layout.cols * 2 - 1, 1);
  const span = (cell: Cell & object, n: number): Cell[] => [{ ...cell, columnSpan: n }, ...Array<null>(n - 1).fill(null)];

  const deskRow = span(
    { value: '教卓', align: 'center', alignVertical: 'center', backgroundColor: '#E7E6E6', height: 24, ...BORDER },
    cols,
  );
  /** 席の行と行の間に入れる空の行 */
  const gapRow = (): Cell[] => [{ value: '', height: 12 }, ...Array<null>(cols - 1).fill(null)];
  const deskBottom = layout.desk === 'bottom';
  const order = displayOrder(layout);

  const grid: SheetData = [
    span({ value: `座席表（${date.toLocaleDateString('ja-JP')}）`, fontWeight: 'bold', fontSize: 14 }, cols),
  ];
  if (!deskBottom) grid.push(deskRow);
  for (const [i, r] of order.rows.entries()) {
    if (i > 0 || !deskBottom) grid.push(gapRow());
    const row: Cell[] = [];
    for (const [j, c] of order.cols.entries()) {
      if (j > 0) row.push(null); // 席の列と列の間の空の列
      const k = seatKey(r, c);
      const style = { align: 'center', alignVertical: 'center', wrap: true, height: 40, fontSize: 12, ...BORDER } as const;
      row.push(
        disabled.has(k)
          ? { value: '', ...style, backgroundColor: '#D9D9D9' }
          : { value: nameOf.get(assignment[k]) ?? '', ...style, fontWeight: 'bold' },
      );
    }
    grid.push(row);
  }
  if (deskBottom) grid.push(gapRow(), deskRow);

  const seatOf = new Map(Object.entries(assignment).map(([k, id]) => [id, k]));
  const head = { fontWeight: 'bold', backgroundColor: '#DDEBF7', ...BORDER } as const;
  const list: SheetData = [
    [
      { value: '番号', ...head },
      { value: '名前', ...head },
      { value: '席', ...head },
      { value: '前方希望', ...head },
    ],
    ...students.map((s, i): Cell[] => {
      const k = seatOf.get(s.id);
      return [
        { value: i + 1, ...BORDER },
        { value: s.name, ...BORDER },
        { value: k ? seatLabel(k) : '（未配置）', ...BORDER },
        { value: s.front ? '○' : '', align: 'center', ...BORDER },
      ];
    }),
  ];

  return [
    {
      data: grid,
      sheet: '座席表',
      orientation: 'landscape',
      columns: Array.from({ length: cols }, (_, i) => ({ width: i % 2 === 0 ? 14 : 3 })),
    },
    {
      data: list,
      sheet: '名簿',
      stickyRowsCount: 1,
      columns: [{ width: 6 }, { width: 16 }, { width: 24 }, { width: 10 }],
    },
  ];
}
