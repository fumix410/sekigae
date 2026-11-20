import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props {
  title: string;
  icon?: ReactNode;
  /** 見出しの横に出す短い要約（例：「34人」） */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** 折りたたみできる設定セクション */
export function Section({ title, icon, summary, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      {/* shrink-0：サイドバーの高さが足りないときに縮んで下が切れないよう、スクロールさせる */}
      <Card className="shrink-0 gap-0 py-0">
        <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
          {icon && <span className="text-primary [&_svg]:size-4">{icon}</span>}
          <span className="font-semibold">{title}</span>
          {summary && (
            <Badge variant="secondary" className="ml-auto">
              {summary}
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 border-t px-4 py-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/** 小さな補足説明 */
export function Hint({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cn('no-print text-xs leading-relaxed text-muted-foreground', className)}>{children}</p>;
}
