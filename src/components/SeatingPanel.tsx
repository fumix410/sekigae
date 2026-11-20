import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  CheckIcon,
  DicesIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  InfoIcon,
  LockIcon,
  LockOpenIcon,
  MousePointerClickIcon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  TriangleAlertIcon,
  Undo2Icon,
  UserMinusIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../state/store';
import { SeatGrid } from './SeatGrid';
import { assign } from '../logic/seating';
import { findViolations } from '../logic/constraints';
import { enabledSeats } from '../logic/geometry';
import type { SeatKey } from '../types';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/** ドラッグ中／選択中のもの：席 or 未配置の生徒 */
type Pick = { kind: 'seat'; seat: SeatKey } | { kind: 'student'; id: string };

const DND_TYPE = 'application/x-sekigae';

interface Props {
  /** 使わない席をクリックで切り替えるモード */
  editingSeats: boolean;
  onDoneEditing: () => void;
}

export function SeatingPanel({ editingSeats, onDoneEditing }: Props) {
  const { state, dispatch } = useStore();
  const { students, layout, constraints, settings, assignment, locked } = state;
  const [picked, setPicked] = useState<Pick | null>(null);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const violations = useMemo(
    () => findViolations(students, layout, constraints, settings, assignment),
    [students, layout, constraints, settings, assignment],
  );
  const warnIds = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of violations) {
      if (v.key === 'unseated') continue;
      for (const id of v.studentIds) m.set(id, [...(m.get(id) ?? []), v.message]);
    }
    return m;
  }, [violations]);
  const seatedIds = new Set(Object.values(assignment));
  const unseated = students.filter((s) => !seatedIds.has(s.id));
  const hasAssignment = Object.keys(assignment).length > 0;
  const seatShort = enabledSeats(layout).length < students.length;

  const run = () => {
    if (students.length === 0) {
      toast.error('先に名簿を登録してください。');
      return;
    }
    const lockedAsg = Object.fromEntries(locked.filter((k) => assignment[k]).map((k) => [k, assignment[k]]));
    const result = assign({ students, layout, constraints, settings, locked: lockedAsg });
    dispatch({ type: 'setAssignment', assignment: result.assignment });
    setPicked(null);
    if (result.violations.length === 0) toast.success('席替えしました。すべての条件を満たしています。');
    else
      toast.warning('すべての条件を満たす配置が見つかりませんでした。', {
        description: '違反の少ない配置を表示しています。',
      });
  };

  const exportExcel = async () => {
    try {
      // Excel を作る部品は大きいので、使うときだけ読み込む
      const [{ default: writeExcelFile }, { buildSeatingSheets }] = await Promise.all([
        import('write-excel-file/browser'),
        import('../logic/excelExport'),
      ]);
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      await writeExcelFile(buildSeatingSheets(students, layout, assignment, d)).toFile(`座席表-${ymd}.xlsx`);
    } catch {
      toast.error('Excel ファイルを作れませんでした。');
    }
  };

  /** pick を席 target に落とす */
  const drop = (p: Pick, target: SeatKey) => {
    if (p.kind === 'seat') dispatch({ type: 'swapSeats', from: p.seat, to: target });
    else dispatch({ type: 'placeStudent', id: p.id, seat: target });
    setPicked(null);
  };

  const onDragStart = (e: DragEvent, p: Pick) => {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(p));
    e.dataTransfer.effectAllowed = 'move';
  };
  const readDrag = (e: DragEvent): Pick | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(DND_TYPE)) as Pick;
    } catch {
      return null;
    }
  };
  const allowDrop = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_TYPE)) e.preventDefault();
  };

  // クリック操作（タッチ端末向け）：1回目で選択、2回目で入れ替え
  const clickSeat = (k: SeatKey) => {
    if (!picked) {
      // 生徒のいる席は選択、空いている席は「使わない席」に切り替え
      if (assignment[k]) setPicked({ kind: 'seat', seat: k });
      else dispatch({ type: 'toggleDisabled', seat: k });
      return;
    }
    if (picked.kind === 'seat' && picked.seat === k) setPicked(null);
    else drop(picked, k);
  };

  const confirmedAt = state.confirmed ? new Date(state.confirmed.at).toLocaleString('ja-JP') : null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="print-plain gap-0 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">座席表</h2>
          {confirmedAt && !editingSeats && (
            <Badge variant="outline" className="no-print text-muted-foreground">
              <HistoryIcon />
              最後に確定：{confirmedAt}
            </Badge>
          )}
        </div>

        {editingSeats ? (
          <Alert className="no-print mt-3 border-warn-border bg-warn">
            <MousePointerClickIcon />
            <AlertTitle>使わない席を選んでいます</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              席をクリックすると「使う／使わない」が切り替わります。
              <Button size="sm" onClick={onDoneEditing}>
                <CheckIcon data-icon="inline-start" />
                編集を終える
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="no-print mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" onClick={run} className="h-10 px-4 text-base">
                <DicesIcon data-icon="inline-start" className="size-5" />
                席替え実行
              </Button>
              <Button variant="outline" size="lg" onClick={() => dispatch({ type: 'undo' })} disabled={state.undo.length === 0}>
                <Undo2Icon data-icon="inline-start" />
                元に戻す
              </Button>
              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  dispatch({ type: 'confirm' });
                  toast.success('この配置を確定として保存しました。');
                }}
                disabled={!hasAssignment}
              >
                <SaveIcon data-icon="inline-start" />
                確定して保存
              </Button>
              {state.confirmed && (
                <Button variant="outline" size="lg" onClick={() => dispatch({ type: 'restoreConfirmed' })}>
                  <HistoryIcon data-icon="inline-start" />
                  確定した配置に戻す
                </Button>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="secondary" size="lg" onClick={() => window.print()} disabled={!hasAssignment}>
                  <PrinterIcon data-icon="inline-start" />
                  印刷
                </Button>
                <Button variant="secondary" size="lg" onClick={exportExcel} disabled={!hasAssignment}>
                  <FileSpreadsheetIcon data-icon="inline-start" />
                  Excel に書き出す
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground"
                  onClick={() => dispatch({ type: 'clearAssignment' })}
                  disabled={!hasAssignment}
                >
                  <UserMinusIcon data-icon="inline-start" />
                  全員を席から外す
                </Button>
              </div>
            </div>

            <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                ドラッグ＆ドロップ、または「席をタップ → 移動先をタップ」で入れ替えできます。空いている席をタップすると使わない席になり、もう一度タップすると戻ります。
                <LockIcon className="mx-0.5 inline size-3 align-[-1px]" />
                の席は「席替え実行」をしても動きません。
              </span>
            </p>

            {hasAssignment && violations.length > 0 && (
              <Alert className="border-warn-border bg-warn text-warn-foreground" role="status">
                <TriangleAlertIcon />
                <AlertTitle>守れていない条件（{violations.length}件）</AlertTitle>
                <AlertDescription className="text-warn-foreground/90">
                  <ul className="list-disc pl-4">
                    {violations.map((v) => (
                      <li key={v.key}>{v.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <SeatGrid
          layout={layout}
          renderSeat={(k, disabled) => {
            const id = assignment[k];
            const s = id ? byId.get(id) : undefined;
            if (editingSeats) {
              return (
                <button
                  className={cn(
                    'seat cursor-pointer rounded-lg border p-0 transition-colors',
                    disabled
                      ? 'is-disabled border-dashed text-muted-foreground'
                      : 'border-primary/40 bg-secondary hover:bg-secondary/70',
                  )}
                  onClick={() => dispatch({ type: 'toggleDisabled', seat: k })}
                  aria-pressed={!disabled}
                  aria-label={disabled ? '使わない席（クリックで使う）' : '使う席（クリックで使わない）'}
                >
                  {disabled ? <XIcon className="size-5" /> : <span className="name">{s?.name ?? ''}</span>}
                </button>
              );
            }
            if (disabled)
              return (
                <button
                  className="seat is-disabled group/seat cursor-pointer rounded-lg border border-dashed p-0 text-muted-foreground"
                  onClick={() => dispatch({ type: 'toggleDisabled', seat: k })}
                  aria-label="使わない席（タップで使う席にする）"
                  title="タップで使う席にする"
                >
                  <span className="enable-hint flex items-center gap-0.5 rounded bg-card/90 px-1.5 py-0.5 text-xs opacity-0 transition-opacity group-hover/seat:opacity-100 group-focus-visible/seat:opacity-100 pointer-coarse:opacity-70">
                    <PlusIcon className="size-3" />
                    使う
                  </span>
                </button>
              );
            const warn = id ? warnIds.get(id) : undefined;
            const isLocked = locked.includes(k);
            const isPicked = picked?.kind === 'seat' && picked.seat === k;
            return (
              <div
                className={cn(
                  'seat group/seat rounded-lg border bg-card outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50',
                  s
                    ? 'cursor-grab shadow-xs hover:border-primary/60 active:cursor-grabbing'
                    : 'cursor-pointer border-dashed hover:bg-muted/60',
                  warn && 'border-warn-border bg-warn',
                  isLocked && 'border-primary bg-secondary',
                  isPicked && 'outline-3 outline-offset-1 outline-picked',
                )}
                draggable={!!s}
                onDragStart={(e) => onDragStart(e, { kind: 'seat', seat: k })}
                onDragOver={allowDrop}
                onDrop={(e) => {
                  e.preventDefault();
                  const p = readDrag(e);
                  if (p) drop(p, k);
                }}
                onClick={() => clickSeat(k)}
                title={warn?.join('\n') ?? (s ? undefined : 'タップで使わない席にする')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    clickSeat(k);
                  }
                }}
              >
                {warn && <TriangleAlertIcon className="no-print absolute top-1 left-1 size-3.5 text-warn-border" />}
                <span className="name">{s?.name ?? ''}</span>
                {s && (
                  <button
                    className={cn(
                      'lock absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-md transition-opacity hover:bg-muted',
                      isLocked
                        ? 'text-primary opacity-100'
                        : 'text-muted-foreground opacity-30 group-hover/seat:opacity-100 pointer-coarse:opacity-60',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'toggleLock', seat: k });
                    }}
                    aria-label={isLocked ? 'ロックを外す' : 'この席をロック'}
                    title={isLocked ? 'ロック中（クリックで解除）' : 'クリックでロック'}
                  >
                    {isLocked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
                  </button>
                )}
              </div>
            );
          }}
        />
      </Card>

      <Card
        className={cn(
          'no-print gap-3 border-2 border-dashed px-5 py-4 ring-0 transition-colors',
          picked?.kind === 'seat' && 'cursor-pointer border-primary/50 bg-secondary/40',
        )}
        onDragOver={allowDrop}
        onDrop={(e) => {
          e.preventDefault();
          const p = readDrag(e);
          if (p?.kind === 'seat') dispatch({ type: 'unseat', seat: p.seat });
          setPicked(null);
        }}
        onClick={() => {
          if (picked?.kind === 'seat') {
            dispatch({ type: 'unseat', seat: picked.seat });
            setPicked(null);
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">席が決まっていない生徒</h3>
          <Badge variant="secondary">{unseated.length}人</Badge>
          {seatShort && (
            <Badge variant="destructive">
              <TriangleAlertIcon />
              席が足りません
            </Badge>
          )}
        </div>
        {unseated.length === 0 ? (
          <p className="text-xs text-muted-foreground">ここに席をドラッグすると、その生徒を席から外せます。</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unseated.map((s) => {
              const isPicked = picked?.kind === 'student' && picked.id === s.id;
              return (
                <Button
                  key={s.id}
                  variant="outline"
                  size="sm"
                  className={cn('cursor-grab active:cursor-grabbing', isPicked && 'outline-3 outline-offset-1 outline-picked')}
                  draggable
                  onDragStart={(e) => onDragStart(e, { kind: 'student', id: s.id })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked(isPicked ? null : { kind: 'student', id: s.id });
                  }}
                >
                  {s.name}
                </Button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
