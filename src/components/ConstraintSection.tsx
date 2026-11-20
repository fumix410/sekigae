import { ListChecksIcon } from 'lucide-react';
import { useStore } from '../state/store';
import { ConstraintForm } from './ConstraintForm';
import { ConstraintList } from './ConstraintList';
import { Section } from './Section';
import { clamp } from './ClassroomSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ConstraintSection() {
  const { state, dispatch } = useStore();
  const { layout, settings } = state;
  const count = state.constraints.length;

  return (
    <Section title="配慮条件" icon={<ListChecksIcon />} summary={count > 0 ? `${count}件` : 'なし'}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Label htmlFor="front-rows" className="font-normal">
          前方希望の生徒は前から
        </Label>
        <Input
          id="front-rows"
          type="number"
          min={1}
          max={layout.rows}
          value={settings.frontRows}
          className="w-16"
          onChange={(e) =>
            dispatch({ type: 'updateSettings', patch: { frontRows: clamp(e.target.valueAsNumber, 1, layout.rows) } })
          }
        />
        <span>番目以内</span>
      </div>
      <ConstraintList />
      <ConstraintForm />
    </Section>
  );
}
