/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';
import type { Assignment, Layout, Student } from '../types';
import { buildSeatingSheets } from './excelExport';
import { parseExportedWorkbook, parseSeatLabel } from './excelImport';
import type { WorkbookSheet } from './excelImport';

const dir = mkdtempSync(join(tmpdir(), 'sekigae-import-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const students: Student[] = [
  { id: 'a', name: 'A', front: true },
  { id: 'b', name: 'B', front: false },
  { id: 'c', name: 'C', front: false },
  { id: 'd', name: 'D', front: false },
];

async function exportAndRead(layout: Layout, assignment: Assignment): Promise<WorkbookSheet[]> {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.xlsx`);
  const sheets = buildSeatingSheets(students, layout, assignment) as Parameters<typeof writeExcelFile>[0];
  await writeExcelFile(sheets).toFile(file);
  return readXlsxFile(file);
}

/** 席 → 名前 にして比べやすくする */
function placed(r: NonNullable<ReturnType<typeof parseExportedWorkbook>>) {
  return Object.fromEntries(Object.entries(r.seats).map(([k, i]) => [k, r.students[i].name]));
}

describe('parseSeatLabel', () => {
  it('席の表記を読み取る', () => {
    expect(parseSeatLabel('前から2番目・左から3番目')).toEqual({ r: 1, c: 2 });
    expect(parseSeatLabel('（未配置）')).toBeNull();
  });
});

describe('parseExportedWorkbook', () => {
  const asg: Assignment = { '0-0': 'a', '0-1': 'c', '1-2': 'b' };

  it('教卓が上：名簿・前方希望・配置・教室の大きさが戻る', async () => {
    const r = parseExportedWorkbook(await exportAndRead({ rows: 2, cols: 3, disabled: [] }, asg))!;
    expect(r.students).toEqual([
      { name: 'A', front: true },
      { name: 'B', front: false },
      { name: 'C', front: false },
      { name: 'D', front: false },
    ]);
    expect(placed(r)).toEqual({ '0-0': 'A', '0-1': 'C', '1-2': 'B' });
    expect(r.layout).toEqual({ rows: 2, cols: 3, desk: 'top' });
  });

  it('教卓が下：180°回転を戻す。列の数は名簿の「席」から割り出す', async () => {
    const r = parseExportedWorkbook(await exportAndRead({ rows: 3, cols: 4, disabled: [], desk: 'bottom' }, asg))!;
    expect(placed(r)).toEqual({ '0-0': 'A', '0-1': 'C', '1-2': 'B' });
    expect(r.layout).toEqual({ rows: 3, cols: 4, desk: 'bottom' });
    expect(r.sizeCertain).toBe(true);
  });

  it('後ろや右の空の席だけの行・列は読めないので、今の教室が収まればその大きさを使う', async () => {
    const sheets = await exportAndRead({ rows: 4, cols: 5, disabled: [] }, asg);
    const guessed = parseExportedWorkbook(sheets)!;
    expect(guessed.layout).toEqual({ rows: 2, cols: 3, desk: 'top' });
    expect(guessed.sizeCertain).toBe(false);
    const withCurrent = parseExportedWorkbook(sheets, { rows: 4, cols: 5, disabled: [] })!;
    expect(withCurrent.layout).toEqual({ rows: 4, cols: 5, desk: 'top' });
    expect(withCurrent.sizeCertain).toBe(true);
  });

  it('Excel で座席表の名前を入れ替えたら、その配置になる。名簿にない名前は追加', () => {
    const sheets: WorkbookSheet[] = [
      {
        sheet: '座席表',
        data: [['座席表（2026/11/20）'], ['教卓'], [null], ['C', null, 'A'], [null], ['E', null, null, null, 'B']],
      },
      {
        sheet: '名簿',
        data: [
          ['番号', '名前', '席', '前方希望'],
          [1, 'A', '前から1番目・左から1番目', '○'],
          [2, 'B', '前から2番目・左から3番目', null],
          [3, 'C', '前から1番目・左から2番目', null],
        ],
      },
    ];
    const r = parseExportedWorkbook(sheets)!;
    expect(placed(r)).toEqual({ '0-0': 'C', '0-1': 'A', '1-0': 'E', '1-2': 'B' });
    expect(r.students.map((s) => s.name)).toEqual(['A', 'B', 'C', 'E']);
  });

  it('同じ名前が2人いても、名簿の「席」で見分ける', () => {
    const sheets: WorkbookSheet[] = [
      { sheet: '座席表', data: [['座席表'], ['教卓'], [null], ['佐藤', null, '佐藤']] },
      {
        sheet: '名簿',
        data: [
          ['番号', '名前', '席', '前方希望'],
          [1, '佐藤', '前から1番目・左から2番目', '○'],
          [2, '佐藤', '前から1番目・左から1番目', null],
        ],
      },
    ];
    const r = parseExportedWorkbook(sheets)!;
    expect(r.seats).toEqual({ '0-0': 1, '0-1': 0 });
  });

  it('ふつうの名簿の Excel は対象外（null）', () => {
    expect(parseExportedWorkbook([{ sheet: 'Sheet1', data: [['番号', '名前', '前方希望'], [1, 'A', '○']] }])).toBeNull();
    expect(parseExportedWorkbook([{ sheet: '名簿', data: [['番号', '名前', '前方希望'], [1, 'A', '○']] }])).toBeNull();
  });
});
