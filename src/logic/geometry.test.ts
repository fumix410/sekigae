import { describe, expect, it } from 'vitest';
import { displayOrder, seatLabel } from './geometry';

describe('displayOrder', () => {
  it('教卓が上（既定）なら前の行・左の列から順に並べる', () => {
    expect(displayOrder({ rows: 3, cols: 2, disabled: [] })).toEqual({ rows: [0, 1, 2], cols: [0, 1] });
    expect(displayOrder({ rows: 3, cols: 2, disabled: [], desk: 'top' })).toEqual({ rows: [0, 1, 2], cols: [0, 1] });
  });

  it('教卓が下なら行も列も逆順（180°回転）', () => {
    expect(displayOrder({ rows: 3, cols: 2, disabled: [], desk: 'bottom' })).toEqual({ rows: [2, 1, 0], cols: [1, 0] });
  });
});

describe('seatLabel', () => {
  it('生徒から見た位置で表す（教卓の向きには関係しない）', () => {
    expect(seatLabel('0-0')).toBe('前から1番目・左から1番目');
    expect(seatLabel('2-4')).toBe('前から3番目・左から5番目');
  });
});
