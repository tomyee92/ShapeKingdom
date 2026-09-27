import type { GameState } from '../logic/state';

export interface AccountInfo {
  id: string;
  name: string;
  hasPin: boolean;
}

/**
 * The only place that knows where accounts and saves live.
 * Demo: LocalBackend (this browser). Later: a server backend with the same shape.
 */
export interface Backend {
  listAccounts(): Promise<AccountInfo[]>;
  createAccount(name: string, pin?: string): Promise<AccountInfo>;
  /** Throws an Error with a user-facing message on a wrong PIN. */
  logIn(accountId: string, pin?: string): Promise<AccountInfo>;
  currentSession(): Promise<AccountInfo | null>;
  logOut(): Promise<void>;
  loadSave(accountId: string): Promise<GameState | null>;
  writeSave(accountId: string, save: GameState): Promise<void>;
}
