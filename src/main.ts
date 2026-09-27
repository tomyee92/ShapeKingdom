import './style.css';
import type { AccountInfo } from './backend/backend';
import { LocalBackend } from './backend/localBackend';
import { createGame } from './logic/state';
import { GameApp } from './ui/app';
import { showLogin } from './ui/login';

const root = document.getElementById('app')!;
const backend = new LocalBackend();
let app: GameApp | null = null;

async function play(account: AccountInfo): Promise<void> {
  const save = (await backend.loadSave(account.id)) ?? createGame(Date.now());
  await backend.writeSave(account.id, save);
  app = new GameApp(root, backend, account, save, () => {
    app?.destroy();
    app = null;
    void showLogin(root, backend, play);
  });
}

async function start(): Promise<void> {
  const session = await backend.currentSession();
  if (session) await play(session);
  else await showLogin(root, backend, play);
}

void start();
