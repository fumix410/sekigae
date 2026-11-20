import { useStore } from '../state/store';
import { enabledSeats } from '../logic/geometry';
import { Section } from './Section';

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
    <Section title="教室の配置" summary={`${layout.cols}×${layout.rows}・${seatCount}席`}>
      <div className="form-row">
        <label>
          横
          <input
            type="number"
            min={1}
            max={12}
            value={layout.cols}
            onChange={(e) =>
              dispatch({ type: 'resizeLayout', rows: layout.rows, cols: clamp(e.target.valueAsNumber, 1, 12) })
            }
          />
          席
        </label>
        <label>
          前後
          <input
            type="number"
            min={1}
            max={12}
            value={layout.rows}
            onChange={(e) =>
              dispatch({ type: 'resizeLayout', rows: clamp(e.target.valueAsNumber, 1, 12), cols: layout.cols })
            }
          />
          席
        </label>
      </div>
      <div className="form-row" role="radiogroup" aria-label="教卓の位置">
        教卓の位置：
        <label>
          <input
            type="radio"
            name="desk"
            checked={layout.desk !== 'bottom'}
            onChange={() => dispatch({ type: 'setDesk', desk: 'top' })}
          />
          上（生徒から見た向き）
        </label>
        <label>
          <input
            type="radio"
            name="desk"
            checked={layout.desk === 'bottom'}
            onChange={() => dispatch({ type: 'setDesk', desk: 'bottom' })}
          />
          下（教卓から見た向き）
        </label>
      </div>
      <p className="hint">
        使える席：{seatCount}席 ／ 生徒：{state.students.length}人
        {short > 0 && <strong className="warn-text">（{short}席足りません）</strong>}
      </p>
      <button className={editingSeats ? 'primary' : ''} onClick={() => onEditingSeatsChange(!editingSeats)}>
        {editingSeats ? '✔ 使わない席の編集を終える' : '使わない席を座席表で選ぶ'}
      </button>
      <p className="hint">座席表で空いている席をタップしても、使う／使わないを切り替えられます。</p>
    </Section>
  );
}
