import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useStore } from '../state/store';
import { SeatGrid } from './SeatGrid';
import { assign } from '../logic/seating';
import { findViolations } from '../logic/constraints';
import { enabledSeats } from '../logic/geometry';
import type { SeatKey } from '../types';

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
  const [message, setMessage] = useState('');

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

  const run = () => {
    if (students.length === 0) {
      setMessage('先に名簿を登録してください。');
      return;
    }
    const lockedAsg = Object.fromEntries(locked.filter((k) => assignment[k]).map((k) => [k, assignment[k]]));
    const result = assign({ students, layout, constraints, settings, locked: lockedAsg });
    dispatch({ type: 'setAssignment', assignment: result.assignment });
    setPicked(null);
    setMessage(
      result.violations.length === 0
        ? '席替えしました。すべての条件を満たしています。'
        : 'すべての条件を満たす配置が見つかりませんでした。違反の少ない配置を表示しています。',
    );
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
      setMessage('Excel ファイルを作れませんでした。');
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
    <section className="panel seating-panel">
      <h2>座席表</h2>
      {editingSeats ? (
        <div className="edit-banner no-print">
          <span>席をクリックすると「使う／使わない」が切り替わります。</span>
          <button className="primary" onClick={onDoneEditing}>
            ✔ 編集を終える
          </button>
        </div>
      ) : (
        <>
      <div className="toolbar">
        <button className="primary big" onClick={run}>
          🎲 席替え実行
        </button>
        <button onClick={() => dispatch({ type: 'undo' })} disabled={state.undo.length === 0}>
          ↶ 元に戻す
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'confirm' });
            setMessage('この配置を確定として保存しました。');
          }}
          disabled={!hasAssignment}
        >
          ✔ 確定して保存
        </button>
        {state.confirmed && (
          <button onClick={() => dispatch({ type: 'restoreConfirmed' })}>確定した配置に戻す</button>
        )}
        <button onClick={() => dispatch({ type: 'clearAssignment' })} disabled={!hasAssignment}>
          全員を席から外す
        </button>
        <button onClick={() => window.print()} disabled={!hasAssignment}>
          印刷
        </button>
        <button onClick={exportExcel} disabled={!hasAssignment}>
          Excel に書き出す
        </button>
      </div>
      {confirmedAt && <p className="hint">最後に確定：{confirmedAt}</p>}
      {message && <p className="message">{message}</p>}
      <p className="hint no-print">
        ドラッグ＆ドロップ、または「席をタップ → 移動先をタップ」で入れ替えできます。空いている席をタップすると使わない席になり、もう一度タップすると戻ります。🔒 の席は「席替え実行」をしても動きません。
      </p>

      {hasAssignment && violations.length > 0 && (
        <div className="violations" role="status">
          <strong>守れていない条件（{violations.length}件）</strong>
          <ul>
            {violations.map((v) => (
              <li key={v.key}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}

      <SeatGrid
        layout={layout}
        renderSeat={(k, disabled) => {
          const id = assignment[k];
          const s = id ? byId.get(id) : undefined;
          if (editingSeats) {
            return (
              <button
                className={`seat seat-toggle ${disabled ? 'is-disabled' : ''}`}
                onClick={() => dispatch({ type: 'toggleDisabled', seat: k })}
                aria-pressed={!disabled}
                aria-label={disabled ? '使わない席（クリックで使う）' : '使う席（クリックで使わない）'}
              >
                {disabled ? '×' : <span className="name">{s?.name ?? ''}</span>}
              </button>
            );
          }
          if (disabled)
            return (
              <button
                className="seat seat-toggle is-disabled enable-seat"
                onClick={() => dispatch({ type: 'toggleDisabled', seat: k })}
                aria-label="使わない席（タップで使う席にする）"
                title="タップで使う席にする"
              >
                <span className="enable-hint">＋ 使う</span>
              </button>
            );
          const warn = id ? warnIds.get(id) : undefined;
          const isLocked = locked.includes(k);
          const isPicked = picked?.kind === 'seat' && picked.seat === k;
          const cls = [
            'seat',
            s ? 'occupied' : 'empty',
            warn ? 'warn' : '',
            isLocked ? 'locked' : '',
            isPicked ? 'picked' : '',
          ].join(' ');
          return (
            <div
              className={cls}
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
              <span className="name">{s?.name ?? ''}</span>
              {s && (
                <button
                  className={`lock ${isLocked ? 'on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'toggleLock', seat: k });
                  }}
                  aria-label={isLocked ? 'ロックを外す' : 'この席をロック'}
                  title={isLocked ? 'ロック中（クリックで解除）' : 'クリックでロック'}
                >
                  {isLocked ? '🔒' : '🔓'}
                </button>
              )}
            </div>
          );
        }}
      />

      <div
        className="pool no-print"
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
        <h3>
          席が決まっていない生徒（{unseated.length}人）
          {enabledSeats(layout).length < students.length && <span className="warn-text">　席が足りません</span>}
        </h3>
        {unseated.length === 0 ? (
          <p className="hint">ここに席をドラッグすると、その生徒を席から外せます。</p>
        ) : (
          <div className="chips">
            {unseated.map((s) => (
              <button
                key={s.id}
                className={`chip ${picked?.kind === 'student' && picked.id === s.id ? 'picked' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, { kind: 'student', id: s.id })}
                onClick={(e) => {
                  e.stopPropagation();
                  setPicked(picked?.kind === 'student' && picked.id === s.id ? null : { kind: 'student', id: s.id });
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
