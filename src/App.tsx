import { useRef, useState } from 'react';
import { parseData, toData, useStore } from './state/store';
import { RosterSection } from './components/RosterSection';
import { ClassroomSection } from './components/ClassroomSection';
import { ConstraintSection } from './components/ConstraintSection';
import { SeatingPanel } from './components/SeatingPanel';

export function App() {
  const { state, dispatch } = useStore();
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
    try {
      const data = parseData(JSON.parse(await file.text()));
      if (!data) throw new Error();
      if (confirm('今の名簿・教室・条件・座席表を、バックアップの内容に置き換えます。よろしいですか？')) {
        dispatch({ type: 'import', data });
      }
    } catch {
      alert('このファイルはバックアップとして読み込めませんでした。（Excel の名簿や書き出した座席表は、左の「名簿」から読み込んでください）');
    }
  };

  return (
    <div className="app">
      <header className="app-header no-print">
        <h1>席替えサポート</h1>
        <div className="header-actions">
          <button onClick={exportJson} title="名簿・教室・条件・座席表をまとめてファイルに保存します">
            バックアップを保存
          </button>
          <button onClick={() => fileRef.current?.click()} title="保存したバックアップファイルから元に戻します">
            バックアップから復元
          </button>
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
      <div className="workspace">
        <aside className="settings no-print">
          <RosterSection />
          <ClassroomSection editingSeats={editingSeats} onEditingSeatsChange={setEditingSeats} />
          <ConstraintSection />
        </aside>
        <main className="main">
          <SeatingPanel editingSeats={editingSeats} onDoneEditing={() => setEditingSeats(false)} />
        </main>
      </div>
      <footer className="app-footer no-print">データはこのブラウザの中にだけ保存され、外部には送信されません。</footer>
    </div>
  );
}
