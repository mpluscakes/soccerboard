import { get, set } from 'idb-keyval';
import { migrate } from '../model/migrate';
import type { BoardState } from '../model/types';
import type { BoardStoreApi } from '../store/boardStore';

const KEY = 'autosave';
const DEBOUNCE_MS = 500;

/** The last saved board, upgraded to the current schema, or null. */
export async function loadAutosave(): Promise<BoardState | null> {
  try {
    return migrate(await get(KEY));
  } catch {
    return null; // private mode / storage blocked: start fresh
  }
}

/** Save the board 500 ms after it last changed, and right away when the app is hidden. */
export function startAutosave(store: BoardStoreApi): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const save = (): void => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    set(KEY, store.getState().board).catch(() => undefined);
  };
  const unsubscribe = store.subscribe((state, prev) => {
    if (state.board === prev.board) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, DEBOUNCE_MS);
  });
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', save);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', save);
  };
}
