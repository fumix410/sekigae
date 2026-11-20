/** 名簿の取り込み（Excel・CSV・貼り付け）。UI に依存しない純粋関数 */

export interface RosterEntry {
  name: string;
  front: boolean;
}

const NAME_HEADER = /^(名前|氏名|なまえ|生徒名|児童名|name)$/i;
const FRONT_HEADER = /前方|視力|前の席|前希望/;
const NUMBER_HEADER = /^(番号|出席番号|No\.?|#)$/i;
/** 「前方希望あり」とみなす値 */
const TRUTHY = new Set(['○', '〇', '◯', '●', '◎', '✓', '✔', 'レ', '1', 'true', 'yes', 'y', 'はい', '有', 'あり', '希望', '前方']);

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('ja-JP');
  return String(v).replace(/　/g, ' ').trim();
}

export function isTruthy(v: string): boolean {
  return TRUTHY.has(v.trim().toLowerCase());
}

/**
 * 表（行×列）から名簿を読み取る。
 * - 1行目に「名前」「氏名」などの見出しがあれば、その列を名前、「前方希望」などの列を前方希望として読む。
 * - 見出しがなければ、数字だけの列（出席番号）を飛ばした最初の列を名前、その次の列を前方希望として読む。
 */
export function parseRosterRows(rows: readonly (readonly unknown[])[]): RosterEntry[] {
  const table = rows.map((r) => r.map(cellText)).filter((r) => r.some(Boolean));
  if (table.length === 0) return [];

  let body = table;
  let nameCol = table[0].findIndex((h) => NAME_HEADER.test(h));
  let frontCol = -1;
  if (nameCol >= 0) {
    body = table.slice(1);
    frontCol = table[0].findIndex((h, i) => i !== nameCol && FRONT_HEADER.test(h));
  } else {
    // 見出し行らしい行（「番号」など）だけなら飛ばす
    if (table[0].some((h) => NUMBER_HEADER.test(h) || FRONT_HEADER.test(h))) body = table.slice(1);
    const width = Math.max(...body.map((r) => r.length), 0);
    nameCol = 0;
    for (let c = 0; c < width; c++) {
      const values = body.map((r) => r[c] ?? '').filter(Boolean);
      if (values.length > 0 && !values.every((v) => /^\d+$/.test(v))) {
        nameCol = c;
        break;
      }
    }
    frontCol = nameCol + 1 < width ? nameCol + 1 : -1;
  }

  return body
    .map((r) => ({ name: r[nameCol] ?? '', front: frontCol >= 0 && isTruthy(r[frontCol] ?? '') }))
    .filter((e) => e.name !== '');
}

/** 貼り付けたテキスト（Excel からのコピーはタブ区切り）を表にする */
export function parsePasted(textValue: string): string[][] {
  return textValue.split(/\r?\n/).map((line) => line.split('\t'));
}

/** CSV（ダブルクォート対応）を表にする */
export function parseCsv(src: string): string[][] {
  const s = src.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV ファイルの中身を文字列にする。UTF-8 でなければ Shift_JIS（日本語版 Excel の既定）として読む */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('shift_jis').decode(bytes);
  }
}
