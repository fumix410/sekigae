import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '../state/store';
import { decodeCsv, parseCsv, parsePasted, parseRosterRows } from '../logic/roster';
import type { RosterEntry } from '../logic/roster';
import { parseExportedWorkbook } from '../logic/excelImport';
import type { ExcelRestore } from '../logic/excelImport';
import type { Layout } from '../types';
import { Section } from './Section';

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
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { students } = state;

  const addEntries = (entries: RosterEntry[], source: string) => {
    if (entries.length === 0) {
      setMessage(`${source}から名前が見つかりませんでした。`);
      return false;
    }
    dispatch({ type: 'addStudents', entries });
    const front = entries.filter((e) => e.front).length;
    setMessage(`${source}から ${entries.length}人を追加しました${front ? `（前方希望 ${front}人）` : ''}。`);
    return true;
  };

  const restore = (data: ExcelRestore, fileName: string) => {
    if (data.students.length === 0) {
      setMessage(`「${fileName}」から名前が見つかりませんでした。`);
      return;
    }
    if (
      students.length > 0 &&
      !confirm(
        `「${fileName}」はこのアプリで書き出した座席表です。
今の名簿と座席の配置を、このファイルの内容に置き換えます。（同じ名前の人の条件はそのまま残ります）
よろしいですか？`,
      )
    )
      return;
    dispatch({ type: 'restoreFromExcel', data });
    const seated = Object.keys(data.seats).length;
    const { rows, cols } = data.layout;
    setMessage(
      `「${fileName}」から名簿 ${data.students.length}人と座席の配置（${seated}人）を読み込みました。` +
        (data.sizeCertain ? '' : `教室は ${cols}列×${rows}行 にしました。違っていたら「教室」で直してください。`),
    );
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
      else restore(result, file.name);
    } catch (err) {
      setMessage(err instanceof Error && err.message.includes('ファイル') ? err.message : `「${file.name}」を読み込めませんでした。`);
    }
  };

  return (
    <Section
      title="名簿"
      summary={`${students.length}人${students.some((s) => s.front) ? `・前方希望${students.filter((s) => s.front).length}人` : ''}`}
      defaultOpen={students.length === 0}
    >
      <div className="form-row">
        <button className="primary" onClick={() => fileRef.current?.click()}>
          Excel・CSV ファイルから読み込む
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" hidden onChange={onFile} />
        <a href={SAMPLE_URL} download="名簿サンプル.xlsx">
          サンプル（Excel）をダウンロード
        </a>
      </div>
      <p className="hint">
        1行目に「名前」「前方希望」の見出しがある表を読み込めます。前方希望の列は「○」「1」「あり」などを入れた人が対象です。
        「Excel に書き出す」で作ったファイルを読み込むと、名簿と座席の配置が戻ります（Excel で名前や席を直したものも使えます）。
      </p>

      <label className="block-label" htmlFor="names">
        または、名前を1行に1人ずつ入力（Excel の表をコピーして貼り付けてもかまいません）
      </label>
      <textarea
        id="names"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'青木 花子\n石井 太郎\n…'}
      />
      <button onClick={add}>名簿に追加</button>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {students.length > 0 && (
        <>
          <ol className="roster">
            {students.map((s) => (
              <li key={s.id}>
                <input
                  className="roster-name"
                  value={s.name}
                  aria-label="名前"
                  onChange={(e) => dispatch({ type: 'updateStudent', id: s.id, patch: { name: e.target.value } })}
                />
                <label className="roster-front" title="前方希望（視力など）">
                  <input
                    type="checkbox"
                    checked={s.front}
                    onChange={(e) => dispatch({ type: 'updateStudent', id: s.id, patch: { front: e.target.checked } })}
                  />
                  前方
                </label>
                <button
                  className="icon danger"
                  aria-label={`${s.name} を削除`}
                  title="削除"
                  onClick={() => {
                    if (confirm(`${s.name} を削除しますか？（関係する条件も削除されます）`))
                      dispatch({ type: 'removeStudent', id: s.id });
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            className="link danger"
            onClick={() => {
              if (confirm('名簿・条件・座席をすべて削除します。よろしいですか？')) dispatch({ type: 'clearStudents' });
            }}
          >
            名簿をすべて削除
          </button>
        </>
      )}
    </Section>
  );
}
