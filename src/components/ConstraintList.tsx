import { useStore } from '../state/store';
import { describeConstraint } from '../logic/constraints';

export function ConstraintList() {
  const { state, dispatch } = useStore();
  const names = new Map(state.students.map((s) => [s.id, s.name]));
  const nameOf = (id: string) => names.get(id) ?? '(不明)';

  if (state.constraints.length === 0) {
    return <p className="hint">個別の条件はまだありません。</p>;
  }
  return (
    <ul className="constraint-list">
      {state.constraints.map((c) => (
        <li key={c.id}>
          <span>{describeConstraint(c, nameOf)}</span>
          <button className="link danger" onClick={() => dispatch({ type: 'removeConstraint', id: c.id })}>
            削除
          </button>
        </li>
      ))}
    </ul>
  );
}
