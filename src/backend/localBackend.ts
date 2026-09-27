import { SAVE_VERSION, type GameState } from '../logic/state';
import type { AccountInfo, Backend } from './backend';

interface StoredAccount {
  id: string;
  name: string;
  salt: string;
  pinHash: string | null;
}

/** Minimal slice of the Web Storage API, so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ACCOUNTS_KEY = 'sk.accounts';
const SESSION_KEY = 'sk.session';
const saveKey = (id: string) => `sk.save.${id}`;

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 16) return 'Name must be 2–16 characters.';
  return null;
}

export function validatePin(pin: string): string | null {
  if (pin === '') return null;
  return /^\d{4,6}$/.test(pin) ? null : 'PIN must be 4–6 digits (or leave it empty).';
}

/** Demo login: accounts and saves live in this browser only. Not real security. */
export class LocalBackend implements Backend {
  constructor(private store: KeyValueStore = localStorage) {}

  private accounts(): StoredAccount[] {
    try {
      return JSON.parse(this.store.getItem(ACCOUNTS_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private info(a: StoredAccount): AccountInfo {
    return { id: a.id, name: a.name, hasPin: a.pinHash !== null };
  }

  async listAccounts(): Promise<AccountInfo[]> {
    return this.accounts().map((a) => this.info(a));
  }

  async createAccount(name: string, pin = ''): Promise<AccountInfo> {
    const err = validateName(name) ?? validatePin(pin);
    if (err) throw new Error(err);
    const all = this.accounts();
    const clean = name.trim();
    if (all.some((a) => a.name.toLowerCase() === clean.toLowerCase())) throw new Error('That name is already used on this browser.');
    const salt = randomHex(8);
    const acc: StoredAccount = { id: randomHex(6), name: clean, salt, pinHash: pin ? await hashPin(pin, salt) : null };
    all.push(acc);
    this.store.setItem(ACCOUNTS_KEY, JSON.stringify(all));
    this.store.setItem(SESSION_KEY, acc.id);
    return this.info(acc);
  }

  async logIn(accountId: string, pin = ''): Promise<AccountInfo> {
    const acc = this.accounts().find((a) => a.id === accountId);
    if (!acc) throw new Error('Account not found.');
    if (acc.pinHash && (await hashPin(pin, acc.salt)) !== acc.pinHash) throw new Error('Wrong PIN.');
    this.store.setItem(SESSION_KEY, acc.id);
    return this.info(acc);
  }

  async currentSession(): Promise<AccountInfo | null> {
    const id = this.store.getItem(SESSION_KEY);
    const acc = id ? this.accounts().find((a) => a.id === id) : undefined;
    return acc ? this.info(acc) : null;
  }

  async logOut(): Promise<void> {
    this.store.removeItem(SESSION_KEY);
  }

  async loadSave(accountId: string): Promise<GameState | null> {
    try {
      const raw = this.store.getItem(saveKey(accountId));
      if (!raw) return null;
      const save = JSON.parse(raw) as GameState;
      return save.version === SAVE_VERSION ? save : null;
    } catch {
      return null;
    }
  }

  async writeSave(accountId: string, save: GameState): Promise<void> {
    this.store.setItem(saveKey(accountId), JSON.stringify(save));
  }
}
