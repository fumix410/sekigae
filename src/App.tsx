import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArmchairIcon, DownloadIcon, ShieldCheckIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { parseData, toData, useStore } from './state/store';
import { RosterSection } from './components/RosterSection';
import { ClassroomSection } from './components/ClassroomSection';
import { ConstraintSection } from './components/ConstraintSection';
import { SeatingPanel } from './components/SeatingPanel';
import { useConfirm } from './components/ConfirmDialog';
import { Button } from './components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from './components/ui/sidebar';

export function App() {
  const { state, dispatch } = useStore();
  const confirm = useConfirm();
  const [editingSeats, setEditingSeats] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toData(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `sekigae-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    let data;
    try {
      data = parseData(JSON.parse(await file.text()));
    } catch {
      data = null;
    }
    if (!data) {
      toast.error('このファイルはバックアップとして読み込めませんでした。', {
        description: 'Excel の名簿や書き出した座席表は、左の「名簿」から読み込んでください。',
      });
      return;
    }
    const ok = await confirm({
      title: 'バックアップから復元しますか？',
      description: '今の名簿・教室・条件・座席表を、バックアップの内容に置き換えます。',
      confirmText: '置き換える',
      destructive: true,
    });
    if (ok) {
      dispatch({ type: 'import', data });
      toast.success('バックアップから復元しました。');
    }
  };

  return (
    <SidebarProvider
      className="flex-col [--header-height:--spacing(14)]"
      style={{ '--sidebar-width': '25rem' } as CSSProperties}
    >
      {/* ヘッダーは画面の横幅いっぱい。サイドバーはその下から始まる */}
      <header className="no-print sticky top-0 z-50 flex h-(--header-height) w-full shrink-0 items-center justify-between gap-3 border-b bg-background px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger title="設定欄の表示を切り替える（Ctrl+B）" />
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ArmchairIcon className="size-4.5" />
          </div>
          <h1 className="truncate text-lg font-bold tracking-tight">席替えサポート</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={exportJson}
            aria-label="バックアップを保存"
            title="名簿・教室・条件・座席表をまとめてファイルに保存します"
          >
            <DownloadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">バックアップを保存</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            aria-label="バックアップから復元"
            title="保存したバックアップファイルから元に戻します"
          >
            <UploadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">バックアップから復元</span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
          <SidebarContent className="gap-3 p-3">
            <RosterSection />
            <ClassroomSection editingSeats={editingSeats} onEditingSeatsChange={setEditingSeats} />
            <ConstraintSection />
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <div className="min-w-0 flex-1 p-4">
            <SeatingPanel editingSeats={editingSeats} onDoneEditing={() => setEditingSeats(false)} />
          </div>
          <footer className="no-print flex items-center justify-center gap-1.5 px-4 pb-6 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 shrink-0" />
            データはこのブラウザの中にだけ保存され、外部には送信されません。
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
