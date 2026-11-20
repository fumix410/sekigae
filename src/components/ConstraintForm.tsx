import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { newId, useStore } from '../state/store';
import type { Constraint, ConstraintType } from '../types';
import { enabledSeats, seatLabel } from '../logic/geometry';
import { Hint } from './Section';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    return <Hint>名簿を登録すると、生徒ごとの条件を追加できます。</Hint>;
  }

  const studentSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={`${label}を選ぶ`} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {state.students.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-dashed bg-muted/40 p-3">
      <h3 className="text-sm font-semibold">条件を追加</h3>
      <Select value={type} onValueChange={(v) => setType(v as ConstraintType)}>
        <SelectTrigger aria-label="条件の種類" className="w-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {(Object.keys(TYPE_LABELS) as ConstraintType[]).map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className={isPair ? 'grid grid-cols-2 gap-2' : 'grid'}>
        {studentSelect(a, setA, isPair ? '1人目' : '生徒')}
        {isPair && studentSelect(b, setB, '2人目')}
      </div>

      {type === 'notAdjacent' && (
        <Label className="font-normal">
          <Checkbox checked={diagonal} onCheckedChange={(v) => setDiagonal(v === true)} />
          斜めも隣とみなす
        </Label>
      )}
      {type === 'apart' && (
        <div className="flex items-center gap-2 text-sm">
          間に
          <Input
            type="number"
            min={1}
            max={10}
            value={gap}
            className="w-16 bg-background"
            aria-label="あける席の数"
            onChange={(e) => setGap(Math.max(1, e.target.valueAsNumber || 1))}
          />
          席以上あける
        </div>
      )}
      {type === 'frontRows' && (
        <div className="flex items-center gap-2 text-sm">
          前から
          <Input
            type="number"
            min={1}
            max={state.layout.rows}
            value={rows}
            className="w-16 bg-background"
            aria-label="前から何番目以内"
            onChange={(e) => setRows(Math.max(1, e.target.valueAsNumber || 1))}
          />
          番目以内
        </div>
      )}
      {type === 'fixedSeat' && (
        <Select value={seat} onValueChange={setSeat}>
          <SelectTrigger aria-label="席" className="w-full bg-background">
            <SelectValue placeholder="席を選ぶ" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {seats.map((k) => (
              <SelectItem key={k} value={k}>
                {seatLabel(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={submit} className="self-start">
        <PlusIcon data-icon="inline-start" />
        追加
      </Button>
    </div>
  );
}
