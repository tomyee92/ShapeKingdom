import { describe, expect, it } from 'vitest';
import { LocalBackend, type KeyValueStore } from '../src/backend/localBackend';
import { createGame } from '../src/logic/state';

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('LocalBackend', () => {
  it('creates accounts, logs in with PIN, and rejects a wrong PIN', async () => {
    const be = new LocalBackend(memoryStore());
    const a = await be.createAccount('Tom', '1234');
    expect(a.hasPin).toBe(true);
    await be.logOut();
    expect(await be.currentSession()).toBeNull();
    await expect(be.logIn(a.id, '9999')).rejects.toThrow('Wrong PIN');
    await be.logIn(a.id, '1234');
    expect((await be.currentSession())?.name).toBe('Tom');
  });

  it('allows accounts without a PIN and rejects duplicate names', async () => {
    const be = new LocalBackend(memoryStore());
    const a = await be.createAccount('Ann');
    expect(a.hasPin).toBe(false);
    await be.logIn(a.id);
    await expect(be.createAccount('ann')).rejects.toThrow('already used');
    await expect(be.createAccount('B', '12')).rejects.toThrow();
  });

  it('saves and loads game state per account', async () => {
    const be = new LocalBackend(memoryStore());
    const a = await be.createAccount('Tom');
    expect(await be.loadSave(a.id)).toBeNull();
    const s = createGame(123, 1);
    await be.writeSave(a.id, s);
    expect(await be.loadSave(a.id)).toEqual(s);
  });
});
