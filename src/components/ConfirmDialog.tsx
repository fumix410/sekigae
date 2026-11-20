import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** 実行ボタンの文言（既定：「OK」） */
  confirmText?: string;
  /** 削除など取り消せない操作なら赤いボタンにする */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** window.confirm の代わりに使う確認ダイアログ */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={opts !== null} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription className="whitespace-pre-line">{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              variant={opts?.destructive ? 'destructive' : 'default'}
              onClick={() => settle(true)}
            >
              {opts?.confirmText ?? 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm は ConfirmProvider の中で使ってください');
  return fn;
}
