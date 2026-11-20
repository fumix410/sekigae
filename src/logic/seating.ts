import type { Assignment, Constraint, Layout, SeatKey, Settings, Student, Violation } from '../types';
import { checkConstraint, effectiveConstraints, findViolations, partnerOf } from './constraints';
import { enabledSeats, isEnabled, parseSeat, seatKey } from './geometry';
import type { Pos } from './geometry';

export type Rng = () => number;

/** シード付き乱数（mulberry32） */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AssignInput {
  students: Student[];
  layout: Layout;
  constraints: Constraint[];
  settings: Settings;
  /** ロック中の席（動かさない）: 座席 → 生徒ID */
  locked?: Assignment;
  rng?: Rng;
  /** 探索ステップの総上限 */
  maxSteps?: number;
}

export interface AssignResult {
  assignment: Assignment;
  violations: Violation[];
}

const RESTART_STEPS = 5000;
const GREEDY_TRIES = 60;

export function assign(input: AssignInput): AssignResult {
  const { students, layout, settings } = input;
  const rng = input.rng ?? Math.random;
  const maxSteps = input.maxSteps ?? 200_000;
  const cons = effectiveConstraints(students, input.constraints, settings);
  const seats = enabledSeats(layout);
  const studentIds = new Set(students.map((s) => s.id));

  // 生徒ごとの関係する条件
  const byStudent = new Map<string, Constraint[]>();
  for (const s of students) byStudent.set(s.id, []);
  for (const c of cons) {
    byStudent.get(c.a)!.push(c);
    const b = partnerOf(c);
    if (b) byStudent.get(b)!.push(c);
  }

  // --- 事前配置（ロック席・固定席） ---
  const base: Assignment = {};
  const basePlaced = new Set<string>();
  for (const [k, id] of Object.entries(input.locked ?? {})) {
    if (isEnabled(layout, k) && studentIds.has(id) && !basePlaced.has(id) && !(k in base)) {
      base[k] = id;
      basePlaced.add(id);
    }
  }
  for (const c of cons) {
    if (c.type === 'fixedSeat' && !basePlaced.has(c.a) && isEnabled(layout, c.seat) && !(c.seat in base)) {
      base[c.seat] = c.a;
      basePlaced.add(c.a);
    }
  }

  const remaining = students.map((s) => s.id).filter((id) => !basePlaced.has(id));
  const freeSeats = seats.filter((k) => !(k in base));

  // 制約の厳しい生徒から先に置く（同点はランダム）
  const difficulty = (id: string) =>
    byStudent.get(id)!.reduce((sum, c) => sum + (c.type === 'frontRows' ? 50 : c.type === 'together' ? 30 : 10), 0);
  const makeOrder = () => {
    const d = new Map(remaining.map((id) => [id, difficulty(id)]));
    return shuffle(remaining, rng).sort((x, y) => d.get(y)! - d.get(x)!);
  };

  // 作業用の状態
  let assignment: Assignment = {};
  let posOf = new Map<string, Pos>();
  const reset = () => {
    assignment = { ...base };
    posOf = new Map(Object.entries(base).map(([k, id]) => [id, parseSeat(k)]));
  };
  const place = (id: string, k: SeatKey) => {
    assignment[k] = id;
    posOf.set(id, parseSeat(k));
  };
  const unplace = (id: string, k: SeatKey) => {
    delete assignment[k];
    posOf.delete(id);
  };

  /** 生徒 id を席 k に置いたときに新たに生じる違反の数 */
  const cost = (id: string, k: SeatKey, stopAtFirst: boolean): number => {
    const p = parseSeat(k);
    const lookup = (x: string) => (x === id ? p : posOf.get(x));
    let n = 0;
    for (const c of byStudent.get(id)!) {
      const r = checkConstraint(c, lookup);
      if (r === false) n++;
      else if (r === null && c.type === 'together') {
        // 相手がまだ未配置なら、左右に空席が残っている必要がある
        const hasFreeSide = [p.c - 1, p.c + 1].some((cc) => {
          const nk = seatKey(p.r, cc);
          return isEnabled(layout, nk) && !(nk in assignment);
        });
        if (!hasFreeSide) n++;
      }
      if (n > 0 && stopAtFirst) return n;
    }
    return n;
  };

  // --- 1. ランダム再スタート付きバックトラッキング ---
  if (remaining.length <= freeSeats.length) {
    let totalSteps = 0;
    while (totalSteps < maxSteps) {
      reset();
      const order = makeOrder();
      let steps = 0;
      const bt = (i: number): boolean => {
        if (i === order.length) return true;
        const id = order[i];
        for (const k of shuffle(freeSeats, rng)) {
          if (k in assignment) continue;
          if (++steps > RESTART_STEPS) return false;
          if (cost(id, k, true) > 0) continue;
          place(id, k);
          if (bt(i + 1)) return true;
          unplace(id, k);
          if (steps > RESTART_STEPS) return false;
        }
        return false;
      };
      const ok = bt(0);
      totalSteps += steps;
      if (ok) {
        const result = { ...assignment };
        return { assignment: result, violations: findViolations(students, layout, input.constraints, settings, result) };
      }
    }
  }

  // --- 2. 見つからなければ、違反が最も少ない配置を貪欲法で探す ---
  let best: AssignResult | null = null;
  for (let t = 0; t < GREEDY_TRIES; t++) {
    reset();
    for (const id of makeOrder()) {
      let bestSeat: SeatKey | null = null;
      let bestCost = Infinity;
      for (const k of shuffle(freeSeats, rng)) {
        if (k in assignment) continue;
        const c = cost(id, k, false);
        if (c < bestCost) {
          bestCost = c;
          bestSeat = k;
          if (c === 0) break;
        }
      }
      if (bestSeat === null) break; // 席が足りない
      place(id, bestSeat);
    }
    const result = { ...assignment };
    const violations = findViolations(students, layout, input.constraints, settings, result);
    if (!best || violations.length < best.violations.length) best = { assignment: result, violations };
    if (violations.length === 0) break;
  }
  return best!;
}
