import { describe, expect, it } from 'vitest';
import type { Constraint, Layout, Settings, Student } from '../types';
import { assign, seededRng } from './seating';
import { findViolations } from './constraints';
import { parseSeat } from './geometry';

const makeStudents = (n: number): Student[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `生徒${i}`,
    front: false,
  }));

const layout6x6: Layout = { rows: 6, cols: 6, disabled: ['5-0', '5-5'] };
const settings: Settings = { frontRows: 2 };

describe('assign', () => {
  it('全員が使える席に、重複なく割り当てられる', () => {
    const students = makeStudents(34);
    const { assignment, violations } = assign({ students, layout: layout6x6, constraints: [], settings, rng: seededRng(1) });
    expect(violations).toEqual([]);
    const ids = Object.values(assignment);
    expect(new Set(ids).size).toBe(34);
    expect(Object.keys(assignment)).not.toContain('5-0');
    expect(Object.keys(assignment)).not.toContain('5-5');
  });

  it('すべての種類の条件を100回とも満たす', () => {
    const students = makeStudents(34);
    students[3].front = true;
    students[4].front = true;
    const constraints: Constraint[] = [
      { id: 'c1', type: 'fixedSeat', a: 's0', seat: '0-0' },
      { id: 'c2', type: 'frontRows', a: 's1', rows: 1 },
      { id: 'c3', type: 'notAdjacent', a: 's5', b: 's6', diagonal: true },
      { id: 'c4', type: 'apart', a: 's7', b: 's8', gap: 3 },
      { id: 'c5', type: 'together', a: 's9', b: 's10' },
      { id: 'c6', type: 'notAdjacent', a: 's9', b: 's11', diagonal: false },
    ];
    const s: Settings = { frontRows: 2 };
    const rng = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const { assignment, violations } = assign({ students, layout: layout6x6, constraints, settings: s, rng });
      expect(violations).toEqual([]);
      expect(assignment['0-0']).toBe('s0');
      // 独立した確認
      expect(findViolations(students, layout6x6, constraints, s, assignment)).toEqual([]);
    }
  });

  it('前方希望の人数が前方の席数を超えると、違反を返す', () => {
    const students = makeStudents(20);
    for (let i = 0; i < 8; i++) students[i].front = true;
    const layout: Layout = { rows: 5, cols: 6, disabled: [] };
    const { violations } = assign({
      students,
      layout,
      constraints: [],
      settings: { frontRows: 1 },
      rng: seededRng(3),
    });
    expect(violations.length).toBe(2);
    expect(violations.every((v) => v.message.includes('前から1番目以内'))).toBe(true);
  });

  it('席が足りないとき、未配置の生徒を報告する', () => {
    const students = makeStudents(10);
    const { violations } = assign({ students, layout: { rows: 3, cols: 3, disabled: [] }, constraints: [], settings, rng: seededRng(5) });
    expect(violations.some((v) => v.key === 'unseated')).toBe(true);
  });

  it('ロックした席は動かない', () => {
    const students = makeStudents(30);
    const locked = { '2-3': 's7', '4-1': 's12' };
    for (let seed = 0; seed < 20; seed++) {
      const { assignment } = assign({ students, layout: layout6x6, constraints: [], settings, locked, rng: seededRng(seed) });
      expect(assignment['2-3']).toBe('s7');
      expect(assignment['4-1']).toBe('s12');
    }
  });

  it('毎回違う配置になる（ランダム性）', () => {
    const students = makeStudents(30);
    const rng = seededRng(9);
    const a = assign({ students, layout: layout6x6, constraints: [], settings, rng }).assignment;
    const b = assign({ students, layout: layout6x6, constraints: [], settings, rng }).assignment;
    expect(a).not.toEqual(b);
  });

  it('together の2人は左右に並ぶ', () => {
    const students = makeStudents(36);
    const constraints: Constraint[] = [{ id: 't', type: 'together', a: 's1', b: 's2' }];
    const { assignment } = assign({ students, layout: { rows: 6, cols: 6, disabled: [] }, constraints, settings, rng: seededRng(11) });
    const pos = Object.fromEntries(Object.entries(assignment).map(([k, id]) => [id, parseSeat(k)]));
    expect(pos.s1.r).toBe(pos.s2.r);
    expect(Math.abs(pos.s1.c - pos.s2.c)).toBe(1);
  });
});
