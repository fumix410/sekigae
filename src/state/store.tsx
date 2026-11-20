import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Assignment, Constraint, DeskPosition, Layout, SeatKey, Settings, Student } from '../types';
import { inBounds, isEnabled, parseSeat } from '../logic/geometry';
import type { RosterEntry } from '../logic/roster';
import type { ExcelRestore } from '../logic/excelImport';

const STORAGE_KEY = 'sekigae:v1';
const UNDO_LIMIT = 50;

export interface AppData {
  version: 1;
  students: Student[];
  layout: Layout;
  settings: Settings;
  constraints: Constraint[];
  assignment: Assignment;
  locked: SeatKey[];
  confirmed: { assignment: Assignment; at: string } | null;
}

export interface AppState extends AppData {
  undo: Assignment[];
}

export const initialData: AppData = {
  version: 1,
  students: [],
  layout: { rows: 6, cols: 6, disabled: [] },
  settings: { frontRows: 2 },
  constraints: [],
  assignment: {},
  locked: [],
  confirmed: null,
};

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type Action =
  | { type: 'addStudents'; entries: RosterEntry[] }
  | { type: 'updateStudent'; id: string; patch: Partial<Omit<Student, 'id'>> }
  | { type: 'removeStudent'; id: string }
  | { type: 'clearStudents' }
  | { type: 'resizeLayout'; rows: number; cols: number }
  | { type: 'toggleDisabled'; seat: SeatKey }
  | { type: 'setDesk'; desk: DeskPosition }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'addConstraint'; constraint: Constraint }
  | { type: 'removeConstraint'; id: string }
  | { type: 'setAssignment'; assignment: Assignment }
  | { type: 'swapSeats'; from: SeatKey; to: SeatKey }
  | { type: 'placeStudent'; id: string; seat: SeatKey }
  | { type: 'unseat'; seat: SeatKey }
  | { type: 'toggleLock'; seat: SeatKey }
  | { type: 'clearAssignment' }
  | { type: 'undo' }
  | { type: 'confirm' }
  | { type: 'restoreConfirmed' }
  | { type: 'import'; data: AppData }
  | { type: 'restoreFromExcel'; data: ExcelRestore };

/** 配置を変更し、変更前を Undo 用に積む */
function withAssignment(state: AppState, assignment: Assignment, locked = state.locked): AppState {
  return {
    ...state,
    assignment,
    locked,
    undo: [...state.undo, state.assignment].slice(-UNDO_LIMIT),
  };
}

function withoutStudent(a: Assignment, id: string): Assignment {
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== id));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addStudents': {
      const added = action.entries
        .map((e) => ({ ...e, name: e.name.trim() }))
        .filter((e) => e.name)
        .map((e): Student => ({ id: newId(), name: e.name, front: e.front }));
      return { ...state, students: [...state.students, ...added] };
    }
    case 'updateStudent':
      return {
        ...state,
        students: state.students.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'removeStudent':
      return {
        ...state,
        students: state.students.filter((s) => s.id !== action.id),
        constraints: state.constraints.filter((c) => c.a !== action.id && !('b' in c && c.b === action.id)),
        assignment: withoutStudent(state.assignment, action.id),
        undo: [],
      };
    case 'clearStudents':
      return { ...state, students: [], constraints: [], assignment: {}, locked: [], undo: [] };
    case 'resizeLayout': {
      const layout: Layout = {
        ...state.layout,
        rows: action.rows,
        cols: action.cols,
        disabled: state.layout.disabled.filter((k) => inBounds({ ...state.layout, ...action }, parseSeat(k))),
      };
      const keep = (k: SeatKey) => isEnabled(layout, k);
      return {
        ...state,
        layout,
        assignment: Object.fromEntries(Object.entries(state.assignment).filter(([k]) => keep(k))),
        locked: state.locked.filter(keep),
        undo: [],
      };
    }
    case 'toggleDisabled': {
      const isDisabled = state.layout.disabled.includes(action.seat);
      const disabled = isDisabled
        ? state.layout.disabled.filter((k) => k !== action.seat)
        : [...state.layout.disabled, action.seat];
      const assignment = { ...state.assignment };
      if (!isDisabled) delete assignment[action.seat];
      return {
        ...state,
        layout: { ...state.layout, disabled },
        assignment,
        locked: state.locked.filter((k) => k !== action.seat),
        undo: [],
      };
    }
    case 'setDesk':
      return { ...state, layout: { ...state.layout, desk: action.desk } };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'addConstraint':
      return { ...state, constraints: [...state.constraints, action.constraint] };
    case 'removeConstraint':
      return { ...state, constraints: state.constraints.filter((c) => c.id !== action.id) };
    case 'setAssignment':
      return withAssignment(state, action.assignment);
    case 'swapSeats': {
      const { from, to } = action;
      if (from === to) return state;
      const a = { ...state.assignment };
      const x = a[from];
      const y = a[to];
      delete a[from];
      delete a[to];
      if (x) a[to] = x;
      if (y) a[from] = y;
      // ロックは生徒についていく
      const lf = state.locked.includes(from);
      const lt = state.locked.includes(to);
      const locked = state.locked.filter((k) => k !== from && k !== to);
      if (lf && x) locked.push(to);
      if (lt && y) locked.push(from);
      return withAssignment(state, a, locked);
    }
    case 'placeStudent': {
      const a = withoutStudent(state.assignment, action.id);
      a[action.seat] = action.id; // 元々座っていた生徒は未配置に戻る
      return withAssignment(state, a, state.locked.filter((k) => k !== action.seat));
    }
    case 'unseat': {
      const a = { ...state.assignment };
      delete a[action.seat];
      return withAssignment(state, a, state.locked.filter((k) => k !== action.seat));
    }
    case 'toggleLock':
      return {
        ...state,
        locked: state.locked.includes(action.seat)
          ? state.locked.filter((k) => k !== action.seat)
          : [...state.locked, action.seat],
      };
    case 'clearAssignment': {
      const a = Object.fromEntries(Object.entries(state.assignment).filter(([k]) => state.locked.includes(k)));
      return withAssignment(state, a);
    }
    case 'undo': {
      if (state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1];
      return {
        ...state,
        assignment: prev,
        locked: state.locked.filter((k) => k in prev),
        undo: state.undo.slice(0, -1),
      };
    }
    case 'confirm':
      return { ...state, confirmed: { assignment: { ...state.assignment }, at: new Date().toISOString() } };
    case 'restoreConfirmed':
      return state.confirmed ? withAssignment(state, { ...state.confirmed.assignment }, []) : state;
    case 'import':
      return { ...action.data, undo: [] };
    case 'restoreFromExcel':
      return restoreFromExcel(state, action.data);
  }
}

