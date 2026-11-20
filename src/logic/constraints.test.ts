import { describe, expect, it } from 'vitest';
import type { Constraint, Layout, Settings, Student } from '../types';
import { findViolations } from './constraints';

const students: Student[] = [
  { id: 'a', name: 'A', front: false },
  { id: 'b', name: 'B', front: false },
  { id: 'c', name: 'C', front: true },
];
const layout: Layout = { rows: 3, cols: 3, disabled: ['2-2'] };
const settings: Settings = { frontRows: 1 };

describe('findViolations', () => {
  it('notAdjacent: 斜めの扱いを区別する', () => {
    const asg = { '0-0': 'a', '1-1': 'b', '0-2': 'c' };
    const straight: Constraint = { id: 'x', type: 'notAdjacent', a: 'a', b: 'b', diagonal: false };
    const diag: Constraint = { id: 'x', type: 'notAdjacent', a: 'a', b: 'b', diagonal: true };
    expect(findViolations(students, layout, [straight], settings, asg)).toEqual([]);
    expect(findViolations(students, layout, [diag], settings, asg)).toHaveLength(1);
  });

  it('apart: 間の席数で判定する', () => {
    const asg = { '0-0': 'a', '0-2': 'b', '0-1': 'c' };
    const gap1: Constraint = { id: 'x', type: 'apart', a: 'a', b: 'b', gap: 1 };
    const gap2: Constraint = { id: 'x', type: 'apart', a: 'a', b: 'b', gap: 2 };
    expect(findViolations(students, layout, [gap1], settings, asg)).toEqual([]);
    expect(findViolations(students, layout, [gap2], settings, asg)).toHaveLength(1);
  });

  it('前方希望を検出する', () => {
    const asg = { '0-0': 'a', '0-1': 'b', '1-0': 'c' };
    const v = findViolations(students, layout, [], settings, asg);
    expect(v.map((x) => x.key)).toEqual(['front:c']);
  });

  it('使えない席への固定を報告する', () => {
    const asg = { '0-0': 'a', '0-1': 'b', '0-2': 'c' };
    const v = findViolations(students, layout, [{ id: 'f', type: 'fixedSeat', a: 'a', seat: '2-2' }], settings, asg);
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('使えません');
  });

  it('名簿にいない生徒の条件は無視する', () => {
    const asg = { '0-0': 'a', '0-1': 'b', '0-2': 'c' };
    const v = findViolations(students, layout, [{ id: 'z', type: 'together', a: 'a', b: 'ghost' }], settings, asg);
    expect(v).toEqual([]);
  });
});
