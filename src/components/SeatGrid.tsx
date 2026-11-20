import type { CSSProperties, ReactNode } from 'react';
import type { Layout, SeatKey } from '../types';
import { displayOrder, seatKey } from '../logic/geometry';

interface Props {
  layout: Layout;
  renderSeat: (key: SeatKey, disabled: boolean) => ReactNode;
}

/** 座席グリッド（教卓は設定に応じて上か下）。中身の描画は呼び出し側に任せる */
export function SeatGrid({ layout, renderSeat }: Props) {
  const disabled = new Set(layout.disabled);
  const cells: ReactNode[] = [];
  const order = displayOrder(layout);
  for (const r of order.rows) {
    for (const c of order.cols) {
      const k = seatKey(r, c);
      cells.push(<div key={k}>{renderSeat(k, disabled.has(k))}</div>);
    }
  }
  const deskBottom = layout.desk === 'bottom';
  const desk = (
    <div
      className={`mx-auto w-[min(240px,60%)] rounded-md border-2 border-desk bg-desk/10 py-1 text-center text-sm font-bold tracking-widest text-desk ${
        deskBottom ? 'mt-4' : 'mb-4'
      }`}
    >
      教卓
    </div>
  );
  return (
    <div className="classroom my-4">
      {!deskBottom && desk}
      <div className="seat-grid-scroll overflow-x-auto pb-1">
        <div
          className="seat-grid p-1"
          style={
            {
              gridTemplateColumns: `repeat(${layout.cols}, minmax(4.5rem, 1fr))`,
              // 印刷時に席の高さ・文字の大きさを決めるのに使う
              '--rows': layout.rows,
              '--cols': layout.cols,
            } as CSSProperties
          }
        >
          {cells}
        </div>
      </div>
      {deskBottom && desk}
    </div>
  );
}
