/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { decodeCsv, parseCsv, parsePasted, parseRosterRows } from './roster';

describe('parseRosterRows', () => {
  it('見出しから名前と前方希望の列を見つける', () => {
    const rows = [
      ['番号', '名前', '前方希望'],
      [1, '青木 花子', '○'],
      [2, '石井 太郎', ''],
      [3, '上田　次郎', '1'],
    ];
    expect(parseRosterRows(rows)).toEqual([
      { name: '青木 花子', front: true },
      { name: '石井 太郎', front: false },
      { name: '上田 次郎', front: true },
    ]);
  });

  it('見出しの列の順番が違っても読める', () => {
    const rows = [
      ['視力配慮', '氏名'],
      ['', 'A'],
      ['あり', 'B'],
    ];
    expect(parseRosterRows(rows)).toEqual([
      { name: 'A', front: false },
      { name: 'B', front: true },
    ]);
  });

  it('見出しがなければ、番号の列を飛ばして名前を読む', () => {
    const rows = [
      [1, 'A', '○'],
      [2, 'B'],
      [null, null],
    ];
    expect(parseRosterRows(rows)).toEqual([
      { name: 'A', front: true },
      { name: 'B', front: false },
    ]);
  });

  it('名前だけの貼り付け（従来の形式）', () => {
    expect(parseRosterRows(parsePasted('A\n\nB\r\n'))).toEqual([
      { name: 'A', front: false },
      { name: 'B', front: false },
    ]);
  });

  it('Excel からのタブ区切りの貼り付け', () => {
    expect(parseRosterRows(parsePasted('番号\t名前\t前方希望\n1\tA\t○\n2\tB\t'))).toEqual([
      { name: 'A', front: true },
      { name: 'B', front: false },
    ]);
  });
});

describe('前方希望・見出しの表記ゆれ', () => {
  it('「○」「〇」「1」「あり」「はい」は希望あり、それ以外は希望なし', () => {
    const yes = ['○', '〇', '1', 'あり', 'はい', ' ○ '];
    const no = ['×', '0', 'なし', '', 'いいえ'];
    const rows = [['名前', '前方希望'], ...[...yes, ...no].map((v, i) => [`生徒${i}`, v])];
    expect(parseRosterRows(rows).map((e) => e.front)).toEqual([...yes.map(() => true), ...no.map(() => false)]);
  });

  it('見出しの前後の空白・全角スペースがあっても見出しとして扱う', () => {
    const rows = [
      [' 番号 ', '　氏名　', ' 前方希望 '],
      [1, 'A', '○'],
    ];
    expect(parseRosterRows(rows)).toEqual([{ name: 'A', front: true }]);
  });

  it('名前の欄が空の行は飛ばす', () => {
    const rows = [
      ['番号', '名前', '前方希望'],
      [1, 'A', ''],
      [2, '', '○'],
      [3, 'C', ''],
    ];
    expect(parseRosterRows(rows).map((e) => e.name)).toEqual(['A', 'C']);
  });
});

describe('公開しているサンプル', () => {
  it('xlsx と csv が同じ内容（35人・前方希望3人）', async () => {
    const x = parseRosterRows(await readSheet('public/samples/sample-roster.xlsx'));
    const buf = readFileSync('public/samples/sample-roster.csv');
    const c = parseRosterRows(parseCsv(decodeCsv(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)));
    expect(x).toHaveLength(35);
    expect(x.filter((e) => e.front).map((e) => e.name)).toEqual(['上野 湊', '鈴木 莉子', '福田 千尋']);
    expect(c).toEqual(x);
  });
});

describe('parseCsv', () => {
  it('BOM・クォート・改行を扱う', () => {
    expect(parseCsv('﻿a,"b,c","d""e"\r\n1,2,3')).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });
});

describe('decodeCsv', () => {
  it('UTF-8 と Shift_JIS を読み分ける', () => {
    const utf8 = new TextEncoder().encode('名前').buffer as ArrayBuffer;
    expect(decodeCsv(utf8)).toBe('名前');
    // 「名前」の Shift_JIS
    const sjis = new Uint8Array([0x96, 0xbc, 0x91, 0x4f]).buffer;
    expect(decodeCsv(sjis)).toBe('名前');
  });
});
