import { CheckIcon, LayoutGridIcon, MousePointerClickIcon, TriangleAlertIcon } from 'lucide-react';
import { useStore } from '../state/store';
import { enabledSeats } from '../logic/geometry';
import { Hint, Section } from './Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

interface Props {
  editingSeats: boolean;
  onEditingSeatsChange: (v: boolean) => void;
}

export function ClassroomSection({ editingSeats, onEditingSeatsChange }: Props) {
  const { state, dispatch } = useStore();
  const { layout } = state;
  const seatCount = enabledSeats(layout).length;
  const short = state.students.length - seatCount;

  return (
    <Section title="教室の配置" icon={<LayoutGridIcon />} summary={`${layout.cols}×${layout.rows}・${seatCount}席`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cols">横（列）</Label>
          <div className="flex items-center gap-2">
            <Input
              id="cols"
              type="number"
              min={1}
              max={12}
              value={layout.cols}
              onChange={(e) =>
                dispatch({ type: 'resizeLayout', rows: layout.rows, cols: clamp(e.target.valueAsNumber, 1, 12) })
              }
            />
            <span className="text-sm text-muted-foreground">席</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rows">前後（行）</Label>
          <div className="flex items-center gap-2">
            <Input
              id="rows"
              type="number"
              min={1}
              max={12}
              value={layout.rows}
              onChange={(e) =>
                dispatch({ type: 'resizeLayout', rows: clamp(e.target.valueAsNumber, 1, 12), cols: layout.cols })
              }
            />
            <span className="text-sm text-muted-foreground">席</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>教卓の位置</Label>
        <RadioGroup
          value={layout.desk === 'bottom' ? 'bottom' : 'top'}
          onValueChange={(v) => dispatch({ type: 'setDesk', desk: v as 'top' | 'bottom' })}
          aria-label="教卓の位置"
          className="grid grid-cols-2 gap-2"
        >
          {(
            [
              ['top', '上', '生徒から見た向き'],
              ['bottom', '下', '教卓から見た向き'],
            ] as const
          ).map(([value, label, sub]) => (
            <Label
              key={value}
              htmlFor={`desk-${value}`}
              className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary"
            >
              <RadioGroupItem id={`desk-${value}`} value={value} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div
        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
          short > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'
        }`}
      >
        <span>
          使える席 <strong className="tabular-nums">{seatCount}</strong> ／ 生徒{' '}
          <strong className="tabular-nums">{state.students.length}</strong>人
        </span>
        {short > 0 && (
          <span className="flex items-center gap-1 font-medium">
            <TriangleAlertIcon className="size-4" />
            {short}席足りません
          </span>
        )}
      </div>

      <Button
        variant={editingSeats ? 'default' : 'outline'}
        onClick={() => onEditingSeatsChange(!editingSeats)}
        className="w-full"
      >
        {editingSeats ? <CheckIcon data-icon="inline-start" /> : <MousePointerClickIcon data-icon="inline-start" />}
        {editingSeats ? '使わない席の編集を終える' : '使わない席を座席表で選ぶ'}
      </Button>
      <Hint>座席表で空いている席をタップしても、使う／使わないを切り替えられます。</Hint>
    </Section>
  );
}
