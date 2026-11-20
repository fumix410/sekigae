import { describe, expect, it } from 'vitest';
import { initialData, parseData, reducer } from './store';
import type { AppState } from './store';

const base = (): AppState => ({
  ...initialData,
  students: [
    { id: 'a', name: 'A', front: false },
    { id: 'b', name: 'B', front: false },
    { id: 'c', name: 'C', front: false },
  ],
  constraints: [{ id: 'x', type: 'together', a: 'a', b: 'b' }],
  assignment: { '0-0': 'a', '0-1': 'b' },
  locked: ['0-0'],
  undo: [],
});

describe('reducer', () => {
  it('入れ替えるとロックは生徒についていき、元に戻せる', () => {
    let s = reducer(base(), { type: 'swapSeats', from: '0-0', to: '1-1' });
    expect(s.assignment).toEqual({ '1-1': 'a', '0-1': 'b' });
    expect(s.locked).toEqual(['1-1']);
    s = reducer(s, { type: 'undo' });
    expect(s.assignment).toEqual({ '0-0': 'a', '0-1': 'b' });
  });

  it('未配置の生徒を席に置くと、元の生徒は未配置になる', () => {
    const s = reducer(base(), { type: 'placeStudent', id: 'c', seat: '0-1' });
    expect(s.assignment).toEqual({ '0-0': 'a', '0-1': 'c' });
  });

  it('生徒を削除すると、関係する条件と座席も消える', () => {
    const s = reducer(base(), { type: 'removeStudent', id: 'b' });
    expect(s.constraints).toEqual([]);
    expect(s.assignment).toEqual({ '0-0': 'a' });
  });

  it('使わない席にすると、そこの生徒とロックが外れる', () => {
    const s = reducer(base(), { type: 'toggleDisabled', seat: '0-0' });
    expect(s.assignment).toEqual({ '0-1': 'b' });
    expect(s.locked).toEqual([]);
  });

  it('教室を小さくすると、範囲外の座席は外れる', () => {
    const s = reducer(base(), { type: 'resizeLayout', rows: 1, cols: 1 });
    expect(s.assignment).toEqual({ '0-0': 'a' });
  });

  it('教卓の位置を変えても、配置と元に戻す履歴は残る', () => {
    let s = reducer(base(), { type: 'swapSeats', from: '0-0', to: '1-1' });
    s = reducer(s, { type: 'setDesk', desk: 'bottom' });
    expect(s.layout.desk).toBe('bottom');
    expect(s.assignment).toEqual({ '1-1': 'a', '0-1': 'b' });
    expect(s.undo).toHaveLength(1);
  });

  it('教室の大きさを変えても、教卓の位置は残る', () => {
    let s = reducer(base(), { type: 'setDesk', desk: 'bottom' });
    s = reducer(s, { type: 'resizeLayout', rows: 4, cols: 5 });
    expect(s.layout).toMatchObject({ rows: 4, cols: 5, desk: 'bottom' });
  });

  it('名簿に追加：前方希望を引き継ぎ、空の名前は追加しない', () => {
    const s = reducer({ ...initialData, undo: [] }, {
      type: 'addStudents',
      entries: [
        { name: ' 青木 ', front: true },
        { name: '  ', front: true },
        { name: '石井', front: false },
      ],
    });
    expect(s.students.map(({ name, front }) => ({ name, front }))).toEqual([
      { name: '青木', front: true },
      { name: '石井', front: false },
    ]);
  });
});

describe('parseData', () => {
  it('以前の形式（性別あり・教卓の設定なし）を読み込める', () => {
    const old = {
      version: 1,
      students: [{ id: 'a', name: 'A', gender: 'M', front: true }],
      layout: { rows: 5, cols: 6, disabled: ['4-0'] },
      settings: { frontRows: 1, separateGenders: true },
      constraints: [],
      assignment: { '0-0': 'a' },
      locked: [],
      confirmed: null,
    };
    const d = parseData(old)!;
    expect(d.students).toEqual([{ id: 'a', name: 'A', front: true }]);
    expect(d.settings).toEqual({ frontRows: 1 });
    expect(d.layout.desk ?? 'top').toBe('top');
    expect(d.assignment).toEqual({ '0-0': 'a' });
  });

  it('席替えのデータでないものは読み込まない', () => {
    expect(parseData(null)).toBeNull();
    expect(parseData({ version: 2, students: [] })).toBeNull();
    expect(parseData({ version: 1 })).toBeNull();
  });
});

describe('restoreFromExcel', () => {
  it('同じ名前の生徒は ID を使い回して条件を残し、いない人の条件は消す', () => {
    const s = reducer(
      { ...base(), layout: { rows: 6, cols: 6, disabled: ['0-0', '5-5'] } },
      {
        type: 'restoreFromExcel',
        data: {
          students: [
            { name: 'A', front: true },
            { name: 'B', front: false },
            { name: 'D', front: false },
          ],
          seats: { '0-0': 0, '1-1': 2 },
          layout: { rows: 3, cols: 3, desk: 'bottom' },
          sizeCertain: true,
        },
      },
    );
    expect(s.students.slice(0, 2)).toEqual([
      { id: 'a', name: 'A', front: true },
      { id: 'b', name: 'B', front: false },
    ]);
    const d = s.students[2].id;
    expect(s.assignment).toEqual({ '0-0': 'a', '1-1': d });
    expect(s.constraints).toEqual([{ id: 'x', type: 'together', a: 'a', b: 'b' }]);
    // 人が座った席と教室の外になった席は「使わない席」から外れる
    expect(s.layout).toEqual({ rows: 3, cols: 3, disabled: [], desk: 'bottom' });
    expect(s.locked).toEqual([]);
  });
});
