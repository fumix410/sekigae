import { Trash2Icon } from 'lucide-react';
import { useStore } from '../state/store';
import { describeConstraint } from '../logic/constraints';
import { Hint } from './Section';
import { Button } from '@/components/ui/button';

export function ConstraintList() {
  const { state, dispatch } = useStore();
  const names = new Map(state.students.map((s) => [s.id, s.name]));
  const nameOf = (id: string) => names.get(id) ?? '(不明)';

  if (state.constraints.length === 0) {
    return <Hint>個別の条件はまだありません。</Hint>;
  }
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
      {state.constraints.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-3 text-sm">
          <span>{describeConstraint(c, nameOf)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="この条件を削除"
            title="削除"
            onClick={() => dispatch({ type: 'removeConstraint', id: c.id })}
          >
            <Trash2Icon />
          </Button>
        </li>
      ))}
    </ul>
  );
}
