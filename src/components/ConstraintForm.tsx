import { useState } from 'react';
import { newId, useStore } from '../state/store';
import type { Constraint, ConstraintType } from '../types';
import { enabledSeats, seatLabel } from '../logic/geometry';

const TYPE_LABELS: Record<ConstraintType, string> = {
  notAdjacent: '2人を隣にしない',
  apart: '2人を離す',
  together: '2人を左右の隣にする',
  frontRows: '前の方の席にする',
  fixedSeat: '席を固定する',
};

const PAIR_TYPES: ConstraintType[] = ['notAdjacent', 'apart', 'together'];

export function ConstraintForm() {
  const { state, dispatch } = useStore();
  const [type, setType] = useState<ConstraintType>('notAdjacent');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [diagonal, setDiagonal] = useState(true);
  const [gap, setGap] = useState(2);
  const [rows, setRows] = useState(1);
  const [seat, setSeat] = useState('');
  const [error, setError] = useState('');

  const isPair = PAIR_TYPES.includes(type);
  const seats = enabledSeats(state.layout);

  const submit = () => {
    if (!a || (isPair && !b) || (type === 'fixedSeat' && !seat)) {
      setError('生徒（と席）を選んでください');
      return;
    }
    if (isPair && a === b) {
      setError('違う2人を選んでください');
      return;
    }
    const id = newId();
    let c: Constraint;
    switch (type) {
      case 'notAdjacent':
        c = { id, type, a, b, diagonal };
        break;
      case 'apart':
        c = { id, type, a, b, gap };
        break;
      case 'together':
        c = { id, type, a, b };
        break;
      case 'frontRows':
        c = { id, type, a, rows };
        break;
      case 'fixedSeat':
        c = { id, type, a, seat };
        break;
    }
    dispatch({ type: 'addConstraint', constraint: c });
    setError('');
    setA('');
    setB('');
  };

  if (state.students.length === 0) {
    return <p className="hint">名簿を登録すると、生徒ごとの条件を追加できます。</p>;
  }

  const studentSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}を選ぶ</option>
      {state.students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="constraint-form">
      <h3>条件を追加</h3>
      <div className="stack">
        <select value={type} onChange={(e) => setType(e.target.value as ConstraintType)} aria-label="条件の種類">
          {(Object.keys(TYPE_LABELS) as ConstraintType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {studentSelect(a, setA, isPair ? '1人目' : '生徒')}
        {isPair && studentSelect(b, setB, '2人目')}

        {type === 'notAdjacent' && (
          <label>
            <input type="checkbox" checked={diagonal} onChange={(e) => setDiagonal(e.target.checked)} />
            斜めも隣とみなす
          </label>
        )}
        {type === 'apart' && (
          <label>
            間に
            <input type="number" min={1} max={10} value={gap} onChange={(e) => setGap(Math.max(1, e.target.valueAsNumber || 1))} />
            席以上あける
          </label>
        )}
        {type === 'frontRows' && (
          <label>
            前から
            <input
              type="number"
              min={1}
              max={state.layout.rows}
              value={rows}
              onChange={(e) => setRows(Math.max(1, e.target.valueAsNumber || 1))}
            />
            番目以内
          </label>
        )}
        {type === 'fixedSeat' && (
          <select value={seat} onChange={(e) => setSeat(e.target.value)} aria-label="席">
            <option value="">席を選ぶ</option>
            {seats.map((k) => (
              <option key={k} value={k}>
                {seatLabel(k)}
              </option>
            ))}
          </select>
        )}
        <button className="primary" onClick={submit}>
          追加
        </button>
      </div>
      {error && <p className="warn-text">{error}</p>}
    </div>
  );
}
