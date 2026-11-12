import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { loadAutosave, startAutosave } from './persist/autosave';
import { useBoard } from './store/boardStore';
import { startEngineBridge } from './store/engineBridge';
import './styles.css';

async function boot(): Promise<void> {
  // Restore the last board before anything is drawn or saved.
  const saved = await loadAutosave();
  if (saved) useBoard.getState().loadBoard(saved);
  startAutosave(useBoard);
  startEngineBridge(useBoard);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Handle for the end-to-end tests and for poking around in the console.
  (window as unknown as { __soccerboard: typeof useBoard }).__soccerboard = useBoard;
}

void boot();
registerSW({ immediate: true });
