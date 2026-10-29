import Dexie, { type Table } from 'dexie';
import type { GameState } from '../engine/types';

interface SaveRow { id: string; savedAt: number; day: number; cash: number; state: GameState }

class AdTycoonDB extends Dexie {
  saves!: Table<SaveRow, string>;
  constructor() {
    super('adtycoon');
    this.version(1).stores({ saves: 'id, savedAt' });
  }
}

export const db = new AdTycoonDB();
const SLOT = 'slot1';

export async function saveGame(state: GameState) {
  await db.saves.put({ id: SLOT, savedAt: Date.now(), day: state.day, cash: state.cash, state });
}
export async function loadGame(): Promise<SaveRow | undefined> {
  return db.saves.get(SLOT);
}
export async function deleteSave() {
  await db.saves.delete(SLOT);
}
