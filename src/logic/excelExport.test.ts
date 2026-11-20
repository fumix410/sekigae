/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/node';
import type { Assignment, Layout, Student } from '../types';
import { buildSeatingSheets } from './excelExport';

const dir = mkdtempSync(join(tmpdir(), 'sekigae-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const students: Student[] = [
  { id: 'a', name: 'A', front: true },
  { id: 'b', name: 'B', front: false },
  { id: 'c', name: 'C', front: false },
  { id: 'd', name: 'D', front: false },
];
const date = new Date(2026, 10, 20);

/** 書き出して、Excel を読む部品で読み戻す */
async function roundtrip(layout: Layout, assignment: Assignment) {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.xlsx`);
  // ブラウザ版の型で作ったシートを Node 版に渡す（中身は同じ）
  const sheets = buildSeatingSheets(students, layout, assignment, date) as Parameters<typeof writeExcelFile>[0];
  await writeExcelFile(sheets).toFile(file);
  return { grid: await readSheet(file, '座席表'), list: await readSheet(file, '名簿') };
}

/** 読み戻した行の末尾の空セルを揃えて比べやすくする */
const pad = (row: unknown[], n: number) => [...row, ...Array(n - row.length).fill(null)];

describe('buildSeatingSheets', () => {
  const asg: Assignment = { '0-0': 'a', '0-1': 'c', '0-2': 'd', '1-2': 'b' };

  it('教卓が上：タイトル、教卓、空の行と席の行が交互。席の列の間に空の列', async () => {
    const { grid } = await roundtrip({ rows: 2, cols: 3, disabled: [] }, asg);
    expect(grid.map((r) => pad(r, 5))).toEqual([
      ['座席表（2026/11/20）', null, null, null, null],
      ['教卓', null, null, null, null],
      [null, null, null, null, null],
      ['A', null, 'C', null, 'D'],
      [null, null, null, null, null],
      [null, null, null, null, 'B'],
    ]);
  });

  it('教卓が下：180°回転し、最後の行が教卓', async () => {
    const { grid } = await roundtrip({ rows: 2, cols: 3, disabled: [], desk: 'bottom' }, asg);
    expect(grid.map((r) => pad(r, 5))).toEqual([
      ['座席表（2026/11/20）', null, null, null, null],
      ['B', null, null, null, null],
      [null, null, null, null, null],
      ['D', null, 'C', null, 'A'],
      [null, null, null, null, null],
      ['教卓', null, null, null, null],
    ]);
  });

  it('使わない席には名前が入らない', async () => {
    // 席 0-1 を使わない設定にし、割り当てに残っていても書き出さない
    const { grid } = await roundtrip({ rows: 1, cols: 3, disabled: ['0-1'] }, asg);
    expect(pad(grid[3], 5)).toEqual(['A', null, null, null, 'D']);
  });

  it('席が1列だけでも書き出せる', async () => {
    const { grid } = await roundtrip({ rows: 2, cols: 1, disabled: [] }, { '0-0': 'a', '1-0': 'b' });
    expect(grid.map((r) => r[0])).toEqual(['座席表（2026/11/20）', '教卓', null, 'A', null, 'B']);
  });

  it('名簿シート：番号・名前・席・前方希望。未配置も分かる', async () => {
    const { list } = await roundtrip({ rows: 2, cols: 3, disabled: [] }, { '0-0': 'a', '1-2': 'b' });
    expect(list.map((r) => pad(r, 4))).toEqual([
      ['番号', '名前', '席', '前方希望'],
      [1, 'A', '前から1番目・左から1番目', '○'],
      [2, 'B', '前から2番目・左から3番目', null],
      [3, 'C', '（未配置）', null],
      [4, 'D', '（未配置）', null],
    ]);
  });
});
