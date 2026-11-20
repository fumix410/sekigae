import { useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** 見出しの横に出す短い要約（例：「34人」） */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** 折りたたみできる設定セクション */
export function Section({ title, summary, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="section" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="section-title">{title}</span>
        {summary && <span className="section-summary">{summary}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}
