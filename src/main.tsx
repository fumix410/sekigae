import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { ConfirmProvider } from './components/ConfirmDialog';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';

// OS の設定に合わせてダークモードを切り替える（印刷するときは常にライト）
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (dark = darkQuery.matches) => document.documentElement.classList.toggle('dark', dark);
applyTheme();
darkQuery.addEventListener('change', () => applyTheme());
window.addEventListener('beforeprint', () => applyTheme(false));
window.addEventListener('afterprint', () => applyTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <TooltipProvider delayDuration={300}>
        <ConfirmProvider>
          <App />
          <Toaster position="top-center" richColors closeButton />
        </ConfirmProvider>
      </TooltipProvider>
    </StoreProvider>
  </StrictMode>,
);
