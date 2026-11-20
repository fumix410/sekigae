import { useStore } from '../state/store';
import { ConstraintForm } from './ConstraintForm';
import { ConstraintList } from './ConstraintList';
import { Section } from './Section';
import { clamp } from './ClassroomSection';

export function ConstraintSection() {
  const { state, dispatch } = useStore();
  const { layout, settings } = state;
  const count = state.constraints.length;

  return (
    <Section title="配慮条件" summary={count > 0 ? `${count}件` : 'なし'}>
      <div className="form-row">
        <label>
          前方希望の生徒は前から
          <input
            type="number"
            min={1}
            max={layout.rows}
            value={settings.frontRows}
            onChange={(e) =>
              dispatch({ type: 'updateSettings', patch: { frontRows: clamp(e.target.valueAsNumber, 1, layout.rows) } })
            }
          />
          番目以内
        </label>
      </div>
      <ConstraintForm />
      <ConstraintList />
    </Section>
  );
}