const sameName = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/**
 * 書き出した Excel の内容で名簿・座席を置き換える。
 * 同じ名前の生徒は今の生徒（ID）を使い回すので、その人の条件は残る。
 */
function restoreFromExcel(state: AppState, data: ExcelRestore): AppState {
  const pool = [...state.students];
  const students = data.students.map((e): Student => {
    const i = pool.findIndex((s) => sameName(s.name, e.name));
    const id = i >= 0 ? pool.splice(i, 1)[0].id : newId();
    return { id, name: e.name.trim(), front: e.front };
  });
  const ids = new Set(students.map((s) => s.id));
  const { rows, cols, desk } = data.layout;
  const assignment: Assignment = {};
  for (const [k, i] of Object.entries(data.seats)) assignment[k] = students[i].id;
  const layout: Layout = {
    ...state.layout,
    rows,
    cols,
    desk,
    // 使わない席は、今の設定のうち人が座っていない席だけ残す
    disabled: state.layout.disabled.filter((k) => inBounds({ ...state.layout, rows, cols }, parseSeat(k)) && !(k in assignment)),
  };
  const keepIds = (a: Assignment): Assignment =>
    Object.fromEntries(Object.entries(a).filter(([k, id]) => ids.has(id) && isEnabled(layout, k)));
  const confirmed = state.confirmed && { ...state.confirmed, assignment: keepIds(state.confirmed.assignment) };
  return {
    ...state,
    students,
    layout,
    constraints: state.constraints.filter(
      (c) => ids.has(c.a) && (!('b' in c) || ids.has(c.b)) && (c.type !== 'fixedSeat' || isEnabled(layout, c.seat)),
    ),
    assignment,
    locked: [],
    confirmed: confirmed && Object.keys(confirmed.assignment).length > 0 ? confirmed : null,
    undo: [],
  };
}

/** 読み込んだデータを検証し、足りない項目を既定値で補う。不正なら null */
export function parseData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<AppData>;
  if (d.version !== 1 || !Array.isArray(d.students)) return null;
  // 以前の版にあった性別の項目は読み捨てる
  const students = (d.students as (Student & { gender?: unknown })[]).map(({ gender: _g, ...s }) => s);
  const { separateGenders: _sg, ...settings } = { ...initialData.settings, ...d.settings } as Settings & {
    separateGenders?: unknown;
  };
  return {
    ...initialData,
    ...d,
    students,
    layout: { ...initialData.layout, ...d.layout },
    settings,
  } as AppData;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? parseData(JSON.parse(raw)) : null;
    return { ...(data ?? initialData), undo: [] };
  } catch {
    return { ...initialData, undo: [] };
  }
}

export function toData(state: AppState): AppData {
  const { undo: _undo, ...data } = state;
  return data;
}

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toData(state)));
    } catch {
      // 保存できない環境（プライベートモード等）でも動作は続ける
    }
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider がありません');
  return ctx;
}
