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
  const desk = <div className={`teacher-desk ${deskBottom ? 'at-bottom' : ''}`}>教卓</div>;
  return (
    <div className="classroom">
      {!deskBottom && desk}
      <div className="seat-grid-scroll">
        <div
          className="seat-grid"
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
