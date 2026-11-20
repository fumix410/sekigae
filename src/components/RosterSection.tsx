import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { DownloadIcon, FileSpreadsheetIcon, PlusIcon, Trash2Icon, UsersIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../state/store';
import { decodeCsv, parseCsv, parsePasted, parseRosterRows } from '../logic/roster';
import type { RosterEntry } from '../logic/roster';
import { parseExportedWorkbook } from '../logic/excelImport';
import type { ExcelRestore } from '../logic/excelImport';
import type { Layout } from '../types';
import { Hint, Section } from './Section';
import { useConfirm } from './ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/sample-roster.xlsx`;

/** 名簿のファイルを読む。このアプリで書き出した座席表なら、配置ごと戻すための内容を返す */
async function readRosterFile(file: File, current?: Layout): Promise<RosterEntry[] | ExcelRestore> {
  if (/\.(csv|txt)$/i.test(file.name)) {
    return parseRosterRows(parseCsv(decodeCsv(await file.arrayBuffer())));
  }
  if (/\.xlsx$/i.test(file.name)) {
    // Excel を読む部品は大きいので、使うときだけ読み込む
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    const restore = parseExportedWorkbook(sheets, current);
    if (restore) return restore;
    // 「名簿」という名前のシートがあればそれを、なければ1枚目を読む
    return parseRosterRows((sheets.find((s) => s.sheet === '名簿') ?? sheets[0])?.data ?? []);
  }
  throw new Error('Excel（.xlsx）か CSV（.csv）のファイルを選んでください。古い .xls 形式は、Excel で .xlsx として保存し直してください。');
}

export function RosterSection() {
  const { state, dispatch } = useStore();
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { students } = state;
  const frontCount = students.filter((s) => s.front).length;

  const addEntries = (entries: RosterEntry[], source: string) => {
    if (entries.length === 0) {
      toast.error(`${source}から名前が見つかりませんでした。`);
      return false;
    }
    dispatch({ type: 'addStudents', entries });
    const front = entries.filter((e) => e.front).length;
    toast.success(`${source}から ${entries.length}人を追加しました${front ? `（前方希望 ${front}人）` : ''}。`);
    return true;
  };

  const restore = async (data: ExcelRestore, fileName: string) => {
    if (data.students.length === 0) {
      toast.error(`「${fileName}」から名前が見つかりませんでした。`);
      return;
    }
    if (
      students.length > 0 &&
      !(await confirm({
        title: '書き出した座席表を読み込みますか？',
        description: `「${fileName}」はこのアプリで書き出した座席表です。\n今の名簿と座席の配置を、このファイルの内容に置き換えます。（同じ名前の人の条件はそのまま残ります）`,
        confirmText: '置き換える',
      }))
    )
      return;
    dispatch({ type: 'restoreFromExcel', data });
    const seated = Object.keys(data.seats).length;
    const { rows, cols } = data.layout;
    toast.success(`「${fileName}」から名簿 ${data.students.length}人と座席の配置（${seated}人）を読み込みました。`, {
      description: data.sizeCertain
        ? undefined
        : `教室は ${cols}列×${rows}行 にしました。違っていたら「教室の配置」で直してください。`,
      duration: data.sizeCertain ? undefined : 10000,
    });
  };

  const add = () => {
    if (addEntries(parseRosterRows(parsePasted(text)), '入力')) setText('');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await readRosterFile(file, students.length > 0 ? state.layout : undefined);
      if (Array.isArray(result)) addEntries(result, `「${file.name}」`);
      else await restore(result, file.name);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes('ファイル') ? err.message : `「${file.name}」を読み込めませんでした。`,
      );
    }
  };

  const removeStudent = async (id: string, name: string) => {
    const ok = await confirm({
      title: `${name} を削除しますか？`,
      description: '関係する条件も削除されます。',
      confirmText: '削除',
      destructive: true,
    });
    if (ok) dispatch({ type: 'removeStudent', id });
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: '名簿をすべて削除しますか？',
      description: '名簿・条件・座席をすべて削除します。',
      confirmText: 'すべて削除',
      destructive: true,
    });
    if (ok) dispatch({ type: 'clearStudents' });
  };

  return (
    <Section
      title="名簿"
      icon={<UsersIcon />}
      summary={`${students.length}人${frontCount ? `・前方希望${frontCount}人` : ''}`}
      defaultOpen={students.length === 0}
    >
      <div className="flex flex-col gap-2">
        <Button onClick={() => fileRef.current?.click()} className="w-full">
          <FileSpreadsheetIcon data-icon="inline-start" />
          Excel・CSV ファイルから読み込む
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" hidden onChange={onFile} />
        <Button variant="link" size="sm" asChild className="self-start px-0">
          <a href={SAMPLE_URL} download="名簿サンプル.xlsx">
            <DownloadIcon data-icon="inline-start" />
            サンプル（Excel）をダウンロード
          </a>
        </Button>
      </div>
      <Hint>
        1行目に「名前」「前方希望」の見出しがある表を読み込めます。前方希望の列は「○」「1」「あり」などを入れた人が対象です。
        「Excel に書き出す」で作ったファイルを読み込むと、名簿と座席の配置が戻ります（Excel で名前や席を直したものも使えます）。
      </Hint>

      <div className="flex flex-col gap-2">
        <Label htmlFor="names" className="leading-snug">
          または、名前を1行に1人ずつ入力
        </Label>
        <Textarea
          id="names"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'青木 花子\n石井 太郎\n…'}
        />
        <div className="flex items-center justify-between gap-2">
          <Hint>Excel の表をコピーして貼り付けてもかまいません</Hint>
          <Button variant="outline" onClick={add} disabled={!text.trim()}>
            <PlusIcon data-icon="inline-start" />
            名簿に追加
          </Button>
        </div>
      </div>

      {students.length > 0 && (
        <>
          <ol className="flex max-h-[50vh] flex-col divide-y overflow-y-auto rounded-lg border">
            {students.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 py-1 pr-1 pl-2">
                <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Input
                  className="h-7 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:border-input dark:bg-transparent"
                  value={s.name}
                  aria-label="名前"
                  onChange={(e) => dispatch({ type: 'updateStudent', id: s.id, patch: { name: e.target.value } })}
                />
                <Label className="shrink-0 cursor-pointer text-xs font-normal" title="前方希望（視力など）">
                  <Checkbox
                    checked={s.front}
                    onCheckedChange={(v) => dispatch({ type: 'updateStudent', id: s.id, patch: { front: v === true } })}
                  />
                  前方
                </Label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${s.name} を削除`}
                  title="削除"
                  onClick={() => void removeStudent(s.id, s.name)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void clearAll()}
          >
            <Trash2Icon data-icon="inline-start" />
            名簿をすべて削除
          </Button>
        </>
      )}
    </Section>
  );
}
