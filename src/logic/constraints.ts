import type { Assignment, Constraint, Layout, Settings, Student, Violation } from '../types';
import { chebyshev, isEnabled, isSideBySide, manhattan, parseSeat, seatLabel } from './geometry';
import type { Pos } from './geometry';

export type PosLookup = (id: string) => Pos | undefined;

export function partnerOf(c: Constraint): string | undefined {
  return 'b' in c ? c.b : undefined;
}

/**
 * 名簿に存在しない生徒を参照する条件を除き、
 * 生徒の「前方希望」から frontRows 条件を生成して加える。
 */
export function effectiveConstraints(
  students: Student[],
  constraints: Constraint[],
  settings: Settings,
): Constraint[] {
  const ids = new Set(students.map((s) => s.id));
  const valid = constraints.filter((c) => {
    const b = partnerOf(c);
    return ids.has(c.a) && (b === undefined || ids.has(b));
  });
  const derived: Constraint[] = students
    .filter((s) => s.front && !valid.some((c) => c.type === 'frontRows' && c.a === s.id))
    .map((s) => ({ id: `front:${s.id}`, type: 'frontRows', a: s.id, rows: settings.frontRows }));
  return [...valid, ...derived];
}

/** true=満たす / false=違反 / null=関係する生徒が未配置のため判定不可 */
export function checkConstraint(c: Constraint, pos: PosLookup): boolean | null {
  const pa = pos(c.a);
  if (!pa) return null;
  switch (c.type) {
    case 'fixedSeat': {
      const p = parseSeat(c.seat);
      return pa.r === p.r && pa.c === p.c;
    }
    case 'frontRows':
      return pa.r < c.rows;
  }
  const pb = pos(c.b);
  if (!pb) return null;
  switch (c.type) {
    case 'notAdjacent':
      return c.diagonal ? chebyshev(pa, pb) > 1 : manhattan(pa, pb) > 1;
    case 'apart':
      return chebyshev(pa, pb) - 1 >= c.gap;
    case 'together':
      return isSideBySide(pa, pb);
  }
}

export function describeConstraint(c: Constraint, nameOf: (id: string) => string): string {
  const a = nameOf(c.a);
  switch (c.type) {
    case 'fixedSeat':
      return `${a} を「${seatLabel(c.seat)}」の席に固定`;
    case 'frontRows':
      return `${a} を前から${c.rows}番目以内に`;
    case 'notAdjacent':
      return `${a} と ${nameOf(c.b)} を隣にしない${c.diagonal ? '（斜めも含む）' : ''}`;
    case 'apart':
      return `${a} と ${nameOf(c.b)} の間を${c.gap}席以上あける`;
    case 'together':
      return `${a} と ${nameOf(c.b)} を左右の隣にする`;
  }
}

export function lookupFromAssignment(assignment: Assignment): Map<string, Pos> {
  const m = new Map<string, Pos>();
  for (const [k, id] of Object.entries(assignment)) m.set(id, parseSeat(k));
  return m;
}

export function findViolations(
  students: Student[],
  layout: Layout,
  constraints: Constraint[],
  settings: Settings,
  assignment: Assignment,
): Violation[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  const nameOf = (id: string) => byId.get(id)?.name ?? '(不明)';
  const posMap = lookupFromAssignment(assignment);
  const pos: PosLookup = (id) => posMap.get(id);
  const out: Violation[] = [];

  for (const c of effectiveConstraints(students, constraints, settings)) {
    if (c.type === 'fixedSeat' && !isEnabled(layout, c.seat)) {
      out.push({
        key: c.id,
        message: `${describeConstraint(c, nameOf)}：その席は使えません`,
        studentIds: [c.a],
      });
      continue;
    }
    if (checkConstraint(c, pos) === false) {
      const b = partnerOf(c);
      out.push({ key: c.id, message: describeConstraint(c, nameOf), studentIds: b ? [c.a, b] : [c.a] });
    }
  }

  const unseated = students.filter((s) => !posMap.has(s.id));
  if (unseated.length > 0) {
    out.push({
      key: 'unseated',
      message: `席が決まっていない生徒：${unseated.map((s) => s.name).join('、')}`,
      studentIds: unseated.map((s) => s.id),
    });
  }
  return out;
}
